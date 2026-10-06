import type { RecordType } from '../context/types';

export type SubmissionPeriodMode = 'MONTH' | 'QUARTER' | 'YEAR' | 'ALL';

export interface BatchDetailData {
  batchKey: string;
  batchName: string;
  submittedDate: string;
  isSubmitted: boolean;
  totalRecords: number;
  totalAmount: number;
  bhxhCount: number;
  bhytCount: number;
  participatingStaffCount: number;
  records: RecordType[];
}

export interface SubmissionBatchKPIs {
  totalSubmittedBatches: number;
  totalSubmittedRecords: number;
  totalSubmittedAmount: number;
  pendingRecords: number;
  pendingAmount: number;
}

/**
 * Lấy trạng thái mặc định của bộ lọc thời gian: Tháng hiện tại của lịch hệ thống
 */
export const getDefaultPeriodState = (referenceDate = new Date()) => {
  const y = referenceDate.getFullYear();
  const m = referenceDate.getMonth() + 1;
  return {
    periodMode: 'MONTH' as SubmissionPeriodMode,
    selectedMonth: `${y}-${String(m).padStart(2, '0')}`,
    selectedQuarter: Math.ceil(m / 3),
    selectedYear: y
  };
};

/**
 * Kiểm tra xem một chuỗi ngày (YYYY-MM-DD hoặc YYYY-MM) có nằm trong kỳ lọc được chọn hay không
 */
export const isDateInSubmissionPeriod = (
  dateStr: string | undefined | null,
  mode: SubmissionPeriodMode,
  monthStr: string,
  quarter: number,
  year: number
): boolean => {
  if (mode === 'ALL') return true;
  if (!dateStr || dateStr === 'Chưa nộp') return false;

  // Lọc theo Tháng (YYYY-MM)
  if (mode === 'MONTH') {
    return dateStr.startsWith(monthStr);
  }

  const y = parseInt(dateStr.slice(0, 4), 10);
  if (isNaN(y)) return false;

  // Lọc theo Năm
  if (mode === 'YEAR') {
    return y === year;
  }

  // Lọc theo Quý
  if (mode === 'QUARTER') {
    const m = parseInt(dateStr.slice(5, 7), 10);
    if (isNaN(m)) return false;
    return y === year && Math.ceil(m / 3) === quarter;
  }

  return true;
};

/**
 * Kiểm tra xem một đợt nộp có thỏa mãn kỳ lọc hay không:
 * - Nếu đợt đã nộp và có ngày chuyển (submittedDate): đối soát theo ngày nộp
 * - Nếu đợt chưa nộp: đối soát theo ngày phát sinh (r.date) của các hồ sơ trong đợt
 */
export const batchMatchesPeriod = (
  batch: BatchDetailData,
  mode: SubmissionPeriodMode,
  monthStr: string,
  quarter: number,
  year: number
): boolean => {
  if (mode === 'ALL') return true;

  if (batch.submittedDate && batch.submittedDate !== 'Chưa nộp') {
    return isDateInSubmissionPeriod(batch.submittedDate, mode, monthStr, quarter, year);
  }

  if (batch.records && batch.records.length > 0) {
    return batch.records.some(r => isDateInSubmissionPeriod(r.date, mode, monthStr, quarter, year));
  }

  return false;
};

/**
 * Tính toán các chỉ số KPI theo danh sách đợt nộp trong kỳ
 */
export const calculateBatchKPIs = (batches: BatchDetailData[]): SubmissionBatchKPIs => {
  let totalSubmittedBatches = 0;
  let totalSubmittedRecords = 0;
  let totalSubmittedAmount = 0;
  let pendingRecords = 0;
  let pendingAmount = 0;

  batches.forEach(b => {
    if (b.isSubmitted) {
      totalSubmittedBatches += 1;
      totalSubmittedRecords += b.totalRecords;
      totalSubmittedAmount += b.totalAmount;
    } else {
      pendingRecords += b.totalRecords;
      pendingAmount += b.totalAmount;
    }
  });

  return {
    totalSubmittedBatches,
    totalSubmittedRecords,
    totalSubmittedAmount,
    pendingRecords,
    pendingAmount
  };
};

