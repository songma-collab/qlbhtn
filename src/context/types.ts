export type RecordType = {
  id: number;
  date: string;
  name: string;
  cccd?: string;
  phone: string;
  address?: string;
  bhxh?: string;
  old_bhxh?: string; // Cột chuẩn PostgreSQL duy nhất (Single Source of Truth)
  /** @deprecated Sử dụng old_bhxh. Thuộc tính oldBhxh được giữ lại tạm thời để tương thích với các component UI cũ */
  oldBhxh?: string;
  bhxhCu?: string;
  type: string; // 'BHXH' | 'BHYT'
  subType?: string;
  wage?: number;
  months: number;
  supportPct?: number;
  amount: number;
  status: string;
  paymentStatus: string;
  notes?: string;
  staffId?: string;
  fromMonth?: string;
  toMonth?: string;
  from_month?: string;
  to_month?: string;
  from_month_date?: string;
  to_month_date?: string;
  fromMonthDate?: string;
  toMonthDate?: string;
  decision_date?: string;
  basePremium?: number;
  nnSupportPct?: number;
  nnSupportAmount?: number;
  dpSupportPct?: number;
  dpSupportAmount?: number;
  effectiveDate?: string;
  targetDate?: string;
  nextPayment?: string;

  // Specific BHYT fields
  householdId?: string;
  members?: Array<{
    name: string;
    cccd?: string;
    phone?: string;
    bhxh?: string;
    dob?: string;
    durationMonths?: number;
    amount?: number;
  }>;
  actionType?: string;
  created_at?: string;
  staff_id?: string;
  dob?: string;
  gender?: string;
  nation?: string;
  email?: string;
  income?: number;
  method?: string;
  discountAmount?: number;
  penaltyAmount?: number;
  commission?: number;
  support?: number;
  recvName?: string;
  recvPhone?: string;
  recvAddress?: string;
  isSubmittedBHXH?: boolean;
  submissionBatch?: string;
  submittedDate?: string;

  // Snapshot chính sách tại thời điểm lập giao dịch
  baseSalarySnapshot?: number;
  povertyStandardSnapshot?: number;
  policyVersionId?: string | number;
  appliedRates?: {
    nnSupportPct?: number;
    dpSupportPct?: number;
    investmentRate?: number;
    bhytRate?: number;
    commissionRate?: number;
  };

  // Bút toán bù trừ âm (Clawback / Negative Adjustment)
  isAdjustment?: boolean;
  originalRecordId?: number;
  adjustmentReason?: string;
  refundType?: string;
  decisionNumber?: string;
  decisionDate?: string;
  refundMethod?: string;
  refundBeneficiaryName?: string;
  refundBeneficiaryAccount?: string;
  refundBeneficiaryBank?: string;

  // Khóa liên kết với Bảng Khách hàng gốc (customers Master Table)
  customerId?: string;
  customer_id?: string;
  customerKey?: string;
  customer_key?: string;
  updated_at?: string;
  hospitalCode?: string;
  hospitalName?: string;
  
  // Idempotency token chống gửi lặp giao dịch
  idempotencyKey?: string;
  idempotency_key?: string;
};

export type RecordItem = RecordType;

/**
 * Cấu trúc bản ghi thuần snake_case trên PostgreSQL Database (Chuẩn hóa toàn diện Enterprise)
 */
