-- supabase/migrations/20260823000002_secure_public_intake.sql
-- GIAI ĐOẠN 3: ĐĂNG KÝ VÀ TRA CỨU CÔNG KHAI AN TOÀN (RPC & ZERO-PII PUBLIC LOOKUP)
-- Thay thế quyền công khai cũ trong database_schema.sql và security_p0_remediation.sql

-- ======================================================================
-- 1. THU HỒI QUYỀN ANON TRÊN CÁC HÀM TRẢ VỀ PII ĐẦY ĐỦ
-- ======================================================================

REVOKE EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) TO authenticated;

-- Cập nhật lookup_customer_profile: Chỉ nhân viên/admin đã đăng nhập mới được gọi
CREATE OR REPLACE FUNCTION public.lookup_customer_profile(p_code TEXT)
RETURNS TABLE (
  name TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  cccd TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  bhxh TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Chỉ tài khoản cán bộ thu hoặc quản trị viên đã đăng nhập mới có quyền tra cứu PII đầy đủ
  IF auth.role() != 'authenticated' OR public.get_my_role() NOT IN ('Admin', 'Quản lý', 'Nhân viên') THEN
    RAISE EXCEPTION 'Access denied: Yêu cầu đăng nhập tài khoản cán bộ để tra cứu hồ sơ người dân.';
  END IF;

  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    r.name,
    r.dob,
    r.gender,
    r.nation,
    r.cccd,
    r.phone,
    r.email,
    r.address,
    r.bhxh
  FROM public.records r
  WHERE r."paymentStatus" != 'Đã hủy'
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC
  LIMIT 1;
END;
$$;


-- ======================================================================
-- 2. RPC TIẾP NHẬN HỒ SƠ ĐĂNG KÝ CÔNG KHAI (WHITELIST & VALIDATION CHẶT CHẼ)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.public_register_customer(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_cccd text;
  v_phone text;
  v_bhxh text;
  v_dob date;
  v_gender text;
  v_nation text;
  v_email text;
  v_address text;
  v_type text;
  v_method text;
  v_months integer;
  v_income numeric;
  v_from_month text;
  v_to_month text;
  v_notes text;
  v_recv_name text;
  v_recv_phone text;
  v_recv_address text;
  v_members jsonb;
  v_record_id bigint;
  v_client_ip text := '127.0.0.1';
  v_headers json;
  v_count_24h integer := 0;
BEGIN
  -- 1. Rate-limiting kiểm tra IP (Tối đa 5 lượt đăng ký / 24h đối với khách vãng lai)
  IF auth.role() = 'anon' THEN
    BEGIN
      v_headers := current_setting('request.headers', true)::json;
      IF v_headers IS NOT NULL THEN
        v_client_ip := COALESCE(
          v_headers->>'cf-connecting-ip',
          split_part(v_headers->>'x-forwarded-for', ',', 1),
          '127.0.0.1'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_client_ip := '127.0.0.1';
    END;

    v_client_ip := TRIM(v_client_ip);

    SELECT COUNT(*) INTO v_count_24h
    FROM public.records
    WHERE ip_address = v_client_ip
      AND date >= (NOW() - INTERVAL '24 hours');

    IF v_count_24h >= 5 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'RATE_LIMIT_EXCEEDED',
        'message', 'Địa chỉ mạng của bạn đã đạt giới hạn 5 lượt đăng ký trong 24 giờ. Vui lòng quay lại sau hoặc liên hệ điểm thu.'
      );
    END IF;
  END IF;

  -- 2. Trích xuất và xác thực Whitelist các trường
  v_name := TRIM(COALESCE(p_payload->>'name', ''));
  v_cccd := TRIM(COALESCE(p_payload->>'cccd', ''));
  v_phone := TRIM(COALESCE(p_payload->>'phone', ''));
  v_bhxh := TRIM(COALESCE(p_payload->>'bhxh', ''));
  v_gender := TRIM(COALESCE(p_payload->>'gender', 'Nam'));
  v_nation := TRIM(COALESCE(p_payload->>'nation', 'Kinh'));
  v_email := TRIM(COALESCE(p_payload->>'email', ''));
  v_address := TRIM(COALESCE(p_payload->>'address', ''));
  v_type := UPPER(TRIM(COALESCE(p_payload->>'type', 'BHXH')));
  v_method := TRIM(COALESCE(p_payload->>'method', ''));
  v_months := COALESCE((p_payload->>'months')::integer, 1);
  v_income := COALESCE((p_payload->>'income')::numeric, 0);
  v_from_month := TRIM(COALESCE(p_payload->>'fromMonth', ''));
  v_to_month := TRIM(COALESCE(p_payload->>'toMonth', ''));
  v_notes := TRIM(COALESCE(p_payload->>'notes', ''));
  v_recv_name := TRIM(COALESCE(p_payload->>'recvName', ''));
  v_recv_phone := TRIM(COALESCE(p_payload->>'recvPhone', ''));
  v_recv_address := TRIM(COALESCE(p_payload->>'recvAddress', ''));
  v_members := p_payload->'members';

  -- Validation cơ bản
  IF LENGTH(v_name) < 2 OR LENGTH(v_name) > 100 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Họ và tên người đăng ký không hợp lệ (từ 2-100 ký tự).');
  END IF;

  IF v_type NOT IN ('BHXH', 'BHYT') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Loại hình bảo hiểm không hợp lệ.');
  END IF;

  IF v_cccd != '' AND v_cccd !~ '^\d{12}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số CCCD phải gồm đúng 12 chữ số.');
  END IF;

  IF v_phone != '' AND v_phone !~ '^0\d{9}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.');
  END IF;

  IF v_bhxh != '' AND v_bhxh !~ '^\d{10}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mã số BHXH phải gồm đúng 10 chữ số.');
  END IF;

  -- 3. Xử lý ngày sinh an toàn
  BEGIN
    v_dob := (p_payload->>'dob')::date;
  EXCEPTION WHEN OTHERS THEN
    v_dob := NULL;
  END;

  -- 4. Chèn bản ghi với các thuộc tính bảo vệ (Cưỡng chế Chờ duyệt, staffId = NULL)
  INSERT INTO public.records (
    "name", "cccd", "phone", "bhxh", "dob", "gender", "nation", "email", "address",
    "type", "method", "months", "income", "fromMonth", "toMonth", "notes",
    "recvName", "recvPhone", "recvAddress", "members",
    "paymentStatus", "status", "actionType", "staffId", "date", "ip_address"
  ) VALUES (
    v_name, v_cccd, v_phone, v_bhxh, v_dob, v_gender, v_nation, v_email, v_address,
    v_type, v_method, v_months, v_income, v_from_month, v_to_month, v_notes,
    v_recv_name, v_recv_phone, v_recv_address, v_members,
    'Chờ duyệt', 'Chờ duyệt', 'Đăng ký trực tuyến', NULL, NOW(), v_client_ip
  )
  RETURNING id INTO v_record_id;

  -- Ghi nhận audit log nội bộ (ẩn PII chi tiết trong log)
  INSERT INTO public.auditlogs (id, "userId", "userName", action, details, timestamp)
  VALUES (
    gen_random_uuid()::text,
    'anonymous-public-intake',
    'Khách vãng lai trực tuyến',
    'Tiếp nhận đơn trực tuyến',
    'Đã tiếp nhận yêu cầu tham gia ' || v_type || ' của người dân (Mã yêu cầu #' || v_record_id::text || ')',
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Đã tiếp nhận yêu cầu tham gia thành công. Cán bộ thu sẽ liên hệ hướng dẫn hoàn tất thủ tục.',
    'recordId', v_record_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO anon, authenticated;


-- ======================================================================
-- 3. RPC TRA CỨU QUÁ TRÌNH THAM GIA KHÔNG LỘ PII (ZERO-PII TIMELINE)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.public_lookup_process(p_code TEXT, p_type TEXT)
RETURNS TABLE (
  masked_name TEXT,
  masked_cccd TEXT,
  type TEXT,
  from_month TEXT,
  to_month TEXT,
  months INTEGER,
  status TEXT,
  payment_status TEXT,
  registration_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    -- Masking họ tên: ví dụ "Nguyễn Văn An" -> "Ng*** An"
    CASE 
      WHEN LENGTH(r.name) > 4 THEN SUBSTRING(r.name FROM 1 FOR 2) || '*** ' || SPLIT_PART(r.name, ' ', -1)
      ELSE '***'
    END AS masked_name,
    -- Masking CCCD: ví dụ "012345678901" -> "******8901"
    CASE 
      WHEN LENGTH(r.cccd) = 12 THEN '******' || RIGHT(r.cccd, 4)
      ELSE '******'
    END AS masked_cccd,
    r.type,
    COALESCE(r."fromMonth", ''),
    COALESCE(r."toMonth", ''),
    COALESCE(r.months, 1),
    COALESCE(r.status, 'Đang tham gia'),
    COALESCE(r."paymentStatus", ''),
    (r.date)::date
  FROM public.records r
  WHERE r."paymentStatus" != 'Đã hủy'
    AND r.type = UPPER(TRIM(p_type))
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO anon, authenticated;


-- ======================================================================
-- 4. RPC KIỂM TRA SỰ TỒN TẠI KHÁCH HÀNG CHỐNG ENUMERATION (NEUTRAL RESPONSE)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.check_customer_exists(p_code TEXT)
RETURNS TABLE (
  customer_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN QUERY SELECT false AS customer_exists;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT EXISTS (
    SELECT 1 FROM public.records r
    WHERE r."paymentStatus" != 'Đã hủy'
      AND (
        (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
        (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
      )
  ) AS customer_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_customer_exists(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
