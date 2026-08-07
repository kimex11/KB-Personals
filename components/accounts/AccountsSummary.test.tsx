import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccountsSummary } from './AccountsSummary';

describe('AccountsSummary', () => {
  it('shows total dues, total monthly income, and net figure', () => {
    render(<AccountsSummary totalDue={1286.45} totalMonthlyIncome={3650} />);
    const summary = screen.getByTestId('accounts-summary');
    expect(summary).toHaveTextContent('₱1286.45');
    expect(summary).toHaveTextContent('₱3650');
  });

  it('shows the net figure in the success color when income exceeds dues', () => {
    render(<AccountsSummary totalDue={500} totalMonthlyIncome={3000} />);
    expect(screen.getByTestId('accounts-net')).toHaveTextContent('₱2500');
    expect(screen.getByTestId('accounts-net').className).toContain('text-status-success');
  });

  it('shows the net figure in the critical color when dues exceed income', () => {
    render(<AccountsSummary totalDue={4000} totalMonthlyIncome={3000} />);
    expect(screen.getByTestId('accounts-net').className).toContain('text-status-critical');
  });

  it('tints the Net tile background to match its status', () => {
    render(<AccountsSummary totalDue={500} totalMonthlyIncome={3000} />);
    expect(screen.getByTestId('accounts-net').parentElement).toHaveClass('bg-status-success/5');
  });
});