export type DbRecordRow = {
  id?: number;
  date: string;
  name: string;
  dob?: string | null;
  gender?: string | null;
  phone?: string | null;
  cccd?: string | null;
  bhxh?: string | null;
  old_bhxh?: string | null;
  address?: string | null;
  type: string;
  sub_type?: string | null;
  wage?: number | null;
  income?: number | null;
  months: number;
  from_month?: string | null;
  to_month?: string | null;
  from_month_date?: string | null;
  to_month_date?: string | null;
  amount: number;
  base_premium?: number | null;
  support_pct?: number | null;
  nn_support_pct?: number | null;
  dp_support_pct?: number | null;
  nn_support_amount?: number | null;
  dp_support_amount?: number | null;
  discount_amount?: number | null;
  penalty_amount?: number | null;
  commission?: number | null;
  support?: number | null;
  method?: string | null;
  status: string;
  payment_status: string;
  staff_id?: string | null;
  action_type?: string | null;
  notes?: string | null;
  members?: any[] | null;
  household_id?: string | null;
  effective_date?: string | null;
  target_date?: string | null;
  next_payment?: string | null;
  nation?: string | null;
  email?: string | null;
  recv_name?: string | null;
  recv_phone?: string | null;
  recv_address?: string | null;
  ip_address?: string | null;
  is_submitted_bhxh?: boolean;
  submission_batch?: string | null;
  submitted_date?: string | null;
  base_salary_snapshot?: number | null;
  poverty_standard_snapshot?: number | null;
  policy_version_id?: number | string | null;
  applied_rates?: Record<string, any> | null;
  is_adjustment?: boolean;
  original_record_id?: number | null;
  adjustment_reason?: string | null;
  refund_type?: string | null;
  decision_number?: string | null;
  decision_date?: string | null;
  refund_method?: string | null;
  refund_beneficiary_name?: string | null;
  refund_beneficiary_account?: string | null;
  refund_beneficiary_bank?: string | null;
  hospital_code?: string | null;
  hospital_name?: string | null;
  customer_id?: string | null;
  customer_key?: string | null;
  idempotency_key?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StaffType = {
  id: string;
  name: string;
  cccd?: string;
  phone: string;
  email?: string;
  area?: string;
  role: string;
  status: string;
  username?: string;
  staffCode?: string;
  agencyName?: string;
  agencyCode?: string;
};

export type SettingsType = { 
  id?: number; 
  commBHXHNew?: number; 
  commBHXHRenew?: number; 
  commBHYTNew?: number; 
  commBHYTRenew?: number; 
  commBHXH?: number; 
  commBHYT?: number; 
  investmentRate?: number; 
  baseSalary?: number; 
  cpiIndex?: Record<string, number>; 
  povertyStandard?: number; 
  // Cấu hình thông tin thanh toán VietQR Đại lý
  agencyName?: string;
  agencyCode?: string;
  bankBin?: string;
  bankId?: string;
  bankName?: string;
  accountNumber?: string;
  accountNo?: string;
  accountHolder?: string;
  accountName?: string;
  qrTemplate?: 'compact' | 'compact2' | 'qr_only' | 'print' | string;
  // Fallbacks cũ tương thích
  bank_id?: string;
  bank_account?: string;
  bank_owner?: string;
  agency_name?: string;
  agency_code?: string;
  bank_bin?: string;
  bank_name?: string;
  account_number?: string;
  account_holder?: string;
  qr_template?: string;
  // Ma trận phân quyền chi tiết cho các cấp vai trò
  rolePermissions?: Record<string, string[]>;
  // Cấu hình phân quyền đặc cách riêng theo nhân viên (User Overrides)
  userOverrides?: Record<string, UserPermissionOverride>;
  // Cấu hình thông số in ấn và mẫu biểu báo cáo hành chính
  parentAgencyName?: string;
  managerName?: string;
  reportLocation?: string;
  controllerName?: string;
  managerTitle?: string;
  creatorTitle?: string;
  controllerTitle?: string;
};

export interface UserPermissionOverride {
  staffId: string;
  staffName?: string;
  staffCode?: string;
  role?: string;
  granted: string[];
  revoked: string[];
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type UserOverridesMap = Record<string, UserPermissionOverride>;

export interface Policy {
  id?: number;
  parameter_type: string;
  name: string;
  value: any;
  effective_date: string;
  description?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  created_by?: string;
}

export type AuditLogType = {
  id: string;
  timestamp: string;
  user?: string;
  userName?: string;
  userId?: string;
  action: string;
  details: string;
  ip?: string;
};

export type CustomerType = {
  id: string;
  customer_key: string;
  type: string;
  name: string;
  cccd?: string;
  bhxh?: string;
  old_bhxh?: string; // Cột chuẩn PostgreSQL duy nhất
  /** @deprecated Sử dụng old_bhxh */
  oldBhxh?: string;
  phone?: string;
  address?: string;
  dob?: string;
  gender?: string;
  nation?: string;
  email?: string;
  has_bhxh?: boolean;
  has_bhyt?: boolean;
  latest_record_id?: number;
  latest_date?: string;
  effective_date?: string;
  next_payment?: string;
  next_payment_bhxh?: string;
  next_payment_bhyt?: string;
  latest_amount?: number;
  status: string;
  payment_status: string;
  notes?: string;
  staff_id?: string;
  total_contributions: number;
  total_amount_paid: number;
  household_id?: string;
  members?: Array<{
    name: string;
    cccd?: string;
    phone?: string;
    bhxh?: string;
    dob?: string;
    durationMonths?: number;
    amount?: number;
  }>;
  recv_name?: string;
  recv_phone?: string;
  recv_address?: string;
  created_at?: string;
  updated_at?: string;
  records?: RecordType[];
  // Quá trình tham gia BHXH trước đây (Bắt buộc & Tự nguyện nơi khác)
  prior_periods?: CustomerParticipationPeriod[];
  prior_voluntary_months?: number;
  prior_compulsory_months?: number;
  prior_participation_notes?: string;
};

export type CustomerParticipationPeriod = {
  id: number;
  type: 'batbuoc' | 'nhanuoc' | 'tunguyen';
  fromMonth?: string;
  toMonth?: string;
  months?: number;
  sm: number;
  sy: number;
  em: number;
  ey: number;
  salary: string;
  workplace?: string;
  position?: string;
  notes?: string;
};

export type CustomerTransactionView = {
  transaction_id: number;
  transaction_date: string;
  service_type: string;
  action_type?: string;
  duration_months: number;
  from_month?: string;
  to_month?: string;
  transaction_amount: number;
  payment_status: string;
  staff_id?: string;
  is_submitted_bhxh?: boolean;
  submission_batch?: string;
  transaction_notes?: string;
  customer_id: string;
  customer_key: string;
  customer_name: string;
  customer_cccd?: string;
  customer_bhxh?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_dob?: string;
  customer_gender?: string;
  total_contributions: number;
  total_amount_paid: number;
  next_payment?: string;
};

// ======================================================================
// HELPER FUNCTIONS ĐỒNG BỘ DỮ LIỆU CỘT OLD_BHXH VÀ LEGACY PAYLOAD
// ======================================================================

/**
 * Trích xuất và làm sạch giá trị mã BHXH cũ từ bất kỳ cấu trúc payload nào
 * (hỗ trợ cả old_bhxh chuẩn, oldBhxh camelCase, và bhxhCu).
 */
export function extractOldBhxh(
  payload: { old_bhxh?: string | null; oldBhxh?: string | null; bhxhCu?: string | null } | null | undefined
): string | undefined {
  if (!payload) return undefined;
  const rawValue = payload.old_bhxh ?? payload.oldBhxh ?? payload.bhxhCu;
  if (rawValue === null || rawValue === undefined) return undefined;
  const cleaned = String(rawValue).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Chuẩn hóa một bản ghi (Record hoặc Customer) về chuẩn duy nhất `old_bhxh`,
 * đồng thời điền bí danh `oldBhxh` để tương thích 100% với giao diện người dùng cũ.
 */
export function normalizeLegacyPayload<T extends Record<string, any>>(payload: T): T & Record<string, any> {
  if (!payload || typeof payload !== 'object') return payload;
  const unifiedOldBhxh = extractOldBhxh(payload);
  
  const refundType = payload.refundType ?? payload.refund_type;
  const decisionNumber = payload.decisionNumber ?? payload.decision_number;
  const decisionDate = payload.decisionDate ?? payload.decision_date;
  const refundMethod = payload.refundMethod ?? payload.refund_method;
  const refundBeneficiaryName = payload.refundBeneficiaryName ?? payload.refund_beneficiary_name;
  const refundBeneficiaryAccount = payload.refundBeneficiaryAccount ?? payload.refund_beneficiary_account;
  const refundBeneficiaryBank = payload.refundBeneficiaryBank ?? payload.refund_beneficiary_bank;
  const hospitalCode = payload.hospitalCode ?? payload.hospital_code;
  const hospitalName = payload.hospitalName ?? payload.hospital_name;
  const staffId = payload.staffId ?? payload.staff_id;
  const customerId = payload.customerId ?? payload.customer_id;
  const customerKey = payload.customerKey ?? payload.customer_key;
  const isAdjustment = payload.isAdjustment ?? payload.is_adjustment;
  const originalRecordId = payload.originalRecordId ?? payload.original_record_id;
  const adjustmentReason = payload.adjustmentReason ?? payload.adjustment_reason;

  return {
    ...payload,
    old_bhxh: unifiedOldBhxh,
    oldBhxh: unifiedOldBhxh,
    refundType,
    refund_type: refundType,
    decisionNumber,
    decision_number: decisionNumber,
    decisionDate,
    decision_date: decisionDate,
    refundMethod,
    refund_method: refundMethod,
    refundBeneficiaryName,
    refund_beneficiary_name: refundBeneficiaryName,
    refundBeneficiaryAccount,
    refund_beneficiary_account: refundBeneficiaryAccount,
    refundBeneficiaryBank,
    refund_beneficiary_bank: refundBeneficiaryBank,
    hospitalCode,
    hospital_code: hospitalCode,
    hospitalName,
    hospital_name: hospitalName,
    staffId,
    staff_id: staffId,
    customerId,
    customer_id: customerId,
    customerKey,
    customer_key: customerKey,
    isAdjustment,
    is_adjustment: isAdjustment,
    originalRecordId,
    original_record_id: originalRecordId,
    adjustmentReason,
    adjustment_reason: adjustmentReason
  };
}

/**
 * Chuẩn bị payload gửi lên CSDL Supabase / PostgreSQL.
 * Đảm bảo chỉ gửi cột chuẩn `old_bhxh`, loại bỏ `oldBhxh` dư thừa để tránh lỗi schema cache.
 */
export function sanitizeRecordForDb<T extends Record<string, any>>(record: T): Omit<T, 'oldBhxh' | 'bhxhCu'> & { old_bhxh?: string } {
  const unifiedOldBhxh = extractOldBhxh(record);
  const copy: Record<string, any> = { ...record };
  delete copy.oldBhxh;
  delete copy.bhxhCu;
  if (unifiedOldBhxh !== undefined) {
    copy.old_bhxh = unifiedOldBhxh;
  }
  return copy as Omit<T, 'oldBhxh' | 'bhxhCu'> & { old_bhxh?: string };
}
