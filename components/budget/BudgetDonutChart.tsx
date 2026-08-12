import type { BudgetCategory } from '@/lib/budget-types';
import { STROKE_COLOR_CLASS, DOT_COLOR_CLASS } from '@/lib/category-colors';
import { formatCurrency } from '@/lib/format-currency';

interface BudgetDonutChartProps {
  categories: BudgetCategory[];
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function BudgetDonutChart({ categories }: BudgetDonutChartProps) {
  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);

  const { slices } = categories.reduce<{
    slices: { category: BudgetCategory; dasharray: string; dashoffset: number }[];
    cumulative: number;
  }>(
    (acc, category) => {
      const fraction = totalSpent > 0 ? category.spent / totalSpent : 0;
      const dash = fraction * CIRCUMFERENCE;
      const dashoffset = -acc.cumulative;
      return {
        slices: [...acc.slices, { category, dasharray: `${dash} ${CIRCUMFERENCE - dash}`, dashoffset }],
        cumulative: acc.cumulative + dash,
      };
    },
    { slices: [], cumulative: 0 }
  );

  return (
    <div data-testid="budget-donut-chart">
      <svg viewBox="0 0 100 100" className="mx-auto h-40 w-40 -rotate-90">
        {slices.map(({ category, dasharray, dashoffset }) => (
          <circle
            key={category.id}
            data-testid="donut-slice"
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="16"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            className={STROKE_COLOR_CLASS[category.colorSlot]}
          />
        ))}
      </svg>
      <ul className="mt-4 flex flex-col gap-2">
        {categories.map((category) => (
          <li
            key={category.id}
            data-testid="legend-row"
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${DOT_COLOR_CLASS[category.colorSlot]}`}
                aria-hidden="true"
              />
              <span className="text-neutral-900">{category.name}</span>
            </span>
            <span className="text-neutral-500">₱{formatCurrency(category.spent, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
