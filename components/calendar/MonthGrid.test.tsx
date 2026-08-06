import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthGrid } from './MonthGrid';

describe('MonthGrid', () => {
  const noEvents = () => [];

  it('renders 42 day cells for a full 6-week grid', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    expect(screen.getAllByTestId('day-cell')).toHaveLength(42);
  });

  it('shows the current visible month label', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    expect(screen.getByText('August 2026')).toBeInTheDocument();
  });

  it('navigates to the next month on next-month click', () => {
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={() => {}} />);
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('calls onSelectDate when a day cell is clicked', () => {
    const onSelectDate = vi.fn();
    render(<MonthGrid getEventsForDate={noEvents} selectedDate={new Date(2026, 7, 6)} onSelectDate={onSelectDate} />);
    fireEvent.click(screen.getAllByTestId('day-cell')[10]);
    expect(onSelectDate).toHaveBeenCalled();
  });
});
