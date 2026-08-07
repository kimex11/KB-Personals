import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { Home } from 'lucide-react';

vi.mock('./budget-data', () => ({
  budgetCategories: [
    { id: 'a', name: 'A', icon: Home, colorSlot: 1, limit: 100, spent: 80 },
    { id: 'b', name: 'B', icon: Home, colorSlot: 2, limit: 50, spent: 60 },
  ],
}));

import { useBudget } from './use-budget';

describe('useBudget', () => {
  it('computes budgeted/spent/remaining totals from the category list', () => {
    const { result } = renderHook(() => useBudget());
    expect(result.current.totals).toEqual({ budgeted: 150, spent: 140, remaining: 10 });
  });

  it('returns the category list', () => {
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories).toHaveLength(2);
  });
});
