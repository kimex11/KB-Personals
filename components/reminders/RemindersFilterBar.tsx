'use client';

import type { Priority } from '@/lib/reminders-types';

const FILTERS: { id: Priority | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high', label: 'High' },
  { id: 'medium', label: 'Medium' },
  { id: 'low', label: 'Low' },
];

interface RemindersFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  priorityFilter: Priority | 'all';
  onPriorityFilterChange: (value: Priority | 'all') => void;
  sortBy: 'dueDate' | 'priority';
  onSortByChange: (value: 'dueDate' | 'priority') => void;
}

export function RemindersFilterBar({
  query,
  onQueryChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
}: RemindersFilterBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        data-testid="reminders-search-input"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search reminders"
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-gold"
      />
      <div className="flex items-center justify-between gap-2">
        <div data-testid="reminders-filter-chips" className="flex flex-wrap gap-1.5">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              data-testid={`reminders-filter-${filter.id}`}
              aria-pressed={priorityFilter === filter.id}
              onClick={() => onPriorityFilterChange(filter.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                priorityFilter === filter.id ? 'border-gold bg-gold text-white' : 'border-neutral-200 text-neutral-600'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <select
          data-testid="reminders-sort-select"
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'dueDate' | 'priority')}
          className="rounded-full border border-neutral-200 px-2 py-1 text-xs text-neutral-600"
        >
          <option value="dueDate">Due Date</option>
          <option value="priority">Priority</option>
        </select>
      </div>
    </div>
  );
}
