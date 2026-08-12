import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertsBanner } from './AlertsBanner';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

const overdueBills: CalendarEvent[] = [
  { id: '1', type: 'bill', title: 'Rent', date: '2026-08-10', amount: 1450 },
  { id: '2', type: 'bill', title: 'Internet', date: '2026-08-14', amount: 59.99 },
];

describe('AlertsBanner', () => {
  it('renders nothing when there are no overdue bills', () => {
    const { container } = render(<AlertsBanner overdueBills={[]} referenceDate={referenceDate} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('collapses to a compact summary by default, showing count and total instead of every row', () => {
    render(<AlertsBanner overdueBills={overdueBills} referenceDate={referenceDate} />);
    expect(screen.getByTestId('alerts-banner-toggle')).toHaveTextContent('2 overdue');
    expect(screen.getByTestId('alerts-banner-toggle')).toHaveTextContent('1,509.99');
    expect(screen.queryByTestId('overdue-bill-row')).not.toBeInTheDocument();
  });

  it('expands to show one row per overdue bill with title and days-overdue count', async () => {
    const user = userEvent.setup();
    render(<AlertsBanner overdueBills={overdueBills} referenceDate={referenceDate} />);

    await user.click(screen.getByTestId('alerts-banner-toggle'));

    const rows = screen.getAllByTestId('overdue-bill-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Rent');
    expect(rows[0]).toHaveTextContent('5 days overdue');
    expect(rows[1]).toHaveTextContent('1 day overdue');
  });

  it('collapses again on a second click', async () => {
    const user = userEvent.setup();
    render(<AlertsBanner overdueBills={overdueBills} referenceDate={referenceDate} />);

    await user.click(screen.getByTestId('alerts-banner-toggle'));
    expect(screen.getAllByTestId('overdue-bill-row')).toHaveLength(2);

    await user.click(screen.getByTestId('alerts-banner-toggle'));
    expect(screen.queryByTestId('overdue-bill-row')).not.toBeInTheDocument();
  });
});
