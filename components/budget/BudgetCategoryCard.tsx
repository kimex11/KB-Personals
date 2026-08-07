import type { BudgetCategory } from '@/lib/budget-types';

const BAR_COLOR_CLASS: Record<number, string> = {
  1: 'bg-budget-1',
  2: 'bg-budget-2',
  3: 'bg-budget-3',
  4: 'bg-budget-4',
  5: 'bg-budget-5',
  6: 'bg-budget-6',
};

export function BudgetCategoryCard({ category }: { category: BudgetCategory }) {
  const { icon: Icon, name, limit, spent, colorSlot } = category;
  const isOverBudget = spent > limit;
  const progress = Math.min(spent / limit, 1) * 100;

  return (
    <div
      data-testid="budget-category-card"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-900">{name}</span>
        </span>
        {isOverBudget && (
          <span data-testid="over-budget-label" className="text-xs font-medium text-status-critical">
            Over budget
          </span>
        )}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full ${isOverBudget ? 'bg-status-critical' : BAR_COLOR_CLASS[colorSlot]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ${spent.toFixed(0)} of ${limit.toFixed(0)}
      </span>
    </div>
  );
}
