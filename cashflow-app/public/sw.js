const STATIC_CACHE = "cashflow-static-v2";
const RUNTIME_CACHE = "cashflow-runtime-v2";
const OLD_CACHES = ["cashflow-static-v1", "cashflow-runtime-v1"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        "/manifest.json",
        "/icon-192.png",
        "/icon-512.png",
        "/apple-touch-icon.png",
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => OLD_CACHES.includes(k)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: always network-first, never serve stale HTML from cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) return response;
          // If the server returns 404 etc., redirect to root
          return Response.redirect("/", 302);
        })
        .catch(() => Response.redirect("/", 302))
    );
    return;
  }

  // Static assets: cache-first with network fallback
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icon-") || url.pathname.startsWith("/apple-touch-icon")) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
      )
    );
    return;
  }
});
