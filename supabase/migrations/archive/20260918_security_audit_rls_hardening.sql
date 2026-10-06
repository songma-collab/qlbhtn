-- ==============================================================================
-- BẢN VÁ BẢO MẬT: KHÓA CHẶT ROW LEVEL SECURITY & TRIỆT TIÊU LỖ HỔNG LEO THANG ĐẶC QUYỀN
-- Ngăn chặn triệt để:
-- 1. Lỗ hổng 'OR role IS NULL' biến tài khoản trắng quyền thành Super Admin
-- 2. Rò rỉ thông tin nhân sự (CCCD, SĐT) qua SELECT bảng staff
-- ==============================================================================

-- 1. Vá hàm kiểm tra quyền Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = auth.uid() OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))))
      AND LOWER(TRIM(role)) IN ('admin', 'quản trị viên', 'quan tri vien')
      AND status = 'Đang hoạt động'
  );
$$;

-- 2. Vá hàm kiểm tra quyền Quản lý / Admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = auth.uid() OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))))
      AND LOWER(TRIM(role)) IN ('admin', 'quản lý', 'quan ly', 'quản trị viên', 'quan tri vien')
      AND status = 'Đang hoạt động'
  );
$$;

-- 3. Cập nhật hàm alias
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT public.is_manager_or_admin();
$$;

-- 4. Thắt chặt RLS bảng staff: Nhân viên chỉ đọc được hồ sơ của chính họ; Quản trị viên mới được đọc toàn bộ danh sách
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_authenticated" ON public.staff;
CREATE POLICY "staff_read_authenticated" ON public.staff
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin() 
    OR auth_user_id = auth.uid()
    OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', '')))
  );

-- Cấp quyền thực thi các hàm bảo mật cho authenticated và service_role
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager() TO authenticated, service_role;
