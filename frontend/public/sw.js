const CACHE_VERSION = 2;
const STATIC_CACHE = `travelplanner-static-v${CACHE_VERSION}`;
const API_CACHE = `travelplanner-api-v${CACHE_VERSION}`;
const IMAGE_CACHE = `travelplanner-images-v${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, API_CACHE, IMAGE_CACHE];

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

const MAX_API_CACHE_ENTRIES = 50;
const MAX_IMAGE_CACHE_ENTRIES = 100;

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, notify clients of update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => {
      // Notify all clients that the SW has been updated
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
        });
      });
    })
  );
  self.clients.claim();
});

// Trim cache to max entries (oldest first)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(
      keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key))
    );
  }
}

// Fetch: network-first for API, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests except images.unsplash.com
  if (url.origin !== self.location.origin && !url.hostname.includes('unsplash')) {
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(API_CACHE, MAX_API_CACHE_ENTRIES);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images (including Unsplash): cache-first
  if (
    request.destination === 'image' ||
    url.hostname.includes('unsplash') ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_ENTRIES);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Static assets (JS, CSS, fonts): cache-first with network fallback
  if (
    request.destination === 'font' ||
    url.pathname.match(/\.(js|css|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation: network-first with offline fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/'))
    );
  }
});
