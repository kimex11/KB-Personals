import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemindersSummary } from './RemindersSummary';

describe('RemindersSummary', () => {
  it('shows the due-today and overdue counts', () => {
    render(<RemindersSummary dueTodayCount={2} overdueCount={1} />);
    const summary = screen.getByTestId('reminders-summary');
    expect(summary).toHaveTextContent('2');
    expect(summary).toHaveTextContent('1');
  });
});
