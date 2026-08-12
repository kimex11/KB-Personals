'use client';

interface ExpensesFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categories: { id: string; name: string }[];
}

export function ExpensesFilterBar({ query, onQueryChange, categoryFilter, onCategoryFilterChange, categories }: ExpensesFilterBarProps) {
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
      <select
        data-testid="expenses-category-select"
        aria-label="Filter by category"
        value={categoryFilter}
        onChange={(e) => onCategoryFilterChange(e.target.value)}
        className="min-h-11 rounded-full border border-neutral-200 px-2 text-xs text-neutral-600"
      >
        <option value="all">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
    </div>
  );
}
