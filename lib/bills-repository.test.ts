import { afterEach, describe, expect, it, vi } from 'vitest';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import { createSeries, getSeries, incrementOccurrencesGenerated } from './recurring-series-repository';

const selectOrderMock = vi.fn();
const selectEqSingleMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const updateEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const deleteEqMock = vi.fn();
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'bills') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: selectOrderMock, eq: () => ({ single: selectEqSingleMock }) }),
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      };
    },
  }),
}));

vi.mock('./recurring-series-repository', () => ({
  createSeries: vi.fn(),
  getSeries: vi.fn(),
  incrementOccurrencesGenerated: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const billRow = {
  id: 'bill-1',
  title: 'Rent',
  category_id: 'cat-1',
  amount: 1450,
  due_date: '2026-08-16',
  recurrence: 'monthly',
  paid: true,
  created_at: '2026-08-15T10:00:00.000Z',
  categories: { name: 'Housing', color_slot: 1 },
  series_id: null,
  cycle_number: null,
  skipped: false,
};

describe('listBills', () => {
  it('returns bills joined with their category name, ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [billRow], error: null });
    const result = await listBills();
    expect(result).toEqual([
      {
        id: 'bill-1',
        title: 'Rent',
        category: 'Housing',
        categoryColorSlot: 1,
        categoryId: 'cat-1',
        amount: 1450,
        dueDate: '2026-08-16',
        recurrence: 'monthly',
        paid: true,
        seriesId: null,
        cycleNumber: null,
        skipped: false,
      },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('due_date', { ascending: true });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listBills()).rejects.toThrow('boom');
  });
});

describe('createBill', () => {
  it('inserts a new bill row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: billRow, error: null });
    const result = await createBill({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' });
    expect(insertMock).toHaveBeenCalledWith({
      title: 'Rent',
      category_id: 'cat-1',
      amount: 1450,
      due_date: '2026-08-16',
      recurrence: 'monthly',
    });
    expect(result).toEqual({
      id: 'bill-1',
      title: 'Rent',
      category: 'Housing',
      categoryColorSlot: 1,
      categoryId: 'cat-1',
      amount: 1450,
      dueDate: '2026-08-16',
      recurrence: 'monthly',
      paid: true,
      seriesId: null,
      cycleNumber: null,
      skipped: false,
    });
  });
});

describe('updateBill', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateBill('bill-1', { paid: true });
    expect(updateMock).toHaveBeenCalledWith({ paid: true });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'bill-1');
  });

  it('maps categoryId to category_id and dueDate to due_date', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateBill('bill-1', { categoryId: 'cat-2', dueDate: '2026-09-01' });
    expect(updateMock).toHaveBeenCalledWith({ category_id: 'cat-2', due_date: '2026-09-01' });
  });

  it('throws on error', async () => {
    updateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateBill('bill-1', { paid: true })).rejects.toThrow('boom');
  });
});

describe('deleteBill', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteBill('bill-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'bill-1');
  });
});

describe('createRecurringBill', () => {
  it('creates the series, then the first bill row with cycle_number 1', async () => {
    vi.mocked(createSeries).mockResolvedValue({
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
    });
    insertSelectSingleMock.mockResolvedValue({
      data: { ...billRow, series_id: 'series-1', cycle_number: 1 },
      error: null,
    });

    const result = await createRecurringBill(
      { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
      { frequency: 'monthly' }
    );

    expect(createSeries).toHaveBeenCalledWith({ frequency: 'monthly', entityType: 'bill' });
    expect(insertMock).toHaveBeenCalledWith({
      title: 'Rent',
      category_id: 'cat-1',
      amount: 1450,
      due_date: '2026-08-16',
      recurrence: null,
      series_id: 'series-1',
      cycle_number: 1,
    });
    expect(result.seriesId).toBe('series-1');
  });
});

describe('closeBillCycle', () => {
  const openSeriesRow = { ...billRow, paid: false, series_id: 'series-1', cycle_number: 1 };
  const activeMonthlySeries = {
    id: 'series-1',
    entityType: 'bill' as const,
    frequency: 'monthly' as const,
    customIntervalUnit: null,
    customIntervalCount: null,
    amountMode: 'fixed' as const,
    autoRenew: true,
    endDate: null,
    maxOccurrences: null,
    occurrencesGenerated: 1,
    status: 'active' as const,
  };

  it('marks the row paid and generates the next cycle for an active series', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: billRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeMonthlySeries);

    await closeBillCycle('bill-1', 'paid');

    expect(updateMock).toHaveBeenCalledWith({ paid: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ series_id: 'series-1', cycle_number: 2, due_date: '2026-09-16' })
    );
    expect(incrementOccurrencesGenerated).toHaveBeenCalledWith('series-1', 2);
  });

  it('marks the row skipped without a payment date, still advancing the cycle', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: billRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeMonthlySeries);

    await closeBillCycle('bill-1', 'skipped');

    expect(updateMock).toHaveBeenCalledWith({ skipped: true });
    expect(insertMock).toHaveBeenCalled();
  });

  it('does nothing further when the row has no series_id', async () => {
    selectEqSingleMock.mockResolvedValue({ data: { ...billRow, series_id: null, cycle_number: null }, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    await closeBillCycle('bill-1', 'paid');

    expect(updateMock).toHaveBeenCalledWith({ paid: true });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
