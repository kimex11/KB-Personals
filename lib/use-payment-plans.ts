'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listPaymentPlans, createPaymentPlan, deletePaymentPlan, type PaymentPlan, type CreatePaymentPlanInput } from './payment-plans-repository';
import { logActivity } from './audit-log-repository';

export interface UsePaymentPlansResult {
  plans: PaymentPlan[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: CreatePaymentPlanInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function usePaymentPlans(): UsePaymentPlansResult {
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listPaymentPlans();
      if (requestId !== requestIdRef.current) return;
      setPlans(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load payment plans');
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
    plans,
    loading,
    error,
    refresh,
    create: (input) =>
      runMutation(() =>
        createPaymentPlan(input).then((created) => {
          logActivity({
            action: 'create',
            entityType: 'payment_plan',
            entityId: created.id,
            entityLabel: created.name,
            afterValue: { name: created.name, totalAmount: created.totalAmount, installmentCount: created.installmentCount },
          }).catch(() => {});
        })
      ),
    remove: (id) => {
      const before = plans.find((p) => p.id === id);
      return runMutation(() =>
        deletePaymentPlan(id).then(() => {
          logActivity({
            action: 'delete',
            entityType: 'payment_plan',
            entityId: id,
            entityLabel: before?.name ?? 'Payment plan',
            beforeValue: before ? { name: before.name, totalAmount: before.totalAmount } : null,
          }).catch(() => {});
        })
      );
    },
  };
}
