import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExpensesSummary } from './ExpensesSummary';

describe('ExpensesSummary', () => {
  it('shows the total spent and the number of expenses', () => {
    render(<ExpensesSummary total={12450} count={7} />);
    expect(screen.getByTestId('expenses-summary-total')).toHaveTextContent('12,450.00');
    expect(screen.getByTestId('expenses-summary-count')).toHaveTextContent('7');
  });
});
