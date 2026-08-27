import { describe, expect, it } from 'vitest';
import {
  summarizeChallengeProgress,
  type ChallengeProgressEvent,
} from '../src/services/challenges.js';

const future = new Date('2026-09-01T00:00:00.000Z');
const now = new Date('2026-08-28T00:00:00.000Z');

function event(
  id: string,
  overrides: Partial<ChallengeProgressEvent> = {}
): ChallengeProgressEvent {
  return {
    id,
    userId: 'student-a',
    cardId: `card-${id}`,
    sessionId: 'session-a',
    correct: true,
    delayed: false,
    masteryBefore: 0.2,
    masteryAfter: 0.3,
    ...overrides,
  };
}

describe('cooperative challenge progress', () => {
  it('counts one learning item once when it is reinforced in the same session', () => {
    const result = summarizeChallengeProgress(
      'review_count',
      3,
      1,
      [event('first'), event('reinforced', { cardId: 'card-first' }), event('second')],
      'student-a',
      future,
      now
    );

    expect(result).toMatchObject({
      progressValue: 2,
      progressPercent: 67,
      personalValue: 2,
      status: 'active',
    });
  });

  it('sums only positive mastery changes and keeps personal contribution separate', () => {
    const result = summarizeChallengeProgress(
      'mastery_gain',
      30,
      1,
      [
        event('a', { masteryBefore: 0.2, masteryAfter: 0.35 }),
        event('b', { userId: 'student-b', masteryBefore: 0.4, masteryAfter: 0.55 }),
        event('c', { masteryBefore: 0.7, masteryAfter: 0.6 }),
      ],
      'student-a',
      future,
      now
    );

    expect(result).toMatchObject({
      progressValue: 30,
      progressPercent: 100,
      personalValue: 15,
      status: 'completed',
    });
  });

  it('requires both the delayed accuracy target and the minimum sample size', () => {
    const early = summarizeChallengeProgress(
      'delayed_accuracy',
      80,
      5,
      [event('a', { delayed: true }), event('b', { delayed: true })],
      'student-a',
      future,
      now
    );
    expect(early).toMatchObject({
      progressValue: 100,
      qualifyingEventCount: 2,
      progressPercent: 40,
      status: 'active',
    });

    const complete = summarizeChallengeProgress(
      'delayed_accuracy',
      80,
      5,
      [
        event('a', { delayed: true }),
        event('b', { delayed: true }),
        event('c', { delayed: true }),
        event('d', { delayed: true }),
        event('e', { delayed: true, correct: false }),
      ],
      'student-a',
      future,
      now
    );
    expect(complete).toMatchObject({
      progressValue: 80,
      qualifyingEventCount: 5,
      progressPercent: 100,
      status: 'completed',
    });
  });

  it('marks an unmet goal as ended after its deadline', () => {
    const result = summarizeChallengeProgress(
      'review_count',
      10,
      1,
      [],
      'student-a',
      new Date('2026-08-27T00:00:00.000Z'),
      now
    );
    expect(result.status).toBe('ended');
  });
});
