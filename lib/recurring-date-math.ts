import { addDays, addWeeks, addMonths } from 'date-fns';
import { toISODateString } from './date-utils';
import type { Frequency, CustomIntervalUnit } from './recurring-types';

export function addInterval(
  dueDate: string,
  frequency: Frequency,
  customIntervalUnit?: CustomIntervalUnit | null,
  customIntervalCount?: number | null
): string {
  const date = new Date(`${dueDate}T00:00:00`);

  switch (frequency) {
    case 'daily':
      return toISODateString(addDays(date, 1));
    case 'weekly':
      return toISODateString(addDays(date, 7));
    case 'biweekly':
      return toISODateString(addDays(date, 14));
    case 'monthly':
      return toISODateString(addMonths(date, 1));
    case 'quarterly':
      return toISODateString(addMonths(date, 3));
    case 'semi_annual':
      return toISODateString(addMonths(date, 6));
    case 'annual':
      return toISODateString(addMonths(date, 12));
    case 'custom': {
      if (!customIntervalUnit || !customIntervalCount) {
        throw new Error('custom frequency requires customIntervalUnit and customIntervalCount');
      }
      if (customIntervalUnit === 'day') return toISODateString(addDays(date, customIntervalCount));
      if (customIntervalUnit === 'week') return toISODateString(addWeeks(date, customIntervalCount));
      return toISODateString(addMonths(date, customIntervalCount));
    }
  }
}
