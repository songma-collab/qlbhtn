import { getCommissionRateForRecord } from './calculations';
import type { Policy, SettingsType } from '../context/types';

export type PeriodMode = 'MONTH' | 'RANGE' | 'ALL';

export interface PeriodFilterValue {
  mode: PeriodMode;
  selectedMonth: string; // 'YYYY-MM'
  startDate?: string;    // 'YYYY-MM-DD'
  endDate?: string;      // 'YYYY-MM-DD'
}

export interface TransactionFilterState {
  kpiQuickFilter: 'ALL' | 'PAID' | 'PENDING';
  searchQuery: string;
  submissionStatus: 'ALL' | 'UNSUBMITTED' | 'SUBMITTED' | string; // Mã đợt cụ thể: Đợt_... hoặc BATCH_...
  staffId: string;
  periodType: 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL' | 'CUSTOM' | 'RANGE';
  selectedMonth: string; // Định dạng 'YYYY-MM'
  customStartDate?: string;
  customEndDate?: string;
  startDate?: string;
  endDate?: string;
}

export const DEFAULT_TRANSACTION_FILTER_STATE: TransactionFilterState = {
  kpiQuickFilter: 'ALL',
  searchQuery: '',
  submissionStatus: 'ALL',
  staffId: 'ALL',
  periodType: 'MONTH',
  selectedMonth: '2026-09',
  customStartDate: '',
  customEndDate: '',
  startDate: '',
  endDate: ''
};

/**
 * Trả về trạng thái mặc định dựa theo ngày tham chiếu hoặc ngày hiện tại
 */
export function getDefaultTransactionFilterState(refDateStr?: string): TransactionFilterState {
  const d = refDateStr ? new Date(refDateStr) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return {
    kpiQuickFilter: 'ALL',
    searchQuery: '',
    submissionStatus: 'ALL',
    staffId: 'ALL',
    periodType: 'MONTH',
    selectedMonth: `${yyyy}-${mm}`,
    customStartDate: '',
    customEndDate: '',
    startDate: '',
    endDate: ''
  };
}

/**
 * Chuyển đổi từ TransactionFilterState sang PeriodFilterValue cho AccountingPeriodController
 */
export function toPeriodFilterValue(filter: TransactionFilterState): PeriodFilterValue {
  let mode: PeriodMode = 'MONTH';
  if (filter.periodType === 'RANGE' || filter.periodType === 'CUSTOM') {
    mode = 'RANGE';
  } else if (filter.periodType === 'ALL') {
    mode = 'ALL';
  } else {
    mode = 'MONTH';
  }

  return {
    mode,
    selectedMonth: filter.selectedMonth || '',
    startDate: filter.startDate || filter.customStartDate || '',
    endDate: filter.endDate || filter.customEndDate || ''
  };
}

/**
 * Cập nhật TransactionFilterState từ PeriodFilterValue
 */
export function fromPeriodFilterValue(val: PeriodFilterValue): Partial<TransactionFilterState> {
  const isRange = val.mode === 'RANGE';
  return {
    periodType: isRange ? 'RANGE' : val.mode,
    selectedMonth: val.selectedMonth,
    startDate: isRange ? val.startDate : '',
    endDate: isRange ? val.endDate : '',
    customStartDate: isRange ? val.startDate : '',
    customEndDate: isRange ? val.endDate : ''
  };
}

/**
 * Chuẩn hóa chuỗi số (CCCD, Mã BHXH, SĐT) bằng cách loại bỏ khoảng trắng, dấu gạch và dấu chấm
 */
export function normalizeDigits(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[\s\.-]/g, '').toLowerCase();
}

export interface TransactionDateRangeResult {
  startDate: string | null; // 'YYYY-MM-DD'
  endDate: string | null;   // 'YYYY-MM-DD'
  startDateRPC: string;
  endDateRPC: string;
  fromDate: string | null;
  toDate: string | null;
  periodLabel: string;
  currentKey: string;
}

/**
 * Tính toán khoảng ngày bắt đầu - kết thúc từ cấu hình bộ lọc thời gian
 */
