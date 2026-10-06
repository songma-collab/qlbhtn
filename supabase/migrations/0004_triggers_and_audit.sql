-- ======================================================================
-- NỀN TẢNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ
-- BASELINE MIGRATION 0004: TRIGGERS & AUDITING (100% SNAKE_CASE)
-- ======================================================================
-- Mục đích: Kích hoạt toàn bộ trigger nghiệp vụ, bảo vệ bất biến dữ liệu,
-- Tự động đồng bộ Master Data (Incremental Delta), khóa kỳ kế toán và kiểm toán.
-- Naming Convention: 100% snake_case, triệt tiêu toàn bộ trigger alias cũ.
-- ======================================================================

-- 1. BẢO VỆ BẤT BIẾN BẢNG KIỂM TOÁN (AUDITLOGS IMMUTABILITY)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.enforce_auditlog_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'BẢO MẬT HỆ THỐNG: Bảng nhật ký kiểm toán (auditlogs) là dữ liệu bất biến (Append-Only). Mọi hành vi UPDATE, DELETE hoặc TRUNCATE đều bị nghiêm cấm!'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_auditlog_append_only ON public.auditlogs;
DROP TRIGGER IF EXISTS trigger_prevent_auditlog_update ON public.auditlogs;
DROP TRIGGER IF EXISTS trigger_prevent_audit_tampering ON public.auditlogs;
CREATE TRIGGER trg_auditlog_append_only
  BEFORE UPDATE OR DELETE ON public.auditlogs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_auditlog_immutability();

DROP TRIGGER IF EXISTS trg_prevent_audit_log_truncate ON public.auditlogs;
DROP TRIGGER IF EXISTS trigger_prevent_auditlog_truncate ON public.auditlogs;
CREATE TRIGGER trigger_prevent_auditlog_truncate
  BEFORE TRUNCATE ON public.auditlogs
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enforce_auditlog_immutability();

-- ======================================================================
-- 2. BẢO VỆ KHÓA KỲ TÀI CHÍNH ĐỘNG (FINANCIAL PERIOD LOCKING)
-- ======================================================================

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
    BEGIN
        v_override := current_setting('app.is_admin_override', true);
        IF v_override IS NULL OR v_override = '' THEN
            v_override := current_setting('app.override_financial_lock', true);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_override := 'false';
    END;

    IF v_override = 'true' OR current_user IN ('postgres', 'supabase_admin') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    SELECT value INTO v_locked_keys
    FROM public.policies
    WHERE parameter_type = 'locked_periods' AND is_active = true
    LIMIT 1;

    IF v_locked_keys IS NULL OR (
        jsonb_typeof(v_locked_keys) = 'array' AND jsonb_array_length(v_locked_keys) = 0
    ) THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    v_target_date := COALESCE(OLD.date, NEW.date, NOW());
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
               (OLD.from_month IS DISTINCT FROM NEW.from_month) OR
               (OLD.to_month IS DISTINCT FROM NEW.to_month) OR
               (OLD.date IS DISTINCT FROM NEW.date) OR
               (OLD.months IS DISTINCT FROM NEW.months) OR
               (OLD.base_premium IS DISTINCT FROM NEW.base_premium) OR
               (OLD.nn_support_amount IS DISTINCT FROM NEW.nn_support_amount) OR
               (OLD.dp_support_amount IS DISTINCT FROM NEW.dp_support_amount) OR
               (OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'Đã hủy') OR
               (OLD.is_submitted_bhxh IS DISTINCT FROM NEW.is_submitted_bhxh) THEN
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

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_financial_period_lock ON public.records;
DROP TRIGGER IF EXISTS trg_protect_financial_lock ON public.records;
CREATE TRIGGER trigger_enforce_financial_period_lock
BEFORE INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW EXECUTE FUNCTION public.check_record_financial_lock();

-- ======================================================================
-- 3. CÁC TRIGGER BẢO VỆ TÍNH TOÀN VẸN GIAO DỊCH
-- ======================================================================

