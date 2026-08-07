'use client';

import { useState } from 'react';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { useIsMounted } from '@/lib/use-is-mounted';
import { mockTransactions, mockGoal } from '@/lib/dashboard-data';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';
import { useOverdueAlerts, type AlertItem } from '@/lib/use-overdue-alerts';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { NotificationSettings } from '@/components/dashboard/NotificationSettings';
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
  const [requestedPermission, setRequestedPermission] = useState<NotificationPermission | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const isMounted = useIsMounted();

  // Falls back to 'default' on the server and on the client's first
  // (hydration) render, same as the calendar's isMounted guard — reading
  // Notification.permission any earlier would disagree between server and
  // client and trigger a hydration mismatch.
  const permission: NotificationPermission =
    requestedPermission ?? (isMounted && isNotificationSupported() ? Notification.permission : 'default');

  const overdueBills = getOverdueBills(events);
  const weeklyBills = getBillsDueWithinDays(events, 7);
  const upcomingReminders = getUpcomingReminders(events, 3);

  const alertItems: AlertItem[] = overdueBills.map((bill) => ({
    id: bill.id,
    title: `Overdue: ${bill.title}`,
    body: bill.amount !== undefined ? `₱${bill.amount.toFixed(2)} was due` : 'Payment is overdue',
  }));
  useOverdueAlerts(alertItems, { soundEnabled });

  async function handleRequestPermission() {
    setRequestedPermission(await requestNotificationPermission());
  }

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      <AlertsBanner overdueBills={overdueBills} />
      <NotificationSettings
        permission={permission}
        onRequestPermission={handleRequestPermission}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
      />
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
