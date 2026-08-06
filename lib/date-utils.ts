import {
  startOfMonth,
  startOfWeek,
  addDays,
  eachDayOfInterval,
  isSameMonth,
  format,
} from 'date-fns';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

// Always exactly 6 fixed weeks (42 days) so the grid doesn't reflow in
// height when navigating between 4/5/6-week months.
export function getMonthGrid(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = addDays(gridStart, 41);

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
