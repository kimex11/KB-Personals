import { describe, expect, it } from 'vitest';
import { budgetCategories } from './budget-data';

describe('budgetCategories', () => {
  it('has exactly 6 categories with unique ids and unique color slots', () => {
    expect(budgetCategories).toHaveLength(6);
    const ids = budgetCategories.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
    const slots = budgetCategories.map((c) => c.colorSlot);
    expect(new Set(slots)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('gives every category a positive limit', () => {
    for (const category of budgetCategories) {
      expect(category.limit).toBeGreaterThan(0);
    }
  });

  it('includes at least one category that is over its limit', () => {
    expect(budgetCategories.some((c) => c.spent > c.limit)).toBe(true);
  });
});
