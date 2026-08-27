import { desc, eq, inArray } from 'drizzle-orm';
import type {
  ContentImportBatch,
  ContentImportPreview,
  ContentImportRequest,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { contentImports, contentItems, contentVersions } from '../db/schema.js';
import { sha256 } from '../lib/crypto.js';
import {
  inspectContentQuality,
  restoreImportedVersion,
  writeImportedContent,
} from './content-lifecycle.js';

type StoredContent = typeof contentItems.$inferSelect;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function hasChanged(
  stored: StoredContent,
  item: ContentImportRequest['items'][number],
  input: ContentImportRequest
) {
  return (
    stored.kind !== item.kind ||
    stored.grade !== item.grade ||
    stored.textbook !== item.textbook ||
    stored.unit !== item.unit ||
    stored.status !== input.status ||
    stored.source !== input.source ||
    stored.sourceVersion !== input.version ||
    stableSerialize(stored.tags) !== stableSerialize(item.tags) ||
    stableSerialize(stored.payload) !== stableSerialize(item.payload)
  );
}

async function analyzeContentImport(input: ContentImportRequest) {
  const existing = await db
    .select()
    .from(contentItems)
    .where(
      inArray(
        contentItems.key,
        input.items.map((item) => item.key)
      )
    );
  const existingByKey = new Map(existing.map((item) => [item.key, item]));
  const createdKeys = new Set<string>();
  const updatedKeys = new Set<string>();
  const unchangedKeys = new Set<string>();

  for (const item of input.items) {
    const stored = existingByKey.get(item.key);
    if (!stored) createdKeys.add(item.key);
    else if (hasChanged(stored, item, input)) updatedKeys.add(item.key);
    else unchangedKeys.add(item.key);
  }

  const baseline = input.items.map((item) => {
    const stored = existingByKey.get(item.key);
    return {
      key: item.key,
      currentVersionId: stored?.currentVersionId ?? null,
      updatedAt: stored?.updatedAt.toISOString() ?? null,
    };
  });
  const preview: ContentImportPreview = {
    fingerprint: sha256(stableSerialize({ input, baseline })),
    total: input.items.length,
    created: createdKeys.size,
    updated: updatedKeys.size,
    unchanged: unchangedKeys.size,
    words: input.items.filter((item) => item.kind === 'word').length,
    poems: input.items.filter((item) => item.kind === 'poem').length,
    grades: {
      高一: input.items.filter((item) => item.grade === '高一').length,
      高二: input.items.filter((item) => item.grade === '高二').length,
      高三: input.items.filter((item) => item.grade === '高三').length,
    },
    units: new Set(input.items.map((item) => `${item.textbook}\u0000${item.unit}`)).size,
    issues: input.items.flatMap(inspectContentQuality),
  };

  return {
    preview,
    unchangedKeys,
    baselineByKey: new Map(
      baseline.map((item) => [
        item.key,
        { currentVersionId: item.currentVersionId, updatedAt: item.updatedAt },
      ])
    ),
  };
}

function presentImportBatch(batch: typeof contentImports.$inferSelect): ContentImportBatch {
  return {
    id: batch.id,
    source: batch.source,
    version: batch.sourceVersion,
    status: batch.targetStatus,
    itemCount: batch.itemCount,
    createdCount: batch.createdCount,
    updatedCount: batch.updatedCount,
    unchangedCount: batch.unchangedCount,
    rolledBackAt: batch.rolledBackAt?.toISOString() ?? null,
    rollbackRevertedCount: batch.rollbackRevertedCount,
    rollbackSkippedCount: batch.rollbackSkippedCount,
    createdAt: batch.createdAt.toISOString(),
  };
}

export async function previewContentImport(input: ContentImportRequest) {
  return (await analyzeContentImport(input)).preview;
}

export async function applyContentImport(
  userId: string,
  input: ContentImportRequest,
  fingerprint: string
) {
  const [existingBatch] = await db
    .select()
    .from(contentImports)
    .where(eq(contentImports.fingerprint, fingerprint))
    .limit(1);
  if (existingBatch) {
    const preview = await previewContentImport(input);
    return { batch: presentImportBatch(existingBatch), preview, idempotent: true };
  }
  const analysis = await analyzeContentImport(input);
  if (analysis.preview.fingerprint !== fingerprint) {
    return null;
  }

  let batch: typeof contentImports.$inferSelect;
  try {
    batch = await db.transaction(async (transaction) => {
      const lockedItems = await transaction
        .select()
        .from(contentItems)
        .where(
          inArray(
            contentItems.key,
            input.items.map((item) => item.key)
          )
        )
        .for('update');
      const lockedByKey = new Map(lockedItems.map((item) => [item.key, item]));
      for (const item of input.items) {
        const expected = analysis.baselineByKey.get(item.key);
        const locked = lockedByKey.get(item.key);
        if (
          !expected ||
          (locked &&
            (locked.currentVersionId !== expected.currentVersionId ||
              locked.updatedAt.toISOString() !== expected.updatedAt)) ||
          (!locked && (expected.currentVersionId !== null || expected.updatedAt !== null)) ||
          (locked && expected.currentVersionId === null && expected.updatedAt === null)
        ) {
          throw new Error('CONTENT_IMPORT_BASELINE_CONFLICT');
        }
      }
      const [createdBatch] = await transaction
        .insert(contentImports)
        .values({
          createdBy: userId,
          source: input.source,
          sourceVersion: input.version,
          targetStatus: input.status,
          fingerprint,
          itemCount: analysis.preview.total,
          createdCount: analysis.preview.created,
          updatedCount: analysis.preview.updated,
          unchangedCount: analysis.preview.unchanged,
        })
        .returning();

      for (const item of input.items) {
        if (analysis.unchangedKeys.has(item.key)) continue;
        const baseline = analysis.baselineByKey.get(item.key);
        if (!baseline) throw new Error('CONTENT_IMPORT_BASELINE_CONFLICT');
        await writeImportedContent(
          transaction,
          userId,
          createdBatch.id,
          item,
          input.source,
          input.version,
          input.status,
          baseline
        );
      }
      return createdBatch;
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTENT_IMPORT_BASELINE_CONFLICT') {
      return null;
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      const [concurrentBatch] = await db
        .select()
        .from(contentImports)
        .where(eq(contentImports.fingerprint, fingerprint))
        .limit(1);
      if (concurrentBatch) {
        return {
          batch: presentImportBatch(concurrentBatch),
          preview: analysis.preview,
          idempotent: true,
        };
      }
    }
    throw error;
  }

  return { batch: presentImportBatch(batch), preview: analysis.preview };
}

export async function rollbackContentImport(userId: string, importId: string, note: string) {
  return db.transaction(async (transaction) => {
    const [batch] = await transaction
      .select()
      .from(contentImports)
      .where(eq(contentImports.id, importId))
      .limit(1)
      .for('update');
    if (!batch) return { outcome: 'not_found' as const };
    if (batch.rolledBackAt) {
      return { outcome: 'rolled_back' as const, batch: presentImportBatch(batch) };
    }
    const importedVersions = await transaction
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.importBatchId, importId))
      .orderBy(desc(contentVersions.versionNumber));
    let revertedCount = 0;
    let skippedCount = 0;
    for (const version of importedVersions) {
      const result = await restoreImportedVersion(transaction, userId, version, note);
      if (result.reverted) revertedCount += 1;
      else skippedCount += 1;
    }
    const [updated] = await transaction
      .update(contentImports)
      .set({
        rolledBackAt: new Date(),
        rolledBackBy: userId,
        rollbackRevertedCount: revertedCount,
        rollbackSkippedCount: skippedCount,
      })
      .where(eq(contentImports.id, importId))
      .returning();
    return { outcome: 'rolled_back' as const, batch: presentImportBatch(updated) };
  });
}

export async function listContentImportBatches() {
  const batches = await db
    .select()
    .from(contentImports)
    .orderBy(desc(contentImports.createdAt))
    .limit(30);
  return batches.map(presentImportBatch);
}
