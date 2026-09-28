-- ======================================================================
-- MIGRATION 20260910: KHẮC PHỤC LỖ HỔNG AN TOÀN THÔNG TIN & BẢO VỆ PII
-- Tuân thủ: Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân & OWASP Top 10
-- ======================================================================

-- 1. BẢO VỆ BẢNG AUDITLOGS: APPEND-ONLY TUYỆT ĐỐI (CHỐNG SỬA / XÓA)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.enforce_auditlog_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'BẢO MẬT HỆ THỐNG: Bảng nhật ký kiểm toán (auditlogs) là dữ liệu bất biến (Append-Only). Mọi hành vi UPDATE hoặc DELETE đều bị nghiêm cấm theo luật định!';
END;
$$;

DROP TRIGGER IF EXISTS trg_auditlog_append_only ON public.auditlogs;
CREATE TRIGGER trg_auditlog_append_only
  BEFORE UPDATE OR DELETE ON public.auditlogs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_auditlog_immutability();

-- Thu hồi toàn bộ quyền UPDATE, DELETE từ mọi đối tượng người dùng
REVOKE UPDATE, DELETE ON public.auditlogs FROM PUBLIC, anon, authenticated;


-- 2. VÁ LỖ HỔNG RÒ RỈ PII CÔNG KHAI TRÊN BẢNG CUSTOMERS & VIEW CRM_CUSTOMERS
-- ======================================================================

-- Thu hồi quyền SELECT công khai của anon trên bảng customers và view
REVOKE ALL ON public.customers FROM anon, PUBLIC;
REVOKE ALL ON public.crm_customers FROM anon, PUBLIC;

-- Bật RLS và dọn dẹp các policies cũ có kẽ hở anon
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public lookup on customers" ON public.customers;
DROP POLICY IF EXISTS "Staff select own customers" ON public.customers;
DROP POLICY IF EXISTS "Admin manage customers" ON public.customers;
DROP POLICY IF EXISTS "customers_select_strict" ON public.customers;
DROP POLICY IF EXISTS "customers_write_admin" ON public.customers;

-- Policy SELECT nghiêm ngặt: 
-- Admin & Quản lý xem toàn bộ; Nhân viên CHỈ xem khách hàng thuộc staff_id của mình; Anon BỊ CHẶN 100%
CREATE POLICY "customers_select_strict" ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (staff_id IS NOT NULL AND staff_id = public.current_staff_id())
  );

-- Policy Quản trị: Admin & Quản lý được phép thao tác toàn bộ
CREATE POLICY "customers_manage_admin" ON public.customers
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- Cấp quyền có kiểm soát cho authenticated và service_role
GRANT SELECT ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;


-- 3. CỦNG CỐ RLS CHỐNG LỖ HỔNG IDOR / BOLA TRÊN BẢNG RECORDS
-- ======================================================================

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "records_select_authenticated" ON public.records;
DROP POLICY IF EXISTS "records_select_strict" ON public.records;
DROP POLICY IF EXISTS "Staff can read records" ON public.records;

-- Nhân viên chỉ đọc được hồ sơ do chính mình quản lý (staffId = current_staff_id)
-- Admin và Quản lý được đọc toàn bộ
CREATE POLICY "records_select_strict" ON public.records
  FOR SELECT TO authenticated
  USING (
    public.is_manager_or_admin()
    OR ("staffId" IS NOT NULL AND "staffId" = public.current_staff_id())
  );

-- Thu hồi hoàn toàn quyền truy cập bảng records từ anon
REVOKE ALL ON public.records FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;


-- 4. TẠO HÀM RPC GHI NHẬT KÝ AN TOÀN CHO CLIENT (AUDIT LOGGING RPC)
--    Ghi nhận: Xuất Excel PII, Đăng nhập, Truy xuất hàng loạt...
-- ======================================================================

CREATE OR REPLACE FUNCTION public.log_security_audit_event(
  p_action TEXT,
  p_details TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_staff_id TEXT;
  v_staff_name TEXT;
  v_ip TEXT;
BEGIN
  -- Bắt buộc người dùng phải xác thực mới được ghi log nghiệp vụ
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Lấy thông tin nhân sự
  SELECT id, name INTO v_staff_id, v_staff_name
  FROM public.staff
  WHERE auth_user_id = v_uid
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    v_staff_name := COALESCE(auth.jwt() ->> 'email', 'N/A');
    v_staff_id := v_uid::text;
  END IF;

  -- Lấy IP client nếu có
  BEGIN
    v_ip := public.get_public_client_ip();
  EXCEPTION WHEN OTHERS THEN
    v_ip := 'Unknown';
  END;

  INSERT INTO public.auditlogs (
    "userId",
    "userName",
    "action",
    "details",
    "timestamp"
  ) VALUES (
    v_staff_id,
    v_staff_name,
    p_action,
    '[' || v_ip || '] ' || p_details || CASE WHEN p_metadata <> '{}'::jsonb THEN ' | Meta: ' || p_metadata::text ELSE '' END,
    NOW()
  );

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_security_audit_event(TEXT, TEXT, JSONB) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_security_audit_event(TEXT, TEXT, JSONB) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
