import { format, parseISO } from 'date-fns';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { formatCurrency } from '@/lib/format-currency';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';

interface PlanPaymentHistoryEntryProps {
  payment: PaymentPlanPayment;
  installmentCount: number;
  onEdit?: (payment: PaymentPlanPayment) => void;
  onDelete?: (payment: PaymentPlanPayment) => void;
}

export function PlanPaymentHistoryEntry({ payment, installmentCount, onEdit, onDelete }: PlanPaymentHistoryEntryProps) {
  return (
    <div data-testid="plan-payment-history-entry" className="flex flex-col gap-1 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          Installment {payment.installmentNumber} of {installmentCount}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">{format(parseISO(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</span>
          <RowActionsMenu
            label={`installment ${payment.installmentNumber}`}
            onEdit={onEdit ? () => onEdit(payment) : undefined}
            onDelete={onDelete ? () => onDelete(payment) : undefined}
          />
        </div>
      </div>
      <span className="font-serif text-sm text-status-success">-₱{formatCurrency(payment.amount)}</span>
      <p data-testid="plan-payment-balance-trail" className="text-xs text-neutral-500">
        ₱{formatCurrency(payment.balanceBefore)} → ₱{formatCurrency(payment.balanceAfter)}
      </p>
    </div>
  );
}
