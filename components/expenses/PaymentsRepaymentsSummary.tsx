import { formatCurrency } from '@/lib/format-currency';

interface PaymentsRepaymentsSummaryProps {
  billsPaidTotal: number;
  billsPaidCount: number;
  repaymentsTotal: number;
  repaymentsCount: number;
}

export function PaymentsRepaymentsSummary({ billsPaidTotal, billsPaidCount, repaymentsTotal, repaymentsCount }: PaymentsRepaymentsSummaryProps) {
  return (
    <div data-testid="payments-repayments-summary" className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Bills Paid</span>
        <span data-testid="summary-bills-paid" className="font-serif text-sm text-neutral-900">
          ₱{formatCurrency(billsPaidTotal)} · {billsPaidCount}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500">Card Repayments</span>
        <span data-testid="summary-repayments" className="font-serif text-sm text-neutral-900">
          ₱{formatCurrency(repaymentsTotal)} · {repaymentsCount}
        </span>
      </div>
    </div>
  );
}
