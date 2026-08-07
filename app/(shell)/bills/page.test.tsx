import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BillsPage from './page';

vi.mock('@/lib/use-calendar-events', () => ({
  useCalendarEvents: () => ({ events: [], getEventsForDate: () => [] }),
}));

describe('BillsPage', () => {
  it('shows the list view by default', () => {
    render(<BillsPage />);
    expect(screen.getByTestId('bills-list-view')).toBeInTheDocument();
  });

  it('switches to the calendar view when the Calendar toggle is clicked', () => {
    render(<BillsPage />);
    fireEvent.click(screen.getByTestId('bills-view-calendar'));
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('bills-list-view')).not.toBeInTheDocument();
  });

  it('switches back to the list view when the List toggle is clicked', () => {
    render(<BillsPage />);
    fireEvent.click(screen.getByTestId('bills-view-calendar'));
    fireEvent.click(screen.getByTestId('bills-view-list'));
    expect(screen.getByTestId('bills-list-view')).toBeInTheDocument();
  });

  it('marks a bill as paid when its toggle is clicked', () => {
    render(<BillsPage />);
    const unpaidCountBefore = screen
      .getAllByTestId('bill-paid-toggle')
      .filter((el) => el.getAttribute('aria-pressed') === 'false').length;

    const firstUnpaid = screen
      .getAllByTestId('bill-paid-toggle')
      .find((el) => el.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(firstUnpaid);

    const unpaidCountAfter = screen
      .getAllByTestId('bill-paid-toggle')
      .filter((el) => el.getAttribute('aria-pressed') === 'false').length;
    expect(unpaidCountAfter).toBe(unpaidCountBefore - 1);
  });
});
