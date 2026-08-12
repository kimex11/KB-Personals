import { describe, expect, it, vi, afterEach } from 'vitest';

const { selectSingleMock, updateEqMock, insertSelectSingleMock, listOrderMock, listAllOrderMock, deleteEqMock, fetchBalanceSingleMock, logActivityMock } =
  vi.hoisted(() => ({
    selectSingleMock: vi.fn(),
    updateEqMock: vi.fn(),
    insertSelectSingleMock: vi.fn(),
    listOrderMock: vi.fn(),
    listAllOrderMock: vi.fn(),
    deleteEqMock: vi.fn(),
    fetchBalanceSingleMock: vi.fn(),
    logActivityMock: vi.fn().mockResolvedValue(undefined),
  }));

vi.mock('./supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'credit_card_dues') {
        return {
          select: () => ({ eq: () => ({ single: selectSingleMock }) }),
        };
      }
      if (table === 'credit_card_payments') {
        return {
          select: (columns?: string) => {
            if (columns === 'balance_before') return { eq: () => ({ single: fetchBalanceSingleMock }) };
            return { eq: () => ({ order: listOrderMock }), order: listAllOrderMock };
          },
          insert: () => ({ select: () => ({ single: insertSelectSingleMock }) }),
          update: () => ({ eq: updateEqMock }),
          delete: () => ({ eq: deleteEqMock }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));

import {
  listPaymentsForCard,
  recordCardPayment,
  listAllCreditCardPayments,
  updateCardPayment,
  deleteCardPayment,
  DuplicatePaymentError,
} from './credit-card-payments-repository';

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
  it("computes balanceAfter from payments since the balance anchor, inserts the payment, and never mutates the card", async () => {
    selectSingleMock.mockResolvedValue({
      data: { card_name: 'Visa Platinum', statement_balance: 842.5, balance_anchor_at: '2026-08-01T00:00:00.000Z' },
      error: null,
    });
    listOrderMock.mockResolvedValue({ data: [], error: null });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });

    const result = await recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer' });

    expect(result).toEqual({
      id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: 'Bank transfer', notes: null,
    });
    expect(updateEqMock).not.toHaveBeenCalled();
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

  it('excludes payments made before the last balance anchor when computing balanceBefore', async () => {
    selectSingleMock.mockResolvedValue({
      data: { card_name: 'Visa Platinum', statement_balance: 500, balance_anchor_at: '2026-08-01T00:00:00.000Z' },
      error: null,
    });
    listOrderMock.mockResolvedValue({
      data: [{ ...paymentRow, id: 'stale', paid_at: '2026-07-15T00:00:00.000Z', amount: 999 }],
      error: null,
    });
    insertSelectSingleMock.mockResolvedValue({ data: paymentRow, error: null });

    await recordCardPayment('card-1', { amount: 100, paidAt: '2026-08-12T00:00:00.000Z' });

    expect(insertSelectSingleMock).toHaveBeenCalled();
  });

  it('rejects a payment with the same amount and paid-at timestamp as an existing one', async () => {
    selectSingleMock.mockResolvedValue({
      data: { card_name: 'Visa Platinum', statement_balance: 842.5, balance_anchor_at: '2026-08-01T00:00:00.000Z' },
      error: null,
    });
    listOrderMock.mockResolvedValue({
      data: [{ ...paymentRow, amount: 300, paid_at: '2026-08-10T10:00:00.000Z' }],
      error: null,
    });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow(DuplicatePaymentError);
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
  });

  it('throws when fetching the card fails, without inserting a payment', async () => {
    selectSingleMock.mockResolvedValue({ data: null, error: new Error('card not found') });

    await expect(recordCardPayment('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('card not found');
    expect(insertSelectSingleMock).not.toHaveBeenCalled();
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

describe('updateCardPayment', () => {
  it('recomputes balance_after from the stored balance_before when the amount changes', async () => {
    fetchBalanceSingleMock.mockResolvedValue({ data: { balance_before: 842.5 }, error: null });
    updateEqMock.mockResolvedValue({ error: null });

    await updateCardPayment('pay-1', { amount: 250 });

    expect(updateEqMock).toHaveBeenCalledWith('id', 'pay-1');
  });

  it('updates method/notes without touching balances when the amount is unchanged', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await updateCardPayment('pay-1', { notes: 'Paid via app' });
    expect(fetchBalanceSingleMock).not.toHaveBeenCalled();
    expect(updateEqMock).toHaveBeenCalledWith('id', 'pay-1');
  });
});

describe('deleteCardPayment', () => {
  it('deletes the payment row by id', async () => {
    deleteEqMock.mockResolvedValue({ error: null });
    await deleteCardPayment('pay-1');
    expect(deleteEqMock).toHaveBeenCalledWith('id', 'pay-1');
  });
});
