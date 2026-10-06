-- ======================================================================
-- NỀN TẢNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ
-- MIGRATION 20261005000001: THIẾT LẬP SỔ CÁI TÀI CHÍNH (FINANCIAL LEDGER)
-- ======================================================================
-- Mục đích: Thiết lập bảng financial_ledger làm Single Source of Truth cho dòng tiền.
-- Nguyên tắc: 
--   1. Bất biến (Append-Only): Tuyệt đối không UPDATE/DELETE lịch sử tài chính.
--   2. Chuẩn 100% snake_case, liên kết chặt chẽ với records, customers và staff.
--   3. Đồng bộ tự động qua Database Trigger sau mỗi biến động tài chính.
--   4. RLS đa cấp, bảo mật theo vai trò và cô lập dữ liệu.
--   5. Tích hợp kiểm tra Khóa kỳ tài chính (Financial Period Lock).
-- ======================================================================

-- 1. TẠO KIỂU DỮ LIỆU ENUM CHO LOẠI BÚT TOÁN SỔ CÁI
-- ======================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ledger_transaction_type') THEN
        CREATE TYPE public.ledger_transaction_type AS ENUM (
            'THU_TIEN',      -- Thu tiền hồ sơ đóng mới / tái tục gia hạn (Ghi có dòng tiền)
            'HOAN_TIEN',     -- Thoái thu hoàn trả / Giảm trừ / Hủy biên lai (Ghi nợ dòng tiền)
            'DIEU_CHINH',    -- Bút toán điều chỉnh tăng/giảm số tiền kế toán
            'CHI_HOA_HONG'   -- Chi trả thù lao / hoa hồng đại lý thu
        );
    END IF;
END $$;

