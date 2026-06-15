/* Seans Planlayıcı – statik shell cache (MF-55) */
const CACHE_VERSION = "v3";
const CACHE_NAME = "seans-planlayici-" + CACHE_VERSION;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./api.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./activity-logs.html",
  "./activity-logs.js",
  "./pwa-register.js",
];

function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.hostname !== self.location.hostname;
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return (
    path.endsWith(".html") ||
    path.endsWith(".css") ||
    path.endsWith(".js") ||
    path.endsWith(".json") ||
    path.endsWith(".svg") ||
    path.endsWith(".png") ||
    path.endsWith(".ico") ||
    path === "/" ||
    path.endsWith("/")
  );
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key.startsWith("seans-planlayici-") && key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (isApiRequest(url)) return;

  if (!isStaticAsset(url)) return;

  event.respondWith(
    caches.match(request).then(function (cached) {
      var networkFetch = fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === "basic") {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, copy);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });

      return cached || networkFetch;
    })
  );
});
