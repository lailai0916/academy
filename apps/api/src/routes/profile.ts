import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { profileUpdateSchema } from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { learningCards, profiles, users } from '../db/schema.js';
import { parseBody } from '../lib/http.js';
import { currentMastery } from '../services/memory-model.js';

async function buildProfile(userId: string) {
  const [profile] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      displayName: profiles.displayName,
      bio: profiles.bio,
      grade: profiles.grade,
      targetScore: profiles.targetScore,
      dailyGoal: profiles.dailyGoal,
      isPublic: profiles.isPublic,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) {
    return null;
  }
  const memoryRows = await db
    .select({ card: learningCards })
    .from(learningCards)
    .where(eq(learningCards.userId, userId));
  const now = new Date();
  const cards = memoryRows.map((row) => row.card).filter((card) => card.reps > 0);
  const mastery =
    cards.length === 0
      ? 0
      : cards.reduce((sum, card) => sum + currentMastery(card, now), 0) / cards.length;
  const delayedCorrect = cards.reduce((sum, card) => sum + card.delayedCorrect, 0);
  const attempts = cards.reduce((sum, card) => sum + card.delayedAttempts, 0);
  return {
    ...profile,
    createdAt: profile.createdAt.toISOString(),
    mastery: Math.round(mastery * 100),
    delayedAccuracy: attempts === 0 ? 0 : Math.round((delayedCorrect / attempts) * 100),
    reviewCount: cards.reduce((sum, card) => sum + card.reps, 0),
  };
}

export async function profileRoutes(app: FastifyInstance) {
  app.get('/profile/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const profile = await buildProfile(request.user!.id);
    return profile ? { profile } : reply.status(404).send({ error: '个人资料不存在。' });
  });

  app.patch('/profile/me', { preHandler: app.requireAuth }, async (request, reply) => {
    const body = parseBody(profileUpdateSchema, request.body, reply);
    if (!body) {
      return;
    }
    await db
      .update(profiles)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(profiles.userId, request.user!.id));
    return { profile: await buildProfile(request.user!.id) };
  });

  app.get<{ Params: { username: string } }>(
    '/profile/:username',
    { preHandler: app.requireAuth },
    async (request, reply) => {
      const [target] = await db
        .select({ id: users.id, isPublic: profiles.isPublic })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(
          and(eq(users.username, request.params.username.toLowerCase()), eq(users.status, 'active'))
        )
        .limit(1);
      if (!target || (!target.isPublic && target.id !== request.user!.id)) {
        return reply.status(404).send({ error: '无法查看该个人主页。' });
      }
      return { profile: await buildProfile(target.id) };
    }
  );
}