-- 2. TẠO BẢNG SỔ CÁI TÀI CHÍNH (FINANCIAL_LEDGER)
-- ======================================================================
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id BIGINT REFERENCES public.records(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    transaction_type public.ledger_transaction_type NOT NULL,
    debit_amount NUMERIC NOT NULL DEFAULT 0,
    credit_amount NUMERIC NOT NULL DEFAULT 0,
    balance NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'VND',
    reference_id TEXT,
    idempotency_key TEXT UNIQUE,
    posted_by TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ======================================================================
-- 3. TẠO INDEXES TỐI ƯU TRA CỨU B-TREE TRÊN FINANCIAL_LEDGER
-- ======================================================================
CREATE INDEX IF NOT EXISTS idx_financial_ledger_record_id ON public.financial_ledger (record_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_customer_id ON public.financial_ledger (customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_posted_at ON public.financial_ledger (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_posted_by ON public.financial_ledger (posted_by);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_transaction_type ON public.financial_ledger (transaction_type);
CREATE INDEX IF NOT EXISTS idx_financial_ledger_reference_id ON public.financial_ledger (reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_ledger_idempotency_key ON public.financial_ledger (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Composite index cho tra cứu lịch sử tài chính của khách hàng theo thời gian
CREATE INDEX IF NOT EXISTS idx_financial_ledger_customer_timeline 
ON public.financial_ledger (customer_id, posted_at DESC);

-- ======================================================================
-- 4. BẢO VỆ TÍNH BẤT BIẾN CỦA SỔ CÁI (IMMUTABILITY ENFORCEMENT)
-- ======================================================================

CREATE OR REPLACE FUNCTION public.enforce_financial_ledger_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RAISE EXCEPTION 'BẢO MẬT KẾ TOÁN: Bảng sổ cái tài chính (financial_ledger) là dữ liệu bất biến (Append-Only). Mọi hành vi UPDATE, DELETE hoặc TRUNCATE đều bị nghiêm cấm theo luật kế toán!'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_ledger_no_update_delete ON public.financial_ledger;
CREATE TRIGGER trg_financial_ledger_no_update_delete
    BEFORE UPDATE OR DELETE ON public.financial_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_financial_ledger_immutability();

DROP TRIGGER IF EXISTS trg_financial_ledger_no_truncate ON public.financial_ledger;
CREATE TRIGGER trg_financial_ledger_no_truncate
    BEFORE TRUNCATE ON public.financial_ledger
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.enforce_financial_ledger_immutability();

-- ======================================================================
-- 5. PHÂN QUYỀN VÀ BẢO MẬT ROW LEVEL SECURITY (RLS)
-- ======================================================================

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

-- 5.1. Quyền ĐỌC (SELECT):
-- Quản lý/Admin hoặc service_role xem được toàn bộ bút toán.
-- Nhân viên thông thường chỉ xem được bút toán do chính mình lập.
DROP POLICY IF EXISTS "financial_ledger_select_policy" ON public.financial_ledger;
CREATE POLICY "financial_ledger_select_policy"
ON public.financial_ledger
FOR SELECT
TO authenticated, service_role
USING (
    auth.role() = 'service_role'
    OR public.is_manager_or_admin()
    OR posted_by = public.current_staff_id()
    OR posted_by = auth.uid()::text
);

-- 5.2. Quyền GHI (INSERT):
-- Chỉ cho phép hệ thống (trigger/service_role), quản lý hoặc nhân viên hợp lệ tạo bút toán.
DROP POLICY IF EXISTS "financial_ledger_insert_policy" ON public.financial_ledger;
CREATE POLICY "financial_ledger_insert_policy"
ON public.financial_ledger
FOR INSERT
TO authenticated, service_role
WITH CHECK (
    auth.role() = 'service_role'
    OR public.is_active_staff()
    OR public.is_manager_or_admin()
);

-- (Không tạo policy FOR UPDATE hay FOR DELETE -> Không ai có quyền sửa hoặc xóa bút toán)

-- ======================================================================
-- 6. TÍCH HỢP KIỂM TRA KHÓA KỲ TÀI CHÍNH TRÊN SỔ CÁI
-- ======================================================================

CREATE OR REPLACE FUNCTION public.check_ledger_financial_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
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
        RETURN NEW;
    END IF;

    IF public.is_financial_period_locked(COALESCE(NEW.posted_at, NOW())) THEN
        RAISE EXCEPTION 'KỲ TÀI CHÍNH ĐÃ KHÓA: Không thể ghi thêm bút toán vào sổ cái trong kỳ tài chính đã chốt sổ (ngày ghi sổ %)! Vui lòng mở khóa kỳ tài chính trước khi thao tác.',
            to_char(COALESCE(NEW.posted_at, NOW()), 'DD/MM/YYYY')
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_ledger_financial_lock ON public.financial_ledger;
CREATE TRIGGER trg_check_ledger_financial_lock
    BEFORE INSERT ON public.financial_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.check_ledger_financial_lock();

-- ======================================================================
-- 7. DATABASE TRIGGER ĐỒNG BỘ: RECORDS -> FINANCIAL_LEDGER
-- ======================================================================

CREATE OR REPLACE FUNCTION public.sync_record_to_financial_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_id UUID;
    v_posted_by TEXT;
    v_posted_at TIMESTAMPTZ;
    v_current_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_credit NUMERIC := 0;
    v_debit NUMERIC := 0;
    v_trans_type public.ledger_transaction_type;
    v_ref_id TEXT;
    v_idempotency_key TEXT;
    v_notes TEXT;
    v_is_clawback BOOLEAN := false;
BEGIN
    -- Xác định mã cán bộ thực hiện
    v_posted_by := COALESCE(public.current_staff_id(), NEW.staff_id, 'system');
    v_posted_at := COALESCE(NEW.date, NOW());

    -- Tìm Customer ID chính xác nếu record chưa gắn sẵn
    v_customer_id := NEW.customer_id;
    IF v_customer_id IS NULL AND NEW.customer_key IS NOT NULL THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE customer_key = NEW.customer_key LIMIT 1;
    END IF;
    IF v_customer_id IS NULL AND NEW.cccd IS NOT NULL THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE cccd = NEW.cccd LIMIT 1;
    END IF;
    IF v_customer_id IS NULL AND NEW.bhxh IS NOT NULL THEN
        SELECT id INTO v_customer_id FROM public.customers WHERE bhxh = NEW.bhxh LIMIT 1;
    END IF;

    -- Kiểm tra xem record có phải là bút toán thoái thu / giảm trừ không
    v_is_clawback := (
        COALESCE(NEW.action_type, '') = 'Thoái thu' 
        OR NEW.is_adjustment = TRUE 
        OR NEW.refund_type IS NOT NULL 
        OR COALESCE(NEW.amount, 0) < 0
    );

    -- Lấy số dư lũy kế gần nhất trên sổ cái
    SELECT COALESCE(balance, 0) INTO v_current_balance
    FROM public.financial_ledger
    ORDER BY posted_at DESC, created_at DESC
    LIMIT 1;
    v_current_balance := COALESCE(v_current_balance, 0);

    -- ==================================================================
    -- TRƯỜNG HỢP 1: BÚT TOÁN THOÁI THU / HOÀN TIỀN (HOAN_TIEN)
    -- ==================================================================
    IF v_is_clawback AND NEW.payment_status = 'Đã thu tiền' THEN
        -- Chỉ ghi sổ khi INSERT mới hoặc khi chuyển sang hoàn tất thoái thu
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.payment_status != 'Đã thu tiền' OR OLD.action_type != 'Thoái thu')) THEN
            v_trans_type := 'HOAN_TIEN';
            v_debit := ABS(COALESCE(NEW.amount, 0));
            v_credit := 0;
            v_new_balance := v_current_balance - v_debit;
            v_ref_id := COALESCE(NEW.decision_number, 'CLAWBACK_' || NEW.id::text);
            v_idempotency_key := 'CLAWBACK_REC_' || NEW.id::text;
            v_notes := format('Thoái thu hoàn trả theo QĐ %s - Khách hàng: %s (Hồ sơ gốc #%s). Lý do: %s',
                COALESCE(NEW.decision_number, 'N/A'),
                COALESCE(NEW.name, 'N/A'),
                COALESCE(NEW.original_record_id, NEW.id),
                COALESCE(NEW.adjustment_reason, NEW.notes, 'Không có')
            );

            INSERT INTO public.financial_ledger (
                record_id, customer_id, transaction_type,
                debit_amount, credit_amount, balance,
                currency, reference_id, idempotency_key,
                posted_by, posted_at, notes
            ) VALUES (
                NEW.id, v_customer_id, v_trans_type,
                v_debit, v_credit, v_new_balance,
                'VND', v_ref_id, v_idempotency_key,
                v_posted_by, v_posted_at, v_notes
            )
            ON CONFLICT (idempotency_key) DO NOTHING;

            RETURN NEW;
        END IF;

    -- ==================================================================
    -- TRƯỜNG HỢP 2: THU TIỀN HỒ SƠ MỚI HOẶC GIA HẠN (THU_TIEN)
    -- ==================================================================
    ELSIF NEW.payment_status = 'Đã thu tiền' AND COALESCE(NEW.amount, 0) > 0 AND NOT v_is_clawback THEN
        -- Ghi sổ khi INSERT có trạng thái 'Đã thu tiền' hoặc UPDATE từ trạng thái khác sang 'Đã thu tiền'
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.payment_status != 'Đã thu tiền') THEN
            v_trans_type := 'THU_TIEN';
            v_credit := COALESCE(NEW.amount, 0);
            v_debit := 0;
            v_new_balance := v_current_balance + v_credit;
            v_ref_id := COALESCE(NEW.submission_batch, 'REC_' || NEW.id::text);
            v_idempotency_key := 'PAYMENT_REC_' || NEW.id::text;
            v_notes := format('Thu tiền đóng %s (%s) - Khách hàng: %s (Mã hồ sơ: #%s, Kỳ: %s - %s)',
                NEW.type,
                COALESCE(NEW.action_type, 'Đóng tiền'),
                COALESCE(NEW.name, 'N/A'),
                NEW.id,
                COALESCE(NEW.from_month, 'N/A'),
                COALESCE(NEW.to_month, 'N/A')
            );

            INSERT INTO public.financial_ledger (
                record_id, customer_id, transaction_type,
                debit_amount, credit_amount, balance,
                currency, reference_id, idempotency_key,
                posted_by, posted_at, notes
            ) VALUES (
                NEW.id, v_customer_id, v_trans_type,
                v_debit, v_credit, v_new_balance,
                'VND', v_ref_id, v_idempotency_key,
                v_posted_by, v_posted_at, v_notes
            )
            ON CONFLICT (idempotency_key) DO NOTHING;

            RETURN NEW;
        END IF;

    -- ==================================================================
    -- TRƯỜNG HỢP 3: HỦY HỒ SƠ ĐÃ THU TIỀN TRƯỚC ĐÓ (HOAN_TIEN)
    -- ==================================================================
    ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'Đã thu tiền' AND NEW.payment_status = 'Đã hủy' AND COALESCE(OLD.amount, 0) > 0 THEN
        v_trans_type := 'HOAN_TIEN';
        v_debit := ABS(COALESCE(OLD.amount, 0));
        v_credit := 0;
        v_new_balance := v_current_balance - v_debit;
        v_ref_id := 'CANCEL_REC_' || NEW.id::text;
        v_idempotency_key := 'CANCEL_REC_' || NEW.id::text;
        v_notes := format('Hủy hồ sơ đã thu tiền #%s - Khách hàng: %s. Số tiền hoàn giảm: %s VNĐ',
            NEW.id,
            COALESCE(NEW.name, 'N/A'),
            to_char(v_debit, 'FM999,999,999,999')
        );

        INSERT INTO public.financial_ledger (
            record_id, customer_id, transaction_type,
            debit_amount, credit_amount, balance,
            currency, reference_id, idempotency_key,
            posted_by, posted_at, notes
        ) VALUES (
            NEW.id, v_customer_id, v_trans_type,
            v_debit, v_credit, v_new_balance,
            'VND', v_ref_id, v_idempotency_key,
            v_posted_by, NOW(), v_notes
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        RETURN NEW;

    -- ==================================================================
    -- TRƯỜNG HỢP 4: ĐIỀU CHỈNH SỐ TIỀN CỦA HỒ SƠ ĐÃ THU (DIEU_CHINH)
    -- ==================================================================
    ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'Đã thu tiền' AND NEW.payment_status = 'Đã thu tiền' 
          AND COALESCE(NEW.amount, 0) != COALESCE(OLD.amount, 0) AND NOT v_is_clawback THEN
        v_trans_type := 'DIEU_CHINH';
        
        IF COALESCE(NEW.amount, 0) > COALESCE(OLD.amount, 0) THEN
            -- Tăng thu
            v_credit := COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0);
            v_debit := 0;
            v_new_balance := v_current_balance + v_credit;
            v_notes := format('Điều chỉnh tăng số tiền hồ sơ #%s (%s -> %s VNĐ)', NEW.id, OLD.amount, NEW.amount);
        ELSE
            -- Giảm thu
            v_debit := COALESCE(OLD.amount, 0) - COALESCE(NEW.amount, 0);
            v_credit := 0;
            v_new_balance := v_current_balance - v_debit;
            v_notes := format('Điều chỉnh giảm số tiền hồ sơ #%s (%s -> %s VNĐ)', NEW.id, OLD.amount, NEW.amount);
        END IF;

        v_ref_id := 'ADJUST_REC_' || NEW.id::text;
        v_idempotency_key := format('ADJUST_REC_%s_%s', NEW.id, to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'));

        INSERT INTO public.financial_ledger (
            record_id, customer_id, transaction_type,
            debit_amount, credit_amount, balance,
            currency, reference_id, idempotency_key,
            posted_by, posted_at, notes
        ) VALUES (
            NEW.id, v_customer_id, v_trans_type,
            v_debit, v_credit, v_new_balance,
            'VND', v_ref_id, v_idempotency_key,
            v_posted_by, NOW(), v_notes
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_record_payment_update_ledger ON public.records;
CREATE TRIGGER after_record_payment_update_ledger
    AFTER INSERT OR UPDATE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_record_to_financial_ledger();

-- ======================================================================
-- 8. CẬP NHẬT VÀ BỔ SUNG STORED PROCEDURES (RPCs)
-- ======================================================================

-- 8.1. Cập nhật create_refund_clawback_entry để tăng cường bảo vệ khóa kỳ
DROP FUNCTION IF EXISTS public.create_refund_clawback_entry(BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.create_refund_clawback_entry(
  p_original_record_id BIGINT,
  p_refund_amount NUMERIC,
  p_refund_type TEXT,
  p_decision_number TEXT,
  p_decision_date DATE,
  p_refund_method TEXT,
  p_beneficiary_name TEXT,
  p_beneficiary_account TEXT,
  p_beneficiary_bank TEXT,
  p_reason TEXT,
  p_staff_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig RECORD;
  v_negative_amount NUMERIC;
  v_negative_comm NUMERIC;
  v_comm_rate NUMERIC;
  v_new_record_id BIGINT;
  v_user_id TEXT;
  v_user_name TEXT;
  v_effective_staff_id TEXT;
  v_effective_date DATE;
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản lý hoặc Quản trị viên mới có quyền lập bút toán thoái thu hoàn tiền.'
      USING ERRCODE = '42501';
  END IF;

  v_effective_date := COALESCE(p_decision_date, CURRENT_DATE);

  -- KIỂM TRA KHÓA KỲ TÀI CHÍNH THEO NGÀY QUYẾT ĐỊNH THOÁI THU
  IF public.is_financial_period_locked(v_effective_date::timestamptz) THEN
    RAISE EXCEPTION 'KỲ TÀI CHÍNH ĐÃ KHÓA: Kỳ tài chính ứng với ngày quyết định thoái thu (%) đã bị khóa sổ. Vui lòng mở khóa kỳ tài chính trước khi lập bút toán.',
      to_char(v_effective_date, 'DD/MM/YYYY')
      USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_orig
  FROM public.records
  WHERE id = p_original_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ gốc có ID %', p_original_record_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_orig.payment_status != 'Đã thu tiền' THEN
    RAISE EXCEPTION 'Hồ sơ gốc chưa thu tiền hoặc đã bị hủy, không thể lập bút toán thoái thu.'
      USING ERRCODE = '23514';
  END IF;

  IF p_refund_amount <= 0 THEN
    RAISE EXCEPTION 'Số tiền thoái thu phải lớn hơn 0'
      USING ERRCODE = '23514';
  END IF;

  IF p_refund_amount > v_orig.amount THEN
    RAISE EXCEPTION 'Số tiền thoái thu (% VNĐ) không được vượt quá số tiền của hồ sơ gốc (% VNĐ)', p_refund_amount, v_orig.amount
      USING ERRCODE = '23514';
  END IF;

  v_negative_amount := -1 * ABS(p_refund_amount);

  IF COALESCE(v_orig.amount, 0) > 0 AND COALESCE(v_orig.commission, 0) > 0 THEN
    v_comm_rate := v_orig.commission / v_orig.amount;
    v_negative_comm := -1 * ROUND(ABS(p_refund_amount) * v_comm_rate);
  ELSE
    v_negative_comm := 0;
  END IF;

  v_user_id := COALESCE(auth.uid()::text, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE id = v_user_id OR email = (auth.jwt() ->> 'email') LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  v_effective_staff_id := COALESCE(p_staff_id, v_orig.staff_id, v_user_id);

  -- Thao tác INSERT này sẽ tự động kích hoạt trigger sau:
  -- 1. sync_records_to_customers (cập nhật Master Data)
  -- 2. after_record_payment_update_ledger (ghi bút toán HOAN_TIEN vào financial_ledger)
  INSERT INTO public.records (
    name, cccd, phone, address, bhxh, old_bhxh, dob, gender, nation, email,
    type, sub_type, action_type, status, payment_status, date,
    effective_date, target_date, next_payment, from_month, to_month,
    wage, income, months, method, base_premium, support_pct,
    nn_support_pct, nn_support_amount, dp_support_pct, dp_support_amount,
    amount, discount_amount, penalty_amount, commission, support, notes,
    staff_id, household_id, members, recv_name, recv_phone, recv_address,
    is_submitted_bhxh, submission_batch, submitted_date, refund_type,
    decision_number, decision_date, refund_method, refund_beneficiary_name,
    refund_beneficiary_account, refund_beneficiary_bank, is_adjustment,
    original_record_id, adjustment_reason, customer_key, customer_id
  ) VALUES (
    v_orig.name,
    v_orig.cccd,
    v_orig.phone,
    v_orig.address,
    v_orig.bhxh,
    v_orig.old_bhxh,
    v_orig.dob,
    v_orig.gender,
    v_orig.nation,
    v_orig.email,
    v_orig.type,
    v_orig.sub_type,
    'Thoái thu',
    'Hoàn tất thoái thu',
    'Đã thu tiền',
    NOW(),
    v_effective_date,
    v_orig.target_date,
    v_orig.next_payment,
    v_orig.from_month,
    v_orig.to_month,
    v_orig.wage,
    v_orig.income,
    0,
    v_orig.method,
    -1 * ABS(COALESCE(v_orig.base_premium, 0)),
    v_orig.support_pct,
    v_orig.nn_support_pct,
    -1 * ABS(COALESCE(v_orig.nn_support_amount, 0)),
    v_orig.dp_support_pct,
    -1 * ABS(COALESCE(v_orig.dp_support_amount, 0)),
    v_negative_amount,
    0,
    0,
    v_negative_comm,
    0,
    format('Bút toán thoái thu theo QĐ %s ngày %s. Lý do: %s (Hồ sơ gốc ID: #%s)', 
      COALESCE(p_decision_number, 'N/A'), 
      COALESCE(to_char(v_effective_date, 'DD/MM/YYYY'), 'N/A'), 
      COALESCE(p_reason, 'Không có'), 
      p_original_record_id
    ),
    v_effective_staff_id,
    v_orig.household_id,
    v_orig.members,
    v_orig.recv_name,
    v_orig.recv_phone,
    v_orig.recv_address,
    FALSE,
    NULL,
    NULL,
    p_refund_type,
    p_decision_number,
    p_decision_date,
    p_refund_method,
    p_beneficiary_name,
    p_beneficiary_account,
    p_beneficiary_bank,
    TRUE,
    p_original_record_id,
    p_reason,
    v_orig.customer_key,
    v_orig.customer_id
  ) RETURNING id INTO v_new_record_id;

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_user_id,
    v_user_name,
    'Lập bút toán thoái thu',
    format('Lập bút toán thoái thu #%s giảm trừ %s VNĐ (hoa hồng giảm %s VNĐ) cho hồ sơ gốc #%s của khách hàng %s. QĐ: %s',
      v_new_record_id, ABS(v_negative_amount), ABS(v_negative_comm), p_original_record_id, v_orig.name, COALESCE(p_decision_number, 'N/A')),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_record_id', v_new_record_id,
    'negative_amount', v_negative_amount,
    'negative_commission', v_negative_comm,
    'original_record_id', p_original_record_id
  );
END;
$$;

-- 8.2. RPC Tra cứu lịch sử sổ cái tài chính của Khách hàng (Single Source of Truth)
DROP FUNCTION IF EXISTS public.get_customer_financial_ledger(UUID, INT, INT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_customer_financial_ledger(
    p_customer_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    record_id BIGINT,
    transaction_type public.ledger_transaction_type,
    debit_amount NUMERIC,
    credit_amount NUMERIC,
    balance NUMERIC,
    currency TEXT,
    reference_id TEXT,
    posted_by TEXT,
    posted_at TIMESTAMPTZ,
    notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
    IF NOT (public.is_manager_or_admin() OR public.is_active_staff()) THEN
        RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ cán bộ nhân viên mới có quyền tra cứu sổ cái tài chính.'
            USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        l.id,
        l.record_id,
        l.transaction_type,
        l.debit_amount,
        l.credit_amount,
        l.balance,
        l.currency,
        l.reference_id,
        l.posted_by,
        l.posted_at,
        l.notes
    FROM public.financial_ledger l
    WHERE l.customer_id = p_customer_id
    ORDER BY l.posted_at DESC, l.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- 8.3. Thủ tục Khởi tạo Số dư Ban đầu (Backfill) từ các hồ sơ 'Đã thu tiền' hiện có
DROP FUNCTION IF EXISTS public.backfill_financial_ledger_from_existing_records() CASCADE;
CREATE OR REPLACE FUNCTION public.backfill_financial_ledger_from_existing_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_inserted_count INT := 0;
    v_skipped_count INT := 0;
    v_current_balance NUMERIC := 0;
    v_new_balance NUMERIC := 0;
    v_credit NUMERIC := 0;
    v_debit NUMERIC := 0;
    v_trans_type public.ledger_transaction_type;
    v_idempotency_key TEXT;
    v_notes TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chỉ Quản trị viên cấp cao mới có quyền thực hiện backfill sổ cái tài chính!'
            USING ERRCODE = '42501';
    END IF;

    -- Lấy số dư hiện có nếu đã có
    SELECT COALESCE(balance, 0) INTO v_current_balance
    FROM public.financial_ledger
    ORDER BY posted_at DESC, created_at DESC
    LIMIT 1;

    FOR v_rec IN (
        SELECT *
        FROM public.records
        WHERE payment_status = 'Đã thu tiền'
        ORDER BY date ASC, id ASC
    ) LOOP
        IF COALESCE(v_rec.action_type, '') = 'Thoái thu' OR v_rec.amount < 0 THEN
            v_trans_type := 'HOAN_TIEN';
            v_debit := ABS(COALESCE(v_rec.amount, 0));
            v_credit := 0;
            v_new_balance := v_current_balance - v_debit;
            v_idempotency_key := 'CLAWBACK_REC_' || v_rec.id::text;
            v_notes := format('Khởi tạo số dư: Thoái thu hoàn trả hồ sơ #%s (%s)', v_rec.id, COALESCE(v_rec.name, 'N/A'));
        ELSE
            v_trans_type := 'THU_TIEN';
            v_credit := COALESCE(v_rec.amount, 0);
            v_debit := 0;
            v_new_balance := v_current_balance + v_credit;
            v_idempotency_key := 'PAYMENT_REC_' || v_rec.id::text;
            v_notes := format('Khởi tạo số dư: Thu tiền hồ sơ #%s (%s)', v_rec.id, COALESCE(v_rec.name, 'N/A'));
        END IF;

        BEGIN
            INSERT INTO public.financial_ledger (
                record_id, customer_id, transaction_type,
                debit_amount, credit_amount, balance,
                currency, reference_id, idempotency_key,
                posted_by, posted_at, notes
            ) VALUES (
                v_rec.id, v_rec.customer_id, v_trans_type,
                v_debit, v_credit, v_new_balance,
                'VND', COALESCE(v_rec.submission_batch, 'REC_' || v_rec.id::text), v_idempotency_key,
                COALESCE(v_rec.staff_id, 'system'), COALESCE(v_rec.date, NOW()), v_notes
            );
            v_current_balance := v_new_balance;
            v_inserted_count := v_inserted_count + 1;
        EXCEPTION WHEN unique_violation THEN
            v_skipped_count := v_skipped_count + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'inserted_entries', v_inserted_count,
        'skipped_entries', v_skipped_count,
        'final_balance', v_current_balance
    );
END;
$$;

-- Phân quyền thực thi các hàm mới
GRANT EXECUTE ON FUNCTION public.get_customer_financial_ledger(UUID, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_financial_ledger_from_existing_records() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_refund_clawback_entry(BIGINT, NUMERIC, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
