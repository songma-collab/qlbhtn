-- ======================================================================
-- NỀN TẢNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ
-- MIGRATION: 20261023000001_hardening_security_audit.sql
-- ======================================================================
-- BẢN VÁ BẢO MẬT BỔ SUNG TOÀN DIỆN (POST-AUDIT SECURITY HARDENING)
-- Khắc phục triệt để 6 lỗ hổng bảo mật tầng Database & RPC:
-- 1. [CRITICAL] Thu hồi quyền anon còn sót trên public_get_renewal_info & v_records_unified.
-- 2. [CRITICAL] Siết chặt RLS bảng customer_participations theo quyền sở hữu của cán bộ thu.
-- 3. [CRITICAL] Vá lỗ hổng leo thang đặc quyền & IDOR trong save_customer_participation.
-- 4. [CRITICAL] Vá lỗ hổng IDOR & ghi khống thu tiền trong confirm_record_payment.
-- 5. [HIGH] Chặn tài khoản tạm khóa dump PII qua lookup_customer_profile.
-- 6. [MEDIUM] Vá lỗ hổng IDOR ghi chú rác trong log_customer_contact.
-- 7. [HIGH] Hạn chế hàm đồng bộ dữ liệu resync_customer_from_records chỉ dành cho Quản lý/Admin.
-- 8. [MEDIUM] Khôi phục đầy đủ 8 cột bậc thang hoa hồng STABLE trong get_commission_rates_for_date.
-- ======================================================================

-- ----------------------------------------------------------------------
-- PHẦN 1: THU HỒI TRIỆT ĐỂ QUYỀN ANON TRÊN CÁC HÀM & VIEW NHẠY CẢM
-- ----------------------------------------------------------------------

-- 1.1. Thu hồi quyền thực thi trực tiếp từ anon đối với hàm gia hạn (bắt buộc qua Edge Function)
REVOKE EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) TO service_role, authenticated;

-- 1.2. Thu hồi quyền đọc trực tiếp của anon trên View hợp nhất dữ liệu (nếu có)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_records_unified') THEN
    EXECUTE 'REVOKE SELECT ON public.v_records_unified FROM anon';
  END IF;
END $$;


-- ----------------------------------------------------------------------
-- PHẦN 2: SIẾT CHẶT RLS BẢNG CUSTOMER_PARTICIPATIONS
-- ----------------------------------------------------------------------

ALTER TABLE public.customer_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_participations_read" ON public.customer_participations;
DROP POLICY IF EXISTS "customer_participations_manage" ON public.customer_participations;
DROP POLICY IF EXISTS "customer_participations_select_policy" ON public.customer_participations;
DROP POLICY IF EXISTS "customer_participations_write_policy" ON public.customer_participations;

-- Chính sách SELECT: Chỉ Quản lý/Admin hoặc Cán bộ quản lý khách hàng đó mới được xem
CREATE POLICY "customer_participations_select_policy" ON public.customer_participations
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = customer_participations.customer_id
        AND (c.staff_id = public.current_staff_id() OR c.staff_id IS NULL)
    )
  );

-- Chính sách GHI (INSERT, UPDATE, DELETE): Chỉ Quản lý/Admin hoặc Cán bộ phụ trách đang hoạt động
CREATE POLICY "customer_participations_write_policy" ON public.customer_participations
  FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      public.is_active_staff() AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_participations.customer_id
          AND (c.staff_id = public.current_staff_id() OR c.staff_id IS NULL)
      )
    )
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      public.is_active_staff() AND EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_participations.customer_id
          AND (c.staff_id = public.current_staff_id() OR c.staff_id IS NULL)
      )
    )
  );


-- ----------------------------------------------------------------------
-- PHẦN 3: VÁ LỖ HỔNG IDOR & PHÂN QUYỀN TRONG save_customer_participation
-- ----------------------------------------------------------------------

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
    v_cust_staff_id TEXT;
    v_item JSONB;
