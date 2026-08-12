import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { PaymentHistoryEntry } from './PaymentHistoryEntry';
import { EmptyState } from '@/components/shared/EmptyState';

interface PaymentHistoryListProps {
  payments: CreditCardPayment[];
  onEdit?: (payment: CreditCardPayment) => void;
  onDelete?: (payment: CreditCardPayment) => void;
}

export function PaymentHistoryList({ payments, onEdit, onDelete }: PaymentHistoryListProps) {
  if (payments.length === 0) {
    return <EmptyState message="No payments recorded yet." />;
  }

  return (
    <div data-testid="payment-history-list" className="flex flex-col gap-2">
      {payments.map((payment) => (
        <PaymentHistoryEntry key={payment.id} payment={payment} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
