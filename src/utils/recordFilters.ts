import { getLocalYYYYMMDD, parseDateISO } from './helpers';

export interface RecordFilterState {
  quickPill: 'ALL' | 'UNSUBMITTED' | 'UPCOMING_RENEWAL' | 'PENDING_PAYMENT';
  searchQuery: string;
  customerStatus: 'ALL' | 'Đang tham gia' | 'Đã dừng đóng';
  submissionFilter: 'ALL' | 'UNSUBMITTED' | 'SUBMITTED' | string; // mã đợt cụ thể hoặc trạng thái
  periodType: 'CURRENT_MONTH' | 'PREV_MONTH' | 'CURRENT_QUARTER' | 'ALL' | 'CUSTOM';
  customStartDate?: string;
  customEndDate?: string;
  staffId: string; // 'ALL' hoặc id cụ thể
}

export const DEFAULT_RECORD_FILTER_STATE: RecordFilterState = {
  quickPill: 'ALL',
  searchQuery: '',
  customerStatus: 'ALL',
  submissionFilter: 'ALL',
  periodType: 'ALL',
  customStartDate: '',
  customEndDate: '',
  staffId: 'ALL'
};

/**
 * Trích xuất danh sách các mã đợt nộp thực tế phát sinh trong hồ sơ
 */
export function extractSubmissionBatches(records: any[]): string[] {
  if (!Array.isArray(records)) return [];
  const batchSet = new Set<string>();
  records.forEach(r => {
    if (r.submissionBatch && typeof r.submissionBatch === 'string' && r.submissionBatch.trim()) {
      batchSet.add(r.submissionBatch.trim());
    }
  });
  return Array.from(batchSet).sort().reverse();
}

/**
 * Chuẩn hóa chuỗi số (CCCD, Mã BHXH, SĐT) bằng cách loại bỏ khoảng trắng, dấu gạch và dấu chấm
 */
export function normalizeDigits(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[\s\.-]/g, '').toLowerCase();
}

/**
 * Kiểm tra ngày có thuộc kỳ lọc được chọn hay không
 */
export function isDateInPeriod(
  recordDateStr?: string,
  periodType?: RecordFilterState['periodType'],
  customStartDate?: string,
  customEndDate?: string,
  referenceDateStr?: string
): boolean {
  if (!periodType || periodType === 'ALL') return true;
  if (!recordDateStr) return false;

  const rIso = parseDateISO(recordDateStr);
  if (!rIso) return false;

  const todayStr = referenceDateStr || getLocalYYYYMMDD();
  const [currentYearStr, currentMonthStr] = todayStr.split('-');
  const curYear = parseInt(currentYearStr, 10);
  const curMonth = parseInt(currentMonthStr, 10); // 1-12

  if (periodType === 'CURRENT_MONTH') {
    const currentPrefix = `${currentYearStr}-${currentMonthStr}`;
    return rIso.startsWith(currentPrefix);
  }

  if (periodType === 'PREV_MONTH') {
    let prevYear = curYear;
    let prevMonth = curMonth - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevPrefix = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    return rIso.startsWith(prevPrefix);
  }

  if (periodType === 'CURRENT_QUARTER') {
    const currentQuarter = Math.ceil(curMonth / 3); // 1, 2, 3, 4
    const qStartMonth = String((currentQuarter - 1) * 3 + 1).padStart(2, '0');
    const qEndMonth = String(currentQuarter * 3).padStart(2, '0');
    const qStartIso = `${currentYearStr}-${qStartMonth}-01`;
    // Last day of end month
    const lastDay = new Date(curYear, currentQuarter * 3, 0).getDate();
    const qEndIso = `${currentYearStr}-${qEndMonth}-${String(lastDay).padStart(2, '0')}`;
    return rIso >= qStartIso && rIso <= qEndIso;
  }

  if (periodType === 'CUSTOM') {
    const startIso = customStartDate ? parseDateISO(customStartDate) : '';
    const endIso = customEndDate ? parseDateISO(customEndDate) : '';

    if (startIso && endIso) {
      return rIso >= startIso && rIso <= endIso;
    }
    if (startIso) {
      return rIso >= startIso;
    }
    if (endIso) {
      return rIso <= endIso;
    }
    return true;
  }

  return true;
}

