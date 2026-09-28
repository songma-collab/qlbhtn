-- ======================================================================
-- MIGRATION: 20260921_core_security_and_data_integrity.sql
-- Triệt tiêu 7 lỗ hổng bảo mật cốt lõi, đồng bộ hóa 100% CSDL PostgreSQL,
-- Luật BHXH số 41/2024/QH15 & Nghị định 159/2025/NĐ-CP, Nghị định 13/2023/NĐ-CP
-- ======================================================================

-- ----------------------------------------------------------------------
-- 1. BẢO VỆ KHÓA KỲ TÀI CHÍNH 2 LỚP (FINANCIAL LOCK GUARD - ERRCODE 23514)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_record_financial_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_locked_keys JSONB;
    v_target_date TIMESTAMP WITH TIME ZONE;
    v_record_month TEXT;
    v_record_year TEXT;
    v_record_quarter INT;
    v_month_key_slash TEXT;
    v_month_key_underscore TEXT;
    v_quarter_key TEXT;
    v_year_key TEXT;
    v_is_locked BOOLEAN := false;
    v_override TEXT;
BEGIN
    v_override := current_setting('app.is_admin_override', true);
    IF v_override = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT value INTO v_locked_keys
    FROM public.policies
    WHERE parameter_type = 'locked_periods' AND is_active = true
    LIMIT 1;

    IF v_locked_keys IS NULL OR jsonb_typeof(v_locked_keys) != 'array' OR jsonb_array_length(v_locked_keys) = 0 THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_target_date := COALESCE(OLD.date, NEW.date, NOW());
    v_record_month := TO_CHAR(v_target_date, 'MM');
    v_record_year := TO_CHAR(v_target_date, 'YYYY');
    v_record_quarter := EXTRACT(QUARTER FROM v_target_date)::INT;

    v_month_key_slash := v_record_month || '/' || v_record_year;
    v_month_key_underscore := v_record_year || '_' || v_record_month;
    v_quarter_key := 'Q' || v_record_quarter || '/' || v_record_year;
    v_year_key := v_record_year;

    IF v_locked_keys ? v_month_key_slash OR
       v_locked_keys ? v_month_key_underscore OR
       v_locked_keys ? ('month_' || v_month_key_slash) OR
       v_locked_keys ? ('month_' || v_month_key_underscore) OR
       v_locked_keys ? v_quarter_key OR
       v_locked_keys ? ('quarter_' || v_record_quarter || '_' || v_record_year) OR
       v_locked_keys ? v_year_key OR
       v_locked_keys ? ('year_' || v_record_year) THEN
        v_is_locked := true;
    END IF;

    IF v_is_locked THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Nghiêm cấm xóa giao dịch.', v_month_key_slash
                USING ERRCODE = '23514';
        ELSIF TG_OP = 'UPDATE' THEN
            IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
               (OLD.wage IS DISTINCT FROM NEW.wage) OR
               (OLD.income IS DISTINCT FROM NEW.income) OR
               (COALESCE(OLD.from_month, OLD."fromMonth") IS DISTINCT FROM COALESCE(NEW.from_month, NEW."fromMonth")) OR
               (COALESCE(OLD.to_month, OLD."toMonth") IS DISTINCT FROM COALESCE(NEW.to_month, NEW."toMonth")) OR
               (OLD.date IS DISTINCT FROM NEW.date) OR
               (OLD.months IS DISTINCT FROM NEW.months) OR
               (COALESCE(OLD.base_premium, OLD."basePremium") IS DISTINCT FROM COALESCE(NEW.base_premium, NEW."basePremium")) OR
               (COALESCE(OLD.nn_support_amount, OLD."nnSupportAmount") IS DISTINCT FROM COALESCE(NEW.nn_support_amount, NEW."nnSupportAmount")) OR
               (COALESCE(OLD.dp_support_amount, OLD."dpSupportAmount") IS DISTINCT FROM COALESCE(NEW.dp_support_amount, NEW."dpSupportAmount")) OR
               (COALESCE(OLD.payment_status, OLD."paymentStatus") IS DISTINCT FROM COALESCE(NEW.payment_status, NEW."paymentStatus") AND COALESCE(NEW.payment_status, NEW."paymentStatus") = 'Đã hủy') OR
               (COALESCE(OLD.is_submitted_bhxh, OLD."isSubmittedBHXH") IS DISTINCT FROM COALESCE(NEW.is_submitted_bhxh, NEW."isSubmittedBHXH")) THEN
                RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Nghiêm cấm chỉnh sửa số tiền, kỳ đóng hoặc hủy giao dịch.', v_month_key_slash
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;
CREATE TRIGGER trigger_enforce_financial_period_lock
BEFORE UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.check_record_financial_lock();


