'use client';

import { useMemo } from 'react';
import { budgetCategories } from './budget-data';
import type { BudgetCategory } from './budget-types';

export interface BudgetTotals {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function useBudget(): { categories: BudgetCategory[]; totals: BudgetTotals } {
  const categories = budgetCategories;

  const totals = useMemo<BudgetTotals>(() => {
    const budgeted = categories.reduce((sum, c) => sum + c.limit, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [categories]);

  return { categories, totals };
}
