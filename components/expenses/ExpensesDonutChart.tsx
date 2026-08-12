import { STROKE_COLOR_CLASS, DOT_COLOR_CLASS } from '@/lib/category-colors';
import { formatCurrency } from '@/lib/format-currency';
import type { Expense } from '@/lib/expenses-repository';
import { groupExpensesByCategory } from '@/lib/expenses-selectors';

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ExpensesDonutChart({ expenses }: { expenses: Expense[] }) {
  const groups = groupExpensesByCategory(expenses);
  if (groups.length === 0) return null;

  const total = groups.reduce((sum, group) => sum + group.total, 0);

  const { slices } = groups.reduce<{
    slices: { categoryId: string; colorSlot: number; dasharray: string; dashoffset: number }[];
    cumulative: number;
  }>(
    (acc, group) => {
      const fraction = total > 0 ? group.total / total : 0;
      const dash = fraction * CIRCUMFERENCE;
      const dashoffset = -acc.cumulative;
      return {
        slices: [...acc.slices, { categoryId: group.categoryId, colorSlot: group.categoryColorSlot, dasharray: `${dash} ${CIRCUMFERENCE - dash}`, dashoffset }],
        cumulative: acc.cumulative + dash,
      };
    },
    { slices: [], cumulative: 0 }
  );

  return (
    <div data-testid="expenses-donut-chart">
      <svg viewBox="0 0 100 100" className="mx-auto h-40 w-40 -rotate-90">
        {slices.map(({ categoryId, colorSlot, dasharray, dashoffset }) => (
          <circle
            key={categoryId}
            data-testid="donut-slice"
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="16"
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            className={STROKE_COLOR_CLASS[colorSlot]}
          />
        ))}
      </svg>
      <ul className="mt-4 flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.categoryId} data-testid="legend-row" className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${DOT_COLOR_CLASS[group.categoryColorSlot]}`} aria-hidden="true" />
              <span className="text-neutral-900">{group.category}</span>
            </span>
            <span className="text-neutral-500">₱{formatCurrency(group.total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
