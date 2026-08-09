import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeries, getSeries, updateSeriesStatus, incrementOccurrencesGenerated } from './recurring-series-repository';

const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const selectEqSingleMock = vi.fn();
const selectMock = vi.fn(() => ({ eq: () => ({ single: selectEqSingleMock }) }));
const updateEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'recurring_series') throw new Error(`Unexpected table: ${table}`);
      return { insert: insertMock, select: selectMock, update: updateMock };
    },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const seriesRow = {
  id: 'series-1',
  entity_type: 'bill',
  frequency: 'monthly',
  custom_interval_unit: null,
  custom_interval_count: null,
  amount_mode: 'fixed',
  auto_renew: true,
  end_date: null,
  max_occurrences: null,
  occurrences_generated: 1,
  status: 'active',
};

const expectedSeries = {
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

describe('createSeries', () => {
  it('inserts a series row and maps it back', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: seriesRow, error: null });
    const result = await createSeries({ entityType: 'bill', frequency: 'monthly' });
    expect(insertMock).toHaveBeenCalledWith({
      entity_type: 'bill',
      frequency: 'monthly',
      custom_interval_unit: null,
      custom_interval_count: null,
      amount_mode: 'fixed',
      auto_renew: true,
      end_date: null,
      max_occurrences: null,
    });
    expect(result).toEqual(expectedSeries);
  });
});

describe('getSeries', () => {
  it('fetches a series by id and maps it back', async () => {
    selectEqSingleMock.mockResolvedValue({ data: seriesRow, error: null });
    const result = await getSeries('series-1');
    expect(result).toEqual(expectedSeries);
  });
});

describe('updateSeriesStatus', () => {
  it('updates the status column', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateSeriesStatus('series-1', 'paused');
    expect(updateMock).toHaveBeenCalledWith({ status: 'paused' });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'series-1');
  });
});

describe('incrementOccurrencesGenerated', () => {
  it('sets occurrences_generated to the given count', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await incrementOccurrencesGenerated('series-1', 2);
    expect(updateMock).toHaveBeenCalledWith({ occurrences_generated: 2 });
  });
});
