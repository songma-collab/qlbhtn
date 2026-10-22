-- ======================================================================
-- BẢN VÁ TOÀN VẸN CSDL P1: SỔ CÁI TÀI CHÍNH, CHỐNG RACE CONDITION & ĐỒNG BỘ MASTER DATA
-- File: supabase/migrations/20261022000002_fix_ledger_and_master_data.sql
-- Áp dụng cho: qlkh-bhxh-bhyt
-- Mục đích:
--   1. Thêm pg_advisory_xact_lock chống Race Condition khi tính số dư sổ cái (DB-01).
--   2. Bổ sung xử lý AFTER DELETE ON records để sinh bút toán HOAN_TIEN bảo vệ toàn vẹn sổ cái.
--   3. Xây dựng hàm chuẩn hóa sync_customer_master_data_for_key:
--      - Ghi nhận chính xác khách hàng tham gia cả 2 loại hình (type = 'CẢ HAI', has_bhxh, has_bhyt).
--      - Quản lý độc lập hạn đóng tiếp theo: next_payment_bhxh, next_payment_bhyt.
--      - Chống thoái thu / điều chỉnh đè số âm lên latest_amount và chu kỳ đóng (DB-02).
--   4. Cập nhật import_records_batch để tự động đồng bộ Master Data sau khi import Excel (DB-03).
--   5. Tự động chữa lành (Auto-heal) toàn bộ dữ liệu danh bạ khách hàng hiện hữu.
-- ======================================================================