-- ----------------------------------------------------------------------
-- 2. NHIỆM VỤ 2: TRIỆT TIÊU LỖ HỔNG ADMIN BACKDOOR TRONG GET_CURRENT_STAFF_PROFILE
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_staff_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_email_confirmed BOOLEAN := false;
  v_staff RECORD;
  v_staff_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'UNAUTHENTICATED');
  END IF;

  -- 1. Tìm theo auth_user_id trước tiên (đã liên kết xác thực)
  SELECT id, name, cccd, phone, email, area, role, status, username, "staffCode", auth_user_id
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = v_uid
  LIMIT 1;

  -- 2. Nếu chưa liên kết auth_user_id, chỉ cho phép kiểm tra email khi email đã được xác thực trong auth.users
  IF v_staff IS NULL AND v_email != '' THEN
    SELECT (email_confirmed_at IS NOT NULL) INTO v_email_confirmed
    FROM auth.users
    WHERE id = v_uid;

    IF NOT COALESCE(v_email_confirmed, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'EMAIL_NOT_CONFIRMED: Vui lòng xác thực email trước khi truy cập hệ thống.'
      );
    END IF;

    -- Tìm hồ sơ nhân sự đã được Admin chủ động tạo trước trong danh mục nhân sự
    SELECT id, name, cccd, phone, email, area, role, status, username, "staffCode", auth_user_id
    INTO v_staff
    FROM public.staff
    WHERE LOWER(TRIM(email)) = v_email
    LIMIT 1;

    IF v_staff IS NOT NULL THEN
      UPDATE public.staff 
      SET auth_user_id = v_uid 
      WHERE id = v_staff.id;
    END IF;
  END IF;

  -- 3. Xử lý khởi tạo Quản trị viên gốc đầu tiên (CHỈ KHI cơ sở dữ liệu có đúng 0 nhân sự VÀ email đã xác thực)
  IF v_staff IS NULL AND v_email != '' THEN
    SELECT COUNT(*) INTO v_staff_count FROM public.staff;
    
    IF v_staff_count = 0 THEN
      -- Khởi tạo Quản trị viên gốc duy nhất
      INSERT INTO public.staff (id, name, email, role, status, area, "staffCode", auth_user_id)
      VALUES (
        'admin-root-' || v_uid::text,
        COALESCE(auth.jwt() ->> 'name', SPLIT_PART(v_email, '@', 1), 'Quản Trị Viên Gốc'),
        v_email,
        'Admin',
        'Đang hoạt động',
        'Sông Mã',
        'ADMIN01',
        v_uid
      )
      RETURNING id, name, cccd, phone, email, area, role, status, username, "staffCode", auth_user_id
      INTO v_staff;
    ELSE
      -- Tuyệt đối không tự động nâng cấp quyền hoặc hardcode backdoor email
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'UNAUTHORIZED_NOT_STAFF: Tài khoản chưa được phân quyền trong danh mục Nhân sự. Vui lòng liên hệ Quản trị viên.'
      );
    END IF;
  END IF;

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'UNAUTHORIZED_NOT_STAFF');
  END IF;

  IF v_staff.status = 'Tạm khóa' THEN
    RETURN jsonb_build_object('success', false, 'message', 'ACCOUNT_LOCKED: Tài khoản của bạn đã bị tạm khóa.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', jsonb_build_object(
      'id', v_staff.id,
      'name', v_staff.name,
      'cccd', v_staff.cccd,
      'phone', v_staff.phone,
      'email', v_staff.email,
      'area', v_staff.area,
      'role', v_staff.role,
      'status', v_staff.status,
      'username', v_staff.username,
      'staffCode', v_staff."staffCode",
      'auth_user_id', v_staff.auth_user_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_staff_profile() TO authenticated, anon, service_role;


-- ----------------------------------------------------------------------
-- 3. NHIỆM VỤ 3: ĐỒNG BỘ HÓA SCHEMA, IDEMPOTENCY VÀ TRIGGER ALIASES
-- ----------------------------------------------------------------------
-- Bổ sung đầy đủ tất cả các cột snake_case vào public.records
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Chờ thu tiền';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS action_type TEXT DEFAULT 'Đăng ký mới';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS sub_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS support_pct NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS household_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_pct NUMERIC DEFAULT 20;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS dp_support_pct NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS from_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS to_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS base_premium NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_amount NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS dp_support_amount NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS next_payment DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_name TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_phone TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_address TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS is_submitted_bhxh BOOLEAN DEFAULT false;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS submission_batch TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS submitted_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS base_salary_snapshot NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS poverty_standard_snapshot NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS policy_version_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS applied_rates JSONB;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT false;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS original_record_id BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_id BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_key TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS refund_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS decision_number TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS decision_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS refund_method TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS refund_beneficiary_name TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS refund_beneficiary_account TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS refund_beneficiary_bank TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS hospital_code TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS hospital_name TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS old_bhxh TEXT;

-- Bổ sung các cột camelCase tương ứng để đảm bảo tương thích ngược 100%
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'Chờ thu tiền';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "actionType" TEXT DEFAULT 'Đăng ký mới';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "supportPct" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "householdId" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "effectiveDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "targetDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "nnSupportPct" NUMERIC DEFAULT 20;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "dpSupportPct" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "fromMonth" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "toMonth" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "basePremium" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "nnSupportAmount" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "dpSupportAmount" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "penaltyAmount" NUMERIC DEFAULT 0;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "nextPayment" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvPhone" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvAddress" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "isSubmittedBHXH" BOOLEAN DEFAULT false;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submissionBatch" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submittedDate" TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "baseSalarySnapshot" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "povertyStandardSnapshot" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "policyVersionId" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "appliedRates" JSONB;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "isAdjustment" BOOLEAN DEFAULT false;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "originalRecordId" BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "adjustmentReason" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "customerId" BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "customerKey" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundType" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionNumber" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundMethod" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryAccount" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryBank" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospitalCode" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospitalName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "oldBhxh" TEXT;

-- Tạo chỉ mục duy nhất cho idempotency_key chống trùng lặp dữ liệu nộp
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_idempotency ON public.records (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_customer_key ON public.records (customer_key) WHERE customer_key IS NOT NULL;

-- Trigger ánh xạ 2 chiều giữa snake_case và camelCase
CREATE OR REPLACE FUNCTION public.sync_record_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- staffId <-> staff_id
  NEW."staffId" := COALESCE(NEW."staffId", NEW.staff_id);
  NEW.staff_id := COALESCE(NEW.staff_id, NEW."staffId");

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

DROP TRIGGER IF EXISTS trg_sync_record_aliases ON public.records;
CREATE TRIGGER trg_sync_record_aliases
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_record_aliases();


-- ----------------------------------------------------------------------
-- 4. NHIỆM VỤ 4: VÁ LỖ HỔNG RLS TRÊN BẢNG RECORDS
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "records_insert_authenticated" ON public.records;
CREATE POLICY "records_insert_authenticated" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_manager_or_admin()
      OR (
        COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
        OR COALESCE(staff_id, "staffId") = public.current_staff_id()
      )
    )
    AND (
      public.is_manager_or_admin()
      OR (
        COALESCE(amount, 0) >= 0
        AND COALESCE(is_adjustment, "isAdjustment", false) = false
      )
    )
  );

DROP POLICY IF EXISTS "records_update_authenticated" ON public.records;
CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR COALESCE(staff_id, "staffId") = public.current_staff_id()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      (
        COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
        OR COALESCE(staff_id, "staffId") = public.current_staff_id()
      )
      AND (
        COALESCE(amount, 0) >= 0
        AND COALESCE(is_adjustment, "isAdjustment", false) = false
      )
    )
  );

