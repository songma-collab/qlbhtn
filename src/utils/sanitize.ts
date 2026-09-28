import { RecordType } from '../context/types';

/**
 * HÀM TẠO IDEMPOTENCY KEY AN TOÀN (RFC 4122 v4)
 * Dùng để gắn vào payload gửi lên Supabase ngăn chặn trùng lặp giao dịch khi click đúp hoặc mạng lag
 */
export const generateIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback nếu không chạy trong secure context
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * LÀM SẠCH VÀ CHUẨN HÓA CHUỖI KÝ TỰ (Sanitization)
 * Triệt tiêu khoảng trắng thừa, ký tự điều khiển ẩn
 */
export const sanitizeString = (val?: string | null): string => {
  if (!val) return '';
  return val
    .trim()
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Xóa ký tự điều khiển ASCII
    .replace(/\s+/g, ' '); // Gộp khoảng trắng liên tiếp
};

/**
 * ADAPTER: Chuyển đổi từ Đối tượng Frontend (camelCase) sang Bản ghi CSDL PostgreSQL (100% snake_case)
 * Tương thích với bảng public.records sau khi đã loại bỏ toàn bộ alias cột nháy kép
 */
export const recordToDb = (rec: Partial<RecordType>): Record<string, any> => {
  const r: any = rec || {};
  const db: Record<string, any> = {};

  if (r.id !== undefined) db.id = r.id;
  if (r.date !== undefined) db.date = r.date;
  if (r.name !== undefined) db.name = sanitizeString(r.name);
  if (r.dob !== undefined) db.dob = r.dob || null;
  if (r.gender !== undefined) db.gender = r.gender || null;
  if (r.phone !== undefined) db.phone = sanitizeString(r.phone);
  if (r.cccd !== undefined) db.cccd = sanitizeString(r.cccd);
  if (r.bhxh !== undefined) db.bhxh = sanitizeString(r.bhxh);
  
  // Xử lý old_bhxh / oldBhxh / bhxhCu
  const oldBhxhVal = r.old_bhxh !== undefined ? r.old_bhxh : (r.oldBhxh !== undefined ? r.oldBhxh : r.bhxhCu);
  if (oldBhxhVal !== undefined) db.old_bhxh = sanitizeString(oldBhxhVal) || null;

  if (r.address !== undefined) db.address = sanitizeString(r.address) || null;
  if (r.notes !== undefined) db.notes = r.notes || null;
  if (r.type !== undefined) db.type = r.type;
  
  const subTypeVal = r.sub_type !== undefined ? r.sub_type : r.subType;
  if (subTypeVal !== undefined) db.sub_type = subTypeVal || null;

  if (r.wage !== undefined) db.wage = r.wage != null ? Number(r.wage) : null;
  if (r.income !== undefined) db.income = r.income != null ? Number(r.income) : null;
  if (r.months !== undefined) db.months = Number(r.months) || 1;

  const fromMonthVal = r.from_month !== undefined ? r.from_month : r.fromMonth;
  if (fromMonthVal !== undefined) db.from_month = fromMonthVal || null;

  const toMonthVal = r.to_month !== undefined ? r.to_month : r.toMonth;
  if (toMonthVal !== undefined) db.to_month = toMonthVal || null;

  if (r.amount !== undefined) db.amount = Number(r.amount) || 0;

  const basePremiumVal = r.base_premium !== undefined ? r.base_premium : r.basePremium;
  if (basePremiumVal !== undefined) db.base_premium = basePremiumVal != null ? Number(basePremiumVal) : null;

  const supportPctVal = r.support_pct !== undefined ? r.support_pct : r.supportPct;
  if (supportPctVal !== undefined) db.support_pct = supportPctVal != null ? Number(supportPctVal) : null;

  const nnSupportPctVal = r.nn_support_pct !== undefined ? r.nn_support_pct : r.nnSupportPct;
  if (nnSupportPctVal !== undefined) db.nn_support_pct = nnSupportPctVal != null ? Number(nnSupportPctVal) : null;

  const dpSupportPctVal = r.dp_support_pct !== undefined ? r.dp_support_pct : r.dpSupportPct;
  if (dpSupportPctVal !== undefined) db.dp_support_pct = dpSupportPctVal != null ? Number(dpSupportPctVal) : null;

  const nnSupportAmountVal = r.nn_support_amount !== undefined ? r.nn_support_amount : r.nnSupportAmount;
  if (nnSupportAmountVal !== undefined) db.nn_support_amount = nnSupportAmountVal != null ? Number(nnSupportAmountVal) : null;

  const dpSupportAmountVal = r.dp_support_amount !== undefined ? r.dp_support_amount : r.dpSupportAmount;
  if (dpSupportAmountVal !== undefined) db.dp_support_amount = dpSupportAmountVal != null ? Number(dpSupportAmountVal) : null;

  const discountAmountVal = r.discount_amount !== undefined ? r.discount_amount : r.discountAmount;
  if (discountAmountVal !== undefined) db.discount_amount = discountAmountVal != null ? Number(discountAmountVal) : null;

  const penaltyAmountVal = r.penalty_amount !== undefined ? r.penalty_amount : r.penaltyAmount;
  if (penaltyAmountVal !== undefined) db.penalty_amount = penaltyAmountVal != null ? Number(penaltyAmountVal) : null;

  if (r.commission !== undefined) db.commission = r.commission != null ? Number(r.commission) : null;
  if (r.support !== undefined) db.support = r.support != null ? Number(r.support) : null;
  if (r.method !== undefined) db.method = r.method || null;
  if (r.status !== undefined) db.status = r.status;

  const paymentStatusVal = r.payment_status !== undefined ? r.payment_status : r.paymentStatus;
  if (paymentStatusVal !== undefined) db.payment_status = paymentStatusVal;

  const staffIdVal = r.staff_id !== undefined ? r.staff_id : r.staffId;
  if (staffIdVal !== undefined) db.staff_id = staffIdVal || null;

  const actionTypeVal = r.action_type !== undefined ? r.action_type : r.actionType;
  if (actionTypeVal !== undefined) db.action_type = actionTypeVal || null;

  if (r.members !== undefined) db.members = r.members || null;

  const householdIdVal = r.household_id !== undefined ? r.household_id : r.householdId;
  if (householdIdVal !== undefined) db.household_id = householdIdVal || null;

  const effectiveDateVal = r.effective_date !== undefined ? r.effective_date : r.effectiveDate;
  if (effectiveDateVal !== undefined) db.effective_date = effectiveDateVal || null;

  const targetDateVal = r.target_date !== undefined ? r.target_date : r.targetDate;
  if (targetDateVal !== undefined) db.target_date = targetDateVal || null;

  const nextPaymentVal = r.next_payment !== undefined ? r.next_payment : r.nextPayment;
  if (nextPaymentVal !== undefined) db.next_payment = nextPaymentVal || null;

  if (r.nation !== undefined) db.nation = r.nation || null;
  if (r.email !== undefined) db.email = r.email || null;

  const recvNameVal = r.recv_name !== undefined ? r.recv_name : r.recvName;
  if (recvNameVal !== undefined) db.recv_name = sanitizeString(recvNameVal) || null;

  const recvPhoneVal = r.recv_phone !== undefined ? r.recv_phone : r.recvPhone;
  if (recvPhoneVal !== undefined) db.recv_phone = sanitizeString(recvPhoneVal) || null;

  const recvAddressVal = r.recv_address !== undefined ? r.recv_address : r.recvAddress;
  if (recvAddressVal !== undefined) db.recv_address = sanitizeString(recvAddressVal) || null;

  if (r.ip_address !== undefined) db.ip_address = r.ip_address || null;

  const isSubmittedVal = r.is_submitted_bhxh !== undefined ? r.is_submitted_bhxh : r.isSubmittedBHXH;
  if (isSubmittedVal !== undefined) db.is_submitted_bhxh = Boolean(isSubmittedVal);

  const submissionBatchVal = r.submission_batch !== undefined ? r.submission_batch : r.submissionBatch;
  if (submissionBatchVal !== undefined) db.submission_batch = submissionBatchVal || null;

  const submittedDateVal = r.submitted_date !== undefined ? r.submitted_date : r.submittedDate;
  if (submittedDateVal !== undefined) db.submitted_date = submittedDateVal || null;

  const baseSalarySnapshotVal = r.base_salary_snapshot !== undefined ? r.base_salary_snapshot : r.baseSalarySnapshot;
  if (baseSalarySnapshotVal !== undefined) db.base_salary_snapshot = baseSalarySnapshotVal != null ? Number(baseSalarySnapshotVal) : null;

  const povertySnapshotVal = r.poverty_standard_snapshot !== undefined ? r.poverty_standard_snapshot : r.povertyStandardSnapshot;
  if (povertySnapshotVal !== undefined) db.poverty_standard_snapshot = povertySnapshotVal != null ? Number(povertySnapshotVal) : null;

  const policyVersionVal = r.policy_version_id !== undefined ? r.policy_version_id : r.policyVersionId;
  if (policyVersionVal !== undefined) db.policy_version_id = policyVersionVal || null;

  const appliedRatesVal = r.applied_rates !== undefined ? r.applied_rates : r.appliedRates;
  if (appliedRatesVal !== undefined) db.applied_rates = appliedRatesVal || null;

  // Thoái thu / Bút toán điều chỉnh âm
  const isAdjustmentVal = r.is_adjustment !== undefined ? r.is_adjustment : r.isAdjustment;
  if (isAdjustmentVal !== undefined) db.is_adjustment = Boolean(isAdjustmentVal);

  const originalRecordIdVal = r.original_record_id !== undefined ? r.original_record_id : r.originalRecordId;
  if (originalRecordIdVal !== undefined) db.original_record_id = originalRecordIdVal || null;

  const adjustmentReasonVal = r.adjustment_reason !== undefined ? r.adjustment_reason : r.adjustmentReason;
  if (adjustmentReasonVal !== undefined) db.adjustment_reason = adjustmentReasonVal || null;

  const refundTypeVal = r.refund_type !== undefined ? r.refund_type : r.refundType;
  if (refundTypeVal !== undefined) db.refund_type = refundTypeVal || null;

  const decisionNumberVal = r.decision_number !== undefined ? r.decision_number : r.decisionNumber;
  if (decisionNumberVal !== undefined) db.decision_number = decisionNumberVal || null;

  const decisionDateVal = r.decision_date !== undefined ? r.decision_date : r.decisionDate;
  if (decisionDateVal !== undefined) db.decision_date = decisionDateVal || null;

  const refundMethodVal = r.refund_method !== undefined ? r.refund_method : r.refundMethod;
  if (refundMethodVal !== undefined) db.refund_method = refundMethodVal || null;

  const refundBeneficiaryNameVal = r.refund_beneficiary_name !== undefined ? r.refund_beneficiary_name : r.refundBeneficiaryName;
  if (refundBeneficiaryNameVal !== undefined) db.refund_beneficiary_name = refundBeneficiaryNameVal || null;

  const refundBeneficiaryAccountVal = r.refund_beneficiary_account !== undefined ? r.refund_beneficiary_account : r.refundBeneficiaryAccount;
  if (refundBeneficiaryAccountVal !== undefined) db.refund_beneficiary_account = refundBeneficiaryAccountVal || null;

  const refundBeneficiaryBankVal = r.refund_beneficiary_bank !== undefined ? r.refund_beneficiary_bank : r.refundBeneficiaryBank;
  if (refundBeneficiaryBankVal !== undefined) db.refund_beneficiary_bank = refundBeneficiaryBankVal || null;

  const hospitalCodeVal = r.hospital_code !== undefined ? r.hospital_code : r.hospitalCode;
  if (hospitalCodeVal !== undefined) db.hospital_code = hospitalCodeVal || null;

  const hospitalNameVal = r.hospital_name !== undefined ? r.hospital_name : r.hospitalName;
  if (hospitalNameVal !== undefined) db.hospital_name = hospitalNameVal || null;

  const customerIdVal = r.customer_id !== undefined ? r.customer_id : r.customerId;
  if (customerIdVal !== undefined) db.customer_id = customerIdVal || null;

  const customerKeyVal = r.customer_key !== undefined ? r.customer_key : r.customerKey;
  if (customerKeyVal !== undefined) db.customer_key = customerKeyVal || null;

  // Idempotency Key
  const idempotencyKeyVal = r.idempotency_key !== undefined ? r.idempotency_key : r.idempotencyKey;
  if (idempotencyKeyVal !== undefined) db.idempotency_key = idempotencyKeyVal || null;

  return db;
};

