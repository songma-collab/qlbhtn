-- ======================================================================
-- MIGRATION: 20260921_tighten_rls_and_csp.sql
-- MỤC TIÊU:
-- 1. Thắt chặt RLS bảng records: Loại bỏ hoàn toàn lỗ hổng payload rỗng (staff_id IS NULL)
-- 2. Tự động gán staff_id = public.current_staff_id() tại BEFORE INSERT/UPDATE Trigger nếu rỗng
-- 3. Cập nhật Policy records_insert_authenticated & records_update_authenticated
-- ======================================================================

BEGIN;

-- 1. CẬP NHẬT HÀM TRIGGER ĐỒNG BỘ ALIAS VÀ TỰ ĐỘNG GÁN STAFF_ID
CREATE OR REPLACE FUNCTION public.sync_record_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. staff_id <-> "staffId": Tự động gán định danh cán bộ phụ trách từ session nếu cả hai đều rỗng
  IF (NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '') AND (NEW."staffId" IS NULL OR TRIM(NEW."staffId") = '') THEN
    NEW.staff_id := public.current_staff_id();
    NEW."staffId" := NEW.staff_id;
  ELSIF NEW.staff_id IS NOT NULL AND (NEW."staffId" IS NULL OR TRIM(NEW."staffId") = '') THEN
    NEW."staffId" := NEW.staff_id;
  ELSIF NEW."staffId" IS NOT NULL AND (NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '') THEN
    NEW.staff_id := NEW."staffId";
  ELSE
    -- Khi cả hai cùng có giá trị, ưu tiên giữ giá trị hợp lệ không rỗng
    NEW."staffId" := COALESCE(NULLIF(TRIM(NEW."staffId"), ''), NULLIF(TRIM(NEW.staff_id), ''));
    NEW.staff_id := COALESCE(NULLIF(TRIM(NEW.staff_id), ''), NULLIF(TRIM(NEW."staffId"), ''));
  END IF;

  -- 2. Đồng bộ các cặp trường Alias còn lại (snake_case <-> camelCase)
  -- paymentStatus <-> payment_status
  NEW."paymentStatus" := COALESCE(NEW."paymentStatus", NEW.payment_status);
  NEW.payment_status := COALESCE(NEW.payment_status, NEW."paymentStatus");

  -- actionType <-> action_type
  NEW."actionType" := COALESCE(NEW."actionType", NEW.action_type);
  NEW.action_type := COALESCE(NEW.action_type, NEW."actionType");

  -- subType <-> sub_type
  NEW."subType" := COALESCE(NEW."subType", NEW.sub_type);
  NEW.sub_type := COALESCE(NEW.sub_type, NEW."subType");

  -- supportPct <-> support_pct
  NEW."supportPct" := COALESCE(NEW."supportPct", NEW.support_pct);
  NEW.support_pct := COALESCE(NEW.support_pct, NEW."supportPct");

  -- householdId <-> household_id
  NEW."householdId" := COALESCE(NEW."householdId", NEW.household_id);
  NEW.household_id := COALESCE(NEW.household_id, NEW."householdId");

  -- effectiveDate <-> effective_date
  NEW."effectiveDate" := COALESCE(NEW."effectiveDate", NEW.effective_date);
  NEW.effective_date := COALESCE(NEW.effective_date, NEW."effectiveDate");

  -- targetDate <-> target_date
  NEW."targetDate" := COALESCE(NEW."targetDate", NEW.target_date);
  NEW.target_date := COALESCE(NEW.target_date, NEW."targetDate");

  -- nnSupportPct <-> nn_support_pct
  NEW."nnSupportPct" := COALESCE(NEW."nnSupportPct", NEW.nn_support_pct);
  NEW.nn_support_pct := COALESCE(NEW.nn_support_pct, NEW."nnSupportPct");

  -- dpSupportPct <-> dp_support_pct
  NEW."dpSupportPct" := COALESCE(NEW."dpSupportPct", NEW.dp_support_pct);
  NEW.dp_support_pct := COALESCE(NEW.dp_support_pct, NEW."dpSupportPct");

  -- fromMonth <-> from_month
  NEW."fromMonth" := COALESCE(NEW."fromMonth", NEW.from_month);
  NEW.from_month := COALESCE(NEW.from_month, NEW."fromMonth");

  -- toMonth <-> to_month
  NEW."toMonth" := COALESCE(NEW."toMonth", NEW.to_month);
  NEW.to_month := COALESCE(NEW.to_month, NEW."toMonth");

  -- basePremium <-> base_premium
  NEW."basePremium" := COALESCE(NEW."basePremium", NEW.base_premium);
  NEW.base_premium := COALESCE(NEW.base_premium, NEW."basePremium");

  -- nnSupportAmount <-> nn_support_amount
  NEW."nnSupportAmount" := COALESCE(NEW."nnSupportAmount", NEW.nn_support_amount);
  NEW.nn_support_amount := COALESCE(NEW.nn_support_amount, NEW."nnSupportAmount");

  -- dpSupportAmount <-> dp_support_amount
  NEW."dpSupportAmount" := COALESCE(NEW."dpSupportAmount", NEW.dp_support_amount);
  NEW.dp_support_amount := COALESCE(NEW.dp_support_amount, NEW."dpSupportAmount");

  -- discountAmount <-> discount_amount
  NEW."discountAmount" := COALESCE(NEW."discountAmount", NEW.discount_amount);
  NEW.discount_amount := COALESCE(NEW.discount_amount, NEW."discountAmount");

  -- penaltyAmount <-> penalty_amount
  NEW."penaltyAmount" := COALESCE(NEW."penaltyAmount", NEW.penalty_amount);
  NEW.penalty_amount := COALESCE(NEW.penalty_amount, NEW."penaltyAmount");

  -- nextPayment <-> next_payment
  NEW."nextPayment" := COALESCE(NEW."nextPayment", NEW.next_payment);
  NEW.next_payment := COALESCE(NEW.next_payment, NEW."nextPayment");

  -- recvName <-> recv_name
  NEW."recvName" := COALESCE(NEW."recvName", NEW.recv_name);
  NEW.recv_name := COALESCE(NEW.recv_name, NEW."recvName");

  -- recvPhone <-> recv_phone
  NEW."recvPhone" := COALESCE(NEW."recvPhone", NEW.recv_phone);
  NEW.recv_phone := COALESCE(NEW.recv_phone, NEW."recvPhone");

  -- recvAddress <-> recv_address
  NEW."recvAddress" := COALESCE(NEW."recvAddress", NEW.recv_address);
  NEW.recv_address := COALESCE(NEW.recv_address, NEW."recvAddress");

  -- isSubmittedBHXH <-> is_submitted_bhxh
  NEW."isSubmittedBHXH" := COALESCE(NEW."isSubmittedBHXH", NEW.is_submitted_bhxh, false);
  NEW.is_submitted_bhxh := COALESCE(NEW.is_submitted_bhxh, NEW."isSubmittedBHXH", false);

  -- submissionBatch <-> submission_batch
  NEW."submissionBatch" := COALESCE(NEW."submissionBatch", NEW.submission_batch);
  NEW.submission_batch := COALESCE(NEW.submission_batch, NEW."submissionBatch");

  -- submittedDate <-> submitted_date
  NEW."submittedDate" := COALESCE(NEW."submittedDate", NEW.submitted_date);
  NEW.submitted_date := COALESCE(NEW.submitted_date, NEW."submittedDate");

  -- baseSalarySnapshot <-> base_salary_snapshot
  NEW."baseSalarySnapshot" := COALESCE(NEW."baseSalarySnapshot", NEW.base_salary_snapshot);
  NEW.base_salary_snapshot := COALESCE(NEW.base_salary_snapshot, NEW."baseSalarySnapshot");

  -- povertyStandardSnapshot <-> poverty_standard_snapshot
  NEW."povertyStandardSnapshot" := COALESCE(NEW."povertyStandardSnapshot", NEW.poverty_standard_snapshot);
  NEW.poverty_standard_snapshot := COALESCE(NEW.poverty_standard_snapshot, NEW."povertyStandardSnapshot");

  -- policyVersionId <-> policy_version_id
  NEW."policyVersionId" := COALESCE(NEW."policyVersionId", NEW.policy_version_id);
  NEW.policy_version_id := COALESCE(NEW.policy_version_id, NEW."policyVersionId");

  -- appliedRates <-> applied_rates
  NEW."appliedRates" := COALESCE(NEW."appliedRates", NEW.applied_rates);
  NEW.applied_rates := COALESCE(NEW.applied_rates, NEW."appliedRates");

  -- isAdjustment <-> is_adjustment
  NEW."isAdjustment" := COALESCE(NEW."isAdjustment", NEW.is_adjustment, false);
  NEW.is_adjustment := COALESCE(NEW.is_adjustment, NEW."isAdjustment", false);

  -- originalRecordId <-> original_record_id
  NEW."originalRecordId" := COALESCE(NEW."originalRecordId", NEW.original_record_id);
  NEW.original_record_id := COALESCE(NEW.original_record_id, NEW."originalRecordId");

  -- adjustmentReason <-> adjustment_reason
  NEW."adjustmentReason" := COALESCE(NEW."adjustmentReason", NEW.adjustment_reason);
  NEW.adjustment_reason := COALESCE(NEW.adjustment_reason, NEW."adjustmentReason");

  -- customerId <-> customer_id
  NEW."customerId" := COALESCE(NEW."customerId", NEW.customer_id);
  NEW.customer_id := COALESCE(NEW.customer_id, NEW."customerId");

  -- customerKey <-> customer_key
  NEW."customerKey" := COALESCE(NEW."customerKey", NEW.customer_key);
  NEW.customer_key := COALESCE(NEW.customer_key, NEW."customerKey");

  -- idempotencyKey <-> idempotency_key
  NEW."idempotencyKey" := COALESCE(NEW."idempotencyKey", NEW.idempotency_key);
  NEW.idempotency_key := COALESCE(NEW.idempotency_key, NEW."idempotencyKey");

  -- refundType <-> refund_type
  NEW."refundType" := COALESCE(NEW."refundType", NEW.refund_type);
  NEW.refund_type := COALESCE(NEW.refund_type, NEW."refundType");

  -- decisionNumber <-> decision_number
  NEW."decisionNumber" := COALESCE(NEW."decisionNumber", NEW.decision_number);
  NEW.decision_number := COALESCE(NEW.decision_number, NEW."decisionNumber");

  -- decisionDate <-> decision_date
  NEW."decisionDate" := COALESCE(NEW."decisionDate", NEW.decision_date);
  NEW.decision_date := COALESCE(NEW.decision_date, NEW."decisionDate");

  -- refundMethod <-> refund_method
  NEW."refundMethod" := COALESCE(NEW."refundMethod", NEW.refund_method);
  NEW.refund_method := COALESCE(NEW.refund_method, NEW."refundMethod");

  -- refundBeneficiaryName <-> refund_beneficiary_name
  NEW."refundBeneficiaryName" := COALESCE(NEW."refundBeneficiaryName", NEW.refund_beneficiary_name);
  NEW.refund_beneficiary_name := COALESCE(NEW.refund_beneficiary_name, NEW."refundBeneficiaryName");

  -- refundBeneficiaryAccount <-> refund_beneficiary_account
  NEW."refundBeneficiaryAccount" := COALESCE(NEW."refundBeneficiaryAccount", NEW.refund_beneficiary_account);
  NEW.refund_beneficiary_account := COALESCE(NEW.refund_beneficiary_account, NEW."refundBeneficiaryAccount");

  -- refundBeneficiaryBank <-> refund_beneficiary_bank
  NEW."refundBeneficiaryBank" := COALESCE(NEW."refundBeneficiaryBank", NEW.refund_beneficiary_bank);
  NEW.refund_beneficiary_bank := COALESCE(NEW.refund_beneficiary_bank, NEW."refundBeneficiaryBank");

  -- hospitalCode <-> hospital_code
  NEW."hospitalCode" := COALESCE(NEW."hospitalCode", NEW.hospital_code);
  NEW.hospital_code := COALESCE(NEW.hospital_code, NEW."hospitalCode");

  -- hospitalName <-> hospital_name
  NEW."hospitalName" := COALESCE(NEW."hospitalName", NEW.hospital_name);
  NEW.hospital_name := COALESCE(NEW.hospital_name, NEW."hospitalName");

  -- oldBhxh <-> old_bhxh
  NEW."oldBhxh" := COALESCE(NEW."oldBhxh", NEW.old_bhxh);
  NEW.old_bhxh := COALESCE(NEW.old_bhxh, NEW."oldBhxh");

  RETURN NEW;
