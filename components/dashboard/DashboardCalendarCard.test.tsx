import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardCalendarCard } from './DashboardCalendarCard';
import type { CalendarEvent } from '@/lib/types';

const events: CalendarEvent[] = [
  { id: '1', type: 'bill', title: 'Rent', date: '2026-08-01', amount: 1450 },
];

describe('DashboardCalendarCard', () => {
  it('renders the month grid, day detail panel, and a legend for every event type', () => {
    render(
      <DashboardCalendarCard
        getEventsForDate={() => events}
        selectedDate={new Date(2026, 7, 1)}
        onSelectDate={() => {}}
      />
    );
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
    expect(screen.getByTestId('day-detail-panel')).toBeInTheDocument();
    const legend = screen.getByTestId('calendar-legend');
    expect(legend).toHaveTextContent('Bill');
    expect(legend).toHaveTextContent('Reminder');
    expect(legend).toHaveTextContent('Task');
  });

  it('shows a heading above the calendar', () => {
    render(
      <DashboardCalendarCard getEventsForDate={() => []} selectedDate={new Date(2026, 7, 1)} onSelectDate={() => {}} />
    );
    expect(screen.getByTestId('dashboard-calendar-card')).toHaveTextContent('Calendar');
  });
});
