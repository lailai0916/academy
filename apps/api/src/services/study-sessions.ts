import { and, desc, eq } from 'drizzle-orm';
import type { ActiveLearningSession } from '@lailai/academy-shared';
import { db } from '../db/index.js';
import { studySessions } from '../db/schema.js';

type StoredSession = typeof studySessions.$inferSelect;

export function presentActiveLearningSession(session: StoredSession): ActiveLearningSession {
  return {
    id: session.id,
    kind: session.kind,
    mode: session.mode,
    plannedCount: session.plannedCount,
    completedCount: session.completedCount,
    startedAt: session.startedAt.toISOString(),
  };
}

export async function getActiveLearningSession(userId: string) {
  const [session] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.userId, userId), eq(studySessions.status, 'active')))
    .orderBy(desc(studySessions.startedAt))
    .limit(1);
  return session ? presentActiveLearningSession(session) : null;
}

export async function abandonLearningSession(userId: string, sessionId: string) {
  const [session] = await db
    .update(studySessions)
    .set({ status: 'abandoned', completedAt: new Date() })
    .where(
      and(
        eq(studySessions.id, sessionId),
        eq(studySessions.userId, userId),
        eq(studySessions.status, 'active')
      )
    )
    .returning({ id: studySessions.id });
  return Boolean(session);
}
