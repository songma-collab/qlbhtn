-- ==============================================================================
-- SCRIPT BẢO TRÌ, DỌN RÁC & TỐI ƯU CƠ SỞ DỮ LIỆU ĐỊNH KỲ (DATABASE HYGIENE)
-- Dự án: Quản lý Khách hàng Tham gia BHXH Tự Nguyện & BHYT Hộ Gia Đình
-- Mục tiêu: Dọn dẹp log rác, cập nhật Query Planner Statistics
-- ==============================================================================
-- LƯU Ý: Đã loại bỏ lệnh VACUUM vì Supabase SQL Editor chạy trong khối Transaction.
-- Trên Supabase Cloud, tiến trình Autovacuum đã tự động chạy ngầm 24/7.
-- ==============================================================================

-- 1. DỌN DẸP BẢNG LOG TẠM (RATE LIMIT & DEV TEST CALLS)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'public_rpc_call_log') THEN
    DELETE FROM public.public_rpc_call_log 
    WHERE called_at < NOW() - INTERVAL '48 hours';
    RAISE NOTICE 'Đã dọn dẹp bảng public_rpc_call_log thành công.';
  END IF;
END $$;

-- 2. DỌN DẸP CÁC BẢN GHI AUDIT THỬ NGHIỆM BAN ĐẦU (NẾU CÓ CHỈ ĐỊNH)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auditlogs') THEN
    -- Tạm thời vô hiệu hóa trigger append-only để dọn log test
    ALTER TABLE public.auditlogs DISABLE TRIGGER trg_auditlog_append_only;
    
    DELETE FROM public.auditlogs 
    WHERE details LIKE '%[TEST]%' 
       OR action LIKE '%Test%' 
       OR "userName" = 'Tester';
       
    ALTER TABLE public.auditlogs ENABLE TRIGGER trg_auditlog_append_only;
    RAISE NOTICE 'Đã dọn dẹp các bản ghi test trong auditlogs.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE public.auditlogs ENABLE TRIGGER trg_auditlog_append_only;
  RAISE NOTICE 'Bỏ qua bước dọn auditlogs do kích hoạt chế độ bảo vệ bất biến.';
END $$;

-- 3. CẬP NHẬT CHỈ SỐ THỐNG KÊ CHO QUERY PLANNER (ANALYZE)
-- ==============================================================================
ANALYZE public.records;
ANALYZE public.customers;
ANALYZE public.policies;
ANALYZE public.settings;
ANALYZE public.staff;
ANALYZE public.auditlogs;

-- 4. TRUY VẤN KIỂM TRA SỨC KHỎE CƠ SỞ DỮ LIỆU & DUNG LƯỢNG BẢNG
-- ==============================================================================
SELECT 
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_ratio_pct,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
    pg_size_pretty(pg_relation_size(relid)) AS table_size,
    pg_size_pretty(pg_indexes_size(relid)) AS indexes_size,
    last_vacuum,
    last_autovacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(relid) DESC;
