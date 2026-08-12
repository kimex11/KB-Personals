import { describe, expect, it } from 'vitest';
import { totalPaidForPlan, remainingBalance, monthsPaid, monthsLeft, lastPlanPaymentDate } from './payment-plan-selectors';
import type { PaymentPlan } from './payment-plans-repository';
import type { PaymentPlanPayment } from './payment-plan-payments-repository';

const plan: PaymentPlan = {
  id: 'plan-1',
  name: 'iPhone 15',
  categoryId: 'cat-1',
  category: 'Electronics',
  categoryColorSlot: 4,
  totalAmount: 36000,
  installmentCount: 12,
  monthlyAmount: 3000,
  startDate: '2026-01-01',
};

const payments: PaymentPlanPayment[] = [
  { id: 'pp-2', planId: 'plan-1', installmentNumber: 2, amount: 3000, balanceBefore: 33000, balanceAfter: 30000, paidAt: '2026-02-01T10:00:00.000Z' },
  { id: 'pp-1', planId: 'plan-1', installmentNumber: 1, amount: 3000, balanceBefore: 36000, balanceAfter: 33000, paidAt: '2026-01-01T10:00:00.000Z' },
];

describe('totalPaidForPlan', () => {
  it('sums all payment amounts', () => {
    expect(totalPaidForPlan(payments)).toBe(6000);
  });
});

describe('remainingBalance', () => {
  it('subtracts total paid from the plan total', () => {
    expect(remainingBalance(plan, payments)).toBe(30000);
  });

  it('returns the full total when there are no payments', () => {
    expect(remainingBalance(plan, [])).toBe(36000);
  });
});

describe('monthsPaid', () => {
  it('returns the number of payments made', () => {
    expect(monthsPaid(payments)).toBe(2);
  });
});

describe('monthsLeft', () => {
  it('returns the remaining installment count', () => {
    expect(monthsLeft(plan, payments)).toBe(10);
  });

  it('never goes below zero', () => {
    const allPaid = Array.from({ length: 14 }, (_, i) => ({ ...payments[0], id: `pp-${i}`, installmentNumber: i + 1 }));
    expect(monthsLeft(plan, allPaid)).toBe(0);
  });
});

describe('lastPlanPaymentDate', () => {
  it('returns the most recent payment date', () => {
    expect(lastPlanPaymentDate(payments)).toBe('2026-02-01T10:00:00.000Z');
  });

  it('returns null when there are no payments', () => {
    expect(lastPlanPaymentDate([])).toBeNull();
  });
});
