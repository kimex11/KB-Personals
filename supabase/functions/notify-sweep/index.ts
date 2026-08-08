import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';
import { computeBillState, computeReminderState, type BillRow, type ReminderRow } from './priority.ts';
import { groupByPriority, type NotifiableItem } from './grouping.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PreferencesRow {
  user_id: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  enabled_priorities: string[];
}

interface LogRow {
  user_id: string;
  entity_type: string;
  entity_id: string;
  state_key: string;
}

function isWithinQuietHours(start: string | null, end: string | null, nowMinutes: number): boolean {
  if (!start || !end) return false;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  return nowMinutes >= startMinutes || nowMinutes < endMinutes; // window wraps past midnight
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const todayISO = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();

  const [billsRes, remindersRes, subsRes, prefsRes, logRes] = await Promise.all([
    supabase.from('bills').select('id, title, amount, due_date, paid'),
    supabase.from('reminders').select('id, title, due_date, completed'),
    supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth'),
    supabase.from('notification_preferences').select('user_id, quiet_hours_start, quiet_hours_end, enabled_priorities'),
    supabase.from('notification_log').select('user_id, entity_type, entity_id, state_key'),
  ]);

  const bills = (billsRes.data ?? []) as (BillRow & { title: string; amount: number })[];
  const reminders = (remindersRes.data ?? []) as (ReminderRow & { title: string })[];
  const subscriptions = (subsRes.data ?? []) as PushSubscriptionRow[];
  const preferences = (prefsRes.data ?? []) as PreferencesRow[];
  const sentLog = (logRes.data ?? []) as LogRow[];

  const billStates = bills.map((bill) => computeBillState(bill, todayISO)).filter((s) => s !== null);
  const reminderStates = reminders.map((reminder) => computeReminderState(reminder, todayISO)).filter((s) => s !== null);

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const sub of subscriptions) {
    const list = subscriptionsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subscriptionsByUser.set(sub.user_id, list);
  }

  const logInserts: (LogRow & { priority: string })[] = [];
  const staleSubscriptionIds: string[] = [];

  for (const [userId, userSubs] of subscriptionsByUser) {
    const pref = preferences.find((p) => p.user_id === userId);
    const enabledPriorities = new Set(pref?.enabled_priorities ?? ['critical', 'urgent', 'reminder']);
    const alreadySent = new Set(
      sentLog.filter((l) => l.user_id === userId).map((l) => `${l.entity_type}:${l.entity_id}:${l.state_key}`)
    );
    const inQuietHours = pref ? isWithinQuietHours(pref.quiet_hours_start, pref.quiet_hours_end, nowMinutes) : false;

    const candidates: { item: NotifiableItem; logEntry: LogRow }[] = [];

    // Bills are always critical/urgent, which bypass quiet hours by design.
    for (const state of billStates) {
      const key = `${state.entityType}:${state.entityId}:${state.stateKey}`;
      if (alreadySent.has(key) || !enabledPriorities.has(state.priority)) continue;
      const bill = bills.find((b) => b.id === state.entityId)!;
      candidates.push({
        item: { priority: state.priority, title: bill.title, amount: Number(bill.amount), dueDate: bill.due_date, url: `/bills?open=${bill.id}` },
        logEntry: { user_id: userId, entity_type: 'bill', entity_id: bill.id, state_key: state.stateKey },
      });
    }

    // Reminders are always 'reminder' priority, which respects quiet hours.
    if (!inQuietHours) {
      for (const state of reminderStates) {
        const key = `${state.entityType}:${state.entityId}:${state.stateKey}`;
        if (alreadySent.has(key) || !enabledPriorities.has(state.priority)) continue;
        const reminder = reminders.find((r) => r.id === state.entityId)!;
        candidates.push({
          item: { priority: state.priority, title: reminder.title, dueDate: reminder.due_date, url: `/reminders?open=${reminder.id}` },
          logEntry: { user_id: userId, entity_type: 'reminder', entity_id: reminder.id, state_key: state.stateKey },
        });
      }
    }

    if (candidates.length === 0) continue;

    const groups = groupByPriority(candidates.map((c) => c.item));

    for (const group of groups) {
      const payload = JSON.stringify({ title: group.title, body: group.body, tag: group.tag, url: group.url, priority: group.priority });

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) staleSubscriptionIds.push(sub.id);
        }
      }
    }

    logInserts.push(...candidates.map((c) => ({ ...c.logEntry, priority: c.item.priority })));
  }

  if (logInserts.length > 0) {
    await supabase.from('notification_log').insert(logInserts);
  }
  if (staleSubscriptionIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleSubscriptionIds);
  }

  return new Response(JSON.stringify({ notified: logInserts.length, staleRemoved: staleSubscriptionIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
