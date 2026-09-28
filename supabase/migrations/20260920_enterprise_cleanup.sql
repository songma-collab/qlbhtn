-- ======================================================================
-- MIGRATION: 20260920_enterprise_cleanup.sql
-- KỸ SƯ TRƯỞNG TOÀN VẸN DỮ LIỆU & KIỂM THỬ HỆ THỐNG CẤP CAO
-- CHUẨN HÓA SCHEMA 100% SNAKE_CASE, TRIỆT TIÊU ALIAS & TỐI ƯU ROW LOCK
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- NHIỆM VỤ 1: CHUẨN HÓA SCHEMA SANG SNAKE_CASE TRÊN TOÀN BỘ CSDL
-- ----------------------------------------------------------------------

-- 1.1. Bổ sung các cột chuẩn snake_case trên bảng public.records nếu chưa có
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Chờ thu tiền';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS sub_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS support_pct NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS household_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_pct NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS dp_support_pct NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS from_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS to_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS base_premium NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_amount NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS dp_support_amount NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS next_payment DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_name TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_phone TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS recv_address TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS is_submitted_bhxh BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS submission_batch TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS submitted_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS base_salary_snapshot NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS poverty_standard_snapshot NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS policy_version_id BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS applied_rates JSONB;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS original_record_id BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS adjustment_reason TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_key TEXT;
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

-- 1.2. Bổ sung NHIỆM VỤ 3: IDEMPOTENCY KEY chống trùng lặp giao dịch
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS idempotency_key UUID;
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_idempotency 
ON public.records (idempotency_key, (date::DATE)) 
WHERE idempotency_key IS NOT NULL;

