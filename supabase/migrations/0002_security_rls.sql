-- ======================================================================
-- NỀN TẢNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ
-- BASELINE MIGRATION 0002: ROW LEVEL SECURITY & PERMISSIONS (RLS 4 CẤP)
-- ======================================================================
-- Mục đích: Thiết lập chính sách bảo mật đa tầng, phân quyền vai trò (RBAC),
-- Bảo vệ PII công dân và cô lập dữ liệu theo cán bộ thu.
-- Naming Convention: 100% snake_case, đồng bộ với Baseline Schema 0001.
-- ======================================================================

-- 1. CÁC HÀM HELPER KIỂM TRA QUYỀN NỘI BỘ (SECURITY DEFINER)
-- ======================================================================

-- 1.1. Hàm kiểm tra quyền Quản trị viên (is_admin)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = v_uid
      AND LOWER(TRIM(role)) IN ('admin', 'quản trị viên', 'quan tri vien')
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;

-- 1.2. Hàm kiểm tra quyền Quản lý hoặc Quản trị viên (is_manager_or_admin)
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = v_uid
      AND LOWER(TRIM(role)) IN ('admin', 'quản lý', 'quan ly', 'quản trị viên', 'quan tri vien')
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;

-- 1.3. Alias cho is_manager_or_admin
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN public.is_manager_or_admin();
END;
$$;

-- 1.4. Hàm kiểm tra nhân viên đang hoạt động (Active Staff)
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

-- 1.5. Hàm lấy mã định danh cán bộ thu hiện tại (current_staff_id)
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
    RETURN v_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 1.6. Hàm truy vấn vai trò người dùng (get_my_role)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Ưu tiên 1: Tra cứu theo auth.uid()
  IF auth.uid() IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN lower(role) = 'admin' THEN 'Admin'
        WHEN lower(role) = 'quản lý' THEN 'Quản lý'
        ELSE role
      END INTO v_role
    FROM public.staff 
    WHERE auth_user_id = auth.uid() 
      AND status != 'Tạm khóa'
    LIMIT 1;

    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  -- Ưu tiên 2: Fallback tra cứu qua JWT email
  IF auth.jwt()->>'email' IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN lower(role) = 'admin' THEN 'Admin'
        WHEN lower(role) = 'quản lý' THEN 'Quản lý'
        ELSE role
      END INTO v_role
    FROM public.staff 
    WHERE lower(email) = lower(auth.jwt()->>'email')
      AND status != 'Tạm khóa'
    LIMIT 1;

    IF v_role IS NOT NULL THEN
      RETURN v_role;
    END IF;
  END IF;

  RETURN 'anon';
END;
$$;

-- 1.7. Hàm truy vấn staff ID an toàn (get_my_staff_id)
CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.current_staff_id();
END;
$$;