/**
 * Kiểm tra hồ sơ có thỏa mãn điều kiện Quick Pill hay không
 */
export function matchQuickPill(
  record: any,
  quickPill: RecordFilterState['quickPill'] | 'SUBMITTED' | string,
  referenceDateStr?: string
): boolean {
  if (!quickPill || quickPill === 'ALL') return true;

  if (quickPill === 'UNSUBMITTED') {
    // Chưa nộp BHXH: đã thanh toán/thu tiền và isSubmittedBHXH !== true
    const isPaid = record.paymentStatus === 'Đã thu tiền' || 
                   record.paymentStatus === 'Đã đóng' || 
                   record.paymentStatus === 'Đã thanh toán';
    return isPaid && record.isSubmittedBHXH !== true;
  }

  if (quickPill === 'SUBMITTED') {
    return record.isSubmittedBHXH === true;
  }

  if (quickPill === 'UPCOMING_RENEWAL') {
    // Đến hạn đôn đốc: nextPayment trong 0-30 ngày tới, BẮT BUỘC loại trừ 'Đã dừng đóng'
    if (record.status === 'Đã dừng đóng') return false;
    if (!record.nextPayment) return false;

    const todayStr = referenceDateStr || getLocalYYYYMMDD();
    const todayTs = new Date(todayStr).getTime();
    const nextIso = parseDateISO(record.nextPayment);
    if (!nextIso) return false;

    const nextTs = new Date(nextIso).getTime();
    const diffDays = Math.ceil((nextTs - todayTs) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }

  if (quickPill === 'PENDING_PAYMENT') {
    // Chờ thanh toán
    return record.paymentStatus === 'Chờ thanh toán';
  }

  return true;
}

/**
 * Thuật toán lọc danh sách hồ sơ đa chiều (Pure filter function)
 */
export function filterRecords(
  records: any[],
  filterState: RecordFilterState,
  debouncedSearchOrOptions?: string | {
    todayStr?: string;
    currentUser?: any;
    skipQuickPill?: boolean;
  },
  maybeOptions?: {
    todayStr?: string;
    currentUser?: any;
    skipQuickPill?: boolean;
  }
): any[] {
  if (!Array.isArray(records)) return [];

  let debouncedSearch: string | undefined = undefined;
  let options: { todayStr?: string; currentUser?: any; skipQuickPill?: boolean } | undefined = undefined;

  if (typeof debouncedSearchOrOptions === 'string') {
    debouncedSearch = debouncedSearchOrOptions;
    options = maybeOptions;
  } else if (debouncedSearchOrOptions && typeof debouncedSearchOrOptions === 'object') {
    options = debouncedSearchOrOptions;
  }

  const todayStr = options?.todayStr || getLocalYYYYMMDD();
  const rawSearch = debouncedSearch !== undefined 
    ? debouncedSearch 
    : (filterState.searchQuery || (filterState as any).searchText || '');
  const searchTxt = typeof rawSearch === 'string' ? rawSearch.trim() : '';
  const cleanSearchLower = searchTxt.toLowerCase();
  const searchDigits = normalizeDigits(searchTxt);

  const isAdmin = options?.currentUser?.role === 'Admin' || 
                  options?.currentUser?.role === 'admin' || 
                  options?.currentUser?.role === 'Quản lý';

  const effectiveSubmission = (filterState.submissionFilter && filterState.submissionFilter !== 'ALL')
    ? filterState.submissionFilter
    : ((filterState as any).submissionBatch || 'ALL');

  return records.filter(r => {
    // RÀNG BUỘC BẤT BIẾN: Luôn loại bỏ các bản ghi đã hủy và bút toán thoái thu khỏi màn hình tác nghiệp chính
    if (r.paymentStatus === 'Đã hủy') return false;
    if (r.isAdjustment) return false;

    // 1. Phân quyền cán bộ thu (Staff Filter)
    if (filterState.staffId && filterState.staffId !== 'ALL') {
      if (filterState.staffId === 'admin') {
        if (r.staffId && r.staffId !== 'admin') return false;
      } else {
        if (r.staffId !== filterState.staffId) return false;
      }
    } else if (!isAdmin && options?.currentUser) {
      // Cán bộ thông thường chỉ thấy hồ sơ của mình
      if (r.staffId !== options.currentUser.id) return false;
    }

    // 2. Trạng thái khách hàng (Customer Status)
    if (filterState.customerStatus && filterState.customerStatus !== 'ALL') {
      const recordStatus = r.status || 'Đang tham gia';
      if (filterState.customerStatus === 'Đang tham gia' && recordStatus === 'Đã dừng đóng') {
        return false;
      }
      if (filterState.customerStatus === 'Đã dừng đóng' && recordStatus !== 'Đã dừng đóng') {
        return false;
      }
    }

    // 3. Trạng thái nộp cơ quan BHXH (Submission Status / Batch)
    if (effectiveSubmission && effectiveSubmission !== 'ALL') {
      if (effectiveSubmission === 'UNSUBMITTED') {
        if (r.isSubmittedBHXH === true) return false;
      } else if (effectiveSubmission === 'SUBMITTED') {
        if (r.isSubmittedBHXH !== true) return false;
      } else {
        // Mã đợt nộp cụ thể
        if (r.isSubmittedBHXH !== true || r.submissionBatch !== effectiveSubmission) {
          return false;
        }
      }
    }

    // 4. Kỳ kê khai / Thời gian (Time Period Filter dựa trên trường date)
    const recordDate = r.date || r.created_at || r.nextPayment;
    if (!isDateInPeriod(recordDate, filterState.periodType, filterState.customStartDate, filterState.customEndDate, todayStr)) {
      return false;
    }

    // 5. Ô Tìm kiếm tổng hợp (Search query đa trường kèm bỏ khoảng trắng)
    if (cleanSearchLower) {
      const nameMatch = r.name && r.name.toLowerCase().includes(cleanSearchLower);
      const cccdDigits = normalizeDigits(r.cccd);
      const bhxhDigits = normalizeDigits(r.bhxh);
      const phoneDigits = normalizeDigits(r.phone);

      const cccdMatch = searchDigits ? cccdDigits.includes(searchDigits) : false;
      const bhxhMatch = searchDigits ? bhxhDigits.includes(searchDigits) : false;
      const phoneMatch = searchDigits ? phoneDigits.includes(searchDigits) : false;
      const idMatch = String(r.id) === searchTxt;

      if (!nameMatch && !cccdMatch && !bhxhMatch && !phoneMatch && !idMatch) {
        return false;
      }
    }

    // 6. Thanh tác nghiệp nhanh (Quick Filter Pill)
    if (!options?.skipQuickPill) {
      if (!matchQuickPill(r, filterState.quickPill, todayStr)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Tính toán số lượng bản ghi thực tế cho từng Pill tác nghiệp nhanh
 */
export function calculateQuickPillCounts(
  records: any[],
  filterState?: RecordFilterState,
  debouncedSearch?: string,
  options?: {
    todayStr?: string;
    currentUser?: any;
  }
): {
  ALL: number;
  UNSUBMITTED: number;
  SUBMITTED: number;
  UPCOMING_RENEWAL: number;
  PENDING_PAYMENT: number;
} {
  const safeFilterState = filterState || DEFAULT_RECORD_FILTER_STATE;
  // Lọc tập cơ sở theo các tiêu chí chi tiết (ngoại trừ Quick Pill)
  const baseMatching = filterRecords(records, safeFilterState, debouncedSearch, {
    ...options,
    skipQuickPill: true
  });

  const todayStr = options?.todayStr || getLocalYYYYMMDD();

  let countAll = 0;
  let countUnsubmitted = 0;
  let countSubmitted = 0;
  let countUpcomingRenewal = 0;
  let countPendingPayment = 0;

  baseMatching.forEach(r => {
    countAll++;
    if (matchQuickPill(r, 'UNSUBMITTED', todayStr)) {
      countUnsubmitted++;
    }
    if (matchQuickPill(r, 'SUBMITTED', todayStr)) {
      countSubmitted++;
    }
    if (matchQuickPill(r, 'UPCOMING_RENEWAL', todayStr)) {
      countUpcomingRenewal++;
    }
    if (matchQuickPill(r, 'PENDING_PAYMENT', todayStr)) {
      countPendingPayment++;
    }
  });

  return {
    ALL: countAll,
    UNSUBMITTED: countUnsubmitted,
    SUBMITTED: countSubmitted,
    UPCOMING_RENEWAL: countUpcomingRenewal,
    PENDING_PAYMENT: countPendingPayment
  };
}
