import { format, parseISO } from 'date-fns';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';

export function PaymentHistoryEntry({ payment }: { payment: CreditCardPayment }) {
  return (
    <div data-testid="payment-history-entry" className="flex flex-col gap-1 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-between">
        <span className="font-serif text-sm text-status-success">-₱{payment.amount.toFixed(2)}</span>
        <span className="text-xs text-neutral-500">{format(parseISO(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</span>
      </div>
      <p data-testid="payment-balance-trail" className="text-xs text-neutral-500">
        ₱{payment.balanceBefore.toFixed(2)} → ₱{payment.balanceAfter.toFixed(2)}
      </p>
      {payment.method && <p className="text-xs text-neutral-500">{payment.method}</p>}
      {payment.notes && (
        <p data-testid="payment-notes" className="text-xs text-neutral-400">
          {payment.notes}
        </p>
      )}
    </div>
  );
}
