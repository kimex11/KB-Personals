import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BillsListView } from './BillsListView';
import type { Bill } from '@/lib/bills-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const bills: Bill[] = [
  { id: '1', title: 'Rent', category: 'Housing', amount: 1450, dueDate: '2026-08-01', recurrence: 'monthly', paid: true },
  { id: '2', title: 'Credit Card', category: 'Shopping', amount: 320, dueDate: '2026-08-10', recurrence: null, paid: false },
  { id: '3', title: 'Electricity', category: 'Utilities', amount: 85, dueDate: '2026-08-16', recurrence: 'monthly', paid: false },
];

describe('BillsListView', () => {
  it('shows a summary and one row per bill grouped by status section', () => {
    render(<BillsListView bills={bills} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('bills-summary')).toBeInTheDocument();
    expect(screen.getAllByTestId('bill-row')).toHaveLength(3);
  });

  it('filters rows by search query', () => {
    render(<BillsListView bills={bills} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.change(screen.getByTestId('bills-search-input'), { target: { value: 'electric' } });
    expect(screen.getAllByTestId('bill-row')).toHaveLength(1);
  });

  it('filters rows by status chip', () => {
    render(<BillsListView bills={bills} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('bills-filter-overdue'));
    expect(screen.getAllByTestId('bill-row')).toHaveLength(1);
  });

  it('shows an empty state when no bills match the filters', () => {
    render(<BillsListView bills={bills} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.change(screen.getByTestId('bills-search-input'), { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No bills match your filters.');
  });

  it('shows a duplicate warning on bills that look like duplicates', () => {
    const withDuplicate: Bill[] = [
      ...bills,
      { id: '4', title: 'Electricity', category: 'Utilities', amount: 85, dueDate: '2026-08-17', recurrence: null, paid: false },
    ];
    render(<BillsListView bills={withDuplicate} onTogglePaid={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getAllByTestId('bill-duplicate-warning')).toHaveLength(2);
  });

  it('passes onEdit/onDelete through to each row', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<BillsListView bills={bills} onTogglePaid={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />);
    await user.click(screen.getAllByRole('button', { name: /^actions for /i })[0]);
    await user.click(await screen.findByRole('menuitem', { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalled();
  });
});
