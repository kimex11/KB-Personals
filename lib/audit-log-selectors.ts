import type { AuditAction, AuditLogEntry } from './audit-log-repository';

export interface AuditLogFilters {
  query: string;
  actionFilter: AuditAction | 'all';
  entityTypeFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
}

export function filterAuditLog(entries: AuditLogEntry[], filters: AuditLogFilters): AuditLogEntry[] {
  const q = filters.query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesQuery = q === '' || entry.entityLabel.toLowerCase().includes(q) || entry.actorEmail.toLowerCase().includes(q);
    const matchesAction = filters.actionFilter === 'all' || entry.action === filters.actionFilter;
    const matchesEntityType = filters.entityTypeFilter === 'all' || entry.entityType === filters.entityTypeFilter;
    const entryDate = entry.createdAt.slice(0, 10);
    const matchesFrom = !filters.dateFrom || entryDate >= filters.dateFrom;
    const matchesTo = !filters.dateTo || entryDate <= filters.dateTo;
    return matchesQuery && matchesAction && matchesEntityType && matchesFrom && matchesTo;
  });
}
