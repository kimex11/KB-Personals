import type { CalendarEvent } from '@/lib/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';

interface RemindersPanelProps {
  reminders: CalendarEvent[];
  referenceDate?: Date;
}

export function RemindersPanel({ reminders, referenceDate = new Date() }: RemindersPanelProps) {
  return (
    <div data-testid="reminders-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">Reminders</h2>
      {reminders.length === 0 ? (
        <EmptyState message="No upcoming reminders." />
      ) : (
        <div className="flex flex-col gap-2">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              data-testid="reminder-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <span className="text-sm font-medium text-neutral-900">{reminder.title}</span>
              <span className="text-xs text-neutral-500">{formatRelativeDate(reminder.date, referenceDate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
