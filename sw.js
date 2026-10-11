/* Media Manager offline cache — production only */
const CACHE = "mm-621-v7";
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
].map((p) => new URL(p, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => undefined)),
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
