import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { cacheList } from './offline/cache';
import { getQueue } from './offline/queue';
import { resetDbForTests } from './offline/db';

const { listBillsMock, createBillMock, updateBillMock, deleteBillMock, createRecurringBillMock, closeBillCycleMock, logActivityMock } = vi.hoisted(() => ({
  listBillsMock: vi.fn(),
  createBillMock: vi.fn(),
  updateBillMock: vi.fn(),
  deleteBillMock: vi.fn(),
  createRecurringBillMock: vi.fn(),
  closeBillCycleMock: vi.fn(),
  logActivityMock: vi.fn(),
}));

vi.mock('./bills-repository', () => ({
  listBills: listBillsMock,
  createBill: createBillMock,
  updateBill: updateBillMock,
  deleteBill: deleteBillMock,
  createRecurringBill: createRecurringBillMock,
  closeBillCycle: closeBillCycleMock,
}));

vi.mock('./audit-log-repository', () => ({ logActivity: logActivityMock }));

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

beforeEach(() => {
  logActivityMock.mockResolvedValue(undefined);
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

  it('createBill() logs a create activity', async () => {
    listBillsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([bill]);
    createBillMock.mockResolvedValue(bill);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Rent', categoryId: 'cat-1', amount: 1450, dueDate: '2026-08-16', recurrence: 'monthly' });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent' })
    );
  });

  it('updateBill() logs an update activity with before and after snapshots', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateBill('bill-1', { amount: 1500 });
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Rent',
        beforeValue: expect.objectContaining({ amount: 1450 }),
        afterValue: expect.objectContaining({ amount: 1500 }),
      })
    );
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

  it('togglePaid() logs an update activity', async () => {
    listBillsMock.mockResolvedValue([bill]);
    updateBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-1',
        entityLabel: 'Rent',
        beforeValue: { paid: false },
        afterValue: { paid: true },
      })
    );
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

  it('deleteBill() logs a delete activity', async () => {
    listBillsMock.mockResolvedValue([bill]);
    deleteBillMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteBill('bill-1');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', entityType: 'bill', entityId: 'bill-1', entityLabel: 'Rent' })
    );
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

  it('togglePaid() on a recurring bill logs an update activity via the closeBillCycle path', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.togglePaid('bill-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        entityType: 'bill',
        entityId: 'bill-2',
        entityLabel: 'Rent',
        beforeValue: { paid: false },
        afterValue: { paid: true },
      })
    );
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

  it('skipCycle() logs a skip activity', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    closeBillCycleMock.mockResolvedValue(undefined);
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.skipCycle('bill-2');
    });

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'skip',
        entityType: 'bill',
        entityId: 'bill-2',
        entityLabel: 'Rent',
        beforeValue: { skipped: false },
        afterValue: { skipped: true },
      })
    );
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

  it('createRecurringBill() logs a create activity', async () => {
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

    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'create', entityType: 'bill', entityId: 'bill-2', entityLabel: 'Rent' })
    );
  });

  it('ignores a second togglePaid call for the same bill while the first is still in flight', async () => {
    listBillsMock.mockResolvedValue([recurringBill]);
    let resolveClose: () => void = () => {};
    closeBillCycleMock.mockReturnValue(new Promise<void>((resolve) => (resolveClose = resolve)));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    let firstCall: Promise<void> = Promise.resolve();
    let secondCall: Promise<void> = Promise.resolve();
    await act(async () => {
      firstCall = result.current.togglePaid('bill-2');
      secondCall = result.current.togglePaid('bill-2');
      resolveClose();
      await Promise.all([firstCall, secondCall]);
    });

    expect(closeBillCycleMock).toHaveBeenCalledTimes(1);
  });
});

describe('useBills offline behavior', () => {
  afterEach(async () => {
    await resetDbForTests();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('kb-personals-offline');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  });

  it('falls back to cached bills when the list fetch fails with a network error', async () => {
    await cacheList('bills', [bill]);
    listBillsMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bills).toEqual([bill]);
    expect(result.current.error).toBeNull();
  });

  it('queues a create and applies an optimistic update when offline', async () => {
    listBillsMock.mockResolvedValue([]);
    createBillMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useBills());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createBill({ title: 'Water Bill', categoryId: 'cat-1', amount: 30, dueDate: '2026-09-01', recurrence: null });
    });

    expect(result.current.bills).toHaveLength(1);
    expect(result.current.bills[0]).toMatchObject({ title: 'Water Bill', amount: 30 });
    expect(result.current.pendingSyncIds.size).toBe(1);
    const queue = await getQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].operation).toBe('createBill');
  });
});
