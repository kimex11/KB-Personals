import { formatCurrency } from '@/lib/format-currency';

interface ExpensesSummaryProps {
  total: number;
  count: number;
}

export function ExpensesSummary({ total, count }: ExpensesSummaryProps) {
  return (
    <div data-testid="expenses-summary" className="grid grid-cols-2 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-critical/30 bg-status-critical/5 px-2 py-3">
        <span className="text-xs text-status-critical">Total Spent</span>
        <span data-testid="expenses-summary-total" className="font-serif text-lg text-status-critical">
          ₱{formatCurrency(total)}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-neutral-100 px-2 py-3">
        <span className="text-xs text-neutral-500">Expenses Logged</span>
        <span data-testid="expenses-summary-count" className="font-serif text-lg text-neutral-900">
          {count}
        </span>
      </div>
    </div>
  );
}
