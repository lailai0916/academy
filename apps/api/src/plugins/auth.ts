import { and, eq, gt, lt } from 'drizzle-orm';
import fp from 'fastify-plugin';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { authSessions, profiles, users } from '../db/schema.js';
import { sha256 } from '../lib/crypto.js';

export default fp(async (app) => {
  app.decorateRequest('user', null);
  app.decorateRequest('authSessionId', null);

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[config.SESSION_COOKIE_NAME];
    if (!token) {
      return;
    }
    const [row] = await db
      .select({
        sessionId: authSessions.id,
        lastSeenAt: authSessions.lastSeenAt,
        id: users.id,
        username: users.username,
        role: users.role,
        status: users.status,
        displayName: profiles.displayName,
        grade: profiles.grade,
      })
      .from(authSessions)
      .innerJoin(users, eq(users.id, authSessions.userId))
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .where(
        and(
          eq(authSessions.tokenHash, sha256(token)),
          gt(authSessions.expiresAt, new Date()),
          eq(users.status, 'active')
        )
      )
      .limit(1);

    if (!row) {
      return;
    }
    request.user = {
      id: row.id,
      username: row.username,
      role: row.role,
      displayName: row.displayName,
      grade: row.grade,
    };
    request.authSessionId = row.sessionId;

    const refreshBefore = new Date(Date.now() - 5 * 60_000);
    if (row.lastSeenAt < refreshBefore) {
      await db
        .update(authSessions)
        .set({ lastSeenAt: new Date() })
        .where(and(eq(authSessions.id, row.sessionId), lt(authSessions.lastSeenAt, refreshBefore)));
    }
  });

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      await reply.status(401).send({ error: '请先登录。' });
    }
  };

  app.decorate('requireAuth', requireAuth);
  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply);
    if (reply.sent) {
      return;
    }
    if (request.user?.role !== 'admin') {
      await reply.status(403).send({ error: '此操作需要管理员权限。' });
    }
  });
});
