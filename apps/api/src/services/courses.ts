import { and, asc, eq } from 'drizzle-orm';
import {
  curriculumCatalog,
  type CourseAnswerResult,
  type CourseAssistanceKind,
  type CourseAssistanceResponse,
  type CourseListItem,
  type CourseProgress,
  type CourseQuestionBranch,
  type CourseRunView,
  type CourseStepView,
} from '@lailai/academy-shared';
import { getCourseDefinition } from '../courses/index.js';
import type {
  CourseDefinition,
  CourseStepDefinition,
  QuestionCourseStep,
} from '../courses/types.js';
import { db } from '../db/index.js';
import {
  activities,
  courseAssistanceEvents,
  courseQuestionBranches,
  courseRuns,
  courseStepAttempts,
} from '../db/schema.js';
import { generateCourseQuestionResponse } from './ai.js';

type StoredRun = typeof courseRuns.$inferSelect;

const phaseLabels = {
  foundation: '基础检查',
  lesson: '概念与推导',
  practice: '分层练习',
  assessment: '独立测评',
  retest: '延迟复测',
} as const;

function stepsForRun(definition: CourseDefinition, run: StoredRun) {
  return run.mode === 'lesson' ? definition.lessonSteps : definition.retestSteps;
}

function publicStep(
  step: CourseStepDefinition,
  completed: number,
  total: number,
  mode: StoredRun['mode']
): CourseStepView {
  const base = {
    id: step.id,
    kind: step.kind,
    phase: step.phase,
    phaseLabel: phaseLabels[step.phase],
    title: step.title,
    instruction: step.instruction,
    content: step.content ?? [],
    assistanceAvailable:
      step.kind === 'question' &&
      mode === 'lesson' &&
      step.phase !== 'assessment' &&
      Boolean(step.hint || step.solution),
    questionsAvailable:
      mode === 'lesson' && step.phase !== 'assessment' && Boolean(step.questionsAvailable),
    progress: { completed, total },
  } satisfies CourseStepView;
  if (step.kind === 'reading') {
    return base;
  }
  return {
    ...base,
    question: step.question,
    responseKind: step.responseKind,
    options: step.options,
    inputLabel: step.inputLabel,
  };
}

function progressFromRuns(
  definition: CourseDefinition,
  runs: StoredRun[],
  now = new Date()
): CourseProgress {
  const lesson = runs.find((run) => run.mode === 'lesson');
  const retest = runs.find((run) => run.mode === 'retest');
  if (!lesson) {
    return {
      status: 'not-started',
      runId: null,
      completedSteps: 0,
      totalSteps: definition.lessonSteps.length,
      progressPercent: 0,
      assessmentCorrect: null,
      assessmentTotal: null,
      retestDueAt: null,
    };
  }
  if (lesson.status === 'active') {
    return {
      status: 'lesson-in-progress',
      runId: lesson.id,
      completedSteps: lesson.currentStep,
      totalSteps: definition.lessonSteps.length,
      progressPercent: Math.round((lesson.currentStep / definition.lessonSteps.length) * 100),
      assessmentCorrect: lesson.assessmentCorrect,
      assessmentTotal: lesson.assessmentTotal,
      retestDueAt: null,
    };
  }
  if (!retest) {
    const due = lesson.retestDueAt;
    return {
      status: due && due <= now ? 'retest-due' : 'retest-scheduled',
      runId: null,
      completedSteps: definition.lessonSteps.length,
      totalSteps: definition.lessonSteps.length,
      progressPercent: 100,
      assessmentCorrect: lesson.assessmentCorrect,
      assessmentTotal: lesson.assessmentTotal,
      retestDueAt: due?.toISOString() ?? null,
    };
  }
  if (retest.status === 'active') {
    return {
      status: 'retest-in-progress',
      runId: retest.id,
      completedSteps: retest.currentStep,
      totalSteps: definition.retestSteps.length,
      progressPercent: Math.round((retest.currentStep / definition.retestSteps.length) * 100),
      assessmentCorrect: retest.assessmentCorrect,
      assessmentTotal: retest.assessmentTotal,
      retestDueAt: lesson.retestDueAt?.toISOString() ?? null,
    };
  }
  return {
    status: 'completed',
    runId: retest.id,
    completedSteps: definition.retestSteps.length,
    totalSteps: definition.retestSteps.length,
    progressPercent: 100,
    assessmentCorrect: retest.assessmentCorrect,
    assessmentTotal: retest.assessmentTotal,
    retestDueAt: lesson.retestDueAt?.toISOString() ?? null,
  };
}

