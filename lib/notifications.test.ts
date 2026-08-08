import { afterEach, describe, expect, it, vi } from 'vitest';
import { isNotificationSupported, requestNotificationPermission, showNotification, clearAppBadge } from './notifications';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNotificationSupported', () => {
  it('returns true when the Notification API exists on window', () => {
    vi.stubGlobal('Notification', class {});
    expect(isNotificationSupported()).toBe(true);
  });

  it('returns false when the Notification API is absent', () => {
    vi.stubGlobal('Notification', undefined);
    expect(isNotificationSupported()).toBe(false);
  });
});

describe('requestNotificationPermission', () => {
  it('returns "denied" without prompting when unsupported', async () => {
    vi.stubGlobal('Notification', undefined);
    expect(await requestNotificationPermission()).toBe('denied');
  });

  it('returns the existing permission without re-prompting when already decided', async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission });
    expect(await requestNotificationPermission()).toBe('granted');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('prompts for permission when not yet decided', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });
    expect(await requestNotificationPermission()).toBe('granted');
    expect(requestPermission).toHaveBeenCalled();
  });
});

describe('showNotification', () => {
  it('does not construct a Notification when unsupported', () => {
    vi.stubGlobal('Notification', undefined);
    expect(() => showNotification('Overdue bill', { body: 'Rent is overdue' })).not.toThrow();
  });

  it('does not construct a Notification when permission is not granted', () => {
    const NotificationMock = vi.fn();
    vi.stubGlobal('Notification', Object.assign(NotificationMock, { permission: 'denied' }));
    showNotification('Overdue bill');
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('constructs a Notification with the given title and options when granted', () => {
    const NotificationMock = vi.fn();
    vi.stubGlobal('Notification', Object.assign(NotificationMock, { permission: 'granted' }));
    showNotification('Overdue bill', { body: 'Rent is overdue' });
    expect(NotificationMock).toHaveBeenCalledWith('Overdue bill', { body: 'Rent is overdue' });
  });
});

describe('clearAppBadge', () => {
  it('calls navigator.clearAppBadge when supported', () => {
    const clearAppBadgeMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clearAppBadge: clearAppBadgeMock });
    clearAppBadge();
    expect(clearAppBadgeMock).toHaveBeenCalled();
  });

  it('does not throw when unsupported', () => {
    vi.stubGlobal('navigator', { ...navigator, clearAppBadge: undefined });
    expect(() => clearAppBadge()).not.toThrow();
  });
});