-- ----------------------------------------------------------------------
-- PHẦN 1: NÂNG CẤP ĐỒNG BỘ SỔ CÁI TÀI CHÍNH (CHỐNG RACE CONDITION & XỬ LÝ DELETE)
-- ----------------------------------------------------------------------

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
    -- 1. Khóa phân tán cấp transaction (Advisory Lock) để tuần tự hóa việc tính số dư sổ cái, loại bỏ triệt để Race Condition
    PERFORM pg_advisory_xact_lock(hashtext('financial_ledger_lock'));

    -- 2. Lấy số dư lũy kế gần nhất trên sổ cái (đảm bảo tính tuần tự theo thời gian vật lý)
    SELECT COALESCE(balance, 0) INTO v_current_balance
    FROM public.financial_ledger
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
    v_current_balance := COALESCE(v_current_balance, 0);

    -- ==================================================================
    -- TRƯỜNG HỢP A: XÓA HỒ SƠ (DELETE)
    -- ==================================================================
    IF TG_OP = 'DELETE' THEN
        -- Chỉ xử lý nếu bản ghi bị xóa là bản ghi đã thu tiền
        IF OLD.payment_status = 'Đã thu tiền' AND COALESCE(OLD.amount, 0) != 0 THEN
            v_posted_by := COALESCE(public.current_staff_id(), OLD.staff_id, 'system');
            
            -- Tìm customer_id
            v_customer_id := OLD.customer_id;
            IF v_customer_id IS NULL AND OLD.customer_key IS NOT NULL THEN
                SELECT id INTO v_customer_id FROM public.customers WHERE customer_key = OLD.customer_key LIMIT 1;
            END IF;
            IF v_customer_id IS NULL AND OLD.cccd IS NOT NULL THEN
                SELECT id INTO v_customer_id FROM public.customers WHERE cccd = OLD.cccd LIMIT 1;
            END IF;
            IF v_customer_id IS NULL AND OLD.bhxh IS NOT NULL THEN
                SELECT id INTO v_customer_id FROM public.customers WHERE bhxh = OLD.bhxh LIMIT 1;
            END IF;

            v_is_clawback := (
                COALESCE(OLD.action_type, '') = 'Thoái thu' 
                OR OLD.is_adjustment = TRUE 
                OR OLD.refund_type IS NOT NULL 
                OR COALESCE(OLD.amount, 0) < 0
            );

            IF v_is_clawback THEN
                -- Xóa bản ghi thoái thu (đã xuất tiền hoàn trước đó) -> Cần hoàn bù dòng tiền (Ghi có)
                v_trans_type := 'DIEU_CHINH';
                v_credit := ABS(COALESCE(OLD.amount, 0));
                v_debit := 0;
                v_new_balance := v_current_balance + v_credit;
                v_ref_id := 'DEL_CLAWBACK_' || OLD.id::text;
                v_idempotency_key := format('DEL_CLAWBACK_%s_%s', OLD.id, to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'));
                v_notes := format('Đảo ngược thoái thu do xóa hồ sơ thoái thu #%s của khách hàng %s. Số tiền điều chỉnh: +%s VNĐ',
                    OLD.id, COALESCE(OLD.name, 'N/A'), to_char(v_credit, 'FM999,999,999,999')
                );
            ELSE
                -- Xóa bản ghi thu tiền (> 0) -> Hoàn tiền / Giảm trừ số dư dòng tiền (Ghi nợ)
                v_trans_type := 'HOAN_TIEN';
                v_debit := ABS(COALESCE(OLD.amount, 0));
                v_credit := 0;
                v_new_balance := v_current_balance - v_debit;
                v_ref_id := 'DEL_REC_' || OLD.id::text;
                v_idempotency_key := format('DEL_REC_%s_%s', OLD.id, to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS'));
                v_notes := format('Hoàn tiền do xóa hồ sơ đã thu tiền #%s của khách hàng %s. Số tiền giảm trừ: -%s VNĐ',
                    OLD.id, COALESCE(OLD.name, 'N/A'), to_char(v_debit, 'FM999,999,999,999')
                );
            END IF;

            INSERT INTO public.financial_ledger (
                record_id, customer_id, transaction_type,
                debit_amount, credit_amount, balance,
                currency, reference_id, idempotency_key,
                posted_by, posted_at, notes
            ) VALUES (
                NULL, -- record_id để NULL vì bản ghi trong records đã bị xóa
                v_customer_id, v_trans_type,
                v_debit, v_credit, v_new_balance,
                'VND', v_ref_id, v_idempotency_key,
                v_posted_by, NOW(), v_notes
            )
            ON CONFLICT (idempotency_key) DO NOTHING;
        END IF;

        RETURN OLD;
    END IF;

    -- ==================================================================
    -- TRƯỜNG HỢP B: INSERT HOẶC UPDATE
    -- ==================================================================
    v_posted_by := COALESCE(public.current_staff_id(), NEW.staff_id, 'system');
    v_posted_at := COALESCE(NEW.date, NOW());

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

    v_is_clawback := (
        COALESCE(NEW.action_type, '') = 'Thoái thu' 
        OR NEW.is_adjustment = TRUE 
        OR NEW.refund_type IS NOT NULL 
        OR COALESCE(NEW.amount, 0) < 0
    );

    -- 1. BÚT TOÁN THOÁI THU / HOÀN TIỀN (HOAN_TIEN)
    IF v_is_clawback AND NEW.payment_status = 'Đã thu tiền' THEN
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

    -- 2. THU TIỀN HỒ SƠ MỚI HOẶC GIA HẠN (THU_TIEN)
    ELSIF NEW.payment_status = 'Đã thu tiền' AND COALESCE(NEW.amount, 0) > 0 AND NOT v_is_clawback THEN
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

    -- 3. HỦY HỒ SƠ ĐÃ THU TIỀN TRƯỚC ĐÓ (HOAN_TIEN)
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

    -- 4. ĐIỀU CHỈNH SỐ TIỀN CỦA HỒ SƠ ĐÃ THU (DIEU_CHINH)
    ELSIF TG_OP = 'UPDATE' AND OLD.payment_status = 'Đã thu tiền' AND NEW.payment_status = 'Đã thu tiền' 
          AND COALESCE(NEW.amount, 0) != COALESCE(OLD.amount, 0) AND NOT v_is_clawback THEN
        v_trans_type := 'DIEU_CHINH';
        
        IF COALESCE(NEW.amount, 0) > COALESCE(OLD.amount, 0) THEN
            v_credit := COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0);
            v_debit := 0;
            v_new_balance := v_current_balance + v_credit;
            v_notes := format('Điều chỉnh tăng số tiền hồ sơ #%s (%s -> %s VNĐ)', NEW.id, OLD.amount, NEW.amount);
        ELSE
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

-- Gắn trigger xử lý cả INSERT, UPDATE lẫn DELETE trên records
DROP TRIGGER IF EXISTS after_record_payment_update_ledger ON public.records;
CREATE TRIGGER after_record_payment_update_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_record_to_financial_ledger();


-- ----------------------------------------------------------------------
-- PHẦN 2: CHUẨN HÓA ĐỒNG BỘ MASTER DATA KHÁCH HÀNG (CUSTOMERS) (DB-02)
-- ----------------------------------------------------------------------

-- Hàm cốt lõi: Tính toán lại toàn diện thông tin một khách hàng dựa trên lịch sử records
CREATE OR REPLACE FUNCTION public.sync_customer_master_data_for_key(p_customer_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_key TEXT;
    v_latest_valid RECORD;
    v_latest_any RECORD;
    v_has_bhxh BOOLEAN := false;
    v_has_bhyt BOOLEAN := false;
    v_type TEXT;
    v_total_paid NUMERIC := 0;
    v_total_contrib INT := 0;
    v_next_bhxh DATE;
    v_next_bhyt DATE;
    v_next_payment DATE;
    v_effective_date DATE;
    v_status TEXT;
    v_payment_status TEXT;
    v_latest_amount NUMERIC := 0;
    v_latest_date DATE;
    v_from_month TEXT;
    v_to_month TEXT;
    v_latest_record_id BIGINT;
    v_cccd TEXT;
    v_bhxh TEXT;
    v_staff_id TEXT;
    v_name TEXT;
    v_phone TEXT;
    v_address TEXT;
    v_dob DATE;
    v_gender TEXT;
    v_nation TEXT;
    v_email TEXT;
    v_household_id TEXT;
    v_members JSONB;
    v_recv_name TEXT;
    v_recv_phone TEXT;
    v_recv_address TEXT;
    v_notes TEXT;
BEGIN
    v_clean_key := TRIM(COALESCE(p_customer_key, ''));
    IF v_clean_key = '' THEN
        RETURN;
    END IF;

    -- 1. Tìm bản ghi hợp đồng hợp lệ mới nhất (loại bỏ bút toán thoái thu, điều chỉnh hoặc đã hủy)
    SELECT * INTO v_latest_valid
    FROM public.records
    WHERE (
        customer_key = v_clean_key
        OR (cccd IS NOT NULL AND TRIM(cccd) != '' AND (cccd = v_clean_key OR 'CUST_CCCD_' || REGEXP_REPLACE(cccd, '\D', '', 'g') = v_clean_key))
        OR (bhxh IS NOT NULL AND TRIM(bhxh) != '' AND (bhxh = v_clean_key OR 'CUST_BHXH_' || REGEXP_REPLACE(bhxh, '\D', '', 'g') = v_clean_key))
    )
    AND COALESCE(payment_status, '') != 'Đã hủy'
    AND (is_adjustment IS NOT TRUE)
    AND COALESCE(action_type, '') != 'Thoái thu'
    AND COALESCE(amount, 0) > 0
    ORDER BY COALESCE(next_payment, to_month_date, date::date) DESC, id DESC
    LIMIT 1;

    -- 2. Tìm bản ghi gần nhất bất kỳ (nếu không có bản ghi hợp lệ dương tiền nào)
    IF v_latest_valid.id IS NULL THEN
        SELECT * INTO v_latest_any
        FROM public.records
        WHERE (
            customer_key = v_clean_key
            OR (cccd IS NOT NULL AND TRIM(cccd) != '' AND (cccd = v_clean_key OR 'CUST_CCCD_' || REGEXP_REPLACE(cccd, '\D', '', 'g') = v_clean_key))
            OR (bhxh IS NOT NULL AND TRIM(bhxh) != '' AND (bhxh = v_clean_key OR 'CUST_BHXH_' || REGEXP_REPLACE(bhxh, '\D', '', 'g') = v_clean_key))
        )
        AND COALESCE(payment_status, '') != 'Đã hủy'
        ORDER BY COALESCE(date::date, created_at::date) DESC, id DESC
        LIMIT 1;
    ELSE
        v_latest_any := v_latest_valid;
    END IF;

    -- Nếu không còn bất kỳ bản ghi nào còn lại trong records (ví dụ sau khi xóa toàn bộ)
    IF v_latest_any.id IS NULL THEN
        DELETE FROM public.customers 
        WHERE customer_key = v_clean_key
           OR cccd = v_clean_key
           OR bhxh = v_clean_key;
        RETURN;
    END IF;

    -- 3. Trích xuất thông tin nhân thân từ bản ghi gần nhất
    v_cccd := v_latest_any.cccd;
    v_bhxh := v_latest_any.bhxh;
    v_name := v_latest_any.name;
    v_phone := v_latest_any.phone;
    v_address := v_latest_any.address;
    v_dob := v_latest_any.dob;
    v_gender := COALESCE(v_latest_any.gender, 'Nam');
    v_nation := COALESCE(v_latest_any.nation, 'Kinh');
    v_email := v_latest_any.email;
    v_household_id := v_latest_any.household_id;
    v_members := CASE WHEN v_latest_any.members IS NOT NULL THEN to_jsonb(v_latest_any.members) ELSE NULL END;
    v_recv_name := v_latest_any.recv_name;
    v_recv_phone := v_latest_any.recv_phone;
    v_recv_address := v_latest_any.recv_address;
    v_notes := v_latest_any.notes;
    v_staff_id := v_latest_any.staff_id;

    -- 4. Xác định sự tham gia từng loại hình BHXH và BHYT
    v_has_bhxh := EXISTS (
        SELECT 1 FROM public.records
        WHERE (
            customer_key = v_clean_key
            OR (v_cccd IS NOT NULL AND TRIM(v_cccd) != '' AND cccd = v_cccd)
            OR (v_bhxh IS NOT NULL AND TRIM(v_bhxh) != '' AND bhxh = v_bhxh)
        )
        AND type = 'BHXH'
        AND COALESCE(payment_status, '') != 'Đã hủy'
    );

    v_has_bhyt := EXISTS (
        SELECT 1 FROM public.records
        WHERE (
            customer_key = v_clean_key
            OR (v_cccd IS NOT NULL AND TRIM(v_cccd) != '' AND cccd = v_cccd)
            OR (v_bhxh IS NOT NULL AND TRIM(v_bhxh) != '' AND bhxh = v_bhxh)
        )
        AND type = 'BHYT'
        AND COALESCE(payment_status, '') != 'Đã hủy'
    );

    IF v_has_bhxh AND v_has_bhyt THEN
        v_type := 'CẢ HAI';
    ELSIF v_has_bhxh THEN
        v_type := 'BHXH';
    ELSIF v_has_bhyt THEN
        v_type := 'BHYT';
    ELSE
        v_type := COALESCE(v_latest_any.type, 'BHXH');
    END IF;

    -- 5. Lấy hạn đóng tiếp theo cho từng loại hình
    SELECT next_payment INTO v_next_bhxh
    FROM public.records
    WHERE (
        customer_key = v_clean_key
        OR (v_cccd IS NOT NULL AND TRIM(v_cccd) != '' AND cccd = v_cccd)
        OR (v_bhxh IS NOT NULL AND TRIM(v_bhxh) != '' AND bhxh = v_bhxh)
    )
    AND type = 'BHXH'
    AND COALESCE(payment_status, '') != 'Đã hủy'
    ORDER BY COALESCE(next_payment, to_month_date, date::date) DESC, id DESC
    LIMIT 1;

    SELECT next_payment INTO v_next_bhyt
    FROM public.records
    WHERE (
        customer_key = v_clean_key
        OR (v_cccd IS NOT NULL AND TRIM(v_cccd) != '' AND cccd = v_cccd)
        OR (v_bhxh IS NOT NULL AND TRIM(v_bhxh) != '' AND bhxh = v_bhxh)
    )
    AND type = 'BHYT'
    AND COALESCE(payment_status, '') != 'Đã hủy'
    ORDER BY COALESCE(next_payment, to_month_date, date::date) DESC, id DESC
    LIMIT 1;

    -- Hạn đóng chung là hạn sớm nhất cần phải thu tiếp
    IF v_next_bhxh IS NOT NULL AND v_next_bhyt IS NOT NULL THEN
        v_next_payment := LEAST(v_next_bhxh, v_next_bhyt);
    ELSE
        v_next_payment := COALESCE(v_next_bhxh, v_next_bhyt, v_latest_valid.next_payment, v_latest_any.next_payment);
    END IF;

    -- 6. Tính tổng tích lũy tiền và số lần đóng (đại số: trừ tiền thoái thu)
    SELECT 
        GREATEST(0, COALESCE(SUM(amount), 0)),
        GREATEST(0, COALESCE(SUM(CASE WHEN is_adjustment IS TRUE OR COALESCE(action_type, '') = 'Thoái thu' THEN -1 ELSE 1 END), 0))
    INTO v_total_paid, v_total_contrib
    FROM public.records
    WHERE (
        customer_key = v_clean_key
        OR (v_cccd IS NOT NULL AND TRIM(v_cccd) != '' AND cccd = v_cccd)
        OR (v_bhxh IS NOT NULL AND TRIM(v_bhxh) != '' AND bhxh = v_bhxh)
    )
    AND payment_status = 'Đã thu tiền';

    -- 7. Gán thông tin hợp đồng kỳ gần nhất (tuyệt đối không lấy số âm của thoái thu)
    IF v_latest_valid.id IS NOT NULL THEN
        v_latest_record_id := v_latest_valid.id;
        v_latest_amount := v_latest_valid.amount;
        v_latest_date := v_latest_valid.date::date;
        v_effective_date := v_latest_valid.effective_date;
        v_from_month := v_latest_valid.from_month;
        v_to_month := v_latest_valid.to_month;
        v_status := COALESCE(v_latest_valid.status, 'Đang tham gia');
        v_payment_status := v_latest_valid.payment_status;
    ELSE
        v_latest_record_id := v_latest_any.id;
        v_latest_amount := GREATEST(0, COALESCE(v_latest_any.amount, 0));
        v_latest_date := v_latest_any.date::date;
        v_effective_date := v_latest_any.effective_date;
        v_from_month := v_latest_any.from_month;
        v_to_month := v_latest_any.to_month;
        v_status := COALESCE(v_latest_any.status, 'Đang tham gia');
        v_payment_status := v_latest_any.payment_status;
    END IF;

    -- 8. UPSERT vào bảng customers với đầy đủ thông tin chuẩn hóa
    INSERT INTO public.customers (
        customer_key, type, name, cccd, bhxh, old_bhxh, phone, address, dob, gender, nation, email,
        has_bhxh, has_bhyt, latest_record_id, latest_date, effective_date, next_payment,
        next_payment_bhxh, next_payment_bhyt, latest_amount, status, payment_status, notes,
        staff_id, total_contributions, total_amount_paid, household_id, members, recv_name,
        recv_phone, recv_address, from_month, to_month, created_at, updated_at
    ) VALUES (
        v_clean_key, v_type, v_name, v_cccd, v_bhxh, v_latest_any.old_bhxh, v_phone, v_address, v_dob, v_gender, v_nation, v_email,
        v_has_bhxh, v_has_bhyt, v_latest_record_id, v_latest_date, v_effective_date, v_next_payment,
        v_next_bhxh, v_next_bhyt, v_latest_amount, v_status, v_payment_status, v_notes,
        v_staff_id, v_total_contrib, v_total_paid, v_household_id, v_members, v_recv_name,
        v_recv_phone, v_recv_address, v_from_month, v_to_month, NOW(), NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        cccd = COALESCE(EXCLUDED.cccd, public.customers.cccd),
        bhxh = COALESCE(EXCLUDED.bhxh, public.customers.bhxh),
        old_bhxh = COALESCE(EXCLUDED.old_bhxh, public.customers.old_bhxh),
        phone = COALESCE(EXCLUDED.phone, public.customers.phone),
        address = COALESCE(EXCLUDED.address, public.customers.address),
        dob = COALESCE(EXCLUDED.dob, public.customers.dob),
        gender = COALESCE(EXCLUDED.gender, public.customers.gender),
        nation = COALESCE(EXCLUDED.nation, public.customers.nation),
        email = COALESCE(EXCLUDED.email, public.customers.email),
        has_bhxh = EXCLUDED.has_bhxh,
        has_bhyt = EXCLUDED.has_bhyt,
        latest_record_id = EXCLUDED.latest_record_id,
        latest_date = EXCLUDED.latest_date,
        effective_date = EXCLUDED.effective_date,
        next_payment = EXCLUDED.next_payment,
        next_payment_bhxh = EXCLUDED.next_payment_bhxh,
        next_payment_bhyt = EXCLUDED.next_payment_bhyt,
        latest_amount = EXCLUDED.latest_amount,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        notes = EXCLUDED.notes,
        staff_id = COALESCE(EXCLUDED.staff_id, public.customers.staff_id),
        total_contributions = EXCLUDED.total_contributions,
        total_amount_paid = EXCLUDED.total_amount_paid,
        household_id = COALESCE(EXCLUDED.household_id, public.customers.household_id),
        members = COALESCE(EXCLUDED.members, public.customers.members),
        recv_name = COALESCE(EXCLUDED.recv_name, public.customers.recv_name),
        recv_phone = COALESCE(EXCLUDED.recv_phone, public.customers.recv_phone),
        recv_address = COALESCE(EXCLUDED.recv_address, public.customers.recv_address),
        from_month = EXCLUDED.from_month,
        to_month = EXCLUDED.to_month,
        updated_at = NOW();
END;
$$;


-- ----------------------------------------------------------------------
-- PHẦN 3: NÂNG CẤP TRIGGER sync_customer_from_record()
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key TEXT;
    v_old_key TEXT;
BEGIN
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_key := COALESCE(OLD.customer_key, public.generate_customer_key(OLD.type, OLD.bhxh, OLD.cccd, OLD.name, OLD.phone));
        PERFORM public.sync_customer_master_data_for_key(v_key);
        RETURN OLD;
    END IF;

    -- UPDATE hoặc INSERT:
    v_key := COALESCE(NEW.customer_key, public.generate_customer_key(NEW.type, NEW.bhxh, NEW.cccd, NEW.name, NEW.phone));
    PERFORM public.sync_customer_master_data_for_key(v_key);

    -- Nếu UPDATE làm đổi customer_key, cần đồng bộ lại cả key cũ
    IF TG_OP = 'UPDATE' THEN
        v_old_key := COALESCE(OLD.customer_key, public.generate_customer_key(OLD.type, OLD.bhxh, OLD.cccd, OLD.name, OLD.phone));
        IF v_old_key IS NOT NULL AND v_old_key != v_key THEN
            PERFORM public.sync_customer_master_data_for_key(v_old_key);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_customer_from_record ON public.records;
CREATE TRIGGER trigger_sync_customer_from_record
    AFTER INSERT OR UPDATE OR DELETE ON public.records
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_customer_from_record();


-- ----------------------------------------------------------------------
-- PHẦN 4: SỬA RPC import_records_batch TỰ ĐỘNG ĐỒNG BỘ MASTER DATA (DB-03)
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.import_records_batch(
  p_records JSONB,
  p_batch_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_record JSONB;
  v_batch_code TEXT;
  v_user_id TEXT;
  v_user_name TEXT;
  v_record_id BIGINT;
  v_record_name TEXT;
  v_cust_key TEXT;
  v_date TIMESTAMP WITH TIME ZONE;
  v_effective_date DATE;
  v_target_date DATE;
  v_next_payment DATE;
  v_submitted_date DATE;
  v_decision_date DATE;
  v_dob DATE;
  v_from_month TEXT;
  v_to_month TEXT;
  v_from_month_date DATE;
  v_to_month_date DATE;
BEGIN
  IF NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản lý hoặc Quản trị viên mới được phép thực hiện import hàng loạt.'
      USING ERRCODE = '42501';
  END IF;

  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Dữ liệu import rỗng hoặc không đúng định dạng mảng JSON');
  END IF;

  v_batch_code := COALESCE(NULLIF(TRIM(p_batch_name), ''), 'IMPORT_' || to_char(NOW(), 'YYYYMMDD_HH24MISS'));

  v_user_id := COALESCE(auth.uid()::text, 'system');
  SELECT name INTO v_user_name FROM public.staff WHERE id = v_user_id OR email = (auth.jwt() ->> 'email') LIMIT 1;
  IF v_user_name IS NULL THEN
    v_user_name := COALESCE(auth.jwt() ->> 'email', 'Quản trị viên');
  END IF;

  -- Bật cờ tạm bỏ qua trigger từng dòng để tối ưu tốc độ nạp dữ liệu hàng loạt
  PERFORM set_config('app.is_batch_import', 'true', true);

  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_record_name := TRIM(COALESCE(v_record->>'name', ''));
    IF v_record_name = '' THEN
      CONTINUE;
    END IF;

    v_date := COALESCE(NULLIF(v_record->>'date', '')::timestamptz, NOW());
    v_effective_date := public.safe_cast_date(COALESCE(v_record->>'effective_date', v_record->>'effectiveDate'));
    v_target_date := public.safe_cast_date(COALESCE(v_record->>'target_date', v_record->>'targetDate'));
    v_next_payment := public.safe_cast_date(COALESCE(v_record->>'next_payment', v_record->>'nextPayment'));
    v_submitted_date := public.safe_cast_date(COALESCE(v_record->>'submitted_date', v_record->>'submittedDate'));
    v_decision_date := public.safe_cast_date(COALESCE(v_record->>'decision_date', v_record->>'decisionDate'));
    v_dob := public.safe_cast_date(v_record->>'dob');
    v_from_month := NULLIF(TRIM(COALESCE(v_record->>'from_month', v_record->>'fromMonth', '')), '');
    v_to_month := NULLIF(TRIM(COALESCE(v_record->>'to_month', v_record->>'toMonth', '')), '');
    v_from_month_date := public.parse_month_str_to_date(v_from_month);
    v_to_month_date := public.parse_month_str_to_date(v_to_month);

    v_cust_key := public.generate_customer_key(
      v_record->>'type',
      v_record->>'bhxh',
      v_record->>'cccd',
      v_record_name,
      v_record->>'phone'
    );

    INSERT INTO public.records (
      name, cccd, phone, address, bhxh, old_bhxh, dob, gender, nation, email,
      type, sub_type, action_type, status, payment_status, date,
      effective_date, target_date, next_payment, from_month, to_month,
      from_month_date, to_month_date, wage, income, months, method,
      base_premium, support_pct, nn_support_pct, nn_support_amount,
      dp_support_pct, dp_support_amount, amount, discount_amount, penalty_amount,
      commission, support, notes, staff_id, household_id, members,
      recv_name, recv_phone, recv_address, is_submitted_bhxh, submission_batch,
      submitted_date, refund_type, decision_number, decision_date, refund_method,
      refund_beneficiary_name, refund_beneficiary_account, refund_beneficiary_bank,
      hospital_code, hospital_name, customer_key
    ) VALUES (
      v_record_name,
      NULLIF(TRIM(COALESCE(v_record->>'cccd', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'phone', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'address', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'bhxh', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'old_bhxh', v_record->>'oldBhxh', '')), ''),
      v_dob,
      COALESCE(NULLIF(TRIM(v_record->>'gender'), ''), 'Nam'),
      COALESCE(NULLIF(TRIM(v_record->>'nation'), ''), 'Kinh'),
      NULLIF(TRIM(COALESCE(v_record->>'email', '')), ''),
      COALESCE(NULLIF(TRIM(v_record->>'type'), ''), 'BHXH'),
      NULLIF(TRIM(COALESCE(v_record->>'sub_type', v_record->>'subType', '')), ''),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'action_type', v_record->>'actionType', '')), ''), 'Tái tục'),
      COALESCE(NULLIF(TRIM(v_record->>'status'), ''), 'Đang tham gia'),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'payment_status', v_record->>'paymentStatus', '')), ''), 'Đã thu tiền'),
      v_date,
      v_effective_date,
      v_target_date,
      v_next_payment,
      v_from_month,
      v_to_month,
      v_from_month_date,
      v_to_month_date,
      COALESCE(NULLIF(v_record->>'wage', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'income', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'months', '')::int, 1),
      COALESCE(NULLIF(TRIM(v_record->>'method'), ''), 'Hàng tháng'),
      COALESCE(NULLIF(COALESCE(v_record->>'base_premium', v_record->>'basePremium', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'support_pct', v_record->>'supportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'nn_support_pct', v_record->>'nnSupportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'nn_support_amount', v_record->>'nnSupportAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'dp_support_pct', v_record->>'dpSupportPct', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'dp_support_amount', v_record->>'dpSupportAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'amount', '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'discount_amount', v_record->>'discountAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(COALESCE(v_record->>'penalty_amount', v_record->>'penaltyAmount', ''), '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'commission', '')::numeric, 0),
      COALESCE(NULLIF(v_record->>'support', '')::numeric, 0),
      NULLIF(TRIM(COALESCE(v_record->>'notes', '')), ''),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'staff_id', v_record->>'staffId', '')), ''), v_user_id),
      NULLIF(TRIM(COALESCE(v_record->>'household_id', v_record->>'householdId', '')), ''),
      CASE WHEN v_record->'members' IS NOT NULL AND jsonb_typeof(v_record->'members') = 'array' THEN v_record->'members' ELSE NULL END,
      NULLIF(TRIM(COALESCE(v_record->>'recv_name', v_record->>'recvName', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'recv_phone', v_record->>'recvPhone', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'recv_address', v_record->>'recvAddress', '')), ''),
      COALESCE((COALESCE(v_record->>'is_submitted_bhxh', v_record->>'isSubmittedBHXH'))::boolean, FALSE),
      COALESCE(NULLIF(TRIM(COALESCE(v_record->>'submission_batch', v_record->>'submissionBatch', '')), ''), v_batch_code),
      v_submitted_date,
      NULLIF(TRIM(COALESCE(v_record->>'refund_type', v_record->>'refundType', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'decision_number', v_record->>'decisionNumber', '')), ''),
      v_decision_date,
      NULLIF(TRIM(COALESCE(v_record->>'refund_method', v_record->>'refundMethod', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_name', v_record->>'refundBeneficiaryName', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_account', v_record->>'refundBeneficiaryAccount', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'refund_beneficiary_bank', v_record->>'refundBeneficiaryBank', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'hospital_code', v_record->>'hospitalCode', '')), ''),
      NULLIF(TRIM(COALESCE(v_record->>'hospital_name', v_record->>'hospitalName', '')), ''),
      v_cust_key
    ) RETURNING id INTO v_record_id;

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  -- Tắt cờ batch import
  PERFORM set_config('app.is_batch_import', 'false', true);

  -- ĐỒNG BỘ MASTER DATA BÙ CHO TOÀN BỘ CÁC KHÁCH HÀNG TRONG LÔ IMPORT
  FOR v_cust_key IN 
    SELECT DISTINCT customer_key 
    FROM public.records 
    WHERE submission_batch = v_batch_code AND customer_key IS NOT NULL 
  LOOP
    PERFORM public.sync_customer_master_data_for_key(v_cust_key);
  END LOOP;

  INSERT INTO public.auditlogs (user_id, user_name, action, details, timestamp)
  VALUES (
    v_user_id, 
    v_user_name, 
    'Import Hàng loạt', 
    format('Import thành công %s hồ sơ và đồng bộ Master Data danh bạ khách hàng theo đợt [%s]', v_inserted_count, v_batch_code),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'batch_name', v_batch_code,
    'imported_count', v_inserted_count
  );
