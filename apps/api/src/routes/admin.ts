import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  adminContentQuerySchema,
  adminContentUpdateSchema,
  aiSettingsUpdateSchema,
  contentImportApplySchema,
  contentImportRollbackSchema,
  contentImportSchema,
  contentStatusUpdateSchema,
  inviteCreateSchema,
  type AdminContentItem,
  type AiSettings,
  type Invite,
  type PoemPayload,
  type WordPayload,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  aiSettings,
  contentImports,
  contentItems,
  contentVersions,
  invites,
  profiles,
  users,
} from '../db/schema.js';
import { createInviteCode, decryptSecret, encryptSecret, sha256 } from '../lib/crypto.js';
import { parseBody } from '../lib/http.js';
import { testAiConnection } from '../services/ai.js';
import {
  changeAdminContentStatus,
  getAdminContentDetail,
  inspectContentQuality,
  updateAdminContent,
} from '../services/content-lifecycle.js';
import {
  applyContentImport,
  listContentImportBatches,
  previewContentImport,
  rollbackContentImport,
} from '../services/content-imports.js';

function presentAiSettings(settings: typeof aiSettings.$inferSelect | undefined): AiSettings {
  return {
    provider: settings?.provider ?? 'OpenAI Compatible',
    baseUrl: settings?.baseUrl ?? 'https://api.openai.com/v1',
    model: settings?.model ?? 'gpt-5.6-sol',
    hasApiKey: Boolean(settings?.encryptedApiKey),
    updatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/summary', { preHandler: app.requireAdmin }, async () => {
    const [[userCount], [contentSummary], [inviteCount], [importCount]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db
        .select({
          value: count(),
          published: sql<number>`count(*) filter (where ${contentItems.publishedVersionId} is not null)`,
          draft: sql<number>`count(*) filter (where ${contentItems.status} = 'draft')`,
          archived: sql<number>`count(*) filter (where ${contentItems.status} = 'archived')`,
        })
        .from(contentItems),
      db.select({ value: count() }).from(invites),
      db.select({ value: count() }).from(contentImports),
    ]);
    return {
      summary: {
        users: Number(userCount?.value ?? 0),
        content: Number(contentSummary?.value ?? 0),
        invites: Number(inviteCount?.value ?? 0),
        imports: Number(importCount?.value ?? 0),
        published: Number(contentSummary?.published ?? 0),
        draft: Number(contentSummary?.draft ?? 0),
        archived: Number(contentSummary?.archived ?? 0),
      },
    };
  });

  app.get('/admin/users', { preHandler: app.requireAdmin }, async () => ({
    users: await db
      .select({
        id: users.id,
        username: users.username,
        displayName: profiles.displayName,
        role: users.role,
        status: users.status,
        grade: profiles.grade,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(200),
  }));

  app.get('/admin/invites', { preHandler: app.requireAdmin }, async () => {
    const rows = await db.select().from(invites).orderBy(desc(invites.createdAt)).limit(200);
    const result: Invite[] = rows.map((invite) => ({
      id: invite.id,
      label: invite.label,
      uses: invite.uses,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt.toISOString(),
      revoked: Boolean(invite.revokedAt),
    }));
    return { invites: result };
  });

  app.post('/admin/invites', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = parseBody(inviteCreateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const code = createInviteCode();
    const [invite] = await db
      .insert(invites)
      .values({
        codeHash: sha256(code),
        label: body.label,
        maxUses: body.maxUses,
        expiresAt: new Date(Date.now() + body.expiresInDays * 86_400_000),
        createdBy: request.user!.id,
      })
      .returning();
    return reply.status(201).send({
      invite: {
        id: invite.id,
        label: invite.label,
        code,
        uses: invite.uses,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt.toISOString(),
        revoked: false,
      } satisfies Invite,
    });
  });

  app.delete<{ Params: { inviteId: string } }>(
    '/admin/invites/:inviteId',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      await db
        .update(invites)
        .set({ revokedAt: new Date() })
        .where(eq(invites.id, request.params.inviteId));
      return reply.status(204).send();
    }
  );

  app.get('/admin/ai', { preHandler: app.requireAdmin }, async () => {
    const [settings] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1)).limit(1);
    return { settings: presentAiSettings(settings) };
  });

  app.put('/admin/ai', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = parseBody(aiSettingsUpdateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const [current] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1)).limit(1);
    const encryptedApiKey = body.apiKey
      ? encryptSecret(body.apiKey)
      : (current?.encryptedApiKey ?? '');
    const [settings] = await db
      .insert(aiSettings)
      .values({
        id: 1,
        provider: body.provider,
        baseUrl: body.baseUrl,
        model: body.model,
        encryptedApiKey,
        updatedBy: request.user!.id,
      })
      .onConflictDoUpdate({
        target: aiSettings.id,
        set: {
          provider: body.provider,
          baseUrl: body.baseUrl,
          model: body.model,
          encryptedApiKey,
          updatedBy: request.user!.id,
          updatedAt: new Date(),
        },
      })
      .returning();
    return { settings: presentAiSettings(settings) };
  });

  app.post('/admin/ai/test', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = parseBody(aiSettingsUpdateSchema, request.body, reply);
    if (!body) {
      return;
    }
    const [current] = await db.select().from(aiSettings).where(eq(aiSettings.id, 1)).limit(1);
    const apiKey =
      body.apiKey || (current?.encryptedApiKey ? decryptSecret(current.encryptedApiKey) : '');
    if (!apiKey) {
      return reply.status(400).send({ error: '请先填写 API Key。' });
    }
    try {
      await testAiConnection({ baseUrl: body.baseUrl, model: body.model, apiKey });
      return { ok: true };
    } catch (error) {
      return reply.status(502).send({
        error: error instanceof Error ? error.message : 'AI 服务连接失败。',
      });
    }
  });

  app.post(
    '/admin/content/import/preview',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const body = parseBody(contentImportSchema, request.body, reply);
      if (!body) {
        return;
      }
      return { preview: await previewContentImport(body) };
    }
  );

  app.post('/admin/content/import', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = parseBody(contentImportApplySchema, request.body, reply);
    if (!body) {
      return;
    }
    const { fingerprint, ...input } = body;
    const preview = await previewContentImport(input);
    if (input.status === 'published' && preview.issues.length > 0) {
      return reply
        .status(422)
        .send({ error: '内容存在完整性问题，请修正后再发布。', issues: preview.issues });
    }
    const result = await applyContentImport(request.user!.id, input, fingerprint);
    if (!result) {
      return reply.status(409).send({ error: '导入内容在预检后发生变化，请重新检查。' });
    }
    return reply.status(201).send(result);
  });

  app.get('/admin/content/imports', { preHandler: app.requireAdmin }, async () => ({
    imports: await listContentImportBatches(),
  }));

  app.post<{ Params: { importId: string } }>(
    '/admin/content/imports/:importId/rollback',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const body = parseBody(contentImportRollbackSchema, request.body, reply);
      if (!body) return;
      const result = await rollbackContentImport(
        request.user!.id,
        request.params.importId,
        body.note
      );
      if (result.outcome === 'not_found') {
        return reply.status(404).send({ error: '导入批次不存在。' });
      }
      return { batch: result.batch };
    }
  );

  app.get<{ Params: { contentId: string } }>(
    '/admin/content/:contentId',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const content = await getAdminContentDetail(request.params.contentId);
      if (!content) {
        return reply.status(404).send({ error: '教材内容不存在。' });
      }
      return { content };
    }
  );

  app.put<{ Params: { contentId: string } }>(
    '/admin/content/:contentId',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const body = parseBody(adminContentUpdateSchema, request.body, reply);
      if (!body) return;
      const result = await updateAdminContent(request.user!.id, request.params.contentId, {
        ...body,
        sourceVersion: body.version,
      });
      if (result.outcome === 'not_found') {
        return reply.status(404).send({ error: '教材内容不存在。' });
      }
      if (result.outcome === 'conflict') {
        return reply.status(409).send({ error: '内容已被其他操作更新，请刷新后重新编辑。' });
      }
      if (result.outcome === 'kind_mismatch') {
        return reply.status(400).send({ error: '内容类型不能更改。' });
      }
      if (result.outcome === 'quality_blocked') {
        return reply
          .status(422)
          .send({ error: '内容存在完整性问题，请修正后再发布。', issues: result.issues });
      }
      return {
        content: await getAdminContentDetail(request.params.contentId),
        resetCards: result.resetCards,
      };
    }
  );

  app.get<{
    Querystring: {
      q?: string;
      kind?: string;
      grade?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>('/admin/content', { preHandler: app.requireAdmin }, async (request, reply) => {
    const query = adminContentQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: '内容筛选条件不受支持。' });
    }
    const pattern = query.data.q ? `%${query.data.q}%` : null;
    const where = and(
      query.data.kind ? eq(contentItems.kind, query.data.kind) : undefined,
      query.data.grade ? eq(contentItems.grade, query.data.grade) : undefined,
      query.data.status ? eq(contentItems.status, query.data.status) : undefined,
      pattern
        ? or(
            ilike(contentItems.key, pattern),
            ilike(contentItems.textbook, pattern),
            ilike(contentItems.unit, pattern),
            ilike(contentItems.source, pattern),
            sql`coalesce(${contentItems.payload}->>'headword', ${contentItems.payload}->>'title', '') ilike ${pattern}`
          )
        : undefined
    );
    const [[total], rows] = await Promise.all([
      db.select({ value: count() }).from(contentItems).where(where),
      db
        .select({ content: contentItems, versionNumber: contentVersions.versionNumber })
        .from(contentItems)
        .leftJoin(contentVersions, eq(contentVersions.id, contentItems.currentVersionId))
        .where(where)
        .orderBy(desc(contentItems.updatedAt))
        .limit(query.data.limit)
        .offset(query.data.offset),
    ]);
    const content: AdminContentItem[] = rows.map(({ content: item, versionNumber }) => ({
      id: item.id,
      key: item.key,
      kind: item.kind,
      grade: item.grade,
      textbook: item.textbook,
      unit: item.unit,
      title:
        item.kind === 'word'
          ? (item.payload as WordPayload).headword
          : `《${(item.payload as PoemPayload).title}》`,
      status: item.status,
      source: item.source,
      sourceVersion: item.sourceVersion,
      issueCount: inspectContentQuality({
        key: item.key,
        kind: item.kind,
        payload: item.payload,
      }).length,
      versionNumber: versionNumber ?? 0,
      hasPublishedVersion: Boolean(item.publishedVersionId),
      updatedAt: item.updatedAt.toISOString(),
    }));
    return { content, total: Number(total?.value ?? 0) };
  });

  app.patch<{ Params: { contentId: string } }>(
    '/admin/content/:contentId/status',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const body = parseBody(contentStatusUpdateSchema, request.body, reply);
      if (!body) return;
      const result = await changeAdminContentStatus(
        request.user!.id,
        request.params.contentId,
        body
      );
      if (result.outcome === 'not_found') {
        return reply.status(404).send({ error: '教材内容不存在。' });
      }
      if (result.outcome === 'conflict') {
        return reply.status(409).send({ error: '内容已被其他操作更新，请刷新后重试。' });
      }
      if (result.outcome === 'kind_mismatch') {
        return reply.status(409).send({ error: '内容类型已发生变化，请刷新后重试。' });
      }
      if (result.outcome === 'quality_blocked') {
        return reply
          .status(422)
          .send({ error: '内容存在完整性问题，请修正后再发布。', issues: result.issues });
      }
      return { id: result.identity.id, status: body.status, resetCards: result.resetCards };
    }
  );
}
