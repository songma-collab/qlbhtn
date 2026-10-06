import type { RecordType, Policy } from '../context/types';
import { isDateLocked } from './helpers';
import { getCommissionRateForRecord } from './calculations';

export interface RefundRatioBreakdown {
  commissionRatio: number;
  nnSupportRatio: number;
  dpSupportRatio: number;
  clawbackCommission: number;
  clawbackNNSupport: number;
  clawbackDPSupport: number;
}

export interface RefundHistorySummary {
  originalAmount: number;
  alreadyRefunded: number;
  remainingRefundable: number;
  refundEntries: RecordType[];
}

export interface CreateClawbackPayloadOptions {
  originalRecord: RecordType;
  refundAmount: number;
  refundType: string;
  decisionNumber?: string | undefined;
  decisionDate?: string | undefined;
  refundMethod?: string | undefined;
  effectiveDate: string;
  reason: string;
  fromMonth?: string | undefined;
  toMonth?: string | undefined;
  months?: number | undefined;
  beneficiaryName?: string | undefined;
  beneficiaryAccount?: string | undefined;
  beneficiaryBank?: string | undefined;
  policies?: Policy[] | undefined;
  settings?: any | undefined;
}

/**
 * 1. Đóng băng tỷ lệ theo giao dịch gốc (Snapshot Invariant)
 * Thu hồi đúng tỷ lệ hoa hồng nhân viên đã được hưởng từ hồ sơ gốc.
 */
export function calculateClawbackRatio(
  originalRecord: RecordType,
  refundAmount: number,
  policies?: Policy[],
  settings?: any
): RefundRatioBreakdown {
  const origAmount = Number(originalRecord.amount) || 0;
  let origCommission = Number(originalRecord.commission) || 0;
  const origNNSupport = Number(originalRecord.nn_support_amount ?? (originalRecord as any).nnSupportAmount) || 0;
  const origDPSupport = Number(originalRecord.dp_support_amount ?? (originalRecord as any).dpSupportAmount) || 0;

  if (origAmount <= 0) {
    return {
      commissionRatio: 0,
      nnSupportRatio: 0,
      dpSupportRatio: 0,
      clawbackCommission: 0,
      clawbackNNSupport: 0,
      clawbackDPSupport: 0
    };
  }

  // Fallback: nếu hồ sơ gốc chưa lưu tĩnh trường commission, tính toán hoa hồng gốc mà nhân viên đã thực nhận
  if (origCommission === 0 && origAmount > 0) {
    const applied = originalRecord.applied_rates || (originalRecord as any).appliedRates;
    if (applied?.commissionRate || applied?.commission_rate) {
      origCommission = Math.round(origAmount * Number(applied.commissionRate || applied.commission_rate));
    } else {
      const rate = getCommissionRateForRecord(originalRecord, policies, settings);
      origCommission = Math.round(origAmount * rate);
    }
  }

  const commissionRatio = Math.abs(origCommission) / origAmount;
  const nnSupportRatio = Math.abs(origNNSupport) / origAmount;
  const dpSupportRatio = Math.abs(origDPSupport) / origAmount;

  const clawbackCommission = Math.round(refundAmount * commissionRatio);
  const clawbackNNSupport = Math.round(refundAmount * nnSupportRatio);
  const clawbackDPSupport = Math.round(refundAmount * dpSupportRatio);

  return {
    commissionRatio,
    nnSupportRatio,
    dpSupportRatio,
    clawbackCommission,
    clawbackNNSupport,
    clawbackDPSupport
  };
}

/**
 * 2. Lấy lịch sử và số tiền còn lại có thể thoái thu của hồ sơ gốc
 */
export function getRefundHistoryForRecord(originalRecordId: number, allRecords: RecordType[], originalRecordParam?: RecordType): RefundHistorySummary {
  const originalRecord = originalRecordParam || allRecords.find(r => r.id === originalRecordId);
  const origAmount = Number(originalRecord?.amount) || 0;

  const refundEntries = allRecords.filter(r => {
    const origId = r.original_record_id ?? (r as any).originalRecordId;
    const isAdj = r.is_adjustment ?? (r as any).isAdjustment;
    const pStat = r.payment_status || (r as any).paymentStatus;
    return origId === originalRecordId && (isAdj === true || pStat === 'Đã thoái thu');
  });

  const alreadyRefunded = refundEntries.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0);
  const remainingRefundable = Math.max(0, origAmount - alreadyRefunded);

  return {
    originalAmount: origAmount,
    alreadyRefunded,
    remainingRefundable,
    refundEntries
  };
}