async function runsForCourse(userId: string, definition: CourseDefinition) {
  return db
    .select()
    .from(courseRuns)
    .where(
      and(
        eq(courseRuns.userId, userId),
        eq(courseRuns.courseSlug, definition.catalog.slug),
        eq(courseRuns.courseVersion, definition.version)
      )
    )
    .orderBy(asc(courseRuns.startedAt));
}

async function createCourseRun(
  userId: string,
  definition: CourseDefinition,
  mode: StoredRun['mode']
) {
  const [created] = await db
    .insert(courseRuns)
    .values({
      userId,
      courseSlug: definition.catalog.slug,
      courseVersion: definition.version,
      mode,
    })
    .onConflictDoNothing({
      target: [courseRuns.userId, courseRuns.courseSlug, courseRuns.courseVersion, courseRuns.mode],
    })
    .returning({ id: courseRuns.id });
  if (created) return { runId: created.id, resumed: false };

  const existing = (await runsForCourse(userId, definition)).find((run) => run.mode === mode);
  if (!existing) throw new Error('Course run conflict did not return an existing run.');
  return { runId: existing.id, resumed: true };
}

export async function getCourseList(userId: string): Promise<CourseListItem[]> {
  return Promise.all(
    curriculumCatalog.courses.map(async (course) => {
      const definition = getCourseDefinition(course.slug);
      if (!definition) {
        return {
          ...course,
          progress: {
            status: 'not-started',
            runId: null,
            completedSteps: 0,
            totalSteps: 0,
            progressPercent: 0,
            assessmentCorrect: null,
            assessmentTotal: null,
            retestDueAt: null,
          },
        };
      }
      return {
        ...course,
        progress: progressFromRuns(definition, await runsForCourse(userId, definition)),
      };
    })
  );
}

export async function getCourseDetail(userId: string, slug: string) {
  const definition = getCourseDefinition(slug);
  if (!definition) return null;
  return {
    course: definition.catalog,
    progress: progressFromRuns(definition, await runsForCourse(userId, definition)),
  };
}

export async function startCourseRun(userId: string, slug: string) {
  const definition = getCourseDefinition(slug);
  if (!definition) return { status: 'missing' as const };
  const runs = await runsForCourse(userId, definition);
  const active = runs.find((run) => run.status === 'active');
  if (active) {
    return { status: 'ready' as const, runId: active.id, resumed: true };
  }
  const lesson = runs.find((run) => run.mode === 'lesson');
  if (!lesson) {
    return { status: 'ready' as const, ...(await createCourseRun(userId, definition, 'lesson')) };
  }
  const retest = runs.find((run) => run.mode === 'retest');
  if (retest) {
    return { status: 'ready' as const, runId: retest.id, resumed: true };
  }
  if (!lesson.retestDueAt || lesson.retestDueAt > new Date()) {
    return {
      status: 'scheduled' as const,
      dueAt: lesson.retestDueAt?.toISOString() ?? null,
    };
  }
  return { status: 'ready' as const, ...(await createCourseRun(userId, definition, 'retest')) };
}

async function storedRun(userId: string, runId: string) {
  const [run] = await db
    .select()
    .from(courseRuns)
    .where(and(eq(courseRuns.id, runId), eq(courseRuns.userId, userId)))
    .limit(1);
  return run ?? null;
}

