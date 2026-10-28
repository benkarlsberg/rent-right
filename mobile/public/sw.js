const CACHE = "rr-offline-v2";
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rent Right</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#E6F0EE;color:#14343C;font:18px/1.45 Segoe UI,Helvetica,Arial,sans-serif}main{width:min(420px,calc(100% - 32px));background:#fff;border-radius:16px;padding:28px}h1{font-size:28px;margin:0 0 8px}p{margin:0 0 16px;color:#4C646B}button{min-height:48px;width:100%;border:0;border-radius:12px;background:#0B5C6E;color:#fff;font:inherit;font-weight:700}</style></head><body><main><h1>You are offline</h1><p>Rent Right could not reach the internet. Your records stay on the server. Try again when you are back online.</p><button type="button" onclick="location.reload()">Retry</button></main></body></html>`;
const SHELL = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request) || await caches.match("/");
        if (cached) return cached;
        return new Response(OFFLINE_HTML, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/_expo/") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const fresh = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })());
  }
});
