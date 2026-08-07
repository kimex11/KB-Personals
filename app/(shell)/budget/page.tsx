'use client';

import { useBudget } from '@/lib/use-budget';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { BudgetDonutChart } from '@/components/budget/BudgetDonutChart';
import { BudgetCategoryCard } from '@/components/budget/BudgetCategoryCard';

export default function BudgetPage() {
  const { categories, totals } = useBudget();

  return (
    <div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <BudgetSummary budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
      <BudgetDonutChart categories={categories} />
      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <BudgetCategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
