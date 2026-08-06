'use client';

import { useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthGrid, formatMonthLabel, toISODateString } from '@/lib/date-utils';
import { DayCell } from './DayCell';
import type { CalendarEvent } from '@/lib/types';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface MonthGridProps {
  getEventsForDate: (date: Date) => CalendarEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function MonthGrid({ getEventsForDate, selectedDate, onSelectDate }: MonthGridProps) {
  const [visibleMonth, setVisibleMonth] = useState(selectedDate);
  const days = getMonthGrid(visibleMonth);

  return (
    <div data-testid="month-grid">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ChevronLeft className="h-5 w-5 text-neutral-500" />
        </button>
        <p className="font-serif text-lg text-neutral-900">{formatMonthLabel(visibleMonth)}</p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full"
        >
          <ChevronRight className="h-5 w-5 text-neutral-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-2 text-center text-xs text-neutral-400">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={`${label}-${i}`}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-2">
        {days.map((day) => (
          <DayCell
            key={toISODateString(day.date)}
            day={day}
            events={getEventsForDate(day.date)}
            isSelected={toISODateString(day.date) === toISODateString(selectedDate)}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
