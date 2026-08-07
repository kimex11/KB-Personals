'use client';

import type { BillStatus } from '@/lib/bills-types';

const FILTERS: { id: BillStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due-soon', label: 'Due Soon' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'paid', label: 'Paid' },
];

interface BillsFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: BillStatus | 'all';
  onStatusFilterChange: (value: BillStatus | 'all') => void;
  sortBy: 'dueDate' | 'amount';
  onSortByChange: (value: 'dueDate' | 'amount') => void;
}

export function BillsFilterBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortByChange,
}: BillsFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        data-testid="bills-search-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search bills"
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-gold"
      />
      <div className="flex items-center justify-between gap-2">
        <div data-testid="bills-filter-chips" className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              data-testid={`bills-filter-${filter.id}`}
              aria-pressed={statusFilter === filter.id}
              onClick={() => onStatusFilterChange(filter.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                statusFilter === filter.id ? 'border-gold bg-gold text-white' : 'border-neutral-200 text-neutral-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <select
          data-testid="bills-sort-select"
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'dueDate' | 'amount')}
          className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600"
        >
          <option value="dueDate">Due Date</option>
          <option value="amount">Amount</option>
        </select>
      </div>
    </div>
  );
}
