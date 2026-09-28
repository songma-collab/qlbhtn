-- ======================================================================
-- Migration 000014: Bổ sung Cột Đợt chuyển & Ngày chuyển BHXH vào bảng Records
-- ======================================================================

ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submissionBatch" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submittedDate" DATE;

-- Tạo Index tăng tốc độ lọc theo đợt chuyển và trạng thái nộp BHXH
CREATE INDEX IF NOT EXISTS idx_records_submission_batch ON public.records ("isSubmittedBHXH", "submissionBatch", "submittedDate");

NOTIFY pgrst, 'reload schema';
