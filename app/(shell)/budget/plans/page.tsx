'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePaymentPlans } from '@/lib/use-payment-plans';
import { useCategories } from '@/lib/use-categories';
import { listAllPlanPayments, type PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { PaymentPlansList } from '@/components/payment-plans/PaymentPlansList';
import { PaymentPlanForm } from '@/components/payment-plans/PaymentPlanForm';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function PaymentPlansPage() {
  const isMounted = useIsMounted();
  const { plans, loading: plansLoading, error, create } = usePaymentPlans();
  const { activeCategories, loading: categoriesLoading } = useCategories();
  const [payments, setPayments] = useState<PaymentPlanPayment[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    listAllPlanPayments().then(setPayments).catch(() => {});
  }, []);

  const paymentsByPlanId = payments.reduce<Record<string, PaymentPlanPayment[]>>((acc, payment) => {
    (acc[payment.planId] ??= []).push(payment);
    return acc;
  }, {});

  const loading = plansLoading || categoriesLoading;

  return (
    <div data-testid="payment-plans-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <h1 className="text-lg font-medium text-neutral-900">Payment Plans</h1>

      <Button size="lg" className="min-h-14 w-full text-base" onClick={() => setFormOpen(true)}>
        <Plus className="h-5 w-5" />
        Add Plan
      </Button>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      {isMounted && loading && (
        <p data-testid="payment-plans-loading" className="text-center text-sm text-neutral-400">
          Loading…
        </p>
      )}

      {isMounted && !loading && <PaymentPlansList plans={plans} paymentsByPlanId={paymentsByPlanId} />}

      <PaymentPlanForm open={formOpen} onOpenChange={setFormOpen} categories={activeCategories} onSubmit={create} />
    </div>
  );
}
