import type { DueStatus } from '@/lib/accounts-types';

const STATUS_LABEL: Record<DueStatus, string> = {
  overdue: 'Overdue',
  'due-soon': 'Due Soon',
  upcoming: 'Upcoming',
};

const STATUS_CLASS: Record<DueStatus, string> = {
  overdue: 'bg-status-critical/10 text-status-critical',
  'due-soon': 'bg-status-warning/10 text-status-warning',
  upcoming: 'bg-neutral-100 text-neutral-500',
};

export function CardDueStatusBadge({ status }: { status: DueStatus }) {
  return (
    <span
      data-testid="card-due-status-badge"
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
