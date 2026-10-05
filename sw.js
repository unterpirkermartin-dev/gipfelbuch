// Gipfelbuch Hallein – offline support
const APP = "gipfelbuch-app-v6";
const TILES = "gipfelbuch-tiles-v1";       // map tiles seen while browsing (trimmed)
const OFFLINE = "gipfelbuch-offline";      // areas saved on purpose (never trimmed)
const DEM = "gipfelbuch-dem";              // terrain tiles for panorama / peak finder
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== TILES && k !== OFFLINE && k !== DEM && k !== "gipfelbuch-wege").map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // App files: network first so updates arrive, saved copy when offline.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, {cacheName: APP}).then(r => r || caches.match("index.html", {cacheName: APP}))));
    return;
  }
  // Map tiles, terrain tiles and fonts: saved copy first (from any cache), otherwise load and keep it.
  const isTile = url.hostname.endsWith("tile.opentopomap.org") || url.hostname === "tile.waymarkedtrails.org" || url.hostname === "s3.amazonaws.com" && url.pathname.startsWith("/elevation-tiles-prod/");
  if (isTile || url.hostname.endsWith("gstatic.com") || url.hostname === "fonts.googleapis.com") {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req).then(res => {
      // requests made by the app's own code (saving areas, terrain) are stored by the app itself
      if (res.ok && (res.type === "basic" || res.type === "cors") && req.destination !== "") { const copy = res.clone(); caches.open(TILES).then(c => { c.put(req.url, copy); trim(c); }); }
      return res;
    })));
  }
});
let trimming = false;
function trim(cache) {
  if (trimming) return; trimming = true;
  cache.keys().then(keys => keys.length > 4000 ? Promise.all(keys.slice(0, 800).map(k => cache.delete(k))) : null).finally(() => { trimming = false; });
}
