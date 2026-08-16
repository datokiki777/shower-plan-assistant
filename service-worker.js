const CACHE = "shower-plan-assistant-v60";
const V2_TAKEOVER_MARKER = "shower-plan-assistant-v2-takeover-v60";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./config.js",
  "./css/styles.css",
  "./js/vendor/html2canvas.min.js",
  "./js/sketch-editor.js",
  "./js/app.js",
  "./js/loading.js",
  "./js/periods.js",
  "./icons/favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE).then((cache) => cache.addAll(ASSETS)),
      caches.keys().then(async (keys) => {
        const isReplacingV2 = keys.some((key) => key.startsWith("workbox-precache"));
        if (!isReplacingV2) return;

        await caches.open(V2_TAKEOVER_MARKER);
        await self.skipWaiting();
      })
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        const isReplacingV2 = keys.includes(V2_TAKEOVER_MARKER);

        // Cache Storage is separate from IndexedDB. This removes only stale
        // service-worker caches and never touches application/user data.
        await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
        await self.clients.claim();

        if (isReplacingV2) {
          const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
          });
          await Promise.all(
            windowClients.map((client) => client.navigate(client.url).catch(() => undefined))
          );
        }
      })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
