'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCalendarEvents } from '@/lib/use-calendar-events';
import { useExpenses } from '@/lib/use-expenses';
import { totalExpenses } from '@/lib/expenses-selectors';
import { useBills } from '@/lib/use-bills';
import { useReminders } from '@/lib/use-reminders';
import { useAccounts } from '@/lib/use-accounts';
import { usePaymentPlans } from '@/lib/use-payment-plans';
import { listAllCreditCardPayments, type CreditCardPayment } from '@/lib/credit-card-payments-repository';
import { listAllPlanPayments, type PaymentPlanPayment } from '@/lib/payment-plan-payments-repository';
import { useIsMounted } from '@/lib/use-is-mounted';
import { getOverdueBills, getBillsDueWithinDays, getUpcomingReminders } from '@/lib/dashboard-selectors';
import { toISODateString } from '@/lib/date-utils';
import { formatCurrency } from '@/lib/format-currency';
import { isNotificationSupported, requestNotificationPermission } from '@/lib/notifications';
import { subscribeToPush, isPushSupported } from '@/lib/push-subscription';
import { getPreferences, upsertPreferences, type NotificationPreferences } from '@/lib/notification-preferences-repository';
import { useOverdueAlerts, type AlertItem } from '@/lib/use-overdue-alerts';
import type { NotificationPriority } from '@/lib/notification-priority';
import { AlertsBanner } from '@/components/dashboard/AlertsBanner';
import { NotificationSettings, type NotificationPermissionState } from '@/components/dashboard/NotificationSettings';
import { DashboardCalendarCard } from '@/components/dashboard/DashboardCalendarCard';
import { WeeklyBillsPanel } from '@/components/dashboard/WeeklyBillsPanel';
import { ExpenseTrackerSummary } from '@/components/dashboard/ExpenseTrackerSummary';
import { RemindersPanel } from '@/components/dashboard/RemindersPanel';
import { LauncherTiles, type LauncherTileData } from '@/components/dashboard/LauncherTiles';

