import type { PaymentPlan } from '@/lib/payment-plans-repository';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { PaymentPlanTile } from './PaymentPlanTile';
import { EmptyState } from '@/components/shared/EmptyState';

interface PaymentPlansListProps {
  plans: PaymentPlan[];
  paymentsByPlanId: Record<string, PaymentPlanPayment[]>;
}

export function PaymentPlansList({ plans, paymentsByPlanId }: PaymentPlansListProps) {
  if (plans.length === 0) {
    return <EmptyState message="No payment plans yet." />;
  }

  return (
    <div className="flex flex-col gap-2">
      {plans.map((plan) => (
        <PaymentPlanTile key={plan.id} plan={plan} payments={paymentsByPlanId[plan.id] ?? []} />
      ))}
    </div>
  );
}
