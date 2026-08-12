'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listExpenses, createExpense, updateExpense, deleteExpense, type Expense, type CreateExpenseInput } from './expenses-repository';
import { logActivity } from './audit-log-repository';

export interface UseExpensesResult {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreateExpenseInput) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Expense, 'categoryId' | 'amount' | 'date' | 'description' | 'paymentMethod'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useExpenses(): UseExpensesResult {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listExpenses();
      if (requestId !== requestIdRef.current) return;
      setExpenses(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
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
    expenses,
    loading,
    error,
    refresh,
    create: (input) =>
      runMutation(() =>
        createExpense(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'expense',
            entityId: created.id,
            entityLabel: created.description ?? created.category,
            afterValue: { category: created.category, amount: created.amount, date: created.date },
          }).catch(() => {});
        })
      ),
    update: (id, patch) => {
      const before = expenses.find((e) => e.id === id);
      return runMutation(() =>
        updateExpense(id, patch).then(() => {
          logActivity({
            action: 'update',
            entityType: 'expense',
            entityId: id,
            entityLabel: before?.description ?? before?.category ?? 'Expense',
            beforeValue: before ? { category: before.category, amount: before.amount, date: before.date } : null,
            afterValue: { ...before, ...patch },
          }).catch(() => {});
        })
      );
    },
    remove: (id) => {
      const before = expenses.find((e) => e.id === id);
      return runMutation(() =>
        deleteExpense(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'expense',
            entityId: id,
            entityLabel: before?.description ?? before?.category ?? 'Expense',
            beforeValue: before ? { category: before.category, amount: before.amount, date: before.date } : null,
          }).catch(() => {});
        })
      );
    },
  };
}
