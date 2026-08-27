import { describe, expect, it } from 'vitest';
import {
  selectDiagnosticContent,
  shouldScheduleReinforcement,
  summarizeAttemptSequences,
} from '../src/services/learning.js';

describe('diagnostic sampling', () => {
  it('covers different textbook units before taking a second item from one unit', () => {
    const items = [
      { id: 'a1', textbook: '教材', unit: '第一单元' },
      { id: 'a2', textbook: '教材', unit: '第一单元' },
      { id: 'b1', textbook: '教材', unit: '第二单元' },
      { id: 'b2', textbook: '教材', unit: '第二单元' },
      { id: 'c1', textbook: '教材', unit: '第三单元' },
    ];

    const selected = selectDiagnosticContent(items, 3, 'student');
    expect(new Set(selected.map((item) => item.unit))).toHaveLength(3);
  });

  it('is deterministic for the same learner and content pool', () => {
    const items = Array.from({ length: 12 }, (_, index) => ({
      id: `item-${index}`,
      textbook: '教材',
      unit: `第 ${index % 4} 单元`,
    }));

    expect(selectDiagnosticContent(items, 8, 'student')).toEqual(
      selectDiagnosticContent(items, 8, 'student')
    );
  });
});

describe('within-session reinforcement', () => {
  const queue = ['a', 'b', 'c', 'd', 'e'];

  it('requeues an incorrect item after enough intervening retrievals', () => {
    expect(shouldScheduleReinforcement(queue, 0, 'a', false)).toBe(true);
    expect(shouldScheduleReinforcement(queue, 2, 'c', false)).toBe(true);
  });

  it('does not create immediate, duplicate, or outdated retries', () => {
    expect(shouldScheduleReinforcement(queue, 0, 'a', true)).toBe(false);
    expect(shouldScheduleReinforcement(queue, 3, 'd', false)).toBe(false);
    expect(shouldScheduleReinforcement([...queue, 'a'], 0, 'a', false)).toBe(false);
    expect(shouldScheduleReinforcement(queue, 0, 'a', false, true)).toBe(false);
  });

  it('separates first-pass recall from successful correction', () => {
    expect(
      summarizeAttemptSequences([
        { contentId: 'a', correct: false },
        { contentId: 'b', correct: true },
        { contentId: 'a', correct: true },
        { contentId: 'c', correct: false },
      ])
    ).toEqual({ firstPassAccuracy: 33, reinforcementCount: 1, recoveredCount: 1 });
  });
});
