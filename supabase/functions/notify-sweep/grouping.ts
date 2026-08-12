import type { NotificationPriority } from './priority.ts';

export interface NotifiableItem {
  priority: NotificationPriority;
  title: string;
  amount?: number;
  dueDate: string;
  url: string;
}

export interface GroupedNotification {
  priority: NotificationPriority;
  title: string;
  body: string;
  tag: string;
  url: string;
}

const PRIORITY_VERB: Record<NotificationPriority, string> = {
  critical: 'overdue',
  urgent: 'due soon',
  reminder: 'due',
};

const LIST_URL: Record<NotificationPriority, string> = {
  critical: '/bills',
  urgent: '/bills',
  reminder: '/reminders',
};

const ENTITY_NOUN: Record<NotificationPriority, string> = {
  critical: 'bills',
  urgent: 'bills',
  reminder: 'reminders',
};

export function groupByPriority(items: NotifiableItem[]): GroupedNotification[] {
  const byPriority = new Map<NotificationPriority, NotifiableItem[]>();
  for (const item of items) {
    const list = byPriority.get(item.priority) ?? [];
    list.push(item);
    byPriority.set(item.priority, list);
  }

  const groups: GroupedNotification[] = [];
  for (const [priority, group] of byPriority) {
    if (group.length === 1) {
      const item = group[0];
      const amountText = item.amount !== undefined ? `₱${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` : '';
      groups.push({
        priority,
        title: item.title,
        body: `${amountText}${PRIORITY_VERB[priority]} — ${item.dueDate}`,
        tag: `${priority}-${item.url}`,
        url: item.url,
      });
    } else {
      const total = group.reduce((sum, item) => sum + (item.amount ?? 0), 0);
      const totalText = total > 0 ? `: ₱${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total` : '';
      groups.push({
        priority,
        title: `${group.length} ${ENTITY_NOUN[priority]} ${PRIORITY_VERB[priority]}`,
        body: `${group.map((item) => item.title).join(', ')}${totalText}`,
        tag: `${priority}-group`,
        url: LIST_URL[priority],
      });
    }
  }
  return groups;
}
