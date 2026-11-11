/**
 * Hệ thống Quản lý Giao diện & Chủ đề (Theme Management System)
 * Hỗ trợ Chế độ Sáng (Light), Tối (Dark) và Theo hệ thống (System)
 * Tuân thủ Semantic Design Tokens theo chuẩn Enterprise UI
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'app-theme-mode';
export const THEME_CHANGE_EVENT = 'app-theme-changed';

/**
 * Lấy tùy chọn Theme người dùng đã lưu trong LocalStorage (mặc định: 'light')
 */
export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
  } catch (e) {
    console.warn('[Theme] Không thể đọc localStorage:', e);
  }
  return 'light';
}

/**
 * Phát hiện theme của hệ điều hành người dùng
 */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Phân giải ThemeMode sang 'light' hoặc 'dark' thực tế
 */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return getSystemTheme();
  }
  return mode;
}

/**
 * Áp dụng lớp .dark và thuộc tính data-theme lên document.documentElement
 */
export function applyThemeToDOM(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }
}

/**
 * Thiết lập Theme và lưu vào LocalStorage
 */
export function setTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (e) {
    console.warn('[Theme] Không thể ghi localStorage:', e);
  }

  const resolved = resolveTheme(mode);
  applyThemeToDOM(resolved);

  // Phát sự kiện để các component khác đồng bộ trạng thái
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { mode, resolved } }));
}

/**
 * Chuyển đổi qua lại giữa Light và Dark
 */
export function toggleTheme(): ThemeMode {
  const current = getStoredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/**
 * Khởi tạo Theme khi ứng dụng bắt đầu chạy
 * @returns Cleanup listener function
 */
export function initTheme(): () => void {
  if (typeof window === 'undefined') return () => {};

  const currentMode = getStoredTheme();
  const resolved = resolveTheme(currentMode);
  applyThemeToDOM(resolved);

  // Lắng nghe thay đổi theme từ hệ điều hành nếu người dùng chọn 'system'
  const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const handleSystemChange = () => {
    if (getStoredTheme() === 'system') {
      applyThemeToDOM(getSystemTheme());
    }
  };

  if (mediaQuery?.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemChange);
  }

  return () => {
    if (mediaQuery?.removeEventListener) {
      mediaQuery.removeEventListener('change', handleSystemChange);
    }
  };
}
