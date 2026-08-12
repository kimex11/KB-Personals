import { format, parseISO } from 'date-fns';
import { formatCurrency } from '@/lib/format-currency';

interface PlanProgressSummaryProps {
  totalAmount: number;
  remainingBalance: number;
  totalPaid: number;
  monthsPaid: number;
  installmentCount: number;
  lastPaymentDate: string | null;
  fullyPaid?: boolean;
}

export function PlanProgressSummary({
  totalAmount,
  remainingBalance,
  totalPaid,
  monthsPaid,
  installmentCount,
  lastPaymentDate,
  fullyPaid = false,
}: PlanProgressSummaryProps) {
  const monthsLeft = Math.max(installmentCount - monthsPaid, 0);

  return (
    <div data-testid="plan-progress-summary" className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      {fullyPaid && (
        <span
          data-testid="plan-fully-paid-badge"
          className="w-fit rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success"
        >
          Fully Paid
        </span>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total Amount</span>
        <span data-testid="summary-total-amount" className="font-serif text-sm text-neutral-900">
          ₱{formatCurrency(totalAmount)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Remaining Balance</span>
        <span data-testid="summary-remaining-balance" className="font-serif text-sm text-neutral-900">
          ₱{formatCurrency(remainingBalance)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Total Paid</span>
        <span data-testid="summary-total-paid" className="font-serif text-sm text-status-success">
          ₱{formatCurrency(totalPaid)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Payments Made</span>
        <span data-testid="summary-payments-made" className="font-serif text-sm text-neutral-900">
          {monthsPaid} of {installmentCount} ({monthsLeft} left)
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Last Payment</span>
        <span data-testid="summary-last-payment" className="text-xs text-neutral-700">
          {lastPaymentDate ? format(parseISO(lastPaymentDate), 'MMM d, yyyy') : 'No payments yet'}
        </span>
      </div>
    </div>
  );
}
