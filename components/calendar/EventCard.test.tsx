import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCard } from './EventCard';
import type { CalendarEvent } from '@/lib/types';

const billEvent: CalendarEvent = {
  id: '1',
  type: 'bill',
  title: 'Electricity Bill',
  date: '2026-08-08',
  time: '9:00 AM',
  amount: 84.5,
};

const taskEvent: CalendarEvent = {
  id: '2',
  type: 'task',
  title: 'Review budget',
  date: '2026-08-08',
};

describe('EventCard', () => {
  it('renders a bill with its formatted amount', () => {
    render(<EventCard event={billEvent} />);
    expect(screen.getByText('Electricity Bill')).toBeInTheDocument();
    expect(screen.getByText('$84.50')).toBeInTheDocument();
    expect(screen.getByText('Bill · 9:00 AM')).toBeInTheDocument();
  });

  it('renders a task without an amount', () => {
    render(<EventCard event={taskEvent} />);
    expect(screen.getByText('Review budget')).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
});
