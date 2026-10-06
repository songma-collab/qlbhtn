-- ======================================================================
-- MIGRATION: 20260915_standardize_batches_and_vietqr.sql
-- NÂNG CẤP ĐỢT NỘP BHXH (BATCH_YYYYMMDD_XX), VIETQR & PHÂN TRANG SERVER-SIDE
-- ======================================================================

-- 1. Bổ sung các cột phục vụ Đợt nộp & Khóa hồ sơ BHXH nếu chưa có
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "isSubmittedBHXH" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submissionBatch" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submittedDate" DATE;

-- 2. Cấu hình ngân hàng VietQR trên bảng settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_id" TEXT DEFAULT 'MB';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_account" TEXT DEFAULT '0868123456';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_owner" TEXT DEFAULT 'DAI LY THU BHXH SONG MA';

-- 3. Tạo Indexes hiệu năng cao cho Đợt nộp và Tra cứu đa điều kiện
CREATE INDEX IF NOT EXISTS idx_records_batch_perf 
  ON public.records ("submissionBatch", "isSubmittedBHXH") 
  WHERE "paymentStatus" != 'Đã hủy';

CREATE INDEX IF NOT EXISTS idx_records_vietqr_search 
  ON public.records ("type", "date" DESC, "paymentStatus");

CREATE INDEX IF NOT EXISTS idx_records_person_lookup 
  ON public.records ("bhxh", "cccd", "phone");

-- 4. Trigger bảo vệ hồ sơ đã chuyển Đợt nộp BHXH (Immutability Enforcer)
-- Ngăn chặn xóa hoặc sửa đổi nội dung hồ sơ khi đã được khóa vào Đợt nộp BHXH
CREATE OR REPLACE FUNCTION public.check_submitted_batch_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Nếu là hành động DELETE trên bản ghi đã nộp BHXH
  IF (TG_OP = 'DELETE') THEN
    IF OLD."isSubmittedBHXH" = TRUE THEN
      RAISE EXCEPTION 'Hồ sơ [ID %] đã nộp vào đợt BHXH (%). Không được phép xóa!', OLD.id, OLD."submissionBatch";
    END IF;
    RETURN OLD;
  END IF;

  -- Nếu là hành động UPDATE trên bản ghi đã nộp BHXH
  IF (TG_OP = 'UPDATE') THEN
    -- Cho phép Admin mở khóa (đổi isSubmittedBHXH từ TRUE về FALSE)
    IF OLD."isSubmittedBHXH" = TRUE AND NEW."isSubmittedBHXH" = FALSE THEN
      RETURN NEW;
    END IF;

    -- Nếu bản ghi đang bị khóa, chặn thay đổi các trường tài chính & thông tin định danh
    IF OLD."isSubmittedBHXH" = TRUE THEN
      IF NEW.amount != OLD.amount 
         OR NEW.wage != OLD.wage 
         OR COALESCE(NEW.months, 0) != COALESCE(OLD.months, 0)
         OR COALESCE(NEW."fromMonth", '') != COALESCE(OLD."fromMonth", '')
         OR COALESCE(NEW."toMonth", '') != COALESCE(OLD."toMonth", '')
         OR COALESCE(NEW.cccd, '') != COALESCE(OLD.cccd, '')
         OR COALESCE(NEW.bhxh, '') != COALESCE(OLD.bhxh, '')
         OR NEW.type != OLD.type THEN
        RAISE EXCEPTION 'Hồ sơ [ID %] đã khóa trong đợt nộp BHXH (%). Không được phép chỉnh sửa dữ liệu tài chính hoặc định danh!', OLD.id, OLD."submissionBatch";
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_submitted_batch_modifications ON public.records;
CREATE TRIGGER trigger_prevent_submitted_batch_modifications
BEFORE UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.check_submitted_batch_lock();