-- 1.8. Hàm liên kết staff_id với auth_user_id (link_staff_auth_user)
DROP FUNCTION IF EXISTS public.link_staff_auth_user(TEXT, UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.link_staff_auth_user(
  p_staff_id TEXT,
  p_auth_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.get_my_role() != 'Admin' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Chỉ Admin mới có quyền liên kết tài khoản định danh.';
  END IF;

  UPDATE public.staff
  SET auth_user_id = p_auth_user_id
  WHERE id = p_staff_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_staff_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_staff_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.link_staff_auth_user(TEXT, UUID) TO authenticated, service_role;

-- ======================================================================
-- 2. KÍCH HOẠT ROW LEVEL SECURITY (RLS) TRÊN TOÀN BỘ 10 BẢNG
-- ======================================================================

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditlogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_rpc_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settlements ENABLE ROW LEVEL SECURITY;

-- Dọn sạch toàn bộ policy cũ trên tất cả các bảng
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN (
            'records', 'staff', 'settings', 'policies', 'auditlogs', 
            'public_rpc_call_log', 'customers', 'customer_participations',
            'submission_batches', 'financial_settlements'
          )
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Thu hồi quyền thừa trên bảng auditlogs (Append-only immutability)
REVOKE UPDATE, DELETE ON public.auditlogs FROM PUBLIC, authenticated, anon;

-- ======================================================================
-- 3. CHÍNH SÁCH BẢO MẬT ROW LEVEL SECURITY CHI TIẾT (100% SNAKE_CASE)
-- ======================================================================

-- ---------------------------------------------------------------------
-- 3.1. RLS BẢNG STAFF (Quản lý nhân sự)
-- ---------------------------------------------------------------------
-- Nhân viên chỉ xem được chính mình; Quản lý/Admin xem được toàn bộ nhân sự
CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin() 
    OR status = 'Đang hoạt động'
    OR auth_user_id = auth.uid()
    OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
  );

-- Chỉ Admin mới được tạo mới nhân sự
CREATE POLICY "staff_insert_admin_only" ON public.staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- Chỉ Admin được cập nhật nhân sự, hoặc nhân viên tự sửa thông tin cơ bản của chính mình
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
-- 3.2. RLS BẢNG SETTINGS & POLICIES (Cấu hình & Chính sách)
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
-- 3.3. RLS BẢNG AUDITLOGS (Nhật ký hệ thống bất biến)
-- ---------------------------------------------------------------------
-- Chỉ Quản trị viên hoặc Quản lý mới có quyền đọc nhật ký kiểm toán
CREATE POLICY "auditlogs_read_manager_admin" ON public.auditlogs
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

-- Cho phép hệ thống và nhân sự chèn log
CREATE POLICY "auditlogs_insert_authenticated" ON public.auditlogs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 3.4. RLS BẢNG RECORDS (Hồ sơ giao dịch BHXH / BHYT)
-- ---------------------------------------------------------------------
CREATE POLICY "records_select_authenticated" ON public.records
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR records.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR records.staff_id = public.current_staff_id()
  );

CREATE POLICY "records_insert_authenticated" ON public.records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_manager_or_admin()
    OR records.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR records.staff_id = public.current_staff_id()
  );

CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR records.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR records.staff_id = public.current_staff_id()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR records.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
    OR records.staff_id = public.current_staff_id()
  );

-- Xóa hồ sơ: Chỉ Admin hoặc chính cán bộ thu sở hữu khi hồ sơ chưa thu tiền
CREATE POLICY "records_delete_authenticated" ON public.records
  FOR DELETE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      (
        records.staff_id = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
        OR records.staff_id = public.current_staff_id()
      )
      AND records.payment_status != 'Đã thu tiền'
    )
  );

-- ---------------------------------------------------------------------
-- 3.5. RLS BẢNG CUSTOMERS & CUSTOMER_PARTICIPATIONS
-- ---------------------------------------------------------------------
CREATE POLICY "customers_manage_authenticated" ON public.customers
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "customer_participations_read" ON public.customer_participations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "customer_participations_manage" ON public.customer_participations
  FOR ALL TO authenticated
  USING (public.is_active_staff())
  WITH CHECK (public.is_active_staff());

-- ---------------------------------------------------------------------
-- 3.6. RLS BẢNG SUBMISSION_BATCHES & FINANCIAL_SETTLEMENTS
-- ---------------------------------------------------------------------
CREATE POLICY "submission_batches_manage" ON public.submission_batches
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager() OR created_by = public.current_staff_id())
  WITH CHECK (public.is_admin_or_manager() OR created_by = public.current_staff_id());

CREATE POLICY "financial_settlements_manage" ON public.financial_settlements
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager())
  WITH CHECK (public.is_admin_or_manager());

-- ---------------------------------------------------------------------
-- 3.7. RLS BẢNG PUBLIC_RPC_CALL_LOG
-- ---------------------------------------------------------------------
CREATE POLICY "public_rpc_call_log_service_role" ON public.public_rpc_call_log
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ======================================================================
-- 4. CẤP QUYỀN TRUY CẬP CƠ SỞ DỮ LIỆU (GRANTS)
-- ======================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.settings, public.policies TO anon, authenticated, service_role;
GRANT SELECT ON public.crm_customers, public.v_customer_transactions, public.v_records_unified TO authenticated, service_role;
GRANT SELECT ON public.v_records_unified TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records, public.staff, public.customers, public.customer_participations TO authenticated;
GRANT ALL ON public.submission_batches, public.financial_settlements TO authenticated, service_role;
GRANT SELECT, INSERT ON public.auditlogs TO authenticated;
