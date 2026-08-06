import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
} from 'date-fns';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

export function getMonthGrid(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, monthDate),
  }));
}

export function formatMonthLabel(date: Date): string {
  return format(date, 'MMMM yyyy');
}

export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
