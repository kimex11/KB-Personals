import { format } from 'date-fns';
import { EventCard } from './EventCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { CalendarEvent } from '@/lib/types';

interface DayDetailPanelProps {
  date: Date;
  events: CalendarEvent[];
}

export function DayDetailPanel({ date, events }: DayDetailPanelProps) {
  return (
    <div data-testid="day-detail-panel" className="mt-6 flex flex-col gap-2">
      <p className="text-sm font-medium text-neutral-500">{format(date, 'EEEE, MMMM d')}</p>
      {events.length === 0 ? (
        <EmptyState message="Nothing scheduled" />
      ) : (
        events.map((event) => <EventCard key={event.id} event={event} />)
      )}
    </div>
  );
}
