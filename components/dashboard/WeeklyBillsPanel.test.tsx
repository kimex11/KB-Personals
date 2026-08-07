import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyBillsPanel } from './WeeklyBillsPanel';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('WeeklyBillsPanel', () => {
  it('shows an empty state when there are no bills due this week', () => {
    render(<WeeklyBillsPanel bills={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No bills due this week.');
  });

  it('renders one row per bill with title, relative date, and amount', () => {
    const bills: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Internet Bill', date: '2026-08-15', amount: 59.99 },
    ];
    render(<WeeklyBillsPanel bills={bills} referenceDate={referenceDate} />);
    const row = screen.getByTestId('weekly-bill-row');
    expect(row).toHaveTextContent('Internet Bill');
    expect(row).toHaveTextContent('Today');
    expect(row).toHaveTextContent('₱59.99');
  });

  it('replaces the Mark as Paid button with "Coming soon" when clicked', () => {
    const bills: CalendarEvent[] = [{ id: '1', type: 'bill', title: 'Rent', date: '2026-08-15', amount: 1450 }];
    render(<WeeklyBillsPanel bills={bills} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('mark-paid-button'));
    expect(screen.queryByTestId('mark-paid-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('weekly-bill-row')).toHaveTextContent('Coming soon');
  });
});
