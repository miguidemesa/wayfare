// Wayfare service worker — v2
// Strategy:
//   • Navigations : network-first → cached copy of the same URL → /offline.html
//     (never a stale cached "/" — prevents the "ghost dashboard" after offline
//     session expiry)
//   • API GET     : network-first → cached response
//   • Static GET  : cache-first, populated opportunistically
//   • Background sync: 'wayfare-sync' nudges open clients to flush the outbox

const CACHE_NAME = "wayfare-v2";
const PRECACHE = [
  "/manifest.json",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET traffic.
  if (url.origin !== location.origin || request.method !== "GET") return;

  // API GET → network-first with cache fallback (stale data beats no data).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ??
              new Response(JSON.stringify({ error: "offline" }), {
                status: 503,
                headers: { "Content-Type": "application/json" },
              })
          )
        )
    );
    return;
  }

  // Static assets → cache-first, populate on the way through.
  const isStatic = ["script", "style", "image", "font"].includes(request.destination);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navigations → network-first → same-URL cache → offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // Only cache successful, non-redirect HTML (auth redirects shouldn't
          // poison the cache).
          if (res.ok && res.type === "basic" && !res.redirected) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached ?? caches.match("/offline.html"))
            .then((fallback) => fallback ?? new Response("Offline", { status: 503 }))
        )
    );
    return;
  }

  event.respondWith(fetch(request));
});

// Background sync → tell any open Wayfare tab to replay its outbox.
self.addEventListener("sync", (event) => {
  if (event.tag === "wayfare-sync") {
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) =>
        clients.forEach((client) => client.postMessage({ type: "wayfare:sync" }))
      )
    );
  }
});

// Allow the page to trigger a sync registration through the SW too.
self.addEventListener("message", (event) => {
  if (event.data === "wayfare:flush") {
    self.registration.sync?.register("wayfare-sync").catch(() => {});
  }
});