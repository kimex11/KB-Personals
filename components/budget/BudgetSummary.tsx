interface BudgetSummaryProps {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function BudgetSummary({ budgeted, spent, remaining }: BudgetSummaryProps) {
  return (
    <div data-testid="budget-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Budgeted</span>
        <span className="font-serif text-lg text-neutral-900">${budgeted.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Spent</span>
        <span className="font-serif text-lg text-neutral-900">${spent.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Remaining</span>
        <span
          className={`font-serif text-lg ${remaining < 0 ? 'text-status-critical' : 'text-neutral-900'}`}
        >
          ${remaining.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
