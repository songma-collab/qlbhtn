export type RecordType = {
  id: number;
  date: string;
  name: string;
  cccd?: string | undefined;
  phone: string;
  address?: string | undefined;
  bhxh?: string | undefined;
  old_bhxh?: string | undefined; // Cột chuẩn PostgreSQL duy nhất (Single Source of Truth)
  type: string; // 'BHXH' | 'BHYT'
  sub_type?: string | undefined;
  wage?: number | undefined;
  income?: number | undefined;
  months: number;
  support_pct?: number | undefined;
  amount: number;
  status: string;
  payment_status: string;
  notes?: string | undefined;
  staff_id?: string | undefined;
  from_month?: string | undefined;
  to_month?: string | undefined;
  from_month_date?: string | undefined;
  to_month_date?: string | undefined;
  decision_date?: string | undefined;
  base_premium?: number | undefined;
  nn_support_pct?: number | undefined;
  nn_support_amount?: number | undefined;
  dp_support_pct?: number | undefined;
  dp_support_amount?: number | undefined;
  discount_amount?: number | undefined;
  penalty_amount?: number | undefined;
  commission?: number | undefined;
  support?: number | undefined;
  method?: string | undefined;
  action_type?: string | undefined;
  effective_date?: string | undefined;
  target_date?: string | undefined;
  next_payment?: string | undefined;

  // Specific BHYT fields
  household_id?: string | undefined;
  members?: Array<{
    name: string;
    cccd?: string | undefined;
    phone?: string | undefined;
    bhxh?: string | undefined;
    dob?: string | undefined;
    durationMonths?: number | undefined;
    amount?: number | undefined;
  }> | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
  dob?: string | undefined;
  gender?: string | undefined;
  nation?: string | undefined;
  email?: string | undefined;
  recv_name?: string | undefined;
  recv_phone?: string | undefined;
  recv_address?: string | undefined;
  is_submitted_bhxh?: boolean | undefined;
  submission_batch?: string | undefined;
  submitted_date?: string | undefined;

  // Snapshot chính sách tại thời điểm lập giao dịch
  base_salary_snapshot?: number | undefined;
  poverty_standard_snapshot?: number | undefined;
  policy_version_id?: string | number | undefined;
  applied_rates?: {
    nn_support_pct?: number | undefined;
    dp_support_pct?: number | undefined;
    investment_rate?: number | undefined;
    bhyt_rate?: number | undefined;
    commission_rate?: number | undefined;
  } | undefined;

  // Bút toán bù trừ âm (Clawback / Negative Adjustment)
  is_adjustment?: boolean | undefined;
  original_record_id?: number | undefined;
  adjustment_reason?: string | undefined;
  refund_type?: string | undefined;
  decision_number?: string | undefined;
  refund_method?: string | undefined;
  refund_beneficiary_name?: string | undefined;
  refund_beneficiary_account?: string | undefined;
  refund_beneficiary_bank?: string | undefined;

  // Khóa liên kết với Bảng Khách hàng gốc (customers Master Table)
  customer_id?: string | undefined;
  customer_key?: string | undefined;
  hospital_code?: string | undefined;
  hospital_name?: string | undefined;
  
  // Idempotency token chống gửi lặp giao dịch
  idempotency_key?: string | undefined;
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
  cccd?: string | undefined;
  phone: string;
  email?: string | undefined;
  area?: string | undefined;
  role: string;
  status: string;
  username?: string | undefined;
  staff_code?: string | undefined;
  agency_name?: string | undefined;
  agency_code?: string | undefined;
};

