import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const {
  listCreditCardDuesMock,
  createCreditCardDueMock,
  deleteCreditCardDueMock,
  listIncomeSourcesMock,
  createIncomeSourceMock,
  deleteIncomeSourceMock,
} = vi.hoisted(() => ({
  listCreditCardDuesMock: vi.fn(),
  createCreditCardDueMock: vi.fn(),
  deleteCreditCardDueMock: vi.fn(),
  listIncomeSourcesMock: vi.fn(),
  createIncomeSourceMock: vi.fn(),
  deleteIncomeSourceMock: vi.fn(),
}));

vi.mock('./accounts-repository', () => ({
  listCreditCardDues: listCreditCardDuesMock,
  createCreditCardDue: createCreditCardDueMock,
  updateCreditCardDue: vi.fn(),
  deleteCreditCardDue: deleteCreditCardDueMock,
  listIncomeSources: listIncomeSourcesMock,
  createIncomeSource: createIncomeSourceMock,
  updateIncomeSource: vi.fn(),
  deleteIncomeSource: deleteIncomeSourceMock,
}));

import { useAccounts } from './use-accounts';

const card = { id: 'card-1', cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' };
const income = { id: 'income-1', name: 'Salary', amount: 3200, frequency: 'biweekly' as const, nextDate: '2026-08-20' };

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAccounts', () => {
  it('loads cards and income sources on mount', async () => {
    listCreditCardDuesMock.mockResolvedValue([card]);
    listIncomeSourcesMock.mockResolvedValue([income]);
    const { result } = renderHook(() => useAccounts());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cards).toEqual([card]);
    expect(result.current.incomeSources).toEqual([income]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listCreditCardDuesMock.mockRejectedValue(new Error('network down'));
    listIncomeSourcesMock.mockResolvedValue([]);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('createCard() calls the repository and refreshes cards', async () => {
    listCreditCardDuesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([card]);
    listIncomeSourcesMock.mockResolvedValue([]);
    createCreditCardDueMock.mockResolvedValue(card);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createCard({ cardName: 'Visa Platinum', last4: '4821', statementBalance: 842.5, minimumPayment: 45, dueDate: '2026-08-16' });
    });

    expect(createCreditCardDueMock).toHaveBeenCalled();
    expect(result.current.cards).toEqual([card]);
  });

  it('deleteCard() surfaces a mutation error without crashing', async () => {
    listCreditCardDuesMock.mockResolvedValue([]);
    listIncomeSourcesMock.mockResolvedValue([]);
    deleteCreditCardDueMock.mockRejectedValue(new Error('cannot delete'));
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteCard('card-1')).rejects.toThrow('cannot delete');
    });

    expect(result.current.error).toBe('cannot delete');
  });

  it('createIncome() calls the repository and refreshes income sources', async () => {
    listCreditCardDuesMock.mockResolvedValue([]);
    listIncomeSourcesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([income]);
    createIncomeSourceMock.mockResolvedValue(income);
    const { result } = renderHook(() => useAccounts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createIncome({ name: 'Salary', amount: 3200, frequency: 'biweekly', nextDate: '2026-08-20' });
    });

    expect(createIncomeSourceMock).toHaveBeenCalled();
    expect(result.current.incomeSources).toEqual([income]);
  });

  it('ignores a stale in-flight request that rejects after a newer one already succeeded', async () => {
    let rejectFirst: (err: Error) => void = () => {};
    const firstCall = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
    listCreditCardDuesMock.mockReturnValueOnce(firstCall).mockResolvedValueOnce([card]);
    listIncomeSourcesMock.mockResolvedValue([income]);

    const { result } = renderHook(() => useAccounts());
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.cards).toEqual([card]);

    await act(async () => {
      rejectFirst(new Error('stale failure'));
      await firstCall.catch(() => {});
    });

    expect(result.current.cards).toEqual([card]);
    expect(result.current.error).toBeNull();
  });
});
