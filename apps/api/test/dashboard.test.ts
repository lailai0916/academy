import { describe, expect, it } from 'vitest';
import type { CourseListItem, DailyPlan } from '@lailai/academy-shared';
import { allocatePlanCapacity, buildPlanTasks } from '../src/services/dashboard.js';

const plan: Omit<DailyPlan, 'tasks'> = {
  date: '2026-09-18',
  wordsDue: 3,
  wordsNew: 2,
  poemsDue: 0,
  poemsNew: 2,
  completed: 0,
  total: 7,
  reason: '先复习，再学习新内容。',
};

function courseWith(progress: Partial<CourseListItem['progress']>): CourseListItem {
  return {
    slug: 'physics-momentum',
    subject: 'physics',
    grade: '高二',
    title: '动量定理',
    summary: '完成讲解、练习、独立测评与延迟复测。',
    status: 'pilot',
    statusDetail: '试用中',
    objectives: [],
    plannedFlow: [],
    progress: {
      status: 'not-started',
      runId: null,
      completedSteps: 0,
      totalSteps: 8,
      progressPercent: 0,
      assessmentCorrect: null,
      assessmentTotal: null,
      retestDueAt: null,
      lessonCompletedAt: null,
      retestCompletedAt: null,
      ...progress,
    },
  };
}

describe('daily plan allocation', () => {
  it('uses the full capacity when either subject can absorb the remainder', () => {
    expect(allocatePlanCapacity(20, { word: 2, poem: 30 }, 0.7)).toEqual({ word: 2, poem: 18 });
    expect(allocatePlanCapacity(20, { word: 30, poem: 2 }, 0.7)).toEqual({ word: 18, poem: 2 });
  });

  it('does not exceed available content or the daily capacity', () => {
    expect(allocatePlanCapacity(20, { word: 3, poem: 4 }, 0.7)).toEqual({ word: 3, poem: 4 });
    expect(allocatePlanCapacity(0, { word: 10, poem: 10 }, 0.7)).toEqual({ word: 0, poem: 0 });
  });
});

describe('cross-module daily plan', () => {
  it('prioritizes due memory before a new course and new memory', () => {
    const tasks = buildPlanTasks(plan, [courseWith({})], null, { word: 0, poem: 0 }, '高二');

    expect(tasks.map((task) => task.id)).toEqual([
      '2026-09-18:memory:word',
      '2026-09-18:course:physics-momentum',
      '2026-09-18:memory:poem',
    ]);
  });

  it('marks a running memory task active and keeps item progress', () => {
    const tasks = buildPlanTasks(
      plan,
      [],
      {
        id: 'session',
        kind: 'word',
        mode: 'plan',
        plannedCount: 5,
        completedCount: 2,
        startedAt: '2026-09-18T08:00:00+08:00',
      },
      { word: 2, poem: 0 },
      '高二'
    );
    const words = tasks.find(
      (task) => task.kind === 'memory-review' && task.contentKind === 'word'
    );

    expect(words).toMatchObject({ status: 'active', completed: 2, due: 3, newCount: 2 });
  });

  it('keeps a course completed today visible and removes it on later days', () => {
    const completedCourse = courseWith({
      status: 'retest-scheduled',
      completedSteps: 8,
      progressPercent: 100,
      assessmentCorrect: 2,
      assessmentTotal: 2,
      retestDueAt: '2026-09-25T12:00:00+08:00',
      lessonCompletedAt: '2026-09-18T10:00:00+08:00',
    });

    expect(
      buildPlanTasks(plan, [completedCourse], null, { word: 0, poem: 0 }, '高二')
    ).toContainEqual(expect.objectContaining({ kind: 'course', status: 'completed' }));
    expect(
      buildPlanTasks(
        { ...plan, date: '2026-09-19' },
        [completedCourse],
        null,
        {
          word: 0,
          poem: 0,
        },
        '高二'
      ).some((task) => task.kind === 'course')
    ).toBe(false);
  });

  it('puts a due delayed assessment ahead of other planned work', () => {
    const tasks = buildPlanTasks(
      plan,
      [
        courseWith({
          status: 'retest-due',
          completedSteps: 8,
          progressPercent: 100,
          retestDueAt: '2026-09-18T00:00:00+08:00',
          lessonCompletedAt: '2026-09-11T10:00:00+08:00',
        }),
      ],
      null,
      { word: 0, poem: 0 },
      '高二'
    );

    expect(tasks[0]).toMatchObject({ kind: 'assessment', status: 'planned' });
  });

  it('does not schedule a course from another grade', () => {
    expect(
      buildPlanTasks(plan, [courseWith({})], null, { word: 0, poem: 0 }, '高一')
    ).not.toContainEqual(expect.objectContaining({ kind: 'course' }));
  });
});
