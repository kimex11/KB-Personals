import { describe, expect, it } from 'vitest';
import { totalPaid, lastPaymentDate } from './credit-card-payment-selectors';
import type { CreditCardPayment } from './credit-card-payments-repository';

const payments: CreditCardPayment[] = [
  { id: 'pay-2', cardId: 'card-1', amount: 300, balanceBefore: 542.5, balanceAfter: 242.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
  { id: 'pay-1', cardId: 'card-1', amount: 400, balanceBefore: 942.5, balanceAfter: 542.5, paidAt: '2026-07-28T09:00:00.000Z', method: null, notes: null },
];

describe('totalPaid', () => {
  it('sums every payment amount', () => {
    expect(totalPaid(payments)).toBe(700);
  });

  it('returns 0 for an empty list', () => {
    expect(totalPaid([])).toBe(0);
  });
});

describe('lastPaymentDate', () => {
  it("returns the first payment's date (list is newest-first)", () => {
    expect(lastPaymentDate(payments)).toBe('2026-08-10T10:00:00.000Z');
  });

  it('returns null for an empty list', () => {
    expect(lastPaymentDate([])).toBeNull();
  });
});
