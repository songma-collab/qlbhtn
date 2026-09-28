-- ======================================================================
-- BẢN VÁ TỔNG TOÀN DIỆN (ĐÃ BỔ SUNG ĐẦY ĐỦ FUNCTION ĐỘC LẬP)
-- File: 20260921_production_ready_hotfix.sql
-- ======================================================================

BEGIN;

-- ----------------------------------------------------------------------
-- 1. VÁ LỖ HỔNG SEC-01: PHÂN QUYỀN CHẶT CHẼ, TRIỆT TIÊU HARDCODE BYPASS
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = v_uid
      AND LOWER(TRIM(role)) IN ('admin', 'quản trị viên', 'quan tri vien')
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN true;
  END IF;

  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.staff 
    WHERE auth_user_id = v_uid
      AND LOWER(TRIM(role)) IN ('admin', 'quản lý', 'quan ly', 'quản trị viên', 'quan tri vien')
      AND COALESCE(status, 'Đang hoạt động') != 'Tạm khóa'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated, anon, service_role;

-- ----------------------------------------------------------------------
-- 2. VÁ LỖ HỔNG INT-01: CHUẨN HÓA TRIGGER KHÓA KỲ (DELETE -> RETURN OLD)
-- ----------------------------------------------------------------------
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
BEGIN
    IF current_setting('app.is_admin_override', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    SELECT value INTO v_locked_keys
    FROM public.policies
    WHERE parameter_type = 'locked_periods' AND is_active = true
    ORDER BY effective_date DESC, id DESC
    LIMIT 1;

    IF v_locked_keys IS NULL THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    v_target_date := COALESCE(OLD.date, NEW.date, NOW());
    v_record_month := TO_CHAR(v_target_date, 'MM');
    v_record_year := TO_CHAR(v_target_date, 'YYYY');
    v_record_quarter := EXTRACT(QUARTER FROM v_target_date)::INT;

    v_month_key_slash := v_record_month || '/' || v_record_year;
    v_month_key_underscore := v_record_year || '_' || v_record_month;
    v_quarter_key := 'Q' || v_record_quarter || '/' || v_record_year;
    v_year_key := v_record_year;

    IF (jsonb_typeof(v_locked_keys) = 'array' AND (
        v_locked_keys ? v_month_key_slash OR
        v_locked_keys ? v_month_key_underscore OR
        v_locked_keys ? ('month_' || v_month_key_slash) OR
        v_locked_keys ? ('month_' || v_month_key_underscore) OR
        v_locked_keys ? v_quarter_key OR
        v_locked_keys ? ('quarter_' || v_record_quarter || '_' || v_record_year) OR
        v_locked_keys ? v_year_key OR
        v_locked_keys ? ('year_' || v_record_year)
    )) OR (
        v_locked_keys->'lockedKeys' IS NOT NULL AND (
            v_locked_keys->'lockedKeys' ? v_month_key_slash OR
            v_locked_keys->'lockedKeys' ? v_month_key_underscore OR
            v_locked_keys->'lockedKeys' ? ('month_' || v_month_key_slash) OR
            v_locked_keys->'lockedKeys' ? ('month_' || v_month_key_underscore) OR
            v_locked_keys->'lockedKeys' ? v_quarter_key OR
            v_locked_keys->'lockedKeys' ? ('quarter_' || v_record_quarter || '_' || v_record_year) OR
            v_locked_keys->'lockedKeys' ? v_year_key OR
            v_locked_keys->'lockedKeys' ? ('year_' || v_record_year)
        )
    ) THEN
        v_is_locked := true;
    END IF;

    IF v_is_locked THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Nghiêm cấm xóa giao dịch.', v_month_key_slash
                USING ERRCODE = '23514';
        ELSIF TG_OP = 'UPDATE' THEN
            IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
               (OLD.wage IS DISTINCT FROM NEW.wage) OR
               (OLD.income IS DISTINCT FROM NEW.income) OR
               (COALESCE(OLD.from_month, OLD."fromMonth") IS DISTINCT FROM COALESCE(NEW.from_month, NEW."fromMonth")) OR
               (COALESCE(OLD.to_month, OLD."toMonth") IS DISTINCT FROM COALESCE(NEW.to_month, NEW."toMonth")) OR
               (OLD.date IS DISTINCT FROM NEW.date) OR
               (OLD.months IS DISTINCT FROM NEW.months) OR
               (COALESCE(OLD.payment_status, OLD."paymentStatus") IS DISTINCT FROM COALESCE(NEW.payment_status, NEW."paymentStatus") AND COALESCE(NEW.payment_status, NEW."paymentStatus") = 'Đã hủy') THEN
                RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được chốt khóa sổ. Không thể sửa số tiền hoặc hủy giao dịch!', v_month_key_slash
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    -- QUY TẮC CỐT LÕI: DELETE phải trả về OLD để không bị PostgreSQL hủy lệnh
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;
CREATE TRIGGER trigger_enforce_financial_period_lock
BEFORE UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.check_record_financial_lock();

-- ----------------------------------------------------------------------
-- 3. VÁ LỖ HỔNG SEC-02: BẢO VỆ CHỨNG TỪ KẾ TOÁN TRÊN POLICY UPDATE
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "records_update_authenticated" ON public.records;
CREATE POLICY "records_update_authenticated" ON public.records
  FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
      AND COALESCE(payment_status, "paymentStatus") != 'Đã thu tiền'
    )
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      COALESCE(staff_id, "staffId") = (SELECT s.id FROM public.staff s WHERE s.auth_user_id = auth.uid())
      AND COALESCE(amount, 0) >= 0
      AND COALESCE(is_adjustment, "isAdjustment", false) = false
      AND COALESCE(payment_status, "paymentStatus") != 'Đã thu tiền'
    )
  );

-- ----------------------------------------------------------------------
-- 4. VÁ LỖ HỔNG SEC-03: ĐỊNH NGHĨA FUNCTION VÀ BẢO VỆ BẢNG AUDITLOGS
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_auditlog_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Bảo mật: Nhật ký hệ thống (Audit Logs) là dữ liệu bất biến (Append-only). Nghiêm cấm chỉnh sửa, xóa dòng hoặc làm rỗng bảng.';
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_auditlog_update ON public.auditlogs;
CREATE TRIGGER trigger_prevent_auditlog_update
  BEFORE UPDATE OR DELETE ON public.auditlogs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_auditlog_modification();

DROP TRIGGER IF EXISTS trigger_prevent_auditlog_truncate ON public.auditlogs;
CREATE TRIGGER trigger_prevent_auditlog_truncate
  BEFORE TRUNCATE ON public.auditlogs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_auditlog_modification();

-- ----------------------------------------------------------------------
-- 5. BỔ SUNG CHỈ MỤC TỐI ƯU HIỆU NĂNG PERF-01 (GIN TRIGRAM & BRIN)
-- ----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_trgm_name ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_phone ON public.customers USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_cccd ON public.customers USING gin (cccd gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_records_brin_date ON public.records USING brin (date);

COMMIT;
