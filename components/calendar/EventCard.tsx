import type { CalendarEvent } from '@/lib/types';

const TYPE_LABEL: Record<CalendarEvent['type'], string> = {
  bill: 'Bill',
  reminder: 'Reminder',
  task: 'Task',
};

const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  bill: 'bg-gold',
  reminder: 'bg-neutral-400',
  task: 'border border-neutral-400 bg-transparent',
};

export function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div
      data-testid="event-card"
      className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${TYPE_DOT_CLASS[event.type]}`} aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-neutral-900">{event.title}</p>
          <p className="text-xs text-neutral-500">
            {TYPE_LABEL[event.type]}
            {event.time ? ` · ${event.time}` : ''}
          </p>
        </div>
      </div>
      {event.amount !== undefined && (
        <span className="font-serif text-sm text-neutral-900">${event.amount.toFixed(2)}</span>
      )}
    </div>
  );
}
