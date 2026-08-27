import { desc, inArray } from 'drizzle-orm';
import type {
  ContentImportBatch,
  ContentImportPreview,
  ContentImportRequest,
  PoemPayload,
  WordPayload,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { contentImports, contentItems } from '../db/schema.js';
import { sha256 } from '../lib/crypto.js';

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

function contentImportFingerprint(input: ContentImportRequest) {
  return sha256(stableSerialize(input));
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

function collectQualityIssues(input: ContentImportRequest): ContentImportPreview['issues'] {
  return input.items.flatMap((item) => {
    if (item.kind === 'word') {
      const payload = item.payload as WordPayload;
      return [
        ...(!payload.phonetic
          ? [{ key: item.key, field: 'payload.phonetic', message: '缺少音标。' }]
          : []),
        ...(!payload.example || !payload.exampleTranslation
          ? [{ key: item.key, field: 'payload.example', message: '例句或例句翻译不完整。' }]
          : []),
      ];
    }
    const payload = item.payload as PoemPayload;
    return [
      ...(!payload.translation
        ? [{ key: item.key, field: 'payload.translation', message: '缺少内容释义。' }]
        : []),
      ...(payload.keyPoints.length === 0
        ? [{ key: item.key, field: 'payload.keyPoints', message: '缺少考查要点。' }]
        : []),
    ];
  });
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

  const preview: ContentImportPreview = {
    fingerprint: contentImportFingerprint(input),
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
    issues: collectQualityIssues(input),
  };

  return { preview, unchangedKeys };
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
  const analysis = await analyzeContentImport(input);
  if (analysis.preview.fingerprint !== fingerprint) {
    return null;
  }

  const now = new Date();
  const batch = await db.transaction(async (transaction) => {
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
      await transaction
        .insert(contentItems)
        .values({
          ...item,
          status: input.status,
          source: input.source,
          sourceVersion: input.version,
          importBatchId: createdBatch.id,
          importedBy: userId,
          importedAt: now,
        })
        .onConflictDoUpdate({
          target: contentItems.key,
          set: {
            grade: item.grade,
            kind: item.kind,
            payload: item.payload,
            status: input.status,
            tags: item.tags,
            textbook: item.textbook,
            unit: item.unit,
            source: input.source,
            sourceVersion: input.version,
            importBatchId: createdBatch.id,
            importedBy: userId,
            importedAt: now,
            updatedAt: now,
          },
        });
    }
    return createdBatch;
  });

  return { batch: presentImportBatch(batch), preview: analysis.preview };
}

export async function listContentImportBatches() {
  const batches = await db
    .select()
    .from(contentImports)
    .orderBy(desc(contentImports.createdAt))
    .limit(30);
  return batches.map(presentImportBatch);
}
