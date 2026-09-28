-- ======================================================================
-- MIGRATION: BỔ SUNG CỘT HỒ SƠ THAM GIA TRƯỚC ĐÂY (CUSTOMER PARTICIPATION PROFILE)
-- Ngày tạo: 23/09/2026
-- Mục đích: Quản lý thời gian tham gia BHXH bắt buộc và tự nguyện ở đại lý khác
-- Không làm phát sinh giao dịch tài chính, biên lai hay công nợ đại lý.
-- ======================================================================

BEGIN;

-- 1. Bổ sung các cột hồ sơ tham gia trên bảng customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "prior_periods" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "prior_voluntary_months" INT DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "prior_compulsory_months" INT DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "prior_participation_notes" TEXT;

-- 2. Tạo Index GIN cho trường prior_periods để tra cứu nhanh khi cần
CREATE INDEX IF NOT EXISTS idx_customers_prior_periods ON public.customers USING GIN ("prior_periods");

-- 3. Tạo Index cho prior_voluntary_months để phục vụ lọc danh sách theo tiến độ 120 tháng
CREATE INDEX IF NOT EXISTS idx_customers_prior_voluntary_months ON public.customers ("prior_voluntary_months");

COMMIT;
