import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const activeCategory = { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };

const createMock = vi.fn().mockResolvedValue(undefined);
const reorderMock = vi.fn().mockResolvedValue(undefined);
const archiveMock = vi.fn().mockResolvedValue(undefined);
const removeMock = vi.fn().mockResolvedValue(undefined);
const mergeMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/use-categories', () => ({
  useCategories: () => ({
    categories: [activeCategory],
    activeCategories: [activeCategory],
    archivedCategories: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    create: createMock,
    update: vi.fn(),
    archive: archiveMock,
    unarchive: vi.fn(),
    remove: removeMock,
    merge: mergeMock,
    reorder: reorderMock,
  }),
}));

vi.mock('@/lib/categories-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/categories-repository')>();
  return { ...actual, countBillsUsingCategory: vi.fn().mockResolvedValue(0) };
});

import CategoriesPage from './page';

describe('CategoriesPage', () => {
  it('renders the category list and an Add Category button', () => {
    render(<CategoriesPage />);
    expect(screen.getByText('Housing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add category/i })).toBeInTheDocument();
  });

  it('renders a Merge Categories button', () => {
    render(<CategoriesPage />);
    expect(screen.getByRole('button', { name: /merge categories/i })).toBeInTheDocument();
  });

  it('opens the add form when Add Category is clicked', async () => {
    const user = userEvent.setup();
    render(<CategoriesPage />);
    await user.click(screen.getByRole('button', { name: /add category/i }));
    expect(screen.getByRole('heading', { name: /add category/i })).toBeInTheDocument();
  });
});
