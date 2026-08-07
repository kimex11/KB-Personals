import type { Priority } from '@/lib/reminders-types';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'bg-status-critical/10 text-status-critical',
  medium: 'bg-status-warning/10 text-status-warning',
  low: 'bg-neutral-100 text-neutral-500',
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      data-testid="priority-badge"
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CLASS[priority]}`}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
