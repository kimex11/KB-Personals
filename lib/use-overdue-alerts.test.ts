import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOverdueAlerts } from './use-overdue-alerts';
import type { AlertItem } from './use-overdue-alerts';

vi.mock('./notifications', () => ({
  showNotification: vi.fn(),
  clearAppBadge: vi.fn(),
}));
vi.mock('./notification-sound', () => ({
  playNotificationSound: vi.fn(),
}));

import { showNotification, clearAppBadge } from './notifications';
import { playNotificationSound } from './notification-sound';

const items: AlertItem[] = [
  { id: 'bill-1', title: 'Overdue: Rent', body: '₱1450.00 was due 5 days ago' },
  { id: 'bill-2', title: 'Overdue: Internet', body: '₱59.99 was due 2 days ago' },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('navigator', { ...navigator, vibrate: vi.fn(), setAppBadge: vi.fn().mockResolvedValue(undefined) });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useOverdueAlerts', () => {
  it('fires a notification for each new alert item', () => {
    renderHook(() => useOverdueAlerts(items));
    expect(showNotification).toHaveBeenCalledWith('Overdue: Rent', { body: '₱1450.00 was due 5 days ago' });
    expect(showNotification).toHaveBeenCalledWith('Overdue: Internet', { body: '₱59.99 was due 2 days ago' });
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('does not re-notify for the same item across renders', () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    rerender({ items });
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('plays a sound when soundEnabled is true (default)', () => {
    renderHook(() => useOverdueAlerts(items));
    expect(playNotificationSound).toHaveBeenCalled();
  });

  it('does not play a sound when soundEnabled is false', () => {
    renderHook(() => useOverdueAlerts(items, { soundEnabled: false }));
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it('vibrates when the device supports it', () => {
    renderHook(() => useOverdueAlerts(items));
    expect(navigator.vibrate).toHaveBeenCalled();
  });

  it('sets the app badge to the new/unread alert count on first view', () => {
    renderHook(() => useOverdueAlerts(items));
    expect(navigator.setAppBadge).toHaveBeenCalledWith(2);
  });

  it('returns the active alert count', () => {
    const { result } = renderHook(() => useOverdueAlerts(items));
    expect(result.current.activeAlertCount).toBe(2);
  });

  it('does not notify again for an item still present after a remount, thanks to localStorage', () => {
    const { unmount } = renderHook(() => useOverdueAlerts(items));
    expect(showNotification).toHaveBeenCalledTimes(2);
    unmount();

    renderHook(() => useOverdueAlerts(items));
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('clears the app badge once all current items have already been viewed/acknowledged', () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    (clearAppBadge as ReturnType<typeof vi.fn>).mockClear();
    // A fresh array with the same ids -- realistic, since callers recompute
    // this list on every render rather than memoizing it.
    rerender({ items: [...items] });
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it('sets the badge to only the new item count when some items were already acknowledged', () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    (navigator.setAppBadge as ReturnType<typeof vi.fn>).mockClear();
    const withNewItem = [...items, { id: 'bill-3', title: 'Overdue: Netflix', body: '₱15.99 was due 1 day ago' }];
    rerender({ items: withNewItem });
    expect(navigator.setAppBadge).toHaveBeenCalledWith(1);
  });

  it('clears the badge when there are no overdue items at all', () => {
    renderHook(() => useOverdueAlerts([]));
    expect(clearAppBadge).toHaveBeenCalled();
    expect(navigator.setAppBadge).not.toHaveBeenCalled();
  });
});
