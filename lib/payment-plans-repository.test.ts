import { describe, expect, it, vi, afterEach } from 'vitest';

const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const deleteEqMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table !== 'payment_plans') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({ order: selectOrderMock }),
        insert: insertMock,
        delete: deleteMock,
      };
    },
  }),
}));

import { listPaymentPlans, createPaymentPlan, deletePaymentPlan } from './payment-plans-repository';

afterEach(() => {
  vi.clearAllMocks();
});

const planRow = {
  id: 'plan-1',
  name: 'iPhone 15',
  category_id: 'cat-1',
  total_amount: 36000,
  installment_count: 12,
  monthly_amount: 3000,
  start_date: '2026-01-01',
  created_at: '2026-01-01T10:00:00.000Z',
  categories: { name: 'Electronics', color_slot: 4 },
};

describe('listPaymentPlans', () => {
  it('returns payment plans joined with category name/color, newest first', async () => {
    selectOrderMock.mockResolvedValue({ data: [planRow], error: null });

    const result = await listPaymentPlans();

    expect(result).toEqual([
      {
        id: 'plan-1',
        name: 'iPhone 15',
        categoryId: 'cat-1',
        category: 'Electronics',
        categoryColorSlot: 4,
        totalAmount: 36000,
        installmentCount: 12,
        monthlyAmount: 3000,
        startDate: '2026-01-01',
      },
    ]);
    expect(selectOrderMock).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('throws on error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listPaymentPlans()).rejects.toThrow('boom');
  });
});

describe('createPaymentPlan', () => {
  it('inserts a new payment plan row', async () => {
    insertSelectSingleMock.mockResolvedValue({ data: planRow, error: null });

    const result = await createPaymentPlan({
      name: 'iPhone 15',
      categoryId: 'cat-1',
      totalAmount: 36000,
      installmentCount: 12,
      monthlyAmount: 3000,
      startDate: '2026-01-01',
    });

    expect(insertMock).toHaveBeenCalledWith({
      name: 'iPhone 15',
      category_id: 'cat-1',
      total_amount: 36000,
      installment_count: 12,
      monthly_amount: 3000,
      start_date: '2026-01-01',
    });
    expect(result.category).toBe('Electronics');
  });
});

describe('deletePaymentPlan', () => {
  it('deletes the row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deletePaymentPlan('plan-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'plan-1');
  });
});
