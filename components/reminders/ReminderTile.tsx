import type { Priority, Reminder } from '@/lib/reminders-types';
import { PriorityBadge } from './PriorityBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const PRIORITY_TINT: Record<Priority, string> = {
  high: 'bg-status-critical/10',
  medium: 'bg-status-warning/10',
  low: 'bg-neutral-100',
};

interface ReminderTileProps {
  reminder: Reminder;
  onToggleComplete: (id: string) => void;
  onSnooze: (id: string) => void;
  referenceDate?: Date;
  onEdit?: (reminder: Reminder) => void;
  onDelete?: (reminder: Reminder) => void;
  onSkip?: (reminder: Reminder) => void;
}

export function ReminderTile({ reminder, onToggleComplete, onSnooze, referenceDate = new Date(), onEdit, onDelete, onSkip }: ReminderTileProps) {
  return (
    <div
      data-testid="reminder-row"
      className={`flex flex-col gap-2 rounded-2xl p-4 ${reminder.completed ? 'bg-status-success/10' : PRIORITY_TINT[reminder.priority]}`}
    >
      <div className="flex items-center justify-between">
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
        <RowActionsMenu
          label={reminder.title}
          onEdit={onEdit ? () => onEdit(reminder) : undefined}
          onDelete={onDelete ? () => onDelete(reminder) : undefined}
          onSkip={onSkip && reminder.seriesId && !reminder.completed ? () => onSkip(reminder) : undefined}
        />
      </div>
      <div>
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
      <div className="flex items-center justify-between">
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
    </div>
  );
}
