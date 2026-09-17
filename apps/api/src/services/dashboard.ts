import { and, asc, count, countDistinct, desc, eq, gte, lt, lte, notExists } from 'drizzle-orm';
import type {
  ActiveLearningSession,
  ContentKind,
  CourseListItem,
  DailyPlan,
  Dashboard,
  PlanTask,
  SessionUser,
} from '@lailai/academy-shared';
import { db } from '../db/index.js';
import {
  activities,
  contentItems,
  contentVersions,
  dailyPlans,
  learningCards,
  profiles,
  reviewEvents,
  studySessions,
  users,
} from '../db/schema.js';
import { getCourseList } from './courses.js';
import { getActiveLearningSession } from './study-sessions.js';
import { currentMastery } from './memory-model.js';

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

type PlanCapacity = { word: number; poem: number };
type MemoryDailyPlan = Omit<DailyPlan, 'tasks'>;
type MemoryPlanCompletion = Record<ContentKind, number>;

export function allocatePlanCapacity(
  capacity: number,
  available: PlanCapacity,
  preferredWordShare: number
): PlanCapacity {
  const boundedCapacity = Math.max(0, capacity);
  const preferredWords = Math.round(boundedCapacity * preferredWordShare);
  let word = Math.min(available.word, preferredWords);
  let poem = Math.min(available.poem, boundedCapacity - word);
  let remaining = boundedCapacity - word - poem;

  const extraWords = Math.min(Math.max(0, available.word - word), remaining);
  word += extraWords;
  remaining -= extraWords;
  poem += Math.min(Math.max(0, available.poem - poem), remaining);

  return { word, poem };
}

function isStudyDate(value: string | null, date: string) {
  return Boolean(value && currentStudyDate(new Date(value)) === date);
}

function taskPriority(task: PlanTask) {
  if (task.status === 'active') return 0;
  if (task.status === 'completed') return 5;
  if (task.kind === 'assessment') return 1;
  if (task.kind === 'memory-review' && task.due > 0) return 2;
  if (task.kind === 'course') return 3;
  return 4;
}

export function buildPlanTasks(
  plan: MemoryDailyPlan,
  courses: CourseListItem[],
  activeSession: ActiveLearningSession | null,
  completedByKind: MemoryPlanCompletion,
  grade: SessionUser['grade']
): PlanTask[] {
  const tasks: PlanTask[] = [];

  for (const course of courses) {
    if (course.grade !== grade) continue;
    const progress = course.progress;
    const lessonCompletedToday = isStudyDate(progress.lessonCompletedAt, plan.date);
    const retestCompletedToday = isStudyDate(progress.retestCompletedAt, plan.date);

    if (retestCompletedToday) {
      tasks.push({
        id: `${plan.date}:assessment:${course.slug}`,
        kind: 'assessment',
        subject: course.subject,
        courseSlug: course.slug,
        title: `${course.title}延迟复测`,
        reason: `已独立完成复测 ${progress.assessmentCorrect ?? 0} / ${progress.assessmentTotal ?? 0} 题。`,
        status: 'completed',
        dueAt: progress.retestDueAt,
        completedSteps: progress.totalSteps,
        totalSteps: progress.totalSteps,
      });
      continue;
    }

    if (progress.status === 'retest-due' || progress.status === 'retest-in-progress') {
      tasks.push({
        id: `${plan.date}:assessment:${course.slug}`,
        kind: 'assessment',
        subject: course.subject,
        courseSlug: course.slug,
        title: `${course.title}延迟复测`,
        reason:
          progress.status === 'retest-in-progress'
            ? `已完成 ${progress.completedSteps} / ${progress.totalSteps} 题，继续独立作答。`
            : '复测已经到期，使用另一组题检验长期掌握情况。',
        status: progress.status === 'retest-in-progress' ? 'active' : 'planned',
        dueAt: progress.retestDueAt,
        completedSteps: progress.status === 'retest-in-progress' ? progress.completedSteps : 0,
        totalSteps: progress.status === 'retest-in-progress' ? progress.totalSteps : 0,
      });
      continue;
    }

    if (lessonCompletedToday) {
      tasks.push({
        id: `${plan.date}:course:${course.slug}`,
        kind: 'course',
        subject: course.subject,
        courseSlug: course.slug,
        title: course.title,
        reason: progress.assessmentTotal
          ? `已完成课程，独立测评 ${progress.assessmentCorrect} / ${progress.assessmentTotal} 题正确。`
          : '已完成今天的课程。',
        status: 'completed',
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
      });
      continue;
    }

    if (
      progress.totalSteps > 0 &&
      (progress.status === 'not-started' || progress.status === 'lesson-in-progress')
    ) {
      tasks.push({
        id: `${plan.date}:course:${course.slug}`,
        kind: 'course',
        subject: course.subject,
        courseSlug: course.slug,
        title: course.title,
        reason:
          progress.status === 'lesson-in-progress'
            ? `已完成 ${progress.completedSteps} / ${progress.totalSteps} 步，从上次位置继续。`
            : course.summary,
        status: progress.status === 'lesson-in-progress' ? 'active' : 'planned',
        completedSteps: progress.completedSteps,
        totalSteps: progress.totalSteps,
      });
    }
  }

  const memoryTasks = [
    {
      contentKind: 'word' as const,
      title: '英语词汇',
      due: plan.wordsDue,
      newCount: plan.wordsNew,
    },
    {
      contentKind: 'poem' as const,
      title: '古诗词',
      due: plan.poemsDue,
      newCount: plan.poemsNew,
    },
  ];
  for (const task of memoryTasks) {
    const total = task.due + task.newCount;
    if (total === 0) continue;
    const completed = Math.min(total, completedByKind[task.contentKind]);
    const active =
      activeSession?.mode === 'plan' &&
      activeSession.kind === task.contentKind &&
      completed < total;
    tasks.push({
      id: `${plan.date}:memory:${task.contentKind}`,
      kind: 'memory-review',
      ...task,
      completed,
      status: completed >= total ? 'completed' : active ? 'active' : 'planned',
    });
  }

  return tasks.sort((left, right) => taskPriority(left) - taskPriority(right));
}

