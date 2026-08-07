import { afterEach, describe, expect, it, vi } from 'vitest';
import { listReminders, createReminder, updateReminder, deleteReminder } from './reminders-repository';

const selectOrderMock = vi.fn();
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
        select: () => ({ order: selectOrderMock }),
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      };
    },
  }),
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
};

describe('listReminders', () => {
  it('returns reminders ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [reminderRow], error: null });
    const result = await listReminders();
    expect(result).toEqual([
      { id: 'reminder-1', title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high', completed: false },
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
    expect(result).toEqual({ id: 'reminder-1', title: 'Renew passport', category: 'Personal', dueDate: '2026-08-16', priority: 'high', completed: false });
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
