import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayDetailPanel } from './DayDetailPanel';
import type { CalendarEvent } from '@/lib/types';

describe('DayDetailPanel', () => {
  it('shows an empty state when there are no events', () => {
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={[]} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('Nothing scheduled');
  });

  it('lists each event as a card', () => {
    const events: CalendarEvent[] = [
      { id: '1', type: 'bill', title: 'Rent', date: '2026-08-10', amount: 1450 },
      { id: '2', type: 'task', title: 'Budget review', date: '2026-08-10' },
    ];
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={events} />);
    expect(screen.getAllByTestId('event-card')).toHaveLength(2);
  });

  it('shows the formatted date heading', () => {
    render(<DayDetailPanel date={new Date(2026, 7, 10)} events={[]} />);
    expect(screen.getByText('Monday, August 10')).toBeInTheDocument();
  });
});
