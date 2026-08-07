import { describe, expect, it } from 'vitest';
import { budgetAmountsByCategoryName } from './budget-data';

describe('budgetAmountsByCategoryName', () => {
  it('has an entry for each of the 6 default categories', () => {
    ['Housing', 'Groceries', 'Transport', 'Entertainment', 'Utilities', 'Shopping'].forEach((name) => {
      expect(budgetAmountsByCategoryName[name]).toBeDefined();
      expect(budgetAmountsByCategoryName[name].limit).toBeGreaterThan(0);
    });
  });

  it('keeps the same limit/spent values as before the re-key', () => {
    expect(budgetAmountsByCategoryName['Housing']).toEqual({ limit: 1450, spent: 1450 });
    expect(budgetAmountsByCategoryName['Shopping']).toEqual({ limit: 300, spent: 95 });
  });
});
