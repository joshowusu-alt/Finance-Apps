const STATIC_CACHE = "cashflow-static-v5";
const RUNTIME_CACHE = "cashflow-runtime-v5";
const OLD_CACHES = ["cashflow-static-v1", "cashflow-runtime-v1", "cashflow-static-v2", "cashflow-runtime-v2", "cashflow-static-v3", "cashflow-runtime-v3", "cashflow-static-v4", "cashflow-runtime-v4"];

const OFFLINE_PAGE = "/offline.html";

// App shell pages to pre-cache for offline use
const APP_SHELL = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  OFFLINE_PAGE,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  // Do NOT call self.skipWaiting() here — we let the UpdateBanner ask
  // the user first, then send a SKIP_WAITING message to activate.
});

// UpdateBanner posts { type: 'SKIP_WAITING' } when the user taps "Update Now"
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

// Handle notification click — navigate to the linked page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(href);
        } else {
          self.clients.openWindow(href);
        }
      })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network-first with offline fallback page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Cache successful navigation responses for offline use
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }
          return Response.redirect("/", 302);
        })
        .catch(() =>
          caches.match(request).then((cached) =>
            cached || caches.match(OFFLINE_PAGE).then((offline) =>
              offline || Response.redirect("/", 302)
            )
          )
        )
    );
    return;
  }

  // Static assets: network-first to avoid stale JS bundles after deploys
  if (url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icon-") || url.pathname.startsWith("/apple-touch-icon")) {
    event.respondWith(
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() =>
        caches.match(request).then((cached) =>
          cached || new Response("", { status: 503, statusText: "Offline" })
        )
      )
    );
    return;
  }

  // Other same-origin GET requests: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Allow the UpdateBanner (or global-error page) to force-activate a new SW
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Handle server-sent Web Push payloads
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Velanovo", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? "Velanovo", {
      body: data.body,
      icon: data.icon ?? "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      // Use `href` so the existing notificationclick handler can navigate
      data: { href: data.url ?? "/" },
      tag: "velanovo-push",
    })
  );
});

