import type { Priority, Reminder } from '@/lib/reminders-types';
import { PriorityBadge } from './PriorityBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const PRIORITY_ACCENT_BORDER: Record<Priority, string> = {
  high: 'border-l-status-critical',
  medium: 'border-l-status-warning',
  low: 'border-l-neutral-300',
};

const PRIORITY_CARD_BG: Record<Priority, string> = {
  high: 'bg-status-critical/5',
  medium: 'bg-status-warning/5',
  low: 'bg-white',
};

interface ReminderRowProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
}

export function ReminderRow({ reminder, onToggleComplete, onSnooze, referenceDate = new Date(), onEdit, onDelete }: ReminderRowProps) {
  return (
    <div
      data-testid="reminder-row"
      className={`flex items-center justify-between gap-3 rounded-2xl border border-l-4 border-neutral-200 px-4 py-3 ${
        reminder.completed
          ? 'border-l-status-success bg-status-success/5'
          : `${PRIORITY_ACCENT_BORDER[reminder.priority]} ${PRIORITY_CARD_BG[reminder.priority]}`
      }`}
    >
      <button
        type="button"
        data-testid="reminder-complete-toggle"
        aria-label={reminder.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={reminder.completed}
        onClick={() => onToggleComplete(reminder.id)}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
          reminder.completed
            ? 'border-status-success bg-status-success text-white'
            : 'border-neutral-300 text-transparent'
        }`}
      >
        ✓
      </button>
      <div className="flex-1">
        <p
          data-testid="reminder-title"
          className={`text-sm font-medium text-neutral-900 ${reminder.completed ? 'line-through text-neutral-400' : ''}`}
        >
          {reminder.title}
        </p>
        <p className="text-xs text-neutral-500">
          {reminder.category} · {formatRelativeDate(reminder.dueDate, referenceDate)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <PriorityBadge priority={reminder.priority} />
        {!reminder.completed && (
          <button
            type="button"
            data-testid="reminder-snooze-button"
            onClick={() => onSnooze(reminder.id)}
            className="rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium text-neutral-600"
          >
            Snooze
          </button>
        )}
      </div>
      <RowActionsMenu
        label={reminder.title}
        onEdit={onEdit ? () => onEdit(reminder) : undefined}
        onDelete={onDelete ? () => onDelete(reminder) : undefined}
      />
    </div>
  );
}
