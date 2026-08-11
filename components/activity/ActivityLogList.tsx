import type { AuditLogEntry } from '@/lib/audit-log-repository';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import { EmptyState } from '@/components/shared/EmptyState';

export function ActivityLogList({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState message="No activity recorded yet." />;
  }

  return (
    <div data-testid="activity-log-list" className="flex flex-col gap-2">
      {entries.map((entry) => (
        <ActivityLogEntryTile key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
