/**
 * Service Worker for Offline Capability
 * Tuân thủ Nghị định 13/2023/NĐ-CP:
 * TUYỆT ĐỐI KHÔNG lưu cache các request API chứa PII (dữ liệu khách hàng, CCCD, SĐT, Supabase REST API).
 * Chỉ cache static assets, font và calculation assets tĩnh để phục vụ chạy offline các module tính toán.
 */

const CACHE_NAME = 'bhxh-static-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. TUYỆT ĐỐI BỎ QUA VÀ KHÔNG CAN THIỆP VÀO:
  // - API / DB / Backend requests
  // - Node modules / Vite internal / Dev scripts / HMR / Source files
  // - Bất kỳ request nào chứa tham số phiên bản (?v=) hoặc .js/.ts/.tsx
  if (
    event.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/rest/v1') ||
    url.pathname.includes('/auth/v1') ||
    url.pathname.includes('/storage/v1') ||
    url.hostname.includes('vietqr.net') ||
    url.hostname.includes('img.vietqr.io') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('node_modules') ||
    url.pathname.includes('@vite') ||
    url.pathname.includes('@fs') ||
    url.pathname.includes('/src/') ||
    url.search.includes('v=') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx')
  ) {
    return; // Pass through to network directly without caching
  }

  // 2. Navigation request: Network-First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // 3. Với Assets tĩnh an toàn (icons, manifest): Cache-First
  if (
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        });
      })
    );
  }
});
