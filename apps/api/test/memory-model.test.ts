import { describe, expect, it } from 'vitest';
import {
  buildReviewForecast,
  currentMastery,
  sessionMastery,
} from '../src/services/memory-model.js';

const reviewedCard = {
  due: new Date('2026-08-29T04:00:00.000Z'),
  stability: 10,
  difficulty: 5,
  elapsedDays: 0,
  scheduledDays: 10,
  learningSteps: 0,
  reps: 3,
  lapses: 0,
  state: 2,
  lastReview: new Date('2026-08-20T04:00:00.000Z'),
};

describe('current memory state', () => {
  it('reduces current mastery as recall probability decays', () => {
    const earlier = currentMastery(reviewedCard, new Date('2026-08-21T04:00:00.000Z'));
    const later = currentMastery(reviewedCard, new Date('2026-09-09T04:00:00.000Z'));

    expect(earlier).toBeGreaterThan(later);
    expect(later).toBeGreaterThanOrEqual(0);
  });

  it('does not count unseen cards as mastered', () => {
    expect(currentMastery({ ...reviewedCard, reps: 0 })).toBe(0);
  });

  it('pins difficulty to the session-start state and uses fresh in-session reviews', () => {
    const sessionStartedAt = new Date('2026-08-28T04:00:00.000Z');
    const atStart = sessionMastery({ ...reviewedCard, mastery: 0.99 }, sessionStartedAt);
    expect(atStart).toBeCloseTo(currentMastery(reviewedCard, sessionStartedAt));
    expect(atStart).not.toBe(0.99);

    expect(
      sessionMastery(
        {
          ...reviewedCard,
          mastery: 0.72,
          lastReview: new Date('2026-08-28T04:05:00.000Z'),
        },
        sessionStartedAt
      )
    ).toBe(0.72);
  });
});

describe('review forecast', () => {
  it('groups overdue and upcoming reviews by Shanghai study date', () => {
    const now = new Date('2026-08-28T04:00:00.000Z');
    const forecast = buildReviewForecast(
      [
        { kind: 'word', due: new Date('2026-08-27T04:00:00.000Z'), reps: 2 },
        { kind: 'poem', due: new Date('2026-08-29T04:00:00.000Z'), reps: 1 },
        { kind: 'word', due: new Date('2026-09-10T04:00:00.000Z'), reps: 3 },
        { kind: 'poem', due: new Date('2026-08-30T04:00:00.000Z'), reps: 0 },
      ],
      7,
      now
    );

    expect(forecast).toHaveLength(7);
    expect(forecast[0]).toEqual({ date: '2026-08-28', word: 1, poem: 0, total: 1 });
    expect(forecast[1]).toEqual({ date: '2026-08-29', word: 0, poem: 1, total: 1 });
    expect(forecast.slice(2).every((day) => day.total === 0)).toBe(true);
  });
});
