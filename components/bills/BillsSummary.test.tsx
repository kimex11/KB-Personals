import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillsSummary } from './BillsSummary';

describe('BillsSummary', () => {
  it('shows the monthly total, overdue count, and due-soon count', () => {
    render(<BillsSummary monthlyTotal={2124} overdueCount={2} dueSoonCount={3} />);
    const summary = screen.getByTestId('bills-summary');
    expect(summary).toHaveTextContent('₱2124');
    expect(summary).toHaveTextContent('2');
    expect(summary).toHaveTextContent('3');
  });
});
