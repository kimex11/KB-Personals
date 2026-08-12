'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { usePaymentPlans } from '@/lib/use-payment-plans';
import { usePlanPayments } from '@/lib/use-plan-payments';
import { totalPaidForPlan, remainingBalance, monthsPaid, lastPlanPaymentDate } from '@/lib/payment-plan-selectors';
import { PlanProgressSummary } from '@/components/payment-plans/PlanProgressSummary';
import { PlanPaymentHistoryList } from '@/components/payment-plans/PlanPaymentHistoryList';
import { PlanPaymentForm } from '@/components/payment-plans/PlanPaymentForm';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';

export default function PaymentPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const isMounted = useIsMounted();
  const { plans, loading: plansLoading } = usePaymentPlans();
  const { payments, loading: paymentsLoading, error, recordPayment } = usePlanPayments(params.id);
  const [formOpen, setFormOpen] = useState(false);

  const plan = plans.find((p) => p.id === params.id);
  const loading = plansLoading || paymentsLoading;

  return (
    <div data-testid="payment-plan-detail-page" className="flex flex-col gap-4 px-4 pb-24 pt-4">
      <div className="flex items-center gap-2">
        <Link href="/budget/plans" aria-label="Back to Payment Plans">
          <Button variant="ghost" size="icon-sm" className="min-h-11 min-w-11">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-lg font-medium text-neutral-900">{plan?.name ?? 'Payment plan'}</h1>
      </div>

      {error && <p className="text-sm text-status-critical">{error}</p>}

      {isMounted && loading && (
        <p data-testid="payment-plan-detail-loading" className="text-center text-sm text-neutral-400">
          Loading…
        </p>
      )}

      {isMounted && !loading && !plan && (
        <p data-testid="payment-plan-not-found" className="text-center text-sm text-neutral-400">
          Payment plan not found.
        </p>
      )}

      {isMounted && !loading && plan && (
        <>
          <PlanProgressSummary
            totalAmount={plan.totalAmount}
            remainingBalance={remainingBalance(plan, payments)}
            totalPaid={totalPaidForPlan(payments)}
            monthsPaid={monthsPaid(payments)}
            installmentCount={plan.installmentCount}
            lastPaymentDate={lastPlanPaymentDate(payments)}
          />
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
          <PlanPaymentHistoryList payments={payments} installmentCount={plan.installmentCount} />
          <PlanPaymentForm open={formOpen} onOpenChange={setFormOpen} defaultAmount={plan.monthlyAmount} onSubmit={recordPayment} />
        </>
      )}
    </div>
  );
}
