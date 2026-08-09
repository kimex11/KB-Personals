import { afterEach, describe, expect, it, vi } from 'vitest';
import { listReminders, createReminder, updateReminder, deleteReminder, createRecurringReminder, closeReminderCycle } from './reminders-repository';
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
      if (table !== 'reminders') throw new Error(`Unexpected table: ${table}`);
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

const reminderRow = {
  id: 'reminder-1',
  title: 'Renew passport',
  category: 'Personal',
  due_date: '2026-08-16',
  priority: 'high',
  completed: false,
  created_at: '2026-08-15T10:00:00.000Z',
  series_id: null,
  cycle_number: null,
  skipped: false,
};

describe('listReminders', () => {
  it('returns reminders ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [reminderRow], error: null });
    const result = await listReminders();
    expect(result).toEqual([
      {
        id: 'reminder-1',
        title: 'Renew passport',
        category: 'Personal',
        dueDate: '2026-08-16',
        priority: 'high',
        completed: false,
        seriesId: null,
        cycleNumber: null,
        skipped: false,
      },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('due_date', { ascending: true });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listReminders()).rejects.toThrow('boom');
  });
});

describe('createReminder', () => {
  it('inserts a new reminder row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: reminderRow, error: null });
    const result = await createReminder({ title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high' });
    expect(insertMock).toHaveBeenCalledWith({ title: 'Renew passport', category: 'Personal', due_date: '2026-08-16', priority: 'high' });
    expect(result).toEqual({
      id: 'reminder-1',
      title: 'Renew passport',
      category: 'Personal',
      dueDate: '2026-08-16',
      priority: 'high',
      completed: false,
      seriesId: null,
      cycleNumber: null,
      skipped: false,
    });
  });
});

describe('updateReminder', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateReminder('reminder-1', { completed: true });
    expect(updateMock).toHaveBeenCalledWith({ completed: true });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'reminder-1');
  });

  it('maps dueDate to due_date', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateReminder('reminder-1', { dueDate: '2026-09-01' });
    expect(updateMock).toHaveBeenCalledWith({ due_date: '2026-09-01' });
  });

  it('throws on error', async () => {
    updateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateReminder('reminder-1', { completed: true })).rejects.toThrow('boom');
  });
});

describe('deleteReminder', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteReminder('reminder-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'reminder-1');
  });
});

describe('createRecurringReminder', () => {
  it('creates the series, then the first reminder row with cycle_number 1', async () => {
    vi.mocked(createSeries).mockResolvedValue({
      id: 'series-2',
      entityType: 'reminder',
      frequency: 'weekly',
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
      data: { ...reminderRow, title: 'Water plants', category: 'Home', series_id: 'series-2', cycle_number: 1 },
      error: null,
    });

    const result = await createRecurringReminder(
      { title: 'Water plants', category: 'Home', dueDate: '2026-08-16', priority: 'low' },
      { frequency: 'weekly' }
    );

    expect(createSeries).toHaveBeenCalledWith({ frequency: 'weekly', entityType: 'reminder' });
    expect(result.seriesId).toBe('series-2');
  });
});

describe('closeReminderCycle', () => {
  const openSeriesRow = { ...reminderRow, completed: false, series_id: 'series-2', cycle_number: 1 };
  const activeWeeklySeries = {
    id: 'series-2',
    entityType: 'reminder' as const,
    frequency: 'weekly' as const,
    customIntervalUnit: null,
    customIntervalCount: null,
    amountMode: 'fixed' as const,
    autoRenew: true,
    endDate: null,
    maxOccurrences: null,
    occurrencesGenerated: 1,
    status: 'active' as const,
  };

  it('marks the row completed and generates the next cycle for an active series', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeWeeklySeries);

    await closeReminderCycle('reminder-1', 'completed');

    expect(updateMock).toHaveBeenCalledWith({ completed: true });
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ series_id: 'series-2', cycle_number: 2, due_date: '2026-08-23' })
    );
    expect(incrementOccurrencesGenerated).toHaveBeenCalledWith('series-2', 2);
  });

  it('marks the row skipped without completing it, still advancing the cycle', async () => {
    selectEqSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });
    insertSelectSingleMock.mockResolvedValue({ data: openSeriesRow, error: null });
    vi.mocked(getSeries).mockResolvedValue(activeWeeklySeries);

    await closeReminderCycle('reminder-1', 'skipped');

    expect(updateMock).toHaveBeenCalledWith({ skipped: true });
    expect(insertMock).toHaveBeenCalled();
  });

  it('does nothing further when the row has no series_id', async () => {
    selectEqSingleMock.mockResolvedValue({ data: { ...reminderRow, series_id: null, cycle_number: null }, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    await closeReminderCycle('reminder-1', 'completed');

    expect(updateMock).toHaveBeenCalledWith({ completed: true });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
