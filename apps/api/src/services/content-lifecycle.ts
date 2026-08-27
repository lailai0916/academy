import { and, desc, eq, lt } from 'drizzle-orm';
import type {
  AdminContentDetail,
  ContentImportIssue,
  ContentImportItem,
  ContentRevision,
  PoemPayload,
  WordPayload,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { contentItems, contentVersions, learningCards, profiles, users } from '../db/schema.js';
import { sha256 } from '../lib/crypto.js';

export const CONTENT_QUALITY_POLICY = '2026.1';

type ContentStatus = 'draft' | 'published' | 'archived';
type ContentChangeKind = 'imported' | 'edited' | 'published' | 'archived' | 'restored' | 'seeded';
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type StoredContent = typeof contentItems.$inferSelect;
type StoredVersion = typeof contentVersions.$inferSelect;

export type ContentVersionInput = Omit<ContentImportItem, 'key'> & {
  source: string;
  sourceVersion: string;
  status: ContentStatus;
};

type WriteVersionOptions = {
  actorId: string | null;
  changeKind: ContentChangeKind;
  importBatchId?: string | null;
  note?: string;
  publishedVersionId?: string | null;
};

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

export function contentSemanticFingerprint(input: Pick<ContentVersionInput, 'kind' | 'payload'>) {
  const semanticPayload =
    input.kind === 'word'
      ? (() => {
          const payload = input.payload as WordPayload;
          return {
            kind: input.kind,
            headword: payload.headword,
            meanings: payload.meanings,
            aliases: payload.aliases,
          };
        })()
      : (() => {
          const payload = input.payload as PoemPayload;
          return { kind: input.kind, lines: payload.lines };
        })();
  return sha256(stableSerialize(semanticPayload));
}

export function inspectContentQuality(
  item: Pick<ContentImportItem, 'key' | 'kind' | 'payload'>
): ContentImportIssue[] {
  const issue = (code: string, field: string, message: string): ContentImportIssue => ({
    code,
    severity: 'blocker',
    key: item.key,
    field,
    message,
  });
  if (item.kind === 'word') {
    const payload = item.payload as WordPayload;
    return [
      ...(!payload.phonetic
        ? [issue('word.phonetic.missing', 'payload.phonetic', '缺少音标。')]
        : []),
      ...(!payload.example || !payload.exampleTranslation
        ? [issue('word.example.incomplete', 'payload.example', '例句或例句翻译不完整。')]
        : []),
    ];
  }
  const payload = item.payload as PoemPayload;
  return [
    ...(!payload.translation
      ? [issue('poem.translation.missing', 'payload.translation', '缺少内容释义。')]
      : []),
    ...(payload.keyPoints.length === 0
      ? [issue('poem.key_points.missing', 'payload.keyPoints', '缺少考查要点。')]
      : []),
  ];
}

function presentTitle(version: Pick<StoredVersion, 'kind' | 'payload'>) {
  return version.kind === 'word'
    ? (version.payload as WordPayload).headword
    : `《${(version.payload as PoemPayload).title}》`;
}

async function activePublishedVersion(transaction: Transaction, versionId: string | null) {
  if (!versionId) return undefined;
  const [version] = await transaction
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);
  return version;
}

async function writeVersion(
  transaction: Transaction,
  identity: StoredContent,
  input: ContentVersionInput,
  options: WriteVersionOptions
) {
  const [currentVersion] = identity.currentVersionId
    ? await transaction
        .select()
        .from(contentVersions)
        .where(eq(contentVersions.id, identity.currentVersionId))
        .limit(1)
    : [];
  const previousPublished = await activePublishedVersion(transaction, identity.publishedVersionId);
  const semanticFingerprint = contentSemanticFingerprint(input);
  const semanticChange = Boolean(
    previousPublished && previousPublished.semanticFingerprint !== semanticFingerprint
  );
  const now = new Date();
  const [version] = await transaction
    .insert(contentVersions)
    .values({
      contentId: identity.id,
      versionNumber: (currentVersion?.versionNumber ?? 0) + 1,
      kind: input.kind,
      grade: input.grade,
      textbook: input.textbook,
      unit: input.unit,
      tags: input.tags,
      payload: input.payload,
      status: input.status,
      source: input.source,
      sourceVersion: input.sourceVersion,
      semanticFingerprint,
      semanticChange,
      changeKind: options.changeKind,
      changeNote: options.note ?? '',
      createdBy: options.actorId,
      importBatchId: options.importBatchId ?? null,
      createdAt: now,
    })
    .returning();

  const publishedVersionId =
    options.publishedVersionId !== undefined
      ? options.publishedVersionId
      : input.status === 'published'
        ? version.id
        : input.status === 'archived'
          ? null
          : identity.publishedVersionId;
  const [updated] = await transaction
    .update(contentItems)
    .set({
      grade: input.grade,
      textbook: input.textbook,
      unit: input.unit,
      tags: input.tags,
      payload: input.payload,
      status: input.status,
      source: input.source,
      sourceVersion: input.sourceVersion,
      importBatchId: options.importBatchId ?? null,
      importedBy: options.importBatchId ? options.actorId : identity.importedBy,
      importedAt: options.importBatchId ? now : identity.importedAt,
      currentVersionId: version.id,
      publishedVersionId,
      updatedAt: now,
    })
    .where(eq(contentItems.id, identity.id))
    .returning();

  let resetCards = 0;
  if (input.status === 'published' && semanticChange) {
    const reset = await transaction
      .update(learningCards)
      .set({
        due: now,
        stability: 0,
        difficulty: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        learningSteps: 0,
        state: 0,
        lastReview: null,
        mastery: 0,
        delayedCorrect: 0,
        delayedAttempts: 0,
        updatedAt: now,
      })
      .where(eq(learningCards.contentId, identity.id))
      .returning({ id: learningCards.id });
    resetCards = reset.length;
  }
  return { identity: updated, version, resetCards };
}

