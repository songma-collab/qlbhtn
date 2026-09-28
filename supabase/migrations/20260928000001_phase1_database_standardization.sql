-- ======================================================================
-- MIGRATION: 20260928000001_phase1_database_standardization.sql
-- GIAI ĐOẠN 1: CHUẨN HÓA CSDL, TỐI ƯU HÓA SCHEMA & SERVER-SIDE QUERY
-- ======================================================================
-- Mục đích:
-- 1. Backfill 100% dữ liệu từ các cột camelCase sang snake_case trên bảng records.
-- 2. Tối ưu hóa RPC crm_search_customers & finance_search_records phục vụ Server-Side Pagination.
-- 3. Tạo GIN Trigram & Composite B-Tree Indexes cho tìm kiếm thời gian thực < 50ms.
-- 4. Chuẩn hóa quan hệ customer_participations và customers.
-- ======================================================================

-- 1. BẬT CÁC EXTENSION CẦN THIẾT NẾU CHƯA CÓ
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. ĐẢM BẢO ĐẦY ĐỦ CÁC CỘT CHUẨN SNAKE_CASE TRÊN BẢNG RECORDS
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Chờ thu tiền';
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS sub_type TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS support_pct NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS household_id TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS effective_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS target_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS from_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS to_month TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS base_premium NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_pct NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS nn_support_amount NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS dp_support_pct NUMERIC;
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
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS old_bhxh TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS customer_key TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS from_month_date DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS to_month_date DATE;

-- 3. BACKFILL DỮ LIỆU TỪ CÁC CỘT CAMELCASE SANG SNAKE_CASE (EXPAND & CONTRACT BƯỚC 1)
DO $$
BEGIN
  -- Tạm thời cho phép cập nhật khi chạy migration
  PERFORM set_config('app.is_admin_override', 'true', true);

  UPDATE public.records
  SET 
    staff_id = COALESCE(staff_id, "staffId"),
    payment_status = COALESCE(payment_status, "paymentStatus", 'Chờ thu tiền'),
    action_type = COALESCE(action_type, "actionType"),
    sub_type = COALESCE(sub_type, "subType"),
    support_pct = COALESCE(support_pct, "supportPct"),
    household_id = COALESCE(household_id, "householdId"),
    effective_date = COALESCE(effective_date, "effectiveDate"),
    target_date = COALESCE(target_date, "targetDate"),
    from_month = COALESCE(from_month, "fromMonth"),
    to_month = COALESCE(to_month, "toMonth"),
    base_premium = COALESCE(base_premium, "basePremium"),
    nn_support_pct = COALESCE(nn_support_pct, "nnSupportPct"),
    nn_support_amount = COALESCE(nn_support_amount, "nnSupportAmount"),
    dp_support_pct = COALESCE(dp_support_pct, "dpSupportPct"),
    dp_support_amount = COALESCE(dp_support_amount, "dpSupportAmount"),
    discount_amount = COALESCE(discount_amount, "discountAmount"),
    penalty_amount = COALESCE(penalty_amount, "penaltyAmount"),
    next_payment = COALESCE(next_payment, "nextPayment"),
    recv_name = COALESCE(recv_name, "recvName"),
    recv_phone = COALESCE(recv_phone, "recvPhone"),
    recv_address = COALESCE(recv_address, "recvAddress"),
    is_submitted_bhxh = COALESCE(is_submitted_bhxh, "isSubmittedBHXH", false),
    submission_batch = COALESCE(submission_batch, "submissionBatch"),
    submitted_date = COALESCE(submitted_date, "submittedDate"),
    base_salary_snapshot = COALESCE(base_salary_snapshot, "baseSalarySnapshot"),
    poverty_standard_snapshot = COALESCE(poverty_standard_snapshot, "povertyStandardSnapshot"),
    policy_version_id = COALESCE(policy_version_id, "policyVersionId"),
    applied_rates = COALESCE(applied_rates, "appliedRates"),
    is_adjustment = COALESCE(is_adjustment, "isAdjustment", false),
    original_record_id = COALESCE(original_record_id, "originalRecordId"),
    adjustment_reason = COALESCE(adjustment_reason, "adjustmentReason"),
    old_bhxh = COALESCE(old_bhxh, "oldBhxh")
  WHERE staff_id IS NULL OR payment_status IS NULL OR old_bhxh IS NULL;

  -- Đồng bộ các cột ngày tháng sang from_month_date và to_month_date nếu chưa có
  UPDATE public.records
  SET
    from_month_date = COALESCE(from_month_date, public.parse_month_str_to_date(from_month)),
    to_month_date = COALESCE(to_month_date, public.parse_month_str_to_date(to_month))
  WHERE from_month_date IS NULL AND from_month IS NOT NULL;
