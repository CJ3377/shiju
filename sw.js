/* 拾句 — 離線快取。改了程式後把 VERSION 加 1，手機才會抓到新版。 */
const VERSION = 'shiju-v5';
const FILES = ['./', 'index.html', 'styles.css', 'data.js', 'state.js', 'app.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// 自己的檔案：先用網路（拿到最新版），沒網路才用快取
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    // no-cache：每次都向伺服器確認有沒有新版，不用瀏覽器暫存的舊檔（GitHub Pages 會暫存 10 分鐘）
    fetch(e.request.url, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
