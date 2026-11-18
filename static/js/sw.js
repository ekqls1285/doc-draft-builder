const CACHE_NAME = "doc-draft-builder-v1";
const STATIC_ASSETS = [
  "/static/css/style.css",
  "/static/js/app.js",
  "/static/images/icon-192.png",
  "/static/images/icon-512.png",
  "/static/images/apple-touch-icon.png",
  "/static/images/suwon-logo.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname === "/generate") {
    return;
  }

  // 네트워크 우선 전략: 온라인이면 항상 최신 화면을 가져오고, 오프라인일 때만 캐시를 사용합니다.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && url.pathname.startsWith("/static/")) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
