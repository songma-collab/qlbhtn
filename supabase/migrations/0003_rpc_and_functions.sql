-- ======================================================================
-- NỀN TẢNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ
-- BASELINE MIGRATION 0003: STORED PROCEDURES & RPC API (100% SNAKE_CASE)
-- ======================================================================
-- Mục đích: Chuẩn hóa 22 Stored Procedures / RPC phục vụ Server-Side
-- Xử lý an toàn, phân trang CRM, quản lý tài chính, kiểm toán và dịch vụ công.
-- Naming Convention: Toàn bộ tham số (IN params) và truy vấn SQL dùng 100% snake_case.
-- ======================================================================

-- 1. HÀM TIỆN ÍCH CHE DẤU THÔNG TIN PII (NGHỊ ĐỊNH 13/2023/NĐ-CP)
-- ======================================================================

DROP FUNCTION IF EXISTS public.mask_cccd_pii(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.mask_cccd_pii(val TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN val IS NULL OR LENGTH(TRIM(val)) < 6 THEN '******'
    ELSE SUBSTRING(TRIM(val) FROM 1 FOR 3) || '******' || SUBSTRING(TRIM(val) FROM LENGTH(TRIM(val)) - 2 FOR 3)
  END;
$$;

DROP FUNCTION IF EXISTS public.mask_phone_pii(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.mask_phone_pii(val TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN val IS NULL OR LENGTH(TRIM(val)) < 6 THEN '******'
    ELSE SUBSTRING(TRIM(val) FROM 1 FOR 3) || '****' || SUBSTRING(TRIM(val) FROM LENGTH(TRIM(val)) - 2 FOR 3)
  END;
$$;

DROP FUNCTION IF EXISTS public.mask_bhxh_pii(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.mask_bhxh_pii(val TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE 
    WHEN val IS NULL OR LENGTH(TRIM(val)) < 6 THEN '******'
    ELSE SUBSTRING(TRIM(val) FROM 1 FOR 3) || '****' || SUBSTRING(TRIM(val) FROM LENGTH(TRIM(val)) - 2 FOR 3)
  END;
$$;

-- ======================================================================
-- 2. HÀM TIỆN ÍCH NGÀY THÁNG, TÍNH TOÁN & KHÓA SỔ
-- ======================================================================

-- 2.1. Ép kiểu an toàn chuỗi sang DATE
DROP FUNCTION IF EXISTS public.safe_cast_date(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.safe_cast_date(p_date TEXT)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_date IS NULL OR p_date = '' THEN RETURN NULL; END IF;
  RETURN p_date::date;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.safe_cast_date(TIMESTAMPTZ) CASCADE;
CREATE OR REPLACE FUNCTION public.safe_cast_date(p_date TIMESTAMPTZ)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN p_date::date;
END;
$$;

-- 2.2. Chuyển đổi chuỗi kỳ đóng (MM/YYYY hoặc YYYY-MM) sang DATE (ngày mùng 1 đầu tháng)
DROP FUNCTION IF EXISTS public.parse_month_str_to_date(TEXT) CASCADE;
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

DROP FUNCTION IF EXISTS public.parse_month_str_to_date(DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.parse_month_str_to_date(val DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT val;
$$;

-- 2.3. Tra cứu tỷ lệ hoa hồng theo ngày hiệu lực của hồ sơ
DROP FUNCTION IF EXISTS public.get_commission_rates_for_date(DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.get_commission_rates_for_date(p_date DATE)
RETURNS TABLE (
  comm_bhxh_new NUMERIC,
  comm_bhxh_renew NUMERIC,
  comm_bhyt_new NUMERIC,
  comm_bhyt_renew NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_val JSONB;
BEGIN
  -- 1. Tìm chính sách hoa hồng có ngày hiệu lực <= ngày của hồ sơ
  SELECT value INTO v_val
  FROM public.policies
  WHERE parameter_type = 'commission'
    AND effective_date <= COALESCE(p_date, CURRENT_DATE)
  ORDER BY effective_date DESC, is_active DESC, id DESC
  LIMIT 1;

  -- 2. Nếu không tìm thấy, lấy chính sách đang kích hoạt is_active = true
  IF v_val IS NULL THEN
    SELECT value INTO v_val
    FROM public.policies
    WHERE parameter_type = 'commission' AND is_active = true
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  -- 3. Trả về các tỷ lệ hoa hồng hoặc fallback về bảng settings hoặc giá trị mặc định
  RETURN QUERY
  SELECT 
    COALESCE((v_val->>'commBHXHNew')::NUMERIC, (v_val->>'comm_bhxh_new')::NUMERIC, s.comm_bhxh_new, 5::NUMERIC) AS comm_bhxh_new,
    COALESCE((v_val->>'commBHXHRenew')::NUMERIC, (v_val->>'comm_bhxh_renew')::NUMERIC, s.comm_bhxh_renew, 3::NUMERIC) AS comm_bhxh_renew,
    COALESCE((v_val->>'commBHYTNew')::NUMERIC, (v_val->>'comm_bhyt_new')::NUMERIC, s.comm_bhyt_new, 5::NUMERIC) AS comm_bhyt_new,
    COALESCE((v_val->>'commBHYTRenew')::NUMERIC, (v_val->>'comm_bhyt_renew')::NUMERIC, s.comm_bhyt_renew, 3::NUMERIC) AS comm_bhyt_renew
  FROM (SELECT 1) dummy
  LEFT JOIN public.settings s ON true
  LIMIT 1;
END;
$$;

-- 2.4. Sinh mã khóa định danh duy nhất của công dân (Customer Master Key)
DROP FUNCTION IF EXISTS public.generate_customer_key(TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.generate_customer_key(TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.generate_customer_key(
    p_type TEXT,
    p_bhxh TEXT,
    p_cccd TEXT,
    p_name TEXT,
    p_phone TEXT
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean_cccd TEXT;
    v_clean_bhxh TEXT;
    v_clean_phone TEXT;
BEGIN
    v_clean_cccd := REGEXP_REPLACE(COALESCE(p_cccd, ''), '\D', '', 'g');
    v_clean_bhxh := REGEXP_REPLACE(COALESCE(p_bhxh, ''), '\D', '', 'g');
    v_clean_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '\D', '', 'g');

    -- Ưu tiên 1: Mã định danh công dân toàn quốc (12 số CCCD / ĐDCN hoặc 9 số CMND)
    IF LENGTH(v_clean_cccd) = 12 OR LENGTH(v_clean_cccd) = 9 THEN
        RETURN 'CUST_CCCD_' || v_clean_cccd;
    END IF;

    -- Ưu tiên 2: Mã số BHXH 10 chữ số
    IF LENGTH(v_clean_bhxh) = 10 THEN
        RETURN 'CUST_BHXH_' || v_clean_bhxh;
    END IF;

    -- Ưu tiên 3: Tên chuẩn hóa + Số điện thoại
    IF v_clean_phone <> '' AND p_name IS NOT NULL AND TRIM(p_name) <> '' THEN
        RETURN 'CUST_PHONE_' || v_clean_phone || '_' || LOWER(REGEXP_REPLACE(TRIM(p_name), '\s+', '_', 'g'));
    END IF;

    -- Fallback cuối cùng
    RETURN 'CUST_NAME_' || LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_name, 'unknown')), '\s+', '_', 'g')) || '_' || COALESCE(v_clean_phone, 'none');
END;
$$;

-- 2.5. Kiểm tra trạng thái khóa kỳ tài chính (is_financial_period_locked)
DROP FUNCTION IF EXISTS public.is_financial_period_locked(TIMESTAMP WITH TIME ZONE) CASCADE;
DROP FUNCTION IF EXISTS public.is_financial_period_locked(TIMESTAMPTZ) CASCADE;
CREATE OR REPLACE FUNCTION public.is_financial_period_locked(p_date TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_y text;
  v_m text;
  v_m_num integer;
  v_q_num integer;
  v_month_key text;
  v_quarter_key text;
  v_year_key text;
  v_locked_keys jsonb;
  v_is_locked boolean := false;
BEGIN
  IF p_date IS NULL THEN
    RETURN false;
  END IF;

  v_y := to_char(p_date, 'YYYY');
  v_m := to_char(p_date, 'MM');
  v_m_num := extract(month from p_date)::integer;
  v_q_num := ceil(v_m_num / 3.0)::integer;

  v_month_key := 'month_' || v_m || '/' || v_y;
  v_quarter_key := 'quarter_' || v_q_num::text || '_' || v_y;
  v_year_key := 'year_' || v_y;

  SELECT 
    CASE 
      WHEN jsonb_typeof(value) = 'array' THEN value
      WHEN jsonb_typeof(value->'lockedKeys') = 'array' THEN value->'lockedKeys'
      ELSE '[]'::jsonb
    END
  INTO v_locked_keys
  FROM public.policies
  WHERE parameter_type = 'locked_periods' AND is_active = true
  LIMIT 1;

  IF v_locked_keys IS NULL OR jsonb_array_length(v_locked_keys) = 0 THEN
    RETURN false;
  END IF;

  IF v_locked_keys @> to_jsonb(v_month_key) OR 
     v_locked_keys @> to_jsonb(v_quarter_key) OR 
     v_locked_keys @> to_jsonb(v_year_key) THEN
    v_is_locked := true;
  END IF;

  RETURN v_is_locked;
END;
$$;

-- 2.6. Hàm lấy IP Client và kiểm soát Rate-limit
DROP FUNCTION IF EXISTS public.purge_old_public_rpc_logs() CASCADE;
CREATE OR REPLACE FUNCTION public.purge_old_public_rpc_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.public_rpc_call_log
  WHERE called_at < NOW() - INTERVAL '48 hours';
$$;

DROP FUNCTION IF EXISTS public.get_public_client_ip() CASCADE;
CREATE OR REPLACE FUNCTION public.get_public_client_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  headers jsonb;
  ip text;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := null;
  END;

  IF headers IS NOT NULL THEN
    ip := headers->>'cf-connecting-ip';
    IF ip IS NOT NULL AND ip != '' THEN
      RETURN split_part(ip, ',', 1);
    END IF;

    ip := headers->>'x-real-ip';
    IF ip IS NOT NULL AND ip != '' THEN
      RETURN split_part(ip, ',', 1);
    END IF;

    ip := headers->>'x-forwarded-for';
    IF ip IS NOT NULL AND ip != '' THEN
      RETURN trim(split_part(ip, ',', 1));
    END IF;
  END IF;

  RETURN '127.0.0.1';
END;
$$;

DROP FUNCTION IF EXISTS public.enforce_public_rpc_rate_limit(text, integer, interval) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_public_rpc_rate_limit(text, int, interval) CASCADE;
CREATE OR REPLACE FUNCTION public.enforce_public_rpc_rate_limit(
  p_action text,
  p_max_requests int,
  p_window interval
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ip text;
  v_count int;
BEGIN
  v_ip := public.get_public_client_ip();

  SELECT COUNT(*) INTO v_count
  FROM public.public_rpc_call_log
  WHERE action = p_action
    AND ip_address = v_ip
    AND called_at > (NOW() - p_window);

  IF v_count >= p_max_requests THEN
    RAISE EXCEPTION 'Quá nhiều yêu cầu từ địa chỉ IP này. Vui lòng thử lại sau.'
      USING ERRCODE = '42900';
  END IF;

  INSERT INTO public.public_rpc_call_log (action, ip_address, called_at)
  VALUES (p_action, v_ip, NOW());

  IF (random() < 0.05) THEN
    PERFORM public.purge_old_public_rpc_logs();
  END IF;
END;
$$;

-- ======================================================================
-- 3. CÁC HÀM XỬ LÝ DỊCH VỤ CÔNG & RPC STORED PROCEDURES (100% SNAKE_CASE)
-- ======================================================================

-- 3.1. RPC Tiếp nhận đơn đăng ký công khai an toàn (public_register_customer)
DROP FUNCTION IF EXISTS public.public_register_customer(JSONB) CASCADE;
CREATE OR REPLACE FUNCTION public.public_register_customer(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name         TEXT;
  v_cccd         TEXT;
  v_phone        TEXT;
  v_bhxh         TEXT;
  v_type         TEXT;
  v_dob          DATE;
  v_gender       TEXT;
  v_nation       TEXT;
  v_email        TEXT;
  v_address      TEXT;
  v_notes        TEXT;
  v_income       NUMERIC;
  v_months       INT;
  v_from_month   TEXT;
  v_to_month     TEXT;
  v_amount       NUMERIC;
  v_members      JSONB;
  v_recv_name    TEXT;
  v_recv_phone   TEXT;
  v_recv_address TEXT;
  v_ip           TEXT;
  v_new_id       BIGINT;
  v_idempotency_key UUID;
  v_existing_id  BIGINT;
BEGIN
  v_name         := TRIM(p_payload->>'name');
  v_cccd         := NULLIF(TRIM(p_payload->>'cccd'), '');
  v_phone        := NULLIF(TRIM(p_payload->>'phone'), '');
  v_bhxh         := NULLIF(TRIM(p_payload->>'bhxh'), '');
  v_type         := UPPER(TRIM(p_payload->>'type'));
  v_gender       := COALESCE(TRIM(p_payload->>'gender'), 'Nam');
  v_nation       := COALESCE(TRIM(p_payload->>'nation'), 'Kinh');
  v_email        := NULLIF(TRIM(p_payload->>'email'), '');
  v_address      := NULLIF(TRIM(p_payload->>'address'), '');
  v_notes        := NULLIF(TRIM(p_payload->>'notes'), '');
  v_income       := COALESCE((p_payload->>'income')::NUMERIC, 1500000);
  v_months       := COALESCE((p_payload->>'months')::INT, 1);
  v_from_month   := NULLIF(TRIM(COALESCE(p_payload->>'from_month', p_payload->>'fromMonth', '')), '');
  v_to_month     := NULLIF(TRIM(COALESCE(p_payload->>'to_month', p_payload->>'toMonth', '')), '');
  v_amount       := COALESCE((p_payload->>'amount')::NUMERIC, 0);
  v_members      := p_payload->'members';
  v_recv_name    := NULLIF(TRIM(COALESCE(p_payload->>'recv_name', p_payload->>'recvName', '')), '');
  v_recv_phone   := NULLIF(TRIM(COALESCE(p_payload->>'recv_phone', p_payload->>'recvPhone', '')), '');
  v_recv_address := NULLIF(TRIM(COALESCE(p_payload->>'recv_address', p_payload->>'recvAddress', '')), '');

  IF p_payload->>'dob' IS NOT NULL AND p_payload->>'dob' != '' THEN
    BEGIN
      v_dob := (p_payload->>'dob')::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
    END;
  END IF;

  IF v_name IS NULL OR LENGTH(v_name) < 2 OR LENGTH(v_name) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Họ và tên không hợp lệ.');
  END IF;

  IF v_type NOT IN ('BHXH', 'BHYT') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Loại hình tham gia không hợp lệ.');
  END IF;

  IF v_cccd IS NOT NULL AND v_cccd !~ '^\d{9}$|^\d{12}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số CCCD phải gồm 9 hoặc 12 chữ số.');
  END IF;

  IF v_phone IS NOT NULL AND v_phone !~ '^0\d{9}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng số 0.');
  END IF;

  -- Kiểm tra trùng lặp nếu có idempotency_key
  IF COALESCE(p_payload->>'idempotency_key', p_payload->>'idempotencyKey') IS NOT NULL 
     AND TRIM(COALESCE(p_payload->>'idempotency_key', p_payload->>'idempotencyKey')) != '' THEN
    BEGIN
      v_idempotency_key := (COALESCE(p_payload->>'idempotency_key', p_payload->>'idempotencyKey'))::UUID;
      SELECT id INTO v_existing_id FROM public.records WHERE idempotency_key = v_idempotency_key::text LIMIT 1;
      IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', true,
          'message', 'Đơn đăng ký đã được ghi nhận trước đó.',
          'record_id', v_existing_id,
          'recordId', v_existing_id
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_idempotency_key := NULL;
    END;
  END IF;

  -- Rate limit: Tối đa 20 lượt gửi đơn / 24 giờ / IP
  PERFORM public.enforce_public_rpc_rate_limit('public_register_customer', 20, INTERVAL '24 hours');
  v_ip := public.get_public_client_ip();

  INSERT INTO public.records (
    name, cccd, phone, bhxh, dob, gender, nation, email, address, notes,
    type, action_type, payment_status, status, staff_id,
    income, months, from_month, to_month, amount, members,
    recv_name, recv_phone, recv_address, ip_address, date, idempotency_key
  ) VALUES (
    v_name, v_cccd, v_phone, v_bhxh, v_dob, v_gender, v_nation, v_email, v_address, v_notes,
    v_type, 'Đăng ký mới', 'Chờ duyệt', 'Chờ duyệt', NULL,
    v_income, v_months, v_from_month, v_to_month, v_amount, v_members,
    v_recv_name, v_recv_phone, v_recv_address, v_ip, NOW(), v_idempotency_key::text
  ) RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã tiếp nhận yêu cầu đăng ký thành công.',
    'record_id', v_new_id,
    'recordId', v_new_id
  );
END;
$$;

-- 3.2. RPC Tra cứu quá trình tham gia (public_lookup_process)
DROP FUNCTION IF EXISTS public.public_lookup_process(TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.public_lookup_process(p_code TEXT, p_type TEXT)
RETURNS TABLE (
  name TEXT,
  cccd TEXT,
  type TEXT,
  from_month TEXT,
  to_month TEXT,
  months INTEGER,
  income NUMERIC,
  amount NUMERIC,
  next_payment TEXT,
  status TEXT,
  payment_status TEXT,
  registration_date TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  PERFORM public.enforce_public_rpc_rate_limit('public_lookup_process', 15, INTERVAL '1 hour');

  RETURN QUERY
  SELECT 
    CASE 
      WHEN LENGTH(TRIM(r.name)) > 4 THEN 
        split_part(TRIM(r.name), ' ', 1) || ' *** ' || reverse(split_part(reverse(TRIM(r.name)), ' ', 1))
      ELSE '***'
    END AS name,
    public.mask_cccd_pii(r.cccd) AS cccd,
    COALESCE(r.type, ''),
    COALESCE(r.from_month, ''),
    COALESCE(r.to_month, ''),
    COALESCE(r.months, 1),
    COALESCE(r.income, 0),
    COALESCE(r.amount, 0),
    COALESCE(r.next_payment::text, ''),
    COALESCE(r.status, 'Đang tham gia'),
    COALESCE(r.payment_status, ''),
    COALESCE(to_char(r.date, 'YYYY-MM-DD'), '') AS registration_date
  FROM public.records r
  WHERE r.payment_status != 'Đã hủy'
    AND r.type = UPPER(TRIM(p_type))
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC
  LIMIT 20;
END;
$$;

-- 3.3. RPC Lấy thông tin gia hạn nhanh (public_get_renewal_info)
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
BEGIN
  IF auth.role() NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'Access denied: Chức năng gia hạn nhanh chỉ khả dụng qua cổng dịch vụ đã xác thực bảo mật.'
      USING ERRCODE = '42501';
  END IF;

  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  PERFORM public.enforce_public_rpc_rate_limit('public_get_renewal_info', 15, INTERVAL '1 hour');

  RETURN QUERY
  SELECT 
    r.name,
    r.cccd,
    r.phone,
    r.bhxh,
    r.dob,
    r.gender,
    r.nation,
    r.email,
    r.address,
    r.type,
    r.method,
    r.months,
    r.income,
    r.from_month,
    r.to_month,
    r.notes,
    r.recv_name,
    r.recv_phone,
    r.recv_address,
    r.members
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

-- 3.4. RPC Kiểm tra sự tồn tại của khách hàng (check_customer_exists)
DROP FUNCTION IF EXISTS public.check_customer_exists(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.check_customer_exists(p_code TEXT)
RETURNS TABLE (customer_exists BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN QUERY SELECT FALSE;
    RETURN;
  END IF;

  PERFORM public.enforce_public_rpc_rate_limit('check_customer_exists', 25, INTERVAL '1 hour');

  RETURN QUERY
  SELECT EXISTS (
    SELECT 1 FROM public.records r
    WHERE r.payment_status != 'Đã hủy'
      AND (
        (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
        (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
      )
  ) AS customer_exists;
END;
$$;

-- 3.5. RPC Can thiệp kỳ tài chính có giải trình (admin_override_record)
DROP FUNCTION IF EXISTS public.admin_override_record(BIGINT, JSONB, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.admin_override_record(
  p_record_id BIGINT,
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_admin_count INT;
BEGIN
  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Yêu cầu bắt buộc: Phải nhập lý do can thiệp giải trình chi tiết (tối thiểu 5 ký tự).'
      USING ERRCODE = '23514';
  END IF;

  SELECT role, name INTO v_caller_role, v_caller_name
  FROM public.staff
  WHERE auth_user_id = auth.uid() AND status = 'Đang hoạt động'
  LIMIT 1;

  SELECT COUNT(*) INTO v_admin_count FROM public.staff WHERE role = 'Admin' AND auth_user_id IS NOT NULL;

  IF v_caller_role != 'Admin' AND v_admin_count > 0 THEN
    RAISE EXCEPTION 'Bảo mật: Chỉ có Quản trị viên (Admin) mới có quyền can thiệp vào hồ sơ đã khóa sổ.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.is_admin_override', 'true', true);

  UPDATE public.records
  SET
    name           = COALESCE(p_payload->>'name', name),
    phone          = COALESCE(p_payload->>'phone', phone),
    address        = COALESCE(p_payload->>'address', address),
    payment_status = COALESCE(p_payload->>'payment_status', p_payload->>'paymentStatus', payment_status),
    status         = COALESCE(p_payload->>'status', status),
    amount         = COALESCE((p_payload->>'amount')::NUMERIC, amount),
    notes          = COALESCE(p_payload->>'notes', notes)
  WHERE id = p_record_id;

  RETURN jsonb_build_object('success', true, 'message', 'Cập nhật hồ sơ can thiệp thành công.');
END;
$$;

-- 3.6. RPC Xác nhận thu tiền (confirm_record_payment)
DROP FUNCTION IF EXISTS public.confirm_record_payment(BIGINT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.confirm_record_payment(
  p_record_id BIGINT,
  p_new_status TEXT DEFAULT 'Đã thu tiền'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_staff_id TEXT;
  v_staff_name TEXT;
  v_month_key_slash TEXT;
  v_month_key_dash TEXT;
  v_year_key TEXT;
  v_locked_keys JSONB;
BEGIN
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Tài khoản không có quyền thao tác trên hệ thống hoặc đã bị tạm khóa.'
      USING ERRCODE = '42501';
  END IF;

  IF p_new_status = 'Đã hủy' AND NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Chỉ Quản lý hoặc Admin mới có quyền hủy biên lai giao dịch.'
      USING ERRCODE = '42501';
  END IF;

  SELECT id, name, date, payment_status, is_submitted_bhxh, staff_id
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ ID ' || p_record_id);
  END IF;

  IF v_rec.date IS NOT NULL THEN
    v_month_key_slash := 'month_' || to_char(v_rec.date, 'MM/YYYY');
    v_month_key_dash := 'month_' || to_char(v_rec.date, 'MM-YYYY');
    v_year_key := 'year_' || to_char(v_rec.date, 'YYYY');

    SELECT value INTO v_locked_keys
    FROM public.policies
    WHERE parameter_type = 'locked_periods'
      AND is_active = true
    ORDER BY id DESC
    LIMIT 1;

    IF v_locked_keys IS NOT NULL AND jsonb_typeof(v_locked_keys) = 'array' THEN
      IF (v_locked_keys ? v_month_key_slash) OR (v_locked_keys ? v_month_key_dash) OR (v_locked_keys ? v_year_key) THEN
        RAISE EXCEPTION 'Kỳ kế toán đã bị khóa sổ. Không thể thay đổi trạng thái thanh toán!'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  v_staff_id := public.current_staff_id();
  SELECT name INTO v_staff_name FROM public.staff WHERE id = v_staff_id LIMIT 1;

  UPDATE public.records
  SET payment_status = p_new_status
  WHERE id = p_record_id;

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    COALESCE(v_staff_id, 'staff'),
    COALESCE(v_staff_name, 'Nhân viên'),
    'Xác nhận thu tiền',
    format('Cán bộ %s (%s) cập nhật trạng thái thanh toán hồ sơ %s (ID %s) từ "%s" sang "%s"',
      COALESCE(v_staff_name, 'Nhân viên'),
      COALESCE(v_staff_id, 'staff'),
      v_rec.name,
      p_record_id,
      COALESCE(v_rec.payment_status, 'Chờ thanh toán'),
      p_new_status
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'new_status', p_new_status);
END;
$$;

-- 3.7. RPC Lấy thông tin hồ sơ nhân sự an toàn (get_current_staff_profile)
DROP FUNCTION IF EXISTS public.get_current_staff_profile() CASCADE;
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

  SELECT id, name, cccd, phone, email, area, role, status, username, staff_code, auth_user_id
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = v_uid
  LIMIT 1;

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

    SELECT id, name, cccd, phone, email, area, role, status, username, staff_code, auth_user_id
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

  IF v_staff IS NULL AND v_email != '' THEN
    SELECT COUNT(*) INTO v_staff_count FROM public.staff;
    
    IF v_staff_count = 0 THEN
      INSERT INTO public.staff (id, name, email, role, status, area, staff_code, auth_user_id)
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
      RETURNING id, name, cccd, phone, email, area, role, status, username, staff_code, auth_user_id
      INTO v_staff;
    ELSE
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'UNAUTHORIZED_NOT_STAFF: Tài khoản chưa được phân quyền trong danh mục Nhân sự. Vui lòng liên hệ Quản trị viên.'
      );
    END IF;
  END IF;

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'STAFF_NOT_FOUND');
  END IF;

  IF v_staff.status = 'Tạm khóa' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tài khoản của bạn đã bị tạm khóa.');
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
      'staff_code', v_staff.staff_code,
      'staffCode', v_staff.staff_code,
      'auth_user_id', v_staff.auth_user_id
    )
  );
END;
$$;

-- 3.8. RPC Thống kê tài chính nâng cao (get_admin_finance_stats)
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
AS $$
DECLARE
  total_revenue numeric;
  total_pending numeric;
  total_commission numeric;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN r.payment_status = 'Đã thu tiền' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.payment_status = 'Chờ thanh toán' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(
      CASE 
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
    AND (filter_staff = 'all' OR r.staff_id = filter_staff)
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

-- 3.9. RPC Xóa hồ sơ giao dịch an toàn (delete_record_safe)
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
  v_is_admin_user BOOLEAN := false;
  v_deleted_count INT := 0;
BEGIN
  v_is_admin_user := public.is_admin();

  SELECT id, name, type,
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

  IF v_rec.is_submitted = true THEN
    RAISE EXCEPTION 'Hồ sơ "%" (Mã #%) ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', v_rec.name, p_record_id
      USING ERRCODE = '23514';
  END IF;

  IF v_rec.p_status = 'Đã thu tiền' AND NOT v_is_admin_user THEN
    RAISE EXCEPTION 'Giao dịch #% của "%" đã thu tiền. Chỉ Quản lý/Admin mới có quyền xóa!', p_record_id, v_rec.name
      USING ERRCODE = '42501';
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

  RETURN jsonb_build_object('success', true, 'deleted_id', p_record_id, 'message', 'Đã xóa giao dịch thành công');
END;
$$;

-- 3.10. RPC Xóa nhiều hồ sơ giao dịch an toàn (bulk_delete_records_safe)
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
BEGIN
  SELECT COUNT(*) INTO v_submitted_count
  FROM public.records
  WHERE id = ANY(p_record_ids)
    AND is_submitted_bhxh = true;

  IF v_submitted_count > 0 THEN
    RAISE EXCEPTION 'Có % hồ sơ trong danh sách ĐÃ ĐƯỢC CHUYỂN BHXH. Không thể xóa!', v_submitted_count
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.is_manager_or_admin() THEN
    SELECT COUNT(*) INTO v_paid_non_admin_count
    FROM public.records
    WHERE id = ANY(p_record_ids)
      AND payment_status = 'Đã thu tiền';

    IF v_paid_non_admin_count > 0 THEN
      RAISE EXCEPTION 'Có % hồ sơ đã thu tiền. Nhân viên không được phép xóa giao dịch đã thu tiền!', v_paid_non_admin_count
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

-- 3.11. RPC Xóa khách hàng liên đới an toàn (delete_customer_cascade)
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
    v_has_paid INT := 0;
    v_is_mgr_or_admin BOOLEAN := false;
BEGIN
    v_is_mgr_or_admin := public.is_manager_or_admin();

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

    IF NOT v_is_mgr_or_admin THEN
        SELECT COUNT(*) INTO v_has_paid
        FROM public.records
        WHERE (customer_key = p_customer_key
               OR (v_cust_id IS NOT NULL AND customer_id = v_cust_id)
               OR cccd = p_customer_key
               OR bhxh = p_customer_key
               OR phone = p_customer_key
               OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key)
          AND payment_status = 'Đã thu tiền';

        IF v_has_paid > 0 THEN
            RAISE EXCEPTION 'Khách hàng "%" đã có giao dịch Đã thu tiền. Chỉ Quản lý/Admin mới có quyền xóa khách hàng này!', COALESCE(v_cust_name, p_customer_key)
                USING ERRCODE = '42501';
        END IF;
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
       OR (v_cust_id IS NOT NULL AND id = v_cust_id)
       OR cccd = p_customer_key
       OR bhxh = p_customer_key
       OR phone = p_customer_key;

    BEGIN
      INSERT INTO public.auditlogs (action, details, user_id, user_name, timestamp)
      VALUES (
          'Xóa khách hàng liên đới',
          'Xóa khách hàng ' || COALESCE(v_cust_name, p_customer_key) || ' (Đã xóa liên đới ' || v_deleted_records_count || ' giao dịch)',
          COALESCE(auth.uid()::TEXT, 'system'),
          COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Cán bộ thu'),
          NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'customer_key', p_customer_key,
        'deleted_records', v_deleted_records_count,
        'message', 'Đã xóa khách hàng và các giao dịch liên đới thành công'
    );
END;
$$;

-- 3.12. RPC Ghi nhật ký tiếp xúc đôn đốc (log_customer_contact)
DROP FUNCTION IF EXISTS public.log_customer_contact(BIGINT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.log_customer_contact(
    p_record_id BIGINT,
    p_note TEXT,
    p_channel TEXT DEFAULT 'Trực tiếp'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_old_notes TEXT;
    v_new_notes TEXT;
    v_timestamp TEXT;
    v_rec_name TEXT;
BEGIN
    IF auth.role() IS DISTINCT FROM 'authenticated' AND auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Quyền truy cập bị từ chối: Cần đăng nhập để ghi nhật ký tiếp xúc.'
            USING ERRCODE = '42501';
    END IF;

    SELECT name, notes INTO v_rec_name, v_old_notes
    FROM public.records
    WHERE id = p_record_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ với ID ' || p_record_id);
    END IF;

    v_timestamp := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI');
    v_old_notes := COALESCE(v_old_notes, '');
    
    v_new_notes := TRIM(p_note) || ' [' || TRIM(COALESCE(p_channel, 'Trực tiếp')) || '] (' || v_timestamp || ')';
    
    IF v_old_notes <> '' THEN
        v_new_notes := v_new_notes || E'\n' || v_old_notes;
    END IF;

    UPDATE public.records
    SET notes = v_new_notes
    WHERE id = p_record_id;

    INSERT INTO public.auditlogs (action, details, user_id, user_name, timestamp)
    VALUES (
        'Nhật ký tiếp xúc khách hàng',
        'Cập nhật đôn đốc cho KH ID ' || p_record_id || ' (' || COALESCE(v_rec_name, '') || '): ' || TRIM(p_note) || ' [' || TRIM(COALESCE(p_channel, 'Trực tiếp')) || ']',
        COALESCE(auth.uid()::TEXT, 'system'),
        COALESCE(auth.jwt() ->> 'email', 'Hệ thống'),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'notes', v_new_notes);
END;
$$;

-- 3.13. RPC Tra cứu hồ sơ khách hàng tự động điền (lookup_customer_profile)
DROP FUNCTION IF EXISTS public.lookup_customer_profile(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.lookup_customer_profile(p_code TEXT)
RETURNS TABLE (
  name TEXT,
  cccd TEXT,
  phone TEXT,
  bhxh TEXT,
  old_bhxh TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  email TEXT,
  address TEXT,
  income NUMERIC,
  method TEXT,
  nn_support_pct NUMERIC,
  dp_support_pct NUMERIC,
  notes TEXT,
  from_month TEXT,
  to_month TEXT,
  next_payment TEXT,
  months INTEGER,
  wage NUMERIC,
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
  v_clean TEXT;
BEGIN
  IF auth.role() NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'Access denied: Quyền tra cứu thông tin khách hàng chỉ dành cho nhân viên đã đăng nhập hệ thống.'
      USING ERRCODE = '42501';
  END IF;

  v_clean := REGEXP_REPLACE(COALESCE(p_code, ''), '\D', '', 'g');
  IF v_clean !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  -- Ưu tiên 1: Tra cứu từ bảng Master Customers kết hợp record gần nhất
  RETURN QUERY
  SELECT 
    c.name,
    c.cccd,
    c.phone,
    c.bhxh,
    COALESCE(c.old_bhxh, (CASE WHEN LENGTH(c.bhxh) = 10 THEN c.bhxh ELSE '' END)) AS old_bhxh,
    c.dob,
    COALESCE(c.gender, 'Nam') AS gender,
    COALESCE(c.nation, 'Kinh') AS nation,
    c.email,
    c.address,
    r.income,
    r.method,
    r.nn_support_pct,
    r.dp_support_pct,
    COALESCE(c.notes, r.notes) AS notes,
    r.from_month,
    r.to_month,
    r.next_payment,
    r.months,
    r.wage,
    COALESCE(c.recv_name, r.recv_name) AS recv_name,
    COALESCE(c.recv_phone, r.recv_phone) AS recv_phone,
    COALESCE(c.recv_address, r.recv_address) AS recv_address,
    COALESCE(c.members, CASE WHEN r.members IS NOT NULL THEN to_jsonb(r.members) ELSE NULL END) AS members
  FROM public.customers c
  LEFT JOIN public.records r ON c.latest_record_id = r.id
  WHERE (
      (c.cccd = v_clean) OR
      (c.bhxh = v_clean) OR
      (c.old_bhxh = v_clean)
  )
  ORDER BY c.updated_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Fallback: Tra cứu trong records
  RETURN QUERY
  SELECT 
    r.name,
    r.cccd,
    r.phone,
    r.bhxh,
    COALESCE(r.old_bhxh, (CASE WHEN LENGTH(r.bhxh) = 10 THEN r.bhxh ELSE '' END)) AS old_bhxh,
    r.dob,
    COALESCE(r.gender, 'Nam') AS gender,
    COALESCE(r.nation, 'Kinh') AS nation,
    r.email,
    r.address,
    r.income,
    r.method,
    r.nn_support_pct,
    r.dp_support_pct,
    r.notes,
    r.from_month,
    r.to_month,
    r.next_payment,
    r.months,
    r.wage,
    r.recv_name,
    r.recv_phone,
    r.recv_address,
    CASE WHEN r.members IS NOT NULL THEN to_jsonb(r.members) ELSE NULL END AS members
  FROM public.records r
  WHERE r.payment_status != 'Đã hủy'
    AND (
      (r.bhxh = v_clean AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = v_clean AND r.cccd IS NOT NULL AND r.cccd != '') OR
      (r.old_bhxh = v_clean AND r.old_bhxh IS NOT NULL AND r.old_bhxh != '')
    )
  ORDER BY COALESCE(r.updated_at, r.created_at, r.date) DESC, r.date DESC, r.id DESC
  LIMIT 1;
END;
$$;

-- 3.14. RPC Import Hàng loạt (import_records_batch)
DROP FUNCTION IF EXISTS public.import_records_batch(JSONB, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.import_records_batch(
  p_records JSONB,
  p_batch_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_record JSONB;
  v_batch_code TEXT;
  v_user_id TEXT;
  v_user_name TEXT;
  v_record_id BIGINT;
  v_record_name TEXT;
  v_cust_key TEXT;
  v_date TIMESTAMP WITH TIME ZONE;
  v_effective_date DATE;
  v_target_date DATE;
  v_next_payment DATE;
  v_submitted_date DATE;
  v_decision_date DATE;
  v_dob DATE;
  v_from_month TEXT;
  v_to_month TEXT;
  v_from_month_date DATE;
  v_to_month_date DATE;
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản lý hoặc Quản trị viên mới được phép thực hiện import hàng loạt.'
      USING ERRCODE = '42501';
  END IF;

  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dữ liệu import rỗng hoặc không đúng định dạng mảng JSON');
  END IF;

  v_batch_code := COALESCE(NULLIF(TRIM(p_batch_name), ''), 'IMPORT_' || to_char(NOW(), 'YYYYMMDD_HH24MISS'));

  v_user_id := COALESCE(auth.uid()::text, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE id = v_user_id OR email = (auth.jwt() ->> 'email') LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  PERFORM set_config('app.is_batch_import', 'true', true);

  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_record_name := TRIM(COALESCE(v_record->>'name', ''));
    IF v_record_name = '' THEN
      CONTINUE;
    END IF;

    v_date := COALESCE(NULLIF(v_record->>'date', '')::timestamptz, NOW());
    v_effective_date := public.safe_cast_date(COALESCE(v_record->>'effective_date', v_record->>'effectiveDate'));
    v_target_date := public.safe_cast_date(COALESCE(v_record->>'target_date', v_record->>'targetDate'));
    v_next_payment := public.safe_cast_date(COALESCE(v_record->>'next_payment', v_record->>'nextPayment'));
    v_submitted_date := public.safe_cast_date(COALESCE(v_record->>'submitted_date', v_record->>'submittedDate'));
    v_decision_date := public.safe_cast_date(COALESCE(v_record->>'decision_date', v_record->>'decisionDate'));
    v_dob := public.safe_cast_date(v_record->>'dob');
    v_from_month := NULLIF(TRIM(COALESCE(v_record->>'from_month', v_record->>'fromMonth', '')), '');
    v_to_month := NULLIF(TRIM(COALESCE(v_record->>'to_month', v_record->>'toMonth', '')), '');
    v_from_month_date := public.parse_month_str_to_date(v_from_month);
    v_to_month_date := public.parse_month_str_to_date(v_to_month);

    v_cust_key := public.generate_customer_key(
      v_record->>'type',
      v_record->>'bhxh',
      v_record->>'cccd',
      v_record_name,
      v_record->>'phone'
    );

    INSERT INTO public.records (
      name, cccd, phone, address, bhxh, old_bhxh, dob, gender, nation, email,
      type, sub_type, action_type, status, payment_status, date,
      effective_date, target_date, next_payment, from_month, to_month,
      from_month_date, to_month_date, wage, income, months, method,
      base_premium, support_pct, nn_support_pct, nn_support_amount,
      dp_support_pct, dp_support_amount, amount, discount_amount, penalty_amount,
      commission, support, notes, staff_id, household_id, members,
      recv_name, recv_phone, recv_address, is_submitted_bhxh, submission_batch,
      submitted_date, refund_type, decision_number, decision_date, refund_method,
      refund_beneficiary_name, refund_beneficiary_account, refund_beneficiary_bank,
      hospital_code, hospital_name, customer_key
    ) VALUES (
      v_record_name,
      NULLIF(TRIM(COALESCE(v_record->>'cccd', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'phone', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'address', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'bhxh', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'old_bhxh', v_record->>'oldBhxh', '')), ''),
      v_dob,
      COALESCE(NULLIF(TRIM(v_record->>'gender'), ''), 'Nam'),
      COALESCE(NULLIF(TRIM(v_record->>'nation'), ''), 'Kinh'),
      NULLIF(TRIM(COALESCE(v_record->>'email', '')), ''),
      COALESCE(NULLIF(TRIM(v_record->>'type'), ''), 'BHXH'),
      NULLIF(TRIM(COALESCE(v_record->>'sub_type', v_record->>'subType', '')), ''),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'action_type', v_record->>'actionType', '')), ''), 'Tái tục'),
      COALESCE(NULLIF(TRIM(v_record->>'status'), ''), 'Đang tham gia'),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'payment_status', v_record->>'paymentStatus', '')), ''), 'Đã thu tiền'),
      v_date,
      v_effective_date,
      v_target_date,
      v_next_payment,
      v_from_month,
      v_to_month,
      v_from_month_date,
      v_to_month_date,
      COALESCE(NULLIF(v_record->>'wage', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'income', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'months', '')::int, 1),
      COALESCE(NULLIF(TRIM(v_record->>'method'), ''), 'Hàng tháng'),
      COALESCE(NULLIF(COALESCE(v_record->>'base_premium', v_record->>'basePremium', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'support_pct', v_record->>'supportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'nn_support_pct', v_record->>'nnSupportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'nn_support_amount', v_record->>'nnSupportAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'dp_support_pct', v_record->>'dpSupportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'dp_support_amount', v_record->>'dpSupportAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'amount', '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'discount_amount', v_record->>'discountAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'penalty_amount', v_record->>'penaltyAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'commission', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'support', '')::numeric, 0),
      NULLIF(TRIM(COALESCE(v_record->>'notes', '')), ''),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'staff_id', v_record->>'staffId', '')), ''), v_user_id),
      NULLIF(TRIM(COALESCE(v_record->>'household_id', v_record->>'householdId', '')), ''),
      CASE WHEN v_record->'members' IS NOT NULL AND jsonb_typeof(v_record->'members') = 'array' THEN v_record->'members' ELSE NULL END,
      NULLIF(TRIM(COALESCE(v_record->>'recv_name', v_record->>'recvName', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'recv_phone', v_record->>'recvPhone', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'recv_address', v_record->>'recvAddress', '')), ''),
      COALESCE((COALESCE(v_record->>'is_submitted_bhxh', v_record->>'isSubmittedBHXH'))::boolean, FALSE),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'submission_batch', v_record->>'submissionBatch', '')), ''), v_batch_code),
      v_submitted_date,
      NULLIF(TRIM(COALESCE(v_record->>'refund_type', v_record->>'refundType', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'decision_number', v_record->>'decisionNumber', '')), ''),
      v_decision_date,
      NULLIF(TRIM(COALESCE(v_record->>'refund_method', v_record->>'refundMethod', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_name', v_record->>'refundBeneficiaryName', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_account', v_record->>'refundBeneficiaryAccount', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_bank', v_record->>'refundBeneficiaryBank', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'hospital_code', v_record->>'hospitalCode', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'hospital_name', v_record->>'hospitalName', '')), ''),
      v_cust_key
    ) RETURNING id INTO v_record_id;

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  PERFORM set_config('app.is_batch_import', 'false', true);

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_user_id, 
    v_user_name, 
    'Import Hàng loạt', 
    format('Import thành công %s hồ sơ vào hệ thống theo đợt [%s]', v_inserted_count, v_batch_code),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch_code,
    'imported_count', v_inserted_count
  );
END;
$$;

-- 3.15. RPC Tạo bút toán thoái thu hoàn trả / Giảm trừ (create_refund_clawback_entry)
DROP FUNCTION IF EXISTS public.create_refund_clawback_entry(BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.create_refund_clawback_entry(
  p_original_record_id BIGINT,
  p_refund_amount NUMERIC,
  p_refund_type TEXT,
  p_decision_number TEXT,
  p_decision_date DATE,
  p_refund_method TEXT,
  p_beneficiary_name TEXT,
  p_beneficiary_account TEXT,
  p_beneficiary_bank TEXT,
  p_reason TEXT,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig RECORD;
  v_negative_amount NUMERIC;
  v_negative_comm NUMERIC;
  v_comm_rate NUMERIC;
  v_new_record_id BIGINT;
  v_user_id TEXT;
  v_user_name TEXT;
  v_effective_staff_id TEXT;
  v_effective_date DATE;
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản lý hoặc Quản trị viên mới có quyền lập bút toán thoái thu hoàn tiền.'
      USING ERRCODE = '42501';
  END IF;

  v_effective_date := COALESCE(p_decision_date, CURRENT_DATE);

  -- KIỂM TRA KHÓA KỲ TÀI CHÍNH THEO NGÀY QUYẾT ĐỊNH THOÁI THU
  IF public.is_financial_period_locked(v_effective_date::timestamptz) THEN
    RAISE EXCEPTION 'KỲ TÀI CHÍNH ĐÃ KHÓA: Kỳ tài chính ứng với ngày quyết định thoái thu (%) đã bị khóa sổ. Vui lòng mở khóa kỳ tài chính trước khi lập bút toán.',
      to_char(v_effective_date, 'DD/MM/YYYY')
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_orig
  FROM public.records
  WHERE id = p_original_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ gốc có ID %', p_original_record_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_orig.payment_status != 'Đã thu tiền' THEN
    RAISE EXCEPTION 'Hồ sơ gốc chưa thu tiền hoặc đã bị hủy, không thể lập bút toán thoái thu.'
      USING ERRCODE = '23514';
  END IF;

  IF p_refund_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền thoái thu phải lớn hơn 0'
      USING ERRCODE = '23514';
  END IF;

  IF p_refund_amount > v_orig.amount THEN
    RAISE EXCEPTION 'Số tiền thoái thu (% VNĐ) không được vượt quá số tiền của hồ sơ gốc (% VNĐ)', p_refund_amount, v_orig.amount
      USING ERRCODE = '23514';
  END IF;

  v_negative_amount := -1 * ABS(p_refund_amount);

  IF COALESCE(v_orig.amount, 0) > 0 AND COALESCE(v_orig.commission, 0) > 0 THEN
    v_comm_rate := v_orig.commission / v_orig.amount;
    v_negative_comm := -1 * ROUND(ABS(p_refund_amount) * v_comm_rate);
  ELSE
    v_negative_comm := 0;
  END IF;

  v_user_id := COALESCE(auth.uid()::text, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE id = v_user_id OR email = (auth.jwt() ->> 'email') LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  v_effective_staff_id := COALESCE(p_staff_id, v_orig.staff_id, v_user_id);

  INSERT INTO public.records (
    name, cccd, phone, address, bhxh, old_bhxh, dob, gender, nation, email,
    type, sub_type, action_type, status, payment_status, date,
    effective_date, target_date, next_payment, from_month, to_month,
    wage, income, months, method, base_premium, support_pct,
    nn_support_pct, nn_support_amount, dp_support_pct, dp_support_amount,
    amount, discount_amount, penalty_amount, commission, support, notes,
    staff_id, household_id, members, recv_name, recv_phone, recv_address,
    is_submitted_bhxh, submission_batch, submitted_date, refund_type,
    decision_number, decision_date, refund_method, refund_beneficiary_name,
    refund_beneficiary_account, refund_beneficiary_bank, is_adjustment,
    original_record_id, adjustment_reason, customer_key, customer_id
  ) VALUES (
    v_orig.name,
    v_orig.cccd,
    v_orig.phone,
    v_orig.address,
    v_orig.bhxh,
    v_orig.old_bhxh,
    v_orig.dob,
    v_orig.gender,
    v_orig.nation,
    v_orig.email,
    v_orig.type,
    v_orig.sub_type,
    'Thoái thu',
    'Hoàn tất thoái thu',
    'Đã thu tiền',
    NOW(),
    v_effective_date,
    v_orig.target_date,
    v_orig.next_payment,
    v_orig.from_month,
    v_orig.to_month,
    v_orig.wage,
    v_orig.income,
    0,
    v_orig.method,
    -1 * ABS(COALESCE(v_orig.base_premium, 0)),
    v_orig.support_pct,
    v_orig.nn_support_pct,
    -1 * ABS(COALESCE(v_orig.nn_support_amount, 0)),
    v_orig.dp_support_pct,
    -1 * ABS(COALESCE(v_orig.dp_support_amount, 0)),
    v_negative_amount,
    0,
    0,
    v_negative_comm,
    0,
    format('Bút toán thoái thu theo QĐ %s ngày %s. Lý do: %s (Hồ sơ gốc ID: #%s)', 
      COALESCE(p_decision_number, 'N/A'), 
      COALESCE(to_char(p_decision_date, 'DD/MM/YYYY'), 'N/A'), 
      COALESCE(p_reason, 'Không có'), 
      p_original_record_id
    ),
    v_effective_staff_id,
    v_orig.household_id,
    v_orig.members,
    v_orig.recv_name,
    v_orig.recv_phone,
    v_orig.recv_address,
    FALSE,
    NULL,
    NULL,
    p_refund_type,
    p_decision_number,
    p_decision_date,
    p_refund_method,
    p_beneficiary_name,
    p_beneficiary_account,
    p_beneficiary_bank,
    TRUE,
    p_original_record_id,
    p_reason,
    v_orig.customer_key,
    v_orig.customer_id
  ) RETURNING id INTO v_new_record_id;

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_user_id,
    v_user_name,
    'Lập bút toán thoái thu',
    format('Lập bút toán thoái thu #%s giảm trừ %s VNĐ (hoa hồng giảm %s VNĐ) cho hồ sơ gốc #%s của khách hàng %s. QĐ: %s',
      v_new_record_id, ABS(v_negative_amount), ABS(v_negative_comm), p_original_record_id, v_orig.name, COALESCE(p_decision_number, 'N/A')),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_record_id', v_new_record_id,
    'negative_amount', v_negative_amount,
    'negative_commission', v_negative_comm,
    'original_record_id', p_original_record_id
  );
END;
$$;

-- 3.16. RPC Phân trang và Tìm kiếm Khách hàng CRM (crm_search_customers)
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
BEGIN
  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.customers c
  LEFT JOIN public.records r ON c.latest_record_id = r.id
  WHERE (p_type = 'ALL' OR c.type = UPPER(TRIM(p_type)) OR c.type = 'CẢ HAI')
    AND (p_status = 'all' OR c.status = p_status)
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
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
    AND (p_staff_id = 'all' OR c.staff_id = p_staff_id)
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
  ORDER BY COALESCE(c.latest_date, r.date::date) DESC NULLS LAST, COALESCE(r.id, 0) DESC, COALESCE(c.next_payment, r.next_payment) ASC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 3.17. RPC Phân trang và Tìm kiếm Hồ sơ Thu Tài chính (finance_search_records)
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
BEGIN
  v_clean_search := LOWER(TRIM(COALESCE(p_search, '')));

  SELECT COUNT(*) INTO v_count
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR r.payment_status = p_payment_status)
    AND (p_staff_id = 'all' OR r.staff_id = p_staff_id)
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
    r.date::DATE,
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
    r.is_submitted_bhxh,
    r.submission_batch,
    r.submitted_date,
    r.is_adjustment,
    r.original_record_id,
    r.created_at
  FROM public.records r
  WHERE (p_type = 'ALL' OR r.type = UPPER(TRIM(p_type)))
    AND (p_payment_status = 'all' OR r.payment_status = p_payment_status)
    AND (p_staff_id = 'all' OR r.staff_id = p_staff_id)
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
  ORDER BY r.date DESC, r.id DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 3.18. RPC Thống kê Bảng điều khiển Quản trị (get_admin_dashboard_stats)
DROP FUNCTION IF EXISTS public.get_admin_dashboard_stats(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_revenue NUMERIC := 0;
  v_total_pending NUMERIC := 0;
  v_total_records INT := 0;
  v_total_customers INT := 0;
BEGIN
  SELECT 
    COALESCE(SUM(CASE WHEN r.payment_status = 'Đã thu tiền' THEN r.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN r.payment_status = 'Chờ thanh toán' THEN r.amount ELSE 0 END), 0),
    COUNT(*)
  INTO v_total_revenue, v_total_pending, v_total_records
  FROM public.records r
  WHERE (p_staff_id IS NULL OR r.staff_id = p_staff_id)
    AND r.payment_status != 'Đã hủy';

  SELECT COUNT(*) INTO v_total_customers
  FROM public.customers c
  WHERE (p_staff_id IS NULL OR c.staff_id = p_staff_id);

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

-- 3.19. RPC Ghi nhật ký kiểm toán bảo mật (log_security_audit_event)
DROP FUNCTION IF EXISTS public.log_security_audit_event(TEXT, TEXT, JSONB) CASCADE;
CREATE OR REPLACE FUNCTION public.log_security_audit_event(
  p_action TEXT,
  p_details TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_ip TEXT;
BEGIN
  v_user_id := COALESCE(auth.uid()::TEXT, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Hệ thống');
  END IF;

  v_ip := public.get_public_client_ip();

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_user_id,
    v_user_name,
    p_action,
    p_details || CASE WHEN p_metadata IS NOT NULL AND p_metadata != '{}'::jsonb THEN ' | Metadata: ' || p_metadata::text ELSE '' END,
    NOW()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 3.20. RPC Lưu trữ Hồ sơ Tham gia Trước đây (save_customer_participation)
DROP FUNCTION IF EXISTS public.save_customer_participation(TEXT, JSONB, INT, INT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.save_customer_participation(
    p_target_key TEXT,
    p_prior_periods JSONB DEFAULT '[]'::jsonb,
    p_prior_voluntary_months INT DEFAULT 0,
    p_prior_compulsory_months INT DEFAULT 0,
    p_prior_participation_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cust_id UUID;
    v_cust_key TEXT;
    v_cust_cccd TEXT;
    v_cust_bhxh TEXT;
    v_item JSONB;
BEGIN
    SELECT id, customer_key, cccd, bhxh 
    INTO v_cust_id, v_cust_key, v_cust_cccd, v_cust_bhxh
    FROM public.customers
    WHERE id::text = p_target_key
       OR customer_key = p_target_key
       OR cccd = p_target_key
       OR bhxh = p_target_key
    LIMIT 1;

    IF v_cust_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ khách hàng.');
    END IF;

    UPDATE public.customers
    SET 
        prior_periods = COALESCE(p_prior_periods, '[]'::jsonb),
        prior_voluntary_months = COALESCE(p_prior_voluntary_months, 0),
        prior_compulsory_months = COALESCE(p_prior_compulsory_months, 0),
        prior_participation_notes = p_prior_participation_notes,
        updated_at = NOW()
    WHERE id = v_cust_id;

    DELETE FROM public.customer_participations WHERE customer_id = v_cust_id;

    IF p_prior_periods IS NOT NULL AND jsonb_typeof(p_prior_periods) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_prior_periods)
        LOOP
            INSERT INTO public.customer_participations (
                customer_id,
                customer_key,
                cccd,
                bhxh,
                type,
                position,
                workplace,
                from_month,
                from_year,
                to_month,
                to_year,
                months,
                salary,
                notes
            ) VALUES (
                v_cust_id,
                v_cust_key,
                v_cust_cccd,
                v_cust_bhxh,
                COALESCE(v_item->>'type', 'batbuoc'),
                v_item->>'position',
                v_item->>'workplace',
                COALESCE((v_item->>'sm')::INT, 1),
                COALESCE((v_item->>'sy')::INT, 2020),
                COALESCE((v_item->>'em')::INT, 12),
                COALESCE((v_item->>'ey')::INT, 2020),
                COALESCE((v_item->>'months')::INT, 0),
                CASE WHEN (v_item->>'salary') IS NOT NULL AND (v_item->>'salary') ~ '^\d+(\.\d+)?$' 
                     THEN (v_item->>'salary')::NUMERIC ELSE NULL END,
                v_item->>'notes'
            );
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'customer_id', v_cust_id,
        'customer_key', v_cust_key,
        'message', 'Lưu hồ sơ quá trình tham gia thành công.'
    );
END;
$$;

-- 3.21. RPC Lưu cấu hình phân quyền vai trò và đặc cách (save_rbac_permissions)
DROP FUNCTION IF EXISTS public.save_rbac_permissions(JSONB, JSONB) CASCADE;
CREATE OR REPLACE FUNCTION public.save_rbac_permissions(
    p_role_permissions JSONB DEFAULT NULL,
    p_user_overrides JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_staff_id TEXT;
    v_override JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Chỉ Quản trị viên mới có quyền cập nhật ma trận phân quyền.');
    END IF;

    IF p_role_permissions IS NOT NULL THEN
        UPDATE public.settings
        SET role_permissions = p_role_permissions
        WHERE id = 1;

        INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, description, notes)
        VALUES ('rbac_role_permissions', 'Bảng Phân Quyền Vai Trò RBAC', p_role_permissions, CURRENT_DATE, true,
                'Cấu hình phân quyền vai trò nhân sự và cán bộ đại lý', 'Ma trận phân quyền vai trò chi tiết')
        ON CONFLICT DO NOTHING;

        UPDATE public.policies
        SET value = p_role_permissions, is_active = true
        WHERE parameter_type = 'rbac_role_permissions';
    END IF;

    IF p_user_overrides IS NOT NULL THEN
        UPDATE public.settings
        SET user_overrides = p_user_overrides
        WHERE id = 1;

        INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, description, notes)
        VALUES ('rbac_user_overrides', 'Phân Quyền Đặc Cách Riêng Theo Nhân Viên', p_user_overrides, CURRENT_DATE, true,
                'Cấu hình phân quyền đặc cách riêng cho từng cán bộ thu', 'Quyền cấp thêm hoặc chặn riêng từng tài khoản')
        ON CONFLICT DO NOTHING;

        UPDATE public.policies
        SET value = p_user_overrides, is_active = true
        WHERE parameter_type = 'rbac_user_overrides';

        FOR v_staff_id, v_override IN SELECT * FROM jsonb_each(p_user_overrides)
        LOOP
            UPDATE public.staff
            SET 
                custom_permissions = COALESCE(v_override->'granted', '[]'::jsonb),
                revoked_permissions = COALESCE(v_override->'revoked', '[]'::jsonb)
            WHERE id = v_staff_id;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Đã lưu cấu hình phân quyền RBAC và đặc cách nhân viên vào CSDL Supabase.');
END;
$$;

-- 3.22. RPC Đồng bộ chính sách hệ thống (sync_system_policies)
DROP FUNCTION IF EXISTS public.sync_system_policies(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.sync_system_policies() CASCADE;
CREATE OR REPLACE FUNCTION public.sync_system_policies(p_policies JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
  v_existing_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản trị viên hệ thống (Admin) mới có quyền đồng bộ chính sách gốc.' USING ERRCODE = '42501';
  END IF;

  IF p_policies IS NOT NULL AND jsonb_array_length(p_policies) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_policies)
    LOOP
      SELECT id INTO v_existing_id
      FROM public.policies
      WHERE parameter_type = (v_item->>'parameter_type')
        AND (name = (v_item->>'name') OR effective_date = (v_item->>'effective_date')::date)
      ORDER BY (name = (v_item->>'name')) DESC, id ASC
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE public.policies
        SET name = v_item->>'name',
            value = v_item->'value',
            effective_date = (v_item->>'effective_date')::date,
            is_active = COALESCE((v_item->>'is_active')::boolean, true),
            notes = COALESCE(v_item->>'notes', v_item->>'description', ''),
            description = COALESCE(v_item->>'description', v_item->>'notes', '')
        WHERE id = v_existing_id;
      ELSE
        INSERT INTO public.policies (name, parameter_type, value, effective_date, is_active, notes, description)
        VALUES (
          v_item->>'name',
          v_item->>'parameter_type',
          v_item->'value',
          (v_item->>'effective_date')::date,
          COALESCE((v_item->>'is_active')::boolean, true),
          COALESCE(v_item->>'notes', v_item->>'description', ''),
          COALESCE(v_item->>'description', v_item->>'notes', '')
        );
      END IF;
      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;

-- 3.36. RPC Đồng bộ lại thông tin tóm tắt khách hàng từ hồ sơ thực tế (resync_customer_from_records)
DROP FUNCTION IF EXISTS public.resync_customer_from_records(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.resync_customer_from_records(
    p_customer_key TEXT DEFAULT NULL,
    p_cccd TEXT DEFAULT NULL,
    p_bhxh TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    r_cust RECORD;
    r_valid RECORD;
    v_updated_count INT := 0;
    v_deleted_count INT := 0;
BEGIN
    FOR r_cust IN 
        SELECT id, customer_key, cccd, bhxh 
        FROM public.customers 
        WHERE (p_customer_key IS NULL AND p_cccd IS NULL AND p_bhxh IS NULL)
           OR (p_customer_key IS NOT NULL AND customer_key = p_customer_key)
           OR (p_cccd IS NOT NULL AND TRIM(p_cccd) != '' AND cccd = p_cccd)
           OR (p_bhxh IS NOT NULL AND TRIM(p_bhxh) != '' AND bhxh = p_bhxh)
    LOOP
        SELECT * INTO r_valid
        FROM public.records
        WHERE (
            (r_cust.customer_key IS NOT NULL AND customer_key = r_cust.customer_key)
            OR (r_cust.cccd IS NOT NULL AND TRIM(r_cust.cccd) != '' AND cccd = r_cust.cccd)
            OR (r_cust.bhxh IS NOT NULL AND TRIM(r_cust.bhxh) != '' AND bhxh = r_cust.bhxh)
        )
        AND COALESCE(payment_status, '') != 'Đã hủy'
        ORDER BY COALESCE(next_payment, to_month_date, date::date) DESC, id DESC
        LIMIT 1;

        IF r_valid.id IS NOT NULL THEN
            UPDATE public.customers
            SET
                latest_record_id = r_valid.id,
                from_month = r_valid.from_month,
                to_month = r_valid.to_month,
                next_payment = r_valid.next_payment,
                next_payment_bhxh = CASE WHEN r_valid.type = 'BHXH' THEN r_valid.next_payment ELSE NULL END,
                next_payment_bhyt = CASE WHEN r_valid.type = 'BHYT' THEN r_valid.next_payment ELSE NULL END,
                payment_status = r_valid.payment_status,
                latest_amount = r_valid.amount,
                latest_date = r_valid.date::date,
                status = COALESCE(r_valid.status, 'Đang tham gia'),
                total_amount_paid = GREATEST(0, COALESCE((
                    SELECT SUM(amount) FROM public.records 
                    WHERE ((r_cust.customer_key IS NOT NULL AND customer_key = r_cust.customer_key) 
                        OR (r_cust.cccd IS NOT NULL AND cccd = r_cust.cccd) 
                        OR (r_cust.bhxh IS NOT NULL AND bhxh = r_cust.bhxh))
                      AND payment_status = 'Đã thu tiền'
                ), 0)),
                total_contributions = GREATEST(0, COALESCE((
                    SELECT COUNT(*) FROM public.records 
                    WHERE ((r_cust.customer_key IS NOT NULL AND customer_key = r_cust.customer_key) 
                        OR (r_cust.cccd IS NOT NULL AND cccd = r_cust.cccd) 
                        OR (r_cust.bhxh IS NOT NULL AND bhxh = r_cust.bhxh))
                      AND payment_status = 'Đã thu tiền'
                ), 0)),
                updated_at = NOW()
            WHERE id = r_cust.id;

            v_updated_count := v_updated_count + 1;
        ELSE
            -- Không còn bất kỳ giao dịch hợp lệ nào: xóa khỏi customers
            DELETE FROM public.customers WHERE id = r_cust.id;
            v_deleted_count := v_deleted_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'updated_customers', v_updated_count,
        'deleted_customers', v_deleted_count,
        'message', 'Đã đồng bộ lại dữ liệu danh bạ khách hàng thành công.'
    );
END;
$$;

-- ======================================================================
-- 4. CẤP QUYỀN THỰC THI (EXECUTE GRANTS)
-- ======================================================================

GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_customer_exists(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_override_record(BIGINT, JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_record_payment(BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_current_staff_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_commission_rates_for_date(DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_finance_stats(text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_record_safe(BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bulk_delete_records_safe(BIGINT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_customer_contact(BIGINT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_records_batch(JSONB, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_refund_clawback_entry(BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_search_customers(TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finance_search_records(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_security_audit_event(TEXT, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_customer_participation(TEXT, JSONB, INT, INT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_rbac_permissions(JSONB, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_system_policies(JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_financial_period_locked(TIMESTAMP WITH TIME ZONE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.safe_cast_date(text) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.safe_cast_date(timestamptz) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.resync_customer_from_records(TEXT, TEXT, TEXT) TO authenticated, service_role;
