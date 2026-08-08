import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadServiceWorker() {
  const source = readFileSync(path.resolve(__dirname, 'sw.js'), 'utf-8');
  const listeners: Record<string, ((event: unknown) => unknown)[]> = {};

  const self: {
    addEventListener: (type: string, handler: (event: unknown) => unknown) => void;
    location: { origin: string };
    registration: { showNotification: ReturnType<typeof vi.fn> };
    clients: { matchAll: ReturnType<typeof vi.fn>; openWindow: ReturnType<typeof vi.fn> };
    skipWaiting: ReturnType<typeof vi.fn>;
  } = {
    addEventListener: (type, handler) => {
      listeners[type] = listeners[type] ?? [];
      listeners[type].push(handler);
    },
    location: { origin: 'https://app.example' },
    registration: { showNotification: vi.fn() },
    clients: { matchAll: vi.fn(), openWindow: vi.fn() },
    skipWaiting: vi.fn(),
  };
  const caches = { keys: vi.fn().mockResolvedValue([]), open: vi.fn(), delete: vi.fn() };

  runInNewContext(source, { self, caches, fetch: vi.fn(), URL });

  return { self, listeners };
}

describe('sw.js push handling', () => {
  it('shows a notification built from the push payload', async () => {
    const { self, listeners } = loadServiceWorker();
    const payload = {
      title: 'Bill overdue',
      body: '₱84.50 overdue',
      tag: 'critical-group',
      url: '/bills?open=abc',
      priority: 'critical',
    };
    const event = { data: { json: () => payload }, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.push) await handler(event);

    expect(self.registration.showNotification).toHaveBeenCalledWith(
      'Bill overdue',
      expect.objectContaining({
        body: '₱84.50 overdue',
        tag: 'critical-group',
        requireInteraction: true,
        vibrate: [400, 100, 400, 100, 400],
        data: { url: '/bills?open=abc' },
      })
    );
  });

  it('does nothing when the push event carries no data', async () => {
    const { self, listeners } = loadServiceWorker();
    const event = { data: null, waitUntil: vi.fn() };

    for (const handler of listeners.push) await handler(event);

    expect(self.registration.showNotification).not.toHaveBeenCalled();
  });
});

describe('sw.js notificationclick handling', () => {
  it('focuses an existing client at the app origin instead of opening a new one', async () => {
    const { self, listeners } = loadServiceWorker();
    const focus = vi.fn();
    const postMessage = vi.fn();
    self.clients.matchAll.mockResolvedValue([{ url: 'https://app.example/', focus, postMessage }]);
    const notification = { close: vi.fn(), data: { url: '/bills?open=abc' } };
    const event = { notification, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.notificationclick) await handler(event);

    expect(notification.close).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: 'notification-click', url: '/bills?open=abc' });
    expect(focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('opens a new window when no matching client is open', async () => {
    const { self, listeners } = loadServiceWorker();
    self.clients.matchAll.mockResolvedValue([]);
    const notification = { close: vi.fn(), data: { url: '/reminders?open=xyz' } };
    const event = { notification, waitUntil: (p: Promise<unknown>) => p };

    for (const handler of listeners.notificationclick) await handler(event);

    expect(self.clients.openWindow).toHaveBeenCalledWith('/reminders?open=xyz');
  });
});
