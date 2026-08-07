import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryForm } from './CategoryForm';
import type { Category } from '@/lib/categories-types';

const existingCategory: Category = {
  id: 'cat-1',
  name: 'Housing',
  icon: 'building-2',
  colorSlot: 1,
  sortOrder: 0,
  archived: false,
  createdAt: '2026-08-15T10:00:00.000Z',
};

describe('CategoryForm', () => {
  it('renders empty fields for a new category', () => {
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue('');
    expect(screen.getByRole('heading', { name: /add category/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing category', () => {
    render(<CategoryForm open onOpenChange={() => {}} initialCategory={existingCategory} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/name/i)).toHaveValue('Housing');
    expect(screen.getByRole('heading', { name: /edit category/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /building 2 icon/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^color 1$/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('disables submit until a name is entered', async () => {
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the name, selected icon, and selected color', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    await user.click(screen.getByRole('button', { name: /paw print icon/i }));
    await user.click(screen.getByRole('button', { name: /^color 9$/i }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'Pet Care', icon: 'paw-print', colorSlot: 9 });
  });

  it('defaults to the first icon and color when adding a new category', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CategoryForm open onOpenChange={() => {}} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/name/i), 'Pet Care');
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Pet Care', icon: 'building-2', colorSlot: 1 });
  });
});
