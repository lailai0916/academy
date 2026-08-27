import { describe, expect, it } from 'vitest';
import { allocatePlanCapacity } from '../src/services/dashboard.js';

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
