// Gipfelbuch Hallein – offline support
const APP = "gipfelbuch-app-v1";
const TILES = "gipfelbuch-tiles-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // App files: try the network first so updates arrive, fall back to the saved copy offline.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
    return;
  }
  // Map tiles and fonts: use the saved copy if there is one, otherwise load and keep it.
  if (url.hostname.endsWith("tile.opentopomap.org") || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com") {
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && (res.type === "basic" || res.type === "cors")) { c.put(req, res.clone()); trim(c); }
      return res;
    }))));
  }
});
let trimming = false;
function trim(cache) {
  if (trimming) return; trimming = true;
  cache.keys().then(keys => keys.length > 4000 ? Promise.all(keys.slice(0, 800).map(k => cache.delete(k))) : null).finally(() => { trimming = false; });
}
