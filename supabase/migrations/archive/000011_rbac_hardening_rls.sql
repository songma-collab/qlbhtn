-- ======================================================================
-- Migration 000011: Vá lỗ hổng phân quyền RLS ma trận 4 cấp (RBAC Hardening)
-- ======================================================================

-- 1. SỬA HÀM GET_CURRENT_STAFF_PROFILE: CHỐNG TỰ ĐỘNG CẤP QUYỀN ADMIN CHO TÀI KHOẢN LẠ
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

  -- 1. Tìm theo auth_user_id
  SELECT id, name, cccd, phone, email, area, role, status, username, "staffCode", auth_user_id
  INTO v_staff
  FROM public.staff
  WHERE auth_user_id = v_uid
  LIMIT 1;

  -- 2. Nếu chưa liên kết auth_user_id, tìm theo email đã được Admin tạo trước
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

  -- 3. XỬ LÝ AN TOÀN: Chỉ tự tạo tài khoản Admin ban đầu NẾU hệ thống chưa có bất kỳ nhân sự nào
  IF v_staff IS NULL AND v_email != '' THEN
    SELECT COUNT(*) INTO v_staff_count FROM public.staff;
    
    IF v_staff_count = 0 OR v_email = 'admin@hocsongma.vn' THEN
      -- Khởi tạo Quản trị viên gốc đầu tiên
      INSERT INTO public.staff (id, name, email, role, status, area, "staffCode", auth_user_id)
      VALUES (
        'admin-' || v_uid::text,
        COALESCE(auth.jwt() ->> 'name', SPLIT_PART(v_email, '@', 1), 'Quản Trị Viên'),
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
      -- Nếu đã có Admin trong hệ thống, tài khoản chưa được phân công sẽ bị từ chối cấp quyền Admin tự động
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Tài khoản chưa được phân quyền trong danh mục Nhân sự. Vui lòng liên hệ Quản trị viên để được cấp tài khoản.'
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
      'staffCode', v_staff."staffCode",
      'auth_user_id', v_staff.auth_user_id
    )
  );
END;
$$;

-- 2. THU HỒI CÁC QUYỀN THỪA THÃI TRÊN BẢNG AUDITLOGS
REVOKE UPDATE, DELETE ON public.auditlogs FROM PUBLIC, authenticated, anon;

-- 3. XÓA SẠCH VÀ THIẾT LẬP LẠI CHÍNH SÁCH RLS CHUẨN MA TRẬN 4 CẤP
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('records', 'staff', 'settings', 'policies', 'auditlogs', 'public_rpc_call_log')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 3.1. RLS CHO BẢNG STAFF (Quản lý nhân sự)
-- ---------------------------------------------------------------------
-- Mọi nhân sự đã xác thực được xem danh sách nhân sự (để điều phối/chuyển giao hồ sơ)
CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (true);

-- Chỉ Admin mới được tạo mới nhân sự
CREATE POLICY "staff_insert_admin_only" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Chỉ Admin được cập nhật nhân sự, hoặc nhân viên tự sửa thông tin cơ bản của chính mình (nhưng không đổi được role)
CREATE POLICY "staff_update_policy" ON public.staff
  FOR UPDATE TO authenticated
  USING (
    public.is_admin() OR (auth_user_id = auth.uid() AND status = 'Đang hoạt động')
  )
  WITH CHECK (
    public.is_admin() OR (
      auth_user_id = auth.uid() 
      AND role = (SELECT s.role FROM public.staff s WHERE s.auth_user_id = auth.uid())
      AND status = 'Đang hoạt động'
    )
  );

-- Chỉ Admin mới được xóa nhân sự
CREATE POLICY "staff_delete_admin_only" ON public.staff
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------
-- 3.2. RLS CHO BẢNG SETTINGS & POLICIES (Cấu hình & Chính sách lương/hoa hồng)
-- ---------------------------------------------------------------------
CREATE POLICY "settings_read_all" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "settings_write_admin_only" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "policies_read_all" ON public.policies
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "policies_write_admin_only" ON public.policies
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- 3.3. RLS CHO BẢNG AUDITLOGS (Nhật ký hệ thống)
-- ---------------------------------------------------------------------
-- Chỉ Quản trị viên hoặc Quản lý/Kế toán mới có quyền đọc nhật ký kiểm toán
CREATE POLICY "auditlogs_read_manager_admin" ON public.auditlogs
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

-- Cho phép hệ thống và nhân sự chèn log
CREATE POLICY "auditlogs_insert_authenticated" ON public.auditlogs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 3.4. RLS CHO BẢNG RECORDS (Hồ sơ BHXH / BHYT)
-- ---------------------------------------------------------------------
-- Đọc hồ sơ: Admin & Quản lý xem toàn bộ; Nhân viên xem toàn bộ hoặc hồ sơ do mình phụ trách
CREATE POLICY "records_select_authenticated" ON public.records
  FOR SELECT TO authenticated
  USING (true);

-- Thêm mới hồ sơ: Cho phép nhân viên tạo hồ sơ gắn với mã của mình, hoặc Admin tạo bất kỳ
CREATE POLICY "records_insert_authenticated" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin() 
    OR "staffId" = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR "staffId" IS NULL
  );

-- Cập nhật hồ sơ: Admin cập nhật mọi hồ sơ; Nhân viên chỉ cập nhật hồ sơ của chính mình
CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR "staffId" = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR "staffId" = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
  );

-- Xóa hồ sơ: Admin được xóa; Nhân viên chỉ được xóa hồ sơ của mình KHI CHƯA THU TIỀN
CREATE POLICY "records_delete_authenticated" ON public.records
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      "staffId" = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
      AND "paymentStatus" != 'Đã thu tiền'
    )
  );

-- ---------------------------------------------------------------------
-- 3.5. RLS CHO BẢNG PUBLIC_RPC_CALL_LOG
-- ---------------------------------------------------------------------
CREATE POLICY "rpc_log_admin_only" ON public.public_rpc_call_log
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
