import { addInterval } from './recurring-date-math';
import type { RecurringSeries } from './recurring-types';

export interface ClosedCycleRow {
  dueDate: string;
  cycleNumber: number;
}

export interface NewCycleInput {
  dueDate: string;
  cycleNumber: number;
}

export function computeNextOccurrence(closedRow: ClosedCycleRow, series: RecurringSeries): NewCycleInput | null {
  if (series.status !== 'active') return null;

  const nextDueDate = addInterval(closedRow.dueDate, series.frequency, series.customIntervalUnit, series.customIntervalCount);

  if (!series.autoRenew) {
    if (series.endDate && nextDueDate > series.endDate) return null;
    if (series.maxOccurrences !== null && series.occurrencesGenerated >= series.maxOccurrences) return null;
  }

  return { dueDate: nextDueDate, cycleNumber: closedRow.cycleNumber + 1 };
}
