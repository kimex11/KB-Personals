import Link from 'next/link';

interface SpendingSnapshotProps {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function SpendingSnapshot({ budgeted, spent, remaining }: SpendingSnapshotProps) {
  const progress = budgeted > 0 ? Math.min(spent / budgeted, 1) * 100 : 0;

  return (
    <div
      data-testid="spending-snapshot"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-neutral-900">Spending Snapshot</h2>
        <Link href="/budget" className="text-xs font-medium text-gold">
          View Budget
        </Link>
      </div>
      <p className="text-sm text-neutral-500">
        ₱{spent.toFixed(0)} of ₱{budgeted.toFixed(0)} spent
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="spending-progress-fill"
          className={`h-full rounded-full ${remaining < 0 ? 'bg-status-critical' : 'bg-gold'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={`text-xs ${remaining < 0 ? 'text-status-critical' : 'text-neutral-500'}`}>
        ₱{remaining.toFixed(0)} remaining
      </span>
    </div>
  );
}
