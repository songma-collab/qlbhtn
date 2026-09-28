/**
 * Module Quản lý Đợt nộp BHXH/BHYT (Batch Submission Management)
 * Tiêu chuẩn định dạng: Đợt_YYYYMMDD_XX (ví dụ: Đợt_20260919_02)
 */
import { getLocalYYYYMMDD } from './helpers';
import type { RecordType } from '../context/types';

/**
 * Sinh mã đợt nộp chuẩn định dạng Đợt_YYYYMMDD_XX
 */
export const generateBatchCode = (dateStr?: string, seq: number = 1): string => {
  let datePart = '';
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    datePart = dateStr.replace(/-/g, '');
  } else {
    datePart = getLocalYYYYMMDD().replace(/-/g, '');
  }
  const seqPart = String(Math.max(1, seq)).padStart(2, '0');
  return `Đợt_${datePart}_${seqPart}`;
};

/**
 * Kiểm tra mã đợt nộp có hợp lệ theo chuẩn không (hỗ trợ cả tiền tố Đợt_ và BATCH_)
 */
export const isValidBatchCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') return false;
  return /^(?:Đợt|BATCH)_\d{8}_\d{2,}$/i.test(code.trim());
};

/**
 * Lấy số thứ tự kế tiếp cho ngày hiện tại dựa trên danh sách các đợt đã có
 * Tự động nhận diện cả tiền tố Đợt_ và BATCH_ cũ để tăng số thứ tự chính xác
 */
export const getNextBatchSequence = (existingBatches: string[], dateStr?: string): number => {
  const datePart = (dateStr ? dateStr.replace(/-/g, '') : getLocalYYYYMMDD().replace(/-/g, ''));
  const dotPrefix = `ĐỢT_${datePart}_`;
  const batchPrefix = `BATCH_${datePart}_`;

  let maxSeq = 0;
  for (const b of existingBatches) {
    if (!b) continue;
    const cleanB = b.trim().toUpperCase();
    if (cleanB.startsWith(dotPrefix)) {
      const numPart = cleanB.replace(dotPrefix, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    } else if (cleanB.startsWith(batchPrefix)) {
      const numPart = cleanB.replace(batchPrefix, '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }

  return maxSeq + 1;
};

export interface BatchSummary {
  batchCode: string;
  count: number;
  totalAmount: number;
  bhxhCount: number;
  bhytCount: number;
  submittedDate?: string;
  isSubmittedBHXH: boolean;
  records: RecordType[];
}

/**
 * Gom nhóm danh sách hồ sơ theo các đợt nộp
 */
export const groupRecordsByBatch = (records: RecordType[]): Map<string, BatchSummary> => {
  const map = new Map<string, BatchSummary>();

  records.forEach(r => {
    if (r.paymentStatus === 'Đã hủy') return;
    const batchKey = (r.submissionBatch || 'UNASSIGNED').trim();

    if (!map.has(batchKey)) {
      map.set(batchKey, {
        batchCode: batchKey,
        count: 0,
        totalAmount: 0,
        bhxhCount: 0,
        bhytCount: 0,
        submittedDate: r.submittedDate,
        isSubmittedBHXH: Boolean(r.isSubmittedBHXH),
        records: []
      });
    }

    const item = map.get(batchKey)!;
    item.count += 1;
    item.totalAmount += (Number(r.amount) || 0);
    if (r.type === 'BHXH') {
      item.bhxhCount += 1;
    } else {
      item.bhytCount += 1;
    }
    if (r.isSubmittedBHXH) {
      item.isSubmittedBHXH = true;
    }
    if (r.submittedDate && !item.submittedDate) {
      item.submittedDate = r.submittedDate;
    }
    item.records.push(r);
  });

  return map;
};
