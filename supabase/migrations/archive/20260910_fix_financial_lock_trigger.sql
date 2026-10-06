-- ======================================================================
-- Migration 20260910: KHẮC PHỤC TRIỆT ĐỂ TRIGGER KHÓA KỲ TÀI CHÍNH & CHO PHÉP CẬP NHẬT NHẬT KÝ
-- Hướng dẫn: Mở Supabase Dashboard -> Chọn SQL Editor -> Dán toàn bộ file này -> Bấm Run
-- ======================================================================

-- 1. XÓA BỎ VĨNH VIỄN TRIGGER CŨ BỊ HARDCODE (Nguyên nhân chặn sửa tháng 7/2026 và chặn lưu ghi chú)
DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;
DROP FUNCTION IF EXISTS public.enforce_financial_period_lock();

-- 2. ĐẢM BẢO HÀM KIỂM TRA KHÓA KỲ ĐỘNG CHUẨN XÁC THEO BẢNG POLICIES
CREATE OR REPLACE FUNCTION public.check_record_financial_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_locked_keys JSONB;
    v_target_date TIMESTAMP WITH TIME ZONE;
    v_record_month TEXT;
    v_record_year TEXT;
    v_record_quarter INT;
    v_month_key_slash TEXT;
    v_month_key_underscore TEXT;
    v_quarter_key TEXT;
    v_year_key TEXT;
    v_is_locked BOOLEAN := false;
    v_override TEXT;
BEGIN
    -- 2.1. Kiểm tra quyền override của Admin/Hệ thống
    BEGIN
        v_override := current_setting('app.override_financial_lock', true);
        IF v_override IS NULL OR v_override = '' THEN
            v_override := current_setting('app.is_admin_override', true);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_override := 'false';
    END;

    IF v_override = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- 2.2. Lấy danh sách kỳ bị khóa từ bảng policies (Cấu hình động do Admin quản lý)
    SELECT value INTO v_locked_keys 
    FROM public.policies 
    WHERE parameter_type = 'locked_periods' AND is_active = true 
    LIMIT 1;

    -- Nếu chưa cấu hình hoặc mảng rỗng (đã mở khóa toàn bộ kỳ) thì cho phép qua
    IF v_locked_keys IS NULL OR v_locked_keys = '[]'::jsonb OR (jsonb_typeof(v_locked_keys) = 'array' AND jsonb_array_length(v_locked_keys) = 0) THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Xác định ngày cần kiểm tra
    IF TG_OP = 'DELETE' THEN
        v_target_date := OLD.date;
    ELSE
        v_target_date := COALESCE(NEW.date, OLD.date);
    END IF;

    IF v_target_date IS NOT NULL THEN
        v_record_month := TO_CHAR(v_target_date::DATE, 'MM');
        v_record_year  := TO_CHAR(v_target_date::DATE, 'YYYY');
        v_record_quarter := (TO_CHAR(v_target_date::DATE, 'Q'))::INT;

        v_month_key_slash      := 'month_' || v_record_month || '/' || v_record_year;
        v_month_key_underscore := 'month_' || v_record_month || '_' || v_record_year;
        v_quarter_key          := 'quarter_' || v_record_quarter || '_' || v_record_year;
        v_year_key             := 'year_' || v_record_year;

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
    END IF;

    -- 2.3. Xử lý khi kỳ bị khóa
    IF v_is_locked THEN
        -- Thao tác INSERT vào kỳ đã khóa: Từ chối
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'Kỳ tài chính (%) đã bị khóa sổ dữ liệu. Không thể thêm mới giao dịch vào kỳ này.', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;

        -- Thao tác DELETE: Chặn hoàn toàn
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Kỳ tài chính (%) đã bị khóa sổ dữ liệu. Tuyệt đối không thể xóa hồ sơ này!', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;

        -- Thao tác UPDATE: CHỈ CHẶN CÁC TRƯỜNG TÀI CHÍNH CỐT LÕI
        -- Cho phép cập nhật các trường phi tài chính: notes (nhật ký tác nghiệp/tiếp xúc), phone, address, v.v.
        IF TG_OP = 'UPDATE' THEN
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
                RAISE EXCEPTION 'Kỳ tài chính (%) đã được chốt sổ kế toán. Bạn chỉ được phép cập nhật thông tin liên hệ và nhật ký tác nghiệp/tiếp xúc!', v_month_key_slash
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    -- 2.4. Nếu UPDATE đổi ngày sang một kỳ KHÁC đang bị khóa -> Chặn
    IF TG_OP = 'UPDATE' AND (NEW.date IS DISTINCT FROM OLD.date) AND NEW.date IS NOT NULL THEN
        v_record_month := TO_CHAR(NEW.date::DATE, 'MM');
        v_record_year  := TO_CHAR(NEW.date::DATE, 'YYYY');
        v_record_quarter := (TO_CHAR(NEW.date::DATE, 'Q'))::INT;

        v_month_key_slash      := 'month_' || v_record_month || '/' || v_record_year;
        v_month_key_underscore := 'month_' || v_record_month || '_' || v_record_year;
        v_quarter_key          := 'quarter_' || v_record_quarter || '_' || v_record_year;
        v_year_key             := 'year_' || v_record_year;

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
            RAISE EXCEPTION 'Không thể chuyển ngày giao dịch sang kỳ tài chính (%) đang bị khóa sổ.', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. GẮN TRIGGER BẢO VỆ DUY NHẤT LÊN BẢNG RECORDS
DROP TRIGGER IF EXISTS trg_protect_financial_lock ON public.records;
CREATE TRIGGER trg_protect_financial_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.check_record_financial_lock();

-- 4. TỰ ĐỘNG KHẮC PHỤC DỮ LIỆU BỊ DỊ THƯỜNG NĂM 0264 / 264 TRÊN HỆ THỐNG (NẾU CÓ)
UPDATE public.records
SET 
    "fromMonth" = REGEXP_REPLACE("fromMonth"::text, '0*264', '2026'),
    "toMonth" = REGEXP_REPLACE("toMonth"::text, '0*264', '2026'),
    "nextPayment" = (REGEXP_REPLACE("nextPayment"::text, '^0*264', '2026'))::date
WHERE ("fromMonth"::text LIKE '%264%') 
   OR ("toMonth"::text LIKE '%264%') 
   OR ("nextPayment"::text LIKE '%264%');

-- 5. LÀM MỚI SCHEMA CACHE CỦA POSTGREST
NOTIFY pgrst, 'reload schema';
