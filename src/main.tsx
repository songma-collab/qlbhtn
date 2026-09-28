import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

// Chặn vòng lặp reload chunk: Giới hạn tối đa 1 lần reload trong vòng 45 giây
const LAST_RELOAD_KEY = 'app_last_chunk_reload_ts';
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault(); // Ngăn chặn lỗi cascade
  try {
    const lastReloadStr = sessionStorage.getItem(LAST_RELOAD_KEY);
    const now = Date.now();
    if (lastReloadStr) {
      const elapsed = now - parseInt(lastReloadStr, 10);
      if (elapsed < 45000) {
        console.warn('[Vite Preload Error] Đã thử tải lại trong 45s qua. Dừng reload tự động để tránh vòng lặp.');
        return;
      }
    }
    sessionStorage.setItem(LAST_RELOAD_KEY, now.toString());
    const url = new URL(window.location.href);
    url.searchParams.set('_v', now.toString());
    window.location.href = url.toString();
  } catch (err) {
    console.error('[Vite Preload Error] Lỗi khi xử lý reload:', err);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);

// Hủy đăng ký toàn bộ Service Worker cũ và xóa Cache Storage để tránh phục vụ stale chunks sau khi deploy
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  }).catch(() => {});

  if ('caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}