export async function writeImportedContent(
  transaction: Transaction,
  actorId: string,
  importBatchId: string,
  item: ContentImportItem,
  source: string,
  sourceVersion: string,
  status: 'draft' | 'published',
  expected: { currentVersionId: string | null; updatedAt: string | null }
) {
  let [identity] = await transaction
    .select()
    .from(contentItems)
    .where(eq(contentItems.key, item.key))
    .limit(1)
    .for('update');
  if (
    (identity &&
      (identity.currentVersionId !== expected.currentVersionId ||
        identity.updatedAt.toISOString() !== expected.updatedAt)) ||
    (!identity && (expected.currentVersionId !== null || expected.updatedAt !== null)) ||
    (identity && expected.currentVersionId === null && expected.updatedAt === null)
  ) {
    throw new Error('CONTENT_IMPORT_BASELINE_CONFLICT');
  }
  if (!identity) {
    [identity] = await transaction
      .insert(contentItems)
      .values({
        ...item,
        status,
        source,
        sourceVersion,
        importBatchId,
        importedBy: actorId,
      })
      .returning();
  }
  return writeVersion(
    transaction,
    identity,
    { ...item, source, sourceVersion, status },
    { actorId, changeKind: 'imported', importBatchId }
  );
}

export async function restoreImportedVersion(
  transaction: Transaction,
  actorId: string,
  importedVersion: StoredVersion,
  note: string
) {
  const [identity] = await transaction
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, importedVersion.contentId))
    .limit(1)
    .for('update');
  if (!identity || identity.currentVersionId !== importedVersion.id) {
    return { reverted: false } as const;
  }
  const [previousVersion] = await transaction
    .select()
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.contentId, importedVersion.contentId),
        lt(contentVersions.versionNumber, importedVersion.versionNumber)
      )
    )
    .orderBy(desc(contentVersions.versionNumber))
    .limit(1);
  const [previousPublished] = await transaction
    .select()
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.contentId, importedVersion.contentId),
        eq(contentVersions.status, 'published'),
        lt(contentVersions.versionNumber, importedVersion.versionNumber)
      )
    )
    .orderBy(desc(contentVersions.versionNumber))
    .limit(1);
  const restoredFrom = previousVersion ?? importedVersion;
  const restoredStatus: ContentStatus = previousVersion?.status ?? 'archived';
  const publishedVersionId =
    restoredStatus === 'published'
      ? undefined
      : restoredStatus === 'archived'
        ? null
        : (previousPublished?.id ?? null);
  const result = await writeVersion(
    transaction,
    identity,
    {
      kind: restoredFrom.kind,
      grade: restoredFrom.grade,
      textbook: restoredFrom.textbook,
      unit: restoredFrom.unit,
      tags: restoredFrom.tags,
      payload: restoredFrom.payload,
      source: restoredFrom.source,
      sourceVersion: restoredFrom.sourceVersion,
      status: restoredStatus,
    },
    {
      actorId,
      changeKind: 'restored',
      note: note || `回滚导入版本 v${importedVersion.versionNumber}`,
      publishedVersionId,
    }
  );
  return { reverted: true, ...result } as const;
}

export async function updateAdminContent(
  actorId: string,
  contentId: string,
  input: ContentVersionInput & { expectedUpdatedAt: string; note: string }
) {
  return db.transaction(async (transaction) => {
    const [identity] = await transaction
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1)
      .for('update');
    if (!identity) return { outcome: 'not_found' as const };
    if (identity.kind !== input.kind) return { outcome: 'kind_mismatch' as const };
    if (identity.updatedAt.toISOString() !== input.expectedUpdatedAt) {
      return { outcome: 'conflict' as const };
    }
    const issues = inspectContentQuality({
      key: identity.key,
      kind: input.kind,
      payload: input.payload,
    });
    if (input.status === 'published' && issues.some((issue) => issue.severity === 'blocker')) {
      return { outcome: 'quality_blocked' as const, issues };
    }
    const changeKind: ContentChangeKind =
      identity.status !== input.status
        ? input.status === 'published'
          ? 'published'
          : input.status === 'archived'
            ? 'archived'
            : 'edited'
        : 'edited';
    const result = await writeVersion(transaction, identity, input, {
      actorId,
      changeKind,
      note: input.note,
    });
    return { outcome: 'updated' as const, ...result };
  });
}