DROP POLICY IF EXISTS "records_delete_authenticated" ON public.records;
CREATE POLICY "records_delete_authenticated" ON public.records
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      (
        COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
        OR COALESCE(staff_id, "staffId") = public.current_staff_id()
      )
      AND COALESCE(payment_status, "paymentStatus") != 'Đã thu tiền'
    )
  );


-- ----------------------------------------------------------------------
-- 5. NHIỆM VỤ 5: PII MASKING CẤP DATABASE CHO VIEW CRM_CUSTOMERS (NĐ 13/2023/NĐ-CP)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mask_cccd_pii(val TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF val IS NULL OR length(trim(val)) < 6 THEN
    RETURN val;
  END IF;
  RETURN substring(trim(val) from 1 for 3) || '******' || right(trim(val), 3);
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_phone_pii(val TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF val IS NULL OR length(trim(val)) < 7 THEN
    RETURN val;
  END IF;
  RETURN substring(trim(val) from 1 for 3) || '****' || substring(trim(val) from 8);
END;
$$;

CREATE OR REPLACE FUNCTION public.mask_bhxh_pii(val TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF val IS NULL OR length(trim(val)) < 7 THEN
    RETURN val;
  END IF;
  RETURN substring(trim(val) from 1 for 3) || '****' || right(trim(val), 3);
END;
$$;

DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers 
WITH (security_invoker = true) AS
SELECT 
    r.id,
    r.date,
    c.name,
    CASE 
      WHEN public.is_manager_or_admin() THEN c.cccd 
      ELSE public.mask_cccd_pii(c.cccd) 
    END AS cccd,
    CASE 
      WHEN public.is_manager_or_admin() THEN c.phone 
      ELSE public.mask_phone_pii(c.phone) 
    END AS phone,
    c.address,
    CASE 
      WHEN public.is_manager_or_admin() THEN c.bhxh 
      ELSE public.mask_bhxh_pii(c.bhxh) 
    END AS bhxh,
    CASE 
      WHEN public.is_manager_or_admin() THEN c.old_bhxh 
      ELSE public.mask_bhxh_pii(c.old_bhxh) 
    END AS "oldBhxh",
    CASE 
      WHEN public.is_manager_or_admin() THEN c.old_bhxh 
      ELSE public.mask_bhxh_pii(c.old_bhxh) 
    END AS old_bhxh,
    r.type,
    COALESCE(r.sub_type, r."subType") AS "subType",
    COALESCE(r.sub_type, r."subType") AS sub_type,
    r.wage,
    r.months,
    COALESCE(r.support_pct, r."supportPct") AS "supportPct",
    COALESCE(r.support_pct, r."supportPct") AS support_pct,
    r.amount,
    c.status AS status,
    COALESCE(r.payment_status, r."paymentStatus") AS "paymentStatus",
    COALESCE(r.payment_status, r."paymentStatus") AS payment_status,
    r.notes,
    COALESCE(r.staff_id, r."staffId") AS "staffId",
    COALESCE(r.staff_id, r."staffId") AS staff_id,
    COALESCE(r.from_month, r."fromMonth") AS "fromMonth",
    COALESCE(r.from_month, r."fromMonth") AS from_month,
    COALESCE(r.to_month, r."toMonth") AS "toMonth",
    COALESCE(r.to_month, r."toMonth") AS to_month,
    COALESCE(r.base_premium, r."basePremium") AS "basePremium",
    COALESCE(r.base_premium, r."basePremium") AS base_premium,
    COALESCE(r.nn_support_pct, r."nnSupportPct") AS "nnSupportPct",
    COALESCE(r.nn_support_pct, r."nnSupportPct") AS nn_support_pct,
    COALESCE(r.nn_support_amount, r."nnSupportAmount") AS "nnSupportAmount",
    COALESCE(r.nn_support_amount, r."nnSupportAmount") AS nn_support_amount,
    COALESCE(r.dp_support_pct, r."dpSupportPct") AS "dpSupportPct",
    COALESCE(r.dp_support_pct, r."dpSupportPct") AS dp_support_pct,
    COALESCE(r.dp_support_amount, r."dpSupportAmount") AS "dpSupportAmount",
    COALESCE(r.dp_support_amount, r."dpSupportAmount") AS dp_support_amount,
    COALESCE(r.effective_date, r."effectiveDate") AS "effectiveDate",
    COALESCE(r.effective_date, r."effectiveDate") AS effective_date,
    COALESCE(r.target_date, r."targetDate") AS "targetDate",
    COALESCE(r.target_date, r."targetDate") AS target_date,
    c.next_payment AS "nextPayment",
    c.next_payment AS next_payment,
    c.next_payment_bhxh AS "nextPaymentBhxh",
    c.next_payment_bhxh AS next_payment_bhxh,
    c.next_payment_bhyt AS "nextPaymentBhyt",
    c.next_payment_bhyt AS next_payment_bhyt,
    c.has_bhxh AS "hasBhxh",
    c.has_bhxh AS has_bhxh,
    c.has_bhyt AS "hasBhyt",
    c.has_bhyt AS has_bhyt,
    COALESCE(r.household_id, r."householdId") AS "householdId",
    COALESCE(r.household_id, r."householdId") AS household_id,
    r.members,
    COALESCE(r.recv_name, r."recvName") AS "recvName",
    COALESCE(r.recv_name, r."recvName") AS recv_name,
    COALESCE(r.recv_phone, r."recvPhone") AS "recvPhone",
    COALESCE(r.recv_phone, r."recvPhone") AS recv_phone,
    COALESCE(r.recv_address, r."recvAddress") AS "recvAddress",
    COALESCE(r.recv_address, r."recvAddress") AS recv_address,
    COALESCE(r.is_submitted_bhxh, r."isSubmittedBHXH", false) AS "isSubmittedBHXH",
    COALESCE(r.is_submitted_bhxh, r."isSubmittedBHXH", false) AS is_submitted_bhxh,
    COALESCE(r.submission_batch, r."submissionBatch") AS "submissionBatch",
    COALESCE(r.submission_batch, r."submissionBatch") AS submission_batch,
    COALESCE(r.submitted_date, r."submittedDate") AS "submittedDate",
    COALESCE(r.submitted_date, r."submittedDate") AS submitted_date,
    c.total_contributions AS "totalContributions",
    c.total_contributions AS total_contributions,
    c.total_amount_paid AS "totalAmountPaid",
    c.total_amount_paid AS total_amount_paid,
    COALESCE(r.customer_key, r."customerKey", c.customer_key) AS "customerKey",
    COALESCE(r.customer_key, r."customerKey", c.customer_key) AS customer_key,
    COALESCE(r.is_adjustment, r."isAdjustment", false) AS "isAdjustment",
    COALESCE(r.is_adjustment, r."isAdjustment", false) AS is_adjustment,
    COALESCE(r.original_record_id, r."originalRecordId") AS "originalRecordId",
    COALESCE(r.original_record_id, r."originalRecordId") AS original_record_id,
    COALESCE(r.adjustment_reason, r."adjustmentReason") AS "adjustmentReason",
    COALESCE(r.adjustment_reason, r."adjustmentReason") AS adjustment_reason,
    COALESCE(r.refund_type, r."refundType") AS "refundType",
    COALESCE(r.refund_type, r."refundType") AS refund_type,
    COALESCE(r.decision_number, r."decisionNumber") AS "decisionNumber",
    COALESCE(r.decision_number, r."decisionNumber") AS decision_number,
    COALESCE(r.decision_date, r."decisionDate") AS "decisionDate",
    COALESCE(r.decision_date, r."decisionDate") AS decision_date,
    COALESCE(r.refund_method, r."refundMethod") AS "refundMethod",
    COALESCE(r.refund_method, r."refundMethod") AS refund_method,
    COALESCE(r.refund_beneficiary_name, r."refundBeneficiaryName") AS "refundBeneficiaryName",
    COALESCE(r.refund_beneficiary_name, r."refundBeneficiaryName") AS refund_beneficiary_name,
    COALESCE(r.refund_beneficiary_account, r."refundBeneficiaryAccount") AS "refundBeneficiaryAccount",
    COALESCE(r.refund_beneficiary_account, r."refundBeneficiaryAccount") AS refund_beneficiary_account,
    COALESCE(r.refund_beneficiary_bank, r."refundBeneficiaryBank") AS "refundBeneficiaryBank",
    COALESCE(r.refund_beneficiary_bank, r."refundBeneficiaryBank") AS refund_beneficiary_bank,
    COALESCE(r.hospital_code, r."hospitalCode") AS "hospitalCode",
    COALESCE(r.hospital_code, r."hospitalCode") AS hospital_code,
    COALESCE(r.hospital_name, r."hospitalName") AS "hospitalName",
    COALESCE(r.hospital_name, r."hospitalName") AS hospital_name
FROM public.records r
JOIN public.customers c ON (
  (r.customer_key IS NOT NULL AND c.customer_key = r.customer_key)
  OR (r."customerKey" IS NOT NULL AND c.customer_key = r."customerKey")
  OR (c.cccd IS NOT NULL AND c.cccd != '' AND r.cccd = c.cccd)
  OR (c.bhxh IS NOT NULL AND c.bhxh != '' AND r.bhxh = c.bhxh)
);

GRANT SELECT ON public.crm_customers TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- 6. NHIỆM VỤ 6: CHẶN GIẢ MẠO IP RATE-LIMIT & XÁC THỰC SỐ TIỀN TẠI CỔNG DVC
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_client_ip()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_headers json;
  v_client_ip text := '127.0.0.1';
  v_cf_ip text;
  v_cf_ray text;
  v_real_ip text;
  v_forwarded text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    IF v_headers IS NOT NULL THEN
      v_cf_ip := TRIM(COALESCE(v_headers->>'cf-connecting-ip', ''));
      v_cf_ray := TRIM(COALESCE(v_headers->>'cf-ray', ''));
      v_real_ip := TRIM(COALESCE(v_headers->>'x-real-ip', ''));
      v_forwarded := TRIM(COALESCE(split_part(v_headers->>'x-forwarded-for', ',', 1), ''));

      -- Chỉ tin tưởng cf-connecting-ip khi request đi qua hạ tầng Cloudflare (có cf-ray)
      IF v_cf_ip != '' AND v_cf_ray != '' THEN
        v_client_ip := v_cf_ip;
      ELSIF v_real_ip != '' THEN
        v_client_ip := v_real_ip;
      ELSIF v_forwarded != '' THEN
        v_client_ip := v_forwarded;
      ELSE
        v_client_ip := '127.0.0.1';
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := '127.0.0.1';
  END;
  RETURN TRIM(v_client_ip);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_register_customer(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_ip TEXT;
  v_ip_count INT;
  v_name TEXT;
  v_cccd TEXT;
  v_phone TEXT;
  v_bhxh TEXT;
  v_dob TEXT;
  v_gender TEXT;
  v_nation TEXT;
  v_email TEXT;
  v_address TEXT;
  v_type TEXT;
  v_method TEXT;
  v_months INT;
  v_income NUMERIC;
  v_from_month TEXT;
  v_to_month TEXT;
  v_notes TEXT;
  v_recv_name TEXT;
  v_recv_phone TEXT;
  v_recv_address TEXT;
  v_members JSONB;
  v_record_id BIGINT;
  v_base_premium NUMERIC := 0;
  v_nn_support_pct NUMERIC := 20;
  v_nn_support_amount NUMERIC := 0;
  v_amount NUMERIC := 0;
BEGIN
  v_client_ip := public.get_public_client_ip();

  -- Rate limit: Tối đa 15 yêu cầu trong 1 giờ từ 1 IP
  SELECT COUNT(*) INTO v_ip_count
  FROM public.records
  WHERE ip_address = v_client_ip
    AND date >= (NOW() - INTERVAL '1 hour');

  IF v_ip_count >= 15 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'RATE_LIMIT_EXCEEDED',
      'message', 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau 1 giờ.'
    );
  END IF;

  -- Trích xuất và làm sạch dữ liệu đầu vào
  v_name := TRIM(COALESCE(p_payload->>'name', ''));
  v_cccd := REGEXP_REPLACE(COALESCE(p_payload->>'cccd', ''), '\D', '', 'g');
  v_phone := REGEXP_REPLACE(COALESCE(p_payload->>'phone', ''), '\D', '', 'g');
  v_bhxh := REGEXP_REPLACE(COALESCE(p_payload->>'bhxh', ''), '\D', '', 'g');
  v_dob := TRIM(COALESCE(p_payload->>'dob', ''));
  v_gender := TRIM(COALESCE(p_payload->>'gender', 'Nam'));
  v_nation := TRIM(COALESCE(p_payload->>'nation', 'Kinh'));
  v_email := LOWER(TRIM(COALESCE(p_payload->>'email', '')));
  v_address := TRIM(COALESCE(p_payload->>'address', ''));
  v_type := TRIM(COALESCE(p_payload->>'type', 'BHXH'));
  v_method := TRIM(COALESCE(p_payload->>'method', '1'));
  v_months := GREATEST(1, COALESCE((p_payload->>'months')::INT, 1));
  v_income := COALESCE((p_payload->>'income')::NUMERIC, 1500000);
  v_from_month := TRIM(COALESCE(p_payload->>'fromMonth', p_payload->>'from_month', ''));
  v_to_month := TRIM(COALESCE(p_payload->>'toMonth', p_payload->>'to_month', ''));
  v_notes := TRIM(COALESCE(p_payload->>'notes', ''));
  v_recv_name := TRIM(COALESCE(p_payload->>'recvName', p_payload->>'recv_name', ''));
  v_recv_phone := REGEXP_REPLACE(COALESCE(p_payload->>'recvPhone', p_payload->>'recv_phone', ''), '\D', '', 'g');
  v_recv_address := TRIM(COALESCE(p_payload->>'recvAddress', p_payload->>'recv_address', ''));
  v_members := p_payload->'members';

  IF v_name = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Họ và tên không được để trống.');
  END IF;

  IF LENGTH(v_phone) < 10 OR LENGTH(v_phone) > 11 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số điện thoại không hợp lệ (cần 10-11 chữ số).');
  END IF;

  IF v_cccd != '' AND LENGTH(v_cccd) != 12 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số CCCD không hợp lệ (cần đúng 12 chữ số).');
  END IF;

  IF v_type NOT IN ('BHXH', 'BHYT') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Loại hình bảo hiểm không hợp lệ.');
  END IF;

  -- Xác thực và tính toán lại số tiền nộp chuẩn theo quy định pháp luật (Chống giả mạo số tiền phía client)
  IF v_type = 'BHXH' THEN
    -- Mức thu nhập phải nằm trong khoảng [chuẩn nghèo 1.5M, 20 lần lương cơ sở 46.8M]
    v_income := GREATEST(1500000, LEAST(v_income, 46800000));
    
    -- Tỷ lệ hỗ trợ từ NSNN theo Luật BHXH 2024 & NĐ 159/2025:
    IF v_nation = 'Thiểu_số' OR v_nation = 'Dân tộc thiểu số' THEN
      v_nn_support_pct := 30;
    ELSIF v_nation = 'Hộ nghèo' THEN
      v_nn_support_pct := 50;
    ELSIF v_nation = 'Hộ cận nghèo' THEN
      v_nn_support_pct := 40;
    ELSE
      v_nn_support_pct := 20;
    END IF;

    v_base_premium := ROUND(v_income * 0.22 * v_months);
    v_nn_support_amount := ROUND((1500000 * 0.22 * (v_nn_support_pct / 100.0)) * v_months);
    v_amount := GREATEST(0, v_base_premium - v_nn_support_amount);
  ELSIF v_type = 'BHYT' THEN
    v_amount := ROUND(2340000 * 0.045 * v_months);
  END IF;

  -- Chèn bản ghi với đầy đủ cả 2 hệ thống cột snake_case và camelCase
  INSERT INTO public.records (
    name, cccd, phone, bhxh, dob, gender, nation, email, address,
    type, method, months, income,
    from_month, to_month, "fromMonth", "toMonth",
    notes, recv_name, recv_phone, recv_address,
    "recvName", "recvPhone", "recvAddress",
    members, payment_status, "paymentStatus",
    status, action_type, "actionType",
    staff_id, "staffId",
    amount, base_premium, "basePremium",
    nn_support_pct, "nnSupportPct",
    nn_support_amount, "nnSupportAmount",
    date, ip_address
  ) VALUES (
    v_name, v_cccd, v_phone, v_bhxh, v_dob, v_gender, v_nation, v_email, v_address,
    v_type, v_method, v_months, v_income,
    v_from_month, v_to_month, v_from_month, v_to_month,
    v_notes, v_recv_name, v_recv_phone, v_recv_address,
    v_recv_name, v_recv_phone, v_recv_address,
    v_members, 'Chờ duyệt', 'Chờ duyệt',
    'Chờ duyệt', 'Đăng ký trực tuyến', 'Đăng ký trực tuyến',
    NULL, NULL,
    v_amount, v_base_premium, v_base_premium,
    v_nn_support_pct, v_nn_support_pct,
    v_nn_support_amount, v_nn_support_amount,
    NOW(), v_client_ip
  )
  RETURNING id INTO v_record_id;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', v_record_id,
    'amount', v_amount,
    'message', 'Đăng ký thành công! Cán bộ BHXH sẽ kiểm tra và liên hệ hỗ trợ bạn.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------
-- 7. NHIỆM VỤ 7: CẬP NHẬT KHÁCH HÀNG VI PHÂN INCREMENTAL DELTA UPDATE O(1)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT;
    v_target_status TEXT;
    v_old_eff_amount NUMERIC := 0;
    v_new_eff_amount NUMERIC := 0;
    v_old_eff_contrib INT := 0;
    v_new_eff_contrib INT := 0;
    v_delta_amount NUMERIC := 0;
    v_delta_contrib INT := 0;
    v_latest_id BIGINT;
    v_total_amount NUMERIC;
    v_total_contrib INT;
    v_next_payment DATE;
BEGIN
    -- 1. Bỏ qua nếu đang chạy trong phiên import hàng loạt
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 2. Tối ưu hóa hiệu năng: Bỏ qua khi UPDATE các trường không ảnh hưởng tài chính và vòng đời
    IF TG_OP = 'UPDATE' THEN
        IF OLD.amount IS NOT DISTINCT FROM NEW.amount AND
           OLD.status IS NOT DISTINCT FROM NEW.status AND
           COALESCE(OLD.payment_status, OLD."paymentStatus") IS NOT DISTINCT FROM COALESCE(NEW.payment_status, NEW."paymentStatus") AND
           OLD.date IS NOT DISTINCT FROM NEW.date AND
           OLD.name IS NOT DISTINCT FROM NEW.name AND
           OLD.phone IS NOT DISTINCT FROM NEW.phone AND
           OLD.cccd IS NOT DISTINCT FROM NEW.cccd AND
           OLD.bhxh IS NOT DISTINCT FROM NEW.bhxh AND
           COALESCE(OLD.old_bhxh, OLD."oldBhxh") IS NOT DISTINCT FROM COALESCE(NEW.old_bhxh, NEW."oldBhxh") AND
           OLD.type IS NOT DISTINCT FROM NEW.type AND
           COALESCE(OLD.is_adjustment, OLD."isAdjustment") IS NOT DISTINCT FROM COALESCE(NEW.is_adjustment, NEW."isAdjustment") THEN
            RETURN NEW;
        END IF;
    END IF;

    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    v_key := COALESCE(
      v_rec.customer_key,
      v_rec."customerKey",
      public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone)
    );

    -- NẾU LÀ DELETE: Chạy lại tổng hợp đầy đủ O(N) cho riêng khách hàng này
    IF TG_OP = 'DELETE' THEN
        SELECT 
            COALESCE(SUM(CASE WHEN COALESCE(payment_status, "paymentStatus") = 'Đã thu tiền' THEN amount ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN COALESCE(payment_status, "paymentStatus") = 'Đã thu tiền' THEN (CASE WHEN COALESCE(is_adjustment, "isAdjustment", false) THEN -1 ELSE 1 END) ELSE 0 END), 0),
            MAX(id),
            MAX(COALESCE(next_payment, "nextPayment"))
        INTO v_total_amount, v_total_contrib, v_latest_id, v_next_payment
        FROM public.records
        WHERE COALESCE(customer_key, "customerKey") = v_key
           OR cccd = v_rec.cccd
           OR (bhxh IS NOT NULL AND bhxh != '' AND bhxh = v_rec.bhxh);

        UPDATE public.customers
        SET 
            total_amount_paid = GREATEST(0, v_total_amount),
            total_contributions = GREATEST(0, v_total_contrib),
            latest_record_id = v_latest_id,
            next_payment = v_next_payment,
            updated_at = NOW()
        WHERE customer_key = v_key;

        RETURN OLD;
    END IF;

    -- NẾU LÀ INSERT HOẶC UPDATE: Áp dụng cập nhật vi sai O(1)
    -- Giá trị hiệu lực cũ (khi UPDATE)
    IF TG_OP = 'UPDATE' AND COALESCE(OLD.payment_status, OLD."paymentStatus") = 'Đã thu tiền' THEN
        v_old_eff_amount := COALESCE(OLD.amount, 0);
        v_old_eff_contrib := CASE WHEN COALESCE(OLD.is_adjustment, OLD."isAdjustment", false) IS TRUE THEN -1 ELSE 1 END;
    END IF;

    -- Giá trị hiệu lực mới (khi INSERT hoặc UPDATE)
    IF COALESCE(NEW.payment_status, NEW."paymentStatus") = 'Đã thu tiền' THEN
        v_new_eff_amount := COALESCE(NEW.amount, 0);
        v_new_eff_contrib := CASE WHEN COALESCE(NEW.is_adjustment, NEW."isAdjustment", false) IS TRUE THEN -1 ELSE 1 END;
    END IF;

    v_delta_amount := v_new_eff_amount - v_old_eff_amount;
    v_delta_contrib := v_new_eff_contrib - v_old_eff_contrib;

    -- Trạng thái vòng đời
    IF COALESCE(NEW.payment_status, NEW."paymentStatus") = 'Đã thu tiền' AND COALESCE(NEW.amount, 0) > 0 AND (COALESCE(NEW.is_adjustment, NEW."isAdjustment", false) IS NOT TRUE) AND (NEW.status IS NULL OR NEW.status != 'Đã dừng đóng') THEN
        v_target_status := 'Đang tham gia';
    ELSIF NEW.status = 'Đã dừng đóng' THEN
        v_target_status := 'Đã dừng đóng';
    ELSE
        v_target_status := COALESCE(NEW.status, 'Đang tham gia');
    END IF;
    v_latest_id := NEW.id;

    INSERT INTO public.customers (
        customer_key,
        name,
        cccd,
        phone,
        address,
        bhxh,
        old_bhxh,
        type,
        status,
        total_contributions,
        total_amount_paid,
        latest_record_id,
        next_payment,
        created_at,
        updated_at
    ) VALUES (
        v_key,
        v_rec.name,
        v_rec.cccd,
        v_rec.phone,
        v_rec.address,
        v_rec.bhxh,
        COALESCE(v_rec.old_bhxh, v_rec."oldBhxh"),
        v_rec.type,
        v_target_status,
        GREATEST(0, v_delta_contrib),
        GREATEST(0, v_delta_amount),
        v_latest_id,
        COALESCE(NEW.next_payment, NEW."nextPayment"),
        NOW(),
        NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE SET
        total_amount_paid = GREATEST(0, COALESCE(public.customers.total_amount_paid, 0) + v_delta_amount),
        total_contributions = GREATEST(0, COALESCE(public.customers.total_contributions, 0) + v_delta_contrib),
        latest_record_id = COALESCE(v_latest_id, public.customers.latest_record_id),
        name = COALESCE(v_rec.name, public.customers.name),
        phone = COALESCE(v_rec.phone, public.customers.phone),
        cccd = COALESCE(v_rec.cccd, public.customers.cccd),
        bhxh = COALESCE(v_rec.bhxh, public.customers.bhxh),
        old_bhxh = COALESCE(v_rec.old_bhxh, v_rec."oldBhxh", public.customers.old_bhxh),
        address = COALESCE(v_rec.address, public.customers.address),
        next_payment = COALESCE(NEW.next_payment, NEW."nextPayment", public.customers.next_payment),
        status = CASE 
            WHEN v_target_status IS NOT NULL AND v_target_status != '' THEN v_target_status
            ELSE public.customers.status
        END,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_customer_from_record ON public.records;
CREATE TRIGGER trigger_sync_customer_from_record
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_record();
