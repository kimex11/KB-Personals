import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listCreditCardDues,
  createCreditCardDue,
  updateCreditCardDue,
  deleteCreditCardDue,
  listIncomeSources,
  createIncomeSource,
  updateIncomeSource,
  deleteIncomeSource,
} from './accounts-repository';

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
      if (table !== 'credit_card_dues' && table !== 'income_sources') throw new Error(`Unexpected table: ${table}`);
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

const cardRow = {
  id: 'card-1',
  card_name: 'Visa Platinum',
  last4: '4821',
  statement_balance: 842.5,
  minimum_payment: 45,
  due_date: '2026-08-16',
  created_at: '2026-08-15T10:00:00.000Z',
};

describe('listCreditCardDues', () => {
  it('returns cards ordered by due date', async () => {
    selectOrderMock.mockResolvedValue({ data: [cardRow], error: null });
    const result = await listCreditCardDues();
    expect(result).toEqual([
      { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('due_date', { ascending: true });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listCreditCardDues()).rejects.toThrow('boom');
  });
});

describe('createCreditCardDue', () => {
  it('inserts a new card row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: cardRow, error: null });
    const result = await createCreditCardDue({
      cardName: 'Visa Platinum',
      last4: '4821',
      statementBalance: 842.5,
      minimumPayment: 45,
      dueDate: '2026-08-16',
    });
    expect(insertMock).toHaveBeenCalledWith({
      card_name: 'Visa Platinum',
      last4: '4821',
      statement_balance: 842.5,
      minimum_payment: 45,
      due_date: '2026-08-16',
    });
    expect(result).toEqual({ id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' });
  });
});

describe('updateCreditCardDue', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateCreditCardDue('card-1', { statementBalance: 900 });
    expect(updateMock).toHaveBeenCalledWith({ statement_balance: 900 });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'card-1');
  });

  it('throws on error', async () => {
    updateEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(updateCreditCardDue('card-1', { statementBalance: 900 })).rejects.toThrow('boom');
  });
});

describe('deleteCreditCardDue', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCreditCardDue('card-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'card-1');
  });
});

const incomeRow = {
  id: 'income-1',
  name: 'Salary',
  amount: 3200,
  date: '2026-08-20',
  created_at: '2026-08-15T10:00:00.000Z',
};

describe('listIncomeSources', () => {
  it('returns income sources ordered by date', async () => {
    selectOrderMock.mockResolvedValue({ data: [incomeRow], error: null });
    const result = await listIncomeSources();
    expect(result).toEqual([{ id: 'income-1', name: 'Salary', amount: 3200, date: '2026-08-20' }]);
    expect(selectOrderMock).toHaveBeenCalledWith('date', { ascending: true });
  });
});

describe('createIncomeSource', () => {
  it('inserts a new income row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: incomeRow, error: null });
    const result = await createIncomeSource({ name: 'Salary', amount: 3200, date: '2026-08-20' });
    expect(insertMock).toHaveBeenCalledWith({ name: 'Salary', amount: 3200, date: '2026-08-20' });
    expect(result).toEqual({ id: 'income-1', name: 'Salary', amount: 3200, date: '2026-08-20' });
  });
});

describe('updateIncomeSource', () => {
  it('updates only the provided fields', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateIncomeSource('income-1', { amount: 3300 });
    expect(updateMock).toHaveBeenCalledWith({ amount: 3300 });
    expect(updateEqMock).toHaveBeenCalledWith('id', 'income-1');
  });
});

describe('deleteIncomeSource', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteIncomeSource('income-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'income-1');
  });
});
