// Panel Reader: keeps the app itself quick to open and available with a weak connection.
// The app page loads fresh whenever you're online (so updates show on the next launch),
// and falls back to the saved copy when you're offline or the network is slow.
const CACHE = "panel-reader-v25";
const CORE = ["./", "index.html", "manifest.json", "icon-180.png", "icon-192.png", "icon-512.png", "msal-browser.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, {ignoreSearch: url.origin === self.location.origin});
    const fresh = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
      return res;
    });

    if (isPage) {
      // The app page: try the network first (up to 4 seconds), use the saved copy if offline or slow
      const timeout = new Promise(r => setTimeout(() => r(null), 4000));
      const net = await Promise.race([fresh.catch(() => null), timeout]);
      if (net && net.ok) return net;
      if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh;
    }
    // Everything else (sign-in library, icons): saved copy straight away, refreshed quietly
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  }));
});
