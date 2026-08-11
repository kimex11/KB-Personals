'use client';

import { useMemo, useState } from 'react';
import type { AuditAction, AuditLogEntry } from '@/lib/audit-log-repository';
import { filterAuditLog } from '@/lib/audit-log-selectors';
import { ActivityLogEntryTile } from './ActivityLogEntryTile';
import { ActivityLogFilterBar } from './ActivityLogFilterBar';
import { EmptyState } from '@/components/shared/EmptyState';

export function ActivityLogList({ entries }: { entries: AuditLogEntry[] }) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);

  const visibleEntries = useMemo(
    () => filterAuditLog(entries, { query, actionFilter, entityTypeFilter, dateFrom, dateTo }),
    [entries, query, actionFilter, entityTypeFilter, dateFrom, dateTo]
  );

  return (
    <div data-testid="activity-log-list" className="flex flex-col gap-3">
      <ActivityLogFilterBar
        query={query}
        onQueryChange={setQuery}
        actionFilter={actionFilter}
        onActionFilterChange={setActionFilter}
        entityTypeFilter={entityTypeFilter}
        onEntityTypeFilterChange={setEntityTypeFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />
      {visibleEntries.length === 0 ? (
        <EmptyState message="No activity matches your filters." />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleEntries.map((entry) => (
            <ActivityLogEntryTile key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
