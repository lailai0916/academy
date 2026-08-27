import argon2 from 'argon2';
import { and, desc, eq, gt, lt, ne, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  loginSchema,
  passwordUpdateSchema,
  registerSchema,
  type AuthSession,
} from '@lailai/academy-shared';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { authSessions, invites, profiles, users } from '../db/schema.js';
import { createSessionToken, sha256 } from '../lib/crypto.js';
import { parseBody } from '../lib/http.js';
import { describeUserAgent, maskIpAddress } from '../services/auth-sessions.js';

const dummyHash = argon2.hash('academy-invalid-password', {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});
const sessionParamsSchema = z.object({ sessionId: z.uuid() });

function sessionExpiry() {
  return new Date(Date.now() + config.SESSION_TTL_DAYS * 86_400_000);
}

async function issueSession(request: FastifyRequest, userId: string) {
  const token = createSessionToken();
  const expiresAt = sessionExpiry();
  await db.insert(authSessions).values({
    tokenHash: sha256(token),
    userId,
    userAgent: request.headers['user-agent']?.slice(0, 300) ?? '',
    ipAddress: request.ip.slice(0, 64),
    expiresAt,
  });
  return {
    token,
    options: {
      path: '/',
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      expires: expiresAt,
      signed: false,
    },
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', async (request) => ({ user: request.user }));

  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = parseBody(registerSchema, request.body, reply);
      if (!body) {
        return;
      }
      const username = body.username.toLowerCase();
      const inviteHash = sha256(body.inviteCode.toUpperCase().replaceAll(' ', ''));
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username));
      if (existing) {
        return reply.status(409).send({ error: '该用户名已被使用。' });
      }

      const passwordHash = await argon2.hash(body.password, {
        type: argon2.argon2id,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 1,
      });

      const user = await db.transaction(async (transaction) => {
        const [invite] = await transaction
          .select()
          .from(invites)
          .where(
            and(
              eq(invites.codeHash, inviteHash),
              gt(invites.expiresAt, new Date()),
              lt(invites.uses, invites.maxUses),
              sql`${invites.revokedAt} is null`
            )
          )
          .for('update')
          .limit(1);
        if (!invite) {
          return null;
        }

        const [created] = await transaction
          .insert(users)
          .values({ username, passwordHash })
          .returning({ id: users.id, role: users.role });
        await transaction.insert(profiles).values({
          userId: created.id,
          displayName: body.username,
        });
        await transaction
          .update(invites)
          .set({ uses: sql`${invites.uses} + 1` })
          .where(eq(invites.id, invite.id));
        return {
          ...created,
          username,
          displayName: body.username,
          grade: '高一' as const,
          onboardingComplete: false,
        };
      });

      if (!user) {
        return reply.status(400).send({ error: '邀请码无效、已过期或已用完。' });
      }
      const session = await issueSession(request, user.id);
      reply.setCookie(config.SESSION_COOKIE_NAME, session.token, session.options);
      return reply.status(201).send({ user });
    }
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = parseBody(loginSchema, request.body, reply);
      if (!body) {
        return;
      }
      const [user] = await db
        .select({
          id: users.id,
          username: users.username,
          passwordHash: users.passwordHash,
          role: users.role,
          status: users.status,
          displayName: profiles.displayName,
          grade: profiles.grade,
          onboardingCompletedAt: profiles.onboardingCompletedAt,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.username, body.username.toLowerCase()))
        .limit(1);
      const passwordMatches = await argon2.verify(
        user?.passwordHash ?? (await dummyHash),
        body.password
      );
      if (!user || !passwordMatches || user.status !== 'active') {
        return reply.status(401).send({ error: '用户名或密码不正确。' });
      }

      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));
      const session = await issueSession(request, user.id);
      reply.setCookie(config.SESSION_COOKIE_NAME, session.token, session.options);
      const { passwordHash: _, status: __, onboardingCompletedAt, ...identity } = user;
      const sessionUser = { ...identity, onboardingComplete: Boolean(onboardingCompletedAt) };
      return { user: sessionUser };
    }
  );

  app.post('/auth/logout', { preHandler: app.requireAuth }, async (request, reply) => {
    const token = request.cookies[config.SESSION_COOKIE_NAME];
    if (token) {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, sha256(token)));
    }
    reply.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
    return reply.status(204).send();
  });

  app.get('/auth/sessions', { preHandler: app.requireAuth }, async (request) => {
    const now = new Date();
    await db
      .delete(authSessions)
      .where(and(eq(authSessions.userId, request.user!.id), lt(authSessions.expiresAt, now)));
    const rows = await db
      .select({
        id: authSessions.id,
        userAgent: authSessions.userAgent,
        ipAddress: authSessions.ipAddress,
        createdAt: authSessions.createdAt,
        lastSeenAt: authSessions.lastSeenAt,
        expiresAt: authSessions.expiresAt,
      })
      .from(authSessions)
      .where(eq(authSessions.userId, request.user!.id))
      .orderBy(desc(authSessions.lastSeenAt));
    const sessions: AuthSession[] = rows.map((session) => ({
      id: session.id,
      current: session.id === request.authSessionId,
      ...describeUserAgent(session.userAgent),
      network: maskIpAddress(session.ipAddress),
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }));
    return { sessions };
  });

  app.post(
    '/auth/password',
    {
      preHandler: app.requireAuth,
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const body = parseBody(passwordUpdateSchema, request.body, reply);
      if (!body) return;
      if (!request.authSessionId) {
        return reply.status(401).send({ error: '登录状态已失效，请重新登录。' });
      }
      const currentSessionId = request.authSessionId;
      const [user] = await db
        .select({ passwordHash: users.passwordHash })
        .from(users)
        .where(eq(users.id, request.user!.id))
        .limit(1);
      if (!user || !(await argon2.verify(user.passwordHash, body.currentPassword))) {
        return reply.status(401).send({ error: '当前密码不正确。' });
      }
      const passwordHash = await argon2.hash(body.newPassword, {
        type: argon2.argon2id,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 1,
      });
      const revoked = await db.transaction(async (transaction) => {
        await transaction
          .update(users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(users.id, request.user!.id));
        return transaction
          .delete(authSessions)
          .where(
            and(eq(authSessions.userId, request.user!.id), ne(authSessions.id, currentSessionId))
          )
          .returning({ id: authSessions.id });
      });
      return { otherSessionsRevoked: revoked.length };
    }
  );

  app.delete<{ Params: { sessionId: string } }>(
    '/auth/sessions/:sessionId',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const params = parseBody(sessionParamsSchema, request.params, reply);
      if (!params) return;
      const [revoked] = await db
        .delete(authSessions)
        .where(
          and(eq(authSessions.id, params.sessionId), eq(authSessions.userId, request.user!.id))
        )
        .returning({ id: authSessions.id });
      if (!revoked) return reply.status(404).send({ error: '登录设备不存在。' });
      if (revoked.id === request.authSessionId) {
        reply.clearCookie(config.SESSION_COOKIE_NAME, { path: '/' });
      }
      return reply.status(204).send();
    }
  );

  app.post('/auth/sessions/revoke-others', { preHandler: app.requireAuth }, async (request) => {
    if (!request.authSessionId) return { revoked: 0 };
    const revoked = await db
      .delete(authSessions)
      .where(
        and(eq(authSessions.userId, request.user!.id), ne(authSessions.id, request.authSessionId))
      )
      .returning({ id: authSessions.id });
    return { revoked: revoked.length };
  });
}