END $$;

-- 4. TỐI ƯU HÓA CÁC CHỈ MỤC INDEXES CHO SERVER-SIDE QUERY & PHÂN TRANG
-- 4.1. GIN Trigram cho Tìm kiếm Toàn văn tức thì trên records & customers
CREATE INDEX IF NOT EXISTS idx_records_search_trgm 
ON public.records USING gin ((
  COALESCE(name, '') || ' ' || 
  COALESCE(cccd, '') || ' ' || 
  COALESCE(bhxh, '') || ' ' || 
  COALESCE(old_bhxh, '') || ' ' || 
  COALESCE(phone, '')
) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_search_trgm 
ON public.customers USING gin ((
  COALESCE(name, '') || ' ' || 
  COALESCE(cccd, '') || ' ' || 
  COALESCE(bhxh, '') || ' ' || 
  COALESCE(old_bhxh, '') || ' ' || 
  COALESCE(phone, '')
) gin_trgm_ops);

-- 4.2. Composite B-Tree Indexes cho các bộ lọc thường dùng
CREATE INDEX IF NOT EXISTS idx_records_finance_filter 
ON public.records (type, payment_status, date DESC);

CREATE INDEX IF NOT EXISTS idx_records_staff_date 
ON public.records (staff_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_records_batch_lookup 
ON public.records (submission_batch, is_submitted_bhxh);

CREATE INDEX IF NOT EXISTS idx_customers_status_type 
ON public.customers (type, status, next_payment ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_customers_staff_lookup 
ON public.customers (staff_id, next_payment ASC NULLS LAST);

-- 5. NÂNG CẤP VÀ CHUẨN HÓA RPC TÌM KIẾM VÀ PHÂN TRANG CRM (crm_search_customers)
DROP FUNCTION IF EXISTS public.crm_search_customers(TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.crm_search_customers CASCADE;

CREATE OR REPLACE FUNCTION public.crm_search_customers(
  p_type TEXT DEFAULT 'ALL',
  p_search TEXT DEFAULT '',
  p_staff_id TEXT DEFAULT 'all',
  p_status TEXT DEFAULT 'all',
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  total_count BIGINT,
  id UUID,
  customer_key TEXT,
  type TEXT,
  name TEXT,
  cccd TEXT,
  bhxh TEXT,
  old_bhxh TEXT,
  phone TEXT,
  address TEXT,
  dob DATE,
  gender TEXT,
  status TEXT,
  payment_status TEXT,
  next_payment DATE,
  next_payment_bhxh DATE,
  next_payment_bhyt DATE,
  latest_date DATE,
  latest_amount NUMERIC,
  staff_id TEXT,
  total_contributions INT,
  total_amount_paid NUMERIC,
  has_bhxh BOOLEAN,
  has_bhyt BOOLEAN,
  prior_voluntary_months INT,
  prior_compulsory_months INT,
  prior_participation_notes TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_count BIGINT;
  v_clean_search TEXT;
BEGIN
  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.customers c
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)) OR c.type = 'CẢ HAI')
    AND (p_status = 'all' OR c.status = p_status)
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
    AND (p_from_date IS NULL OR c.next_payment >= p_from_date)
    AND (p_to_date IS NULL OR c.next_payment <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(c.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.old_bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.phone, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.address, '')) LIKE '%' || v_clean_search || '%'
    );

  RETURN QUERY
  SELECT 
    v_count AS total_count,
    c.id,
    c.customer_key,
    c.type,
    c.name,
    c.cccd,
    c.bhxh,
    c.old_bhxh,
    c.phone,
    c.address,
    c.dob,
    c.gender,
    c.status,
    c.payment_status,
    c.next_payment,
    c.next_payment_bhxh,
    c.next_payment_bhyt,
    c.latest_date,
    c.latest_amount,
    c.staff_id,
    c.total_contributions,
    c.total_amount_paid,
    c.has_bhxh,
    c.has_bhyt,
    c.prior_voluntary_months,
    c.prior_compulsory_months,
    c.prior_participation_notes,
    c.created_at,
    c.updated_at
  FROM public.customers c
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)) OR c.type = 'CẢ HAI')
    AND (p_status = 'all' OR c.status = p_status)
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
    AND (p_from_date IS NULL OR c.next_payment >= p_from_date)
    AND (p_to_date IS NULL OR c.next_payment <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(c.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.old_bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.phone, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.address, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY c.next_payment ASC NULLS LAST, c.latest_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 6. NÂNG CẤP VÀ CHUẨN HÓA RPC TÌM KIẾM VÀ PHÂN TRANG TÀI CHÍNH (finance_search_records)
DROP FUNCTION IF EXISTS public.finance_search_records(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.finance_search_records CASCADE;

CREATE OR REPLACE FUNCTION public.finance_search_records(
  p_type TEXT DEFAULT 'ALL',
  p_search TEXT DEFAULT '',
  p_staff_id TEXT DEFAULT 'all',
  p_payment_status TEXT DEFAULT 'all',
  p_batch_code TEXT DEFAULT 'all',
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  total_count BIGINT,
  id BIGINT,
  date DATE,
  name TEXT,
  cccd TEXT,
  phone TEXT,
  address TEXT,
  bhxh TEXT,
  old_bhxh TEXT,
  type TEXT,
  sub_type TEXT,
  wage NUMERIC,
  months INT,
  amount NUMERIC,
  commission NUMERIC,
  status TEXT,
  payment_status TEXT,
  notes TEXT,
  staff_id TEXT,
  from_month TEXT,
  to_month TEXT,
  next_payment DATE,
  is_submitted_bhxh BOOLEAN,
  submission_batch TEXT,
  submitted_date DATE,
  is_adjustment BOOLEAN,
  original_record_id BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_count BIGINT;
  v_clean_search TEXT;
BEGIN
  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR COALESCE(r.payment_status, r."paymentStatus") = p_payment_status)
    AND (p_staff_id = 'all' OR COALESCE(r.staff_id, r."staffId") = p_staff_id)
    AND (p_batch_code = 'all' OR COALESCE(r.submission_batch, r."submissionBatch") = p_batch_code)
    AND (p_from_date IS NULL OR r.date::DATE >= p_from_date)
    AND (p_to_date IS NULL OR r.date::DATE <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.old_bhxh, r."oldBhxh", '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    );

  RETURN QUERY
  SELECT 
    v_count AS total_count,
    r.id,
    r.date::DATE,
    r.name,
    r.cccd,
    r.phone,
    r.address,
    r.bhxh,
    COALESCE(r.old_bhxh, r."oldBhxh") AS old_bhxh,
    r.type,
    COALESCE(r.sub_type, r."subType") AS sub_type,
    r.wage,
    r.months,
    r.amount,
    r.commission,
    r.status,
    COALESCE(r.payment_status, r."paymentStatus") AS payment_status,
    r.notes,
    COALESCE(r.staff_id, r."staffId") AS staff_id,
    COALESCE(r.from_month, r."fromMonth") AS from_month,
    COALESCE(r.to_month, r."toMonth") AS to_month,
    COALESCE(r.next_payment, r."nextPayment") AS next_payment,
    COALESCE(r.is_submitted_bhxh, r."isSubmittedBHXH", false) AS is_submitted_bhxh,
    COALESCE(r.submission_batch, r."submissionBatch") AS submission_batch,
    COALESCE(r.submitted_date, r."submittedDate") AS submitted_date,
    COALESCE(r.is_adjustment, r."isAdjustment", false) AS is_adjustment,
    COALESCE(r.original_record_id, r."originalRecordId") AS original_record_id,
    r.created_at
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR COALESCE(r.payment_status, r."paymentStatus") = p_payment_status)
    AND (p_staff_id = 'all' OR COALESCE(r.staff_id, r."staffId") = p_staff_id)
    AND (p_batch_code = 'all' OR COALESCE(r.submission_batch, r."submissionBatch") = p_batch_code)
    AND (p_from_date IS NULL OR r.date::DATE >= p_from_date)
    AND (p_to_date IS NULL OR r.date::DATE <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.old_bhxh, r."oldBhxh", '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY r.date DESC, r.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 7. CẤP QUYỀN THỰC THI CHO CÁC RPC MỚI
GRANT EXECUTE ON FUNCTION public.crm_search_customers(TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_search_records(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated, service_role;
