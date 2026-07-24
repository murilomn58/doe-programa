/* engine-sw.js — cache do runtime científico.
 *
 * Estratégias:
 *  - CDN do Pyodide e wheels (imutáveis, versionados): cache-first — depois da
 *    primeira visita o runtime abre em segundos e funciona offline.
 *  - Arquivos locais do engine (/py-engine/*.py, worker.js, manifest): 
 *    network-first com fallback ao cache — atualizações chegam na hora, e
 *    offline continua funcionando com a última versão vista.
 */

const CACHE = "doe-engine-v2";
const CDN_PREFIX = "https://cdn.jsdelivr.net/pyodide/";
const LOCAL_PREFIX = self.location.origin + "/py-engine/";
const isImmutable = (url) =>
  url.startsWith(CDN_PREFIX) || url.startsWith(LOCAL_PREFIX + "wheels/");
const isLocalEngine = (url) => url.startsWith(LOCAL_PREFIX);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k.startsWith("doe-engine"))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (event.request.method !== "GET") return;

  if (isImmutable(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isLocalEngine(url)) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const response = await fetch(event.request);
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        } catch {
          const hit = await cache.match(event.request);
          if (hit) return hit;
          throw new Error("offline sem cache do engine");
        }
      }),
    );
  }
});
