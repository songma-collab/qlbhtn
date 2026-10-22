-- ======================================================================
-- BẢN VÁ BẢO MẬT P0: PHÂN QUYỀN RBAC, SIẾT CHẶT RPC & BẢO VỆ PII CÔNG DÂN
-- File: supabase/migrations/20261022000001_fix_security_p0.sql
-- Áp dụng cho: qlkh-bhxh-bhyt
-- Mục đích:
--   1. Thu hồi quyền execute từ anon trên các RPC public để bắt buộc đi qua Edge Function.
--   2. Cập nhật RLS bảng customers và staff (chống nhân viên đọc/sửa dữ liệu của nhau).
--   3. Cưỡng chế kiểm tra quyền is_manager_or_admin() / staff_id trong toàn bộ RPC SECURITY DEFINER.
--   4. Che giấu mặt nạ PII trong public_get_renewal_info khi tra cứu từ cổng công khai.
--   5. Chống giả mạo định danh user_id trong auditlogs.
-- ======================================================================

-- ----------------------------------------------------------------------
-- PHẦN 1: THU HỒI QUYỀN THỰC THI TRỰC TIẾP CỦA ANON (SEC-04)
-- Mọi truy cập công khai bắt buộc phải qua Edge Function có Turnstile CAPTCHA
-- ----------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.public_register_customer(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_customer_exists(TEXT) FROM anon;

-- Đảm bảo service_role và authenticated vẫn thực thi bình thường
GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_exists(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) TO service_role, authenticated;


-- ----------------------------------------------------------------------
-- PHẦN 2: SIẾT CHẶT ROW LEVEL SECURITY (RLS) BẢNG CUSTOMERS & STAFF (SEC-02)
-- ----------------------------------------------------------------------

-- 2.1. Bảng CUSTOMERS: Thay thế policy "customers_manage_authenticated" mở rộng quá mức
DROP POLICY IF EXISTS "customers_manage_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

-- Nhân viên chỉ đọc khách hàng do mình phụ trách hoặc khách hàng chưa gán; Admin/Quản lý đọc toàn bộ
CREATE POLICY "customers_select_policy" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin() 
    OR staff_id = public.current_staff_id() 
    OR staff_id IS NULL
  );

-- Nhân viên đang hoạt động được phép tạo khách hàng
CREATE POLICY "customers_insert_policy" ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_staff()
  );

-- Nhân viên chỉ sửa khách hàng do mình phụ trách; Admin/Quản lý sửa toàn bộ
CREATE POLICY "customers_update_policy" ON public.customers
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin() 
    OR staff_id = public.current_staff_id()
  )
  WITH CHECK (
    public.is_manager_or_admin() 
    OR staff_id = public.current_staff_id()
  );

-- Chỉ Admin và Quản lý mới được phép xóa khách hàng
CREATE POLICY "customers_delete_policy" ON public.customers
  FOR DELETE TO authenticated
  USING (
    public.is_manager_or_admin()
  );

-- 2.2. Bảng STAFF: Gỡ bỏ điều kiện "OR status = 'Đang hoạt động'" làm lộ CCCD/SĐT nhân sự khác
DROP POLICY IF EXISTS "staff_read_authenticated" ON public.staff;
CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin() 
    OR auth_user_id = auth.uid()
    OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
  );


