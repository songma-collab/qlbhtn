-- Migration 000010: Loại bỏ hoàn toàn cột password thô trên bảng staff
-- Đảm bảo hệ thống sử dụng duy nhất Supabase Auth (auth.users) để xác thực mật khẩu mã hóa.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'staff' 
          AND column_name = 'password'
    ) THEN
        ALTER TABLE public.staff DROP COLUMN password;
        RAISE NOTICE 'Đã xóa thành công cột password trên bảng public.staff.';
    ELSE
        RAISE NOTICE 'Cột password không tồn tại trên bảng public.staff, bỏ qua.';
    END IF;
END $$;
