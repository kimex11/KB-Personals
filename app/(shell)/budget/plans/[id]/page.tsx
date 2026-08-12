'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { usePaymentPlans } from '@/lib/use-payment-plans';
import { usePlanPayments } from '@/lib/use-plan-payments';
import { totalPaidForPlan, remainingBalance, monthsPaid, lastPlanPaymentDate, isPlanFullyPaid } from '@/lib/payment-plan-selectors';
import { PlanProgressSummary } from '@/components/payment-plans/PlanProgressSummary';
import { PlanPaymentHistoryList } from '@/components/payment-plans/PlanPaymentHistoryList';
import { PlanPaymentForm } from '@/components/payment-plans/PlanPaymentForm';
import { ConfirmDeleteDialog } from '@/components/shared/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { useIsMounted } from '@/lib/use-is-mounted';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';

export default function PaymentPlanDetailPage() {
  const params = useParams<{ id: string }>();
  const isMounted = useIsMounted();
  const { plans, loading: plansLoading } = usePaymentPlans();
  const { payments, loading: paymentsLoading, error, recordPayment, updatePayment, deletePayment } = usePlanPayments(params.id);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentPlanPayment | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<PaymentPlanPayment | null>(null);

  const plan = plans.find((p) => p.id === params.id);
  const loading = plansLoading || paymentsLoading;

  function openAddForm() {
    setEditingPayment(undefined);
    setFormOpen(true);
  }

  function openEditForm(payment: PaymentPlanPayment) {
    setEditingPayment(payment);
    setFormOpen(true);
  }

  async function handleSubmit(input: { amount: number; paidAt: string }) {
    if (editingPayment) {
      await updatePayment(editingPayment.id, input);
    } else {
      await recordPayment(input);
    }
  }

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
            fullyPaid={isPlanFullyPaid(plan, payments)}
          />
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
          <PlanPaymentHistoryList payments={payments} installmentCount={plan.installmentCount} onEdit={openEditForm} onDelete={setDeleteTarget} />
          <PlanPaymentForm
            key={`${editingPayment?.id ?? 'new'}-${formOpen}`}
            open={formOpen}
            onOpenChange={setFormOpen}
            defaultAmount={plan.monthlyAmount}
            initialPayment={editingPayment}
            onSubmit={handleSubmit}
          />
          {deleteTarget && (
            <ConfirmDeleteDialog
              open={!!deleteTarget}
              onOpenChange={(open) => !open && setDeleteTarget(null)}
              title="Delete this payment?"
              description="This can't be undone. The plan's remaining balance will be recalculated automatically."
              onConfirm={() => deletePayment(deleteTarget.id)}
            />
          )}
        </>
      )}
    </div>
  );
}
