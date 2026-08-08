import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { useCategoriesMock } = vi.hoisted(() => ({ useCategoriesMock: vi.fn() }));

const defaultCategories = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-3', name: 'Transport', icon: 'car', colorSlot: 3, sortOrder: 2, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-4', name: 'Entertainment', icon: 'film', colorSlot: 4, sortOrder: 3, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-5', name: 'Utilities', icon: 'zap', colorSlot: 5, sortOrder: 4, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-6', name: 'Shopping', icon: 'shopping-bag', colorSlot: 6, sortOrder: 5, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

vi.mock('@/lib/use-categories', () => ({
  useCategories: useCategoriesMock,
}));

import BudgetPage from './page';

interface MockUseCategories {
  categories: typeof defaultCategories;
  activeCategories: typeof defaultCategories;
  archivedCategories: typeof defaultCategories;
  loading: boolean;
  error: string | null;
}

function mockCategories(overrides: Partial<MockUseCategories> = {}) {
  useCategoriesMock.mockReturnValue({
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
    ...overrides,
  });
}

describe('BudgetPage', () => {
  it('composes the summary, donut chart, and one category card per category', () => {
    mockCategories();
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-page')).toBeInTheDocument();
    expect(screen.getByTestId('budget-summary')).toBeInTheDocument();
    expect(screen.getByTestId('budget-donut-chart')).toBeInTheDocument();
    expect(screen.getAllByTestId('budget-category-card')).toHaveLength(6);
  });

  it('links to the Manage Categories screen', () => {
    mockCategories();
    render(<BudgetPage />);
    expect(screen.getByRole('link', { name: /manage categories/i })).toHaveAttribute('href', '/budget/categories');
  });

  it('shows a loading state instead of the summary while fetching', () => {
    mockCategories({ activeCategories: [], categories: [], loading: true });
    render(<BudgetPage />);
    expect(screen.getByTestId('budget-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-summary')).not.toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', () => {
    mockCategories({ error: 'Could not load categories.' });
    render(<BudgetPage />);
    expect(screen.getByText('Could not load categories.')).toBeInTheDocument();
  });

  it('shows an empty state when there are no categories', () => {
    mockCategories({ activeCategories: [], categories: [] });
    render(<BudgetPage />);
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-summary')).not.toBeInTheDocument();
  });
});
