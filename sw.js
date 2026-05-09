const CACHE_NAME = "utqh-cache-v4";
const BASE_PATH = self.location.pathname.replace(/\/sw\.js$/, "");
const toBase = (path) => `${BASE_PATH}${path}`;
const ASSETS_TO_CACHE = [
  `${BASE_PATH}/`,
  toBase("/index.html"),
  toBase("/styles.css"),
  toBase("/app.js"),
  toBase("/pwa-register.js"),
  toBase("/offline.html"),
  toBase("/manifest.webmanifest"),
  toBase("/icons/icon-192.svg"),
  toBase("/icons/icon-512.svg"),
  toBase("/icons/logo-sekolah.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(toBase("/offline.html")));
    })
  );
});
