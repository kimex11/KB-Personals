interface AccountsSummaryProps {
  totalDue: number;
  totalMonthlyIncome: number;
}

export function AccountsSummary({ totalDue, totalMonthlyIncome }: AccountsSummaryProps) {
  const net = totalMonthlyIncome - totalDue;

  return (
    <div data-testid="accounts-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-critical/30 bg-status-critical/5 px-2 py-3">
        <span className="text-xs text-status-critical">Card Dues</span>
        <span className="font-serif text-lg text-status-critical">₱{totalDue.toFixed(2)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-success/30 bg-status-success/5 px-2 py-3">
        <span className="text-xs text-status-success">Income</span>
        <span className="font-serif text-lg text-status-success">₱{totalMonthlyIncome.toFixed(0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Net</span>
        <span
          data-testid="accounts-net"
          className={`font-serif text-lg ${net < 0 ? 'text-status-critical' : 'text-status-success'}`}
        >
          ₱{net.toFixed(0)}
        </span>
      </div>
    </div>
  );
}
