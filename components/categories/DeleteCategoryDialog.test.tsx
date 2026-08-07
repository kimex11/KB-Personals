import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteCategoryDialog } from './DeleteCategoryDialog';
import type { Category } from '@/lib/categories-types';

const target: Category = { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };
const other: Category = { id: 'cat-2', name: 'Groceries', icon: 'shopping-cart', colorSlot: 2, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' };

describe('DeleteCategoryDialog', () => {
  it('enables delete immediately when no bills use the category', () => {
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={0} otherCategories={[other]} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
    expect(screen.queryByLabelText(/reassign to/i)).not.toBeInTheDocument();
  });

  it('disables delete until a reassignment target is chosen when bills use the category', async () => {
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={4} otherCategories={[other]} onConfirm={vi.fn()} />);
    expect(screen.getByText(/4 bills/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/reassign to/i), 'cat-2');
    expect(screen.getByRole('button', { name: /^delete$/i })).not.toBeDisabled();
  });

  it('calls onConfirm without an id when there is nothing to reassign', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={0} otherCategories={[other]} onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onConfirm with the chosen reassignment id', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DeleteCategoryDialog open onOpenChange={() => {}} category={target} billCount={4} otherCategories={[other]} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText(/reassign to/i), 'cat-2');
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledWith('cat-2');
  });
});