END;
$$;


-- ----------------------------------------------------------------------
-- PHẦN 5: CẬP NHẬT RPC resync_customer_from_records & TỰ ĐỘNG CHỮA LÀNH DỮ LIỆU
-- ----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.resync_customer_from_records(
    p_customer_key TEXT DEFAULT NULL,
    p_cccd TEXT DEFAULT NULL,
    p_bhxh TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key TEXT;
    v_synced_count INT := 0;
BEGIN
    FOR v_key IN 
        SELECT DISTINCT COALESCE(customer_key, public.generate_customer_key(type, bhxh, cccd, name, phone))
        FROM public.records
        WHERE (p_customer_key IS NULL AND p_cccd IS NULL AND p_bhxh IS NULL)
           OR (p_customer_key IS NOT NULL AND (customer_key = p_customer_key OR cccd = p_customer_key OR bhxh = p_customer_key))
           OR (p_cccd IS NOT NULL AND TRIM(p_cccd) != '' AND cccd = p_cccd)
           OR (p_bhxh IS NOT NULL AND TRIM(p_bhxh) != '' AND bhxh = p_bhxh)
    LOOP
        PERFORM public.sync_customer_master_data_for_key(v_key);
        v_synced_count := v_synced_count + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'synced_count', v_synced_count,
        'message', format('Đã đồng bộ lại dữ liệu cho %s khách hàng.', v_synced_count)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_customer_master_data_for_key(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.resync_customer_from_records(TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.import_records_batch(JSONB, TEXT) TO authenticated, service_role;

-- KHỐI LỆNH TỰ ĐỘNG CHỮA LÀNH TOÀN BỘ CƠ SỞ DỮ LIỆU (AUTO-HEAL ALL EXISTING CUSTOMERS)
DO $$
DECLARE
    v_cust RECORD;
    v_key TEXT;
BEGIN
    -- Đồng bộ cho toàn bộ khách hàng có hồ sơ trong bảng records
    FOR v_key IN 
        SELECT DISTINCT COALESCE(customer_key, public.generate_customer_key(type, bhxh, cccd, name, phone))
        FROM public.records
        WHERE customer_key IS NOT NULL OR cccd IS NOT NULL OR bhxh IS NOT NULL
    LOOP
        PERFORM public.sync_customer_master_data_for_key(v_key);
    END LOOP;

    -- Đồng bộ lại cho các khách hàng có trong customers nhưng chưa có trong records
    FOR v_cust IN SELECT customer_key FROM public.customers LOOP
        PERFORM public.sync_customer_master_data_for_key(v_cust.customer_key);
    END LOOP;
END;
$$;
