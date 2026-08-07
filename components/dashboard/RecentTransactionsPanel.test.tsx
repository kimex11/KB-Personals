import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentTransactionsPanel } from './RecentTransactionsPanel';
import type { Transaction } from '@/lib/dashboard-types';

const referenceDate = new Date(2026, 7, 15);

describe('RecentTransactionsPanel', () => {
  it('shows an empty state when there are no transactions', () => {
    render(<RecentTransactionsPanel transactions={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No recent transactions.');
  });

  it('renders one row per transaction with title, category, relative date, and amount', () => {
    const transactions: Transaction[] = [
      { id: 't1', title: 'Grab Ride', category: 'Transport', amount: 8.5, date: '2026-08-14' },
    ];
    render(<RecentTransactionsPanel transactions={transactions} referenceDate={referenceDate} />);
    const row = screen.getByTestId('transaction-row');
    expect(row).toHaveTextContent('Grab Ride');
    expect(row).toHaveTextContent('Transport');
    expect(row).toHaveTextContent('Yesterday');
    expect(row).toHaveTextContent('₱8.50');
  });
});
