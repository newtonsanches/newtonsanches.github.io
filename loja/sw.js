// Service worker da Vitrine: permite instalar a loja como app e abri-la sem internet.
// Estratégia "rede primeiro": sempre tenta buscar a versão nova (o catálogo muda a cada publicação)
// e só usa a cópia guardada quando está offline. APKs e apps hospedados não são guardados.
const CACHE = "vitrine-v1";
const BASE = ["./", "index.html", "estilo.css", "app.js", "apps.json", "manifest.webmanifest", "icones/icone.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const escopo = new URL(self.registration.scope);
  const relativo = url.pathname.slice(escopo.pathname.length);
  if (relativo.startsWith("apps/") || url.pathname.endsWith(".apk")) return;

  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia)); }
        return resp;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
