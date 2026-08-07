'use client';

import { useMemo } from 'react';
import { useCategories } from './use-categories';
import { budgetAmountsByCategoryName, DEFAULT_BUDGET_AMOUNTS } from './budget-data';
import { ICON_MAP } from './category-icons';
import type { BudgetCategory } from './budget-types';

export interface BudgetTotals {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function useBudget(): { categories: BudgetCategory[]; totals: BudgetTotals; loading: boolean; error: string | null } {
  const { activeCategories, loading, error } = useCategories();

  const categories = useMemo<BudgetCategory[]>(
    () =>
      activeCategories.map((category) => {
        const amounts = budgetAmountsByCategoryName[category.name] ?? DEFAULT_BUDGET_AMOUNTS;
        return {
          id: category.id,
          name: category.name,
          icon: ICON_MAP[category.icon],
          colorSlot: category.colorSlot,
          limit: amounts.limit,
          spent: amounts.spent,
        };
      }),
    [activeCategories]
  );

  const totals = useMemo<BudgetTotals>(() => {
    const budgeted = categories.reduce((sum, c) => sum + c.limit, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    return { budgeted, spent, remaining: budgeted - spent };
  }, [categories]);

  return { categories, totals, loading, error };
}
