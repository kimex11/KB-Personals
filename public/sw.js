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