export type SettingsType = { 
  id?: number | undefined; 
  comm_bhxh_new?: number | undefined; 
  comm_bhxh_renew?: number | undefined; 
  comm_bhyt_new?: number | undefined; 
  comm_bhyt_renew?: number | undefined; 
  comm_bhxh?: number | undefined; 
  comm_bhyt?: number | undefined; 
  investment_rate?: number | undefined; 
  base_salary?: number | undefined; 
  cpi_index?: Record<string, number> | undefined; 
  poverty_standard?: number | undefined; 
  // Cấu hình thông tin thanh toán VietQR Đại lý
  agency_name?: string | undefined;
  agency_code?: string | undefined;
  bank_bin?: string | undefined;
  bank_id?: string | undefined;
  bank_name?: string | undefined;
  account_number?: string | undefined;
  account_holder?: string | undefined;
  qr_template?: 'compact' | 'compact2' | 'qr_only' | 'print' | string | undefined;
  // Fallbacks cũ tương thích
  commBHXHNew?: number | undefined; 
  commBHXHRenew?: number | undefined; 
  commBHYTNew?: number | undefined; 
  commBHYTRenew?: number | undefined; 
  // Cấu hình tỷ lệ hoa hồng theo phương thức đóng mới
  commBHXHNew1M?: number | undefined;
  commBHXHNew3M?: number | undefined;
  commBHXHNew6M?: number | undefined;
  commBHXHNew12M?: number | undefined;
  comm_bhxh_new_1m?: number | undefined;
  comm_bhxh_new_3m?: number | undefined;
  comm_bhxh_new_6m?: number | undefined;
  comm_bhxh_new_12m?: number | undefined;
  commBHXH?: number | undefined; 
  commBHYT?: number | undefined; 
  investmentRate?: number | undefined; 
  baseSalary?: number | undefined; 
  cpiIndex?: Record<string, number> | undefined; 
  povertyStandard?: number | undefined; 
  agencyName?: string | undefined;
  agencyCode?: string | undefined;
  bankBin?: string | undefined;
  bankId?: string | undefined;
  bankName?: string | undefined;
  accountNumber?: string | undefined;
  accountNo?: string | undefined;
  accountHolder?: string | undefined;
  accountName?: string | undefined;
  qrTemplate?: 'compact' | 'compact2' | 'qr_only' | 'print' | string | undefined;
  bank_account?: string | undefined;
  bank_owner?: string | undefined;
  // Ma trận phân quyền chi tiết cho các cấp vai trò
  role_permissions?: Record<string, string[]> | undefined;
  rolePermissions?: Record<string, string[]> | undefined;
  // Cấu hình phân quyền đặc cách riêng theo nhân viên (User Overrides)
  user_overrides?: Record<string, UserPermissionOverride> | undefined;
  userOverrides?: Record<string, UserPermissionOverride> | undefined;
  // Cấu hình thông số in ấn và mẫu biểu báo cáo hành chính
  parent_agency_name?: string | undefined;
  manager_name?: string | undefined;
  report_location?: string | undefined;
  controller_name?: string | undefined;
  manager_title?: string | undefined;
  creator_title?: string | undefined;
  controller_title?: string | undefined;
  parentAgencyName?: string | undefined;
  managerName?: string | undefined;
  reportLocation?: string | undefined;
  controllerName?: string | undefined;
  managerTitle?: string | undefined;
  creatorTitle?: string | undefined;
  controllerTitle?: string | undefined;
};

export interface UserPermissionOverride {
  staff_id?: string | undefined;
  staffId?: string | undefined;
  staff_name?: string | undefined;
  staffName?: string | undefined;
  staff_code?: string | undefined;
  staffCode?: string | undefined;
  role?: string | undefined;
  granted: any[];
  revoked: any[];
  notes?: string | undefined;
  updated_at?: string | undefined;
  updatedAt?: string | undefined;
  updated_by?: string | undefined;
  updatedBy?: string | undefined;
}

export type UserOverridesMap = Record<string, UserPermissionOverride>;

export interface PolicyCommissionValue {
  commBHXHNew?: number | undefined;
  commBHXHRenew?: number | undefined;
  commBHYTNew?: number | undefined;
  commBHYTRenew?: number | undefined;
  commBHXHNew1M?: number | undefined;
  commBHXHNew3M?: number | undefined;
  commBHXHNew6M?: number | undefined;
  commBHXHNew12M?: number | undefined;
}

