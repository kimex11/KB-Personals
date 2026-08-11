'use client';

import type { AuditAction } from '@/lib/audit-log-repository';

const ACTION_FILTERS: { id: AuditAction | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'create', label: 'Created' },
  { id: 'update', label: 'Updated' },
  { id: 'delete', label: 'Deleted' },
  { id: 'upload', label: 'Uploaded' },
  { id: 'link', label: 'Linked' },
  { id: 'unlink', label: 'Unlinked' },
  { id: 'skip', label: 'Skipped' },
  { id: 'archive', label: 'Archived' },
  { id: 'unarchive', label: 'Unarchived' },
  { id: 'merge', label: 'Merged' },
];

const ENTITY_TYPE_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All modules' },
  { id: 'bill', label: 'Bills' },
  { id: 'reminder', label: 'Reminders' },
  { id: 'credit_card_due', label: 'Cards' },
  { id: 'income_source', label: 'Income' },
  { id: 'category', label: 'Categories' },
  { id: 'receipt', label: 'Receipts' },
];

interface ActivityLogFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  actionFilter: AuditAction | 'all';
  onActionFilterChange: (value: AuditAction | 'all') => void;
  entityTypeFilter: string;
  onEntityTypeFilterChange: (value: string) => void;
  dateFrom: string | null;
  onDateFromChange: (value: string | null) => void;
  dateTo: string | null;
  onDateToChange: (value: string | null) => void;
}

export function ActivityLogFilterBar({
  query,
  onQueryChange,
  actionFilter,
  onActionFilterChange,
  entityTypeFilter,
  onEntityTypeFilterChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ActivityLogFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        data-testid="activity-search-input"
        aria-label="Search activity"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by item or actor"
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-gold"
      />
      <div data-testid="activity-filter-chips" className="flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            data-testid={`activity-filter-${filter.id}`}
            aria-pressed={actionFilter === filter.id}
            onClick={() => onActionFilterChange(filter.id)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              actionFilter === filter.id ? 'border-gold bg-gold text-white' : 'border-neutral-200 text-neutral-600'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <select
          data-testid="activity-entity-type-select"
          aria-label="Filter by module"
          value={entityTypeFilter}
          onChange={(e) => onEntityTypeFilterChange(e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        >
          {ENTITY_TYPE_FILTERS.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          data-testid="activity-date-from-input"
          aria-label="From date"
          value={dateFrom ?? ''}
          onChange={(e) => onDateFromChange(e.target.value === '' ? null : e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        />
        <input
          type="date"
          data-testid="activity-date-to-input"
          aria-label="To date"
          value={dateTo ?? ''}
          onChange={(e) => onDateToChange(e.target.value === '' ? null : e.target.value)}
          className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
        />
      </div>
    </div>
  );
}
