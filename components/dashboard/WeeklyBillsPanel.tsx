import type { CalendarEvent } from '@/lib/types';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatRelativeDate } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/format-currency';

interface WeeklyBillsPanelProps {
  bills: CalendarEvent[];
  referenceDate?: Date;
  onMarkPaid: (id: string) => void;
}

export function WeeklyBillsPanel({ bills, referenceDate = new Date(), onMarkPaid }: WeeklyBillsPanelProps) {
  return (
    <div data-testid="weekly-bills-panel" className="flex flex-col gap-3">
      <h2 className="font-serif text-lg text-neutral-900">This Week&apos;s Bills</h2>
      {bills.length === 0 ? (
        <EmptyState message="No bills due this week." />
      ) : (
        <div className="flex flex-col gap-2">
          {bills.map((bill) => (
            <div
              key={bill.id}
              data-testid="weekly-bill-row"
              className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">{bill.title}</p>
                <p className="text-xs text-neutral-500">
                  {formatRelativeDate(bill.date, referenceDate)}
                  {bill.amount !== undefined ? ` · ₱${formatCurrency(bill.amount)}` : ''}
                </p>
              </div>
              <button
                type="button"
                data-testid="mark-paid-button"
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700"
                onClick={() => onMarkPaid(bill.id)}
              >
                Mark as Paid
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