-- ----------------------------------------------------------------------
-- PHẦN 3: TỐI ƯU HÀM TÍNH HOA HỒNG SANG STABLE (LOẠI BỎ N+1)
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_commission_rates_for_date(DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.get_commission_rates_for_date(p_date DATE)
RETURNS TABLE (
  comm_bhxh_new NUMERIC,
  comm_bhxh_renew NUMERIC,
  comm_bhyt_new NUMERIC,
  comm_bhyt_renew NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_d DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
  -- Tìm chính sách hoa hồng hiệu lực tại thời điểm p_date
  SELECT 
    COALESCE((value->>'comm_bhxh_new')::numeric, (value->>'bhxh_new')::numeric, 17.5) as b_new,
    COALESCE((value->>'comm_bhxh_renew')::numeric, (value->>'bhxh_renew')::numeric, 8.75) as b_renew,
    COALESCE((value->>'comm_bhyt_new')::numeric, (value->>'bhyt_new')::numeric, 3.0) as y_new,
    COALESCE((value->>'comm_bhyt_renew')::numeric, (value->>'bhyt_renew')::numeric, 2.5) as y_renew
  INTO v_rec
  FROM public.policies
  WHERE parameter_type = 'commission_rate'
    AND is_active = true
    AND effective_date <= v_d
  ORDER BY effective_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_rec.b_new, v_rec.b_renew, v_rec.y_new, v_rec.y_renew;
    RETURN;
  END IF;

  -- Fallback tra cứu trong settings
  SELECT 
    COALESCE(s.comm_bhxh_new, 17.5) AS b_new,
    COALESCE(s.comm_bhxh_renew, 8.75) AS b_renew,
    COALESCE(s.comm_bhyt_new, 3.0) AS y_new,
    COALESCE(s.comm_bhyt_renew, 2.5) AS y_renew
  INTO v_rec
  FROM public.settings s
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_rec.b_new, v_rec.b_renew, v_rec.y_new, v_rec.y_renew;
    RETURN;
  END IF;

  RETURN QUERY SELECT 17.5::numeric, 8.75::numeric, 3.0::numeric, 2.5::numeric;
END;
$$;


-- ----------------------------------------------------------------------
-- PHẦN 4: VÁ CÁC RPC SECURITY DEFINER (SEC-01)
-- ----------------------------------------------------------------------

-- 4.1. RPC crm_search_customers: Cưỡng chế phân quyền theo staff_id
DROP FUNCTION IF EXISTS public.crm_search_customers(TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) CASCADE;
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
  from_month TEXT,
  to_month TEXT,
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
  v_effective_staff_id TEXT;
BEGIN
  -- Kiểm tra quyền đăng nhập nhân sự
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Tài khoản không hợp lệ hoặc đã bị khóa.' USING ERRCODE = '42501';
  END IF;

  -- Nếu không phải Quản lý/Admin, bắt buộc lọc theo staff_id của chính mình
  IF public.is_manager_or_admin() THEN
    v_effective_staff_id := p_staff_id;
  ELSE
    v_effective_staff_id := public.current_staff_id();
  END IF;

  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.customers c
  LEFT JOIN public.records r ON c.latest_record_id = r.id
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)) OR c.type = 'CẢ HAI')
    AND (p_status = 'all' OR c.status = p_status)
    AND (v_effective_staff_id = 'all' OR c.staff_id = v_effective_staff_id)
    AND (p_from_date IS NULL OR COALESCE(c.next_payment, r.next_payment) >= p_from_date)
    AND (p_to_date IS NULL OR COALESCE(c.next_payment, r.next_payment) <= p_to_date)
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
    COALESCE(c.payment_status, r.payment_status) AS payment_status,
    COALESCE(c.next_payment, r.next_payment) AS next_payment,
    c.next_payment_bhxh,
    c.next_payment_bhyt,
    COALESCE(c.latest_date, r.date::date) AS latest_date,
    COALESCE(c.latest_amount, r.amount) AS latest_amount,
    c.staff_id,
    c.total_contributions,
    c.total_amount_paid,
    c.has_bhxh,
    c.has_bhyt,
    c.prior_voluntary_months,
    c.prior_compulsory_months,
    c.prior_participation_notes,
    COALESCE(c.from_month, r.from_month) AS from_month,
    COALESCE(c.to_month, r.to_month) AS to_month,
    c.created_at,
    c.updated_at
  FROM public.customers c
  LEFT JOIN public.records r ON c.latest_record_id = r.id
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)) OR c.type = 'CẢ HAI')
    AND (p_status = 'all' OR c.status = p_status)
    AND (v_effective_staff_id = 'all' OR c.staff_id = v_effective_staff_id)
    AND (p_from_date IS NULL OR COALESCE(c.next_payment, r.next_payment) >= p_from_date)
    AND (p_to_date IS NULL OR COALESCE(c.next_payment, r.next_payment) <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(c.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.old_bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.phone, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(c.address, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY COALESCE(c.latest_date, r.date::date) DESC NULLS LAST, COALESCE(c.next_payment, r.next_payment) ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4.2. RPC finance_search_records: Cưỡng chế phân quyền theo staff_id
DROP FUNCTION IF EXISTS public.finance_search_records(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) CASCADE;
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
  action_type TEXT,
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
  v_effective_staff_id TEXT;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Tài khoản không hợp lệ hoặc đã bị khóa.' USING ERRCODE = '42501';
  END IF;

  IF public.is_manager_or_admin() THEN
    v_effective_staff_id := p_staff_id;
  ELSE
    v_effective_staff_id := public.current_staff_id();
  END IF;

  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR r.payment_status = p_payment_status)
    AND (v_effective_staff_id = 'all' OR r.staff_id = v_effective_staff_id)
    AND (p_batch_code = 'all' OR r.submission_batch = p_batch_code)
    AND (p_from_date IS NULL OR r.date::DATE >= p_from_date)
    AND (p_to_date IS NULL OR r.date::DATE <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.old_bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    );

  RETURN QUERY
  SELECT 
    v_count AS total_count,
    r.id,
    r.date::DATE AS date,
    r.name,
    r.cccd,
    r.phone,
    r.address,
    r.bhxh,
    r.old_bhxh,
    r.type,
    r.sub_type,
    r.action_type,
    r.wage,
    r.months,
    r.amount,
    r.commission,
    r.status,
    r.payment_status,
    r.notes,
    r.staff_id,
    r.from_month,
    r.to_month,
    r.next_payment,
    COALESCE(r.is_submitted_bhxh, false) AS is_submitted_bhxh,
    r.submission_batch,
    r.submitted_date,
    COALESCE(r.is_adjustment, false) AS is_adjustment,
    r.original_record_id,
    r.created_at
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR r.payment_status = p_payment_status)
    AND (v_effective_staff_id = 'all' OR r.staff_id = v_effective_staff_id)
    AND (p_batch_code = 'all' OR r.submission_batch = p_batch_code)
    AND (p_from_date IS NULL OR r.date::DATE >= p_from_date)
    AND (p_to_date IS NULL OR r.date::DATE <= p_to_date)
    AND (
      v_clean_search = '' 
      OR LOWER(r.name) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.cccd, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.old_bhxh, '')) LIKE '%' || v_clean_search || '%'
      OR LOWER(COALESCE(r.phone, '')) LIKE '%' || v_clean_search || '%'
    )
  ORDER BY COALESCE(r.date, r.created_at) DESC, r.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 4.3. RPC get_admin_finance_stats: Bắt buộc quyền Quản lý/Admin hoặc giới hạn theo nhân viên