export async function changeAdminContentStatus(
  actorId: string,
  contentId: string,
  input: { status: ContentStatus; expectedUpdatedAt: string; note: string }
) {
  const [identity] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (!identity) return { outcome: 'not_found' as const };
  return updateAdminContent(actorId, contentId, {
    kind: identity.kind,
    grade: identity.grade,
    textbook: identity.textbook,
    unit: identity.unit,
    tags: identity.tags,
    payload: identity.payload,
    source: identity.source,
    sourceVersion: identity.sourceVersion,
    status: input.status,
    expectedUpdatedAt: input.expectedUpdatedAt,
    note: input.note,
  } as ContentVersionInput & { expectedUpdatedAt: string; note: string });
}

export async function upsertSeedContent(item: ContentImportItem) {
  return db.transaction(async (transaction) => {
    let [identity] = await transaction
      .select()
      .from(contentItems)
      .where(eq(contentItems.key, item.key))
      .limit(1)
      .for('update');
    const source = 'Academy 内置示例';
    const sourceVersion = '1';
    if (!identity) {
      [identity] = await transaction
        .insert(contentItems)
        .values({ ...item, status: 'published', source, sourceVersion })
        .returning();
    }
    const input: ContentVersionInput = {
      ...item,
      source,
      sourceVersion,
      status: 'published',
    };
    const currentFingerprint = identity.currentVersionId
      ? await transaction
          .select({ fingerprint: contentVersions.semanticFingerprint })
          .from(contentVersions)
          .where(eq(contentVersions.id, identity.currentVersionId))
          .limit(1)
      : [];
    const unchanged =
      identity.grade === item.grade &&
      identity.textbook === item.textbook &&
      identity.unit === item.unit &&
      identity.status === 'published' &&
      identity.source === source &&
      identity.sourceVersion === sourceVersion &&
      stableSerialize(identity.tags) === stableSerialize(item.tags) &&
      stableSerialize(identity.payload) === stableSerialize(item.payload) &&
      currentFingerprint[0]?.fingerprint === contentSemanticFingerprint(input);
    if (unchanged) return { identity, version: null, resetCards: 0 };
    return writeVersion(transaction, identity, input, {
      actorId: null,
      changeKind: 'seeded',
    });
  });
}

export async function normalizeLegacyContentVersionFingerprints() {
  const legacyVersions = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.semanticFingerprint, ''));
  for (const version of legacyVersions) {
    await db
      .update(contentVersions)
      .set({
        semanticFingerprint: contentSemanticFingerprint({
          kind: version.kind,
          payload: version.payload,
        } as Pick<ContentVersionInput, 'kind' | 'payload'>),
      })
      .where(and(eq(contentVersions.id, version.id), eq(contentVersions.semanticFingerprint, '')));
  }
  return legacyVersions.length;
}

export async function getAdminContentDetail(contentId: string): Promise<AdminContentDetail | null> {
  const [identity] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentId))
    .limit(1);
  if (!identity?.currentVersionId) return null;
  const [current, revisionRows] = await Promise.all([
    db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, identity.currentVersionId))
      .limit(1),
    db
      .select({
        version: contentVersions,
        displayName: profiles.displayName,
        username: users.username,
      })
      .from(contentVersions)
      .leftJoin(users, eq(users.id, contentVersions.createdBy))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(contentVersions.contentId, contentId))
      .orderBy(desc(contentVersions.versionNumber))
      .limit(30),
  ]);
  const version = current[0];
  if (!version) return null;
  const issues = inspectContentQuality({
    key: identity.key,
    kind: version.kind,
    payload: version.payload,
  });
  const revisions: ContentRevision[] = revisionRows.map((row) => ({
    id: row.version.id,
    versionNumber: row.version.versionNumber,
    status: row.version.status,
    changeKind: row.version.changeKind,
    note: row.version.changeNote,
    actorName: row.displayName ?? (row.username ? `@${row.username}` : '系统'),
    semanticChange: row.version.semanticChange,
    createdAt: row.version.createdAt.toISOString(),
  }));
  return {
    id: identity.id,
    key: identity.key,
    kind: version.kind,
    grade: version.grade,
    textbook: version.textbook,
    unit: version.unit,
    title: presentTitle(version),
    status: version.status,
    source: version.source,
    sourceVersion: version.sourceVersion,
    issueCount: issues.length,
    versionNumber: version.versionNumber,
    hasPublishedVersion: Boolean(identity.publishedVersionId),
    updatedAt: identity.updatedAt.toISOString(),
    tags: version.tags,
    payload: version.payload,
    issues,
    revisions,
    publishedVersionId: identity.publishedVersionId,
  };
}
