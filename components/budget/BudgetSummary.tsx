interface BudgetSummaryProps {
  budgeted: number;
  spent: number;
  remaining: number;
}

export function BudgetSummary({ budgeted, spent, remaining }: BudgetSummaryProps) {
  const isNegative = remaining < 0;

  return (
    <div data-testid="budget-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-gold/20 bg-gold/5 px-2 py-3">
        <span className="text-xs text-gold">Budgeted</span>
        <span className="font-serif text-lg text-neutral-900">₱{budgeted.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-neutral-100 px-2 py-3">
        <span className="text-xs text-neutral-500">Spent</span>
        <span className="font-serif text-lg text-neutral-900">₱{spent.toFixed(0)}</span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 ${
          isNegative ? 'border-status-critical/30 bg-status-critical/5' : 'border-status-success/30 bg-status-success/5'
        }`}
      >
        <span className={`text-xs ${isNegative ? 'text-status-critical' : 'text-status-success'}`}>Remaining</span>
        <span className={`font-serif text-lg ${isNegative ? 'text-status-critical' : 'text-status-success'}`}>
          ₱{remaining.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
