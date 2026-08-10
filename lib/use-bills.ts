'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import type { BillWithCategoryId } from './bills-repository';
import type { RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';
import { cacheList, getCachedList } from './offline/cache';
import { attemptOrQueue } from './offline/attempt-or-queue';
import { isNetworkError } from './offline/network-error';
import { useOnlineStatus } from './offline/connectivity';
import { processQueue } from './offline/sync-engine';

export interface UseBillsResult {
  bills: BillWithCategoryId[];
  loading: boolean;
  error: string | null;
  pendingSyncIds: Set<string>;
  refresh: () => Promise<void>;
  createBill: (input: { title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval }) => Promise<void>;
  createRecurringBill: (
    billInput: { title: string; categoryId: string; amount: number; dueDate: string },
    seriesInput: Omit<CreateSeriesInput, 'entityType'>
  ) => Promise<void>;
  updateBill: (
    id: string,
    patch: Partial<{ title: string; categoryId: string; amount: number; dueDate: string; recurrence: RecurrenceInterval; paid: boolean }>
  ) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  togglePaid: (id: string) => Promise<void>;
  skipCycle: (id: string) => Promise<void>;
}

export function useBills(): UseBillsResult {
  const [bills, setBills] = useState<BillWithCategoryId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingSyncIds, setPendingSyncIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const isOnline = useOnlineStatus();

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listBills();
      if (requestId !== requestIdRef.current) return;
      setBills(result);
      await cacheList('bills', result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (isNetworkError(err)) {
        const cached = await getCachedList<BillWithCategoryId>('bills');
        setBills(cached);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load bills');
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    processQueue(refresh).then(() => setPendingSyncIds(new Set()));
  }, [isOnline, refresh]);

  const mutate = useCallback(
    async (operation: string, args: unknown[], liveCall: () => Promise<unknown>, applyOptimistic: () => void) => {
      setError(null);
      try {
        await liveCall();
        await refresh();
      } catch (err) {
        if (!isNetworkError(err)) {
          setError(err instanceof Error ? err.message : 'Action failed');
          throw err;
        }
        await attemptOrQueue('bill', operation, args, () => Promise.reject(err), applyOptimistic);
      }
    },
    [refresh]
  );

  return {
    bills,
    loading,
    error,
    pendingSyncIds,
    refresh,
    createBill: (input) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createBill',
        [input],
        () => createBill(input),
        () => {
          setBills((prev) => [
            ...prev,
            {
              id: tempId,
              title: input.title,
              category: '',
              categoryId: input.categoryId,
              amount: input.amount,
              dueDate: input.dueDate,
              recurrence: input.recurrence,
              paid: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    createRecurringBill: (billInput, seriesInput) => {
      const tempId = crypto.randomUUID();
      return mutate(
        'createRecurringBill',
        [billInput, seriesInput],
        () => createRecurringBill(billInput, seriesInput),
        () => {
          setBills((prev) => [
            ...prev,
            {
              id: tempId,
              title: billInput.title,
              category: '',
              categoryId: billInput.categoryId,
              amount: billInput.amount,
              dueDate: billInput.dueDate,
              recurrence: null,
              paid: false,
              seriesId: null,
              cycleNumber: null,
              skipped: false,
            },
          ]);
          setPendingSyncIds((prev) => new Set(prev).add(tempId));
        }
      );
    },
    updateBill: (id, patch) =>
      mutate('updateBill', [id, patch], () => updateBill(id, patch), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
    deleteBill: (id) =>
      mutate('deleteBill', [id], () => deleteBill(id), () => {
        setBills((prev) => prev.filter((b) => b.id !== id));
      }),
    togglePaid: (id) => {
      const bill = bills.find((b) => b.id === id);
      if (!bill) return Promise.resolve();
      if (!bill.paid && bill.seriesId) {
        return mutate('closeBillCycle', [id, 'paid'], () => closeBillCycle(id, 'paid'), () => {
          setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: true } : b)));
          setPendingSyncIds((prev) => new Set(prev).add(id));
        });
      }
      return mutate('updateBill', [id, { paid: !bill.paid }], () => updateBill(id, { paid: !bill.paid }), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !bill.paid } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      });
    },
    skipCycle: (id) =>
      mutate('closeBillCycle', [id, 'skipped'], () => closeBillCycle(id, 'skipped'), () => {
        setBills((prev) => prev.map((b) => (b.id === id ? { ...b, skipped: true } : b)));
        setPendingSyncIds((prev) => new Set(prev).add(id));
      }),
  };
}
