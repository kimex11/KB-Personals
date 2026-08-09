import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const { listBillsMock, createBillMock, updateBillMock, deleteBillMock, createRecurringBillMock, closeBillCycleMock } = vi.hoisted(() => ({
  listBillsMock: vi.fn(),
  createBillMock: vi.fn(),
  updateBillMock: vi.fn(),
  deleteBillMock: vi.fn(),
  createRecurringBillMock: vi.fn(),
  closeBillCycleMock: vi.fn(),
}));

vi.mock('./bills-repository', () => ({
  listBills: listBillsMock,
  createBill: createBillMock,
  updateBill: updateBillMock,
  deleteBill: deleteBillMock,
  createRecurringBill: createRecurringBillMock,
  closeBillCycle: closeBillCycleMock,
}));

import { useBills } from './use-bills';

const bill = {
  id: 'bill-1',
  title: 'Rent',
  category: 'Housing',
  categoryId: 'cat-1',
  amount: 1450,
  dueDate: '2026-08-16',
  recurrence: 'monthly' as const,
  paid: false,
  seriesId: null,
  cycleNumber: null,
  skipped: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBills', () => {
  it('loads bills on mount', async () => {
    listBillsMock.mockResolvedValue([bill]);
    const { result } = renderHook(() => useBills());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bills).toEqual([bill]);
    expect(result.current.error).toBeNull();
  });

  it('sets an error message when loading fails', async () => {
    listBillsMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
  });

  it('createBill() calls the repository and refreshes', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([bill]);
    createBillMock.mockResolvedValue(bill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' });
    });

    expect(createBillMock).toHaveBeenCalled();
    expect(result.current.bills).toEqual([bill]);
  });

  it('togglePaid() flips the paid flag for the given bill', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-1');
    });

    expect(updateBillMock).toHaveBeenCalledWith('bill-1', { paid: true });
  });

  it('deleteBill() surfaces a mutation error without crashing', async () => {
    listBillsMock.mockResolvedValue([]);
    deleteBillMock.mockRejectedValue(new Error('cannot delete'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.deleteBill('bill-1')).rejects.toThrow('cannot delete');
    });

    expect(result.current.error).toBe('cannot delete');
  });

  it('ignores a stale in-flight request that rejects after a newer one already succeeded', async () => {
    let rejectFirst: (err: Error) => void = () => {};
    const firstCall = new Promise((_resolve, reject) => {
      rejectFirst = reject;
    });
    listBillsMock.mockReturnValueOnce(firstCall).mockResolvedValueOnce([bill]);

    const { result } = renderHook(() => useBills());
    // A second refresh starts (and completes) while the first mount-triggered
    // request is still pending.
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.bills).toEqual([bill]);
    expect(result.current.loading).toBe(false);

    // The stale first request finally rejects -- it must not clobber the
    // already-applied, newer successful state.
    await act(async () => {
      rejectFirst(new Error('stale failure'));
      await firstCall.catch(() => {});
    });

    expect(result.current.bills).toEqual([bill]);
    expect(result.current.error).toBeNull();
  });
});

describe('useBills recurring behavior', () => {
  const recurringBill = { ...bill, id: 'bill-2', seriesId: 'series-1', cycleNumber: 1, paid: false };

  it('togglePaid() on a recurring bill closes the cycle via closeBillCycle, not a plain update', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(closeBillCycleMock).toHaveBeenCalledWith('bill-2', 'paid');
    expect(updateBillMock).not.toHaveBeenCalled();
  });

  it('togglePaid() un-marking a closed recurring bill uses a plain update, not closeBillCycle', async () => {
    listBillsMock.mockResolvedValue([{ ...recurringBill, paid: true }]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(updateBillMock).toHaveBeenCalledWith('bill-2', { paid: false });
    expect(closeBillCycleMock).not.toHaveBeenCalled();
  });

  it('skipCycle() closes the cycle as skipped', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('bill-2');
    });

    expect(closeBillCycleMock).toHaveBeenCalledWith('bill-2', 'skipped');
  });

  it('createRecurringBill() calls the repository and refreshes', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([recurringBill]);
    createRecurringBillMock.mockResolvedValue(recurringBill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createRecurringBill(
        { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
        { frequency: 'monthly' }
      );
    });

    expect(createRecurringBillMock).toHaveBeenCalledWith(
      { title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16' },
      { frequency: 'monthly' }
    );
    expect(result.current.bills).toEqual([recurringBill]);
  });
});
