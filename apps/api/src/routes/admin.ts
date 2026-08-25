import { count, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  aiSettingsUpdateSchema,
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
import { aiSettings, contentItems, invites, profiles, users } from '../db/schema.js';
import { createInviteCode, decryptSecret, encryptSecret, sha256 } from '../lib/crypto.js';
import { parseBody } from '../lib/http.js';
import { testAiConnection } from '../services/ai.js';

function presentAiSettings(settings: typeof aiSettings.$inferSelect | undefined): AiSettings {
  return {
    provider: settings?.provider ?? 'OpenAI Compatible',
    baseUrl: settings?.baseUrl ?? 'https://api.openai.com/v1',
    model: settings?.model ?? 'gpt-5-mini',
    hasApiKey: Boolean(settings?.encryptedApiKey),
    updatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/summary', { preHandler: app.requireAdmin }, async () => {
    const [[userCount], [contentCount], [inviteCount]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(contentItems),
      db.select({ value: count() }).from(invites),
    ]);
    return {
      summary: {
        users: Number(userCount?.value ?? 0),
        content: Number(contentCount?.value ?? 0),
        invites: Number(inviteCount?.value ?? 0),
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

  app.post('/admin/content/import', { preHandler: app.requireAdmin }, async (request, reply) => {
    const body = parseBody(contentImportSchema, request.body, reply);
    if (!body) {
      return;
    }
    await db.transaction(async (transaction) => {
      for (const item of body.items) {
        await transaction
          .insert(contentItems)
          .values({ ...item, status: 'published' })
          .onConflictDoUpdate({
            target: contentItems.key,
            set: {
              grade: item.grade,
              kind: item.kind,
              payload: item.payload,
              status: 'published',
              tags: item.tags,
              textbook: item.textbook,
              unit: item.unit,
              updatedAt: new Date(),
            },
          });
      }
    });
    return reply.status(201).send({ imported: body.items.length });
  });

  app.get('/admin/content', { preHandler: app.requireAdmin }, async () => {
    const rows = await db
      .select()
      .from(contentItems)
      .orderBy(desc(contentItems.updatedAt))
      .limit(300);
    const content: AdminContentItem[] = rows.map((item) => ({
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
      updatedAt: item.updatedAt.toISOString(),
    }));
    return { content };
  });

  app.patch<{ Params: { contentId: string } }>(
    '/admin/content/:contentId/status',
    { preHandler: app.requireAdmin },
    async (request, reply) => {
      const body = parseBody(contentStatusUpdateSchema, request.body, reply);
      if (!body) return;
      const [item] = await db
        .update(contentItems)
        .set({ status: body.status, updatedAt: new Date() })
        .where(eq(contentItems.id, request.params.contentId))
        .returning({ id: contentItems.id });
      if (!item) {
        return reply.status(404).send({ error: '教材内容不存在。' });
      }
      return { id: item.id, status: body.status };
    }
  );
}