export function getTransactionDateRange(
  filter: TransactionFilterState,
  refDateStr?: string
): TransactionDateRangeResult {
  const ref = refDateStr ? new Date(refDateStr) : new Date();
  let startDate: string | null = null;
  let endDate: string | null = null;
  let periodLabel = 'Toàn bộ thời gian';
  let currentKey = '';

  const monthVal = filter.selectedMonth || `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
  const [yStr, mStr] = monthVal.split('-');
  const y = parseInt(yStr || String(ref.getFullYear()), 10);
  const m = parseInt(mStr || String(ref.getMonth() + 1), 10);

  if (filter.periodType === 'MONTH') {
    const lastDay = new Date(y, m, 0).getDate();
    const mPadded = String(m).padStart(2, '0');
    const lastDayPadded = String(lastDay).padStart(2, '0');
    startDate = `${y}-${mPadded}-01`;
    endDate = `${y}-${mPadded}-${lastDayPadded}`;
    periodLabel = `Tháng ${mPadded}/${y}`;
    currentKey = `month_${mPadded}/${y}`;
  } else if (filter.periodType === 'QUARTER') {
    const q = Math.ceil(m / 3);
    const qStartMonth = (q - 1) * 3 + 1;
    const qEndMonth = q * 3;
    const lastDay = new Date(y, qEndMonth, 0).getDate();
    startDate = `${y}-${String(qStartMonth).padStart(2, '0')}-01`;
    endDate = `${y}-${String(qEndMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    periodLabel = `Quý ${q}/${y}`;
    currentKey = `quarter_${q}_${y}`;
  } else if (filter.periodType === 'YEAR') {
    startDate = `${y}-01-01`;
    endDate = `${y}-12-31`;
    periodLabel = `Năm ${y}`;
    currentKey = `year_${y}`;
  } else if (filter.periodType === 'CUSTOM' || filter.periodType === 'RANGE') {
    startDate = filter.startDate || filter.customStartDate || null;
    endDate = filter.endDate || filter.customEndDate || null;
    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split('-');
      const [ey, em, ed] = endDate.split('-');
      periodLabel = `${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`;
    } else if (startDate) {
      const [sy, sm, sd] = startDate.split('-');
      periodLabel = `Từ ${sd}/${sm}/${sy}`;
    } else if (endDate) {
      const [ey, em, ed] = endDate.split('-');
      periodLabel = `Đến ${ed}/${em}/${ey}`;
    } else {
      periodLabel = 'Khoảng ngày tùy chọn';
    }
    currentKey = '';
  } else {
    // 'ALL'
    startDate = null;
    endDate = null;
    periodLabel = 'Toàn bộ thời gian';
    currentKey = '';
  }

  const fromDate = startDate ? startDate : null;
  const toDate = endDate ? `${endDate}T23:59:59.999Z` : null;

  return {
    startDate,
    endDate,
    startDateRPC: startDate || '',
    endDateRPC: endDate || '',
    fromDate,
    toDate,
    periodLabel,
    currentKey
  };
}

/**
 * Kiểm tra ngày ghi nhận có nằm trong khoảng thời gian đã chọn hay không
 */
export function isTransactionDateInPeriod(
  recordDateStr?: string,
  filter?: TransactionFilterState,
  refDateStr?: string
): boolean {
  if (!filter || filter.periodType === 'ALL') return true;
  if (!recordDateStr) return false;
  const dStr = recordDateStr.slice(0, 10);
  const { startDate, endDate } = getTransactionDateRange(filter, refDateStr);
  if (startDate && dStr < startDate) return false;
  if (endDate && dStr > endDate) return false;
  return true;
}

/**
 * Khớp nối chuỗi tìm kiếm thông minh
 */
export function matchesTransactionSearch(record: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const qNorm = normalizeDigits(q);

  // 1. Tên
  if (record.name && record.name.toLowerCase().includes(q)) return true;

  // 2. CCCD / ĐDCN
  if (record.cccd) {
    if (record.cccd.toLowerCase().includes(q)) return true;
    if (qNorm && normalizeDigits(record.cccd).includes(qNorm)) return true;
  }

  // 3. Mã BHXH
  if (record.bhxh) {
    if (record.bhxh.toLowerCase().includes(q)) return true;
    if (qNorm && normalizeDigits(record.bhxh).includes(qNorm)) return true;
  }

  // 4. Số điện thoại
  if (record.phone) {
    if (record.phone.toLowerCase().includes(q)) return true;
    if (qNorm && normalizeDigits(record.phone).includes(qNorm)) return true;
  }

  // 5. Số biên lai / Mã GD / ID
  if (record.id && String(record.id).toLowerCase().includes(q)) return true;
  if (record.receiptNumber && String(record.receiptNumber).toLowerCase().includes(q)) return true;
  if (record.receiptCode && String(record.receiptCode).toLowerCase().includes(q)) return true;
  if (record.transId && String(record.transId).toLowerCase().includes(q)) return true;
  if (record.transactionCode && String(record.transactionCode).toLowerCase().includes(q)) return true;

  return false;
}

export interface FilterTransactionOptions {
  type?: 'BHXH' | 'BHYT';
  currentUserRole?: string;
  currentUserId?: string;
  referenceDateStr?: string;
}

/**
 * Lọc danh sách giao dịch theo bộ lọc hợp nhất
 */