/**
 * 3. Kiểm tra tính hợp lệ trước khi lập bút toán thoái thu (Defense Invariants)
 */
export function validateRefundClawback(
  originalRecord: RecordType,
  refundAmount: number,
  effectiveDate: string,
  allRecords: RecordType[],
  policies: Policy[],
  userRole?: string
): { isValid: boolean; errorMessage?: string } {
  // Quyền hạn: Admin hoặc Quản lý
  const role = userRole || '';
  const hasPerm = role === 'Admin' || role === 'admin' || role === 'Quản lý';
  if (!hasPerm) {
    return { isValid: false, errorMessage: 'Từ chối quyền hạn: Chỉ Admin hoặc Quản lý mới có quyền lập bút toán thoái thu.' };
  }

  // Hồ sơ gốc không được ở trạng thái Đã hủy
  if ((originalRecord.payment_status || (originalRecord as any).paymentStatus) === 'Đã hủy') {
    return { isValid: false, errorMessage: `Hồ sơ "${originalRecord.name}" đã ở trạng thái Đã hủy, không thể thoái thu.` };
  }

  // Số tiền phải > 0
  if (!refundAmount || refundAmount <= 0) {
    return { isValid: false, errorMessage: 'Số tiền thoái thu hoàn trả phải lớn hơn 0.' };
  }

  // Kiểm tra trần số tiền còn lại có thể thoái thu
  const { remainingRefundable, alreadyRefunded } = getRefundHistoryForRecord(originalRecord.id, allRecords);
  if (refundAmount > remainingRefundable) {
    return { 
      isValid: false, 
      errorMessage: `Số tiền thoái thu (${refundAmount.toLocaleString('vi-VN')}đ) vượt quá số tiền còn lại (${remainingRefundable.toLocaleString('vi-VN')}đ). Hồ sơ gốc: ${(Number(originalRecord.amount) || 0).toLocaleString('vi-VN')}đ, đã thoái: ${alreadyRefunded.toLocaleString('vi-VN')}đ.`
    };
  }

  // Kiểm tra khóa sổ kỳ tài chính của ngày hiệu lực
  const p = policies.find(x => x.parameter_type === 'locked_periods' && x.is_active);
  let lockedKeys: string[] = [];
  if (p) {
    if (Array.isArray(p.value)) lockedKeys = p.value;
    else if (p.value && Array.isArray(p.value.lockedKeys)) lockedKeys = p.value.lockedKeys;
  }

  if (isDateLocked(effectiveDate, lockedKeys)) {
    return { 
      isValid: false, 
      errorMessage: `Ngày hạch toán "${effectiveDate}" thuộc kỳ tài chính đã BỊ KHÓA SỔ. Bút toán thoái thu phải được ghi nhận vào kỳ hiện tại đang mở.` 
    };
  }

  return { isValid: true };
}

/**
 * 4. Xây dựng đối tượng bút toán âm hạch toán vào bảng records (Clawback Pattern)
 */
