import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
});
