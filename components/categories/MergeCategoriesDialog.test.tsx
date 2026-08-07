import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MergeCategoriesDialog } from './MergeCategoriesDialog';
import type { Category } from '@/lib/categories-types';

const categories: Category[] = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Rent', icon: 'building-2', colorSlot: 1, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

describe('MergeCategoriesDialog', () => {
  it('disables confirm until both source and target are chosen', async () => {
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-2');
    expect(screen.getByRole('button', { name: /^merge$/i })).not.toBeDisabled();
  });

  it('disables confirm when source and target are the same', async () => {
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-1');
    expect(screen.getByRole('button', { name: /^merge$/i })).toBeDisabled();
  });

  it('calls onConfirm with source and target ids', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<MergeCategoriesDialog open onOpenChange={() => {}} categories={categories} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText(/merge this category/i), 'cat-1');
    await user.selectOptions(screen.getByLabelText(/into this category/i), 'cat-2');
    await user.click(screen.getByRole('button', { name: /^merge$/i }));
    expect(onConfirm).toHaveBeenCalledWith('cat-1', 'cat-2');
  });
});
