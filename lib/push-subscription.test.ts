import { afterEach, describe, expect, it, vi } from 'vitest';

const mockUpsert = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
mockDelete.mockReturnValue({ eq: mockEq });
vi.mock('./supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ upsert: mockUpsert, delete: mockDelete }),
  }),
}));

import { isPushSupported, subscribeToPush, unsubscribeFromPush, getPushSubscriptionState } from './push-subscription';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('isPushSupported', () => {
  it('returns false when serviceWorker/PushManager are absent', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(isPushSupported()).toBe(false);
  });

  it('returns true when serviceWorker, PushManager, and Notification all exist', () => {
    vi.stubGlobal('navigator', { serviceWorker: {} });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    expect(isPushSupported()).toBe(true);
  });
});

describe('subscribeToPush', () => {
  it('returns false when push is unsupported', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(await subscribeToPush()).toBe(false);
  });

  it('subscribes and upserts the subscription row', async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'QUFBQQ';
    mockUpsert.mockResolvedValue({ error: null });
    const subscribe = vi.fn().mockResolvedValue({
      toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
    });
    vi.stubGlobal('navigator', {
      serviceWorker: { ready: Promise.resolve({ pushManager: { subscribe } }) },
      userAgent: 'test-agent',
    });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('binary'));

    const result = await subscribeToPush();

    expect(subscribe).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        endpoint: 'https://push.example/abc',
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      }),
      { onConflict: 'endpoint' }
    );
    expect(result).toBe(true);
  });
});

describe('unsubscribeFromPush', () => {
  it('unsubscribes and deletes the subscription row by endpoint', async () => {
    mockEq.mockResolvedValue({ error: null });
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://push.example/abc', unsubscribe });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription } }) } });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });

    await unsubscribeFromPush();

    expect(unsubscribe).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('endpoint', 'https://push.example/abc');
  });
});

describe('getPushSubscriptionState', () => {
  it('returns unsupported when push is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(await getPushSubscriptionState()).toBe('unsupported');
  });

  it('returns subscribed when an active subscription exists', async () => {
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://push.example/abc' });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription } }) } });
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    expect(await getPushSubscriptionState()).toBe('subscribed');
  });
});
