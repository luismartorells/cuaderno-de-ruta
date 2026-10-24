/* Cuaderno de Ruta: permite abrir la app sin cobertura.
   Solo guarda el código de la app y sus librerías; los datos del viaje nunca pasan por aquí. */
const CACHE = "cuaderno-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const LIBS = [
  "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
  "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(CORE);
    await Promise.all(LIBS.map((u) => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.startsWith("cuaderno-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.hostname.endsWith("script.google.com") || u.hostname.endsWith("googleusercontent.com")) return;
  if (u.hostname.endsWith("tile.openstreetmap.org")) return; // las teselas del mapa no se guardan (no llenan el móvil)

  // La página: intenta la versión nueva (máx. 4 s) y si no hay red, abre la guardada.
  if (r.mode === "navigate") {
    e.respondWith(
      Promise.race([fetch(r), timeout(4000)])
        .then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return res; })
        .catch(() => caches.match("./index.html").then((hit) => hit || caches.match("./")))
    );
    return;
  }

  // Resto (librerías, fuentes, iconos): lo guardado al momento y se actualiza por detrás.
  e.respondWith(caches.match(r).then((hit) => {
    const net = fetch(r).then((res) => {
      if (res && (res.ok || res.type === "opaque")) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
