import { and, asc, avg, count, desc, eq, gte, lte, notExists, sql } from 'drizzle-orm';
import type { Dashboard, DailyPlan, SessionUser } from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  activities,
  contentItems,
  dailyPlans,
  learningCards,
  profiles,
  reviewEvents,
  users,
} from '../db/schema.js';

const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function currentStudyDate(date = new Date()) {
  return shanghaiDate.format(date);
}

function countStreak(dates: Date[]) {
  const activeDates = new Set(dates.map((date) => currentStudyDate(date)));
  let cursor = new Date();
  let streak = 0;
  while (activeDates.has(currentStudyDate(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }
  return streak;
}

export async function getOrCreateDailyPlan(user: SessionUser): Promise<DailyPlan> {
  const today = currentStudyDate();
  const [existing] = await db
    .select()
    .from(dailyPlans)
    .where(and(eq(dailyPlans.userId, user.id), eq(dailyPlans.planDate, today)))
    .limit(1);
  if (existing) {
    const total = existing.wordsDue + existing.wordsNew + existing.poemsDue + existing.poemsNew;
    return {
      date: existing.planDate,
      wordsDue: existing.wordsDue,
      wordsNew: existing.wordsNew,
      poemsDue: existing.poemsDue,
      poemsNew: existing.poemsNew,
      completed: existing.completed,
      total,
      reason: existing.reason,
    };
  }

  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id)).limit(1);
  const dueCounts = await db
    .select({ kind: contentItems.kind, value: count() })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .where(and(eq(learningCards.userId, user.id), lte(learningCards.due, new Date())))
    .groupBy(contentItems.kind)
    .orderBy(asc(contentItems.kind));
  const newCounts = await db
    .select({ kind: contentItems.kind, value: count() })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.status, 'published'),
        eq(contentItems.grade, profile.grade),
        notExists(
          db
            .select({ id: learningCards.id })
            .from(learningCards)
            .where(
              and(eq(learningCards.userId, user.id), eq(learningCards.contentId, contentItems.id))
            )
        )
      )
    )
    .groupBy(contentItems.kind)
    .orderBy(asc(contentItems.kind));

  const due = Object.fromEntries(dueCounts.map((row) => [row.kind, Number(row.value)]));
  const available = Object.fromEntries(newCounts.map((row) => [row.kind, Number(row.value)]));
  const goal = profile.dailyGoal;
  const wordsDue = Math.min(due.word ?? 0, Math.ceil(goal * 0.5));
  const poemsDue = Math.min(due.poem ?? 0, Math.ceil(goal * 0.25));
  const remaining = Math.max(0, goal - wordsDue - poemsDue);
  const wordsNew = Math.min(available.word ?? 0, Math.ceil(remaining * 0.72));
  const poemsNew = Math.min(available.poem ?? 0, Math.max(0, remaining - wordsNew));
  const reason =
    wordsDue + poemsDue > 0
      ? '优先处理到期复习，再补充少量新内容，降低短期遗忘。'
      : '当前没有到期内容，先建立新记忆，后续计划会按回答表现调整。';

  const [created] = await db
    .insert(dailyPlans)
    .values({
      userId: user.id,
      planDate: today,
      wordsDue,
      wordsNew,
      poemsDue,
      poemsNew,
      reason,
    })
    .returning();
  const total = wordsDue + wordsNew + poemsDue + poemsNew;
  return { date: today, wordsDue, wordsNew, poemsDue, poemsNew, completed: 0, total, reason };
}

export async function getDashboard(user: SessionUser): Promise<Dashboard> {
  const plan = await getOrCreateDailyPlan(user);
  const [metrics] = await db
    .select({
      mastery: avg(learningCards.mastery),
      delayedCorrect: sql<number>`coalesce(sum(${learningCards.delayedCorrect}), 0)`,
      delayedAttempts: sql<number>`coalesce(sum(${learningCards.delayedAttempts}), 0)`,
      longTermCards: sql<number>`count(*) filter (where ${learningCards.stability} >= 21)`,
    })
    .from(learningCards)
    .where(eq(learningCards.userId, user.id));
  const reviews = await db
    .select({ createdAt: reviewEvents.createdAt })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.userId, user.id),
        gte(reviewEvents.createdAt, new Date(Date.now() - 90 * 86_400_000))
      )
    )
    .orderBy(desc(reviewEvents.createdAt));
  const recentActivity = await db
    .select({
      id: activities.id,
      kind: activities.kind,
      summary: activities.summary,
      createdAt: activities.createdAt,
      username: users.username,
      displayName: profiles.displayName,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(activities.userId, user.id))
    .orderBy(desc(activities.createdAt))
    .limit(6);
  const delayedAttempts = Number(metrics?.delayedAttempts ?? 0);

  return {
    user,
    plan,
    metrics: {
      mastery: Math.round(Number(metrics?.mastery ?? 0) * 100),
      delayedAccuracy:
        delayedAttempts === 0
          ? 0
          : Math.round((Number(metrics?.delayedCorrect ?? 0) / delayedAttempts) * 100),
      longTermCards: Number(metrics?.longTermCards ?? 0),
      streakDays: countStreak(reviews.map((row) => row.createdAt)),
    },
    recentActivity: recentActivity.map((item) => ({
      id: item.id,
      kind: item.kind,
      summary: item.summary,
      createdAt: item.createdAt.toISOString(),
      user: { username: item.username, displayName: item.displayName },
    })),
  };
}
