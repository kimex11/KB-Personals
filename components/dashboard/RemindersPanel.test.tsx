import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemindersPanel } from './RemindersPanel';
import type { CalendarEvent } from '@/lib/types';

const referenceDate = new Date(2026, 7, 15);

describe('RemindersPanel', () => {
  it('shows an empty state when there are no reminders', () => {
    render(<RemindersPanel reminders={[]} referenceDate={referenceDate} />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No upcoming reminders.');
  });

  it('renders one row per reminder with title and relative date', () => {
    const reminders: CalendarEvent[] = [
      { id: 'r1', type: 'reminder', title: 'Call insurance provider', date: '2026-08-16' },
    ];
    render(<RemindersPanel reminders={reminders} referenceDate={referenceDate} />);
    const row = screen.getByTestId('reminder-row');
    expect(row).toHaveTextContent('Call insurance provider');
    expect(row).toHaveTextContent('Tomorrow');
  });
});
