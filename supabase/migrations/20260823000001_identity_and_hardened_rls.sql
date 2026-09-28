-- supabase/migrations/20260823000001_identity_and_hardened_rls.sql
-- GIAI ĐOẠN 1 & 2: CHUẨN HÓA ĐỊNH DANH NHÂN SỰ VÀ CỦNG CỐ RLS BỐN VAI TRÒ
-- Thay thế phần định danh cũ trong database_schema.sql và security_enhancement.sql

-- ======================================================================
-- 1. BỔ SUNG CỘT auth_user_id CHO BẢNG STAFF & LIÊN KẾT auth.users
-- ======================================================================

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "auth_user_id" UUID;

-- Xóa cột mật khẩu thô nếu còn tồn tại
ALTER TABLE public.staff DROP COLUMN IF EXISTS password;

-- Tạo unique index trên auth_user_id để đảm bảo 1 tài khoản auth chỉ ánh xạ 1 nhân viên
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_auth_user_id ON public.staff("auth_user_id") WHERE "auth_user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(lower(email));

-- ======================================================================
-- 2. HÀM TRUY VẤN VAI TRÒ VÀ STAFF ID AN TOÀN (HARDENED search_path & auth.uid())
-- ======================================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1. Ưu tiên tra cứu theo auth.uid()
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

  -- 2. Fallback tra cứu qua JWT email (dành cho giai đoạn chuyển tiếp)
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

CREATE OR REPLACE FUNCTION public.get_my_staff_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_staff_id text;
BEGIN
  -- 1. Ưu tiên tra cứu theo auth.uid()
  IF auth.uid() IS NOT NULL THEN
    SELECT id INTO v_staff_id
    FROM public.staff 
    WHERE auth_user_id = auth.uid() 
      AND status != 'Tạm khóa'
    LIMIT 1;

    IF v_staff_id IS NOT NULL THEN
      RETURN v_staff_id;
    END IF;
  END IF;

  -- 2. Fallback tra cứu qua JWT email
  IF auth.jwt()->>'email' IS NOT NULL THEN
    SELECT id INTO v_staff_id
    FROM public.staff 
    WHERE lower(email) = lower(auth.jwt()->>'email')
      AND status != 'Tạm khóa'
    LIMIT 1;

    IF v_staff_id IS NOT NULL THEN
      RETURN v_staff_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Thu hồi quyền anon trên các hàm quyền nội bộ
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_staff_id() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_staff_id() TO authenticated;


-- ======================================================================
-- 3. BẢO VỆ BẢNG STAFF (RLS)
-- ======================================================================

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can be read by authenticated users" ON public.staff;
DROP POLICY IF EXISTS "Staff can read own row and Admins read all" ON public.staff;
DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can insert staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can update staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can delete staff" ON public.staff;

-- Chỉ nhân viên đã đăng nhập mới đọc được thông tin của chính mình; Admin/Quản lý đọc toàn bộ
CREATE POLICY "Staff can read own row and Admins read all" ON public.staff 
FOR SELECT USING (
  public.get_my_role() IN ('Admin', 'Quản lý') 
  OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
  OR (auth.jwt()->>'email' IS NOT NULL AND lower(email) = lower(auth.jwt()->>'email'))
);

CREATE POLICY "Admins can insert staff" ON public.staff 
FOR INSERT WITH CHECK ( public.get_my_role() IN ('Admin', 'Quản lý') );

CREATE POLICY "Admins can update staff" ON public.staff 
FOR UPDATE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );

CREATE POLICY "Admins can delete staff" ON public.staff 
FOR DELETE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );


-- ======================================================================
-- 4. BẢO VỆ BẢNG RECORDS (RLS BỐN VAI TRÒ - THU HỒI HOÀN TOÀN QUYỀN ANON)
-- ======================================================================

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert records" ON public.records;
DROP POLICY IF EXISTS "Staff can read records" ON public.records;
DROP POLICY IF EXISTS "Staff can insert records" ON public.records;
DROP POLICY IF EXISTS "Staff can update records" ON public.records;
DROP POLICY IF EXISTS "Staff can delete records" ON public.records;