DROP FUNCTION IF EXISTS public.get_admin_finance_stats(text, text, text, text, text, text, text, text, text) CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_finance_stats(
  filter_type text DEFAULT 'all',
  filter_staff text DEFAULT 'all',
  filter_period text DEFAULT 'all',
  start_date text DEFAULT '',
  end_date text DEFAULT '',
  search_txt text DEFAULT '',
  action_type_filter text DEFAULT 'all',
  payment_status_filter text DEFAULT 'all',
  filter_submitted text DEFAULT 'all'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  total_revenue numeric;
  total_pending numeric;
  total_commission numeric;
  v_effective_staff text;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Yêu cầu xác thực tài khoản.' USING ERRCODE = '42501';
  END IF;

  IF public.is_manager_or_admin() THEN
    v_effective_staff := filter_staff;
  ELSE
    v_effective_staff := public.current_staff_id();
  END IF;

  SELECT 
    COALESCE(SUM(CASE WHEN r.payment_status = 'Đã thu tiền' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.payment_status = 'Chờ thanh toán' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(
      CASE 
        WHEN r.payment_status = 'Đã thu tiền' AND r.commission IS NOT NULL THEN r.commission
        WHEN r.payment_status = 'Đã thu tiền' AND r.type = 'BHXH' AND (r.action_type = 'Đăng ký mới' OR r.action_type ILIKE '%mới%' OR r.action_type = 'new') 
          THEN r.amount * (rates.comm_bhxh_new / 100.0)
        WHEN r.payment_status = 'Đã thu tiền' AND r.type = 'BHXH' 
          THEN r.amount * (rates.comm_bhxh_renew / 100.0)
        WHEN r.payment_status = 'Đã thu tiền' AND r.type = 'BHYT' AND (r.action_type = 'Đăng ký mới' OR r.action_type ILIKE '%mới%' OR r.action_type = 'new') 
          THEN r.amount * (rates.comm_bhyt_new / 100.0)
        WHEN r.payment_status = 'Đã thu tiền' AND r.type = 'BHYT' 
          THEN r.amount * (rates.comm_bhyt_renew / 100.0)
        ELSE 0
      END
    ), 0)
  INTO total_revenue, total_pending, total_commission
  FROM public.records r
  CROSS JOIN LATERAL public.get_commission_rates_for_date(public.safe_cast_date(r.date)) rates
  WHERE (
      (payment_status_filter = 'all' AND r.payment_status IN ('Đã thu tiền', 'Chờ thanh toán'))
      OR (payment_status_filter = 'paid' AND r.payment_status = 'Đã thu tiền')
      OR (payment_status_filter = 'pending' AND r.payment_status = 'Chờ thanh toán')
      OR (r.payment_status = payment_status_filter)
    )
    AND r.action_type != 'Nhập từ Excel'
    AND (filter_type = 'all' OR r.type = filter_type)
    AND (v_effective_staff = 'all' OR r.staff_id = v_effective_staff)
    AND (action_type_filter = 'all' OR r.action_type = action_type_filter)
    AND (search_txt = '' OR r.name ILIKE '%' || search_txt || '%' OR r.cccd ILIKE '%' || search_txt || '%' OR r.bhxh ILIKE '%' || search_txt || '%')
    AND (filter_period = 'all' OR start_date = '' OR end_date = '' OR (public.safe_cast_date(r.date) >= public.safe_cast_date(start_date) AND public.safe_cast_date(r.date) <= public.safe_cast_date(end_date)))
    AND (
      filter_submitted = 'all' 
      OR (filter_submitted = 'submitted' AND r.is_submitted_bhxh = true)
      OR (filter_submitted = 'unsubmitted' AND (r.is_submitted_bhxh = false OR r.is_submitted_bhxh IS NULL))
      OR (filter_submitted LIKE 'batch_%' AND r.is_submitted_bhxh = true AND r.submission_batch = SUBSTRING(filter_submitted FROM 7))
    );

  RETURN json_build_object(
    'totalRev', total_revenue,
    'total_revenue', total_revenue,
    'totalPending', total_pending,
    'total_pending', total_pending,
    'totalComm', total_commission,
    'total_commission', total_commission
  );
END;
$$;

-- 4.4. RPC get_admin_dashboard_stats: Giới hạn theo quyền nhân viên
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total_revenue NUMERIC := 0;
  v_total_pending NUMERIC := 0;
  v_total_records INT := 0;
  v_total_customers INT := 0;
  v_effective_staff_id TEXT;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Yêu cầu xác thực tài khoản.' USING ERRCODE = '42501';
  END IF;

  IF public.is_manager_or_admin() THEN
    v_effective_staff_id := p_staff_id;
  ELSE
    v_effective_staff_id := public.current_staff_id();
  END IF;

  SELECT 
    COALESCE(SUM(CASE WHEN r.payment_status = 'Đã thu tiền' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.payment_status = 'Chờ thanh toán' THEN r.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_pending, v_total_records
  FROM public.records r
  WHERE (v_effective_staff_id IS NULL OR r.staff_id = v_effective_staff_id)
    AND r.payment_status != 'Đã hủy';

  SELECT COUNT(*) INTO v_total_customers
  FROM public.customers c
  WHERE (v_effective_staff_id IS NULL OR c.staff_id = v_effective_staff_id);

  RETURN jsonb_build_object(
    'totalRevenue', v_total_revenue,
    'total_revenue', v_total_revenue,
    'totalPending', v_total_pending,
    'total_pending', v_total_pending,
    'totalRecords', v_total_records,
    'total_records', v_total_records,
    'totalCustomers', v_total_customers,
    'total_customers', v_total_customers
  );
END;
$$;

-- 4.5. RPC delete_record_safe: Chặn nhân viên xóa hồ sơ của nhau
DROP FUNCTION IF EXISTS public.delete_record_safe(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_record_safe(p_record_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_user_name TEXT;
  v_cust_key TEXT;
  v_remaining_records INT := 0;
  v_is_mgr_or_admin BOOLEAN := false;
  v_deleted_count INT := 0;
  v_my_staff_id TEXT;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Tài khoản không hợp lệ hoặc đã bị khóa.' USING ERRCODE = '42501';
  END IF;

  v_is_mgr_or_admin := public.is_manager_or_admin();
  v_my_staff_id := public.current_staff_id();

  SELECT id, name, type, staff_id,
         COALESCE(is_submitted_bhxh, false) AS is_submitted,
         payment_status AS p_status,
         COALESCE(customer_key, public.generate_customer_key(type, bhxh, cccd, name, phone)) AS c_key,
         cccd, bhxh, phone
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ giao dịch #' || p_record_id);
  END IF;

  -- 1. Chặn tuyệt đối xóa hồ sơ đã nộp BHXH
  IF v_rec.is_submitted = true THEN
    RAISE EXCEPTION 'Hồ sơ "%" (Mã #%) ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', v_rec.name, p_record_id
      USING ERRCODE = '23514';
  END IF;

  -- 2. Kiểm tra quyền sở hữu hồ sơ
  IF NOT v_is_mgr_or_admin THEN
    IF v_rec.staff_id IS NOT NULL AND v_rec.staff_id != v_my_staff_id THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa hồ sơ #% của nhân viên khác!', p_record_id
        USING ERRCODE = '42501';
    END IF;

    IF v_rec.p_status = 'Đã thu tiền' THEN
      RAISE EXCEPTION 'Giao dịch #% của "%" đã thu tiền. Chỉ Quản lý/Admin mới có quyền xóa!', p_record_id, v_rec.name
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.records WHERE id = p_record_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không thể xóa hồ sơ #' || p_record_id || ' từ CSDL.');
  END IF;

  -- Đồng bộ customers: Xóa khách hàng nếu không còn giao dịch
  v_cust_key := v_rec.c_key;
  IF v_cust_key IS NOT NULL AND TRIM(v_cust_key) != '' THEN
    SELECT COUNT(*) INTO v_remaining_records
    FROM public.records
    WHERE customer_key = v_cust_key 
       OR (v_rec.cccd IS NOT NULL AND TRIM(v_rec.cccd) != '' AND cccd = v_rec.cccd)
       OR (v_rec.bhxh IS NOT NULL AND TRIM(v_rec.bhxh) != '' AND bhxh = v_rec.bhxh);

    IF v_remaining_records = 0 THEN
      DELETE FROM public.customers
      WHERE customer_key = v_cust_key 
         OR (v_rec.cccd IS NOT NULL AND TRIM(v_rec.cccd) != '' AND cccd = v_rec.cccd)
         OR (v_rec.bhxh IS NOT NULL AND TRIM(v_rec.bhxh) != '' AND bhxh = v_rec.bhxh);
    END IF;
  END IF;

  v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Cán bộ thu');
  BEGIN
    INSERT INTO public.auditlogs (action, details, user_id, user_name, timestamp)
    VALUES (
      'Xóa giao dịch',
      'Đã xóa giao dịch #' || p_record_id || ' (' || COALESCE(v_rec.type, 'BHXH/BHYT') || ' - ' || COALESCE(v_rec.p_status, 'Chờ thanh toán') || ') của khách hàng ' || COALESCE(v_rec.name, ''),
      COALESCE(auth.uid()::TEXT, 'system'),
      v_user_name,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã xóa an toàn giao dịch #' || p_record_id || ' và đồng bộ lại danh bạ khách hàng.'
  );
END;
$$;

-- 4.6. RPC bulk_delete_records_safe: Kiểm tra quyền sở hữu cho từng bản ghi
DROP FUNCTION IF EXISTS public.bulk_delete_records_safe(BIGINT[]) CASCADE;
CREATE OR REPLACE FUNCTION public.bulk_delete_records_safe(p_record_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INT := 0;
  v_user_name TEXT;
  v_submitted_count INT := 0;
  v_paid_non_admin_count INT := 0;
  v_foreign_staff_count INT := 0;
  v_my_staff_id TEXT;
  v_is_mgr_or_admin BOOLEAN := false;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Access Denied: Tài khoản không hợp lệ hoặc đã bị khóa.' USING ERRCODE = '42501';
  END IF;

  v_is_mgr_or_admin := public.is_manager_or_admin();
  v_my_staff_id := public.current_staff_id();

  SELECT COUNT(*) INTO v_submitted_count
  FROM public.records
  WHERE id = ANY(p_record_ids)
    AND is_submitted_bhxh = true;

  IF v_submitted_count > 0 THEN
    RAISE EXCEPTION 'Có % hồ sơ trong danh sách ĐÃ ĐƯỢC CHUYỂN BHXH. Không thể xóa!', v_submitted_count
      USING ERRCODE = '23514';
  END IF;

  IF NOT v_is_mgr_or_admin THEN
    -- Kiểm tra hồ sơ đã thu tiền
    SELECT COUNT(*) INTO v_paid_non_admin_count
    FROM public.records
    WHERE id = ANY(p_record_ids)
      AND payment_status = 'Đã thu tiền';

    IF v_paid_non_admin_count > 0 THEN
      RAISE EXCEPTION 'Có % hồ sơ đã thu tiền. Nhân viên không được phép xóa giao dịch đã thu tiền!', v_paid_non_admin_count
        USING ERRCODE = '42501';
    END IF;

    -- Kiểm tra hồ sơ của nhân viên khác
    SELECT COUNT(*) INTO v_foreign_staff_count
    FROM public.records
    WHERE id = ANY(p_record_ids)
      AND staff_id IS NOT NULL 
      AND staff_id != v_my_staff_id;

    IF v_foreign_staff_count > 0 THEN
      RAISE EXCEPTION 'Có % hồ sơ không thuộc quyền phụ trách của bạn. Bạn không thể xóa hồ sơ của nhân viên khác!', v_foreign_staff_count
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.records WHERE id = ANY(p_record_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Cán bộ thu');
  BEGIN
    INSERT INTO public.auditlogs (action, details, user_id, user_name, timestamp)
    VALUES (
      'Xóa giao dịch hàng loạt',
      'Đã xóa hàng loạt ' || v_deleted_count || ' giao dịch (IDs: ' || array_to_string(p_record_ids, ', ') || ')',
      COALESCE(auth.uid()::TEXT, 'system'),
      v_user_name,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted_count, 'message', 'Đã xóa hàng loạt giao dịch thành công');
END;
$$;

-- 4.7. RPC delete_customer_cascade: Chỉ Quản lý/Admin được xóa
DROP FUNCTION IF EXISTS public.delete_customer_cascade(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(p_customer_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_records_count INT := 0;
    v_cust_name TEXT;
    v_cust_id UUID;
    v_has_submitted INT := 0;
BEGIN
    IF NOT public.is_manager_or_admin() THEN
      RAISE EXCEPTION 'Chỉ Quản lý hoặc Admin mới có quyền xóa khách hàng liên đới khỏi hệ thống!'
        USING ERRCODE = '42501';
    END IF;

    SELECT id, name INTO v_cust_id, v_cust_name
    FROM public.customers
    WHERE customer_key = p_customer_key
       OR cccd = p_customer_key
       OR bhxh = p_customer_key
       OR phone = p_customer_key
    LIMIT 1;

    SELECT COUNT(*) INTO v_has_submitted
    FROM public.records
    WHERE (customer_key = p_customer_key
           OR (v_cust_id IS NOT NULL AND customer_id = v_cust_id)
           OR cccd = p_customer_key
           OR bhxh = p_customer_key
           OR phone = p_customer_key
           OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key)
      AND is_submitted_bhxh = true;

    IF v_has_submitted > 0 THEN
        RAISE EXCEPTION 'Khách hàng "%" có hồ sơ ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', COALESCE(v_cust_name, p_customer_key)
            USING ERRCODE = '23514';
    END IF;

    WITH deleted_rows AS (
        DELETE FROM public.records
        WHERE customer_key = p_customer_key
           OR (v_cust_id IS NOT NULL AND customer_id = v_cust_id)
           OR cccd = p_customer_key
           OR bhxh = p_customer_key
           OR phone = p_customer_key
           OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_records_count FROM deleted_rows;

    DELETE FROM public.customers
    WHERE customer_key = p_customer_key
       OR id = v_cust_id
       OR cccd = p_customer_key
       OR bhxh = p_customer_key
       OR phone = p_customer_key;

    RETURN jsonb_build_object(
        'success', true,
        'customer_name', v_cust_name,
        'deleted_records_count', v_deleted_records_count,
        'message', format('Đã xóa thành công khách hàng "%s" cùng %s hồ sơ liên quan.', COALESCE(v_cust_name, p_customer_key), v_deleted_records_count)
    );
END;
$$;

-- 4.8. RPC public_get_renewal_info: Che giấu mặt nạ PII khi gọi từ cổng công khai
DROP FUNCTION IF EXISTS public.public_get_renewal_info(TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.public_get_renewal_info(p_code TEXT, p_type TEXT)
RETURNS TABLE (
  name TEXT,
  cccd TEXT,
  phone TEXT,
  bhxh TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  email TEXT,
  address TEXT,
  type TEXT,
  method TEXT,
  months INTEGER,
  income NUMERIC,
  from_month TEXT,
  to_month TEXT,
  notes TEXT,
  recv_name TEXT,
  recv_phone TEXT,
  recv_address TEXT,
  members JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_authenticated BOOLEAN := false;
BEGIN
  IF auth.role() NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'Access denied: Chức năng gia hạn nhanh chỉ khả dụng qua cổng dịch vụ đã xác thực bảo mật.'
      USING ERRCODE = '42501';
  END IF;

  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  PERFORM public.enforce_public_rpc_rate_limit('public_get_renewal_info', 15, INTERVAL '1 hour');

  v_is_authenticated := (auth.role() = 'authenticated');

  RETURN QUERY
  SELECT 
    CASE 
      WHEN v_is_authenticated THEN r.name
      WHEN LENGTH(TRIM(r.name)) > 4 THEN 
        split_part(TRIM(r.name), ' ', 1) || ' *** ' || reverse(split_part(reverse(TRIM(r.name)), ' ', 1))
      ELSE '***'
    END AS name,
    CASE WHEN v_is_authenticated THEN r.cccd ELSE public.mask_cccd_pii(r.cccd) END AS cccd,
    CASE WHEN v_is_authenticated THEN r.phone ELSE public.mask_phone_pii(r.phone) END AS phone,
    r.bhxh,
    r.dob,
    r.gender,
    r.nation,
    CASE WHEN v_is_authenticated THEN r.email ELSE NULL END AS email,
    CASE WHEN v_is_authenticated THEN r.address ELSE '*** Bảo mật theo quy định ***' END AS address,
    r.type,
    r.method,
    r.months,
    r.income,
    r.from_month,
    r.to_month,
    r.notes,
    r.recv_name,
    CASE WHEN v_is_authenticated THEN r.recv_phone ELSE public.mask_phone_pii(r.recv_phone) END AS recv_phone,
    CASE WHEN v_is_authenticated THEN r.recv_address ELSE NULL END AS recv_address,
    CASE WHEN v_is_authenticated THEN r.members ELSE '[]'::jsonb END AS members
  FROM public.records r
  WHERE r.payment_status != 'Đã hủy'
    AND r.type = UPPER(TRIM(p_type))
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY COALESCE(r.updated_at, r.created_at, r.date) DESC, r.date DESC, r.id DESC
  LIMIT 1;
END;
$$;


-- ----------------------------------------------------------------------
-- PHẦN 5: BẢO VỆ ĐỊNH DANH TRONG AUDITLOGS (CHỐNG GIẢ MẠO USER_ID)
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.enforce_auditlog_identity() CASCADE;
CREATE OR REPLACE FUNCTION public.enforce_auditlog_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Nếu có phiên đăng nhập xác thực qua Supabase Auth, cưỡng chế ghi đúng auth.uid()
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid()::TEXT;
  END IF;

  IF NEW.timestamp IS NULL THEN
    NEW.timestamp := NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_auditlog_identity ON public.auditlogs;
CREATE TRIGGER trigger_enforce_auditlog_identity
BEFORE INSERT ON public.auditlogs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_auditlog_identity();

-- ======================================================================
-- KẾT THÚC BẢN VÁ BẢO MẬT P0
-- ======================================================================
