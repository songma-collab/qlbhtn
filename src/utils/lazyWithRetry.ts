import React from 'react';

/**
 * lazyWithRetry: Tự động retry khi nạp lazy component thất bại do mất kết nối
 * hoặc do phiên bản mới được deploy trên Cloudflare Pages (mismatch chunk hash)
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 2,
  interval = 1000
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remainingRetries: number) => {
        componentImport()
          .then((comp) => {
            // Khi nạp thành công, dọn dẹp cờ reload
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem('chunk_reload_attempt');
            }
            resolve(comp);
          })
          .catch((error) => {
            if (remainingRetries > 0) {
              setTimeout(() => {
                attempt(remainingRetries - 1);
              }, interval);
            } else {
              // Nếu hết số lần retry (thường do mismatch hash sau deploy), tự động reload trang tối đa 1 lần trong 45s
              if (typeof window !== 'undefined') {
                const LAST_RELOAD_KEY = 'app_last_chunk_reload_ts';
                const lastReloadStr = window.sessionStorage.getItem(LAST_RELOAD_KEY);
                const now = Date.now();
                let canReload = true;
                if (lastReloadStr) {
                  const elapsed = now - parseInt(lastReloadStr, 10);
                  if (elapsed < 45000) {
                    canReload = false;
                  }
                }
                if (canReload) {
                  window.sessionStorage.setItem(LAST_RELOAD_KEY, now.toString());
                  const url = new URL(window.location.href);
                  url.searchParams.set('_v', now.toString());
                  window.location.href = url.toString();
                  return;
                }
              }
              reject(error);
            }
          });
      };
      attempt(retries);
    })
  );
}
