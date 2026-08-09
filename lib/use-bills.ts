'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listBills, createBill, updateBill, deleteBill, createRecurringBill, closeBillCycle } from './bills-repository';
import type { BillWithCategoryId } from './bills-repository';
import type { RecurrenceInterval } from './bills-types';
import type { CreateSeriesInput } from './recurring-types';

export interface UseBillsResult {
  bills: BillWithCategoryId[];
  loading: boolean;
  error: string | null;
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
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listBills();
      if (requestId !== requestIdRef.current) return; // a newer refresh already landed
      setBills(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const runMutation = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Action failed';
        setError(message);
        throw err;
      }
    },
    [refresh]
  );

  return {
    bills,
    loading,
    error,
    refresh,
    createBill: (input) => runMutation(() => createBill(input)),
    createRecurringBill: (billInput, seriesInput) => runMutation(() => createRecurringBill(billInput, seriesInput)),
    updateBill: (id, patch) => runMutation(() => updateBill(id, patch)),
    deleteBill: (id) => runMutation(() => deleteBill(id)),
    togglePaid: (id) => {
      const bill = bills.find((b) => b.id === id);
      if (!bill) return Promise.resolve();
      if (!bill.paid && bill.seriesId) {
        return runMutation(() => closeBillCycle(id, 'paid'));
      }
      return runMutation(() => updateBill(id, { paid: !bill.paid }));
    },
    skipCycle: (id) => runMutation(() => closeBillCycle(id, 'skipped')),
  };
}
