import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { PlanPaymentHistoryEntry } from './PlanPaymentHistoryEntry';
import { EmptyState } from '@/components/shared/EmptyState';

interface PlanPaymentHistoryListProps {
  payments: PaymentPlanPayment[];
  installmentCount: number;
  onEdit?: (payment: PaymentPlanPayment) => void;
  onDelete?: (payment: PaymentPlanPayment) => void;
}

export function PlanPaymentHistoryList({ payments, installmentCount, onEdit, onDelete }: PlanPaymentHistoryListProps) {
  if (payments.length === 0) {
    return <EmptyState message="No payments recorded yet." />;
  }

  return (
    <div data-testid="plan-payment-history-list" className="flex flex-col gap-2">
      {payments.map((payment) => (
        <PlanPaymentHistoryEntry key={payment.id} payment={payment} installmentCount={installmentCount} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
