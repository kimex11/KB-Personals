import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from './page';
import type { CalendarEvent } from '@/lib/types';

const mockEvents: CalendarEvent[] = [
  { id: 'overdue-1', type: 'bill', title: 'Overdue Rent', date: '2026-08-01', amount: 1450 },
  { id: 'due-1', type: 'bill', title: 'Internet Bill', date: '2026-08-15', amount: 59.99 },
  { id: 'reminder-1', type: 'reminder', title: 'Call insurance provider', date: '2026-08-16' },
];

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({ events: mockEvents, getEventsForDate: () => [] }),
}));

vi.mock('@/lib/use-budget', () => ({
  useBudget: () => ({
    categories: [],
    totals: { budgeted: 3000, spent: 1800, remaining: 1200 },
  }),
}));

describe('HomePage', () => {
  it('renders the alerts banner when there are overdue bills', () => {
    render(<HomePage />);
    expect(screen.getByTestId('alerts-banner')).toBeInTheDocument();
  });

  it('renders the weekly bills panel, spending snapshot, transactions, reminders, goal, and quick actions', () => {
    render(<HomePage />);
    expect(screen.getByTestId('weekly-bills-panel')).toBeInTheDocument();
    expect(screen.getByTestId('spending-snapshot')).toBeInTheDocument();
    expect(screen.getByTestId('recent-transactions-panel')).toBeInTheDocument();
    expect(screen.getByTestId('reminders-panel')).toBeInTheDocument();
    expect(screen.getByTestId('goal-progress-panel')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions-row')).toBeInTheDocument();
  });

  it('does not render the calendar month grid', () => {
    render(<HomePage />);
    expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument();
  });
});
