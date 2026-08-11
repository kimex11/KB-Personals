import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { PaymentHistoryEntry } from './PaymentHistoryEntry';
import { EmptyState } from '@/components/shared/EmptyState';

export function PaymentHistoryList({ payments }: { payments: CreditCardPayment[] }) {
  if (payments.length === 0) {
    return <EmptyState message="No payments recorded yet." />;
  }

  return (
    <div data-testid="payment-history-list" className="flex flex-col gap-2">
      {payments.map((payment) => (
        <PaymentHistoryEntry key={payment.id} payment={payment} />
      ))}
    </div>
  );
}
