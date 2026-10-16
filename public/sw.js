/* Media Manager offline cache — production only */
const CACHE = "mm-621-v13";
const SCOPE = self.registration.scope;
const PRECACHE = [
  "./",
  "./favicon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./brand/logo.jpg",
  "./brand/mark.png",
  "./manifest.webmanifest",
  "./tools/file-workbench.html",
].map((p) => new URL(p, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url)))),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sharePath = new URL("share-target", SCOPE).pathname;

  if (req.method === "POST" && url.pathname === sharePath) {
    event.respondWith(
      (async () => {
        try {
          const form = await req.formData();
          const files = form.getAll("files").filter((f) => f instanceof File);
          const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
          for (const client of windows) {
            client.postMessage({ type: "mm-share", files });
          }
        } catch {
          /* ignore */
        }
        return Response.redirect(SCOPE, 303);
      })(),
    );
    return;
  }

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;
  const freshFirst =
    req.mode === "navigate" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("sw.js");
  if (freshFirst) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          if (req.mode === "navigate") return (await caches.match(new URL("./", SCOPE).href)) || Response.error();
          return Response.error();
        }),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
