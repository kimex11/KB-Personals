import { describe, expect, it } from 'vitest';
import { totalPaid, lastPaymentDate, paymentsSinceAnchor, remainingCardBalance, totalRemainingCardBalance } from './credit-card-payment-selectors';
import type { CreditCardDue } from './accounts-types';
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

const card: CreditCardDue = {
  id: 'card-1',
  cardName: 'Visa Platinum',
  last4: '4821',
  statementBalance: 1000,
  minimumPayment: 45,
  dueDate: '2026-09-01',
  balanceAnchorAt: '2026-08-01T00:00:00.000Z',
};

describe('paymentsSinceAnchor', () => {
  it('excludes payments made before the balance was last anchored', () => {
    const mixed: CreditCardPayment[] = [
      { id: 'p1', cardId: 'card-1', amount: 300, balanceBefore: 1300, balanceAfter: 1000, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
      { id: 'p2', cardId: 'card-1', amount: 400, balanceBefore: 1700, balanceAfter: 1300, paidAt: '2026-07-15T09:00:00.000Z', method: null, notes: null },
    ];
    expect(paymentsSinceAnchor(card, mixed)).toEqual([mixed[0]]);
  });
});

describe('remainingCardBalance', () => {
  it('subtracts only payments made since the last anchor from the statement balance', () => {
    const mixed: CreditCardPayment[] = [
      { id: 'p1', cardId: 'card-1', amount: 300, balanceBefore: 1300, balanceAfter: 1000, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null },
      { id: 'p2', cardId: 'card-1', amount: 999, balanceBefore: 2699, balanceAfter: 1700, paidAt: '2026-07-15T09:00:00.000Z', method: null, notes: null },
    ];
    expect(remainingCardBalance(card, mixed)).toBe(700);
  });

  it('returns the full statement balance when there are no payments yet', () => {
    expect(remainingCardBalance(card, [])).toBe(1000);
  });
});

describe('totalRemainingCardBalance', () => {
  it('sums the remaining balance across every card using its own payment history', () => {
    const cardB: CreditCardDue = { ...card, id: 'card-2', statementBalance: 500 };
    const paymentsByCardId = {
      'card-1': [{ id: 'p1', cardId: 'card-1', amount: 300, balanceBefore: 1300, balanceAfter: 1000, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null }],
      'card-2': [],
    };
    expect(totalRemainingCardBalance([card, cardB], paymentsByCardId)).toBe(700 + 500);
  });
});
