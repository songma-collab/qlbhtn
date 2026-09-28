import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RecordFilterState,
  DEFAULT_RECORD_FILTER_STATE,
  filterRecords,
  calculateQuickPillCounts,
  extractSubmissionBatches
} from '../utils/recordFilters';

export function useRecordFilters(
  records: any[],
  storageKey: string = 'bhxh_record_filter_state',
  options?: {
    currentUser?: any;
    todayStr?: string;
  }
) {
  // 1. Khởi tạo filterState từ sessionStorage (nếu có) hoặc dùng mặc định
  const [filterState, setFilterState] = useState<RecordFilterState>(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const saved = window.sessionStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...DEFAULT_RECORD_FILTER_STATE,
            ...parsed
          };
        }
      }
    } catch (e) {
      console.warn('Lỗi khi đọc filterState từ sessionStorage:', e);
    }
    return DEFAULT_RECORD_FILTER_STATE;
  });

  // 2. Debounce 300ms cho ô tìm kiếm từ khóa
  const [debouncedSearch, setDebouncedSearch] = useState<string>(filterState.searchQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filterState.searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [filterState.searchQuery]);

  // 3. Lưu giữ trạng thái bộ lọc vào sessionStorage khi thay đổi
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(storageKey, JSON.stringify(filterState));
      }
    } catch (e) {
      console.warn('Lỗi khi lưu filterState vào sessionStorage:', e);
    }
  }, [filterState, storageKey]);

  // 4. Hàm cập nhật từng phần của FilterState
  const updateFilter = useCallback((updates: Partial<RecordFilterState>) => {
    setFilterState(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // 5. Hàm Đặt lại bộ lọc về mặc định ban đầu
  const resetFilters = useCallback(() => {
    setFilterState(DEFAULT_RECORD_FILTER_STATE);
    setDebouncedSearch('');
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch (e) {
      // ignore
    }
  }, [storageKey]);

  // 6. Danh sách các mã đợt nộp thực tế trong CSDL
  const submissionBatches = useMemo(() => {
    return extractSubmissionBatches(records);
  }, [records]);

  // 7. Tính toán số lượng cho từng Pill tác nghiệp nhanh
  const quickPillCounts = useMemo(() => {
    return calculateQuickPillCounts(records, filterState, debouncedSearch, options);
  }, [records, filterState, debouncedSearch, options?.currentUser?.id, options?.currentUser?.role, options?.todayStr]);

  // 8. Tập hồ sơ sau khi áp dụng toàn bộ bộ lọc đa chiều
  const filteredRecords = useMemo(() => {
    return filterRecords(records, filterState, debouncedSearch, options);
  }, [records, filterState, debouncedSearch, options?.currentUser?.id, options?.currentUser?.role, options?.todayStr]);

  return {
    filterState,
    debouncedSearch,
    setFilterState,
    updateFilter,
    resetFilters,
    submissionBatches,
    quickPillCounts,
    filteredRecords
  };
}