BEGIN
    -- 1. Kiểm tra tài khoản cán bộ đang hoạt động
    IF NOT public.is_active_staff() AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Tài khoản không hợp lệ hoặc đã bị tạm khóa.' USING ERRCODE = '42501';
    END IF;

    -- 2. Tìm hồ sơ khách hàng theo ID, customer_key, CCCD hoặc Mã số BHXH
    SELECT id, customer_key, cccd, bhxh, staff_id
    INTO v_cust_id, v_cust_key, v_cust_cccd, v_cust_bhxh, v_cust_staff_id
    FROM public.customers
    WHERE id::text = p_target_key
       OR customer_key = p_target_key
       OR cccd = p_target_key
       OR bhxh = p_target_key
    LIMIT 1;

    IF v_cust_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ khách hàng.');
    END IF;

    -- 3. Kiểm tra quyền sở hữu khách hàng nếu không phải Quản lý/Admin
    IF NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
        IF v_cust_staff_id IS NOT NULL AND v_cust_staff_id != public.current_staff_id() THEN
            RAISE EXCEPTION 'Access Denied: Bạn không có quyền chỉnh sửa quá trình tham gia của khách hàng thuộc nhân viên khác.'
              USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 4. Cập nhật thông tin quá trình tham gia trên bảng customers
    UPDATE public.customers
    SET 
        prior_periods = COALESCE(p_prior_periods, '[]'::jsonb),
        prior_voluntary_months = COALESCE(p_prior_voluntary_months, 0),
        prior_compulsory_months = COALESCE(p_prior_compulsory_months, 0),
        prior_participation_notes = p_prior_participation_notes,
        updated_at = NOW()
    WHERE id = v_cust_id;

    -- 5. Đồng bộ chi tiết vào bảng customer_participations
    DELETE FROM public.customer_participations WHERE customer_id = v_cust_id;

    IF p_prior_periods IS NOT NULL AND jsonb_typeof(p_prior_periods) = 'array' THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_prior_periods)
        LOOP
            INSERT INTO public.customer_participations (
                customer_id, customer_key, cccd, bhxh, type, position, workplace,
                from_month, from_year, to_month, to_year, months, salary, notes
            ) VALUES (
                v_cust_id, v_cust_key, v_cust_cccd, v_cust_bhxh,
                COALESCE(v_item->>'type', 'batbuoc'),
                v_item->>'position', v_item->>'workplace',
                COALESCE((v_item->>'sm')::INT, 1), COALESCE((v_item->>'sy')::INT, 2020),
                COALESCE((v_item->>'em')::INT, 12), COALESCE((v_item->>'ey')::INT, 2020),
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

GRANT EXECUTE ON FUNCTION public.save_customer_participation(TEXT, JSONB, INT, INT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- PHẦN 4: VÁ LỖ HỔNG confirm_record_payment (CHỐNG GHI KHỐNG & IDOR)
-- ----------------------------------------------------------------------

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
BEGIN
  -- 1. Kiểm tra tài khoản cán bộ đang hoạt động
  IF NOT public.is_active_staff() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Tài khoản không có quyền thao tác hoặc đã bị tạm khóa.' USING ERRCODE = '42501';
  END IF;

  -- 2. Kiểm tra danh sách trạng thái thanh toán hợp lệ (Whitelist)
  IF p_new_status NOT IN ('Đã thu tiền', 'Chờ thanh toán', 'Chờ thu tiền', 'Chờ duyệt', 'Đã hủy') THEN
    RAISE EXCEPTION 'Trạng thái thanh toán không hợp lệ.' USING ERRCODE = '23514';
  END IF;

  -- 3. Chỉ Quản lý hoặc Admin mới được phép hủy biên lai giao dịch
  IF p_new_status = 'Đã hủy' AND NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Chỉ Quản lý hoặc Admin mới có quyền hủy biên lai giao dịch.' USING ERRCODE = '42501';
  END IF;

  -- 4. Tìm kiếm hồ sơ cần cập nhật
  SELECT id, name, date, payment_status, is_submitted_bhxh, staff_id
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ ID ' || p_record_id);
  END IF;

  v_staff_id := public.current_staff_id();

  -- 5. Chặn nhân viên sửa trạng thái thu tiền hồ sơ của nhân viên khác (Chống IDOR)
  IF NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
    IF v_rec.staff_id IS NOT NULL AND v_rec.staff_id != v_staff_id THEN
      RAISE EXCEPTION 'Từ chối quyền hạn: Bạn không thể xác nhận thu tiền cho hồ sơ của cán bộ khác.' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 6. Chặn nhân viên thường tự ý chuyển ngược từ 'Đã thu tiền' về trạng thái khác
  IF NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
    IF v_rec.payment_status = 'Đã thu tiền' AND p_new_status != 'Đã thu tiền' THEN
      RAISE EXCEPTION 'Từ chối quyền hạn: Hồ sơ đã thu tiền chỉ Quản lý hoặc Admin mới được phép hoàn tác trạng thái.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 7. Kiểm tra khóa kỳ kế toán tập trung
  IF v_rec.date IS NOT NULL AND public.is_financial_period_locked(v_rec.date) THEN
    RAISE EXCEPTION 'Kỳ kế toán đã bị khóa sổ. Không thể thay đổi trạng thái thanh toán!' USING ERRCODE = '23514';
  END IF;

  -- 8. Cập nhật trạng thái thanh toán
  SELECT name INTO v_staff_name FROM public.staff WHERE id = v_staff_id LIMIT 1;

  UPDATE public.records
  SET payment_status = p_new_status
  WHERE id = p_record_id;

  -- 9. Ghi nhận nhật ký kiểm toán hệ thống (Audit Trail)
  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    COALESCE(auth.uid()::text, v_staff_id, 'staff'),
    COALESCE(v_staff_name, 'Nhân viên'),
    'Xác nhận thu tiền',
    format('Cán bộ %s (%s) cập nhật trạng thái thanh toán hồ sơ %s (ID %s) từ "%s" sang "%s"',
      COALESCE(v_staff_name, 'Nhân viên'), COALESCE(v_staff_id, 'staff'),
      v_rec.name, p_record_id, COALESCE(v_rec.payment_status, 'Chờ thanh toán'), p_new_status
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'new_status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_record_payment(BIGINT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- PHẦN 5: VÁ LỖ HỔNG log_customer_contact (CHỐNG GHI CHÚ RÁC & IDOR)
-- ----------------------------------------------------------------------

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
    v_rec_staff TEXT;
BEGIN
    -- 1. Bắt buộc tài khoản nhân viên đang hoạt động
    IF NOT public.is_active_staff() AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Quyền truy cập bị từ chối: Tài khoản không hoạt động hoặc đã bị tạm khóa.' USING ERRCODE = '42501';
    END IF;

    -- 2. Tìm hồ sơ
    SELECT name, notes, staff_id INTO v_rec_name, v_old_notes, v_rec_staff
    FROM public.records
    WHERE id = p_record_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ với ID ' || p_record_id);
    END IF;

    -- 3. Chặn ghi chú vào hồ sơ của nhân viên khác nếu không phải Quản lý/Admin
    IF NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
        IF v_rec_staff IS NOT NULL AND v_rec_staff != public.current_staff_id() THEN
            RAISE EXCEPTION 'Quyền truy cập bị từ chối: Không thể ghi chú vào hồ sơ do cán bộ khác quản lý.' USING ERRCODE = '42501';
        END IF;
    END IF;

    v_timestamp := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI');
    v_old_notes := COALESCE(v_old_notes, '');
    v_new_notes := TRIM(p_note) || ' [' || TRIM(COALESCE(p_channel, 'Trực tiếp')) || '] (' || v_timestamp || ')';
    
    IF v_old_notes <> '' THEN
        v_new_notes := v_new_notes || E'\n' || v_old_notes;
    END IF;

    UPDATE public.records SET notes = v_new_notes WHERE id = p_record_id;

    INSERT INTO public.auditlogs (action, details, user_id, user_name, timestamp)
    VALUES (
        'Nhật ký tiếp xúc khách hàng',
        'Cập nhật đôn đốc cho KH ID ' || p_record_id || ' (' || COALESCE(v_rec_name, '') || '): ' || TRIM(p_note),
        COALESCE(auth.uid()::TEXT, 'system'),
        COALESCE(auth.jwt() ->> 'email', 'Hệ thống'),
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'notes', v_new_notes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_customer_contact(BIGINT, TEXT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- PHẦN 6: VÁ LỖ HỔNG lookup_customer_profile (BẮT BUỘC is_active_staff)
-- ----------------------------------------------------------------------

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
  -- 1. Bắt buộc tài khoản nhân viên đang hoạt động hợp lệ (Chặn triệt để tài khoản đã bị Tạm khóa)
  IF NOT public.is_active_staff() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: Quyền tra cứu thông tin khách hàng chỉ dành cho nhân sự đang hoạt động trong hệ thống.'
      USING ERRCODE = '42501';
  END IF;

  v_clean := REGEXP_REPLACE(COALESCE(p_code, ''), '\D', '', 'g');
  IF v_clean !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  -- 2. Tra cứu từ bảng Master Customers kết hợp record gần nhất
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

  -- 3. Fallback: Tra cứu trong records nếu chưa đồng bộ sang bảng customers
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
  WHERE (
      (r.cccd = v_clean) OR
      (r.bhxh = v_clean) OR
      (r.old_bhxh = v_clean)
  )
  ORDER BY r.date DESC, r.id DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- PHẦN 7: BẢO VỆ CÁC HÀM ĐỒNG BỘ DỮ LIỆU HẠ TẦNG (CHỐNG DoS)
-- ----------------------------------------------------------------------

-- 7.1. sync_customer_master_data_for_key: Chỉ cấp cho service_role và gọi nội bộ
REVOKE EXECUTE ON FUNCTION public.sync_customer_master_data_for_key(TEXT) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.sync_customer_master_data_for_key(TEXT) TO service_role;

-- 7.2. resync_customer_from_records: Chỉ Quản lý hoặc Admin mới có quyền kích hoạt quét toàn bảng
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
    v_key TEXT;
    v_synced_count INT := 0;
BEGIN
    IF NOT public.is_manager_or_admin() AND auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Access Denied: Chỉ Quản lý hoặc Admin mới được phép đồng bộ lại danh bạ khách hàng.'
          USING ERRCODE = '42501';
    END IF;

    FOR v_key IN 
        SELECT DISTINCT COALESCE(customer_key, public.generate_customer_key(type, bhxh, cccd, name, phone))
        FROM public.records
        WHERE (p_customer_key IS NULL AND p_cccd IS NULL AND p_bhxh IS NULL)
           OR (p_customer_key IS NOT NULL AND (customer_key = p_customer_key OR cccd = p_customer_key OR bhxh = p_customer_key))
           OR (p_cccd IS NOT NULL AND TRIM(p_cccd) != '' AND cccd = p_cccd)
           OR (p_bhxh IS NOT NULL AND TRIM(p_bhxh) != '' AND bhxh = p_bhxh)
    LOOP
        PERFORM public.sync_customer_master_data_for_key(v_key);
        v_synced_count := v_synced_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'synced_count', v_synced_count,
        'message', format('Đã đồng bộ lại dữ liệu cho %s khách hàng.', v_synced_count)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resync_customer_from_records(TEXT, TEXT, TEXT) TO authenticated, service_role;


-- ----------------------------------------------------------------------
-- PHẦN 8: KHÔI PHỤC ĐẦY ĐỦ 8 CỘT BẬC THANG HOA HỒNG (STABLE, CHUẨN XÁC)
-- ----------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_commission_rates_for_date(DATE) CASCADE;
CREATE OR REPLACE FUNCTION public.get_commission_rates_for_date(p_date DATE)
RETURNS TABLE (
  comm_bhxh_new NUMERIC,
  comm_bhxh_renew NUMERIC,
  comm_bhyt_new NUMERIC,
  comm_bhyt_renew NUMERIC,
  comm_bhxh_new_1m NUMERIC,
  comm_bhxh_new_3m NUMERIC,
  comm_bhxh_new_6m NUMERIC,
  comm_bhxh_new_12m NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_val JSONB;
  v_d DATE := COALESCE(p_date, CURRENT_DATE);
BEGIN
  -- 1. Tìm chính sách hoa hồng có ngày hiệu lực <= ngày của hồ sơ (hỗ trợ cả commission và commission_rate)
  SELECT value INTO v_val
  FROM public.policies
  WHERE parameter_type IN ('commission', 'commission_rate')
    AND effective_date <= v_d
    AND is_active = true
  ORDER BY effective_date DESC, id DESC
  LIMIT 1;

  -- 2. Nếu không tìm thấy, lấy chính sách đang kích hoạt gần nhất
  IF v_val IS NULL THEN
    SELECT value INTO v_val
    FROM public.policies
    WHERE parameter_type IN ('commission', 'commission_rate') AND is_active = true
    ORDER BY id DESC
    LIMIT 1;
  END IF;

  -- 3. Trả về đầy đủ 8 cột bậc thang, kết hợp fallback linh hoạt bảng settings
  RETURN QUERY
  SELECT 
    COALESCE((v_val->>'commBHXHNew12M')::NUMERIC, (v_val->>'commBHXHNew')::NUMERIC, (v_val->>'comm_bhxh_new')::NUMERIC, (v_val->>'bhxh_new')::NUMERIC, s.comm_bhxh_new, 20::NUMERIC) AS comm_bhxh_new,
    COALESCE((v_val->>'commBHXHRenew')::NUMERIC, (v_val->>'comm_bhxh_renew')::NUMERIC, (v_val->>'bhxh_renew')::NUMERIC, s.comm_bhxh_renew, 9::NUMERIC) AS comm_bhxh_renew,
    COALESCE((v_val->>'commBHYTNew')::NUMERIC, (v_val->>'comm_bhyt_new')::NUMERIC, (v_val->>'bhyt_new')::NUMERIC, s.comm_bhyt_new, 9::NUMERIC) AS comm_bhyt_new,
    COALESCE((v_val->>'commBHYTRenew')::NUMERIC, (v_val->>'comm_bhyt_renew')::NUMERIC, (v_val->>'bhyt_renew')::NUMERIC, s.comm_bhyt_renew, 5::NUMERIC) AS comm_bhyt_renew,
    COALESCE((v_val->>'commBHXHNew1M')::NUMERIC, (v_val->>'comm_bhxh_new_1m')::NUMERIC, (v_val->>'commBHXHNew')::NUMERIC, (v_val->>'bhxh_new')::NUMERIC, 12::NUMERIC) AS comm_bhxh_new_1m,
    COALESCE((v_val->>'commBHXHNew3M')::NUMERIC, (v_val->>'comm_bhxh_new_3m')::NUMERIC, (v_val->>'commBHXHNew')::NUMERIC, (v_val->>'bhxh_new')::NUMERIC, 15::NUMERIC) AS comm_bhxh_new_3m,
    COALESCE((v_val->>'commBHXHNew6M')::NUMERIC, (v_val->>'comm_bhxh_new_6m')::NUMERIC, (v_val->>'commBHXHNew')::NUMERIC, (v_val->>'bhxh_new')::NUMERIC, 17::NUMERIC) AS comm_bhxh_new_6m,
    COALESCE((v_val->>'commBHXHNew12M')::NUMERIC, (v_val->>'commBHXHNew')::NUMERIC, (v_val->>'comm_bhxh_new')::NUMERIC, (v_val->>'bhxh_new')::NUMERIC, 20::NUMERIC) AS comm_bhxh_new_12m
  FROM (SELECT 1) dummy
  LEFT JOIN public.settings s ON true
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_commission_rates_for_date(DATE) TO authenticated, service_role, anon;
