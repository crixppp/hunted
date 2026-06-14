const CACHE_NAME = 'hunted-offline-v1';
const INDEX_URL = new URL('index.html', self.location.href).href;
const PRECACHE_URLS = [
  INDEX_URL,
  new URL('style.css', self.location.href).href,
  new URL('app.js', self.location.href).href,
  new URL('offline.js', self.location.href).href,
  new URL('manifest.webmanifest', self.location.href).href,
  new URL('rules.md', self.location.href).href,
  new URL('logo.png', self.location.href).href,
  new URL('favicon.png', self.location.href).href,
  new URL('chime.MP3', self.location.href).href,
  new URL('horror-stinger.mp3', self.location.href).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(INDEX_URL, copy));
          return response;
        })
        .catch(() => caches.match(INDEX_URL))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) return response;

            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
          });
      })
  );
});