export function buildClawbackRecordPayload(options: CreateClawbackPayloadOptions): Omit<RecordType, 'id'> {
  const {
    originalRecord,
    refundAmount,
    refundType,
    decisionNumber,
    decisionDate,
    refundMethod = 'TIEN_MAT',
    effectiveDate,
    reason,
    fromMonth,
    toMonth,
    months,
    beneficiaryName,
    beneficiaryAccount,
    beneficiaryBank,
    policies,
    settings
  } = options;

  const { clawbackCommission, clawbackNNSupport, clawbackDPSupport } = calculateClawbackRatio(
    originalRecord,
    refundAmount,
    policies,
    settings
  );

  return {
    name: originalRecord.name,
    cccd: originalRecord.cccd,
    phone: originalRecord.phone,
    bhxh: originalRecord.bhxh,
    old_bhxh: originalRecord.old_bhxh || (originalRecord as any).oldBhxh,
    address: originalRecord.address,
    dob: originalRecord.dob,
    gender: originalRecord.gender,
    type: originalRecord.type,
    sub_type: originalRecord.sub_type || (originalRecord as any).subType,
    months: months !== undefined ? months : (originalRecord.months || 1),
    from_month: fromMonth || originalRecord.from_month || (originalRecord as any).fromMonth || null,
    to_month: toMonth || originalRecord.to_month || (originalRecord as any).toMonth || null,
    date: effectiveDate, // Ghi nhận tại kỳ mở hiện tại
    target_date: originalRecord.target_date || (originalRecord as any).targetDate,
    effective_date: originalRecord.effective_date || (originalRecord as any).effectiveDate,
    status: 'Hoạt động',
    payment_status: 'Đã thoái thu',
    action_type: 'Thoái thu hoàn trả',
    staff_id: originalRecord.staff_id || (originalRecord as any).staffId,
    notes: reason ? `${reason} (QĐ: ${decisionNumber || 'N/A'})` : `Thoái thu hoàn trả cho hồ sơ #${originalRecord.id}`,

    // Ghi nhận dòng tiền âm và thu hồi hoa hồng nhân viên
    amount: -Math.abs(refundAmount),
    commission: -Math.abs(clawbackCommission),
    nn_support_amount: -Math.abs(clawbackNNSupport),
    dp_support_amount: -Math.abs(clawbackDPSupport),

    // Cờ và liên kết gốc
    is_adjustment: true,
    original_record_id: originalRecord.id,
    adjustment_reason: reason,

    // Thông tin nghiệp vụ hoàn trả
    refund_type: refundType,
    decision_number: decisionNumber,
    decision_date: decisionDate,
    refund_method: refundMethod,
    refund_beneficiary_name: beneficiaryName || originalRecord.name,
    refund_beneficiary_account: beneficiaryAccount,
    refund_beneficiary_bank: beneficiaryBank,

    // Kế thừa snapshot chính sách từ giao dịch gốc
    base_salary_snapshot: originalRecord.base_salary_snapshot ?? (originalRecord as any).baseSalarySnapshot,
    poverty_standard_snapshot: originalRecord.poverty_standard_snapshot ?? (originalRecord as any).povertyStandardSnapshot,
    policy_version_id: originalRecord.policy_version_id ?? (originalRecord as any).policyVersionId,
    applied_rates: originalRecord.applied_rates ?? (originalRecord as any).appliedRates,

    // Kế thừa liên kết khách hàng Master Data và nơi KCB ban đầu
    customer_id: originalRecord.customer_id || (originalRecord as any).customerId,
    customer_key: originalRecord.customer_key || (originalRecord as any).customerKey,
    hospital_code: originalRecord.hospital_code || (originalRecord as any).hospitalCode,
    hospital_name: originalRecord.hospital_name || (originalRecord as any).hospitalName
  };
}

// Aliases and helper functions for convenience and testing
export const calculateRefundRatios = calculateClawbackRatio;
export const createClawbackPayload = buildClawbackRecordPayload;

export function getRefundHistory(originalRecord: RecordType, allRecords: RecordType[] = []): RefundHistorySummary {
  return getRefundHistoryForRecord(originalRecord.id, allRecords, originalRecord);
}

export function validateRefundAmount(
  originalRecord: RecordType,
  refundAmount: number,
  existingClawbacks: RecordType[] = []
): { isValid: boolean; error?: string } {
  if (!refundAmount || refundAmount <= 0) {
    return { isValid: false, error: 'Số tiền thoái thu hoàn trả phải lớn hơn 0.' };
  }
  const origAmount = Number(originalRecord.amount) || 0;
  if (refundAmount > origAmount) {
    return { isValid: false, error: `Số tiền thoái thu vượt quá số tiền giao dịch gốc (${origAmount.toLocaleString('vi-VN')}đ).` };
  }
  const history = getRefundHistory(originalRecord, existingClawbacks);
  if (refundAmount > history.remainingRefundable) {
    return { isValid: false, error: `Số tiền thoái thu (${refundAmount.toLocaleString('vi-VN')}đ) vượt quá số tiền còn lại (${history.remainingRefundable.toLocaleString('vi-VN')}đ) của hồ sơ gốc.` };
  }
  return { isValid: true };
}

export function validateAdjustmentPeriodDate(
  _originalRecord: RecordType,
  effectiveDate: string,
  lockedKeys: string[]
): { isValid: boolean; error?: string } {
  if (isDateLocked(effectiveDate, lockedKeys)) {
    return { isValid: false, error: `Ngày hạch toán "${effectiveDate}" thuộc kỳ tài chính đã chốt sổ. Bút toán điều chỉnh phải ghi nhận tại kỳ mở hiện tại.` };
  }
  return { isValid: true };
}