/**
 * ADAPTER: Chuyển đổi từ Bản ghi Database PostgreSQL sang Đối tượng RecordType trong ứng dụng
 * Đảm bảo giao diện và mọi hook tiếp tục hoạt động mượt mà với cả camelCase và snake_case
 */
export const dbToRecord = (raw: Record<string, any>): RecordType => {
  if (!raw) return {} as RecordType;
  const d = raw;

  const oldBhxh = d.old_bhxh || d.oldBhxh || d.bhxhCu || (d.bhxh && d.bhxh.length === 10 ? d.bhxh : undefined);

  const record: RecordType = {
    id: d.id,
    date: d.date || new Date().toISOString(),
    name: d.name || '',
    cccd: d.cccd || '',
    phone: d.phone || '',
    address: d.address || '',
    bhxh: d.bhxh || '',
    old_bhxh: oldBhxh,
    oldBhxh: oldBhxh,
    bhxhCu: oldBhxh,
    dob: d.dob || '',
    gender: d.gender || '',
    nation: d.nation || '',
    email: d.email || '',
    type: d.type || 'BHXH',
    subType: d.sub_type !== undefined ? d.sub_type : d.subType,
    wage: d.wage != null ? Number(d.wage) : undefined,
    income: d.income != null ? Number(d.income) : undefined,
    months: d.months != null ? Number(d.months) : 1,
    fromMonth: d.from_month !== undefined ? d.from_month : d.fromMonth,
    toMonth: d.to_month !== undefined ? d.to_month : d.toMonth,
    amount: d.amount != null ? Number(d.amount) : 0,
    basePremium: d.base_premium != null ? Number(d.base_premium) : (d.basePremium != null ? Number(d.basePremium) : undefined),
    supportPct: d.support_pct != null ? Number(d.support_pct) : (d.supportPct != null ? Number(d.supportPct) : undefined),
    nnSupportPct: d.nn_support_pct != null ? Number(d.nn_support_pct) : (d.nnSupportPct != null ? Number(d.nnSupportPct) : undefined),
    dpSupportPct: d.dp_support_pct != null ? Number(d.dp_support_pct) : (d.dpSupportPct != null ? Number(d.dpSupportPct) : undefined),
    nnSupportAmount: d.nn_support_amount != null ? Number(d.nn_support_amount) : (d.nnSupportAmount != null ? Number(d.nnSupportAmount) : undefined),
    dpSupportAmount: d.dp_support_amount != null ? Number(d.dp_support_amount) : (d.dpSupportAmount != null ? Number(d.dpSupportAmount) : undefined),
    discountAmount: d.discount_amount != null ? Number(d.discount_amount) : (d.discountAmount != null ? Number(d.discountAmount) : undefined),
    penaltyAmount: d.penalty_amount != null ? Number(d.penalty_amount) : (d.penaltyAmount != null ? Number(d.penaltyAmount) : undefined),
    commission: d.commission != null ? Number(d.commission) : undefined,
    support: d.support != null ? Number(d.support) : undefined,
    method: d.method || '',
    status: d.status || 'Đang tham gia',
    paymentStatus: d.payment_status || d.paymentStatus || 'Chờ thu tiền',
    staffId: d.staff_id || d.staffId,
    staff_id: d.staff_id || d.staffId,
    actionType: d.action_type || d.actionType,
    notes: d.notes || '',
    members: Array.isArray(d.members) ? d.members : [],
    householdId: d.household_id || d.householdId,
    effectiveDate: d.effective_date || d.effectiveDate,
    targetDate: d.target_date || d.targetDate,
    nextPayment: d.next_payment || d.nextPayment,
    recvName: d.recv_name || d.recvName,
    recvPhone: d.recv_phone || d.recvPhone,
    recvAddress: d.recv_address || d.recvAddress,
    isSubmittedBHXH: d.is_submitted_bhxh !== undefined ? d.is_submitted_bhxh : Boolean(d.isSubmittedBHXH),
    submissionBatch: d.submission_batch || d.submissionBatch,
    submittedDate: d.submitted_date || d.submittedDate,
    baseSalarySnapshot: d.base_salary_snapshot != null ? Number(d.base_salary_snapshot) : (d.baseSalarySnapshot != null ? Number(d.baseSalarySnapshot) : undefined),
    povertyStandardSnapshot: d.poverty_standard_snapshot != null ? Number(d.poverty_standard_snapshot) : (d.povertyStandardSnapshot != null ? Number(d.povertyStandardSnapshot) : undefined),
    policyVersionId: d.policy_version_id || d.policyVersionId,
    appliedRates: d.applied_rates || d.appliedRates,
    isAdjustment: d.is_adjustment !== undefined ? d.is_adjustment : Boolean(d.isAdjustment),
    originalRecordId: d.original_record_id != null ? Number(d.original_record_id) : (d.originalRecordId != null ? Number(d.originalRecordId) : undefined),
    adjustmentReason: d.adjustment_reason || d.adjustmentReason,
    refundType: d.refund_type || d.refundType,
    decisionNumber: d.decision_number || d.decisionNumber,
    decisionDate: d.decision_date || d.decisionDate,
    refundMethod: d.refund_method || d.refundMethod,
    refundBeneficiaryName: d.refund_beneficiary_name || d.refundBeneficiaryName,
    refundBeneficiaryAccount: d.refund_beneficiary_account || d.refundBeneficiaryAccount,
    refundBeneficiaryBank: d.refund_beneficiary_bank || d.refundBeneficiaryBank,
    hospitalCode: d.hospital_code || d.hospitalCode,
    hospitalName: d.hospital_name || d.hospitalName,
    customerId: d.customer_id || d.customerId,
    customer_id: d.customer_id || d.customerId,
    customerKey: d.customer_key || d.customerKey,
    customer_key: d.customer_key || d.customerKey,
    idempotencyKey: d.idempotency_key || d.idempotencyKey,
    idempotency_key: d.idempotency_key || d.idempotencyKey,
    created_at: d.created_at,
    updated_at: d.updated_at
  };

  return record;
};

/**
 * XỬ LÝ HÀNG LOẠT (Array Mapper)
 */
export const mapDbRecords = (rows: any[]): RecordType[] => {
  if (!Array.isArray(rows)) return [];
  return rows.map(dbToRecord);
};
