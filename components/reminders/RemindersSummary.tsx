interface RemindersSummaryProps {
  dueTodayCount: number;
  overdueCount: number;
}

export function RemindersSummary({ dueTodayCount, overdueCount }: RemindersSummaryProps) {
  return (
    <div data-testid="reminders-summary" className="grid grid-cols-2 gap-2">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-neutral-200 bg-white px-2 py-3">
        <span className="text-xs text-neutral-500">Due Today</span>
        <span className="font-serif text-lg text-neutral-900">{dueTodayCount}</span>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-status-critical/30 bg-status-critical/5 px-2 py-3">
        <span className="text-xs text-status-critical">Overdue</span>
        <span className="font-serif text-lg text-status-critical">{overdueCount}</span>
      </div>
    </div>
  );
}
