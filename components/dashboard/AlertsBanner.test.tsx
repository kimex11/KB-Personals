import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertsBanner } from './AlertsBanner';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('AlertsBanner', () => {
  it('renders nothing when there are no overdue bills', () => {
    const { container } = render(<AlertsBanner overdueBills={[]} referenceDate={referenceDate} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per overdue bill with title and days-overdue count', () => {
    const overdueBills: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Rent', date: '2026-08-10', amount: 1450 },
      { id: '2', type: 'bill', title: 'Internet', date: '2026-08-14', amount: 59.99 },
    ];
    render(<AlertsBanner overdueBills={overdueBills} referenceDate={referenceDate} />);
    const rows = screen.getAllByTestId('overdue-bill-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Rent');
    expect(rows[0]).toHaveTextContent('5 days overdue');
    expect(rows[1]).toHaveTextContent('1 day overdue');
  });
});
