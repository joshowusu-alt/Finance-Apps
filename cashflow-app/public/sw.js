self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("cashflow-static-v1").then((cache) =>
      cache.addAll([
        "/",
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/"))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icon-") || url.pathname.startsWith("/apple-touch-icon")) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open("cashflow-runtime-v1").then((cache) => cache.put(request, copy));
          return response;
        })
      )
    );
    return;
  }
});
