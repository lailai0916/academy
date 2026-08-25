import argon2 from 'argon2';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { loginSchema, registerSchema } from '@lailai/academy-shared';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { authSessions, invites, profiles, users } from '../db/schema.js';
import { createSessionToken, sha256 } from '../lib/crypto.js';
import { parseBody } from '../lib/http.js';

const dummyHash = argon2.hash('academy-invalid-password', {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});

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
        return { ...created, username, displayName: body.username, grade: '高一' as const };
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
      const { passwordHash: _, status: __, ...sessionUser } = user;
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
}
