'use client';

import { useState } from 'react';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { useIsMounted } from '@/lib/use-is-mounted';
import { mockTransactions, mockGoal } from '@/lib/dashboard-data';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { DashboardCalendarCard } from '@/components/dashboard/DashboardCalendarCard';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { SpendingSnapshot } from '@/components/dashboard/SpendingSnapshot';
import { RecentTransactionsPanel } from '@/components/dashboard/RecentTransactionsPanel';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { GoalProgressPanel } from '@/components/dashboard/GoalProgressPanel';
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';

export default function HomePage() {
  const { events, getEventsForDate } = useCalendarEvents();
  const { totals } = useBudget();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isMounted = useIsMounted();

  const overdueBills = getOverdueBills(events);
  const weeklyBills = getBillsDueWithinDays(events, 7);
  const upcomingReminders = getUpcomingReminders(events, 3);

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <AlertsBanner overdueBills={overdueBills} />
      {isMounted && (
        <DashboardCalendarCard
          getEventsForDate={getEventsForDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      )}
      <WeeklyBillsPanel bills={weeklyBills} />
      <SpendingSnapshot budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
      <RecentTransactionsPanel transactions={mockTransactions} />
      <RemindersPanel reminders={upcomingReminders} />
      <GoalProgressPanel goal={mockGoal} />
      <QuickActionsRow />
    </div>
  );
}
