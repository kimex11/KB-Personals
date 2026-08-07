import { MonthGrid } from '@/components/calendar/MonthGrid';
import { DayDetailPanel } from '@/components/calendar/DayDetailPanel';
import { TYPE_LABEL, TYPE_DOT_CLASS } from '@/lib/event-style';
import type { CalendarEvent, EventType } from '@/lib/types';

const LEGEND_TYPES: EventType[] = ['bill', 'reminder', 'task'];

interface DashboardCalendarCardProps {
  getEventsForDate: (date: Date) => CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function DashboardCalendarCard({ getEventsForDate, selectedDate, onSelectDate }: DashboardCalendarCardProps) {
  return (
    <div
      data-testid="dashboard-calendar-card"
      className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-neutral-900">Calendar</h2>
        <div data-testid="calendar-legend" className="flex items-center gap-3">
          {LEGEND_TYPES.map((type) => (
            <span key={type} className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={`h-2 w-2 rounded-full ${TYPE_DOT_CLASS[type]}`} aria-hidden="true" />
              {TYPE_LABEL[type]}
            </span>
          ))}
        </div>
      </div>
      <MonthGrid getEventsForDate={getEventsForDate} selectedDate={selectedDate} onSelectDate={onSelectDate} />
      <DayDetailPanel date={selectedDate} events={getEventsForDate(selectedDate)} />
    </div>
  );
}