-- SELECT: Nhân viên chỉ đọc hồ sơ thuộc staffId của mình; Admin/Quản lý đọc toàn bộ; Anon KHÔNG ĐỌC ĐƯỢC GÌ
CREATE POLICY "Staff can read records" ON public.records
FOR SELECT USING (
  ("staffId" IS NOT NULL AND "staffId" = public.get_my_staff_id()) 
  OR public.get_my_role() IN ('Admin', 'Quản lý')
);

-- INSERT: Chỉ nhân viên/admin đăng nhập mới được INSERT trực tiếp; Anon phải đi qua Edge Function / RPC an toàn
CREATE POLICY "Staff can insert records" ON public.records
FOR INSERT WITH CHECK (
  ("staffId" = public.get_my_staff_id() AND public.get_my_role() = 'Nhân viên')
  OR public.get_my_role() IN ('Admin', 'Quản lý')
);

-- UPDATE: Nhân viên chỉ cập nhật hồ sơ của chính mình; Admin/Quản lý cập nhật toàn bộ
CREATE POLICY "Staff can update records" ON public.records
FOR UPDATE USING (
  ("staffId" IS NOT NULL AND "staffId" = public.get_my_staff_id())
  OR public.get_my_role() IN ('Admin', 'Quản lý')
);

-- DELETE: Chỉ Admin/Quản lý mới có quyền xóa hồ sơ
CREATE POLICY "Admins can delete records" ON public.records
FOR DELETE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );


-- ======================================================================
-- 5. BẢO VỆ BẢNG AUDITLOGS, POLICIES & SETTINGS
-- ======================================================================

ALTER TABLE public.auditlogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert auditlogs" ON public.auditlogs;
DROP POLICY IF EXISTS "Allow admins read auditlogs" ON public.auditlogs;
DROP POLICY IF EXISTS "Allow public insert auditlogs" ON public.auditlogs;
DROP POLICY IF EXISTS "Allow public read auditlogs" ON public.auditlogs;

-- Audit Log: Chỉ người dùng đã xác thực mới INSERT; Chỉ Admin/Quản lý mới SELECT; TUYỆT ĐỐI KHÔNG CHO UPDATE/DELETE
CREATE POLICY "Allow authenticated insert auditlogs" ON public.auditlogs 
FOR INSERT WITH CHECK ( auth.role() = 'authenticated' );

CREATE POLICY "Allow admins read auditlogs" ON public.auditlogs 
FOR SELECT USING ( public.get_my_role() IN ('Admin', 'Quản lý') );

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read policies" ON public.policies;
DROP POLICY IF EXISTS "Admins can update policies" ON public.policies;
DROP POLICY IF EXISTS "Admins can insert policies" ON public.policies;
DROP POLICY IF EXISTS "Admins can delete policies" ON public.policies;

CREATE POLICY "Allow public read policies" ON public.policies FOR SELECT USING (true);
CREATE POLICY "Admins can update policies" ON public.policies FOR UPDATE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );
CREATE POLICY "Admins can insert policies" ON public.policies FOR INSERT WITH CHECK ( public.get_my_role() IN ('Admin', 'Quản lý') );
CREATE POLICY "Admins can delete policies" ON public.policies FOR DELETE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.settings;

CREATE POLICY "Allow public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admins can update settings" ON public.settings FOR UPDATE USING ( public.get_my_role() IN ('Admin', 'Quản lý') );
CREATE POLICY "Admins can insert settings" ON public.settings FOR INSERT WITH CHECK ( public.get_my_role() IN ('Admin', 'Quản lý') );

-- ======================================================================
-- 6. HƯỚNG DẪN KHỞI TẠO VÀ LIÊN KẾT AUTH USER ID
-- ======================================================================
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
  IF public.get_my_role() != 'Admin' THEN
    RAISE EXCEPTION 'Access denied: Chỉ Admin mới có quyền liên kết tài khoản định danh.';
  END IF;

  UPDATE public.staff
  SET auth_user_id = p_auth_user_id
  WHERE id = p_staff_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_staff_auth_user(TEXT, UUID) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.link_staff_auth_user(TEXT, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
