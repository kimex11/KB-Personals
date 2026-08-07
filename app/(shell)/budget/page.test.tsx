import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const defaultCategories = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-3', name: 'Transport', icon: 'car', colorSlot: 3, sortOrder: 2, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-4', name: 'Entertainment', icon: 'film', colorSlot: 4, sortOrder: 3, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-5', name: 'Utilities', icon: 'zap', colorSlot: 5, sortOrder: 4, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-6', name: 'Shopping', icon: 'shopping-bag', colorSlot: 6, sortOrder: 5, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

vi.mock('@/lib/use-categories', () => ({
  useCategories: () => ({
    categories: defaultCategories,
    activeCategories: defaultCategories,
    archivedCategories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    remove: vi.fn(),
    merge: vi.fn(),
    reorder: vi.fn(),
  }),
}));

import BudgetPage from './page';

describe('BudgetPage', () => {
  it('composes the summary, donut chart, and one category card per category', () => {
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-page')).toBeInTheDocument();
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument();
    expect(screen.getByTestId('budget-donut-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('budget-category-card')).toHaveLength(6);
  });

  it('links to the Manage Categories screen', () => {
    render(<BudgetPage />);
    expect(screen.getByRole('link', { name: /manage categories/i })).toHaveAttribute('href', '/budget/categories');
  });
});
