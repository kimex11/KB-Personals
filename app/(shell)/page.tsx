'use client';

import { useState } from 'react';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { useBills } from '@/lib/use-bills';
import { useIsMounted } from '@/lib/use-is-mounted';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';
import { useOverdueAlerts, type AlertItem } from '@/lib/use-overdue-alerts';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { NotificationSettings } from '@/components/dashboard/NotificationSettings';
import { DashboardCalendarCard } from '@/components/dashboard/DashboardCalendarCard';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { SpendingSnapshot } from '@/components/dashboard/SpendingSnapshot';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';

export default function HomePage() {
  const { events, getEventsForDate } = useCalendarEvents();
  const { totals } = useBudget();
  const { bills, togglePaid } = useBills();
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

  // Only meaningful once isMounted is true (see the gated return below) —
  // computed here regardless since it's a cheap pure calculation, but never
  // rendered until mount, so it can never disagree with server-rendered HTML.
  const now = new Date();
  const overdueBills = getOverdueBills(events, now);
  const paidBillIds = new Set(bills.filter((bill) => bill.paid).map((bill) => bill.id));
  const weeklyBills = getBillsDueWithinDays(events, 7, now).filter((event) => !paidBillIds.has(event.id));
  const upcomingReminders = getUpcomingReminders(events, 3, now);

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
      {isMounted && (
        <>
          <AlertsBanner overdueBills={overdueBills} referenceDate={now} />
          <NotificationSettings
            permission={permission}
            onRequestPermission={handleRequestPermission}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
          />
          <DashboardCalendarCard
            getEventsForDate={getEventsForDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <WeeklyBillsPanel bills={weeklyBills} referenceDate={now} onMarkPaid={togglePaid} />
          <SpendingSnapshot budgeted={totals.budgeted} spent={totals.spent} remaining={totals.remaining} />
          <RemindersPanel reminders={upcomingReminders} referenceDate={now} />
          <QuickActionsRow />
        </>
      )}
    </div>
  );
}