/**
 * Tạo nhãn hiển thị cho kỳ đang chọn
 */
export const getPeriodDisplayLabel = (
  mode: SubmissionPeriodMode,
  monthStr: string,
  quarter: number,
  year: number
): string => {
  if (mode === 'MONTH') {
    const [y, m] = monthStr.split('-');
    return `Tháng ${m}/${y}`;
  }
  if (mode === 'QUARTER') {
    return `Quý ${quarter}/${year}`;
  }
  if (mode === 'YEAR') {
    return `Năm ${year}`;
  }
  return 'Toàn bộ thời gian';
};

/**
 * Tiến hoặc lùi 1 tháng
 */
export const stepMonth = (monthStr: string, direction: 'prev' | 'next'): string => {
  const parts = monthStr.split('-');
  const yStr = parts[0] || '2026';
  const mStr = parts[1] || '01';
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) {
    const now = new Date();
    y = now.getFullYear();
    m = now.getMonth() + 1;
  }

  if (direction === 'prev') {
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
  } else {
    if (m === 12) {
      m = 1;
      y += 1;
    } else {
      m += 1;
    }
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};

/**
 * Gom nhóm danh sách hồ sơ thành các đợt nộp (kèm phân loại typeFilter BHXH/BHYT/ALL)
 */
export const groupRecordsIntoBatches = (
  records: RecordType[],
  typeFilter: 'BHXH' | 'BHYT' | 'ALL' = 'ALL'
): BatchDetailData[] => {
  const map = new Map<string, {
    batchKey: string;
    batchName: string;
    submittedDate: string;
    isSubmitted: boolean;
    totalRecords: number;
    totalAmount: number;
    bhxhCount: number;
    bhytCount: number;
    staffIds: Set<string>;
    records: RecordType[];
  }>();

  records.forEach(r => {
    if ((r.payment_status || (r as any).paymentStatus) === 'Đã hủy') return;

    // Lọc theo loại BHXH / BHYT
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return;

    // Xác định tên đợt nộp
    const subBatch = r.submission_batch || (r as any).submissionBatch;
    const isSub = Boolean(r.is_submitted_bhxh ?? (r as any).isSubmittedBHXH);
    const sDate = r.submitted_date || (r as any).submittedDate;
    const hasBatch = Boolean(subBatch && subBatch.trim());
    const batchName = hasBatch ? subBatch!.trim() : (isSub ? 'Đợt chưa đặt tên' : 'Chưa gán đợt nộp');
    const submittedDate = sDate || (isSub ? r.date : 'Chưa nộp');
    const isSubmitted = isSub;

    // Key gom nhóm dựa trên tên đợt + ngày chuyển
    const groupKey = `${batchName}___${submittedDate}`;

    if (!map.has(groupKey)) {
      map.set(groupKey, {
        batchKey: groupKey,
        batchName: batchName,
        submittedDate: submittedDate,
        isSubmitted: isSubmitted,
        totalRecords: 0,
        totalAmount: 0,
        bhxhCount: 0,
        bhytCount: 0,
        staffIds: new Set(),
        records: []
      });
    }

    const b = map.get(groupKey)!;
    b.totalRecords += 1;
    b.totalAmount += (Number(r.amount) || 0);
    if (r.type === 'BHXH') b.bhxhCount += 1;
    else if (r.type === 'BHYT') b.bhytCount += 1;
    const stId = r.staff_id || (r as any).staffId;
    if (stId) b.staffIds.add(stId);
    b.records.push(r);
  });

  return Array.from(map.values()).map(b => ({
    batchKey: b.batchKey,
    batchName: b.batchName,
    submittedDate: b.submittedDate,
    isSubmitted: b.isSubmitted,
    totalRecords: b.totalRecords,
    totalAmount: b.totalAmount,
    bhxhCount: b.bhxhCount,
    bhytCount: b.bhytCount,
    participatingStaffCount: b.staffIds.size,
    records: b.records
  })).sort((a, b) => {
    if (a.submittedDate === 'Chưa nộp') return 1;
    if (b.submittedDate === 'Chưa nộp') return -1;
    return b.submittedDate.localeCompare(a.submittedDate);
  });
};
