/*
 * ServEm's service worker.
 *
 * The job is narrow on purpose. It caches the offline page and static assets so
 * an installed app opens without a connection, and it caches *nothing else*:
 *
 *  - `/api/*` is never touched, because every one of those responses is either
 *    personal or a mutation;
 *  - navigations are network-first and are not cached, because a page rendered
 *    for one account must not be handed to another;
 *  - only immutable build assets, icons and fonts are cache-first.
 *
 * A failed navigation falls back to `/offline`, which was cached at install.
 * Bump `VERSION` to replace every cached asset in one step; the activate handler
 * deletes the old cache rather than leaving it to fill the origin's quota.
 */

const VERSION = 'servem-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStatic(url) {
  if (url.pathname.startsWith('/_next/static/')) return true;
  if (url.pathname.startsWith('/icons/')) return true;
  return /\.(css|js|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|ico)$/.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(VERSION);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }),
    );
    return;
  }

  if (!isStatic(url)) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