export interface Policy {
  id?: number | undefined;
  parameter_type: string;
  name: string;
  value: any;
  effective_date: string;
  description?: string | undefined;
  notes?: string | undefined;
  is_active: boolean;
  created_at?: string | undefined;
  created_by?: string | undefined;
}

export type AuditLogType = {
  id: string;
  timestamp: string;
  user?: string | undefined;
  userName?: string | undefined;
  userId?: string | undefined;
  action: string;
  details: string;
  ip?: string | undefined;
};

export type CustomerType = {
  id: string;
  customer_key: string;
  type: string;
  name: string;
  cccd?: string | undefined;
  bhxh?: string | undefined;
  old_bhxh?: string | undefined; // Cột chuẩn PostgreSQL duy nhất
  phone?: string | undefined;
  address?: string | undefined;
  dob?: string | undefined;
  gender?: string | undefined;
  nation?: string | undefined;
  email?: string | undefined;
  has_bhxh?: boolean | undefined;
  has_bhyt?: boolean | undefined;
  latest_record_id?: number | undefined;
  latest_date?: string | undefined;
  effective_date?: string | undefined;
  next_payment?: string | undefined;
  next_payment_bhxh?: string | undefined;
  next_payment_bhyt?: string | undefined;
  from_month?: string | undefined;
  to_month?: string | undefined;
  latest_amount?: number | undefined;
  status: string;
  payment_status: string;
  notes?: string | undefined;
  staff_id?: string | undefined;
  total_contributions: number;
  total_amount_paid: number;
  household_id?: string | undefined;
  members?: Array<{
    name: string;
    cccd?: string | undefined;
    phone?: string | undefined;
    bhxh?: string | undefined;
    dob?: string | undefined;
    durationMonths?: number | undefined;
    amount?: number | undefined;
  }> | undefined;
  recv_name?: string | undefined;
  recv_phone?: string | undefined;
  recv_address?: string | undefined;
  created_at?: string | undefined;
  updated_at?: string | undefined;
  records?: RecordType[] | undefined;
  // Quá trình tham gia BHXH trước đây (Bắt buộc & Tự nguyện nơi khác)
  prior_periods?: CustomerParticipationPeriod[] | undefined;
  prior_voluntary_months?: number | undefined;
  prior_compulsory_months?: number | undefined;
  prior_participation_notes?: string | undefined;
};

export type CustomerParticipationPeriod = {
  id: number;
  type: 'batbuoc' | 'nhanuoc' | 'tunguyen';
  from_month?: string | undefined;
  to_month?: string | undefined;
  fromMonth?: string | undefined;
  toMonth?: string | undefined;
  months?: number | undefined;
  sm: number;
  sy: number;
  em: number;
  ey: number;
  salary: string;
  workplace?: string | undefined;
  position?: string | undefined;
  notes?: string | undefined;
};

export type CustomerTransactionView = {
  transaction_id: number;
  transaction_date: string;
  service_type: string;
  action_type?: string | undefined;
  duration_months: number;
  from_month?: string | undefined;
  to_month?: string | undefined;
  transaction_amount: number;
  payment_status: string;
  staff_id?: string | undefined;
  is_submitted_bhxh?: boolean | undefined;
  submission_batch?: string | undefined;
  transaction_notes?: string | undefined;
  customer_id: string;
  customer_key: string;
  customer_name: string;
  customer_cccd?: string | undefined;
  customer_bhxh?: string | undefined;
  customer_phone?: string | undefined;
  customer_address?: string | undefined;
  customer_dob?: string | undefined;
  customer_gender?: string | undefined;
  total_contributions: number;
  total_amount_paid: number;
  next_payment?: string | undefined;
};

// ======================================================================
// HELPER FUNCTIONS ĐỒNG BỘ DỮ LIỆU CỘT OLD_BHXH VÀ LEGACY PAYLOAD
// ======================================================================

/**
 * Trích xuất và làm sạch giá trị mã BHXH cũ từ bất kỳ cấu trúc payload nào
 */
