import { useState, useEffect, useCallback } from 'react';
import {
  ThemeMode,
  ResolvedTheme,
  getStoredTheme,
  resolveTheme,
  setTheme as applyThemeSetting,
  toggleTheme as cycleTheme,
  THEME_CHANGE_EVENT,
  initTheme,
} from '../utils/theme';

export interface UseThemeReturn {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

/**
 * Hook truy xuất và điều khiển trạng thái Theme trong ứng dụng
 */
export function useTheme(): UseThemeReturn {
  const [theme, setLocalTheme] = useState<ThemeMode>(() => getStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(getStoredTheme()));

  useEffect(() => {
    // Khởi tạo theme khi mount
    const cleanupInit = initTheme();

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: ThemeMode; resolved: ResolvedTheme }>;
      if (customEvent.detail) {
        setLocalTheme(customEvent.detail.mode);
        setResolvedTheme(customEvent.detail.resolved);
      } else {
        const stored = getStoredTheme();
        setLocalTheme(stored);
        setResolvedTheme(resolveTheme(stored));
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => {
      cleanupInit();
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyThemeSetting(mode);
    setLocalTheme(mode);
    setResolvedTheme(resolveTheme(mode));
  }, []);

  const toggle = useCallback(() => {
    const next = cycleTheme();
    setLocalTheme(next);
    setResolvedTheme(resolveTheme(next));
  }, []);

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === 'dark',
    setTheme,
    toggleTheme: toggle,
  };
}
