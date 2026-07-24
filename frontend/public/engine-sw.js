/* engine-sw.js — cache do runtime científico (Pyodide + wheels + módulos).
 *
 * Estratégia cache-first para artefatos imutáveis e pesados: o CDN do Pyodide
 * (versão pinada no worker.js) e os arquivos de /py-engine/. Depois da primeira
 * visita, o laboratório abre em segundos e funciona offline.
 */

const CACHE = "doe-engine-v1";
const CACHEABLE = [
  "https://cdn.jsdelivr.net/pyodide/",
  self.location.origin + "/py-engine/",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("doe-engine")).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (event.request.method !== "GET") return;
  if (!CACHEABLE.some((prefix) => url.startsWith(prefix))) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(event.request);
      if (hit) return hit;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
