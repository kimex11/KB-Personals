import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpensesDonutChart } from './ExpensesDonutChart';
import type { Expense } from '@/lib/expenses-repository';

const expenses: Expense[] = [
  { id: 'exp-1', categoryId: 'cat-1', category: 'Groceries', categoryColorSlot: 2, amount: 850, date: '2026-08-12', description: 'Weekly run', paymentMethod: 'Cash' },
  { id: 'exp-2', categoryId: 'cat-2', category: 'Transport', categoryColorSlot: 3, amount: 600, date: '2026-08-11', description: 'Gas', paymentMethod: null },
];

describe('ExpensesDonutChart', () => {
  it('renders one slice and one legend row per category', () => {
    render(<ExpensesDonutChart expenses={expenses} />);
    expect(screen.getAllByTestId('donut-slice')).toHaveLength(2);
    expect(screen.getAllByTestId('legend-row')).toHaveLength(2);
  });

  it('shows the category name and total in the legend', () => {
    render(<ExpensesDonutChart expenses={expenses} />);
    const rows = screen.getAllByTestId('legend-row');
    expect(rows[0]).toHaveTextContent('Groceries');
    expect(rows[0]).toHaveTextContent('850');
    expect(rows[1]).toHaveTextContent('Transport');
    expect(rows[1]).toHaveTextContent('600');
  });

  it('renders nothing when there are no expenses', () => {
    render(<ExpensesDonutChart expenses={[]} />);
    expect(screen.queryByTestId('expenses-donut-chart')).not.toBeInTheDocument();
  });
});
