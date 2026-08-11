'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import type { BillWithCategoryId } from './bills-repository';
import { logActivity } from './audit-log-repository';
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

  // Guards against a rapid double-tap firing the same mutation twice for the
  // same row before the first one resolves -- e.g. two closeBillCycle calls
  // racing would both try to insert the series' next cycle_number and the
  // second hits the (series_id, cycle_number) unique constraint, surfacing a
  // raw Postgres error instead of just being a harmless no-op.
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const withIdGuard = useCallback((id: string, fn: () => Promise<void>): Promise<void> => {
    if (pendingIdsRef.current.has(id)) return Promise.resolve();
    pendingIdsRef.current.add(id);
    return fn().finally(() => pendingIdsRef.current.delete(id));
  }, []);

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
        () =>
          createBill(input).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'bill',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, amount: created.amount, dueDate: created.dueDate, recurrence: created.recurrence },
            }).catch(() => {});
            return created;
          }),
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
        () =>
          createRecurringBill(billInput, seriesInput).then((created) => {
            logActivity({
              action: 'create',
              entityType: 'bill',
              entityId: created.id,
              entityLabel: created.title,
              afterValue: { title: created.title, category: created.category, amount: created.amount, dueDate: created.dueDate, recurring: true },
            }).catch(() => {});
            return created;
          }),
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
    updateBill: (id, patch) => {
      const before = bills.find((b) => b.id === id);
      return withIdGuard(id, () =>
        mutate(
          'updateBill',
          [id, patch],
          () =>
            updateBill(id, patch).then(() => {
              logActivity({
                action: 'update',
                entityType: 'bill',
                entityId: id,
                entityLabel: patch.title ?? before?.title ?? 'Bill',
                beforeValue: before
                  ? { title: before.title, category: before.category, amount: before.amount, dueDate: before.dueDate, recurrence: before.recurrence, paid: before.paid }
                  : null,
                afterValue: { ...before, ...patch },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        )
      );
    },
    deleteBill: (id) => {
      const before = bills.find((b) => b.id === id);
      return withIdGuard(id, () =>
        mutate(
          'deleteBill',
          [id],
          () =>
            deleteBill(id).then(() => {
              logActivity({
                action: 'delete',
                entityType: 'bill',
                entityId: id,
                entityLabel: before?.title ?? 'Bill',
                beforeValue: before ? { title: before.title, category: before.category, amount: before.amount, dueDate: before.dueDate } : null,
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.filter((b) => b.id !== id));
          }
        )
      );
    },
    togglePaid: (id) =>
      withIdGuard(id, () => {
        const bill = bills.find((b) => b.id === id);
        if (!bill) return Promise.resolve();
        if (!bill.paid && bill.seriesId) {
          return mutate(
            'closeBillCycle',
            [id, 'paid'],
            () =>
              closeBillCycle(id, 'paid').then(() => {
                logActivity({
                  action: 'update',
                  entityType: 'bill',
                  entityId: id,
                  entityLabel: bill.title,
                  beforeValue: { paid: false },
                  afterValue: { paid: true },
                }).catch(() => {});
              }),
            () => {
              setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: true } : b)));
              setPendingSyncIds((prev) => new Set(prev).add(id));
            }
          );
        }
        return mutate(
          'updateBill',
          [id, { paid: !bill.paid }],
          () =>
            updateBill(id, { paid: !bill.paid }).then(() => {
              logActivity({
                action: 'update',
                entityType: 'bill',
                entityId: id,
                entityLabel: bill.title,
                beforeValue: { paid: bill.paid },
                afterValue: { paid: !bill.paid },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, paid: !bill.paid } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
    skipCycle: (id) =>
      withIdGuard(id, () => {
        const bill = bills.find((b) => b.id === id);
        return mutate(
          'closeBillCycle',
          [id, 'skipped'],
          () =>
            closeBillCycle(id, 'skipped').then(() => {
              logActivity({
                action: 'skip',
                entityType: 'bill',
                entityId: id,
                entityLabel: bill?.title ?? 'Bill',
                beforeValue: { skipped: false },
                afterValue: { skipped: true },
              }).catch(() => {});
            }),
          () => {
            setBills((prev) => prev.map((b) => (b.id === id ? { ...b, skipped: true } : b)));
            setPendingSyncIds((prev) => new Set(prev).add(id));
          }
        );
      }),
  };
}
