import type { Bill, BillStatus } from '@/lib/bills-types';
import { getBillStatus } from '@/lib/bills-selectors';
import { BillStatusBadge } from './BillStatusBadge';
import { RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { formatRelativeDate } from '@/lib/date-utils';

const RECURRENCE_LABEL: Record<NonNullable<Bill['recurrence']>, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const STATUS_ACCENT_BORDER: Record<BillStatus, string> = {
  overdue: 'border-l-status-critical',
  'due-soon': 'border-l-status-warning',
  paid: 'border-l-status-success',
  upcoming: 'border-l-neutral-200',
};

const STATUS_CARD_BG: Record<BillStatus, string> = {
  overdue: 'bg-status-critical/5',
  'due-soon': 'bg-status-warning/5',
  paid: 'bg-status-success/5',
  upcoming: 'bg-white',
};

const STATUS_AMOUNT_COLOR: Record<BillStatus, string> = {
  overdue: 'text-status-critical',
  'due-soon': 'text-status-warning',
  paid: 'text-status-success',
  upcoming: 'text-neutral-900',
};

interface BillRowProps {
  bill: Bill;
  onTogglePaid: (id: string) => void;
  referenceDate?: Date;
  isDuplicate?: boolean;
  onEdit?: (bill: Bill) => void;
  onDelete?: (bill: Bill) => void;
  onSkip?: (bill: Bill) => void;
}

export function BillRow({ bill, onTogglePaid, referenceDate = new Date(), isDuplicate = false, onEdit, onDelete, onSkip }: BillRowProps) {
  const status = getBillStatus(bill, referenceDate);

  return (
    <div
      data-testid="bill-row"
      className={`flex flex-col gap-2 rounded-2xl border border-l-4 px-4 py-3 ${STATUS_CARD_BG[status]} ${
        isDuplicate ? 'border-status-warning' : `border-neutral-200 ${STATUS_ACCENT_BORDER[status]}`
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
          <span data-testid="bill-amount" className={`font-serif text-sm ${STATUS_AMOUNT_COLOR[status]}`}>
            ₱{bill.amount.toFixed(2)}
          </span>
          <BillStatusBadge status={status} />
        </div>
        <RowActionsMenu
          label={bill.title}
          onEdit={onEdit ? () => onEdit(bill) : undefined}
          onDelete={onDelete ? () => onDelete(bill) : undefined}
          onSkip={onSkip && bill.seriesId && !bill.paid ? () => onSkip(bill) : undefined}
        />
      </div>
    </div>
  );
}
