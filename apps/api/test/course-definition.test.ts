import { describe, expect, it } from 'vitest';
import { momentumCourse } from '../src/courses/momentum.js';

describe('momentum course definition', () => {
  it('uses unique stable step identifiers', () => {
    const steps = [...momentumCourse.lessonSteps, ...momentumCourse.retestSteps];
    const ids = steps.map((step) => step.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(momentumCourse.lessonSteps.length).toBeGreaterThanOrEqual(8);
    expect(momentumCourse.retestSteps.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps measured questions independent from hints and AI branches', () => {
    const measured = [...momentumCourse.lessonSteps, ...momentumCourse.retestSteps].filter(
      (step) => step.phase === 'assessment' || step.phase === 'retest'
    );

    expect(measured.length).toBeGreaterThan(0);
    for (const step of measured) {
      expect(step.kind).toBe('question');
      if (step.kind === 'question') {
        expect(step.hint).toBeUndefined();
        expect(step.solution).toBeUndefined();
        expect(step.questionsAvailable).toBe(false);
        expect(step.advanceOnIncorrect).toBe(true);
      }
    }
  });

  it('does not package canonical answers as public catalog metadata', () => {
    expect(momentumCourse.catalog).not.toHaveProperty('lessonSteps');
    expect(momentumCourse.catalog).not.toHaveProperty('answer');
  });
});
