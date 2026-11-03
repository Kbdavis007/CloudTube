// CloudTube Service Worker - Offline Caching & Background Sync
const CACHE_NAME = 'cloudtube-cache-v2';
// Search responses are kept separately so a redeploy can drop the asset cache
// without throwing away cached searches.
const SEARCH_CACHE = 'cloudtube-search-v1';
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
          // Keep the search cache; only retire stale asset caches.
          if (key !== CACHE_NAME && key !== SEARCH_CACHE) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// How long a cached search response is served before the worker revalidates it.
// Matches the Worker's edge-cache TTL, so the two layers agree on freshness.
const SEARCH_TTL_MS = 300 * 1000;

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Searches are the expensive, rate-limited calls, so they get a dedicated
  // stale-while-revalidate cache: a repeat term is answered from disk instantly
  // while a fresh copy is fetched in the background.
  if (url.pathname === '/api/search' && request.method === 'GET') {
    event.respondWith(handleSearchRequest(event));
    return;
  }

  // Network-first for other API requests, fallback to offline response
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

// Stale-while-revalidate for the cached search API.
//
// The Worker already dedupes upstream calls across everyone, so this layer is
// about perceived speed: a term searched before is rendered from disk on the
// next visit with no network wait, while a background fetch keeps it current.
async function handleSearchRequest(event) {
  const request = event.request;
  const cache = await caches.open(SEARCH_CACHE);
  const cached = await cache.match(request);

  // A hit younger than the TTL is served as-is; older hits are served too, but
  // revalidated in the background so the UI never waits on the network.
  const cachedAt = cached ? Number(cached.headers.get('x-cached-at')) || 0 : 0;
  const isFresh = cached && Date.now() - cachedAt < SEARCH_TTL_MS;

  if (isFresh) return cached;

  const network = fetch(request)
    .then(async (response) => {
      const type = response.headers.get('content-type') || '';
      if (response.ok && type.includes('application/json')) {
        // Stamp the fetch time so the next hit can tell how old the entry is.
        const body = await response.clone().arrayBuffer();
        const headers = new Headers(response.headers);
        headers.set('x-cached-at', String(Date.now()));
        await cache.put(request, new Response(body, { status: response.status, headers }));
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Refresh in the background, then answer from disk immediately.
    event.waitUntil(network);
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;

  return new Response(
    JSON.stringify({
      success: false,
      offline: true,
      errors: [{ message: 'Offline and no cached results for this search yet.' }],
    }),
    { headers: { 'Content-Type': 'application/json' }, status: 503 }
  );
}
