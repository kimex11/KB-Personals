// Pure, dependency-free TypeScript: this file is imported both by the Deno
// Edge Function runtime (index.ts, via a relative import) and directly by
// vitest/Node for testing. Do not add any import here -- that's what keeps
// both runtimes able to load it unmodified.

export type NotificationPriority = 'critical' | 'urgent' | 'reminder';

export const DUE_SOON_WINDOW_DAYS = 3;

export interface EntityState {
  entityType: 'bill' | 'reminder';
  entityId: string;
  priority: NotificationPriority;
  stateKey: string;
}

export interface BillRow {
  id: string;
  due_date: string; // ISO 'yyyy-MM-dd'
  paid: boolean;
}

export interface ReminderRow {
  id: string;
  due_date: string; // ISO 'yyyy-MM-dd'
  completed: boolean;
}

function addDaysToISODate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function computeBillState(bill: BillRow, todayISO: string): EntityState | null {
  if (bill.paid) return null;

  if (bill.due_date < todayISO) {
    return { entityType: 'bill', entityId: bill.id, priority: 'critical', stateKey: 'overdue' };
  }

  const dueSoonEnd = addDaysToISODate(todayISO, DUE_SOON_WINDOW_DAYS);
  if (bill.due_date <= dueSoonEnd) {
    return { entityType: 'bill', entityId: bill.id, priority: 'urgent', stateKey: `due_soon:${bill.due_date}` };
  }

  return null;
}

export function computeReminderState(reminder: ReminderRow, todayISO: string): EntityState | null {
  if (reminder.completed) return null;

  if (reminder.due_date <= todayISO) {
    return { entityType: 'reminder', entityId: reminder.id, priority: 'reminder', stateKey: `due:${reminder.due_date}` };
  }

  return null;
}
