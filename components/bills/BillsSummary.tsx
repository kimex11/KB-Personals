import { formatCurrency } from '@/lib/format-currency';

interface BillsSummaryProps {
  monthlyTotal: number;
  overdueCount: number;
  dueSoonCount: number;
}

export function BillsSummary({ monthlyTotal, overdueCount, dueSoonCount }: BillsSummaryProps) {
  return (
    <div data-testid="bills-summary" className="grid grid-cols-3 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-gold/20 bg-gold/5 px-2 py-3">
        <span className="text-xs text-gold">This Month</span>
        <span className="font-serif text-lg text-neutral-900">₱{formatCurrency(monthlyTotal, 0)}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-critical/30 bg-status-critical/5 px-2 py-3">
        <span className="text-xs text-status-critical">Overdue</span>
        <span className="font-serif text-lg text-status-critical">{overdueCount}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-warning/30 bg-status-warning/5 px-2 py-3">
        <span className="text-xs text-status-warning">Due Soon</span>
        <span className="font-serif text-lg text-status-warning">{dueSoonCount}</span>
      </div>
    </div>
  );
}
