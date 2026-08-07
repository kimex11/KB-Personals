import type { Transaction } from '@/lib/dashboard-types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';

interface RecentTransactionsPanelProps {
  transactions: Transaction[];
  referenceDate?: Date;
}

export function RecentTransactionsPanel({ transactions, referenceDate = new Date() }: RecentTransactionsPanelProps) {
  return (
    <div data-testid="recent-transactions-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">Recent Transactions</h2>
      {transactions.length === 0 ? (
        <EmptyState message="No recent transactions." />
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              data-testid="transaction-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{txn.title}</p>
                <p className="text-xs text-neutral-500">
                  {txn.category} · {formatRelativeDate(txn.date, referenceDate)}
                </p>
              </div>
              <span className="font-serif text-sm text-neutral-900">₱{txn.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