-- 5. RPC Phân trang và Tìm kiếm Server-side cho CRM Danh bạ Khách hàng (crm_search_customers)
-- Đảm bảo tốc độ truy vấn < 300ms với tập dữ liệu lớn
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
  phone TEXT,
  address TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  email TEXT,
  latest_record_id BIGINT,
  latest_date DATE,
  effective_date DATE,
  next_payment DATE,
  latest_amount NUMERIC,
  status TEXT,
  payment_status TEXT,
  notes TEXT,
  staff_id TEXT,
  total_contributions INT,
  total_amount_paid NUMERIC,
  household_id TEXT,
  members JSONB,
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

  -- Đếm tổng số bản ghi thỏa mãn điều kiện lọc
  SELECT COUNT(*) INTO v_count
  FROM public.customers c
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)))
    AND (p_status = 'all' OR c.status = p_status)
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
    AND (p_from_date IS NULL OR c.next_payment >= p_from_date)
    AND (p_to_date IS NULL OR c.next_payment <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(c.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.phone, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.address, '')) LIKE '%' || v_clean_search || '%'
    );

  -- Trả về dữ liệu phân trang
  RETURN QUERY
  SELECT 
    v_count AS total_count,
    c.id,
    c.customer_key,
    c.type,
    c.name,
    c.cccd,
    c.bhxh,
    c.phone,
    c.address,
    c.dob,
    c.gender,
    c.nation,
    c.email,
    c.latest_record_id,
    c.latest_date,
    c.effective_date,
    c.next_payment,
    c.latest_amount,
    c.status,
    c.payment_status,
    c.notes,
    c.staff_id,
    c.total_contributions,
    c.total_amount_paid,
    c.household_id,
    c.members,
    c.created_at,
    c.updated_at
  FROM public.customers c
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)))
    AND (p_status = 'all' OR c.status = p_status)
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
    AND (p_from_date IS NULL OR c.next_payment >= p_from_date)
    AND (p_to_date IS NULL OR c.next_payment <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(c.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.phone, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.address, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY c.next_payment ASC NULLS LAST, c.latest_date DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_search_customers TO anon, authenticated, service_role;

-- 6. RPC Phân trang và Tìm kiếm Hồ sơ Thu Tài chính (finance_search_records)
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
  type TEXT,
  wage NUMERIC,
  months INT,
  amount NUMERIC,
  status TEXT,
  payment_status TEXT,
  notes TEXT,
  staff_id TEXT,
  from_month TEXT,
  to_month TEXT,
  next_payment DATE,
  is_submitted_bhxh BOOLEAN,
  submission_batch TEXT,
  submitted_date DATE
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
    AND (p_payment_status = 'all' OR r."paymentStatus" = p_payment_status)
    AND (p_staff_id = 'all' OR r."staffId" = p_staff_id)
    AND (p_batch_code = 'all' OR r."submissionBatch" = p_batch_code)
    AND (p_from_date IS NULL OR r.date >= p_from_date)
    AND (p_to_date IS NULL OR r.date <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    );

  RETURN QUERY
  SELECT 
    v_count AS total_count,
    r.id,
    r.date,
    r.name,
    r.cccd,
    r.phone,
    r.address,
    r.bhxh,
    r.type,
    r.wage,
    r.months,
    r.amount,
    r.status,
    r."paymentStatus" AS payment_status,
    r.notes,
    r."staffId" AS staff_id,
    r."fromMonth" AS from_month,
    r."toMonth" AS to_month,
    r."nextPayment" AS next_payment,
    r."isSubmittedBHXH" AS is_submitted_bhxh,
    r."submissionBatch" AS submission_batch,
    r."submittedDate" AS submitted_date
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR r."paymentStatus" = p_payment_status)
    AND (p_staff_id = 'all' OR r."staffId" = p_staff_id)
    AND (p_batch_code = 'all' OR r."submissionBatch" = p_batch_code)
    AND (p_from_date IS NULL OR r.date >= p_from_date)
    AND (p_to_date IS NULL OR r.date <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY r.date DESC, r.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finance_search_records TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
