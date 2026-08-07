import type { BillStatus } from '@/lib/bills-types';

const STATUS_LABEL: Record<BillStatus, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due Soon',
  upcoming: 'Upcoming',
  paid: 'Paid',
};

const STATUS_CLASS: Record<BillStatus, string> = {
  overdue: 'bg-status-critical/10 text-status-critical',
  'due-soon': 'bg-status-warning/10 text-status-warning',
  upcoming: 'bg-neutral-100 text-neutral-500',
  paid: 'bg-status-success/10 text-status-success',
};

export function BillStatusBadge({ status }: { status: BillStatus }) {
  return (
    <span
      data-testid="bill-status-badge"
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
