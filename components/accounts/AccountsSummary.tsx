import { formatCurrency } from '@/lib/format-currency';

interface AccountsSummaryProps {
  totalDue: number;
  totalIncome: number;
}

export function AccountsSummary({ totalDue, totalIncome }: AccountsSummaryProps) {
  const net = totalIncome - totalDue;
  const isNegative = net < 0;

  return (
    <div data-testid="accounts-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-critical/30 bg-status-critical/5 px-2 py-3">
        <span className="text-xs text-status-critical">Card Dues</span>
        <span className="font-serif text-lg text-status-critical">₱{formatCurrency(totalDue)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-success/30 bg-status-success/5 px-2 py-3">
        <span className="text-xs text-status-success">Income</span>
        <span className="font-serif text-lg text-status-success">₱{formatCurrency(totalIncome, 0)}</span>
      </div>
      <div
        className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 ${
          isNegative ? 'border-status-critical/30 bg-status-critical/5' : 'border-status-success/30 bg-status-success/5'
        }`}
      >
        <span className={`text-xs ${isNegative ? 'text-status-critical' : 'text-status-success'}`}>Net</span>
        <span
          data-testid="accounts-net"
          className={`font-serif text-lg ${isNegative ? 'text-status-critical' : 'text-status-success'}`}
        >
          ₱{formatCurrency(net, 0)}
        </span>
      </div>
    </div>
  );
}
