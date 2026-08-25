import { and, count, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type {
  NotificationItem,
  PoemPayload,
  WordPayload,
  WorkspaceSearchResult,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { contentItems, notifications, profiles, users } from '../db/schema.js';

export async function workspaceRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>(
    '/search',
    { preHandler: app.requireAuth },
    async (request) => {
      const query = request.query.q?.trim().slice(0, 80) ?? '';
      if (!query) return { results: [] };
      const pattern = `%${query}%`;
      const [contentRows, userRows] = await Promise.all([
        db
          .select()
          .from(contentItems)
          .where(
            and(
              eq(contentItems.status, 'published'),
              eq(contentItems.grade, request.user!.grade),
              or(
                ilike(contentItems.key, pattern),
                ilike(contentItems.textbook, pattern),
                ilike(contentItems.unit, pattern),
                sql`${contentItems.payload}::text ilike ${pattern}`
              )
            )
          )
          .orderBy(contentItems.unit, contentItems.key)
          .limit(8),
        db
          .select({
            id: users.id,
            username: users.username,
            displayName: profiles.displayName,
            grade: profiles.grade,
          })
          .from(users)
          .innerJoin(profiles, eq(profiles.userId, users.id))
          .where(
            and(
              eq(users.status, 'active'),
              eq(profiles.isPublic, true),
              or(ilike(users.username, pattern), ilike(profiles.displayName, pattern))
            )
          )
          .orderBy(users.username)
          .limit(6),
      ]);
      const results: WorkspaceSearchResult[] = [
        ...contentRows.map((item) => {
          const title =
            item.kind === 'word'
              ? (item.payload as WordPayload).headword
              : `《${(item.payload as PoemPayload).title}》`;
          return {
            id: item.id,
            type: 'content' as const,
            title,
            detail: `${item.unit} · ${item.kind === 'word' ? '英语单词' : '古诗词'}`,
            href: item.kind === 'word' ? '/learn/words' : '/learn/poems',
          };
        }),
        ...userRows.map((user) => ({
          id: user.id,
          type: 'user' as const,
          title: user.displayName,
          detail: `@${user.username} · ${user.grade}`,
          href: `/profile/${user.username}`,
        })),
      ];
      return { results };
    }
  );

  app.get('/notifications', { preHandler: app.requireAuth }, async (request) => {
    const [rows, unread] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, request.user!.id))
        .orderBy(desc(notifications.createdAt))
        .limit(30),
      db
        .select({ value: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, request.user!.id), isNull(notifications.readAt))),
    ]);
    const items: NotificationItem[] = rows.map((item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      body: item.body,
      link: item.link,
      read: Boolean(item.readAt),
      createdAt: item.createdAt.toISOString(),
    }));
    return { notifications: items, unreadCount: Number(unread[0]?.value ?? 0) };
  });

  app.post('/notifications/read', { preHandler: app.requireAuth }, async (request, reply) => {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, request.user!.id), isNull(notifications.readAt)));
    return reply.status(204).send();
  });
}