-- 3.1. Ngăn chặn xóa hồ sơ đã chuyển cơ quan BHXH
CREATE OR REPLACE FUNCTION public.prevent_delete_submitted_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD.is_submitted_bhxh = TRUE THEN
        IF current_setting('app.is_admin_override', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Bảo vệ dữ liệu: Giao dịch của khách hàng "%" (Mã số %) ĐÃ CHUYỂN BHXH. Thao tác xóa bị từ chối!', OLD.name, OLD.id
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_delete_submitted_records ON public.records;
CREATE TRIGGER trigger_prevent_delete_submitted_records
BEFORE DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_submitted_records();

-- 3.2. Bảo vệ tính toàn vẹn tài chính: Ngăn chặn sửa ngày, tiền của hồ sơ đã thu tiền
CREATE OR REPLACE FUNCTION public.protect_paid_record_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_manager_or_admin() OR current_setting('app.is_admin_override', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF OLD.payment_status = 'Đã thu tiền' THEN
    IF NEW.date IS DISTINCT FROM OLD.date OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.wage IS DISTINCT FROM OLD.wage THEN
      RAISE EXCEPTION 'Bảo mật tài chính: Giao dịch đã thu tiền không được phép chỉnh sửa ngày hoặc số tiền đóng. Vui lòng liên hệ Quản lý.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_paid_record_financials ON public.records;
CREATE TRIGGER trg_protect_paid_record_financials
  BEFORE UPDATE ON public.records
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_paid_record_financials();

-- 3.3. Kiểm soát bất biến hồ sơ đã nộp theo đợt BHXH
CREATE OR REPLACE FUNCTION public.check_submitted_batch_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_submitted_bhxh = true THEN
    IF current_setting('app.is_admin_override', true) = 'true' OR current_user IN ('postgres', 'supabase_admin') THEN
      RETURN NEW;
    END IF;

    IF (NEW.amount IS DISTINCT FROM OLD.amount) OR
       (NEW.date IS DISTINCT FROM OLD.date) OR
       (NEW.type IS DISTINCT FROM OLD.type) OR
       (NEW.wage IS DISTINCT FROM OLD.wage) OR
       (NEW.months IS DISTINCT FROM OLD.months) OR
       (NEW.from_month IS DISTINCT FROM OLD.from_month) OR
       (NEW.to_month IS DISTINCT FROM OLD.to_month) OR
       (NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'Đã hủy') THEN
      RAISE EXCEPTION 'Hồ sơ này đã được kết xuất chuyển nộp BHXH trong đợt [%]. Nghiêm cấm thay đổi thông tin tài chính hoặc hủy bỏ!',
        COALESCE(OLD.submission_batch, 'BHXH')
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_submitted_batch_lock ON public.records;
CREATE TRIGGER trigger_check_submitted_batch_lock
BEFORE UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.check_submitted_batch_lock();

-- 3.4. Trigger tự động chuẩn hóa ngày tháng kỳ đóng (from_month_date & to_month_date)
CREATE OR REPLACE FUNCTION public.parse_record_dates_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.from_month IS NOT NULL AND NEW.from_month != '' THEN
    NEW.from_month_date := COALESCE(NEW.from_month_date, public.parse_month_str_to_date(NEW.from_month));
  END IF;

  IF NEW.to_month IS NOT NULL AND NEW.to_month != '' THEN
    NEW.to_month_date := COALESCE(NEW.to_month_date, public.parse_month_str_to_date(NEW.to_month));
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parse_record_dates ON public.records;
CREATE TRIGGER trg_parse_record_dates
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.parse_record_dates_trigger();

-- ======================================================================
-- 4. HỆ THỐNG TRIGGER ĐỒNG BỘ KHÁCH HÀNG (CUSTOMER LIFECYCLE)
-- ======================================================================

-- 4.1. BEFORE INSERT OR UPDATE trên records: Gán customer_key và liên kết customer_id
CREATE OR REPLACE FUNCTION public.before_record_assign_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key TEXT;
    v_cust_id UUID;
BEGIN
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.type IS NOT DISTINCT FROM NEW.type AND
           OLD.bhxh IS NOT DISTINCT FROM NEW.bhxh AND
           OLD.old_bhxh IS NOT DISTINCT FROM NEW.old_bhxh AND
           OLD.cccd IS NOT DISTINCT FROM NEW.cccd AND
           OLD.name IS NOT DISTINCT FROM NEW.name AND
           OLD.phone IS NOT DISTINCT FROM NEW.phone AND
           OLD.address IS NOT DISTINCT FROM NEW.address AND
           OLD.dob IS NOT DISTINCT FROM NEW.dob AND
           OLD.gender IS NOT DISTINCT FROM NEW.gender AND
           NEW.customer_id IS NOT NULL AND
           NEW.customer_key IS NOT NULL THEN
            RETURN NEW;
        END IF;
    END IF;

    v_key := public.generate_customer_key(NEW.type, NEW.bhxh, NEW.cccd, NEW.name, NEW.phone);
    NEW.customer_key := v_key;

    SELECT id INTO v_cust_id FROM public.customers WHERE customer_key = v_key LIMIT 1;

    IF v_cust_id IS NULL THEN
        INSERT INTO public.customers (
            customer_key, type, name, cccd, bhxh, old_bhxh,
            phone, address, dob, gender, nation, email,
            status, payment_status, notes, staff_id,
            household_id, recv_name, recv_phone, recv_address,
            created_at, updated_at
        ) VALUES (
            v_key, NEW.type, COALESCE(NEW.name, 'Chưa đặt tên'), NEW.cccd, NEW.bhxh, NEW.old_bhxh,
            NEW.phone, NEW.address, NEW.dob, NEW.gender, NEW.nation, NEW.email,
            COALESCE(NEW.status, 'Đang tham gia'), COALESCE(NEW.payment_status, 'Đã thu tiền'), NEW.notes, NEW.staff_id,
            NEW.household_id, NEW.recv_name, NEW.recv_phone, NEW.recv_address,
            NOW(), NOW()
        )
        ON CONFLICT (customer_key) DO UPDATE
        SET updated_at = NOW()
        RETURNING id INTO v_cust_id;
    END IF;

    NEW.customer_id := v_cust_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_before_record_assign_customer ON public.records;
CREATE TRIGGER trigger_before_record_assign_customer
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.before_record_assign_customer();

-- 4.2. AFTER INSERT OR UPDATE OR DELETE trên records: Đồng bộ Incremental Delta vào customers
CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT;
    v_target_status TEXT;
    v_old_eff_amount NUMERIC := 0;
    v_new_eff_amount NUMERIC := 0;
    v_old_eff_contrib INT := 0;
    v_new_eff_contrib INT := 0;
    v_delta_amount NUMERIC := 0;
    v_delta_contrib INT := 0;
    v_latest_id BIGINT;
BEGIN
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.amount IS NOT DISTINCT FROM NEW.amount AND
           OLD.status IS NOT DISTINCT FROM NEW.status AND
           OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status AND
           OLD.date IS NOT DISTINCT FROM NEW.date AND
           OLD.effective_date IS NOT DISTINCT FROM NEW.effective_date AND
           OLD.next_payment IS NOT DISTINCT FROM NEW.next_payment AND
           OLD.name IS NOT DISTINCT FROM NEW.name AND
           OLD.phone IS NOT DISTINCT FROM NEW.phone AND
           OLD.cccd IS NOT DISTINCT FROM NEW.cccd AND
           OLD.bhxh IS NOT DISTINCT FROM NEW.bhxh AND
           OLD.old_bhxh IS NOT DISTINCT FROM NEW.old_bhxh AND
           OLD.dob IS NOT DISTINCT FROM NEW.dob AND
           OLD.gender IS NOT DISTINCT FROM NEW.gender AND
           OLD.nation IS NOT DISTINCT FROM NEW.nation AND
           OLD.email IS NOT DISTINCT FROM NEW.email AND
           OLD.address IS NOT DISTINCT FROM NEW.address AND
           OLD.notes IS NOT DISTINCT FROM NEW.notes AND
           OLD.income IS NOT DISTINCT FROM NEW.income AND
           OLD.method IS NOT DISTINCT FROM NEW.method AND
           OLD.from_month IS NOT DISTINCT FROM NEW.from_month AND
           OLD.to_month IS NOT DISTINCT FROM NEW.to_month AND
           OLD.recv_name IS NOT DISTINCT FROM NEW.recv_name AND
           OLD.recv_phone IS NOT DISTINCT FROM NEW.recv_phone AND
           OLD.recv_address IS NOT DISTINCT FROM NEW.recv_address AND
           OLD.type IS NOT DISTINCT FROM NEW.type AND
           OLD.is_adjustment IS NOT DISTINCT FROM NEW.is_adjustment AND
           OLD.household_id IS NOT DISTINCT FROM NEW.household_id AND
           OLD.members IS NOT DISTINCT FROM NEW.members THEN
            RETURN NEW;
        END IF;
    END IF;

    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    v_key := COALESCE(v_rec.customer_key, public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone));

    -- Tính vi sai tích lũy
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.payment_status = 'Đã thu tiền' THEN
        v_old_eff_amount := COALESCE(OLD.amount, 0);
        v_old_eff_contrib := CASE WHEN OLD.is_adjustment IS TRUE THEN -1 ELSE 1 END;
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.payment_status = 'Đã thu tiền' THEN
        v_new_eff_amount := COALESCE(NEW.amount, 0);
        v_new_eff_contrib := CASE WHEN NEW.is_adjustment IS TRUE THEN -1 ELSE 1 END;
    END IF;

    v_delta_amount := v_new_eff_amount - v_old_eff_amount;
    v_delta_contrib := v_new_eff_contrib - v_old_eff_contrib;

    -- Xác định trạng thái vòng đời khách hàng
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        IF NEW.payment_status = 'Đã thu tiền' AND COALESCE(NEW.amount, 0) > 0 AND (NEW.is_adjustment IS NOT TRUE) AND (NEW.status IS NULL OR NEW.status != 'Đã dừng đóng') THEN
            v_target_status := 'Đang tham gia';
        ELSIF NEW.status = 'Đã dừng đóng' THEN
            v_target_status := 'Đã dừng đóng';
        ELSE
            v_target_status := COALESCE(NEW.status, 'Đang tham gia');
        END IF;
        v_latest_id := NEW.id;
    ELSE
        v_target_status := 'Đang tham gia';
        v_latest_id := NULL;
    END IF;

    INSERT INTO public.customers (
        customer_key, type, name, cccd, bhxh, old_bhxh, phone, address, dob, gender, nation, email,
        latest_record_id, status, payment_status, notes, staff_id, total_contributions, total_amount_paid,
        household_id, members, recv_name, recv_phone, recv_address, created_at, updated_at
    ) VALUES (
        v_key, v_rec.type, v_rec.name, v_rec.cccd, v_rec.bhxh, v_rec.old_bhxh, v_rec.phone, v_rec.address,
        v_rec.dob, v_rec.gender, v_rec.nation, v_rec.email,
        v_latest_id, v_target_status, v_rec.payment_status, v_rec.notes, v_rec.staff_id,
        GREATEST(0, v_delta_contrib), GREATEST(0, v_delta_amount),
        v_rec.household_id,
        CASE WHEN v_rec.members IS NOT NULL THEN to_jsonb(v_rec.members) ELSE NULL END,
        v_rec.recv_name, v_rec.recv_phone, v_rec.recv_address, NOW(), NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE SET
        total_amount_paid = GREATEST(0, COALESCE(public.customers.total_amount_paid, 0) + v_delta_amount),
        total_contributions = GREATEST(0, COALESCE(public.customers.total_contributions, 0) + v_delta_contrib),
        latest_record_id = COALESCE(v_latest_id, public.customers.latest_record_id),
        type = COALESCE(EXCLUDED.type, public.customers.type),
        name = COALESCE(EXCLUDED.name, public.customers.name),
        cccd = COALESCE(EXCLUDED.cccd, public.customers.cccd),
        bhxh = COALESCE(EXCLUDED.bhxh, public.customers.bhxh),
        old_bhxh = COALESCE(EXCLUDED.old_bhxh, public.customers.old_bhxh),
        phone = COALESCE(EXCLUDED.phone, public.customers.phone),
        address = COALESCE(EXCLUDED.address, public.customers.address),
        dob = COALESCE(EXCLUDED.dob, public.customers.dob),
        gender = COALESCE(EXCLUDED.gender, public.customers.gender),
        nation = COALESCE(EXCLUDED.nation, public.customers.nation),
        email = COALESCE(EXCLUDED.email, public.customers.email),
        status = CASE 
            WHEN v_target_status IS NOT NULL AND v_target_status != '' THEN v_target_status
            ELSE public.customers.status
        END,
        payment_status = COALESCE(EXCLUDED.payment_status, public.customers.payment_status),
        notes = COALESCE(EXCLUDED.notes, public.customers.notes),
        staff_id = COALESCE(EXCLUDED.staff_id, public.customers.staff_id),
        household_id = COALESCE(EXCLUDED.household_id, public.customers.household_id),
        members = COALESCE(EXCLUDED.members, public.customers.members),
        recv_name = COALESCE(EXCLUDED.recv_name, public.customers.recv_name),
        recv_phone = COALESCE(EXCLUDED.recv_phone, public.customers.recv_phone),
        recv_address = COALESCE(EXCLUDED.recv_address, public.customers.recv_address),
        updated_at = NOW();

    RETURN v_rec;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_customer_from_record ON public.records;
CREATE TRIGGER trigger_sync_customer_from_record
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_record();

-- ======================================================================
-- 5. TRIGGER KIỂM TOÁN TỰ ĐỘNG SERVER-SIDE (AUDIT LOGGING)
-- ======================================================================

-- 5.1. Tự động ghi Audit Log khi thao tác trên bảng records
CREATE OR REPLACE FUNCTION public.audit_record_changes_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_action TEXT;
  v_details TEXT;
BEGIN
  v_user_id := COALESCE(auth.uid()::TEXT, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Khách vãng lai / Hệ thống');
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'Thêm mới hồ sơ';
    v_details := format('Tạo hồ sơ #%s (%s) cho khách hàng %s (CCCD/BHXH: %s - %s)', NEW.id, NEW.type, NEW.name, NEW.cccd, NEW.bhxh);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'Cập nhật hồ sơ';
    v_details := format('Cập nhật hồ sơ ID %s (%s - %s), Trạng thái thanh toán: %s -> %s', NEW.id, NEW.name, NEW.type, OLD.payment_status, NEW.payment_status);
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'Xóa hồ sơ';
    v_details := format('Xóa hồ sơ ID %s của khách hàng %s (%s)', OLD.id, OLD.name, OLD.type);
  END IF;

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (v_user_id, v_user_name, v_action, v_details, NOW());

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_record_change ON public.records;
CREATE TRIGGER trigger_audit_record_change
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.audit_record_changes_trigger();

-- 5.2. Tự động ghi log khi cập nhật thông tin VietQR trên settings
CREATE OR REPLACE FUNCTION public.audit_vietqr_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_user_name TEXT;
  v_details TEXT;
BEGIN
  v_user_id := COALESCE(auth.uid()::text, 'system');
  
  SELECT name INTO v_user_name 
  FROM public.staff 
  WHERE id = v_user_id OR email = (auth.jwt() ->> 'email')
  LIMIT 1;

  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.account_number IS DISTINCT FROM NEW.account_number) 
       OR (OLD.bank_bin IS DISTINCT FROM NEW.bank_bin) 
       OR (OLD.bank_name IS DISTINCT FROM NEW.bank_name)
       OR (OLD.account_holder IS DISTINCT FROM NEW.account_holder)
       OR (OLD.agency_name IS DISTINCT FROM NEW.agency_name)
       OR (OLD.agency_code IS DISTINCT FROM NEW.agency_code) THEN
      
      v_details := format(
        'Cập nhật tài khoản VietQR: Ngân hàng %s (BIN: %s), STK: %s -> %s, Chủ TK: %s, Đơn vị: %s (%s)',
        COALESCE(NEW.bank_name, NEW.bank_bin),
        NEW.bank_bin,
        COALESCE(OLD.account_number, '---'),
        NEW.account_number,
        NEW.account_holder,
        NEW.agency_name,
        NEW.agency_code
      );

      INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
      VALUES (v_user_id, v_user_name, 'Cập nhật VietQR', v_details, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_vietqr_settings ON public.settings;
CREATE TRIGGER trigger_audit_vietqr_settings
AFTER UPDATE ON public.settings
FOR EACH ROW
EXECUTE FUNCTION public.audit_vietqr_settings_change();

-- 5.3. Tự động ghi log khi thay đổi policies hoặc settings
CREATE OR REPLACE FUNCTION public.audit_configuration_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE 
  v_actor text := COALESCE(auth.uid()::text, 'system'); 
  v_id text;
BEGIN
  IF current_setting('app.is_batch_import', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_id := CASE WHEN TG_OP = 'DELETE' THEN COALESCE(to_jsonb(OLD)->>'id', 'unknown') ELSE COALESCE(to_jsonb(NEW)->>'id', 'unknown') END;
  
  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_actor, 
    COALESCE(public.get_my_role(), 'Hệ thống'),
    TG_TABLE_NAME || ' ' || TG_OP, 
    'Thao tác ' || TG_OP || ' trên ' || TG_TABLE_NAME || ' #' || v_id, 
    NOW()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_policies_change ON public.policies;
CREATE TRIGGER trigger_audit_policies_change 
AFTER INSERT OR UPDATE OR DELETE ON public.policies 
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

DROP TRIGGER IF EXISTS trigger_audit_settings_change ON public.settings;
CREATE TRIGGER trigger_audit_settings_change 
AFTER INSERT OR UPDATE OR DELETE ON public.settings 
FOR EACH ROW EXECUTE FUNCTION public.audit_configuration_change();

-- ======================================================================
-- THÔNG BÁO SUPABASE POSTGREST NẠP LẠI TOÀN BỘ SCHEMA MỚI
-- ======================================================================
NOTIFY pgrst, 'reload schema';
