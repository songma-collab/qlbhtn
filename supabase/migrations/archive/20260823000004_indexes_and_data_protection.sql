-- supabase/migrations/20260823000004_indexes_and_data_protection.sql
-- GIAI ĐOẠN 6: TỐI ƯU HÓA HIỆU NĂNG QUERY VÀ BẢO VỆ NHẬT KÝ APPEND-ONLY
-- Thay thế phần indexes cũ trong database_schema.sql

-- ======================================================================
-- 1. BỔ SUNG INDEXES HIỆU NĂNG CAO
-- ======================================================================

CREATE INDEX IF NOT EXISTS idx_records_cccd ON public.records(cccd);
CREATE INDEX IF NOT EXISTS idx_records_bhxh ON public.records(bhxh);
CREATE INDEX IF NOT EXISTS idx_records_phone ON public.records(phone);
CREATE INDEX IF NOT EXISTS idx_records_staffId ON public.records("staffId");
CREATE INDEX IF NOT EXISTS idx_records_type ON public.records(type);
CREATE INDEX IF NOT EXISTS idx_records_paymentStatus ON public.records("paymentStatus");
CREATE INDEX IF NOT EXISTS idx_records_ip_address_date ON public.records(ip_address, date DESC);
CREATE INDEX IF NOT EXISTS idx_records_finance_query ON public.records(type, "paymentStatus", "actionType", date DESC);
CREATE INDEX IF NOT EXISTS idx_records_date_brin ON public.records USING BRIN (date);

-- ======================================================================
-- 2. BẢO VỆ BẢNG AUDITLOGS CHỐNG SỬA/XÓA (IMMUTABLE APPEND-ONLY)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.prevent_auditlog_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Bảo mật: Nhật ký hệ thống (Audit Logs) là dữ liệu bất biến (Append-only). Không được phép chỉnh sửa hoặc xóa.';
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_auditlog_update ON public.auditlogs;
CREATE TRIGGER trigger_prevent_auditlog_update
  BEFORE UPDATE OR DELETE ON public.auditlogs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_auditlog_modification();

NOTIFY pgrst, 'reload schema';
