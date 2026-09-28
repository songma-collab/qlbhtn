-- supabase/migrations/20260823000003_financial_lock_and_server_audit.sql
-- GIAI ĐOẠN 5: CƯỠNG CHẾ KHÓA KỲ TÀI CHÍNH Ở POSTGRESQL LEVEL VÀ SERVER-SIDE AUDIT LOGGING
-- Thay thế và hoàn thiện financial_period_lock_enforcement.sql

-- ======================================================================
-- 1. HÀM KIỂM TRA TRẠNG THÁI KHÓA KỲ TÀI CHÍNH
-- ======================================================================

CREATE OR REPLACE FUNCTION public.is_financial_period_locked(p_date TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_y text;
  v_m text;
  v_m_num integer;
  v_q_num integer;
  v_month_key text;
  v_quarter_key text;
  v_year_key text;
  v_locked_keys jsonb;
  v_is_locked boolean := false;
BEGIN
  IF p_date IS NULL THEN
    RETURN false;
  END IF;

  v_y := to_char(p_date, 'YYYY');
  v_m := to_char(p_date, 'MM');
  v_m_num := extract(month from p_date)::integer;
  v_q_num := ceil(v_m_num / 3.0)::integer;

  v_month_key := 'month_' || v_m || '/' || v_y;
  v_quarter_key := 'quarter_' || v_q_num::text || '_' || v_y;
  v_year_key := 'year_' || v_y;

  SELECT 
    CASE 
      WHEN jsonb_typeof(value) = 'array' THEN value
      WHEN jsonb_typeof(value->'lockedKeys') = 'array' THEN value->'lockedKeys'
      ELSE '[]'::jsonb
    END
  INTO v_locked_keys
  FROM public.policies
  WHERE parameter_type = 'locked_periods' AND is_active = true
  LIMIT 1;

  IF v_locked_keys IS NULL OR jsonb_array_length(v_locked_keys) = 0 THEN
    RETURN false;
  END IF;

  IF v_locked_keys @> to_jsonb(v_month_key) OR 
     v_locked_keys @> to_jsonb(v_quarter_key) OR 
     v_locked_keys @> to_jsonb(v_year_key) THEN
    v_is_locked := true;
  END IF;

  RETURN v_is_locked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_financial_period_locked(TIMESTAMP WITH TIME ZONE) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_financial_period_locked(TIMESTAMP WITH TIME ZONE) TO authenticated;


-- ======================================================================
-- 2. TRIGGER CƯỠNG CHẾ KHÓA KỲ TRÊN BẢNG RECORDS (INSERT/UPDATE/DELETE)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.enforce_financial_period_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_override text;
BEGIN
  -- Kiểm tra cờ session override (chỉ được bật trong phạm vi giao dịch của RPC admin_override_record)
  BEGIN
    v_override := current_setting('app.override_financial_lock', true);
  EXCEPTION WHEN OTHERS THEN
    v_override := 'false';
  END;

  IF v_override = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Thao tác INSERT: Kiểm tra ngày tạo NEW.date
  IF TG_OP = 'INSERT' THEN
    IF public.is_financial_period_locked(NEW.date) THEN
      RAISE EXCEPTION 'Dữ liệu ngày % thuộc kỳ tài chính đã BỊ KHÓA DỮ LIỆU. Không thể tạo mới.', to_char(NEW.date, 'DD/MM/YYYY');
    END IF;
    RETURN NEW;
  END IF;

  -- Thao tác UPDATE: Kiểm tra cả ngày trước và sau khi sửa
  IF TG_OP = 'UPDATE' THEN
    IF public.is_financial_period_locked(OLD.date) THEN
      RAISE EXCEPTION 'Hồ sơ thuộc kỳ tài chính ngày % đã BỊ KHÓA DỮ LIỆU. Không thể chỉnh sửa.', to_char(OLD.date, 'DD/MM/YYYY');
    END IF;

    IF public.is_financial_period_locked(NEW.date) THEN
      RAISE EXCEPTION 'Không thể chuyển hồ sơ sang kỳ tài chính ngày % đang BỊ KHÓA DỮ LIỆU.', to_char(NEW.date, 'DD/MM/YYYY');
    END IF;

    RETURN NEW;
  END IF;

  -- Thao tác DELETE: Kiểm tra ngày OLD.date
  IF TG_OP = 'DELETE' THEN
    IF public.is_financial_period_locked(OLD.date) THEN
      RAISE EXCEPTION 'Hồ sơ thuộc kỳ tài chính ngày % đã BỊ KHÓA DỮ LIỆU. Không thể xóa.', to_char(OLD.date, 'DD/MM/YYYY');
    END IF;
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;
CREATE TRIGGER trigger_enforce_financial_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.records
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_financial_period_lock();


-- ======================================================================
-- 3. RPC MỞ KHÓA CAN THIỆP DÀNH RIÊNG CHO ADMIN (CÓ AUDIT LOG BẮT BUỘC)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.admin_override_record(
  p_action TEXT,
  p_record_id BIGINT,
  p_update_fields JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_user_name text;
  v_target_record records%ROWTYPE;
BEGIN
  IF auth.role() != 'authenticated' THEN
    RAISE EXCEPTION 'Access denied: Yêu cầu đăng nhập.';
  END IF;

  v_role := public.get_my_role();
  IF v_role NOT IN ('Admin', 'Quản lý') THEN
    RAISE EXCEPTION 'Access denied: Quyền mở khóa can thiệp chỉ dành riêng cho Admin hoặc Quản lý.';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Vui lòng nhập lý do can thiệp mở khóa tối thiểu 5 ký tự.';
  END IF;
  IF LENGTH(p_reason) > 500 THEN
    RAISE EXCEPTION 'Lý do can thiệp mở khóa không được vượt quá 500 ký tự.';
  END IF;

  SELECT name INTO v_user_name FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_user_name IS NULL THEN
    SELECT name INTO v_user_name FROM public.staff WHERE lower(email) = lower(auth.jwt()->>'email') LIMIT 1;
  END IF;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt()->>'email', 'Admin');
  END IF;

  SELECT * INTO v_target_record FROM public.records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hồ sơ ID % không tồn tại.', p_record_id;
  END IF;

  -- Kích hoạt cờ session override tạm thời
  PERFORM set_config('app.override_financial_lock', 'true', true);

  IF UPPER(p_action) = 'DELETE' THEN
    DELETE FROM public.records WHERE id = p_record_id;
    
    INSERT INTO public.auditlogs (id, userId, userName, action, details, timestamp)
    VALUES (
      gen_random_uuid()::text,
      auth.uid()::text,
      v_user_name,
      'Admin Override Delete',
      'Đã mở khóa xóa hồ sơ khách hàng ' || COALESCE(v_target_record.name, '') || ' (Kỳ ' || to_char(v_target_record.date, 'DD/MM/YYYY') || '). Lý do: ' || TRIM(p_reason),
      NOW()
    );
  ELSIF UPPER(p_action) = 'UPDATE' AND p_update_fields IS NOT NULL THEN
    UPDATE public.records
    SET 
      "paymentStatus" = COALESCE(p_update_fields->>'paymentStatus', "paymentStatus"),
      "staffId" = COALESCE(p_update_fields->>'staffId', "staffId"),
      "isSubmittedBHXH" = COALESCE((p_update_fields->>'isSubmittedBHXH')::boolean, "isSubmittedBHXH"),
      "notes" = COALESCE(p_update_fields->>'notes', "notes")
    WHERE id = p_record_id;

    INSERT INTO public.auditlogs (id, userId, userName, action, details, timestamp)
    VALUES (
      gen_random_uuid()::text,
      auth.uid()::text,
      v_user_name,
      'Admin Override Update',
      'Đã mở khóa chỉnh sửa hồ sơ khách hàng ' || COALESCE(v_target_record.name, '') || ' (Kỳ ' || to_char(v_target_record.date, 'DD/MM/YYYY') || '). Lý do: ' || TRIM(p_reason),
      NOW()
    );
  ELSE
    RAISE EXCEPTION 'Hành động không hợp lệ. Chỉ chấp nhận UPDATE hoặc DELETE.';
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_override_record(TEXT, BIGINT, JSONB, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_override_record(TEXT, BIGINT, JSONB, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