export function extractOldBhxh(
  payload: { old_bhxh?: string | null; oldBhxh?: string | null; bhxhCu?: string | null } | null | undefined
): string | undefined {
  if (!payload) return undefined;
  const rawValue = (payload as any).old_bhxh ?? (payload as any).oldBhxh ?? (payload as any).bhxhCu;
  if (rawValue === null || rawValue === undefined) return undefined;
  const cleaned = String(rawValue).trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Chuẩn hóa một bản ghi (Record hoặc Customer) về chuẩn duy nhất `old_bhxh` và 100% snake_case
 */
export function normalizeLegacyPayload<T extends Record<string, any>>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const unifiedOldBhxh = extractOldBhxh(payload);
  
  const refund_type = payload.refund_type ?? payload.refundType;
  const decision_number = payload.decision_number ?? payload.decisionNumber;
  const decision_date = payload.decision_date ?? payload.decisionDate;
  const refund_method = payload.refund_method ?? payload.refundMethod;
  const refund_beneficiary_name = payload.refund_beneficiary_name ?? payload.refundBeneficiaryName;
  const refund_beneficiary_account = payload.refund_beneficiary_account ?? payload.refundBeneficiaryAccount;
  const refund_beneficiary_bank = payload.refund_beneficiary_bank ?? payload.refundBeneficiaryBank;
  const hospital_code = payload.hospital_code ?? payload.hospitalCode;
  const hospital_name = payload.hospital_name ?? payload.hospitalName;
  const staff_id = payload.staff_id ?? payload.staffId;
  const customer_id = payload.customer_id ?? payload.customerId;
  const customer_key = payload.customer_key ?? payload.customerKey;
  const is_adjustment = payload.is_adjustment ?? payload.isAdjustment;
  const original_record_id = payload.original_record_id ?? payload.originalRecordId;
  const adjustment_reason = payload.adjustment_reason ?? payload.adjustmentReason;
  const payment_status = payload.payment_status ?? payload.paymentStatus;
  const action_type = payload.action_type ?? payload.actionType;
  const sub_type = payload.sub_type ?? payload.subType;
  const base_premium = payload.base_premium ?? payload.basePremium;
  const from_month = payload.from_month ?? payload.fromMonth;
  const to_month = payload.to_month ?? payload.toMonth;
  const next_payment = payload.next_payment ?? payload.nextPayment;
  const is_submitted_bhxh = payload.is_submitted_bhxh ?? payload.isSubmittedBHXH;
  const submission_batch = payload.submission_batch ?? payload.submissionBatch;

  return {
    ...payload,
    old_bhxh: unifiedOldBhxh,
    refund_type,
    decision_number,
    decision_date,
    refund_method,
    refund_beneficiary_name,
    refund_beneficiary_account,
    refund_beneficiary_bank,
    hospital_code,
    hospital_name,
    staff_id,
    customer_id,
    customer_key,
    is_adjustment,
    original_record_id,
    adjustment_reason,
    payment_status,
    next_payment,
    action_type,
    sub_type,
    base_premium,
    from_month,
    to_month,
    is_submitted_bhxh,
    submission_batch
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

/**
 * Kiểu loại giao dịch trên Sổ cái tài chính (Financial Ledger)
 */
export type LedgerTransactionType = 'THU_TIEN' | 'HOAN_TIEN' | 'DIEU_CHINH' | 'CHI_HOA_HONG';

/**
 * Định nghĩa cấu trúc bút toán Sổ cái tài chính (Single Source of Truth)
 */
export interface FinancialLedgerEntry {
  id: string;
  record_id?: number | null | undefined;
  customer_id?: string | null | undefined;
  transaction_type: LedgerTransactionType;
  debit_amount: number;
  credit_amount: number;
  balance: number;
  currency: string;
  reference_id?: string | null | undefined;
  idempotency_key?: string | null | undefined;
  posted_by?: string | null | undefined;
  posted_at: string;
  notes?: string | null | undefined;
  created_at?: string | undefined;
}

