-- ======================================================================
-- MIGRATION 20260917: BÚT TOÁN THOÁI THU & HOÀN TRẢ (CLAWBACK & REFUND)
-- Tuân thủ Invariant 3 (Clawback Pattern) & Snapshot Invariant:
-- Lưu trữ tập trung tại bảng public.records với giá trị âm đối ứng.
-- ======================================================================

-- 1. Bổ sung các cột thông tin thoái thu vào bảng public.records
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundType" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionNumber" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundMethod" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryAccount" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryBank" TEXT;

-- 2. Đánh chỉ mục tối ưu truy vấn bút toán thoái thu theo hồ sơ gốc
CREATE INDEX IF NOT EXISTS idx_records_refund_clawback 
ON public.records ("originalRecordId", "isAdjustment", "paymentStatus") 
WHERE "isAdjustment" = TRUE OR "paymentStatus" = 'Đã thoái thu';

-- 3. RPC: Tạo Bút Toán Thoái Thu An Toàn (Server-side Enforcement)
CREATE OR REPLACE FUNCTION public.create_refund_clawback_entry(
    p_original_record_id BIGINT,
    p_refund_amount NUMERIC,
    p_refund_type TEXT,
    p_decision_number TEXT DEFAULT NULL,
    p_decision_date DATE DEFAULT NULL,
    p_refund_method TEXT DEFAULT 'TIEN_MAT',
    p_effective_date DATE DEFAULT CURRENT_DATE,
    p_reason TEXT DEFAULT 'Thoái thu hoàn trả theo quyết định BHXH',
    p_beneficiary_name TEXT DEFAULT NULL,
    p_beneficiary_account TEXT DEFAULT NULL,
    p_beneficiary_bank TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_orig RECORD;
    v_already_refunded NUMERIC := 0;
    v_remaining NUMERIC := 0;
    v_clawback_comm NUMERIC := 0;
    v_clawback_nn_support NUMERIC := 0;
    v_clawback_dp_support NUMERIC := 0;
    v_comm_ratio NUMERIC := 0;
    v_nn_ratio NUMERIC := 0;
    v_dp_ratio NUMERIC := 0;
    v_new_id BIGINT;
    v_is_locked BOOLEAN := FALSE;
    v_period_key TEXT;
    v_locked_policy RECORD;
BEGIN
    -- 1. Kiểm tra tồn tại của hồ sơ gốc
    SELECT * INTO v_orig FROM public.records WHERE id = p_original_record_id;
    IF v_orig IS NULL THEN
        RAISE EXCEPTION 'Hồ sơ gốc (ID: %) không tồn tại trong hệ thống.', p_original_record_id
            USING ERRCODE = '20001';
    END IF;

    IF v_orig."paymentStatus" = 'Đã hủy' THEN
        RAISE EXCEPTION 'Hồ sơ "%" (Mã số %) đã ở trạng thái Đã hủy, không thể thoái thu.', v_orig.name, v_orig.id
            USING ERRCODE = '20002';
    END IF;

    -- 2. Kiểm tra số tiền thoái thu hợp lệ
    IF p_refund_amount <= 0 THEN
        RAISE EXCEPTION 'Số tiền thoái thu phải lớn hơn 0 (Nhận: % đ).', p_refund_amount
            USING ERRCODE = '20003';
    END IF;

    -- Tính tổng số tiền đã thoái thu trước đó cho hồ sơ gốc này
    SELECT COALESCE(SUM(ABS(r.amount)), 0) INTO v_already_refunded
    FROM public.records r
    WHERE r."originalRecordId" = p_original_record_id
      AND (r."isAdjustment" = TRUE OR r."paymentStatus" = 'Đã thoái thu');

    v_remaining := COALESCE(v_orig.amount, 0) - v_already_refunded;
    IF p_refund_amount > v_remaining THEN
        RAISE EXCEPTION 'Số tiền thoái thu (% đ) vượt quá số tiền còn lại có thể thoái thu của hồ sơ gốc (% đ, đã thoái trước đó: % đ).',
            p_refund_amount, v_remaining, v_already_refunded
            USING ERRCODE = '20004';
    END IF;

    -- 3. Kiểm tra khóa kỳ tài chính của ngày hiệu lực (effective_date)
    v_period_key := 'month_' || TO_CHAR(p_effective_date, 'MM/YYYY');
    SELECT * INTO v_locked_policy FROM public.policies WHERE parameter_type = 'locked_periods' AND is_active = TRUE;
    IF v_locked_policy IS NOT NULL AND v_locked_policy.value::jsonb ? v_period_key THEN
        RAISE EXCEPTION 'Kỳ tài chính hạch toán (%) đã BỊ KHÓA SỔ. Bút toán thoái thu phải được ghi nhận vào kỳ hiện tại đang mở.', v_period_key
            USING ERRCODE = '20005';
    END IF;

    -- 4. Tính toán đóng băng tỷ lệ theo giao dịch gốc (Snapshot Invariant)
    IF COALESCE(v_orig.amount, 0) > 0 THEN
        v_comm_ratio := COALESCE(v_orig.commission, 0)::NUMERIC / v_orig.amount::NUMERIC;
        v_clawback_comm := ROUND(p_refund_amount * v_comm_ratio);

        IF COALESCE(v_orig."nnSupportAmount", 0) > 0 THEN
            v_nn_ratio := v_orig."nnSupportAmount"::NUMERIC / v_orig.amount::NUMERIC;
            v_clawback_nn_support := ROUND(p_refund_amount * v_nn_ratio);
        END IF;

        IF COALESCE(v_orig."dpSupportAmount", 0) > 0 THEN
            v_dp_ratio := v_orig."dpSupportAmount"::NUMERIC / v_orig.amount::NUMERIC;
            v_clawback_dp_support := ROUND(p_refund_amount * v_dp_ratio);
        END IF;
    ELSE
        v_clawback_comm := 0;
    END IF;

    -- 5. Chèn bút toán âm vào bảng public.records (Clawback Pattern)
    INSERT INTO public.records (
        name,
        cccd,
        phone,
        bhxh,
        "old_bhxh",
        address,
        hometown,
        dob,
        gender,
        type,
        plan,
        months,
        date,
        "startDate",
        "endDate",
        status,
        "paymentStatus",
        "actionType",
        "staffId",
        notes,
        "hospitalCode",
        "hospitalName",
        
        -- Dòng tiền âm
        amount,
        commission,
        "nnSupportAmount",
        "dpSupportAmount",
        
        -- Cờ bút toán bù trừ & liên kết gốc
        "isAdjustment",
        "originalRecordId",
        "adjustmentReason",
        
        -- Thông tin hoàn trả
        "refundType",
        "decisionNumber",
        "decisionDate",
        "refundMethod",
        "refundBeneficiaryName",
        "refundBeneficiaryAccount",
        "refundBeneficiaryBank",
        
        -- Kế thừa snapshot chính sách của giao dịch gốc
        "baseSalarySnapshot",
        "povertyStandardSnapshot",
        "policyVersionId",
        "appliedRates"
    ) VALUES (
        v_orig.name,
        v_orig.cccd,
        v_orig.phone,
        v_orig.bhxh,
        v_orig."old_bhxh",
        v_orig.address,
        v_orig.hometown,
        v_orig.dob,
        v_orig.gender,
        v_orig.type,
        v_orig.plan,
        v_orig.months,
        p_effective_date,
        v_orig."startDate",
        v_orig."endDate",
        'Hoạt động',
        'Đã thoái thu',
        'Thoái thu hoàn trả',
        v_orig."staffId",
        COALESCE(p_reason, 'Bút toán thoái thu theo quyết định BHXH'),
        v_orig."hospitalCode",
        v_orig."hospitalName",
        
        -- Giá trị âm
        -ABS(p_refund_amount),
        -ABS(v_clawback_comm),
        -ABS(v_clawback_nn_support),
        -ABS(v_clawback_dp_support),
        
        TRUE,
        p_original_record_id,
        p_reason,
        
        p_refund_type,
        p_decision_number,
        p_decision_date,
        p_refund_method,
        p_beneficiary_name,
        p_beneficiary_account,
        p_beneficiary_bank,
        
        v_orig."baseSalarySnapshot",
        v_orig."povertyStandardSnapshot",
        v_orig."policyVersionId",
        v_orig."appliedRates"
    ) RETURNING id INTO v_new_id;

    -- 6. Ghi Audit Log máy chủ
    INSERT INTO public.server_audit_logs (
        table_name,
        record_id,
        action,
        actor_id,
        details
    ) VALUES (
        'records',
        v_new_id,
        'THOAI_THU_HOAN_TRA',
        NULL,
        jsonb_build_object(
            'originalRecordId', p_original_record_id,
            'customerName', v_orig.name,
            'refundAmount', p_refund_amount,
            'clawbackCommission', v_clawback_comm,
            'refundType', p_refund_type,
            'decisionNumber', p_decision_number,
            'decisionDate', p_decision_date,
            'effectiveDate', p_effective_date,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'newRecordId', v_new_id,
        'originalRecordId', p_original_record_id,
        'refundAmount', p_refund_amount,
        'clawbackCommission', v_clawback_comm,
        'effectiveDate', p_effective_date
    );
END;
$$;
