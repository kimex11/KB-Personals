'use client';

import { useEffect, useState } from 'react';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useBudget } from '@/lib/use-budget';
import { useBills } from '@/lib/use-bills';
import { useReminders } from '@/lib/use-reminders';
import { useIsMounted } from '@/lib/use-is-mounted';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { toISODateString } from '@/lib/date-utils';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';
import { subscribeToPush, isPushSupported } from '@/lib/push-subscription';
import { getPreferences, upsertPreferences, type NotificationPreferences } from '@/lib/notification-preferences-repository';
import { useOverdueAlerts, type AlertItem } from '@/lib/use-overdue-alerts';
import type { NotificationPriority } from '@/lib/notification-priority';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { NotificationSettings, type NotificationPermissionState } from '@/components/dashboard/NotificationSettings';
import { DashboardCalendarCard } from '@/components/dashboard/DashboardCalendarCard';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { SpendingSnapshot } from '@/components/dashboard/SpendingSnapshot';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { QuickActionsRow } from '@/components/dashboard/QuickActionsRow';

export default function HomePage() {
  const { totals, error: budgetError } = useBudget();
  const { bills, error: billsError, togglePaid } = useBills();
  const { reminders, error: remindersError } = useReminders();
  const { events, getEventsForDate } = useCalendarEvents(bills, reminders);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [requestedPermission, setRequestedPermission] = useState<NotificationPermission | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    quietHoursStart: null,
    quietHoursEnd: null,
    soundEnabled: true,
    enabledPriorities: ['critical', 'urgent', 'reminder'],
  });
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!isMounted) return;
    getPreferences().then(setPreferences);
  }, [isMounted]);

  // Falls back to 'default' on the server and on the client's first
  // (hydration) render, same as the calendar's isMounted guard — reading
  // Notification.permission any earlier would disagree between server and
  // client and trigger a hydration mismatch.
  const permission: NotificationPermissionState =
    requestedPermission ??
    (isMounted ? (isNotificationSupported() ? Notification.permission : isPushSupported() ? 'default' : 'unsupported') : 'default');

  // Only meaningful once isMounted is true (see the gated return below) —
  // computed here regardless since it's a cheap pure calculation, but never
  // rendered until mount, so it can never disagree with server-rendered HTML.
  const now = new Date();
  const paidBillIds = new Set(bills.filter((bill) => bill.paid).map((bill) => bill.id));
  const actionableEvents = events.filter((event) => event.type !== 'bill' || !paidBillIds.has(event.id));
  const overdueBills = getOverdueBills(actionableEvents, now);
  const weeklyBills = getBillsDueWithinDays(actionableEvents, 7, now);
  const dueSoonBills = getBillsDueWithinDays(actionableEvents, 3, now);
  const upcomingReminders = getUpcomingReminders(events, 3, now);
  const dueTodayReminders = events.filter((e) => e.type === 'reminder' && e.date === toISODateString(now));

  const alertItems: AlertItem[] = [
    ...overdueBills.map((bill) => ({
      id: `bill:${bill.id}:overdue`,
      title: `Overdue: ${bill.title}`,
      body: bill.amount !== undefined ? `₱${bill.amount.toFixed(2)} was due` : 'Payment is overdue',
      priority: 'critical' as NotificationPriority,
      entityType: 'bill' as const,
      entityId: bill.id,
      stateKey: 'overdue',
    })),
    ...dueSoonBills.map((bill) => ({
      id: `bill:${bill.id}:due_soon:${bill.date}`,
      title: `Due soon: ${bill.title}`,
      body: bill.amount !== undefined ? `₱${bill.amount.toFixed(2)} due ${bill.date}` : `Due ${bill.date}`,
      priority: 'urgent' as NotificationPriority,
      entityType: 'bill' as const,
      entityId: bill.id,
      stateKey: `due_soon:${bill.date}`,
    })),
    ...dueTodayReminders.map((reminder) => ({
      id: `reminder:${reminder.id}:due:${reminder.date}`,
      title: `Reminder: ${reminder.title}`,
      body: `Due ${reminder.date}`,
      priority: 'reminder' as NotificationPriority,
      entityType: 'reminder' as const,
      entityId: reminder.id,
      stateKey: `due:${reminder.date}`,
    })),
  ];
  useOverdueAlerts(alertItems, { soundEnabled: preferences.soundEnabled });

  async function handleRequestPermission() {
    const result = await requestNotificationPermission();
    setRequestedPermission(result);
    if (result === 'granted') {
      await subscribeToPush();
    }
  }

  function handleToggleSound() {
    const next = { ...preferences, soundEnabled: !preferences.soundEnabled };
    setPreferences(next);
    upsertPreferences(next);
  }

  function handleQuietHoursChange(start: string | null, end: string | null) {
    const next = { ...preferences, quietHoursStart: start, quietHoursEnd: end };
    setPreferences(next);
    upsertPreferences(next);
  }

  function handleTogglePriority(priority: NotificationPriority) {
    const enabled = preferences.enabledPriorities.includes(priority)
      ? preferences.enabledPriorities.filter((p) => p !== priority)
      : [...preferences.enabledPriorities, priority];
    const next = { ...preferences, enabledPriorities: enabled };
    setPreferences(next);
    upsertPreferences(next);
  }

  const error = budgetError ?? billsError ?? remindersError;

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      {isMounted && (
        <>
          {error && <p className="text-sm text-status-critical">{error}</p>}
          <AlertsBanner overdueBills={overdueBills} referenceDate={now} />
          <NotificationSettings
            permission={permission}
            onRequestPermission={handleRequestPermission}
            soundEnabled={preferences.soundEnabled}
            onToggleSound={handleToggleSound}
            quietHoursStart={preferences.quietHoursStart}
            quietHoursEnd={preferences.quietHoursEnd}
            onQuietHoursChange={handleQuietHoursChange}
            enabledPriorities={preferences.enabledPriorities}
            onTogglePriority={handleTogglePriority}
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
