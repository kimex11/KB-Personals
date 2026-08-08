import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillRow } from './BillRow';
import type { Bill } from '@/lib/bills-types';

const referenceDate = new Date(2026, 7, 15);

const bill: Bill = {
  id: '1',
  title: 'Internet Bill',
  category: 'Utilities',
  amount: 59.99,
  dueDate: '2026-08-15',
  recurrence: 'monthly',
  paid: false,
};

describe('BillRow', () => {
  it('shows title, category, amount, and recurrence badge', () => {
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    const row = screen.getByTestId('bill-row');
    expect(row).toHaveTextContent('Internet Bill');
    expect(row).toHaveTextContent('Utilities');
    expect(row).toHaveTextContent('₱59.99');
    expect(row).toHaveTextContent('Monthly');
  });

  it('does not show a recurrence badge for a non-recurring bill', () => {
    const oneOff: Bill = { ...bill, recurrence: null };
    render(<BillRow bill={oneOff} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).not.toHaveTextContent('Monthly');
  });

  it('calls onTogglePaid with the bill id when the toggle is clicked', () => {
    const onTogglePaid = vi.fn();
    render(<BillRow bill={bill} onTogglePaid={onTogglePaid} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('bill-paid-toggle'));
    expect(onTogglePaid).toHaveBeenCalledWith('1');
  });

  it('shows the paid toggle as pressed when the bill is paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillRow bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-paid-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a possible-duplicate warning when isDuplicate is true', () => {
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} isDuplicate />);
    expect(screen.getByTestId('bill-duplicate-warning')).toHaveTextContent('Possible duplicate');
  });

  it('does not show a duplicate warning by default', () => {
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('bill-duplicate-warning')).not.toBeInTheDocument();
  });

  it('colors the amount, left border, and card background to match status: overdue', () => {
    const overdue: Bill = { ...bill, dueDate: '2026-08-01' };
    render(<BillRow bill={overdue} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('bill-row')).toHaveClass('border-l-status-critical');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-critical/5');
  });

  it('colors the amount, left border, and card background to match status: paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillRow bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-success');
    expect(screen.getByTestId('bill-row')).toHaveClass('border-l-status-success');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-success/5');
  });

  it('keeps a plain white background for a bill that is merely upcoming', () => {
    const upcoming: Bill = { ...bill, dueDate: '2026-09-01' };
    render(<BillRow bill={upcoming} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-white');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for internet bill/i })).not.toBeInTheDocument();
  });

  it('hides Edit/Delete until the actions menu is opened', () => {
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /actions for internet bill/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<BillRow bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(bill);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(bill);
  });
});
