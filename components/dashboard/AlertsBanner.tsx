'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { CalendarEvent } from '@/lib/types';
import { formatCurrency } from '@/lib/format-currency';

interface AlertsBannerProps {
  overdueBills: CalendarEvent[];
  referenceDate?: Date;
}

export function AlertsBanner({ overdueBills, referenceDate = new Date() }: AlertsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (overdueBills.length === 0) return null;

  const totalAmount = overdueBills.reduce((sum, bill) => sum + (bill.amount ?? 0), 0);

  return (
    <div
      data-testid="alerts-banner"
      className="flex flex-col gap-2 rounded-2xl border border-status-critical bg-status-critical/10 p-3"
    >
      <button
        type="button"
        data-testid="alerts-banner-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        className="flex min-h-8 w-full items-center justify-between text-left"
      >
        <span className="text-sm font-medium text-status-critical">
          {overdueBills.length} overdue{totalAmount > 0 ? ` · ₱${formatCurrency(totalAmount)}` : ''}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-status-critical" /> : <ChevronDown className="h-4 w-4 text-status-critical" />}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {overdueBills.map((bill) => {
            const daysOverdue = differenceInCalendarDays(referenceDate, parseISO(bill.date));
            return (
              <div key={bill.id} data-testid="overdue-bill-row" className="flex items-center justify-between">
                <span className="text-sm text-neutral-900">{bill.title}</span>
                <span className="text-xs text-status-critical">
                  {daysOverdue} {daysOverdue === 1 ? 'day' : 'days'} overdue
                  {bill.amount !== undefined ? ` · ₱${formatCurrency(bill.amount)}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
