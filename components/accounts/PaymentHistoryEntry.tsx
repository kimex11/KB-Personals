import { format, parseISO } from 'date-fns';
import type { CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { formatCurrency } from '@/lib/format-currency';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';

interface PaymentHistoryEntryProps {
  payment: CreditCardPayment;
  onEdit?: (payment: CreditCardPayment) => void;
  onDelete?: (payment: CreditCardPayment) => void;
}

export function PaymentHistoryEntry({ payment, onEdit, onDelete }: PaymentHistoryEntryProps) {
  return (
    <div data-testid="payment-history-entry" className="flex flex-col gap-1 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-between">
        <span className="font-serif text-sm text-status-success">-₱{formatCurrency(payment.amount)}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">{format(parseISO(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</span>
          <RowActionsMenu
            label={`payment of ₱${formatCurrency(payment.amount)}`}
            onEdit={onEdit ? () => onEdit(payment) : undefined}
            onDelete={onDelete ? () => onDelete(payment) : undefined}
          />
        </div>
      </div>
      <p data-testid="payment-balance-trail" className="text-xs text-neutral-500">
        ₱{formatCurrency(payment.balanceBefore)} → ₱{formatCurrency(payment.balanceAfter)}
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