export default function HomePage() {
  const { expenses } = useExpenses();
  const { bills, error: billsError, togglePaid } = useBills();
  const { reminders, error: remindersError } = useReminders();
  const { cards } = useAccounts();
  const { plans } = usePaymentPlans();
  const [cardPayments, setCardPayments] = useState<CreditCardPayment[]>([]);
  const [planPayments, setPlanPayments] = useState<PaymentPlanPayment[]>([]);
  const { events, getEventsForDate } = useCalendarEvents(bills, reminders, { expenses, cardPayments, cards, planPayments, plans });
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [requestedPermission, setRequestedPermission] = useState<NotificationPermission | null>(null);
  const [pushSubscriptionError, setPushSubscriptionError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    quietHoursStart: null,
    quietHoursEnd: null,
    soundEnabled: true,
    enabledPriorities: ['critical', 'urgent', 'reminder'],
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const isMounted = useIsMounted();

  useEffect(() => {
    if (!isMounted) return;
    getPreferences().then(setPreferences);
  }, [isMounted]);

  useEffect(() => {
    listAllCreditCardPayments().then(setCardPayments).catch(() => {});
    listAllPlanPayments().then(setPlanPayments).catch(() => {});
  }, []);

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
  const upcomingReminders = getUpcomingReminders(events, 3, now);

  // Memoized on [bills, events] rather than rebuilt every render: this feeds
  // useOverdueAlerts below, whose effect re-runs (and re-queries
  // notification_log via listSentStateKeys) whenever this array's identity
  // changes. Without memoizing, unrelated re-renders — selecting a calendar
  // date, a budget refresh — would rebuild a fresh array each time and
  // trigger a redundant Supabase round trip on every render.
  const alertItems = useMemo<AlertItem[]>(() => {
    const referenceNow = new Date();
    const paidIds = new Set(bills.filter((bill) => bill.paid).map((bill) => bill.id));
    const actionable = events.filter((event) => event.type !== 'bill' || !paidIds.has(event.id));
    const overdue = getOverdueBills(actionable, referenceNow);
    const dueSoon = getBillsDueWithinDays(actionable, 3, referenceNow);
    const dueToday = events.filter((e) => e.type === 'reminder' && e.date === toISODateString(referenceNow));

    return [
      ...overdue.map((bill) => ({
        id: `bill:${bill.id}:overdue`,
        title: `Overdue: ${bill.title}`,
        body: bill.amount !== undefined ? `₱${formatCurrency(bill.amount)} was due` : 'Payment is overdue',
        priority: 'critical' as NotificationPriority,
        entityType: 'bill' as const,
        entityId: bill.id,
        stateKey: 'overdue',
      })),
      ...dueSoon.map((bill) => ({
        id: `bill:${bill.id}:due_soon:${bill.date}`,
        title: `Due soon: ${bill.title}`,
        body: bill.amount !== undefined ? `₱${formatCurrency(bill.amount)} due ${bill.date}` : `Due ${bill.date}`,
        priority: 'urgent' as NotificationPriority,
        entityType: 'bill' as const,
        entityId: bill.id,
        stateKey: `due_soon:${bill.date}`,
      })),
      ...dueToday.map((reminder) => ({
        id: `reminder:${reminder.id}:due:${reminder.date}`,
        title: `Reminder: ${reminder.title}`,
        body: `Due ${reminder.date}`,
        priority: 'reminder' as NotificationPriority,
        entityType: 'reminder' as const,
        entityId: reminder.id,
        stateKey: `due:${reminder.date}`,
      })),
    ];
  }, [bills, events]);
  useOverdueAlerts(alertItems, { soundEnabled: preferences.soundEnabled });

  const launcherTiles: LauncherTileData[] = [
    {
      id: 'bills',
      label: 'Bills',
      stat: overdueBills.length > 0 ? `${overdueBills.length} overdue` : weeklyBills.length > 0 ? `${weeklyBills.length} due this week` : 'All caught up',
      href: '/bills',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      stat: upcomingReminders.length > 0 ? `${upcomingReminders.length} upcoming` : 'Nothing upcoming',
      href: '/reminders',
    },
    {
      id: 'budget',
      label: 'Expenses',
      stat: expenses.length > 0 ? `₱${formatCurrency(totalExpenses(expenses), 0)} · ${expenses.length} logged` : 'No expenses yet',
      href: '/budget',
    },
    {
      id: 'accounts',
      label: 'Accounts',
      stat: cards.length === 1 ? '1 card linked' : `${cards.length} cards linked`,
      href: '/accounts',
    },
    {
      id: 'receipts',
      label: 'Receipts',
      stat: 'Scan a new receipt',
      href: '/receipts',
    },
  ];

  async function handleRequestPermission() {
    setPushSubscriptionError(null);
    const result = await requestNotificationPermission();
    setRequestedPermission(result);
    if (result === 'granted') {
      const subscribed = await subscribeToPush();
      if (!subscribed) {
        setPushSubscriptionError(
          "Notifications are enabled, but this device couldn't register for background alerts. In-app alerts will still work while the app is open."
        );
      }
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

  const error = billsError ?? remindersError;

  return (
    <div data-testid="home-page" className="flex flex-col gap-6 px-4 pb-24 pt-4">
      {isMounted && (
        <>
          <div className="flex items-center justify-between">
            {error ? <p className="text-sm text-status-critical">{error}</p> : <span />}
            <button
              type="button"
              data-testid="notification-settings-trigger"
              aria-label="Notification settings"
              onClick={() => setNotificationsOpen(true)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-neutral-400"
            >
              {permission === 'granted' ? <Bell className="h-5 w-5 text-gold" /> : <BellOff className="h-5 w-5" />}
            </button>
          </div>
          <AlertsBanner overdueBills={overdueBills} referenceDate={now} />
          {pushSubscriptionError && (
            <p data-testid="push-subscription-error" className="text-sm text-status-warning">
              {pushSubscriptionError}
            </p>
          )}
          <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Notification Settings</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-4">
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
              </div>
            </SheetContent>
          </Sheet>
          <DashboardCalendarCard
            getEventsForDate={getEventsForDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <WeeklyBillsPanel bills={weeklyBills} referenceDate={now} onMarkPaid={togglePaid} />
          <ExpenseTrackerSummary total={totalExpenses(expenses)} count={expenses.length} />
          <RemindersPanel reminders={upcomingReminders} referenceDate={now} />
          <LauncherTiles tiles={launcherTiles} />
        </>
      )}
    </div>
  );
}
