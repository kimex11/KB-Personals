import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillForm } from './BillForm';
import type { Category } from '@/lib/categories-types';

const categories: Category[] = [
  { id: 'cat-1', name: 'Housing', icon: 'building-2', colorSlot: 1, sortOrder: 0, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
  { id: 'cat-2', name: 'Utilities', icon: 'zap', colorSlot: 5, sortOrder: 1, archived: false, createdAt: '2026-08-15T10:00:00.000Z' },
];

const existingBill = { id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' as const, paid: false };

describe('BillForm', () => {
  it('renders empty fields for a new bill, defaulting category to the first option', () => {
    render(<BillForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue('');
    expect(screen.getByLabelText(/^category$/i)).toHaveValue('cat-1');
    expect(screen.getByRole('heading', { name: /add bill/i })).toBeInTheDocument();
  });

  it('pre-fills fields when editing an existing bill', () => {
    render(<BillForm open onOpenChange={() => {}} categories={categories} initialBill={existingBill} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/title/i)).toHaveValue('Rent');
    expect(screen.getByLabelText(/^category$/i)).toHaveValue('cat-1');
    expect(screen.getByLabelText(/amount/i)).toHaveValue(1450);
    expect(screen.getByLabelText(/due date/i)).toHaveValue('2026-08-16');
    expect(screen.getByLabelText(/recurrence/i)).toHaveValue('monthly');
    expect(screen.getByRole('heading', { name: /edit bill/i })).toBeInTheDocument();
  });

  it('disables save until required fields are filled', async () => {
    const user = userEvent.setup();
    render(<BillForm open onOpenChange={() => {}} categories={categories} onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/title/i), 'Rent');
    await user.type(screen.getByLabelText(/amount/i), '1450');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-16');
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the entered values, recurrence defaulting to none', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BillForm open onOpenChange={() => {}} categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), 'Rent');
    await user.type(screen.getByLabelText(/amount/i), '1450');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-16');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: null });
  });

  it('calls onSubmit with the selected category and recurrence', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BillForm open onOpenChange={() => {}} categories={categories} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/title/i), 'Electricity');
    await user.selectOptions(screen.getByLabelText(/^category$/i), 'cat-2');
    await user.selectOptions(screen.getByLabelText(/recurrence/i), 'monthly');
    await user.type(screen.getByLabelText(/amount/i), '84.5');
    await user.type(screen.getByLabelText(/due date/i), '2026-08-20');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSubmit).toHaveBeenCalledWith({ title: 'Electricity', categoryId: 'cat-2', amount: 84.5, dueDate: '2026-08-20', recurrence: 'monthly' });
  });

  it('shows recurring options when Recurring is selected, and includes them on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BillForm open categories={categories} onSubmit={onSubmit} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText(/title/i), 'Netflix');
    await user.type(screen.getByLabelText(/amount/i), '15.99');
    await user.type(screen.getByLabelText(/due date/i), '2026-09-01');
    await user.click(screen.getByLabelText(/recurring/i));
    await user.selectOptions(screen.getByLabelText(/frequency/i), 'monthly');
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Netflix',
        series: expect.objectContaining({ frequency: 'monthly', autoRenew: true }),
      })
    );
  });

  it('shows custom interval fields only when frequency is Custom', async () => {
    const user = userEvent.setup();
    render(<BillForm open categories={categories} onSubmit={vi.fn()} onOpenChange={vi.fn()} />);
    await user.click(screen.getByLabelText(/recurring/i));
    expect(screen.queryByLabelText(/custom interval count/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/frequency/i), 'custom');
    expect(screen.getByLabelText(/custom interval count/i)).toBeInTheDocument();
  });
});
