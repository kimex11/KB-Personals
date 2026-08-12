import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillTile } from './BillTile';
import type { Bill } from '@/lib/bills-types';

const referenceDate = new Date(2026, 7, 15);

const bill: Bill = {
  id: '1',
  title: 'Internet Bill',
  category: 'Utilities',
  categoryColorSlot: 5,
  amount: 59.99,
  dueDate: '2026-08-15',
  recurrence: 'monthly',
  paid: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

describe('BillTile', () => {
  it('shows title, category, amount, and recurrence badge', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    const tile = screen.getByTestId('bill-row');
    expect(tile).toHaveTextContent('Internet Bill');
    expect(tile).toHaveTextContent('Utilities');
    expect(tile).toHaveTextContent('₱59.99');
    expect(tile).toHaveTextContent('Monthly');
  });

  it("shows a dot in the bill's category color", () => {
    const { container } = render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(container.querySelector('.bg-budget-5')).toBeInTheDocument();
  });

  it('omits the category dot when the bill has no category color', () => {
    const noColor: Bill = { ...bill, categoryColorSlot: undefined };
    const { container } = render(<BillTile bill={noColor} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(container.querySelector('[class*="bg-budget-"]')).not.toBeInTheDocument();
  });

  it('does not show a recurrence badge for a non-recurring bill', () => {
    const oneOff: Bill = { ...bill, recurrence: null };
    render(<BillTile bill={oneOff} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).not.toHaveTextContent('Monthly');
  });

  it('calls onTogglePaid with the bill id when the toggle is clicked', () => {
    const onTogglePaid = vi.fn();
    render(<BillTile bill={bill} onTogglePaid={onTogglePaid} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('bill-paid-toggle'));
    expect(onTogglePaid).toHaveBeenCalledWith('1');
  });

  it('shows the paid toggle as pressed when the bill is paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillTile bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-paid-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows a possible-duplicate warning when isDuplicate is true', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} isDuplicate />);
    expect(screen.getByTestId('bill-duplicate-warning')).toHaveTextContent('Possible duplicate');
  });

  it('does not show a duplicate warning by default', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('bill-duplicate-warning')).not.toBeInTheDocument();
  });

  it('tints the amount and card background to match status: overdue', () => {
    const overdue: Bill = { ...bill, dueDate: '2026-08-01' };
    render(<BillTile bill={overdue} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-critical');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-critical/10');
  });

  it('tints the amount and card background to match status: paid', () => {
    const paidBill: Bill = { ...bill, paid: true };
    render(<BillTile bill={paidBill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-amount')).toHaveClass('text-status-success');
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-status-success/10');
  });

  it('uses a neutral gray background for a bill that is merely upcoming', () => {
    const upcoming: Bill = { ...bill, dueDate: '2026-09-01' };
    render(<BillTile bill={upcoming} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bill-row')).toHaveClass('bg-neutral-100');
  });

  it('does not render an actions menu when no handlers are given', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByRole('button', { name: /actions for internet bill/i })).not.toBeInTheDocument();
  });

  it('hides Edit/Delete until the actions menu is opened', () => {
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /actions for internet bill/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<BillTile bill={bill} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(bill);

    await user.click(screen.getByRole('button', { name: /actions for internet bill/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(bill);
  });
});
