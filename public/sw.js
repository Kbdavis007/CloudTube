// CloudTube Service Worker - Offline Caching & Background Sync
const CACHE_NAME = 'cloudtube-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Network-first for API requests, fallback to offline response
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'You are currently offline. Serving cached offline state from IndexedDB.',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          }
        );
      })
    );
    return;
  }

  // Stale-while-revalidate for assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return cached response if network fails
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync for offline metadata updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-video-metadata') {
    event.waitUntil(syncPendingMetadata());
  }
});

async function syncPendingMetadata() {
  // Notifies clients that sync has triggered
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
  }
}