END;
$$;

-- Đảm bảo Trigger gắn trên bảng records
DROP TRIGGER IF EXISTS trg_sync_record_aliases ON public.records;
CREATE TRIGGER trg_sync_record_aliases
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_record_aliases();


-- 2. TÁI THIẾT CHÍNH SÁCH RLS BẢNG RECORDS (THẮT CHẶT AN NINH)
-- Bật RLS trên bảng records nếu chưa bật
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

-- 2.1. Thêm mới hồ sơ: Loại bỏ hoàn toàn điều kiện cho phép staff_id NULL
DROP POLICY IF EXISTS "records_insert_authenticated" ON public.records;
CREATE POLICY "records_insert_authenticated" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin() 
    OR (
      (
        COALESCE(records.staff_id, records."staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid()) 
        OR COALESCE(records.staff_id, records."staffId") = public.current_staff_id()
      )
      AND (amount >= 0 OR amount IS NULL)
      AND (COALESCE(records.is_adjustment, records."isAdjustment") IS NOT TRUE)
    )
  );

-- 2.2. Cập nhật hồ sơ: Admin/Quản trị cập nhật mọi hồ sơ; Nhân viên chỉ cập nhật hồ sơ gắn với mã của mình
DROP POLICY IF EXISTS "records_update_authenticated" ON public.records;
CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR COALESCE(records.staff_id, records."staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR COALESCE(records.staff_id, records."staffId") = public.current_staff_id()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      (
        COALESCE(records.staff_id, records."staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
        OR COALESCE(records.staff_id, records."staffId") = public.current_staff_id()
      )
      AND (amount >= 0 OR amount IS NULL)
      AND (COALESCE(records.is_adjustment, records."isAdjustment") IS NOT TRUE)
    )
  );

COMMIT;

-- Tải lại lược đồ PostgREST trên Supabase
NOTIFY pgrst, 'reload schema';