-- 1.3. Đồng bộ dữ liệu từ các cột nháy kép camelCase sang snake_case trước khi drop
DO $$
BEGIN
  -- staff_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='staffId') THEN
    EXECUTE 'UPDATE public.records SET staff_id = COALESCE(staff_id, "staffId") WHERE staff_id IS NULL AND "staffId" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "staffId";
  END IF;

  -- payment_status
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='paymentStatus') THEN
    EXECUTE 'UPDATE public.records SET payment_status = COALESCE(payment_status, "paymentStatus") WHERE payment_status IS NULL AND "paymentStatus" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "paymentStatus";
  END IF;

  -- action_type
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='actionType') THEN
    EXECUTE 'UPDATE public.records SET action_type = COALESCE(action_type, "actionType") WHERE action_type IS NULL AND "actionType" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "actionType";
  END IF;

  -- sub_type
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='subType') THEN
    EXECUTE 'UPDATE public.records SET sub_type = COALESCE(sub_type, "subType") WHERE sub_type IS NULL AND "subType" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "subType";
  END IF;

  -- from_month
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='fromMonth') THEN
    EXECUTE 'UPDATE public.records SET from_month = COALESCE(from_month, "fromMonth") WHERE from_month IS NULL AND "fromMonth" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "fromMonth";
  END IF;

  -- to_month
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='toMonth') THEN
    EXECUTE 'UPDATE public.records SET to_month = COALESCE(to_month, "toMonth") WHERE to_month IS NULL AND "toMonth" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "toMonth";
  END IF;

  -- is_submitted_bhxh
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='isSubmittedBHXH') THEN
    EXECUTE 'UPDATE public.records SET is_submitted_bhxh = COALESCE(is_submitted_bhxh, "isSubmittedBHXH") WHERE is_submitted_bhxh IS FALSE AND "isSubmittedBHXH" IS TRUE';
    ALTER TABLE public.records DROP COLUMN "isSubmittedBHXH";
  END IF;

  -- submission_batch
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='submissionBatch') THEN
    EXECUTE 'UPDATE public.records SET submission_batch = COALESCE(submission_batch, "submissionBatch") WHERE submission_batch IS NULL AND "submissionBatch" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "submissionBatch";
  END IF;

  -- submitted_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='submittedDate') THEN
    EXECUTE 'UPDATE public.records SET submitted_date = COALESCE(submitted_date, "submittedDate") WHERE submitted_date IS NULL AND "submittedDate" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "submittedDate";
  END IF;

  -- base_salary_snapshot
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='baseSalarySnapshot') THEN
    EXECUTE 'UPDATE public.records SET base_salary_snapshot = COALESCE(base_salary_snapshot, "baseSalarySnapshot") WHERE base_salary_snapshot IS NULL AND "baseSalarySnapshot" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "baseSalarySnapshot";
  END IF;

  -- poverty_standard_snapshot
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='povertyStandardSnapshot') THEN
    EXECUTE 'UPDATE public.records SET poverty_standard_snapshot = COALESCE(poverty_standard_snapshot, "povertyStandardSnapshot") WHERE poverty_standard_snapshot IS NULL AND "povertyStandardSnapshot" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "povertyStandardSnapshot";
  END IF;

  -- policy_version_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='policyVersionId') THEN
    EXECUTE 'UPDATE public.records SET policy_version_id = COALESCE(policy_version_id, "policyVersionId") WHERE policy_version_id IS NULL AND "policyVersionId" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "policyVersionId";
  END IF;

  -- applied_rates
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='appliedRates') THEN
    EXECUTE 'UPDATE public.records SET applied_rates = COALESCE(applied_rates, "appliedRates") WHERE applied_rates IS NULL AND "appliedRates" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "appliedRates";
  END IF;

  -- is_adjustment
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='isAdjustment') THEN
    EXECUTE 'UPDATE public.records SET is_adjustment = COALESCE(is_adjustment, "isAdjustment") WHERE is_adjustment IS FALSE AND "isAdjustment" IS TRUE';
    ALTER TABLE public.records DROP COLUMN "isAdjustment";
  END IF;

  -- original_record_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='originalRecordId') THEN
    EXECUTE 'UPDATE public.records SET original_record_id = COALESCE(original_record_id, "originalRecordId") WHERE original_record_id IS NULL AND "originalRecordId" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "originalRecordId";
  END IF;

  -- adjustment_reason
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='adjustmentReason') THEN
    EXECUTE 'UPDATE public.records SET adjustment_reason = COALESCE(adjustment_reason, "adjustmentReason") WHERE adjustment_reason IS NULL AND "adjustmentReason" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "adjustmentReason";
  END IF;

  -- customer_id & customer_key
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='customerId') THEN
    EXECUTE 'UPDATE public.records SET customer_id = COALESCE(customer_id, "customerId") WHERE customer_id IS NULL AND "customerId" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "customerId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='customerKey') THEN
    EXECUTE 'UPDATE public.records SET customer_key = COALESCE(customer_key, "customerKey") WHERE customer_key IS NULL AND "customerKey" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "customerKey";
  END IF;

  -- refund fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='refundType') THEN
    EXECUTE 'UPDATE public.records SET refund_type = COALESCE(refund_type, "refundType") WHERE refund_type IS NULL AND "refundType" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "refundType";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='decisionNumber') THEN
    EXECUTE 'UPDATE public.records SET decision_number = COALESCE(decision_number, "decisionNumber") WHERE decision_number IS NULL AND "decisionNumber" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "decisionNumber";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='decisionDate') THEN
    EXECUTE 'UPDATE public.records SET decision_date = COALESCE(decision_date, "decisionDate") WHERE decision_date IS NULL AND "decisionDate" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "decisionDate";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='refundMethod') THEN
    EXECUTE 'UPDATE public.records SET refund_method = COALESCE(refund_method, "refundMethod") WHERE refund_method IS NULL AND "refundMethod" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "refundMethod";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='refundBeneficiaryName') THEN
    EXECUTE 'UPDATE public.records SET refund_beneficiary_name = COALESCE(refund_beneficiary_name, "refundBeneficiaryName") WHERE refund_beneficiary_name IS NULL AND "refundBeneficiaryName" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "refundBeneficiaryName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='refundBeneficiaryAccount') THEN
    EXECUTE 'UPDATE public.records SET refund_beneficiary_account = COALESCE(refund_beneficiary_account, "refundBeneficiaryAccount") WHERE refund_beneficiary_account IS NULL AND "refundBeneficiaryAccount" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "refundBeneficiaryAccount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='refundBeneficiaryBank') THEN
    EXECUTE 'UPDATE public.records SET refund_beneficiary_bank = COALESCE(refund_beneficiary_bank, "refundBeneficiaryBank") WHERE refund_beneficiary_bank IS NULL AND "refundBeneficiaryBank" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "refundBeneficiaryBank";
  END IF;

  -- hospital & recv fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='hospitalCode') THEN
    EXECUTE 'UPDATE public.records SET hospital_code = COALESCE(hospital_code, "hospitalCode") WHERE hospital_code IS NULL AND "hospitalCode" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "hospitalCode";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='hospitalName') THEN
    EXECUTE 'UPDATE public.records SET hospital_name = COALESCE(hospital_name, "hospitalName") WHERE hospital_name IS NULL AND "hospitalName" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "hospitalName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='recvName') THEN
    EXECUTE 'UPDATE public.records SET recv_name = COALESCE(recv_name, "recvName") WHERE recv_name IS NULL AND "recvName" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "recvName";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='recvPhone') THEN
    EXECUTE 'UPDATE public.records SET recv_phone = COALESCE(recv_phone, "recvPhone") WHERE recv_phone IS NULL AND "recvPhone" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "recvPhone";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='recvAddress') THEN
    EXECUTE 'UPDATE public.records SET recv_address = COALESCE(recv_address, "recvAddress") WHERE recv_address IS NULL AND "recvAddress" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "recvAddress";
  END IF;

  -- financial & support fields
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='supportPct') THEN
    EXECUTE 'UPDATE public.records SET support_pct = COALESCE(support_pct, "supportPct") WHERE support_pct IS NULL AND "supportPct" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "supportPct";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='basePremium') THEN
    EXECUTE 'UPDATE public.records SET base_premium = COALESCE(base_premium, "basePremium") WHERE base_premium IS NULL AND "basePremium" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "basePremium";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='nnSupportAmount') THEN
    EXECUTE 'UPDATE public.records SET nn_support_amount = COALESCE(nn_support_amount, "nnSupportAmount") WHERE nn_support_amount IS NULL AND "nnSupportAmount" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "nnSupportAmount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='dpSupportAmount') THEN
    EXECUTE 'UPDATE public.records SET dp_support_amount = COALESCE(dp_support_amount, "dpSupportAmount") WHERE dp_support_amount IS NULL AND "dpSupportAmount" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "dpSupportAmount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='discountAmount') THEN
    EXECUTE 'UPDATE public.records SET discount_amount = COALESCE(discount_amount, "discountAmount") WHERE discount_amount IS NULL AND "discountAmount" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "discountAmount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='penaltyAmount') THEN
    EXECUTE 'UPDATE public.records SET penalty_amount = COALESCE(penalty_amount, "penaltyAmount") WHERE penalty_amount IS NULL AND "penaltyAmount" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "penaltyAmount";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='nextPayment') THEN
    EXECUTE 'UPDATE public.records SET next_payment = COALESCE(next_payment, "nextPayment") WHERE next_payment IS NULL AND "nextPayment" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "nextPayment";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='effectiveDate') THEN
    EXECUTE 'UPDATE public.records SET effective_date = COALESCE(effective_date, "effectiveDate") WHERE effective_date IS NULL AND "effectiveDate" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "effectiveDate";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='targetDate') THEN
    EXECUTE 'UPDATE public.records SET target_date = COALESCE(target_date, "targetDate") WHERE target_date IS NULL AND "targetDate" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "targetDate";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='householdId') THEN
    EXECUTE 'UPDATE public.records SET household_id = COALESCE(household_id, "householdId") WHERE household_id IS NULL AND "householdId" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "householdId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='nnSupportPct') THEN
    EXECUTE 'UPDATE public.records SET nn_support_pct = COALESCE(nn_support_pct, "nnSupportPct") WHERE nn_support_pct IS NULL AND "nnSupportPct" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "nnSupportPct";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='dpSupportPct') THEN
    EXECUTE 'UPDATE public.records SET dp_support_pct = COALESCE(dp_support_pct, "dpSupportPct") WHERE dp_support_pct IS NULL AND "dpSupportPct" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "dpSupportPct";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='records' AND column_name='oldBhxh') THEN
    EXECUTE 'UPDATE public.records SET old_bhxh = COALESCE(old_bhxh, "oldBhxh") WHERE old_bhxh IS NULL AND "oldBhxh" IS NOT NULL';
    ALTER TABLE public.records DROP COLUMN "oldBhxh";
  END IF;
