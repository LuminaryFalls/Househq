/* House HQ service worker.
   Bump VERSION when the manifest or icons change. index.html itself is always
   fetched from the network first and re-cached on every online open, so a new
   build shows on the next open with or without a bump. Fonts, the PDF and
   spreadsheet readers, and the Firebase SDK live in their own cache, LIBS, so a
   bump does not throw them away and make the phone download them again. */
const VERSION = 'househq-2026-09-12e';
const LIBS = 'househq-libs-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== LIBS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheable = r => r && (r.ok || r.type === 'opaque');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scopePath = new URL('./', self.registration.scope).pathname;
  const isApp = url.origin === location.origin && (req.mode === 'navigate' || url.pathname === scopePath || url.pathname.endsWith('/index.html'));

  // The app itself: network first, so an update is never missed. Cached copy only when offline.
  if (isApp) {
    e.respondWith(
      fetch(req).then(r => {
        if (cacheable(r)) { const copy = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); }
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Fonts, the PDF and spreadsheet readers, and the Firebase SDK: fetched once, then kept.
  const keep = /fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com|www\.gstatic\.com\/firebasejs/.test(url.host + url.pathname);
  if (keep) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (cacheable(r)) { const copy = r.clone(); caches.open(LIBS).then(c => c.put(req, copy)); }
        return r;
      }))
    );
    return;
  }
  // Firestore traffic and anything else goes straight through untouched.
});
