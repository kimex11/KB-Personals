import Link from 'next/link';
import { ExpensesSummary } from '@/components/expenses/ExpensesSummary';

interface ExpenseTrackerSummaryProps {
  total: number;
  count: number;
}

export function ExpenseTrackerSummary({ total, count }: ExpenseTrackerSummaryProps) {
  return (
    <div
      data-testid="expense-tracker-summary"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-neutral-900">Expense Tracker Summary</h2>
        <Link href="/budget" className="text-xs font-medium text-gold">
          View Expenses
        </Link>
      </div>
      {count === 0 ? (
        <p className="text-sm text-neutral-400">No expenses logged yet</p>
      ) : (
        <ExpensesSummary total={total} count={count} />
      )}
    </div>
  );
}
