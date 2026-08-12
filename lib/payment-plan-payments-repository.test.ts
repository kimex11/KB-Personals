import { describe, expect, it, vi, afterEach } from 'vitest';

const selectEqOrderMock = vi.fn();
const selectOrderMock = vi.fn();
const insertSelectSingleMock = vi.fn();
const insertMock = vi.fn(() => ({ select: () => ({ single: insertSelectSingleMock }) }));
const planSingleMock = vi.fn();

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'payment_plan_payments') {
        return {
          select: () => ({ eq: () => ({ order: selectEqOrderMock }), order: selectOrderMock }),
          insert: insertMock,
        };
      }
      if (table === 'payment_plans') {
        return {
          select: () => ({ eq: () => ({ single: planSingleMock }) }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { listPaymentsForPlan, listAllPlanPayments, recordPlanPayment } from './payment-plan-payments-repository';

afterEach(() => {
  vi.clearAllMocks();
});

const paymentRow = {
  id: 'pp-1',
  plan_id: 'plan-1',
  installment_number: 1,
  amount: 3000,
  balance_before: 36000,
  balance_after: 33000,
  paid_at: '2026-01-01T10:00:00.000Z',
};

describe('listPaymentsForPlan', () => {
  it('returns payments for the plan, newest first', async () => {
    selectEqOrderMock.mockResolvedValue({ data: [paymentRow], error: null });

    const result = await listPaymentsForPlan('plan-1');

    expect(result).toEqual([
      {
        id: 'pp-1',
        planId: 'plan-1',
        installmentNumber: 1,
        amount: 3000,
        balanceBefore: 36000,
        balanceAfter: 33000,
        paidAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
  });

  it('throws on error', async () => {
    selectEqOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listPaymentsForPlan('plan-1')).rejects.toThrow('boom');
  });
});

describe('listAllPlanPayments', () => {
  it('returns payments across all plans, newest first', async () => {
    selectOrderMock.mockResolvedValue({ data: [paymentRow], error: null });
    const result = await listAllPlanPayments();
    expect(result).toEqual([
      {
        id: 'pp-1',
        planId: 'plan-1',
        installmentNumber: 1,
        amount: 3000,
        balanceBefore: 36000,
        balanceAfter: 33000,
        paidAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
  });
});

describe('recordPlanPayment', () => {
  it('computes installment number and balance trail from prior payments, then inserts', async () => {
    planSingleMock.mockResolvedValue({ data: { name: 'iPhone 15', total_amount: 36000 }, error: null });
    selectEqOrderMock.mockResolvedValue({ data: [paymentRow], error: null });
    insertSelectSingleMock.mockResolvedValue({
      data: { ...paymentRow, id: 'pp-2', installment_number: 2, balance_before: 33000, balance_after: 30000 },
      error: null,
    });

    const result = await recordPlanPayment('plan-1', { amount: 3000, paidAt: '2026-02-01T10:00:00.000Z' });

    expect(insertMock).toHaveBeenCalledWith({
      plan_id: 'plan-1',
      installment_number: 2,
      amount: 3000,
      balance_before: 33000,
      balance_after: 30000,
      paid_at: '2026-02-01T10:00:00.000Z',
    });
    expect(result.installmentNumber).toBe(2);
    expect(result.balanceAfter).toBe(30000);
  });
});
