import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const activeCategory = (
  overrides: Partial<{ id: string; name: string; icon: string; colorSlot: number; sortOrder: number }> = {}
) => ({
  id: 'cat-1',
  name: 'Housing',
  icon: 'building-2',
  colorSlot: 1,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-08-15T10:00:00.000Z',
  ...overrides,
});

const useCategoriesMock = vi.fn();
vi.mock('./use-categories', () => ({
  useCategories: () => useCategoriesMock(),
}));

import { useBudget } from './use-budget';

describe('useBudget', () => {
  it('joins live categories with limit/spent, defaulting to 0 with no real budgets backend yet', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [activeCategory({ id: 'cat-1', name: 'Housing', colorSlot: 1 })],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories).toEqual([
      expect.objectContaining({ id: 'cat-1', name: 'Housing', colorSlot: 1, limit: 0, spent: 0 }),
    ]);
  });

  it('defaults limit/spent to 0 for any category', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [activeCategory({ id: 'cat-9', name: 'Pet Care', colorSlot: 9 })],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.categories[0]).toEqual(expect.objectContaining({ limit: 0, spent: 0 }));
  });

  it('computes budgeted/spent/remaining totals', () => {
    useCategoriesMock.mockReturnValue({
      activeCategories: [
        activeCategory({ id: 'cat-1', name: 'Housing' }),
        activeCategory({ id: 'cat-2', name: 'Groceries', colorSlot: 2 }),
      ],
      loading: false,
      error: null,
    });
    const { result } = renderHook(() => useBudget());
    expect(result.current.totals).toEqual({ budgeted: 0, spent: 0, remaining: 0 });
  });

  it('passes through loading and error from useCategories', () => {
    useCategoriesMock.mockReturnValue({ activeCategories: [], loading: true, error: 'boom' });
    const { result } = renderHook(() => useBudget());
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe('boom');
  });
});
