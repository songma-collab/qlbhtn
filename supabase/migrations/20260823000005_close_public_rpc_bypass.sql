-- supabase/migrations/20260823000005_close_public_rpc_bypass.sql
-- GIAI ĐOẠN NÂNG CAO: PHÂN QUYỀN RPC CÔNG KHAI VÀ BẢO VỆ NHẬT KÝ SERVER-SIDE

-- 1. Cấp quyền thực thi RPC cho service_role, anon và authenticated
-- (Hàm đã tích hợp sẵn cơ chế Rate-limit IP và Whitelist chống tấn công injection)
GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_customer_exists(TEXT) TO service_role, anon, authenticated;

-- 2. Chuyển toàn bộ việc ghi nhật ký sang Trigger PostgreSQL tự động, loại bỏ policy ghi trực tiếp từ client
DROP POLICY IF EXISTS "Allow authenticated insert auditlogs" ON public.auditlogs;

NOTIFY pgrst, 'reload schema';
