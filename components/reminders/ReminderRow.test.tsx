import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderRow } from './ReminderRow';
import type { Reminder } from '@/lib/reminders-types';

const referenceDate = new Date(2026, 7, 15);

const reminder: Reminder = {
  id: '1',
  title: 'Call insurance provider',
  category: 'Finance',
  dueDate: '2026-08-15',
  priority: 'high',
  completed: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

describe('ReminderRow', () => {
  it('shows title, category, and priority badge', () => {
    render(<ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    const row = screen.getByTestId('reminder-row');
    expect(row).toHaveTextContent('Call insurance provider');
    expect(row).toHaveTextContent('Finance');
    expect(row).toHaveTextContent('High');
  });

  it('applies strikethrough styling when completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderRow reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-title').className).toContain('line-through');
  });

  it('calls onToggleComplete with the reminder id when the toggle is clicked', () => {
    const onToggleComplete = vi.fn();
    render(<ReminderRow reminder={reminder} onToggleComplete={onToggleComplete} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-complete-toggle'));
    expect(onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('calls onSnooze with the reminder id when Snooze is clicked', () => {
    const onSnooze = vi.fn();
    render(<ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={onSnooze} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminder-snooze-button'));
    expect(onSnooze).toHaveBeenCalledWith('1');
  });

  it('hides the Snooze button once the reminder is completed', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderRow reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.queryByTestId('reminder-snooze-button')).not.toBeInTheDocument();
  });

  it('colors the left border and card background to match priority: high', () => {
    render(<ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('border-l-status-critical');
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-critical/5');
  });

  it('colors the left border to match priority: low, with a plain white background', () => {
    const low: Reminder = { ...reminder, priority: 'low' };
    render(<ReminderRow reminder={low} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('border-l-neutral-300');
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-white');
  });

  it('tints the card background green once completed, regardless of priority', () => {
    const completed: Reminder = { ...reminder, completed: true };
    render(<ReminderRow reminder={completed} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminder-row')).toHaveClass('bg-status-success/5');
  });

  it('calls onEdit/onDelete via the actions menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <ReminderRow reminder={reminder} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} onEdit={onEdit} onDelete={onDelete} />
    );

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(reminder);

    await user.click(screen.getByRole('button', { name: /actions for call insurance provider/i }));
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith(reminder);
  });
});
