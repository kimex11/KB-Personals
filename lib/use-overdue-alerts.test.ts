import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOverdueAlerts } from './use-overdue-alerts';
import type { AlertItem } from './use-overdue-alerts';

vi.mock('./notifications', () => ({
  showNotification: vi.fn(),
  clearAppBadge: vi.fn(),
}));
vi.mock('./notification-sound', () => ({
  playNotificationSound: vi.fn(),
}));
vi.mock('./notification-log-repository', () => ({
  listSentStateKeys: vi.fn(),
}));

import { showNotification, clearAppBadge } from './notifications';
import { playNotificationSound } from './notification-sound';
import { listSentStateKeys } from './notification-log-repository';

const items: AlertItem[] = [
  {
    id: 'bill-1',
    title: 'Overdue: Rent',
    body: '₱1450.00 was due 5 days ago',
    priority: 'critical',
    entityType: 'bill',
    entityId: 'b1',
    stateKey: 'overdue',
  },
  {
    id: 'bill-2',
    title: 'Overdue: Internet',
    body: '₱59.99 was due 2 days ago',
    priority: 'critical',
    entityType: 'bill',
    entityId: 'b2',
    stateKey: 'overdue',
  },
];

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('navigator', { ...navigator, vibrate: vi.fn(), setAppBadge: vi.fn().mockResolvedValue(undefined) });
  (listSentStateKeys as ReturnType<typeof vi.fn>).mockResolvedValue(new Set());
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('useOverdueAlerts', () => {
  it('fires a notification for each new alert item', async () => {
    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    expect(showNotification).toHaveBeenCalledWith('Overdue: Rent', { body: '₱1450.00 was due 5 days ago' });
    expect(showNotification).toHaveBeenCalledWith('Overdue: Internet', { body: '₱59.99 was due 2 days ago' });
  });

  it('does not show an in-app notification for an item already in the server log', async () => {
    (listSentStateKeys as ReturnType<typeof vi.fn>).mockResolvedValue(new Set(['bill:b1:overdue']));
    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(listSentStateKeys).toHaveBeenCalled());
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    expect(showNotification).toHaveBeenCalledWith('Overdue: Internet', { body: '₱59.99 was due 2 days ago' });
  });

  it('does not re-notify for the same item across renders', async () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    rerender({ items: [...items] });
    await waitFor(() => expect(listSentStateKeys).toHaveBeenCalledTimes(2));
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('plays a sound when soundEnabled is true (default)', async () => {
    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(playNotificationSound).toHaveBeenCalled());
  });

  it('does not play a sound when soundEnabled is false', async () => {
    renderHook(() => useOverdueAlerts(items, { soundEnabled: false }));
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    expect(playNotificationSound).not.toHaveBeenCalled();
  });

  it('vibrates when the device supports it', async () => {
    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(navigator.vibrate).toHaveBeenCalled());
  });

  it('sets the app badge to the new/unread alert count on first view', async () => {
    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(navigator.setAppBadge).toHaveBeenCalledWith(2));
  });

  it('returns the active alert count', () => {
    const { result } = renderHook(() => useOverdueAlerts(items));
    expect(result.current.activeAlertCount).toBe(2);
  });

  it('does not notify again for an item still present after a remount, thanks to localStorage', async () => {
    const { unmount } = renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    unmount();

    renderHook(() => useOverdueAlerts(items));
    await waitFor(() => expect(listSentStateKeys).toHaveBeenCalledTimes(2));
    expect(showNotification).toHaveBeenCalledTimes(2);
  });

  it('clears the app badge once all current items have already been viewed/acknowledged', async () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    (clearAppBadge as ReturnType<typeof vi.fn>).mockClear();
    // A fresh array with the same ids -- realistic, since callers recompute
    // this list on every render rather than memoizing it.
    rerender({ items: [...items] });
    await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
  });

  it('sets the badge to only the new item count when some items were already acknowledged', async () => {
    const { rerender } = renderHook(({ items }) => useOverdueAlerts(items), { initialProps: { items } });
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
    (navigator.setAppBadge as ReturnType<typeof vi.fn>).mockClear();
    const withNewItem: AlertItem[] = [
      ...items,
      { id: 'bill-3', title: 'Overdue: Netflix', body: '₱15.99 was due 1 day ago', priority: 'critical', entityType: 'bill', entityId: 'b3', stateKey: 'overdue' },
    ];
    rerender({ items: withNewItem });
    await waitFor(() => expect(navigator.setAppBadge).toHaveBeenCalledWith(1));
  });

  it('clears the badge when there are no overdue items at all', async () => {
    renderHook(() => useOverdueAlerts([]));
    await waitFor(() => expect(clearAppBadge).toHaveBeenCalled());
    expect(navigator.setAppBadge).not.toHaveBeenCalled();
  });
});
