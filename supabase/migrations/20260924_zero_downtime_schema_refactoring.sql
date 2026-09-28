-- ======================================================================
-- MIGRATION: 20260924_zero_downtime_schema_refactoring.sql
-- LỘ TRÌNH TÁI CẤU TRÚC AN TOÀN ZERO-DOWNTIME (ZERO-DOWNTIME SCHEMA REFACTORING)
-- 1. Chuẩn hóa Thực thể Đợt nộp hồ sơ BHXH / BHYT (submission_batches)
-- 2. Chuẩn hóa Bảng Bút toán Tài chính / Thoái thu / Bù trừ (financial_settlements)
-- 3. Di chuyển và Đồng bộ Dữ liệu Lịch sử (Backfill Data) an toàn
-- 4. View Thống nhất (Unified View) 100% snake_case
-- ======================================================================

-- 1. BẢNG QUẢN LÝ ĐỢT NỘP HỒ SƠ CHÍNH QUY (submission_batches)
CREATE TABLE IF NOT EXISTS public.submission_batches (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    batch_code TEXT NOT NULL UNIQUE,
    insurance_type TEXT NOT NULL DEFAULT 'BHXH', -- 'BHXH', 'BHYT', 'CA_HAI'
    status TEXT NOT NULL DEFAULT 'draft',        -- 'draft', 'submitted', 'approved', 'rejected'
    created_by TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
    total_records INT NOT NULL DEFAULT 0,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    submission_date DATE,
    approval_date DATE,
    receipt_number TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chỉ mục tối ưu truy vấn đợt nộp
CREATE INDEX IF NOT EXISTS idx_submission_batches_code ON public.submission_batches (batch_code);
CREATE INDEX IF NOT EXISTS idx_submission_batches_status ON public.submission_batches (status);
CREATE INDEX IF NOT EXISTS idx_submission_batches_created_by ON public.submission_batches (created_by);

-- Bổ sung cột khóa ngoại batch_id vào bảng records (tương thích 100% không làm gián đoạn code cũ)
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "batch_id" UUID REFERENCES public.submission_batches(id) ON DELETE SET NULL;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "batchId" UUID;

-- 2. BẢNG QUẢN LÝ BÚT TOÁN ĐIỀU CHỈNH / THOÁI THU / BÙ TRỪ (financial_settlements)
CREATE TABLE IF NOT EXISTS public.financial_settlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    record_id BIGINT REFERENCES public.records(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.submission_batches(id) ON DELETE SET NULL,
    settlement_type TEXT NOT NULL DEFAULT 'clawback', -- 'clawback' (thoái thu), 'refund' (hoàn tiền), 'adjustment' (điều chỉnh hoa hồng)
    amount NUMERIC NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    approved_by TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',          -- 'pending', 'approved', 'completed'
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.financial_settlements ADD COLUMN IF NOT EXISTS "batch_id" UUID;
ALTER TABLE public.financial_settlements ADD COLUMN IF NOT EXISTS "batchId" UUID;

CREATE INDEX IF NOT EXISTS idx_fin_settlements_record_id ON public.financial_settlements (record_id);
CREATE INDEX IF NOT EXISTS idx_fin_settlements_batch_id ON public.financial_settlements (batch_id);
CREATE INDEX IF NOT EXISTS idx_fin_settlements_type ON public.financial_settlements (settlement_type);

-- 3. RLS CHO CÁC BẢNG MỚI (BẢO VỆ PHÂN QUYỀN TOÀN DIỆN)
ALTER TABLE public.submission_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submission_batches_auth_all" ON public.submission_batches;
CREATE POLICY "submission_batches_auth_all" ON public.submission_batches
    FOR ALL TO authenticated
    USING (
        public.is_admin_or_manager() 
        OR created_by = public.current_staff_id()
    )
    WITH CHECK (
        public.is_admin_or_manager() 
        OR created_by = public.current_staff_id()
    );

ALTER TABLE public.financial_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financial_settlements_auth_all" ON public.financial_settlements;
CREATE POLICY "financial_settlements_auth_all" ON public.financial_settlements
    FOR ALL TO authenticated
    USING (public.is_admin_or_manager())
    WITH CHECK (public.is_admin_or_manager());

-- 4. TỰ ĐỘNG DI CHUYỂN DỮ LIỆU ĐỢT NỘP CŨ SANG BẢNG CHÍNH QUY (IDEMPOTENT BACKFILL)
DO $$
DECLARE
    rec RECORD;
    v_batch_id UUID;
BEGIN
    FOR rec IN 
        SELECT DISTINCT COALESCE("submission_batch", "submissionBatch") AS b_code,
               MIN(COALESCE("submitted_date", "submittedDate")) AS s_date,
               COUNT(*) AS cnt,
               SUM(COALESCE(amount, 0)) AS total_amt
        FROM public.records
        WHERE COALESCE("submission_batch", "submissionBatch") IS NOT NULL 
          AND TRIM(COALESCE("submission_batch", "submissionBatch")) != ''
        GROUP BY COALESCE("submission_batch", "submissionBatch")
    LOOP
        -- Chèn hoặc cập nhật bảng đợt nộp
        INSERT INTO public.submission_batches (batch_code, status, total_records, total_amount, submission_date)
        VALUES (rec.b_code, 'submitted', rec.cnt, rec.total_amt, rec.s_date)
        ON CONFLICT (batch_code) DO UPDATE 
        SET total_records = EXCLUDED.total_records,
            total_amount = EXCLUDED.total_amount
        RETURNING id INTO v_batch_id;

        -- Gắn khóa ngoại batch_id vào records
        UPDATE public.records
        SET "batch_id" = v_batch_id, "batchId" = v_batch_id
        WHERE COALESCE("submission_batch", "submissionBatch") = rec.b_code
          AND ("batch_id" IS NULL OR "batch_id" != v_batch_id);
    END LOOP;
END $$;

-- 5. TỰ ĐỘNG DI CHUYỂN DỮ LIỆU LỊCH SỬ TỪ JSONB customers.prior_periods SANG customer_participations
DO $$
DECLARE
    c_rec RECORD;
    p_item JSONB;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'prior_periods'
    ) THEN
        FOR c_rec IN 
            SELECT id, customer_key, cccd, bhxh, prior_periods 
            FROM public.customers 
            WHERE prior_periods IS NOT NULL 
              AND jsonb_typeof(prior_periods) = 'array' 
              AND jsonb_array_length(prior_periods) > 0
        LOOP
            -- Nếu khách hàng chưa có bản ghi trong customer_participations thì sao chép sang
            IF NOT EXISTS (SELECT 1 FROM public.customer_participations WHERE customer_id = c_rec.id) THEN
                FOR p_item IN SELECT * FROM jsonb_array_elements(c_rec.prior_periods)
                LOOP
                    INSERT INTO public.customer_participations (
                        customer_id, customer_key, cccd, bhxh,
                        type, position, workplace,
                        from_month, from_year, to_month, to_year,
                        months, salary, notes
                    ) VALUES (
                        c_rec.id, c_rec.customer_key, c_rec.cccd, c_rec.bhxh,
                        COALESCE(p_item->>'type', 'batbuoc'),
                        p_item->>'position',
                        p_item->>'workplace',
                        COALESCE((p_item->>'sm')::int, 1),
                        COALESCE((p_item->>'sy')::int, 2020),
                        COALESCE((p_item->>'em')::int, 12),
                        COALESCE((p_item->>'ey')::int, 2020),
                        COALESCE((p_item->>'months')::int, 0),
                        NULLIF(regexp_replace(COALESCE(p_item->>'salary', ''), '\D', '', 'g'), '')::numeric,
                        p_item->>'notes'
                    );
                END LOOP;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 6. VIEW CHUẨN HÓA 100% SNAKE_CASE (v_records_unified)
DROP VIEW IF EXISTS public.v_records_unified CASCADE;

CREATE OR REPLACE VIEW public.v_records_unified 
WITH (security_invoker = true) AS
SELECT 
    r.id,
    COALESCE(r."customerId", r."customer_id") AS customer_id,
    COALESCE(r."customerKey", r."customer_key") AS customer_key,
    COALESCE(r."staffId", r."staff_id") AS staff_id,
    COALESCE(r."batch_id", r."batchId") AS batch_id,
    COALESCE(r."submissionBatch", r."submission_batch") AS submission_batch,
    COALESCE(r."isSubmittedBHXH", r."is_submitted_bhxh", false) AS is_submitted_bhxh,
    COALESCE(r."submittedDate", r."submitted_date") AS submitted_date,
    r.type AS insurance_type,
    COALESCE(r."subType", r."sub_type") AS sub_type,
    COALESCE(r."actionType", r."action_type") AS action_type,
    r.name,
    r.cccd,
    r.phone,
    r.bhxh,
    COALESCE(r."oldBhxh", r."old_bhxh") AS old_bhxh,
    r.dob,
    r.gender,
    r.nation,
    r.address,
    r.wage,
    r.income,
    r.months,
    COALESCE(r."fromMonth", r."from_month") AS from_month,
    COALESCE(r."toMonth", r."to_month") AS to_month,
    COALESCE(r."effectiveDate", r."effective_date") AS effective_date,
    COALESCE(r."targetDate", r."target_date") AS target_date,
    COALESCE(r."nextPayment", r."next_payment") AS next_payment,
    COALESCE(r."basePremium", r."base_premium") AS base_premium,
    COALESCE(r."nnSupportPct", r."nn_support_pct", 0) AS nn_support_pct,
    COALESCE(r."nnSupportAmount", r."nn_support_amount", 0) AS nn_support_amount,
    COALESCE(r."dpSupportPct", r."dp_support_pct", 0) AS dp_support_pct,
    COALESCE(r."dpSupportAmount", r."dp_support_amount", 0) AS dp_support_amount,
    COALESCE(r."discountAmount", r."discount_amount", 0) AS discount_amount,
    COALESCE(r."penaltyAmount", r."penalty_amount", 0) AS penalty_amount,
    r.amount,
    r.commission,
    r.status,
    COALESCE(r."paymentStatus", r."payment_status") AS payment_status,
    r.method,
    COALESCE(r."baseSalarySnapshot", r."base_salary_snapshot") AS base_salary_snapshot,
    COALESCE(r."povertyStandardSnapshot", r."poverty_standard_snapshot") AS poverty_standard_snapshot,
    COALESCE(r."policyVersionId", r."policy_version_id") AS policy_version_id,
    COALESCE(r."isAdjustment", r."is_adjustment", false) AS is_adjustment,
    COALESCE(r."originalRecordId", r."original_record_id") AS original_record_id,
    COALESCE(r."adjustmentReason", r."adjustment_reason") AS adjustment_reason,
    COALESCE(r."refundType", r."refund_type") AS refund_type,
    COALESCE(r."created_at", r.date) AS created_at,
    COALESCE(r."updated_at", r.date) AS updated_at
FROM public.records r;

GRANT SELECT ON public.v_records_unified TO authenticated;
