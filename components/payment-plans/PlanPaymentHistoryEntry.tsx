import { format, parseISO } from 'date-fns';
import type { PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { formatCurrency } from '@/lib/format-currency';

interface PlanPaymentHistoryEntryProps {
  payment: PaymentPlanPayment;
  installmentCount: number;
}

export function PlanPaymentHistoryEntry({ payment, installmentCount }: PlanPaymentHistoryEntryProps) {
  return (
    <div data-testid="plan-payment-history-entry" className="flex flex-col gap-1 rounded-2xl bg-status-success/10 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-neutral-500">
          Installment {payment.installmentNumber} of {installmentCount}
        </span>
        <span className="text-xs text-neutral-500">{format(parseISO(payment.paidAt), "MMM d, yyyy 'at' h:mm a")}</span>
      </div>
      <span className="font-serif text-sm text-status-success">-₱{formatCurrency(payment.amount)}</span>
      <p data-testid="plan-payment-balance-trail" className="text-xs text-neutral-500">
        ₱{formatCurrency(payment.balanceBefore)} → ₱{formatCurrency(payment.balanceAfter)}
      </p>
    </div>
  );
}
