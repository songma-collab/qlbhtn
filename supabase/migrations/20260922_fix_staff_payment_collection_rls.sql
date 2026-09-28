-- ======================================================================
-- MIGRATION: 20260922_fix_staff_payment_collection_rls.sql
-- MỤC TIÊU:
-- 1. Khắc phục triệt để lỗi "new row violates row-level security policy for table 'records'"
--    khi nhân viên được phân quyền thu tiền thực hiện đổi trạng thái sang "Đã thu tiền"
-- 2. Tái cấu trúc hàm nhận diện cán bộ đang hoạt động: public.is_active_staff()
-- 3. Cho phép nhân viên có quyền thu tiền cập nhật paymentStatus cho mọi hồ sơ của đại lý
-- 4. Bổ sung RPC chuyên dụng: public.confirm_record_payment(record_id, new_status)
-- ======================================================================

BEGIN;

-- 1. ĐỊNH NGHĨA HÀM KIỂM TRA NHÂN VIÊN ĐANG HOẠT ĐỘNG (ACTIVE STAFF)
CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = v_uid OR (email IS NOT NULL AND LOWER(TRIM(email)) = v_email))
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, anon, service_role;


-- 2. CẬP NHẬT HÀM KIỂM TRA QUẢN LÝ / ADMIN (IS_MANAGER_OR_ADMIN)
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = v_uid OR (email IS NOT NULL AND LOWER(TRIM(email)) = v_email))
      AND LOWER(TRIM(role)) IN ('admin', 'quản lý', 'quan ly', 'quản trị viên', 'quan tri vien')
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated, anon, service_role;


-- 3. CẬP NHẬT HÀM LẤY STAFF ID HIỆN TẠI (CURRENT_STAFF_ID)
CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
  v_id TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id 
  FROM public.staff 
  WHERE auth_user_id = v_uid 
    AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  IF v_email != '' THEN
    SELECT id INTO v_id 
    FROM public.staff 
    WHERE LOWER(TRIM(email)) = v_email 
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
    LIMIT 1;
  END IF;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated, anon, service_role;


-- 4. TỰ ĐỘNG LIÊN KẾT AUTH_USER_ID KHI NHÂN VIÊN ĐĂNG NHẬP (GET_CURRENT_STAFF_PROFILE)
CREATE OR REPLACE FUNCTION public.get_current_staff_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT := LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')));
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

  -- 2. Nếu chưa liên kết auth_user_id, tìm theo email và tự động liên kết ngay
  IF v_staff IS NULL AND v_email != '' THEN
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

  -- 3. Khởi tạo Quản trị viên gốc đầu tiên nếu cơ sở dữ liệu chưa có nhân sự nào
  IF v_staff IS NULL AND v_email != '' THEN
    SELECT COUNT(*) INTO v_staff_count FROM public.staff;
    
    IF v_staff_count = 0 THEN
      INSERT INTO public.staff (id, name, email, role, status, area, "staffCode", auth_user_id)
      VALUES (
        'admin-root-' || v_uid::text,
        'Quản Trị Viên Gốc',
        v_email,
        'Admin',
        'Đang hoạt động',
        'Toàn hệ thống',
        'ADMIN-ROOT',
        v_uid
      )
      RETURNING id, name, cccd, phone, email, area, role, status, username, "staffCode", auth_user_id
      INTO v_staff;
    END IF;
  END IF;

  IF v_staff IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'NOT_FOUND: Email tài khoản chưa được khai báo trong bảng nhân sự.'
    );
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


-- 5. CẬP NHẬT CHÍNH SÁCH UPDATE BẢNG STAFF (CHO PHÉP TỰ LIÊN KẾT AUTH_USER_ID)
DROP POLICY IF EXISTS "staff_update_policy" ON public.staff;
CREATE POLICY "staff_update_policy" ON public.staff
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() 
    OR (auth_user_id = auth.uid() AND status = 'Đang hoạt động')
    OR (LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))) AND status = 'Đang hoạt động')
  )
  WITH CHECK (
    public.is_admin() 
    OR (
      (auth_user_id = auth.uid() OR auth_user_id IS NULL)
      AND role = (SELECT s.role FROM public.staff s WHERE s.id = staff.id)
      AND status = 'Đang hoạt động'
    )
  );


-- 6. TÁI CẤU TRÚC CHÍNH SÁCH RLS BẢNG RECORDS: SỬA LỖI XÁC NHẬN THU TIỀN
-- Cho phép nhân viên đang hoạt động cập nhật hồ sơ & đổi trạng thái "Đã thu tiền"
DROP POLICY IF EXISTS "records_update_authenticated" ON public.records;
CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR public.is_active_staff()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      public.is_active_staff()
      -- Nhân viên thường không được tạo bút toán âm/thoái thu nếu chưa có quyền
      AND (amount >= 0 OR amount IS NULL)
      AND (COALESCE(records.is_adjustment, records."isAdjustment", false) = false)
    )
  );

-- Cho phép nhân viên đang hoạt động thêm mới hồ sơ
DROP POLICY IF EXISTS "records_insert_authenticated" ON public.records;
CREATE POLICY "records_insert_authenticated" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      public.is_active_staff()
      AND (amount >= 0 OR amount IS NULL)
      AND (COALESCE(records.is_adjustment, records."isAdjustment", false) = false)
    )
  );


-- 7. BỔ SUNG RPC CHUYÊN DỤNG XÁC NHẬN THU TIỀN (CONFIRM_RECORD_PAYMENT)
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
  -- 1. Kiểm tra xác thực cán bộ nhân viên đang hoạt động
  IF NOT public.is_active_staff() THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Tài khoản không có quyền thao tác trên hệ thống hoặc đã bị tạm khóa.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Nếu trạng thái là 'Đã hủy', chỉ cho phép Quản lý hoặc Admin
  IF p_new_status = 'Đã hủy' AND NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Từ chối quyền hạn: Chỉ Quản lý hoặc Admin mới có quyền hủy biên lai giao dịch.'
      USING ERRCODE = '42501';
  END IF;

  -- 3. Lấy thông tin hồ sơ
  SELECT id, name, date, "paymentStatus", payment_status, "isSubmittedBHXH", is_submitted_bhxh, "staffId", staff_id
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ ID ' || p_record_id);
  END IF;

  -- 4. Kiểm tra khóa sổ kỳ tài chính
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

  -- 5. Lấy định danh cán bộ thực hiện
  v_staff_id := public.current_staff_id();
  SELECT name INTO v_staff_name FROM public.staff WHERE id = v_staff_id LIMIT 1;

  -- 6. Cập nhật trạng thái thanh toán đồng bộ cả hai trường alias
  UPDATE public.records
  SET 
    "paymentStatus" = p_new_status,
    payment_status = p_new_status
  WHERE id = p_record_id;

  -- 7. Ghi nhận nhật ký kiểm toán
  INSERT INTO public.auditlogs (action, detail, created_at)
  VALUES (
    'Xác nhận thu tiền',
    format('Cán bộ %s (%s) cập nhật trạng thái thanh toán hồ sơ %s (ID %s) từ "%s" sang "%s"',
      COALESCE(v_staff_name, 'Nhân viên'),
      COALESCE(v_staff_id, 'staff'),
      v_rec.name,
      p_record_id,
      COALESCE(v_rec."paymentStatus", v_rec.payment_status, 'Chờ thanh toán'),
      p_new_status
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'record_id', p_record_id, 'new_status', p_new_status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_record_payment(BIGINT, TEXT) TO authenticated, service_role;

COMMIT;

-- Tải lại lược đồ PostgREST trên Supabase
NOTIFY pgrst, 'reload schema';
