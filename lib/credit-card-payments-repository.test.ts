import { describe, expect, it, vi, afterEach } from 'vitest';

const { selectSingleMock, updateEqMock, insertSelectSingleMock, listOrderMock, listAllOrderMock, logActivityMock } = vi.hoisted(() => ({
  selectSingleMock: vi.fn(),
  updateEqMock: vi.fn(),
  insertSelectSingleMock: vi.fn(),
  listOrderMock: vi.fn(),
  listAllOrderMock: vi.fn(),
  logActivityMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'credit_card_dues') {
        return {
          select: () => ({ eq: () => ({ single: selectSingleMock }) }),
          update: () => ({ eq: updateEqMock }),
        };
      }
      if (table === 'credit_card_payments') {
        return {
          select: () => ({ eq: () => ({ order: listOrderMock }), order: listAllOrderMock }),
          insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));

import { listPaymentsForCard, recordCardPayment, listAllCreditCardPayments } from './credit-card-payments-repository';

afterEach(() => {
  vi.clearAllMocks();
});

const paymentRow = {
  id: 'pay-1',
  card_id: 'card-1',
  amount: 300,
  balance_before: 842.5,
  balance_after: 542.5,
  paid_at: '2026-08-10T10:00:00.000Z',
  method: 'Bank transfer',
  notes: null,
};

describe('listPaymentsForCard', () => {
  it('returns payments for the card, mapped to camelCase', async () => {
    listOrderMock.mockResolvedValue({ data: [paymentRow], error: null });

    const result = await listPaymentsForCard('card-1');

    expect(result).toEqual([
      { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null },
    ]);
  });

  it('throws on error', async () => {
    listOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listPaymentsForCard('card-1')).rejects.toThrow('boom');
  });
});

describe('recordCardPayment', () => {
  it("computes balanceAfter from the card's current balance, inserts the payment, then updates the card", async () => {
    selectSingleMock.mockResolvedValue({ data: { card_name: 'Visa Platinum', statement_balance: 842.5 }, error: null });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    const result = await recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer' });

    expect(result).toEqual({
      id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null,
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'credit_card_due',
        entityId: 'card-1',
        entityLabel: 'Visa Platinum',
        beforeValue: { statementBalance: 842.5 },
        afterValue: { statementBalance: 542.5, amountPaid: 300 },
      })
    );
  });

  it('throws when fetching the card fails, without inserting a payment', async () => {
    selectSingleMock.mockResolvedValue({ data: null, error: new Error('card not found') });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('card not found');
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
  });

  it('throws when the update fails, after the payment row was already inserted', async () => {
    selectSingleMock.mockResolvedValue({ data: { card_name: 'Visa Platinum', statement_balance: 842.5 }, error: null });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });
    updateEqMock.mockResolvedValue({ error: new Error('update failed') });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('update failed');
    expect(insertSelectSingleMock).toHaveBeenCalled();
  });
});

describe('listAllCreditCardPayments', () => {
  it('returns payments across every card, newest first', async () => {
    listAllOrderMock.mockResolvedValue({ data: [paymentRow], error: null });

    const result = await listAllCreditCardPayments();

    expect(result).toEqual([
      { id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null },
    ]);
    expect(listAllOrderMock).toHaveBeenCalledWith('paid_at', { ascending: false });
  });

  it('throws on error', async () => {
    listAllOrderMock.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(listAllCreditCardPayments()).rejects.toThrow('boom');
  });
});
