import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/lib/types';

interface AlertsBannerProps {
  overdueBills: CalendarEvent[];
  referenceDate?: Date;
}

export function AlertsBanner({ overdueBills, referenceDate = new Date() }: AlertsBannerProps) {
  if (overdueBills.length === 0) return null;

  return (
    <div
      data-testid="alerts-banner"
      className="flex flex-col gap-2 rounded-2xl border border-status-critical bg-status-critical/10 p-4"
    >
      <p className="text-sm font-medium text-status-critical">Overdue</p>
      <div className="flex flex-col gap-2">
        {overdueBills.map((bill) => {
          const daysOverdue = differenceInCalendarDays(referenceDate, parseISO(bill.date));
          return (
            <div key={bill.id} data-testid="overdue-bill-row" className="flex items-center justify-between">
              <span className="text-sm text-neutral-900">{bill.title}</span>
              <span className="text-xs text-status-critical">
                {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                {bill.amount !== undefined ? ` · ₱${bill.amount.toFixed(2)}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
