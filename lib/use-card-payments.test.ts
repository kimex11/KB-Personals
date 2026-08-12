import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listPaymentsForCardMock, recordCardPaymentMock, updateCardPaymentMock, deleteCardPaymentMock } = vi.hoisted(() => ({
  listPaymentsForCardMock: vi.fn(),
  recordCardPaymentMock: vi.fn(),
  updateCardPaymentMock: vi.fn(),
  deleteCardPaymentMock: vi.fn(),
}));

vi.mock('./credit-card-payments-repository', () => ({
  listPaymentsForCard: listPaymentsForCardMock,
  recordCardPayment: recordCardPaymentMock,
  updateCardPayment: updateCardPaymentMock,
  deleteCardPayment: deleteCardPaymentMock,
}));

import { useCardPayments } from './use-card-payments';

const payment = {
  id: 'pay-1', cardId: 'card-1', amount: 300, balanceBefore: 842.5, balanceAfter: 542.5, paidAt: '2026-08-10T10:00:00.000Z', method: null, notes: null,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCardPayments', () => {
  it('loads payments for the given card on mount', async () => {
    listPaymentsForCardMock.mockResolvedValue([payment]);
    const { result } = renderHook(() => useCardPayments('card-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.payments).toEqual([payment]);
    expect(listPaymentsForCardMock).toHaveBeenCalledWith('card-1');
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listPaymentsForCardMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('recordPayment() calls the repository and refreshes', async () => {
    listPaymentsForCardMock.mockResolvedValueOnce([]).mockResolvedValueOnce([payment]);
    recordCardPaymentMock.mockResolvedValue(payment);
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.recordPayment({ amount: 300, paidAt: '2026-08-10T10:00:00.000Z' });
    });

    expect(recordCardPaymentMock).toHaveBeenCalledWith('card-1', { amount: 300, paidAt: '2026-08-10T10:00:00.000Z' });
    expect(result.current.payments).toEqual([payment]);
  });

  it('surfaces a mutation error without crashing', async () => {
    listPaymentsForCardMock.mockResolvedValue([]);
    recordCardPaymentMock.mockRejectedValue(new Error('cannot record payment'));
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.recordPayment({ amount: 300, paidAt: '2026-08-10T10:00:00.000Z' })).rejects.toThrow('cannot record payment');
    });

    expect(result.current.error).toBe('cannot record payment');
  });

  it('updatePayment() calls the repository and refreshes', async () => {
    listPaymentsForCardMock.mockResolvedValueOnce([payment]).mockResolvedValueOnce([{ ...payment, amount: 250 }]);
    updateCardPaymentMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updatePayment('pay-1', { amount: 250 });
    });

    expect(updateCardPaymentMock).toHaveBeenCalledWith('pay-1', { amount: 250 });
    expect(result.current.payments).toEqual([{ ...payment, amount: 250 }]);
  });

  it('deletePayment() calls the repository and refreshes', async () => {
    listPaymentsForCardMock.mockResolvedValueOnce([payment]).mockResolvedValueOnce([]);
    deleteCardPaymentMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCardPayments('card-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deletePayment('pay-1');
    });

    expect(deleteCardPaymentMock).toHaveBeenCalledWith('pay-1');
    expect(result.current.payments).toEqual([]);
  });
});
