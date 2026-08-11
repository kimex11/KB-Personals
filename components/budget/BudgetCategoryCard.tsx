import type { BudgetCategory } from '@/lib/budget-types';
import { BAR_COLOR_CLASS, CARD_TINT_COLOR_CLASS, ICON_BG_COLOR_CLASS, ICON_TEXT_COLOR_CLASS } from '@/lib/category-colors';

export function BudgetCategoryCard({ category }: { category: BudgetCategory }) {
  const { icon: Icon, name, limit, spent, colorSlot } = category;
  const isOverBudget = spent > limit;
  const progress = limit > 0 ? Math.min(spent / limit, 1) * 100 : 0;

  return (
    <div
      data-testid="budget-category-card"
      className={`flex flex-col gap-3 rounded-2xl p-5 ${CARD_TINT_COLOR_CLASS[colorSlot]}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ICON_BG_COLOR_CLASS[colorSlot]}`}>
            <Icon className={`h-5 w-5 ${ICON_TEXT_COLOR_CLASS[colorSlot]}`} />
          </span>
          <span className="text-sm font-medium text-neutral-900">{name}</span>
        </span>
        {isOverBudget && (
          <span data-testid="over-budget-label" className="text-xs font-medium text-status-critical">
            Over budget
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-label={`${name} spending`}
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100"
      >
        <div
          data-testid="progress-bar-fill"
          className={`h-full rounded-full ${isOverBudget ? 'bg-status-critical' : BAR_COLOR_CLASS[colorSlot]}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ₱{spent.toFixed(0)} of ₱{limit.toFixed(0)}
      </span>
    </div>
  );
}
