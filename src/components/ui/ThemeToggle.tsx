import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'segmented';
  size?: 'sm' | 'md';
}

/**
 * Nút chuyển đổi Theme nhanh (Sáng / Tối / Tự động theo máy)
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  variant = 'icon',
  size = 'md',
}) => {
  const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    const isSm = size === 'sm';
    return (
      <div 
        role="group" 
        aria-label="Tùy chọn giao diện" 
        className={`inline-flex items-center p-0.5 bg-slate-200/70 dark:bg-slate-800 rounded-xl border border-slate-300/80 dark:border-slate-700 ${className}`}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            theme === 'light'
              ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Chế độ Sáng"
          aria-pressed={theme === 'light'}
        >
          <Sun size={isSm ? 13 : 14} className={theme === 'light' ? 'text-amber-500 fill-amber-500' : ''} />
          <span>Sáng</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            theme === 'dark'
              ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Chế độ Tối"
          aria-pressed={theme === 'dark'}
        >
          <Moon size={isSm ? 13 : 14} className={theme === 'dark' ? 'text-sky-400 fill-sky-400' : ''} />
          <span>Tối</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            theme === 'system'
              ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-2xs font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
          title="Tự động theo hệ điều hành"
          aria-pressed={theme === 'system'}
        >
          <Monitor size={isSm ? 13 : 14} />
          <span>Tự động</span>
        </button>
      </div>
    );
  }

  // Variant 'icon': Nút bấm chuyển đổi nhanh 1-chạm
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/70 active:scale-95 transition-all shadow-2xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${className}`}
      title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
      aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
    >
      {isDark ? (
        <Sun size={18} className="text-amber-400 fill-amber-400 hover:rotate-45 transition-transform duration-300" />
      ) : (
        <Moon size={18} className="text-slate-700 hover:-rotate-12 transition-transform duration-300" />
      )}
    </button>
  );
};
