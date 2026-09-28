import { useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onSearch?: () => void;
  onEscape?: () => void;
  onNewBHXH?: () => void;
  onNewBHYT?: () => void;
}

/**
 * Hook lắng nghe phím tắt toàn hệ thống:
 * - Ctrl+K / Cmd+K: Mở tìm kiếm nhanh
 * - Escape: Đóng modal / Hủy thao tác
 * - Alt+1: Thêm mới BHXH
 * - Alt+2: Thêm mới BHYT
 */
export const useKeyboardShortcuts = ({
  onSearch,
  onEscape,
  onNewBHXH,
  onNewBHYT,
}: KeyboardShortcutsOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Luôn cho phép đóng modal
      if (e.key === 'Escape') {
        if (onEscape) {
          onEscape();
        }
        return;
      }

      // Ctrl+K hoặc Cmd+K: Mở tìm kiếm
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (onSearch) {
          onSearch();
        }
        return;
      }

      // Alt+1: Tạo nhanh hồ sơ BHXH
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        if (onNewBHXH) {
          onNewBHXH();
        }
        return;
      }

      // Alt+2: Tạo nhanh hồ sơ BHYT
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        if (onNewBHYT) {
          onNewBHYT();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSearch, onEscape, onNewBHXH, onNewBHYT]);
};
