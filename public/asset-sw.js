/* eslint-disable no-restricted-globals */
// Asset service worker: caches Supabase Art bucket icons with stale-while-revalidate.
// Bump CACHE_VERSION to invalidate all cached icons (e.g. after an icon set redesign).

const CACHE_VERSION = 'v1';
const CACHE_NAME = `bn-art-cache-${CACHE_VERSION}`;

// Match any Supabase storage public-object URL for the Art / icon buckets.
const ASSET_HOST = 'ybegrvsvhfdlqsxqzbji.supabase.co';
const ASSET_PATH_RE = /^\/storage\/v1\/object\/public\/(Art|ability-icons|unit-images|damage-icons|status-icons|resource-icons|event-reward-icons|menu-backgrounds|encounter-icons|mission-icons)\//;

self.addEventListener('install', (event) => {
  // Activate immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('bn-art-cache-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isAssetRequest(url) {
  return url.host === ASSET_HOST && ASSET_PATH_RE.test(url.pathname);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      // Only cache successful, basic/cors responses.
      if (response && response.ok && (response.type === 'basic' || response.type === 'cors')) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Fire-and-forget revalidation in background.
    networkPromise;
    return cached;
  }

  const fresh = await networkPromise;
  if (fresh) return fresh;
  // Last-resort: a transparent 1x1 PNG so <img onError> handlers can show fallback.
  return new Response(null, { status: 504, statusText: 'Asset unavailable' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!isAssetRequest(url)) return;

  event.respondWith(staleWhileRevalidate(request));
});

// Allow the page to request a cache prewarm.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'prewarm' || !Array.isArray(data.urls)) return;

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        data.urls.map(async (u) => {
          try {
            const req = new Request(u, { mode: 'cors', credentials: 'omit' });
            const hit = await cache.match(req);
            if (hit) return;
            const res = await fetch(req);
            if (res && res.ok) await cache.put(req, res.clone());
          } catch {
            /* ignore */
          }
        })
      );
    })()
  );
});
