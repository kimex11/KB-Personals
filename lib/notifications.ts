export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function showNotification(title: string, options?: NotificationOptions): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  new Notification(title, options);
}

export function clearAppBadge(): void {
  if (typeof navigator === 'undefined') return;
  const clear = (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge;
  if (typeof clear !== 'function') return;
  clear.call(navigator).catch(() => {});
}
