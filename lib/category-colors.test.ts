import { describe, expect, it } from 'vitest';
import { STROKE_COLOR_CLASS, DOT_COLOR_CLASS, BAR_COLOR_CLASS, CATEGORY_COLOR_SLOTS } from './category-colors';

describe('category-colors', () => {
  it('defines 12 color slots', () => {
    expect(CATEGORY_COLOR_SLOTS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('has a class for every slot in each map', () => {
    CATEGORY_COLOR_SLOTS.forEach((slot) => {
      expect(STROKE_COLOR_CLASS[slot]).toMatch(/^stroke-budget-\d+$/);
      expect(DOT_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
      expect(BAR_COLOR_CLASS[slot]).toMatch(/^bg-budget-\d+$/);
    });
  });

  it('preserves the existing 1-6 slot values used by Budget today', () => {
    expect(BAR_COLOR_CLASS[1]).toBe('bg-budget-1');
    expect(STROKE_COLOR_CLASS[6]).toBe('stroke-budget-6');
  });
});
