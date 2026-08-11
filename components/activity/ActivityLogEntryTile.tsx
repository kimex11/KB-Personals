import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Upload, Link as LinkIcon, Unlink, SkipForward, Archive, ArchiveRestore, Merge } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AuditAction, AuditLogEntry } from '@/lib/audit-log-repository';

const ACTION_CONFIG: Record<AuditAction, { icon: LucideIcon; label: string; tintClassName: string; iconClassName: string }> = {
  create: { icon: Plus, label: 'Created', tintClassName: 'bg-status-success/10', iconClassName: 'text-status-success' },
  update: { icon: Pencil, label: 'Updated', tintClassName: 'bg-status-warning/10', iconClassName: 'text-status-warning' },
  delete: { icon: Trash2, label: 'Deleted', tintClassName: 'bg-status-critical/10', iconClassName: 'text-status-critical' },
  upload: { icon: Upload, label: 'Uploaded', tintClassName: 'bg-calendar-task/10', iconClassName: 'text-calendar-task' },
  link: { icon: LinkIcon, label: 'Linked', tintClassName: 'bg-calendar-reminder/10', iconClassName: 'text-calendar-reminder' },
  unlink: { icon: Unlink, label: 'Unlinked', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  skip: { icon: SkipForward, label: 'Skipped', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  archive: { icon: Archive, label: 'Archived', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  unarchive: { icon: ArchiveRestore, label: 'Unarchived', tintClassName: 'bg-neutral-100', iconClassName: 'text-neutral-500' },
  merge: { icon: Merge, label: 'Merged', tintClassName: 'bg-gold/10', iconClassName: 'text-gold' },
};

function formatValue(value: Record<string, unknown> | null): string | null {
  if (!value) return null;
  return Object.entries(value)
    .map(([key, val]) => `${key}: ${String(val)}`)
    .join(', ');
}

export function ActivityLogEntryTile({ entry }: { entry: AuditLogEntry }) {
  const config = ACTION_CONFIG[entry.action];
  const Icon = config.icon;
  const before = formatValue(entry.beforeValue);
  const after = formatValue(entry.afterValue);

  return (
    <div data-testid="activity-log-entry" className={`flex flex-col gap-2 rounded-2xl p-4 ${config.tintClassName}`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white ${config.iconClassName}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-900">
            {config.label} <span className="font-normal text-neutral-500">{entry.entityLabel}</span>
          </p>
          <p className="text-xs text-neutral-500">
            {entry.actorEmail} · {format(new Date(entry.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </p>
        </div>
      </div>
      {(before || after) && (
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">Details</summary>
          <div className="mt-1 flex flex-col gap-1 border-t border-white/60 pt-1">
            {before && <p data-testid="activity-log-before">Before: {before}</p>}
            {after && <p data-testid="activity-log-after">After: {after}</p>}
          </div>
        </details>
      )}
    </div>
  );
}
