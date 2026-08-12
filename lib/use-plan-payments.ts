'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listPaymentsForPlan, recordPlanPayment, type PaymentPlanPayment, type RecordPlanPaymentInput } from './payment-plan-payments-repository';

export interface UsePlanPaymentsResult {
  payments: PaymentPlanPayment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  recordPayment: (input: RecordPlanPaymentInput) => Promise<void>;
}

export function usePlanPayments(planId: string): UsePlanPaymentsResult {
  const [payments, setPayments] = useState<PaymentPlanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listPaymentsForPlan(planId);
      if (requestId !== requestIdRef.current) return;
      setPayments(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load payment history');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [planId]);

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
    payments,
    loading,
    error,
    refresh,
    recordPayment: (input) => runMutation(() => recordPlanPayment(planId, input)),
  };
}
