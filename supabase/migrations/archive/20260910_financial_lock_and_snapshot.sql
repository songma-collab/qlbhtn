-- ======================================================================
-- Migration 20260910: BẢO VỆ KHÓA KỲ TÀI CHÍNH & LƯU TRỮ SNAPSHOT CHÍNH SÁCH
-- Hướng dẫn: Mở Supabase Dashboard -> Chọn SQL Editor -> Dán toàn bộ file này -> Bấm Run
-- ======================================================================

-- 1. Bổ sung các cột Snapshot chính sách và Bút toán bù trừ âm vào bảng records
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "baseSalarySnapshot" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "povertyStandardSnapshot" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "policyVersionId" BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "appliedRates" JSONB;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "isAdjustment" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "originalRecordId" BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "adjustmentReason" TEXT;

-- 2. Tạo chỉ mục tối ưu hiệu năng truy vấn bù trừ và snapshot
CREATE INDEX IF NOT EXISTS idx_records_adjustment ON public.records ("isAdjustment", "originalRecordId");
CREATE INDEX IF NOT EXISTS idx_records_policy_snapshot ON public.records ("policyVersionId");

-- 3. Cập nhật hàm đồng bộ khách hàng (sync_customer_from_record) để loại trừ bút toán bù trừ âm
CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT;
    v_latest RECORD;
    v_total_contrib INT;
    v_total_paid NUMERIC;
