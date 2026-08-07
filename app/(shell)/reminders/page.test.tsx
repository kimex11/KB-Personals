import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RemindersPage from './page';

describe('RemindersPage', () => {
  it('renders the reminders list view', () => {
    render(<RemindersPage />);
    expect(screen.getByTestId('reminders-list-view')).toBeInTheDocument();
    expect(screen.getAllByTestId('reminder-row').length).toBeGreaterThan(0);
  });

  it('marks a reminder as complete when its toggle is clicked', () => {
    render(<RemindersPage />);
    const completeCountBefore = screen
      .getAllByTestId('reminder-complete-toggle')
      .filter((el) => el.getAttribute('aria-pressed') === 'false').length;

    const firstIncomplete = screen
      .getAllByTestId('reminder-complete-toggle')
      .find((el) => el.getAttribute('aria-pressed') === 'false')!;
    fireEvent.click(firstIncomplete);

    const completeCountAfter = screen
      .getAllByTestId('reminder-complete-toggle')
      .filter((el) => el.getAttribute('aria-pressed') === 'false').length;
    expect(completeCountAfter).toBe(completeCountBefore - 1);
  });

  it('renders a snooze button on incomplete reminders', () => {
    render(<RemindersPage />);
    expect(screen.getAllByTestId('reminder-snooze-button').length).toBeGreaterThan(0);
  });
});
