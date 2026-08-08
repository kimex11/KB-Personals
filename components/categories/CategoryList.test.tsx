import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryList } from './CategoryList';
import type { Category } from '@/lib/categories-types';

const categories: Category[] = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

const archivedCategory: Category = {
  id: 'cat-3',
  name: 'Old Subscriptions',
  icon: 'gift',
  colorSlot: 3,
  sortOrder: 2,
  archived: true,
  createdAt: '2026-08-15T10:00:00.000Z',
};

const noop = () => {};

describe('CategoryList', () => {
  it('renders each category with its name and a drag handle', () => {
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    expect(screen.getByText('Housing')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getAllByTestId('category-drag-handle')).toHaveLength(2);
  });

  it('renders in the given order', () => {
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    const rows = screen.getAllByTestId('category-row');
    expect(rows[0]).toHaveTextContent('Housing');
    expect(rows[1]).toHaveTextContent('Groceries');
  });

  it('shows an "Archived" badge and no drag handle for archived categories', () => {
    render(<CategoryList categories={[archivedCategory]} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.queryByTestId('category-drag-handle')).not.toBeInTheDocument();
  });

  it('hides Edit/Archive/Delete until the actions menu is opened', () => {
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    expect(screen.getAllByRole('button', { name: /actions for/i })).toHaveLength(2);
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('calls onEdit when the edit action is chosen', async () => {
    const onEdit = vi.fn();
    const user = userEvent.setup();
    render(<CategoryList categories={categories} onReorder={noop} onEdit={onEdit} onArchive={noop} onUnarchive={noop} onDelete={noop} />);
    await user.click(screen.getAllByRole('button', { name: /actions for housing/i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledWith(categories[0]);
  });

  it('calls onArchive for an active category and onUnarchive for an archived one', async () => {
    const onArchive = vi.fn();
    const onUnarchive = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoryList
        categories={[categories[0], archivedCategory]}
        onReorder={noop}
        onEdit={noop}
        onArchive={onArchive}
        onUnarchive={onUnarchive}
        onDelete={noop}
      />
    );
    await user.click(screen.getByRole('button', { name: /actions for housing/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^archive$/i }));
    expect(onArchive).toHaveBeenCalledWith('cat-1');

    await user.click(screen.getByRole('button', { name: /actions for old subscriptions/i }));
    await user.click(await screen.findByRole('menuitem', { name: /^unarchive$/i }));
    expect(onUnarchive).toHaveBeenCalledWith('cat-3');
  });

  it('calls onDelete with the full category when the delete action is chosen', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<CategoryList categories={categories} onReorder={noop} onEdit={noop} onArchive={noop} onUnarchive={noop} onDelete={onDelete} />);
    await user.click(screen.getAllByRole('button', { name: /actions for housing/i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(categories[0]);
  });
});
