import type { SavingsGoal } from '@/lib/dashboard-types';

export function GoalProgressPanel({ goal }: { goal: SavingsGoal }) {
  const progress = goal.target > 0 ? Math.min(goal.saved / goal.target, 1) * 100 : 0;

  return (
    <div
      data-testid="goal-progress-panel"
      className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="font-serif text-lg text-neutral-900">{goal.title}</h2>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          data-testid="goal-progress-fill"
          className="h-full rounded-full bg-gold"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-neutral-500">
        ₱{goal.saved.toFixed(0)} of ₱{goal.target.toFixed(0)} saved
      </span>
    </div>
  );
}
