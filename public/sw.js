// Minimal app-shell service worker. Deliberately conservative: only caches
// same-origin static build assets (_next/static, fonts, icons). Never caches
// navigations, API routes, or Supabase calls — this app is auth-gated and
// per-user, so caching HTML or data responses risks serving stale or
// cross-session content offline. Static assets are safe to cache aggressively
// because Next.js fingerprints their filenames per build.
const CACHE_NAME = 'kb-personals-shell-v1';
const CACHEABLE_PATH_PREFIXES = ['/_next/static/', '/icon', '/apple-icon'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isCacheable(url) {
  return CACHEABLE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !isCacheable(url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});

// Mirrors lib/notification-priority.ts's VIBRATION_PATTERNS -- a service
// worker script is loaded directly by the browser (not bundled by Next),
// so it cannot import from lib/. Keep these two in sync by hand; both are
// covered by tests that pin the exact array values.
const VIBRATE_PATTERNS = {
  critical: [400, 100, 400, 100, 400],
  urgent: [250, 100, 250],
  reminder: [150],
};

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const priority = payload.priority || 'reminder';

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: VIBRATE_PATTERNS[priority] || VIBRATE_PATTERNS.reminder,
      requireInteraction: priority === 'critical',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          client.postMessage({ type: 'notification-click', url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
