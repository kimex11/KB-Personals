import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from './page';

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({
    getEventsForDate: () => [],
  }),
}));

describe('HomePage', () => {
  it('renders the month grid and day detail panel', () => {
    render(<HomePage />);
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
    expect(screen.getByTestId('day-detail-panel')).toBeInTheDocument();
  });

  it('opens a "Coming soon" sheet when the add button is tapped', () => {
    render(<HomePage />);
    fireEvent.click(screen.getByTestId('add-event-button'));
    expect(screen.getByTestId('add-event-sheet')).toHaveTextContent('Coming soon');
  });
});
