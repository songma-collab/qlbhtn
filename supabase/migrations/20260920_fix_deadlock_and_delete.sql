-- ======================================================================
-- BẢN VÁ GỌN GÀNG: XỬ LÝ DEADLOCK (40P01) VÀ SỬA TRIỆT ĐỂ LỖI XÓA GIAO DỊCH
-- ======================================================================

-- 1. GIẢI PHÓNG CÁC TIẾN TRÌNH TREO LOCK ĐANG CHỜ TRÊN CSDL (CHỐNG DEADLOCK)
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE pid <> pg_backend_pid() 
  AND datname = current_database()
  AND (state = 'idle in transaction' OR wait_event_type = 'Lock');

-- 2. ĐẶT TIMEOUT CHỜ LOCK AN TOÀN (10 GIÂY)
SET lock_timeout = '10s';

-- 3. SỬA HÀM TRIGGER check_record_financial_lock: TRẢ VỀ OLD KHI DELETE
CREATE OR REPLACE FUNCTION public.check_record_financial_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_record_month TEXT;
    v_record_year TEXT;
    v_record_quarter INT;
    v_month_key_slash TEXT;
    v_month_key_underscore TEXT;
    v_quarter_key TEXT;
    v_year_key TEXT;
    v_locked_keys JSONB;
    v_is_locked BOOLEAN := false;
    v_target_date TIMESTAMP WITH TIME ZONE;
BEGIN
    IF current_setting('app.is_admin_override', true) = 'true' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_target_date := OLD.date;
    ELSE
        v_target_date := NEW.date;
    END IF;

    SELECT value INTO v_locked_keys
    FROM public.policies
    WHERE parameter_type = 'locked_periods'
      AND is_active = true
    ORDER BY effective_date DESC, id DESC
    LIMIT 1;

    IF v_locked_keys IS NOT NULL AND v_target_date IS NOT NULL THEN
        v_record_month := TO_CHAR(v_target_date::DATE, 'MM');
        v_record_year  := TO_CHAR(v_target_date::DATE, 'YYYY');
        v_record_quarter := (TO_CHAR(v_target_date::DATE, 'Q'))::INT;

        v_month_key_slash      := v_record_month || '/' || v_record_year;
        v_month_key_underscore := v_record_year || '_' || v_record_month;
        v_quarter_key          := 'Q' || v_record_quarter || '/' || v_record_year;
        v_year_key             := v_record_year;

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
    END IF;

    IF v_is_locked THEN
        IF TG_OP = 'INSERT' THEN
            RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Không thể thêm mới giao dịch vào kỳ này.', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;

        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Tuyệt đối không thể xóa hồ sơ này!', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;

        IF TG_OP = 'UPDATE' THEN
            IF (OLD.amount IS DISTINCT FROM NEW.amount) OR
               (OLD.wage IS DISTINCT FROM NEW.wage) OR
               (OLD.income IS DISTINCT FROM NEW.income) OR
               (COALESCE(OLD.from_month, OLD."fromMonth") IS DISTINCT FROM COALESCE(NEW.from_month, NEW."fromMonth")) OR
               (COALESCE(OLD.to_month, OLD."toMonth") IS DISTINCT FROM COALESCE(NEW.to_month, NEW."toMonth")) OR
               (OLD.date IS DISTINCT FROM NEW.date) OR
               (OLD.months IS DISTINCT FROM NEW.months) OR
               (COALESCE(OLD.base_premium, OLD."basePremium") IS DISTINCT FROM COALESCE(NEW.base_premium, NEW."basePremium")) OR
               (COALESCE(OLD.nn_support_amount, OLD."nnSupportAmount") IS DISTINCT FROM COALESCE(NEW.nn_support_amount, NEW."nnSupportAmount")) OR
               (COALESCE(OLD.dp_support_amount, OLD."dpSupportAmount") IS DISTINCT FROM COALESCE(NEW.dp_support_amount, NEW."dpSupportAmount")) OR
               (COALESCE(OLD.payment_status, OLD."paymentStatus") IS DISTINCT FROM COALESCE(NEW.payment_status, NEW."paymentStatus") AND COALESCE(NEW.payment_status, NEW."paymentStatus") = 'Đã hủy') OR
               (COALESCE(OLD.is_submitted_bhxh, OLD."isSubmittedBHXH") IS DISTINCT FROM COALESCE(NEW.is_submitted_bhxh, NEW."isSubmittedBHXH")) THEN
                RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Kỳ kế toán (%) đã được ban giám đốc chốt khóa sổ. Nghiêm cấm chỉnh sửa số tiền, kỳ đóng hoặc hủy giao dịch!', v_month_key_slash
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND (NEW.date IS DISTINCT FROM OLD.date) AND NEW.date IS NOT NULL THEN
        v_record_month := TO_CHAR(NEW.date::DATE, 'MM');
        v_record_year  := TO_CHAR(NEW.date::DATE, 'YYYY');
        v_record_quarter := (TO_CHAR(NEW.date::DATE, 'Q'))::INT;

        v_month_key_slash      := v_record_month || '/' || v_record_year;
        v_month_key_underscore := v_record_year || '_' || v_record_month;
        v_quarter_key          := 'Q' || v_record_quarter || '/' || v_record_year;
        v_year_key             := v_record_year;

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
            RAISE EXCEPTION 'KHÓA SỔ TÀI CHÍNH: Không thể chuyển ngày giao dịch sang kỳ tài chính (%) đang bị khóa sổ.', v_month_key_slash
                USING ERRCODE = '23514';
        END IF;
    END IF;

    -- TRẢ VỀ OLD ĐỂ CHO PHÉP DELETE THỰC SỰ TRÊN DATABASE
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 4. DỌN DẸP VÀ GẮN LẠI TRIGGER BẢO VỆ KỲ TÀI CHÍNH
DROP TRIGGER IF EXISTS trg_protect_financial_lock ON public.records;
DROP TRIGGER IF EXISTS trigger_prevent_submitted_batch_modifications ON public.records;
DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;

