-- ==============================================================================
-- KỊCH BẢN MIGRATION SQL: ĐỒNG NHẤT ĐỊNH DẠNG NGÀY THÁNG NĂM & THÁNG NĂM TOÀN HỆ THỐNG
-- Tên file: 20260924_unify_date_formats.sql
-- Tiêu chuẩn: Three-Tier Standard (UI: DD/MM/YYYY, MM/YYYY | State: YYYY-MM-DD, YYYY-MM-01 | DB: DATE)
-- Nguyên tắc: Zero-Downtime, Backward-Compatible, Idempotent
-- ==============================================================================

-- 1. BỔ SUNG CỘT CHUẨN DATE CHO KỲ ĐÓNG BẢO HIỂM TRONG BẢNG RECORDS
ALTER TABLE public.records 
    ADD COLUMN IF NOT EXISTS "from_month_date" DATE,
    ADD COLUMN IF NOT EXISTS "to_month_date" DATE,
    ADD COLUMN IF NOT EXISTS "submitted_date" DATE,
    ADD COLUMN IF NOT EXISTS "decision_date" DATE;

-- Thêm các cột tương thích camelCase nếu cần
ALTER TABLE public.records 
    ADD COLUMN IF NOT EXISTS "fromMonthDate" DATE,
    ADD COLUMN IF NOT EXISTS "toMonthDate" DATE;

-- 2. BỔ SUNG CỘT CHUẨN DATE CHO BẢNG QUÁ TRÌNH THAM GIA (CUSTOMER_PARTICIPATIONS)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customer_participations'
    ) THEN
        ALTER TABLE public.customer_participations
            ADD COLUMN IF NOT EXISTS "from_month_date" DATE,
            ADD COLUMN IF NOT EXISTS "to_month_date" DATE;
    END IF;
END $$;

