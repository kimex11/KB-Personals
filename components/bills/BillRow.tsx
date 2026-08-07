import { Pencil, Trash2 } from 'lucide-react';
import type { Bill } from '@/lib/bills-types';
import { getBillStatus } from '@/lib/bills-selectors';
import { BillStatusBadge } from './BillStatusBadge';
import { Button } from '@/components/ui/button';
import { formatRelativeDate } from '@/lib/date-utils';

const RECURRENCE_LABEL: Record<NonNullable<Bill['recurrence']>, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

interface BillRowProps {
  bill: Bill;
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  isDuplicate?: boolean;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
}

export function BillRow({ bill, onTogglePaid, referenceDate = new Date(), isDuplicate = false, onEdit, onDelete }: BillRowProps) {
  const status = getBillStatus(bill, referenceDate);

  return (
    <div
      data-testid="bill-row"
      className={`flex flex-col gap-2 rounded-2xl border bg-white px-4 py-3 ${
        isDuplicate ? 'border-status-warning' : 'border-neutral-200'
      }`}
    >
      {isDuplicate && (
        <p data-testid="bill-duplicate-warning" className="text-[10px] font-medium text-status-warning">
          Possible duplicate — check for a matching bill nearby
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          data-testid="bill-paid-toggle"
          aria-label={bill.paid ? 'Mark as unpaid' : 'Mark as paid'}
          aria-pressed={bill.paid}
          onClick={() => onTogglePaid(bill.id)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
            bill.paid ? 'border-status-success bg-status-success text-white' : 'border-neutral-300 text-transparent'
          }`}
        >
          ✓
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-neutral-900">{bill.title}</p>
            {bill.recurrence && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">
                {RECURRENCE_LABEL[bill.recurrence]}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500">
            {bill.category} · {formatRelativeDate(bill.dueDate, referenceDate)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-serif text-sm text-neutral-900">₱{bill.amount.toFixed(2)}</span>
          <BillStatusBadge status={status} />
        </div>
        {(onEdit || onDelete) && (
          <div className="flex flex-col gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${bill.title}`} onClick={() => onEdit(bill)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${bill.title}`} onClick={() => onDelete(bill)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
