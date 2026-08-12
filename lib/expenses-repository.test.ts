import { describe, expect, it, vi, afterEach } from 'vitest';

const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const updateEqMock = vi.fn();
const deleteEqMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'expenses') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: selectOrderMock }),
        insert: insertMock,
        update: updateMock,
        delete: deleteMock,
      };
    },
  }),
}));

import { listExpenses, createExpense, updateExpense, deleteExpense } from './expenses-repository';

afterEach(() => {
  vi.clearAllMocks();
});

const expenseRow = {
  id: 'exp-1',
  category_id: 'cat-1',
  amount: 850,
  expense_date: '2026-08-12',
  description: 'Grocery run',
  payment_method: 'Cash',
  created_at: '2026-08-12T10:00:00.000Z',
  categories: { name: 'Groceries', color_slot: 2 },
};

describe('listExpenses', () => {
  it('returns expenses joined with category name/color, newest first', async () => {
    selectOrderMock.mockResolvedValue({ data: [expenseRow], error: null });

    const result = await listExpenses();

    expect(result).toEqual([
      {
        id: 'exp-1',
        categoryId: 'cat-1',
        category: 'Groceries',
        categoryColorSlot: 2,
        amount: 850,
        date: '2026-08-12',
        description: 'Grocery run',
        paymentMethod: 'Cash',
      },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('expense_date', { ascending: false });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listExpenses()).rejects.toThrow('boom');
  });
});

describe('createExpense', () => {
  it('inserts a new expense row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: expenseRow, error: null });

    const result = await createExpense({ categoryId: 'cat-1', amount: 850, date: '2026-08-12', description: 'Grocery run', paymentMethod: 'Cash' });

    expect(insertMock).toHaveBeenCalledWith({
      category_id: 'cat-1',
      amount: 850,
      expense_date: '2026-08-12',
      description: 'Grocery run',
      payment_method: 'Cash',
    });
    expect(result.category).toBe('Groceries');
  });
});

describe('updateExpense', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateExpense('exp-1', { amount: 900 });
    expect(updateMock).toHaveBeenCalledWith({ amount: 900 });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'exp-1');
  });

  it('maps categoryId to category_id and date to expense_date', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateExpense('exp-1', { categoryId: 'cat-2', date: '2026-08-13' });
    expect(updateMock).toHaveBeenCalledWith({ category_id: 'cat-2', expense_date: '2026-08-13' });
  });

  it('throws on error', async () => {
    updateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateExpense('exp-1', { amount: 900 })).rejects.toThrow('boom');
  });
});

describe('deleteExpense', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteExpense('exp-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'exp-1');
  });
});
