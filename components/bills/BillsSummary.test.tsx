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

  it('gives the This Month tile a gold brand tint', () => {
    render(<BillsSummary monthlyTotal={2124} overdueCount={2} dueSoonCount={3} />);
    expect(screen.getByText('This Month').parentElement).toHaveClass('bg-gold/5');
  });
});
