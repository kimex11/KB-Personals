import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RemindersListView } from './RemindersListView';
import type { Reminder } from '@/lib/reminders-types';

const referenceDate = new Date(2026, 7, 15); // 2026-08-15

const reminders: Reminder[] = [
  { id: '1', title: 'Call bank', category: 'Finance', dueDate: '2026-08-10', priority: 'high', completed: false, seriesId: null, cycleNumber: null, skipped: false },
  { id: '2', title: 'Renew passport', category: 'Personal', dueDate: '2026-08-15', priority: 'medium', completed: false, seriesId: null, cycleNumber: null, skipped: false },
  { id: '3', title: 'Water plants', category: 'Home', dueDate: '2026-08-20', priority: 'low', completed: false, seriesId: null, cycleNumber: null, skipped: false },
];

describe('RemindersListView', () => {
  it('shows a summary and one row per reminder', () => {
    render(<RemindersListView reminders={reminders} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    expect(screen.getByTestId('reminders-summary')).toBeInTheDocument();
    expect(screen.getAllByTestId('reminder-row')).toHaveLength(3);
  });

  it('filters rows by search query', () => {
    render(<RemindersListView reminders={reminders} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.change(screen.getByTestId('reminders-search-input'), { target: { value: 'passport' } });
    expect(screen.getAllByTestId('reminder-row')).toHaveLength(1);
  });

  it('filters rows by priority chip', () => {
    render(<RemindersListView reminders={reminders} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.click(screen.getByTestId('reminders-filter-high'));
    expect(screen.getAllByTestId('reminder-row')).toHaveLength(1);
  });

  it('shows an empty state when no reminders match the filters', () => {
    render(<RemindersListView reminders={reminders} onToggleComplete={vi.fn()} onSnooze={vi.fn()} referenceDate={referenceDate} />);
    fireEvent.change(screen.getByTestId('reminders-search-input'), { target: { value: 'nonexistent' } });
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No reminders match your filters.');
  });
});
