import { describe, expect, it } from 'vitest';
import { budgetAmountsByCategoryName, DEFAULT_BUDGET_AMOUNTS } from './budget-data';

describe('budgetAmountsByCategoryName', () => {
  it('holds no demo/placeholder entries', () => {
    expect(budgetAmountsByCategoryName).toEqual({});
  });
});

describe('DEFAULT_BUDGET_AMOUNTS', () => {
  it('is zeroed until a real budgets backend exists', () => {
    expect(DEFAULT_BUDGET_AMOUNTS).toEqual({ limit: 0, spent: 0 });
  });
});
