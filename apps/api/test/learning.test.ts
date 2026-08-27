import { describe, expect, it } from 'vitest';
import { selectDiagnosticContent } from '../src/services/learning.js';

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
