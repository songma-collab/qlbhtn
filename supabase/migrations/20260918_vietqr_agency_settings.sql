-- ======================================================================
-- MIGRATION: 20260918_vietqr_agency_settings.sql
-- CÀI ĐẶT THÔNG TIN THANH TOÁN VIETQR ĐẠI LÝ CHUẨN NAPAS 247
-- ======================================================================

-- 1. Bổ sung các cột cấu hình thanh toán vào bảng public.settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agencyName" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agencyCode" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bankBin" TEXT DEFAULT '970422';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bankName" TEXT DEFAULT 'MB (Ngân hàng Quân Đội)';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "accountNumber" TEXT DEFAULT '0868123456';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "accountHolder" TEXT DEFAULT 'DAI LY THU BHXH SONG MA';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "qrTemplate" TEXT DEFAULT 'compact2';

-- Đảm bảo có các alias tương thích snake_case
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agency_name" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agency_code" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_bin" TEXT DEFAULT '970422';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_name" TEXT DEFAULT 'MB (Ngân hàng Quân Đội)';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "account_number" TEXT DEFAULT '0868123456';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "account_holder" TEXT DEFAULT 'DAI LY THU BHXH SONG MA';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "qr_template" TEXT DEFAULT 'compact2';

-- Khởi tạo hoặc cập nhật bản ghi mặc định ID = 1 nếu chưa có
INSERT INTO public.settings (
  id, 
  "agencyName", 
  "agencyCode", 
  "bankBin", 
  "bankName", 
  "accountNumber", 
  "accountHolder", 
  "qrTemplate",
  bank_id,
  bank_account,
  bank_owner
)
VALUES (
  1,
  'Đại lý thu BHXH Sông Mã',
  'VSS-SM-001',
  '970422',
  'MB (Ngân hàng Quân Đội)',
  '0868123456',
  'DAI LY THU BHXH SONG MA',
  'compact2',
  'MB',
  '0868123456',
  'DAI LY THU BHXH SONG MA'
)
ON CONFLICT (id) DO UPDATE SET
  "agencyName" = COALESCE(public.settings."agencyName", EXCLUDED."agencyName"),
  "agencyCode" = COALESCE(public.settings."agencyCode", EXCLUDED."agencyCode"),
  "bankBin" = COALESCE(public.settings."bankBin", EXCLUDED."bankBin"),
  "bankName" = COALESCE(public.settings."bankName", EXCLUDED."bankName"),
  "accountNumber" = COALESCE(public.settings."accountNumber", EXCLUDED."accountNumber"),
  "accountHolder" = COALESCE(public.settings."accountHolder", EXCLUDED."accountHolder"),
  "qrTemplate" = COALESCE(public.settings."qrTemplate", EXCLUDED."qrTemplate");

-- 2. Đồng bộ tham số chính sách vào bảng public.policies với parameter_type = 'payment_vietqr'
INSERT INTO public.policies (
  parameter_type, 
  name, 
  value, 
  effective_date, 
  description, 
  is_active
)
SELECT 
  'payment_vietqr',
  'Cấu hình Tài khoản VietQR Đại lý',
  jsonb_build_object(
    'agencyName', 'Đại lý thu BHXH Sông Mã',
    'agencyCode', 'VSS-SM-001',
    'bankBin', '970422',
    'bankName', 'MB (Ngân hàng Quân Đội)',
    'accountNumber', '0868123456',
    'accountHolder', 'DAI LY THU BHXH SONG MA',
    'qrTemplate', 'compact2'
  ),
  CURRENT_DATE,
  'Thông tin tài khoản ngân hàng thụ hưởng nhận tiền đóng BHXH/BHYT qua VietQR NAPAS 247',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'payment_vietqr'
);

-- 3. Thiết lập chính sách Row Level Security (RLS) cho public.settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_read_all" ON public.settings;
DROP POLICY IF EXISTS "Allow public read settings" ON public.settings;
CREATE POLICY "settings_read_all" ON public.settings
  FOR SELECT
  TO public, anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_write_admin_only" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
CREATE POLICY "settings_write_admin_only" ON public.settings
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'Admin')
  WITH CHECK (public.get_my_role() = 'Admin');

DROP POLICY IF EXISTS "settings_insert_admin_only" ON public.settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.settings;
CREATE POLICY "settings_insert_admin_only" ON public.settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.get_my_role() = 'Admin');

-- 4. Trigger tự động ghi log kiểm toán vào public.auditlogs khi cập nhật thông tin tài khoản ngân hàng
CREATE OR REPLACE FUNCTION public.audit_vietqr_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_details TEXT;
BEGIN
  -- Lấy thông tin người thực hiện từ auth.jwt() hoặc context session
  v_user_id := COALESCE(auth.uid()::text, 'system');
  
  -- Lấy tên người dùng nếu có
  SELECT name INTO v_user_name 
  FROM public.staff 
  WHERE id = v_user_id OR email = (auth.jwt() ->> 'email')
  LIMIT 1;

  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  -- Kiểm tra xem có thay đổi các trường tài khoản ngân hàng không
  IF (TG_OP = 'UPDATE') THEN
    IF (OLD."accountNumber" IS DISTINCT FROM NEW."accountNumber") 
       OR (OLD."bankBin" IS DISTINCT FROM NEW."bankBin") 
       OR (OLD."bankName" IS DISTINCT FROM NEW."bankName")
       OR (OLD."accountHolder" IS DISTINCT FROM NEW."accountHolder")
       OR (OLD."agencyName" IS DISTINCT FROM NEW."agencyName")
       OR (OLD."agencyCode" IS DISTINCT FROM NEW."agencyCode") THEN
      
      v_details := format(
        'Cập nhật tài khoản VietQR: Ngân hàng %s (BIN: %s), STK: %s -> %s, Chủ TK: %s, Đơn vị: %s (%s)',
        COALESCE(NEW."bankName", NEW."bankBin"),
        NEW."bankBin",
        COALESCE(OLD."accountNumber", '---'),
        NEW."accountNumber",
        NEW."accountHolder",
        NEW."agencyName",
        NEW."agencyCode"
      );

      INSERT INTO public.auditlogs ("userId", "userName", "action", "details", "timestamp")
      VALUES (v_user_id, v_user_name, 'Cập nhật VietQR', v_details, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_vietqr_settings ON public.settings;
CREATE TRIGGER trigger_audit_vietqr_settings
AFTER UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.audit_vietqr_settings_change();