END $$;

-- 1.4. Chuẩn hóa các bảng customers, auditlogs, staff
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_contributions INT DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS latest_record_id BIGINT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact_history JSONB;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS old_bhxh TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='totalContributions') THEN
    EXECUTE 'UPDATE public.customers SET total_contributions = COALESCE(total_contributions, "totalContributions") WHERE total_contributions = 0 AND "totalContributions" IS NOT NULL';
    ALTER TABLE public.customers DROP COLUMN "totalContributions";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='totalAmountPaid') THEN
    EXECUTE 'UPDATE public.customers SET total_amount_paid = COALESCE(total_amount_paid, "totalAmountPaid") WHERE total_amount_paid = 0 AND "totalAmountPaid" IS NOT NULL';
    ALTER TABLE public.customers DROP COLUMN "totalAmountPaid";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='latestRecordId') THEN
    EXECUTE 'UPDATE public.customers SET latest_record_id = COALESCE(latest_record_id, "latestRecordId") WHERE latest_record_id IS NULL AND "latestRecordId" IS NOT NULL';
    ALTER TABLE public.customers DROP COLUMN "latestRecordId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='contactHistory') THEN
    EXECUTE 'UPDATE public.customers SET contact_history = COALESCE(contact_history, "contactHistory") WHERE contact_history IS NULL AND "contactHistory" IS NOT NULL';
    ALTER TABLE public.customers DROP COLUMN "contactHistory";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='oldBhxh') THEN
    EXECUTE 'UPDATE public.customers SET old_bhxh = COALESCE(old_bhxh, "oldBhxh") WHERE old_bhxh IS NULL AND "oldBhxh" IS NOT NULL';
    ALTER TABLE public.customers DROP COLUMN "oldBhxh";
  END IF;
