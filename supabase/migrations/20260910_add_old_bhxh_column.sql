-- ======================================================================
-- Migration: BỔ SUNG CỘT "oldBhxh" VÀO BẢNG RECORDS & CUSTOMERS
-- ======================================================================

ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "oldBhxh" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "old_bhxh" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "old_bhxh" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "oldBhxh" TEXT;

-- Đồng bộ giá trị oldBhxh từ các trường hiện có nếu có 10 số
UPDATE public.records 
SET "oldBhxh" = bhxh 
WHERE "oldBhxh" IS NULL AND bhxh IS NOT NULL AND LENGTH(TRIM(bhxh)) = 10;

-- Làm mới schema cache của Supabase / PostgREST
NOTIFY pgrst, 'reload schema';