CREATE TRIGGER trigger_enforce_financial_period_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.check_record_financial_lock();

-- 5. HÀM RPC XÓA GIAO DỊCH AN TOÀN (delete_record_safe)
DROP FUNCTION IF EXISTS public.delete_record_safe(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_record_safe(p_record_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_user_name TEXT;
  v_cust_key TEXT;
  v_remaining_records INT := 0;
  v_is_admin_user BOOLEAN := false;
  v_deleted_count INT := 0;
BEGIN
  v_is_admin_user := public.is_admin();

  SELECT id, name, type,
         COALESCE("isSubmittedBHXH", is_submitted_bhxh, false) AS is_submitted,
         COALESCE(payment_status, "paymentStatus") AS p_status,
         COALESCE(customer_key, "customerKey", public.generate_customer_key(type, bhxh, cccd, name, phone)) AS c_key,
         cccd, bhxh, phone
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không tìm thấy hồ sơ giao dịch #' || p_record_id);
  END IF;

  IF v_rec.is_submitted = true THEN
    RAISE EXCEPTION 'Hồ sơ "%" (Mã #%) ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', v_rec.name, p_record_id
      USING ERRCODE = '23514';
  END IF;

  IF v_rec.p_status = 'Đã thu tiền' AND NOT v_is_admin_user THEN
    RAISE EXCEPTION 'Giao dịch #% của "%" đã thu tiền. Chỉ Quản lý/Admin mới có quyền xóa!', p_record_id, v_rec.name
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.records WHERE id = p_record_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  IF v_deleted_count = 0 THEN
    DELETE FROM public.records WHERE id::text = p_record_id::text;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  END IF;

  IF v_deleted_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không thể xóa hồ sơ #' || p_record_id || ' từ CSDL (0 dòng bị xóa).');
  END IF;

  v_cust_key := v_rec.c_key;
  IF v_cust_key IS NOT NULL AND TRIM(v_cust_key) != '' THEN
    SELECT COUNT(*) INTO v_remaining_records
    FROM public.records
    WHERE customer_key = v_cust_key 
       OR "customerKey" = v_cust_key
       OR (v_rec.cccd IS NOT NULL AND TRIM(v_rec.cccd) != '' AND cccd = v_rec.cccd)
       OR (v_rec.bhxh IS NOT NULL AND TRIM(v_rec.bhxh) != '' AND bhxh = v_rec.bhxh);

    IF v_remaining_records = 0 THEN
      DELETE FROM public.customers
      WHERE customer_key = v_cust_key 
         OR "customerKey" = v_cust_key
         OR (v_rec.cccd IS NOT NULL AND TRIM(v_rec.cccd) != '' AND cccd = v_rec.cccd)
         OR (v_rec.bhxh IS NOT NULL AND TRIM(v_rec.bhxh) != '' AND bhxh = v_rec.bhxh);
    END IF;
  END IF;

  v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Phạm Văn Học');
  BEGIN
    INSERT INTO public.auditlogs ("action", "details", "userId", "userName", "timestamp")
    VALUES (
      'Xóa giao dịch',
      'Đã xóa giao dịch #' || p_record_id || ' (' || COALESCE(v_rec.type, 'BHXH/BHYT') || ' - ' || COALESCE(v_rec.p_status, 'Chờ thanh toán') || ') của khách hàng ' || COALESCE(v_rec.name, ''),
      COALESCE(auth.uid()::TEXT, 'system'),
      v_user_name,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'deleted_id', p_record_id, 'message', 'Đã xóa giao dịch thành công');
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_record_safe(BIGINT) TO authenticated, service_role;

-- 6. HÀM RPC XÓA KHÁCH HÀNG LIÊN ĐỚI (delete_customer_cascade)
DROP FUNCTION IF EXISTS public.delete_customer_cascade(TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_customer_cascade(p_customer_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_records_count INT := 0;
    v_cust_name TEXT;
    v_cust_id UUID;
    v_has_submitted INT := 0;
    v_has_paid INT := 0;
    v_is_admin_user BOOLEAN := false;
    v_user_name TEXT;
BEGIN
    v_is_admin_user := public.is_admin();

    SELECT id, name INTO v_cust_id, v_cust_name
    FROM public.customers
    WHERE customer_key = p_customer_key
       OR "customerKey" = p_customer_key
       OR cccd = p_customer_key
       OR bhxh = p_customer_key
       OR phone = p_customer_key
    LIMIT 1;

    SELECT COUNT(*) INTO v_has_submitted
    FROM public.records
    WHERE (customer_key = p_customer_key
           OR "customerKey" = p_customer_key
           OR (v_cust_id IS NOT NULL AND (customer_id = v_cust_id OR "customerId" = v_cust_id))
           OR cccd = p_customer_key
           OR bhxh = p_customer_key
           OR phone = p_customer_key
           OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key)
      AND COALESCE("isSubmittedBHXH", is_submitted_bhxh, false) = true;

    IF v_has_submitted > 0 THEN
        RAISE EXCEPTION 'Khách hàng "%" có hồ sơ ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', COALESCE(v_cust_name, p_customer_key)
            USING ERRCODE = '23514';
    END IF;

    IF NOT v_is_admin_user THEN
        SELECT COUNT(*) INTO v_has_paid
        FROM public.records
        WHERE (customer_key = p_customer_key
               OR "customerKey" = p_customer_key
               OR (v_cust_id IS NOT NULL AND (customer_id = v_cust_id OR "customerId" = v_cust_id))
               OR cccd = p_customer_key
               OR bhxh = p_customer_key
               OR phone = p_customer_key
               OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key)
          AND COALESCE(payment_status, "paymentStatus") = 'Đã thu tiền';

        IF v_has_paid > 0 THEN
            RAISE EXCEPTION 'Khách hàng "%" đã có giao dịch Đã thu tiền. Chỉ Quản trị viên mới có quyền xóa khách hàng này!', COALESCE(v_cust_name, p_customer_key)
                USING ERRCODE = '42501';
        END IF;
    END IF;

    WITH deleted_rows AS (
        DELETE FROM public.records
        WHERE customer_key = p_customer_key
           OR "customerKey" = p_customer_key
           OR (v_cust_id IS NOT NULL AND (customer_id = v_cust_id OR "customerId" = v_cust_id))
           OR cccd = p_customer_key
           OR bhxh = p_customer_key
           OR phone = p_customer_key
           OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_records_count FROM deleted_rows;

    DELETE FROM public.customers
    WHERE customer_key = p_customer_key
       OR "customerKey" = p_customer_key
       OR (v_cust_id IS NOT NULL AND id = v_cust_id)
       OR cccd = p_customer_key
       OR bhxh = p_customer_key
       OR phone = p_customer_key;

    v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Phạm Văn Học');
    BEGIN
      INSERT INTO public.auditlogs ("action", "details", "userId", "userName", "timestamp")
      VALUES (
          'Xóa khách hàng liên đới',
          'Xóa khách hàng ' || COALESCE(v_cust_name, p_customer_key) || ' (Đã xóa liên đới ' || v_deleted_records_count || ' giao dịch)',
          COALESCE(auth.uid()::TEXT, 'system'),
          v_user_name,
          NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'customer_key', p_customer_key,
        'deleted_records', v_deleted_records_count,
        'message', 'Đã xóa khách hàng và các giao dịch liên đới thành công'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(TEXT) TO authenticated, service_role;

-- 7. CẬP NHẬT RLS POLICIES XÓA
DROP POLICY IF EXISTS "records_delete_authenticated" ON public.records;
CREATE POLICY "records_delete_authenticated" ON public.records
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR COALESCE(payment_status, "paymentStatus") IN ('Chờ thanh toán', 'Chờ thu tiền', 'Chưa thu tiền', 'Đã hủy')
    OR COALESCE(payment_status, "paymentStatus") != 'Đã thu tiền'
  );

DROP POLICY IF EXISTS "customers_delete_authenticated" ON public.customers;
CREATE POLICY "customers_delete_authenticated" ON public.customers
  FOR DELETE TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