async function getMemoryPlanCompletion(
  userId: string,
  date: string
): Promise<MemoryPlanCompletion> {
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86_400_000);
  const rows = await db
    .select({ kind: contentVersions.kind, value: countDistinct(reviewEvents.cardId) })
    .from(reviewEvents)
    .innerJoin(studySessions, eq(studySessions.id, reviewEvents.sessionId))
    .innerJoin(contentVersions, eq(contentVersions.id, reviewEvents.contentVersionId))
    .where(
      and(
        eq(reviewEvents.userId, userId),
        eq(studySessions.mode, 'plan'),
        gte(reviewEvents.createdAt, start),
        lt(reviewEvents.createdAt, end)
      )
    )
    .groupBy(contentVersions.kind);
  const counts = Object.fromEntries(rows.map((row) => [row.kind, Number(row.value)]));
  return { word: counts.word ?? 0, poem: counts.poem ?? 0 };
}

export async function getOrCreateDailyPlan(user: SessionUser): Promise<MemoryDailyPlan> {
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
    .select({ kind: contentVersions.kind, value: count() })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .where(
      and(
        eq(learningCards.userId, user.id),
        eq(contentVersions.grade, user.grade),
        lte(learningCards.due, new Date())
      )
    )
    .groupBy(contentVersions.kind)
    .orderBy(asc(contentVersions.kind));
  const newCounts = await db
    .select({ kind: contentVersions.kind, value: count() })
    .from(contentItems)
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .where(
      and(
        eq(contentVersions.grade, profile.grade),
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
    .groupBy(contentVersions.kind)
    .orderBy(asc(contentVersions.kind));

  const due = Object.fromEntries(dueCounts.map((row) => [row.kind, Number(row.value)]));
  const available = Object.fromEntries(newCounts.map((row) => [row.kind, Number(row.value)]));
  const goal = profile.dailyGoal;
  const duePlan = allocatePlanCapacity(goal, { word: due.word ?? 0, poem: due.poem ?? 0 }, 0.65);
  const dueTotal = duePlan.word + duePlan.poem;
  const newPlan = allocatePlanCapacity(
    goal - dueTotal,
    { word: available.word ?? 0, poem: available.poem ?? 0 },
    0.75
  );
  const wordsDue = duePlan.word;
  const poemsDue = duePlan.poem;
  const wordsNew = newPlan.word;
  const poemsNew = newPlan.poem;
  const newTotal = wordsNew + poemsNew;
  const availableDue = (due.word ?? 0) + (due.poem ?? 0);
  const reason =
    dueTotal > 0 && newTotal > 0
      ? `先完成 ${dueTotal} 项到期复习，再学习 ${newTotal} 项新内容。`
      : dueTotal > 0 && availableDue > dueTotal
        ? `今天安排 ${dueTotal} 项到期复习，其余 ${availableDue - dueTotal} 项将在后续计划中继续处理。`
        : dueTotal > 0
          ? `今天安排 ${dueTotal} 项到期复习，不新增内容。`
          : newTotal > 0
            ? `当前没有到期内容，今天安排 ${newTotal} 项新内容。`
            : '当前年级暂无可安排的学习内容。';

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
  const [plan, activeSession, courses] = await Promise.all([
    getOrCreateDailyPlan(user),
    getActiveLearningSession(user.id),
    getCourseList(user.id),
  ]);
  const completedByKind = await getMemoryPlanCompletion(user.id, plan.date);
  const completed = Math.min(plan.total, completedByKind.word + completedByKind.poem);
  const memoryRows = await db
    .select({ card: learningCards })
    .from(learningCards)
    .innerJoin(contentItems, eq(contentItems.id, learningCards.contentId))
    .innerJoin(contentVersions, eq(contentVersions.id, contentItems.publishedVersionId))
    .where(eq(learningCards.userId, user.id));
  const now = new Date();
  const startedCards = memoryRows.map((row) => row.card).filter((card) => card.reps > 0);
  const delayedCorrect = startedCards.reduce((sum, card) => sum + card.delayedCorrect, 0);
  const delayedAttempts = startedCards.reduce((sum, card) => sum + card.delayedAttempts, 0);
  const mastery =
    startedCards.length === 0
      ? 0
      : startedCards.reduce((sum, card) => sum + currentMastery(card, now), 0) /
        startedCards.length;
  const reviews = await db
    .select({ createdAt: reviewEvents.createdAt })
    .from(reviewEvents)
    .where(
      and(
        eq(reviewEvents.userId, user.id),
        gte(reviewEvents.createdAt, new Date(now.getTime() - 90 * 86_400_000))
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
  return {
    user,
    plan: {
      ...plan,
      completed,
      tasks: buildPlanTasks(plan, courses, activeSession, completedByKind, user.grade),
    },
    activeSession,
    metrics: {
      mastery: Math.round(mastery * 100),
      delayedAccuracy:
        delayedAttempts === 0 ? 0 : Math.round((delayedCorrect / delayedAttempts) * 100),
      longTermCards: startedCards.filter((card) => card.stability >= 21).length,
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
