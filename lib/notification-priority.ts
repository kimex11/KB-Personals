export type NotificationPriority = 'critical' | 'urgent' | 'reminder';

export const VIBRATION_PATTERNS: Record<NotificationPriority, number[]> = {
  critical: [400, 100, 400, 100, 400],
  urgent: [250, 100, 250],
  reminder: [150],
};

export const REQUIRES_INTERACTION: Record<NotificationPriority, boolean> = {
  critical: true,
  urgent: false,
  reminder: false,
};

export function bypassesQuietHours(priority: NotificationPriority): boolean {
  return priority === 'critical' || priority === 'urgent';
}