BEGIN
    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    v_key := public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone);

    -- Tìm bản ghi mới nhất nhưng LOẠI TRỪ các bản ghi đã hủy hoặc bút toán bù trừ
    SELECT * INTO v_latest
    FROM public.records r
    WHERE public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      AND r."paymentStatus" != 'Đã hủy'
      AND (r."isAdjustment" IS NULL OR r."isAdjustment" = false)
    ORDER BY r.date DESC, r.id DESC
    LIMIT 1;

    IF v_latest IS NULL THEN
        DELETE FROM public.customers WHERE customer_key = v_key;
        RETURN v_rec;
    END IF;

    -- Tính tổng số kỳ và tổng tiền đã đóng (cộng đại số trừ tiền hoàn/bù)
    SELECT 
        GREATEST(0, COUNT(*) FILTER (WHERE r."isAdjustment" IS NOT TRUE) - COUNT(*) FILTER (WHERE r."isAdjustment" = TRUE)),
        COALESCE(SUM(amount), 0)
    INTO v_total_contrib, v_total_paid
    FROM public.records r
    WHERE public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      AND r."paymentStatus" = 'Đã thu tiền';

    INSERT INTO public.customers (
        customer_key, type, name, cccd, bhxh, phone, address, dob, gender, nation, email,
        latest_record_id, latest_date, effective_date, next_payment, latest_amount,
        status, payment_status, notes, staff_id, total_contributions, total_amount_paid,
        household_id, members, recv_name, recv_phone, recv_address, updated_at
    ) VALUES (
        v_key, v_latest.type, v_latest.name, v_latest.cccd, v_latest.bhxh, v_latest.phone, v_latest.address,
        v_latest.dob, v_latest.gender, v_latest.nation, v_latest.email,
        v_latest.id, v_latest.date, v_latest."effectiveDate", v_latest."nextPayment", v_latest.amount,
        v_latest.status, v_latest."paymentStatus", v_latest.notes, v_latest."staffId",
        v_total_contrib, v_total_paid, v_latest."householdId",
        CASE WHEN v_latest.members IS NOT NULL THEN to_jsonb(v_latest.members) ELSE NULL END,
        v_latest."recvName",
        v_latest."recvPhone",
        v_latest."recvAddress",
        NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        cccd = EXCLUDED.cccd,
        bhxh = EXCLUDED.bhxh,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        dob = EXCLUDED.dob,
        gender = EXCLUDED.gender,
        nation = EXCLUDED.nation,
        email = EXCLUDED.email,
        latest_record_id = EXCLUDED.latest_record_id,
        latest_date = EXCLUDED.latest_date,
        effective_date = EXCLUDED.effective_date,
        next_payment = EXCLUDED.next_payment,
        latest_amount = EXCLUDED.latest_amount,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        notes = EXCLUDED.notes,
        staff_id = EXCLUDED.staff_id,
        total_contributions = EXCLUDED.total_contributions,
        total_amount_paid = EXCLUDED.total_amount_paid,
        household_id = EXCLUDED.household_id,
        members = EXCLUDED.members,
        recv_name = EXCLUDED.recv_name,
        recv_phone = EXCLUDED.recv_phone,
        recv_address = EXCLUDED.recv_address,
        updated_at = NOW();

    RETURN v_rec;
END;
$$;

-- 4. Hàm kiểm tra vi phạm khóa kỳ tài chính (Financial Lock Guard)
CREATE OR REPLACE FUNCTION public.check_record_financial_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_locked_keys JSONB;
    v_record_month TEXT;
    v_record_year TEXT;
    v_record_quarter INT;
    v_month_key_slash TEXT;
    v_month_key_underscore TEXT;
    v_quarter_key TEXT;
    v_year_key TEXT;
    v_is_locked BOOLEAN := false;
BEGIN
    -- Lấy danh sách kỳ bị khóa từ bảng policies
    SELECT value INTO v_locked_keys 
    FROM public.policies 
    WHERE parameter_type = 'locked_periods' AND is_active = true 
    LIMIT 1;

    IF v_locked_keys IS NOT NULL THEN
        v_record_month := TO_CHAR(OLD.date::DATE, 'MM');
        v_record_year  := TO_CHAR(OLD.date::DATE, 'YYYY');
        v_record_quarter := (TO_CHAR(OLD.date::DATE, 'Q'))::INT;

        -- Khớp cả 2 định dạng: month_08/2026 và month_08_2026
        v_month_key_slash      := 'month_' || v_record_month || '/' || v_record_year;
        v_month_key_underscore := 'month_' || v_record_month || '_' || v_record_year;
        v_quarter_key          := 'quarter_' || v_record_quarter || '_' || v_record_year;
        v_year_key             := 'year_' || v_record_year;

        -- Kiểm tra trong mảng JSONB (hỗ trợ cả JSON array trực tiếp hoặc { lockedKeys: [...] })
        IF (jsonb_typeof(v_locked_keys) = 'array' AND (
            v_locked_keys ? v_month_key_slash OR 
            v_locked_keys ? v_month_key_underscore OR 
            v_locked_keys ? v_quarter_key OR 
            v_locked_keys ? v_year_key
        )) OR (
            v_locked_keys->'lockedKeys' IS NOT NULL AND (
                v_locked_keys->'lockedKeys' ? v_month_key_slash OR 
                v_locked_keys->'lockedKeys' ? v_month_key_underscore OR 
                v_locked_keys->'lockedKeys' ? v_quarter_key OR 
                v_locked_keys->'lockedKeys' ? v_year_key
            )
        ) THEN
            v_is_locked := true;
        END IF;

        IF v_is_locked THEN
            -- Nếu DELETE: Chặn hoàn toàn
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Kỳ tài chính (%) đã bị khóa sổ. Tuyệt đối không thể xóa hồ sơ!', v_month_key_slash;
            END IF;

            -- Nếu UPDATE: Chặn thay đổi các cột tài chính cốt lõi
            IF (NEW.amount IS DISTINCT FROM OLD.amount) OR
               (NEW.months IS DISTINCT FROM OLD.months) OR
               (NEW.date IS DISTINCT FROM OLD.date) OR
               (NEW."fromMonth" IS DISTINCT FROM OLD."fromMonth") OR
               (NEW."toMonth" IS DISTINCT FROM OLD."toMonth") OR
               (NEW.type IS DISTINCT FROM OLD.type) OR
               (NEW.wage IS DISTINCT FROM OLD.wage) OR
               (NEW.income IS DISTINCT FROM OLD.income) OR
               (NEW."basePremium" IS DISTINCT FROM OLD."basePremium") OR
               (NEW."nnSupportAmount" IS DISTINCT FROM OLD."nnSupportAmount") OR
               (NEW."dpSupportAmount" IS DISTINCT FROM OLD."dpSupportAmount") OR
               (NEW."paymentStatus" IS DISTINCT FROM OLD."paymentStatus") THEN
                RAISE EXCEPTION 'Kỳ tài chính (%) đã bị khóa sổ. Bạn chỉ được phép cập nhật thông tin liên hệ (SĐT, Địa chỉ, Ghi chú)!', v_month_key_slash;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Gắn Trigger vào bảng records
DROP TRIGGER IF EXISTS trg_protect_financial_lock ON public.records;
CREATE TRIGGER trg_protect_financial_lock
BEFORE UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.check_record_financial_lock();

NOTIFY pgrst, 'reload schema';
