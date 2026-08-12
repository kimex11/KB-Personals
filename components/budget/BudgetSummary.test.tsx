import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BudgetSummary } from './BudgetSummary';

describe('BudgetSummary', () => {
  it('renders the three totals', () => {
    render(<BudgetSummary budgeted={1000} spent={800} remaining={200} />);
    expect(screen.getByText('₱1,000')).toBeInTheDocument();
    expect(screen.getByText('₱800')).toBeInTheDocument();
    expect(screen.getByText('₱200')).toBeInTheDocument();
  });

  it('renders a negative remaining value in status-critical styling', () => {
    render(<BudgetSummary budgeted={1000} spent={1200} remaining={-200} />);
    const remainingValue = screen.getByText('₱-200');
    expect(remainingValue.className).toContain('text-status-critical');
    expect(remainingValue.parentElement).toHaveClass('bg-status-critical/5');
  });

  it('renders a positive remaining value in status-success tinted styling', () => {
    render(<BudgetSummary budgeted={1000} spent={800} remaining={200} />);
    const remainingValue = screen.getByText('₱200');
    expect(remainingValue.className).toContain('text-status-success');
    expect(remainingValue.parentElement).toHaveClass('bg-status-success/5');
  });

  it('gives the Budgeted tile a gold brand tint', () => {
    render(<BudgetSummary budgeted={1000} spent={800} remaining={200} />);
    expect(screen.getByText('Budgeted').parentElement).toHaveClass('bg-gold/5');
  });
});
