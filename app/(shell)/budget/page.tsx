'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useBudget } from '@/lib/use-budget';
import { BudgetSummary } from '@/components/budget/BudgetSummary';
import { BudgetDonutChart } from '@/components/budget/BudgetDonutChart';
import { BudgetCategoryCard } from '@/components/budget/BudgetCategoryCard';

export default function BudgetPage() {
  const { categories, totals } = useBudget();

  return (
    <div data-testid="budget-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <div className="flex justify-end">
        <Link href="/budget/categories" aria-label="Manage Categories" className="text-neutral-500">
          <Settings className="h-5 w-5" />
        </Link>
      </div>
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
