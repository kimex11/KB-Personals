import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpenseTrackerSummary } from './ExpenseTrackerSummary';

describe('ExpenseTrackerSummary', () => {
  it('shows the total spent and number of expenses logged', () => {
    render(<ExpenseTrackerSummary total={1800} count={12} />);
    expect(screen.getByTestId('expense-tracker-summary')).toHaveTextContent('₱1,800.00');
    expect(screen.getByTestId('expense-tracker-summary')).toHaveTextContent('12');
  });

  it('shows a zero-state message when there are no expenses logged yet', () => {
    render(<ExpenseTrackerSummary total={0} count={0} />);
    expect(screen.getByTestId('expense-tracker-summary')).toHaveTextContent('No expenses logged yet');
  });

  it('links to the Expenses tab', () => {
    render(<ExpenseTrackerSummary total={1000} count={3} />);
    expect(screen.getByRole('link', { name: 'View Expenses' })).toHaveAttribute('href', '/budget');
  });
});
