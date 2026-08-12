'use client';

import { DOT_COLOR_CLASS } from '@/lib/category-colors';

interface ExpensesFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: { id: string; name: string; colorSlot?: number }[];
}

export function ExpensesFilterBar({ query, onQueryChange, categoryFilter, onCategoryFilterChange, categories }: ExpensesFilterBarProps) {
  const selectedColorSlot = categories.find((category) => category.id === categoryFilter)?.colorSlot;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        data-testid="expenses-search-input"
        aria-label="Search expenses"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search by item or category"
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-900 outline-none focus:border-gold"
      />
      <div className="relative">
        <span
          data-testid="expenses-category-select-swatch"
          aria-hidden="true"
          className={`pointer-events-none absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${selectedColorSlot ? DOT_COLOR_CLASS[selectedColorSlot] : 'bg-neutral-300'}`}
        />
        <select
          data-testid="expenses-category-select"
          aria-label="Filter by category"
          value={categoryFilter}
          onChange={(e) => onCategoryFilterChange(e.target.value)}
          className="min-h-11 w-full rounded-full border border-neutral-200 pl-7 pr-2 text-xs text-neutral-600"
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