-- 3. HÀM TIỆN ÍCH SQL: PARSE CHUỖI THÁNG (MM/YYYY HOẶC YYYY-MM) SANG DATE (NGÀY 01 ĐẦU THÁNG)
CREATE OR REPLACE FUNCTION public.parse_month_str_to_date(val TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    clean_val TEXT;
    m INT;
    y INT;
    parts TEXT[];
BEGIN
    IF val IS NULL OR TRIM(val) = '' THEN
        RETURN NULL;
    END IF;
    clean_val := TRIM(val);
    
    -- Dạng MM/YYYY (ví dụ: 09/2026 hoặc 9/2026)
    IF clean_val ~ '^\d{1,2}/\d{4}$' THEN
        parts := string_to_array(clean_val, '/');
        m := parts[1]::INT;
        y := parts[2]::INT;
        IF m >= 1 AND m <= 12 AND y >= 1900 AND y <= 2100 THEN
            RETURN make_date(y, m, 1);
        END IF;
    END IF;

    -- Dạng YYYY-MM (ví dụ: 2026-09)
    IF clean_val ~ '^\d{4}-\d{1,2}$' THEN
        parts := string_to_array(clean_val, '-');
        y := parts[1]::INT;
        m := parts[2]::INT;
        IF m >= 1 AND m <= 12 AND y >= 1900 AND y <= 2100 THEN
            RETURN make_date(y, m, 1);
        END IF;
    END IF;

    -- Dạng YYYY-MM-DD
    IF clean_val ~ '^\d{4}-\d{1,2}-\d{1,2}' THEN
        BEGIN
            RETURN (split_part(clean_val, 'T', 1))::DATE;
        EXCEPTION WHEN OTHERS THEN
            RETURN NULL;
        END;
    END IF;

    RETURN NULL;
END;
$$;

-- Overload hỗ trợ đầu vào dạng DATE (trả về chính nó để tránh lỗi ép kiểu)
CREATE OR REPLACE FUNCTION public.parse_month_str_to_date(val DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT val;
$$;

-- 4. BACKFILL DỮ LIỆU CŨ CHO RECORDS SANG FROM_MONTH_DATE & TO_MONTH_DATE
UPDATE public.records
SET 
    "from_month_date" = COALESCE("from_month_date", public.parse_month_str_to_date(COALESCE("from_month", "fromMonth"))),
    "fromMonthDate" = COALESCE("fromMonthDate", "from_month_date", public.parse_month_str_to_date(COALESCE("from_month", "fromMonth"))),
    "to_month_date" = COALESCE("to_month_date", public.parse_month_str_to_date(COALESCE("to_month", "toMonth"))),
    "toMonthDate" = COALESCE("toMonthDate", "to_month_date", public.parse_month_str_to_date(COALESCE("to_month", "toMonth"))),
    "submitted_date" = COALESCE("submitted_date", "submittedDate"),
    "decision_date" = COALESCE("decision_date", "decisionDate")
WHERE ("from_month_date" IS NULL AND COALESCE("from_month", "fromMonth") IS NOT NULL)
   OR ("to_month_date" IS NULL AND COALESCE("to_month", "toMonth") IS NOT NULL);

-- 5. BACKFILL DỮ LIỆU CŨ CHO CUSTOMER_PARTICIPATIONS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'customer_participations'
    ) THEN
        UPDATE public.customer_participations
        SET 
            from_month_date = COALESCE(from_month_date, make_date(from_year, from_month, 1)),
            to_month_date = COALESCE(to_month_date, make_date(to_year, to_month, 1))
        WHERE from_month_date IS NULL OR to_month_date IS NULL;
    END IF;
END $$;

-- 6. CẬP NHẬT TRIGGER FUNCTION SYNC_RECORD_ALIASES TỰ ĐỘNG ĐỒNG BỘ 2 CHIỀU GIỮA TEXT VÀ DATE
CREATE OR REPLACE FUNCTION public.sync_record_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_f_date DATE;
    v_t_date DATE;
BEGIN
  -- 1. staff_id <-> "staffId"
  IF (NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '') AND (NEW."staffId" IS NULL OR TRIM(NEW."staffId") = '') THEN
    NEW.staff_id := public.current_staff_id();
    NEW."staffId" := NEW.staff_id;
  ELSIF NEW.staff_id IS NOT NULL AND (NEW."staffId" IS NULL OR TRIM(NEW."staffId") = '') THEN
    NEW."staffId" := NEW.staff_id;
  ELSIF NEW."staffId" IS NOT NULL AND (NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '') THEN
    NEW.staff_id := NEW."staffId";
  ELSE
    NEW."staffId" := COALESCE(NULLIF(TRIM(NEW."staffId"), ''), NULLIF(TRIM(NEW.staff_id), ''));
    NEW.staff_id := COALESCE(NULLIF(TRIM(NEW.staff_id), ''), NULLIF(TRIM(NEW."staffId"), ''));
  END IF;

  -- 2. Đồng bộ các cặp trường Alias (snake_case <-> camelCase)
  NEW."paymentStatus" := COALESCE(NEW."paymentStatus", NEW.payment_status);
  NEW.payment_status := COALESCE(NEW.payment_status, NEW."paymentStatus");

  NEW."actionType" := COALESCE(NEW."actionType", NEW.action_type);
  NEW.action_type := COALESCE(NEW.action_type, NEW."actionType");

  NEW."subType" := COALESCE(NEW."subType", NEW.sub_type);
  NEW.sub_type := COALESCE(NEW.sub_type, NEW."subType");

  NEW."supportPct" := COALESCE(NEW."supportPct", NEW.support_pct);
  NEW.support_pct := COALESCE(NEW.support_pct, NEW."supportPct");

  NEW."householdId" := COALESCE(NEW."householdId", NEW.household_id);
  NEW.household_id := COALESCE(NEW.household_id, NEW."householdId");

  NEW."effectiveDate" := COALESCE(NEW."effectiveDate", NEW.effective_date);
  NEW.effective_date := COALESCE(NEW.effective_date, NEW."effectiveDate");

  NEW."targetDate" := COALESCE(NEW."targetDate", NEW.target_date);
  NEW.target_date := COALESCE(NEW.target_date, NEW."targetDate");

  NEW."submittedDate" := COALESCE(NEW."submittedDate", NEW.submitted_date);
  NEW.submitted_date := COALESCE(NEW.submitted_date, NEW."submittedDate");

  NEW."decisionDate" := COALESCE(NEW."decisionDate", NEW.decision_date);
  NEW.decision_date := COALESCE(NEW.decision_date, NEW."decisionDate");

  NEW."nnSupportPct" := COALESCE(NEW."nnSupportPct", NEW.nn_support_pct);
  NEW.nn_support_pct := COALESCE(NEW.nn_support_pct, NEW."nnSupportPct");

  NEW."dpSupportPct" := COALESCE(NEW."dpSupportPct", NEW.dp_support_pct);
  NEW.dp_support_pct := COALESCE(NEW.dp_support_pct, NEW."dpSupportPct");

  NEW."basePremium" := COALESCE(NEW."basePremium", NEW.base_premium);
  NEW.base_premium := COALESCE(NEW.base_premium, NEW."basePremium");

  NEW."nnSupportAmount" := COALESCE(NEW."nnSupportAmount", NEW.nn_support_amount);
  NEW.nn_support_amount := COALESCE(NEW.nn_support_amount, NEW."nnSupportAmount");

  NEW."dpSupportAmount" := COALESCE(NEW."dpSupportAmount", NEW.dp_support_amount);
  NEW.dp_support_amount := COALESCE(NEW.dp_support_amount, NEW."dpSupportAmount");

  NEW."discountAmount" := COALESCE(NEW."discountAmount", NEW.discount_amount);
  NEW.discount_amount := COALESCE(NEW.discount_amount, NEW."discountAmount");

  NEW."penaltyAmount" := COALESCE(NEW."penaltyAmount", NEW.penalty_amount);
  NEW.penalty_amount := COALESCE(NEW.penalty_amount, NEW."penaltyAmount");

  NEW."nextPayment" := COALESCE(NEW."nextPayment", NEW.next_payment);
  NEW.next_payment := COALESCE(NEW.next_payment, NEW."nextPayment");

  NEW."batchId" := COALESCE(NEW."batchId", NEW.batch_id);
  NEW.batch_id := COALESCE(NEW.batch_id, NEW."batchId");

  NEW."submissionBatch" := COALESCE(NEW."submissionBatch", NEW.submission_batch);
  NEW.submission_batch := COALESCE(NEW.submission_batch, NEW."submissionBatch");

  NEW."isSubmittedBHXH" := COALESCE(NEW."isSubmittedBHXH", NEW.is_submitted_bhxh, false);
  NEW.is_submitted_bhxh := COALESCE(NEW.is_submitted_bhxh, NEW."isSubmittedBHXH", false);

  -- 3. ĐỒNG BỘ 2 CHIỀU ĐẶC BIỆT GIỮA TEXT KỲ ĐÓNG VÀ CỘT CHUẨN DATE (from_month_date, to_month_date)
  -- Đồng bộ fromMonth <-> from_month
  NEW."fromMonth" := COALESCE(NEW."fromMonth", NEW.from_month);
  NEW.from_month := COALESCE(NEW.from_month, NEW."fromMonth");

  -- Đồng bộ toMonth <-> to_month
  NEW."toMonth" := COALESCE(NEW."toMonth", NEW.to_month);
  NEW.to_month := COALESCE(NEW.to_month, NEW."toMonth");

  -- Đồng bộ from_month_date <-> fromMonthDate
  NEW."fromMonthDate" := COALESCE(NEW."fromMonthDate", NEW.from_month_date);
  NEW.from_month_date := COALESCE(NEW.from_month_date, NEW."fromMonthDate");

  -- Đồng bộ to_month_date <-> toMonthDate
  NEW."toMonthDate" := COALESCE(NEW."toMonthDate", NEW.to_month_date);
  NEW.to_month_date := COALESCE(NEW.to_month_date, NEW."toMonthDate");

  -- Chuyển đổi 2 chiều giữa DATE và TEXT kỳ đóng:
  -- Nếu có from_month_date (DATE) -> Tự sinh from_month (YYYY-MM) và "fromMonth" (MM/YYYY)
  IF NEW.from_month_date IS NOT NULL AND (
    NEW.from_month IS NULL OR TRIM(NEW.from_month) = '' OR 
    (TG_OP = 'UPDATE' AND NEW.from_month_date IS DISTINCT FROM OLD.from_month_date AND NEW.from_month IS NOT DISTINCT FROM OLD.from_month)
  ) THEN
    NEW.from_month := to_char(NEW.from_month_date, 'YYYY-MM');
    NEW."fromMonth" := to_char(NEW.from_month_date, 'MM/YYYY');
  -- Nếu có from_month / "fromMonth" (TEXT) -> Gọi parse_month_str_to_date để điền vào from_month_date
  ELSIF COALESCE(NEW.from_month, NEW."fromMonth") IS NOT NULL AND TRIM(COALESCE(NEW.from_month, NEW."fromMonth")) != '' AND (
    NEW.from_month_date IS NULL OR
    (TG_OP = 'UPDATE' AND (NEW.from_month IS DISTINCT FROM OLD.from_month OR NEW."fromMonth" IS DISTINCT FROM OLD."fromMonth") AND NEW.from_month_date IS NOT DISTINCT FROM OLD.from_month_date)
  ) THEN
    v_f_date := public.parse_month_str_to_date(COALESCE(NEW.from_month, NEW."fromMonth"));
    IF v_f_date IS NOT NULL THEN
      NEW.from_month_date := v_f_date;
      NEW."fromMonthDate" := v_f_date;
    END IF;
  END IF;

  -- Nếu có to_month_date (DATE) -> Tự sinh to_month (YYYY-MM) và "toMonth" (MM/YYYY)
  IF NEW.to_month_date IS NOT NULL AND (
    NEW.to_month IS NULL OR TRIM(NEW.to_month) = '' OR 
    (TG_OP = 'UPDATE' AND NEW.to_month_date IS DISTINCT FROM OLD.to_month_date AND NEW.to_month IS NOT DISTINCT FROM OLD.to_month)
  ) THEN
    NEW.to_month := to_char(NEW.to_month_date, 'YYYY-MM');
    NEW."toMonth" := to_char(NEW.to_month_date, 'MM/YYYY');
  -- Nếu có to_month / "toMonth" (TEXT) -> Gọi parse_month_str_to_date để điền vào to_month_date
  ELSIF COALESCE(NEW.to_month, NEW."toMonth") IS NOT NULL AND TRIM(COALESCE(NEW.to_month, NEW."toMonth")) != '' AND (
    NEW.to_month_date IS NULL OR
    (TG_OP = 'UPDATE' AND (NEW.to_month IS DISTINCT FROM OLD.to_month OR NEW."toMonth" IS DISTINCT FROM OLD."toMonth") AND NEW.to_month_date IS NOT DISTINCT FROM OLD.to_month_date)
  ) THEN
    v_t_date := public.parse_month_str_to_date(COALESCE(NEW.to_month, NEW."toMonth"));
    IF v_t_date IS NOT NULL THEN
      NEW.to_month_date := v_t_date;
      NEW."toMonthDate" := v_t_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Tái kích hoạt trigger đảm bảo chạy trên cả INSERT và UPDATE
DROP TRIGGER IF EXISTS trg_sync_record_aliases ON public.records;
CREATE TRIGGER trg_sync_record_aliases
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_record_aliases();

-- 7. CẬP NHẬT VIEW v_records_unified BAO GỒM CÁC CỘT DATE MỚI
DROP VIEW IF EXISTS public.v_records_unified CASCADE;

CREATE OR REPLACE VIEW public.v_records_unified 
WITH (security_invoker = true) AS
SELECT 
    r.id,
    COALESCE(r."customerId", r."customer_id") AS customer_id,
    COALESCE(r."customerKey", r."customer_key") AS customer_key,
    COALESCE(r."staffId", r."staff_id") AS staff_id,
    COALESCE(r."batch_id", r."batchId") AS batch_id,
    COALESCE(r."submissionBatch", r."submission_batch") AS submission_batch,
    COALESCE(r."isSubmittedBHXH", r."is_submitted_bhxh", false) AS is_submitted_bhxh,
    COALESCE(r."submittedDate", r."submitted_date") AS submitted_date,
    COALESCE(r."decisionDate", r."decision_date") AS decision_date,
    r.type AS insurance_type,
    COALESCE(r."subType", r."sub_type") AS sub_type,
    COALESCE(r."actionType", r."action_type") AS action_type,
    r.name,
    r.cccd,
    r.phone,
    r.bhxh,
    COALESCE(r."oldBhxh", r."old_bhxh") AS old_bhxh,
    r.dob,
    r.gender,
    r.nation,
    r.address,
    r.wage,
    r.income,
    r.months,
    COALESCE(r."fromMonth", r."from_month") AS from_month,
    COALESCE(r."toMonth", r."to_month") AS to_month,
    COALESCE(r."from_month_date", r."fromMonthDate") AS from_month_date,
    COALESCE(r."to_month_date", r."toMonthDate") AS to_month_date,
    COALESCE(r."effectiveDate", r."effective_date") AS effective_date,
    COALESCE(r."targetDate", r."target_date") AS target_date,
    COALESCE(r."nextPayment", r."next_payment") AS next_payment,
    COALESCE(r."basePremium", r."base_premium") AS base_premium,
    COALESCE(r."nnSupportPct", r."nn_support_pct", 0) AS nn_support_pct,
    COALESCE(r."nnSupportAmount", r."nn_support_amount", 0) AS nn_support_amount,
    COALESCE(r."dpSupportPct", r."dp_support_pct", 0) AS dp_support_pct,
    COALESCE(r."dpSupportAmount", r."dp_support_amount", 0) AS dp_support_amount,
    COALESCE(r."discountAmount", r."discount_amount", 0) AS discount_amount,
    COALESCE(r."penaltyAmount", r."penalty_amount", 0) AS penalty_amount,
    r.amount,
    r.commission,
    r.status,
    COALESCE(r."paymentStatus", r."payment_status") AS payment_status,
    r.method,
    COALESCE(r."baseSalarySnapshot", r."base_salary_snapshot") AS base_salary_snapshot,
    COALESCE(r."povertyStandardSnapshot", r."poverty_standard_snapshot") AS poverty_standard_snapshot,
    COALESCE(r."policyVersionId", r."policy_version_id") AS policy_version_id,
    COALESCE(r."isAdjustment", r."is_adjustment", false) AS is_adjustment,
    COALESCE(r."originalRecordId", r."original_record_id") AS original_record_id,
    COALESCE(r."adjustmentReason", r."adjustment_reason") AS adjustment_reason,
    COALESCE(r."refundType", r."refund_type") AS refund_type,
    COALESCE(r."created_at", r."date", r.created_at) AS created_at,
    COALESCE(r."updated_at", r."date", r.updated_at) AS updated_at
FROM public.records r;

REVOKE ALL ON public.v_records_unified FROM anon, public;
GRANT SELECT ON public.v_records_unified TO authenticated, anon, service_role;