async function branchesForRun(runId: string): Promise<CourseQuestionBranch[]> {
  const rows = await db
    .select()
    .from(courseQuestionBranches)
    .where(eq(courseQuestionBranches.runId, runId))
    .orderBy(asc(courseQuestionBranches.createdAt));
  return rows.map((row) => ({
    id: row.id,
    stepId: row.stepId,
    question: row.question,
    answer: row.answer,
    keyPoints: row.keyPoints,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getCourseRun(userId: string, runId: string): Promise<CourseRunView | null> {
  const run = await storedRun(userId, runId);
  if (!run) return null;
  const definition = getCourseDefinition(run.courseSlug);
  if (!definition || definition.version !== run.courseVersion) return null;
  const steps = stepsForRun(definition, run);
  const allRuns = await runsForCourse(userId, definition);
  const step = run.status === 'active' ? steps[run.currentStep] : null;
  return {
    id: run.id,
    course: definition.catalog,
    mode: run.mode,
    status: run.status,
    step: step ? publicStep(step, run.currentStep, steps.length, run.mode) : null,
    progress: progressFromRuns(definition, allRuns),
    branches: await branchesForRun(run.id),
    summary:
      run.status === 'completed' && run.completedAt
        ? {
            mode: run.mode,
            assessmentCorrect: run.assessmentCorrect,
            assessmentTotal: run.assessmentTotal,
            completedAt: run.completedAt.toISOString(),
            retestDueAt: run.retestDueAt?.toISOString() ?? null,
          }
        : null,
  };
}

function answerMatches(step: QuestionCourseStep, response: string) {
  if (step.answer.kind === 'number') {
    const match = response.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    if (!match) return false;
    return Math.abs(Number(match[0]) - step.answer.value) <= (step.answer.tolerance ?? 0);
  }
  const normalized = response.trim().toLowerCase().replace(/\s+/g, '');
  return step.answer.accepted.some(
    (answer) => answer.trim().toLowerCase().replace(/\s+/g, '') === normalized
  );
}

function expectedAnswer(step: QuestionCourseStep) {
  return step.answer.kind === 'number'
    ? String(step.answer.value)
    : (step.answer.accepted[0] ?? '');
}

async function assistanceLevel(runId: string, stepId: string) {
  const events = await db
    .select({ kind: courseAssistanceEvents.kind })
    .from(courseAssistanceEvents)
    .where(and(eq(courseAssistanceEvents.runId, runId), eq(courseAssistanceEvents.stepId, stepId)));
  if (events.some((event) => event.kind === 'solution')) return 'solution' as const;
  if (events.some((event) => event.kind === 'hint')) return 'hint' as const;
  return 'independent' as const;
}

async function advanceRun(
  run: StoredRun,
  definition: CourseDefinition,
  expectedStep: number,
  assessment: { correct: boolean; counts: boolean }
) {
  const steps = stepsForRun(definition, run);
  const nextStep = expectedStep + 1;
  const complete = nextStep >= steps.length;
  const now = new Date();
  const [updated] = await db
    .update(courseRuns)
    .set({
      currentStep: nextStep,
      status: complete ? 'completed' : 'active',
      completedAt: complete ? now : null,
      retestDueAt:
        complete && run.mode === 'lesson'
          ? new Date(now.getTime() + 7 * 86_400_000)
          : run.retestDueAt,
      assessmentCorrect: run.assessmentCorrect + (assessment.counts && assessment.correct ? 1 : 0),
      assessmentTotal: run.assessmentTotal + (assessment.counts ? 1 : 0),
      updatedAt: now,
    })
    .where(
      and(
        eq(courseRuns.id, run.id),
        eq(courseRuns.userId, run.userId),
        eq(courseRuns.status, 'active'),
        eq(courseRuns.currentStep, expectedStep)
      )
    )
    .returning({ id: courseRuns.id });
  if (updated && complete) {
    await db.insert(activities).values({
      userId: run.userId,
      kind: run.mode === 'lesson' ? 'course-completed' : 'course-retest-completed',
      summary: (run.mode === 'lesson' ? '完成课程：' : '完成延迟复测：') + definition.catalog.title,
      metadata: { courseSlug: definition.catalog.slug, runId: run.id },
    });
  }
  return { advanced: Boolean(updated), complete: Boolean(updated && complete) };
}

export async function completeCourseStep(userId: string, runId: string, stepId: string) {
  const run = await storedRun(userId, runId);
  if (!run || run.status !== 'active') return null;
  const definition = getCourseDefinition(run.courseSlug);
  if (!definition || definition.version !== run.courseVersion) return null;
  const step = stepsForRun(definition, run)[run.currentStep];
  if (!step || step.id !== stepId || step.kind !== 'reading') return null;
  return advanceRun(run, definition, run.currentStep, { correct: false, counts: false });
}

export async function answerCourseStep(
  userId: string,
  runId: string,
  stepId: string,
  response: string
): Promise<CourseAnswerResult | null> {
  const run = await storedRun(userId, runId);
  if (!run || run.status !== 'active') return null;
  const definition = getCourseDefinition(run.courseSlug);
  if (!definition || definition.version !== run.courseVersion) return null;
  const step = stepsForRun(definition, run)[run.currentStep];
  if (!step || step.id !== stepId || step.kind !== 'question') return null;
  const correct = answerMatches(step, response);
  const level = await assistanceLevel(run.id, step.id);
  const counts = step.phase === 'assessment' || step.phase === 'retest';
  const shouldAdvance = correct || counts || Boolean(step.advanceOnIncorrect);
  let advance = { advanced: false, complete: false };
  if (shouldAdvance) {
    advance = await advanceRun(run, definition, run.currentStep, { correct, counts });
    if (!advance.advanced) return null;
  }
  const feedback = correct ? step.correctFeedback : step.incorrectFeedback;
  await db.insert(courseStepAttempts).values({
    runId: run.id,
    userId,
    stepId: step.id,
    phase: step.phase,
    response,
    correct,
    assistanceLevel: level,
    feedback,
  });
  return {
    correct,
    feedback,
    expectedAnswer: correct || shouldAdvance ? expectedAnswer(step) : null,
    assistanceLevel: level,
    advanced: shouldAdvance,
    runComplete: advance.complete,
  };
}

export async function requestCourseAssistance(
  userId: string,
  runId: string,
  stepId: string,
  kind: CourseAssistanceKind
): Promise<CourseAssistanceResponse | null> {
  const run = await storedRun(userId, runId);
  if (!run || run.status !== 'active' || run.mode !== 'lesson') return null;
  const definition = getCourseDefinition(run.courseSlug);
  if (!definition || definition.version !== run.courseVersion) return null;
  const step = stepsForRun(definition, run)[run.currentStep];
  if (!step || step.id !== stepId || step.kind !== 'question' || step.phase === 'assessment') {
    return null;
  }
  const content = kind === 'hint' ? step.hint : step.solution;
  if (!content) return null;
  await db.insert(courseAssistanceEvents).values({ runId, userId, stepId, kind });
  return { kind, content };
}

export async function askCourseQuestion(
  userId: string,
  runId: string,
  stepId: string,
  question: string
): Promise<CourseQuestionBranch | 'unconfigured' | null> {
  const run = await storedRun(userId, runId);
  if (!run || run.status !== 'active' || run.mode !== 'lesson') return null;
  const definition = getCourseDefinition(run.courseSlug);
  if (!definition || definition.version !== run.courseVersion) return null;
  const step = stepsForRun(definition, run)[run.currentStep];
  if (!step || step.id !== stepId || step.phase === 'assessment' || !step.questionsAvailable) {
    return null;
  }
  const generated = await generateCourseQuestionResponse({
    courseTitle: definition.catalog.title,
    stepTitle: step.title,
    source: {
      instruction: step.instruction,
      content: step.content ?? [],
      question: step.kind === 'question' ? step.question : undefined,
    },
    question,
  });
  if (!generated) return 'unconfigured';
  const [created] = await db
    .insert(courseQuestionBranches)
    .values({
      runId,
      userId,
      stepId,
      question,
      answer: generated.answer,
      keyPoints: generated.keyPoints,
    })
    .returning();
  return {
    id: created.id,
    stepId: created.stepId,
    question: created.question,
    answer: created.answer,
    keyPoints: created.keyPoints,
    createdAt: created.createdAt.toISOString(),
  };
}
