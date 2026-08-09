import { describe, expect, it } from 'vitest';
import { computeNextOccurrence } from './recurring-generation';
import type { RecurringSeries } from './recurring-types';

const baseSeries: RecurringSeries = {
  id: 'series-1',
  entityType: 'bill',
  frequency: 'monthly',
  customIntervalUnit: null,
  customIntervalCount: null,
  amountMode: 'fixed',
  autoRenew: true,
  endDate: null,
  maxOccurrences: null,
  occurrencesGenerated: 1,
  status: 'active',
};

describe('computeNextOccurrence', () => {
  it('computes the next cycle for an active, auto-renewing series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, baseSeries);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('returns null for a paused series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, { ...baseSeries, status: 'paused' });
    expect(result).toBeNull();
  });

  it('returns null for a stopped series', () => {
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, { ...baseSeries, status: 'stopped' });
    expect(result).toBeNull();
  });

  it('stops once the computed next date passes end_date when auto_renew is false', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, endDate: '2026-08-15' };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toBeNull();
  });

  it('still generates when the next date is exactly on end_date', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, endDate: '2026-09-01' };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('stops once max_occurrences is reached when auto_renew is false', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, maxOccurrences: 1, occurrencesGenerated: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toBeNull();
  });

  it('generates when occurrences_generated is still below max_occurrences', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: false, maxOccurrences: 3, occurrencesGenerated: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });

  it('ignores end_date/max_occurrences entirely when auto_renew is true', () => {
    const series: RecurringSeries = { ...baseSeries, autoRenew: true, endDate: '2026-08-02', maxOccurrences: 1 };
    const result = computeNextOccurrence({ dueDate: '2026-08-01', cycleNumber: 1 }, series);
    expect(result).toEqual({ dueDate: '2026-09-01', cycleNumber: 2 });
  });
});
