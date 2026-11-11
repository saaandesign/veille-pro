// Service worker : permet d'ouvrir l'app même sans réseau.
// Les fichiers de l'app sont gardés en cache ; la veille (data/offres.json) est toujours
// demandée en ligne d'abord, et la dernière version connue sert de secours hors ligne.
const CACHE = "veille-pro-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "data/offres.json",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  // Réseau d'abord pour la veille et les pages, pour toujours avoir le plus récent.
  if (sameOrigin && (url.pathname.endsWith("/offres.json") || req.mode === "navigate" || url.pathname.endsWith(".js") || url.pathname.endsWith(".css"))) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }

  // Cache d'abord pour les icônes et les polices.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