END $$;

-- auditlogs
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS user_name TEXT;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='auditlogs' AND column_name='userId') THEN
    EXECUTE 'UPDATE public.auditlogs SET user_id = COALESCE(user_id, "userId") WHERE user_id IS NULL AND "userId" IS NOT NULL';
    ALTER TABLE public.auditlogs DROP COLUMN "userId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='auditlogs' AND column_name='userName') THEN
    EXECUTE 'UPDATE public.auditlogs SET user_name = COALESCE(user_name, "userName") WHERE user_name IS NULL AND "userName" IS NOT NULL';
    ALTER TABLE public.auditlogs DROP COLUMN "userName";
  END IF;
END $$;

-- 1.5. XÓA BỎ TRIGGER VÀ HÀM SYNC_RECORD_ALIASES ĐỂ GIẢI PHÓNG CPU
DROP TRIGGER IF EXISTS trigger_sync_record_aliases ON public.records;
DROP FUNCTION IF EXISTS public.sync_record_aliases();

-- ----------------------------------------------------------------------
-- NHIỆM VỤ 2: TỐI ƯU HÓA TRIGGER LIFECYCLE KHÁCH HÀNG (INCREMENTAL DELTA UPDATE)
-- Loại bỏ hoàn toàn Full Table Scan / Aggregate (SELECT COUNT, SUM(amount))
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
BEGIN
    -- 1. Bỏ qua nếu đang chạy trong phiên import hàng loạt
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 2. Tối ưu hóa hiệu năng: Bỏ qua khi UPDATE các trường không ảnh hưởng tài chính và vòng đời
    IF TG_OP = 'UPDATE' THEN
        IF OLD.amount IS NOT DISTINCT FROM NEW.amount AND
           OLD.status IS NOT DISTINCT FROM NEW.status AND
           OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status AND
           OLD.date IS NOT DISTINCT FROM NEW.date AND
           OLD.name IS NOT DISTINCT FROM NEW.name AND
           OLD.phone IS NOT DISTINCT FROM NEW.phone AND
           OLD.cccd IS NOT DISTINCT FROM NEW.cccd AND
           OLD.bhxh IS NOT DISTINCT FROM NEW.bhxh AND
           OLD.old_bhxh IS NOT DISTINCT FROM NEW.old_bhxh AND
           OLD.type IS NOT DISTINCT FROM NEW.type AND
           OLD.is_adjustment IS NOT DISTINCT FROM NEW.is_adjustment THEN
            RETURN NEW;
        END IF;
    END IF;

    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    v_key := COALESCE(v_rec.customer_key, public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone));

    -- 3. TÍNH TOÁN VI SAI TÍCH LŨY (INCREMENTAL DELTA CALCULATION - KHÔNG QUYÉT BẢNG)
    -- Giá trị hiệu lực cũ
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.payment_status = 'Đã thu tiền' THEN
        v_old_eff_amount := COALESCE(OLD.amount, 0);
        v_old_eff_contrib := CASE WHEN OLD.is_adjustment IS TRUE THEN -1 ELSE 1 END;
    END IF;

    -- Giá trị hiệu lực mới
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.payment_status = 'Đã thu tiền' THEN
        v_new_eff_amount := COALESCE(NEW.amount, 0);
        v_new_eff_contrib := CASE WHEN NEW.is_adjustment IS TRUE THEN -1 ELSE 1 END;
    END IF;

    v_delta_amount := v_new_eff_amount - v_old_eff_amount;
    v_delta_contrib := v_new_eff_contrib - v_old_eff_contrib;

    -- 4. Xác định trạng thái vòng đời khách hàng
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.payment_status = 'Đã thu tiền' AND COALESCE(NEW.amount, 0) > 0 AND (NEW.is_adjustment IS NOT TRUE) AND (NEW.status IS NULL OR NEW.status != 'Đã dừng đóng') THEN
            v_target_status := 'Đang tham gia';
        ELSIF NEW.status = 'Đã dừng đóng' THEN
            v_target_status := 'Đã dừng đóng';
        ELSE
            v_target_status := COALESCE(NEW.status, 'Đang tham gia');
        END IF;
        v_latest_id := NEW.id;
    ELSE
        -- DELETE
        v_target_status := 'Đang tham gia';
        v_latest_id := NULL;
    END IF;

    -- 5. CẬP NHẬT HOẶC TẠO MỚI MASTER RECORD BẰNG CƠ CHẾ DELTA UPDATE
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
        created_at,
        updated_at
    ) VALUES (
        v_key,
        v_rec.name,
        v_rec.cccd,
        v_rec.phone,
        v_rec.address,
        v_rec.bhxh,
        v_rec.old_bhxh,
        v_rec.type,
        v_target_status,
        GREATEST(0, v_delta_contrib),
        GREATEST(0, v_delta_amount),
        v_latest_id,
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
        old_bhxh = COALESCE(v_rec.old_bhxh, public.customers.old_bhxh),
        address = COALESCE(v_rec.address, public.customers.address),
        status = CASE 
            WHEN v_target_status IS NOT NULL AND v_target_status != '' THEN v_target_status
            ELSE public.customers.status
        END,
        updated_at = NOW();

    RETURN v_rec;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_customer_from_record ON public.records;
CREATE TRIGGER trigger_sync_customer_from_record
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_record();

-- 1.6. Cập nhật Trigger BEFORE INSERT/UPDATE gán customer_key & customer_id thuần snake_case
CREATE OR REPLACE FUNCTION public.before_record_assign_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key TEXT;
    v_cust_id UUID;
BEGIN
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.type IS NOT DISTINCT FROM NEW.type AND
           OLD.bhxh IS NOT DISTINCT FROM NEW.bhxh AND
           OLD.old_bhxh IS NOT DISTINCT FROM NEW.old_bhxh AND
           OLD.cccd IS NOT DISTINCT FROM NEW.cccd AND
           OLD.name IS NOT DISTINCT FROM NEW.name AND
           OLD.phone IS NOT DISTINCT FROM NEW.phone AND
           OLD.address IS NOT DISTINCT FROM NEW.address AND
           OLD.dob IS NOT DISTINCT FROM NEW.dob AND
           OLD.gender IS NOT DISTINCT FROM NEW.gender AND
           NEW.customer_id IS NOT NULL AND
           NEW.customer_key IS NOT NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    v_key := public.generate_customer_key(NEW.type, NEW.bhxh, NEW.cccd, NEW.name, NEW.phone);
    NEW.customer_key := v_key;

    SELECT id INTO v_cust_id FROM public.customers WHERE customer_key = v_key LIMIT 1;

    IF v_cust_id IS NULL THEN
        INSERT INTO public.customers (
            customer_key, type, name, cccd, bhxh, old_bhxh,
            phone, address, dob, gender, nation, email,
            status, payment_status, notes, staff_id,
            household_id, recv_name, recv_phone, recv_address,
            created_at, updated_at
        ) VALUES (
            v_key, NEW.type, COALESCE(NEW.name, 'Chưa đặt tên'), NEW.cccd, NEW.bhxh, NEW.old_bhxh,
            NEW.phone, NEW.address, NEW.dob, NEW.gender, NEW.nation, NEW.email,
            COALESCE(NEW.status, 'Đang tham gia'), COALESCE(NEW.payment_status, 'Đã thu tiền'), NEW.notes, NEW.staff_id,
            NEW.household_id, NEW.recv_name, NEW.recv_phone, NEW.recv_address,
            NOW(), NOW()
        )
        RETURNING id INTO v_cust_id;
    END IF;

    NEW.customer_id := v_cust_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_before_record_assign_customer ON public.records;
CREATE TRIGGER trigger_before_record_assign_customer
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.before_record_assign_customer();

-- ----------------------------------------------------------------------
-- NHIỆM VỤ 4: TĂNG CƯỜNG BẢO MẬT IP & RATE-LIMITING QUA PROXY
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
  v_raw_ip text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
    IF v_headers IS NOT NULL THEN
      -- Thứ tự ưu tiên kiểm tra IP nguồn:
      -- 1. CF-Connecting-IP (Do Cloudflare Edge gắn, bất biến từ người dùng)
      -- 2. X-Real-IP (Do Nginx reverse proxy chỉ định trực tiếp từ $remote_addr)
      -- 3. X-Forwarded-For (Lấy IP đầu tiên trong chuỗi ủy quyền)
      v_raw_ip := COALESCE(
        v_headers->>'cf-connecting-ip',
        v_headers->>'x-real-ip',
        split_part(v_headers->>'x-forwarded-for', ',', 1)
      );
      IF v_raw_ip IS NOT NULL AND TRIM(v_raw_ip) != '' THEN
        v_client_ip := TRIM(v_raw_ip);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_client_ip := '127.0.0.1';
  END;
  RETURN v_client_ip;
END;
$$;

-- Cập nhật hàm kiểm tra rate-limit
CREATE OR REPLACE FUNCTION public.enforce_public_rpc_rate_limit(
  p_action TEXT,
  p_max_calls INTEGER,
  p_window INTERVAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text;
  v_count integer;
BEGIN
  IF auth.role() = 'authenticated' THEN
    RETURN;
  END IF;

  v_ip := public.get_public_client_ip();

  SELECT COUNT(*) INTO v_count
  FROM public.public_rpc_call_log
  WHERE action = p_action
    AND ip_address = v_ip
    AND called_at >= (NOW() - p_window);

  IF v_count >= p_max_calls THEN
    RAISE EXCEPTION 'RATE_LIMIT_EXCEEDED: Địa chỉ mạng (%) đã vượt giới hạn thao tác cho phép. Vui lòng thử lại sau.', v_ip;
  END IF;

  INSERT INTO public.public_rpc_call_log (action, ip_address) VALUES (p_action, v_ip);
END;
$$;

-- ----------------------------------------------------------------------
-- CẬP NHẬT VIEW CRM CUSTOMERS VÀ CÁC VIEW TRUY VẤN
-- ----------------------------------------------------------------------

DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers 
WITH (security_invoker = true) AS
SELECT 
    r.id,
    r.date,
    c.name,
    c.cccd,
    c.phone,
    c.address,
    c.bhxh,
    c.old_bhxh,
    c.old_bhxh AS "oldBhxh",
    r.dob,
    r.gender,
    r.nation,
    r.email,
    c.type,
    c.status,
    c.status AS "customerStatus",
    r.payment_status,
    r.payment_status AS "paymentStatus",
    r.staff_id,
    r.staff_id AS "staffId",
    r.action_type,
    r.action_type AS "actionType",
    r.wage,
    r.income,
    r.months,
    r.from_month,
    r.from_month AS "fromMonth",
    r.to_month,
    r.to_month AS "toMonth",
    r.amount,
    r.notes,
    r.members,
    r.method,
    r.discount_amount,
    r.discount_amount AS "discountAmount",
    r.penalty_amount,
    r.penalty_amount AS "penaltyAmount",
    r.commission,
    r.support,
    c.total_contributions,
    c.total_contributions AS "totalContributions",
    c.total_amount_paid,
    c.total_amount_paid AS "totalAmountPaid",
    c.id AS customer_id,
    c.id AS "customerId",
    c.customer_key,
    c.customer_key AS "customerKey"
FROM public.customers c
JOIN public.records r ON c.latest_record_id = r.id;

REVOKE ALL ON public.crm_customers FROM anon, public;
GRANT SELECT ON public.crm_customers TO authenticated, service_role;

-- Cập nhật view transactions
DROP VIEW IF EXISTS public.v_customer_transactions CASCADE;

CREATE OR REPLACE VIEW public.v_customer_transactions 
WITH (security_invoker = true) AS
SELECT 
    r.id AS transaction_id,
    r.date AS transaction_date,
    r.type AS transaction_type,
    r.action_type,
    r.amount,
    r.months,
    r.from_month,
    r.to_month,
    r.payment_status,
    r.status AS record_status,
    r.staff_id,
    r.notes,
    r.commission,
    r.support,
    r.discount_amount,
    r.penalty_amount,
    r.is_submitted_bhxh,
    r.submission_batch,
    r.is_adjustment,
    r.original_record_id,
    r.refund_type,
    r.decision_number,
    c.id AS customer_id,
    c.customer_key,
    c.name AS customer_name,
    c.cccd,
    c.phone,
    c.bhxh,
    c.old_bhxh
FROM public.records r
JOIN public.customers c ON (r.customer_key = c.customer_key OR r.customer_id = c.id);

REVOKE ALL ON public.v_customer_transactions FROM anon, public;
GRANT SELECT ON public.v_customer_transactions TO authenticated, service_role;

-- ----------------------------------------------------------------------
-- CẬP NHẬT CÁC TRIGGER BẢO TOÀN INVARIANT TÀI CHÍNH THUẦN SNAKE_CASE
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
       v_locked_keys ? v_quarter_key OR
       v_locked_keys ? v_year_key THEN
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
               (OLD.from_month IS DISTINCT FROM NEW.from_month) OR
               (OLD.to_month IS DISTINCT FROM NEW.to_month) OR
               (OLD.date IS DISTINCT FROM NEW.date) OR
               (OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'Đã hủy') OR
               (OLD.is_submitted_bhxh IS DISTINCT FROM NEW.is_submitted_bhxh) THEN
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

-- Trigger bảo vệ giao dịch đã thu tiền
CREATE OR REPLACE FUNCTION public.protect_paid_record_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('app.is_admin_override', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.payment_status = 'Đã thu tiền' THEN
    IF NEW.date IS DISTINCT FROM OLD.date OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.wage IS DISTINCT FROM OLD.wage THEN
      RAISE EXCEPTION 'Bảo mật tài chính: Giao dịch đã thu tiền không được phép chỉnh sửa ngày hoặc số tiền đóng. Vui lòng liên hệ Quản lý.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_paid_record_financials ON public.records;
CREATE TRIGGER trg_protect_paid_record_financials
BEFORE UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.protect_paid_record_financials();

-- Trigger kiểm soát hồ sơ đã nộp theo đợt BHXH
CREATE OR REPLACE FUNCTION public.check_submitted_batch_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_submitted_bhxh = true THEN
    IF current_setting('app.is_admin_override', true) = 'true' THEN
      RETURN NEW;
    END IF;

    IF (NEW.amount IS DISTINCT FROM OLD.amount) OR
       (NEW.date IS DISTINCT FROM OLD.date) OR
       (NEW.type IS DISTINCT FROM OLD.type) OR
       (NEW.wage IS DISTINCT FROM OLD.wage) OR
       (NEW.months IS DISTINCT FROM OLD.months) OR
       (NEW.from_month IS DISTINCT FROM OLD.from_month) OR
       (NEW.to_month IS DISTINCT FROM OLD.to_month) OR
       (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'Đã hủy') THEN
      RAISE EXCEPTION 'Hồ sơ này đã được kết xuất chuyển nộp BHXH trong đợt [%]. Nghiêm cấm thay đổi thông tin tài chính hoặc hủy bỏ!',
        COALESCE(OLD.submission_batch, 'BHXH')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_submitted_batch_lock ON public.records;
CREATE TRIGGER trigger_check_submitted_batch_lock
BEFORE UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.check_submitted_batch_lock();

COMMIT;
