import { afterEach, describe, expect, it, vi } from 'vitest';
import { listBills, createBill, updateBill, deleteBill } from './bills-repository';

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
      if (table !== 'bills') throw new Error(`Unexpected table: ${table}`);
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

const billRow = {
  id: 'bill-1',
  title: 'Rent',
  category_id: 'cat-1',
  amount: 1450,
  due_date: '2026-08-16',
  recurrence: 'monthly',
  paid: true,
  created_at: '2026-08-15T10:00:00.000Z',
  categories: { name: 'Housing' },
};

describe('listBills', () => {
  it('returns bills joined with their category name, ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [billRow], error: null });
    const result = await listBills();
    expect(result).toEqual([
      { id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly', paid: true },
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
    expect(result).toEqual({ id: 'bill-1', title: 'Rent', category: 'Housing', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly', paid: true });
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
