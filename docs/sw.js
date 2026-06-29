// FSA Service Worker — ensures website updates propagate to app installs
const CACHE_NAME = 'fsa-v1';
const SYNC_CHANNEL = new BroadcastChannel('fsa-sync');

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', (e) => {
  if (e.data?.type === 'FSA_UPDATE') {
    caches.delete(CACHE_NAME).then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'FSA_REFRESH' }));
      });
    });
  }
});
 
export default {
  async fetch(request) {
    // The main origin (your Lovable backend)
    const mainOrigin = 'https://www.fs-africa.org.ng/site/gabulk-fashion-studio';
    // The fallback backup (your GitHub Pages subdomain)
    const fallbackOrigin = 'https://gabulk.gabulkfashionstudio.org.ng';

    // Copy the request headers so we don't lose anything
    const headers = new Headers(request.headers);

    try {
      // Step 1: Try to fetch from the main Lovable backend
      const mainResponse = await fetch(mainOrigin, {
        method: request.method,
        headers: headers,
      });

      // Step 2: If the main server returns a 5xx error (server failure)
      if (mainResponse.status >= 500 && mainResponse.status < 600) {
        // Fallback: fetch from the GitHub Pages subdomain instead
        const fallbackResponse = await fetch(fallbackOrigin, {
          method: request.method,
          headers: headers,
        });
        // Return the backup content, but keep the original URL in the browser
        return fallbackResponse;
      }

      // Step 3: If everything is fine, return the main response
      return mainResponse;

    } catch (error) {
      // Step 4: If the main origin is completely offline (network error, timeout)
      // Fallback to the subdomain
      const fallbackResponse = await fetch(fallbackOrigin, {
        method: request.method,
        headers: headers,
      });
      return fallbackResponse;
    }
  }
};
