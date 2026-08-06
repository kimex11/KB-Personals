'use client';

import { isToday } from 'date-fns';
import type { CalendarDay } from '@/lib/date-utils';
import type { CalendarEvent } from '@/lib/types';

const TYPE_DOT_CLASS: Record<CalendarEvent['type'], string> = {
  bill: 'bg-gold',
  reminder: 'bg-neutral-400',
  task: 'border border-neutral-400',
};

interface DayCellProps {
  day: CalendarDay;
  events: CalendarEvent[];
  isSelected: boolean;
  onSelect: (date: Date) => void;
}

export function DayCell({ day, events, isSelected, onSelect }: DayCellProps) {
  const today = isToday(day.date);
  const uniqueTypes = Array.from(new Set(events.map((e) => e.type)));

  return (
    <button
      type="button"
      data-testid="day-cell"
      onClick={() => onSelect(day.date)}
      aria-pressed={isSelected}
      className={[
        'flex h-11 w-11 flex-col items-center justify-center gap-1 rounded-full text-sm transition-colors',
        day.isCurrentMonth ? 'text-neutral-900' : 'text-neutral-300',
        today ? 'ring-2 ring-gold' : '',
        isSelected ? 'bg-neutral-900 text-white' : '',
      ].join(' ')}
    >
      <span>{day.date.getDate()}</span>
      <span className="flex gap-0.5">
        {uniqueTypes.map((type) => (
          <span key={type} className={`h-1.5 w-1.5 rounded-full ${TYPE_DOT_CLASS[type]}`} />
        ))}
      </span>
    </button>
  );
}