export function filterTransactionRecords(
  records: any[],
  filter: TransactionFilterState,
  options?: FilterTransactionOptions
): any[] {
  if (!Array.isArray(records)) return [];

  const type = options?.type;
  const isEmployeeOnly = options?.currentUserRole === 'Nhân viên';
  const effectiveStaffId = isEmployeeOnly 
    ? options?.currentUserId 
    : (filter.staffId && filter.staffId !== 'ALL' && filter.staffId !== 'all' ? filter.staffId : null);

  return records.filter(r => {
    // 1. Phân hệ BHXH / BHYT
    if (type && r.type !== type) return false;

    // 2. Luôn loại trừ "Nhập từ Excel"
    if (r.actionType === 'Nhập từ Excel') return false;

    // 3. Luôn loại trừ hồ sơ "Đã hủy"
    if (r.paymentStatus === 'Đã hủy') return false;

    // 4. Phân quyền cán bộ thu
    if (effectiveStaffId && r.staffId !== effectiveStaffId) return false;

    // 5. Kiểm tra thời gian
    if (!isTransactionDateInPeriod(r.date, filter, options?.referenceDateStr)) return false;

    // 6. Kiểm tra Trạng thái nộp BHXH (submissionStatus)
    if (filter.submissionStatus === 'UNSUBMITTED') {
      // Hồ sơ đã thu tiền nhưng chưa nộp BHXH
      const isPaid = r.paymentStatus === 'Đã thu tiền';
      if (!isPaid || r.isSubmittedBHXH === true) return false;
    } else if (filter.submissionStatus === 'SUBMITTED') {
      if (r.isSubmittedBHXH !== true) return false;
    } else if (filter.submissionStatus && filter.submissionStatus !== 'ALL' && filter.submissionStatus !== 'all') {
      // Lọc theo mã đợt nộp cụ thể: Đợt_... hoặc BATCH_...
      const targetBatch = filter.submissionStatus.startsWith('batch_')
        ? filter.submissionStatus.replace('batch_', '')
        : filter.submissionStatus;
      if (r.isSubmittedBHXH !== true || r.submissionBatch !== targetBatch) return false;
    }

    // 7. Tìm kiếm thông minh
    if (filter.searchQuery && !matchesTransactionSearch(r, filter.searchQuery)) return false;

    // 8. Thẻ KPI 1-chạm (kpiQuickFilter)
    if (filter.kpiQuickFilter === 'PAID') {
      if (r.paymentStatus !== 'Đã thu tiền') return false;
    } else if (filter.kpiQuickFilter === 'PENDING') {
      if (r.paymentStatus !== 'Chờ thanh toán') return false;
    }

    return true;
  });
}

export interface TransactionKPIComputation {
  baseFiltered: any[];
  finalFiltered: any[];
  totalRev: number;
  totalPending: number;
  totalComm: number;
}

/**
 * Tính toán đồng thời danh sách hiển thị và các chỉ số KPI
 */
export function computeTransactionKPIs(
  records: any[],
  filter: TransactionFilterState,
  options?: FilterTransactionOptions,
  policies?: Policy[],
  settings?: Partial<SettingsType> | null
): TransactionKPIComputation {
  if (!Array.isArray(records)) {
    return {
      baseFiltered: [],
      finalFiltered: [],
      totalRev: 0,
      totalPending: 0,
      totalComm: 0
    };
  }

  // 1. Danh sách cơ sở (đã lọc thời gian, cán bộ, đợt nộp, tìm kiếm nhưng chưa áp dụng KPI quick filter)
  const baseFilterWithoutKpi: TransactionFilterState = {
    ...filter,
    kpiQuickFilter: 'ALL'
  };
  const baseFiltered = filterTransactionRecords(records, baseFilterWithoutKpi, options);

  // 2. Tính Tổng thu và Chờ thanh toán trên danh sách cơ sở
  let totalRev = 0;
  let totalPending = 0;

  baseFiltered.forEach(r => {
    const amt = Number(r.amount) || 0;
    if (r.paymentStatus === 'Đã thu tiền') {
      totalRev += amt;
    } else if (r.paymentStatus === 'Chờ thanh toán') {
      totalPending += amt;
    }
  });

  // 3. Danh sách hiển thị cuối cùng sau khi áp dụng KPI quick filter
  let finalFiltered = baseFiltered;
  if (filter.kpiQuickFilter === 'PAID') {
    finalFiltered = baseFiltered.filter(r => r.paymentStatus === 'Đã thu tiền');
  } else if (filter.kpiQuickFilter === 'PENDING') {
    finalFiltered = baseFiltered.filter(r => r.paymentStatus === 'Chờ thanh toán');
  }

  // 4. Tính Hoa hồng tương ứng theo danh sách hồ sơ đang được lọc
  let totalComm = 0;
  finalFiltered.forEach(r => {
    if (r.paymentStatus === 'Đã thu tiền') {
      const amt = Number(r.amount) || 0;
      const rate = getCommissionRateForRecord(r, policies, settings);
      totalComm += amt * rate;
    }
  });

  return {
    baseFiltered,
    finalFiltered,
    totalRev,
    totalPending,
    totalComm
  };
}
