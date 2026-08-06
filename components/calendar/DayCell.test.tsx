import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayCell } from './DayCell';
import type { CalendarEvent } from '@/lib/types';

const day = { date: new Date(2026, 7, 10), isCurrentMonth: true };
const events: CalendarEvent[] = [{ id: '1', type: 'bill', title: 'Bill', date: '2026-08-10', amount: 10 }];

describe('DayCell', () => {
  it('renders the day number', () => {
    render(<DayCell day={day} events={events} isSelected={false} onSelect={() => {}} />);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onSelect with the day date when clicked', () => {
    const onSelect = vi.fn();
    render(<DayCell day={day} events={[]} isSelected={false} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId('day-cell'));
    expect(onSelect).toHaveBeenCalledWith(day.date);
  });

  it('marks itself pressed when selected', () => {
    render(<DayCell day={day} events={[]} isSelected onSelect={() => {}} />);
    expect(screen.getByTestId('day-cell')).toHaveAttribute('aria-pressed', 'true');
  });
});
