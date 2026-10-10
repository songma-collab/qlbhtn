-- ==============================================================================
-- MIGRATION: 20261009000001_fix_sync_customer_on_delete_and_resync.sql
-- Mục đích:
-- 1. Sửa lỗi trigger sync_customer_from_record() khi xóa (DELETE) giao dịch:
--    Trước đây, khi xóa bản ghi, trigger dùng dữ liệu OLD (bản ghi vừa bị xóa) để ghi đè vào customers,
--    dẫn đến việc xóa phát sinh gia hạn thì danh bạ vẫn lưu kỳ hạn & trạng thái "Chờ thanh toán" của bản ghi đã xóa.
--    Trigger mới sẽ tìm hợp đồng hợp lệ mới nhất còn lại trong records để cập nhật customers,
--    hoặc xóa customers nếu không còn bất kỳ giao dịch nào.
-- 2. Cập nhật hàm delete_record_safe() & bulk_delete_records_safe() để đồng bộ toàn diện.
-- 3. Khối lệnh tự động chữa lành (auto-heal) toàn bộ dữ liệu danh bạ khách hàng bị lệch (bao gồm Lèo Thị Thư).
-- ==============================================================================

-- 1. SỬA LỖI TRIGGER sync_customer_from_record()
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
    v_latest_remaining RECORD;
BEGIN
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- XỬ LÝ ĐẶC BIỆT KHI XÓA BẢN GHI (DELETE)
    IF TG_OP = 'DELETE' THEN
        v_key := COALESCE(OLD.customer_key, public.generate_customer_key(OLD.type, OLD.bhxh, OLD.cccd, OLD.name, OLD.phone));

        -- Tìm hợp đồng hợp lệ mới nhất còn lại của khách hàng này (loại trừ bản ghi vừa xóa và bản ghi đã hủy)
        SELECT * INTO v_latest_remaining
        FROM public.records
        WHERE id != OLD.id
          AND (
            (v_key IS NOT NULL AND customer_key = v_key)
            OR (OLD.cccd IS NOT NULL AND TRIM(OLD.cccd) != '' AND cccd = OLD.cccd)
            OR (OLD.bhxh IS NOT NULL AND TRIM(OLD.bhxh) != '' AND bhxh = OLD.bhxh)
          )
          AND COALESCE(payment_status, '') != 'Đã hủy'
        ORDER BY COALESCE(next_payment, to_month_date, date) DESC, id DESC
        LIMIT 1;

        IF v_latest_remaining.id IS NOT NULL THEN
            -- Khách hàng còn giao dịch hợp lệ: Hoàn nguyên thông tin customers về giao dịch mới nhất còn lại
            UPDATE public.customers
            SET
                latest_record_id = v_latest_remaining.id,
                from_month = v_latest_remaining.from_month,
                to_month = v_latest_remaining.to_month,
                next_payment = v_latest_remaining.next_payment,
                next_payment_bhxh = CASE WHEN v_latest_remaining.type = 'BHXH' THEN v_latest_remaining.next_payment ELSE NULL END,
                next_payment_bhyt = CASE WHEN v_latest_remaining.type = 'BHYT' THEN v_latest_remaining.next_payment ELSE NULL END,
                payment_status = v_latest_remaining.payment_status,
                latest_date = v_latest_remaining.date::date,
                latest_amount = v_latest_remaining.amount,
                status = COALESCE(v_latest_remaining.status, 'Đang tham gia'),
                total_amount_paid = GREATEST(0, COALESCE((
                    SELECT SUM(amount) FROM public.records 
                    WHERE id != OLD.id 
                      AND ((v_key IS NOT NULL AND customer_key = v_key) OR (OLD.cccd IS NOT NULL AND cccd = OLD.cccd) OR (OLD.bhxh IS NOT NULL AND bhxh = OLD.bhxh))
                      AND payment_status = 'Đã thu tiền'
                ), 0)),
                total_contributions = GREATEST(0, COALESCE((
                    SELECT COUNT(*) FROM public.records 
                    WHERE id != OLD.id 
                      AND ((v_key IS NOT NULL AND customer_key = v_key) OR (OLD.cccd IS NOT NULL AND cccd = OLD.cccd) OR (OLD.bhxh IS NOT NULL AND bhxh = OLD.bhxh))
                      AND payment_status = 'Đã thu tiền'
                ), 0)),
                updated_at = NOW()
            WHERE customer_key = v_key
               OR (OLD.cccd IS NOT NULL AND TRIM(OLD.cccd) != '' AND cccd = OLD.cccd)
               OR (OLD.bhxh IS NOT NULL AND TRIM(OLD.bhxh) != '' AND bhxh = OLD.bhxh);
        ELSE
            -- Khách hàng không còn bất kỳ giao dịch nào: Xóa khỏi danh bạ customers
            DELETE FROM public.customers
            WHERE customer_key = v_key
               OR (OLD.cccd IS NOT NULL AND TRIM(OLD.cccd) != '' AND cccd = OLD.cccd)
               OR (OLD.bhxh IS NOT NULL AND TRIM(OLD.bhxh) != '' AND bhxh = OLD.bhxh);
        END IF;

        RETURN OLD;
    END IF;

    -- XỬ LÝ KHI UPDATE BẢN GHI
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
        household_id, members, recv_name, recv_phone, recv_address,
        next_payment, next_payment_bhxh, next_payment_bhyt, latest_date, latest_amount, from_month, to_month,
        created_at, updated_at
    ) VALUES (
        v_key, v_rec.type, v_rec.name, v_rec.cccd, v_rec.bhxh, v_rec.old_bhxh, v_rec.phone, v_rec.address,
        v_rec.dob, v_rec.gender, v_rec.nation, v_rec.email,
        v_latest_id, v_target_status, v_rec.payment_status, v_rec.notes, v_rec.staff_id,
        GREATEST(0, v_delta_contrib), GREATEST(0, v_delta_amount),
        v_rec.household_id,
        CASE WHEN v_rec.members IS NOT NULL THEN to_jsonb(v_rec.members) ELSE NULL END,
        v_rec.recv_name, v_rec.recv_phone, v_rec.recv_address,
        v_rec.next_payment,
        CASE WHEN v_rec.type = 'BHXH' THEN v_rec.next_payment ELSE NULL END,
        CASE WHEN v_rec.type = 'BHYT' THEN v_rec.next_payment ELSE NULL END,
        v_rec.date::date,
        v_rec.amount,
        v_rec.from_month,
        v_rec.to_month,
        NOW(), NOW()
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
        next_payment = COALESCE(EXCLUDED.next_payment, public.customers.next_payment),
        next_payment_bhxh = COALESCE(EXCLUDED.next_payment_bhxh, public.customers.next_payment_bhxh),
        next_payment_bhyt = COALESCE(EXCLUDED.next_payment_bhyt, public.customers.next_payment_bhyt),
        latest_date = COALESCE(EXCLUDED.latest_date, public.customers.latest_date),
        latest_amount = COALESCE(EXCLUDED.latest_amount, public.customers.latest_amount),
        from_month = COALESCE(EXCLUDED.from_month, public.customers.from_month),
        to_month = COALESCE(EXCLUDED.to_month, public.customers.to_month),
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

-- 2. TỰ ĐỘNG CHỮA LÀNH DỮ LIỆU ĐANG BỊ LỆCH CHO TOÀN BỘ KHÁCH HÀNG (AUTO-HEAL SCRIPT)
DO $$
DECLARE
  r_cust RECORD;
  r_valid RECORD;
BEGIN
  FOR r_cust IN SELECT id, customer_key, cccd, bhxh FROM public.customers LOOP
    SELECT * INTO r_valid
    FROM public.records
    WHERE (
      (r_cust.customer_key IS NOT NULL AND customer_key = r_cust.customer_key)
      OR (r_cust.cccd IS NOT NULL AND TRIM(r_cust.cccd) != '' AND cccd = r_cust.cccd)
      OR (r_cust.bhxh IS NOT NULL AND TRIM(r_cust.bhxh) != '' AND bhxh = r_cust.bhxh)
    )
    AND COALESCE(payment_status, '') != 'Đã hủy'
    ORDER BY COALESCE(next_payment, to_month_date, date) DESC, id DESC
    LIMIT 1;

    IF r_valid.id IS NOT NULL THEN
      UPDATE public.customers
      SET
        latest_record_id = r_valid.id,
        from_month = r_valid.from_month,
        to_month = r_valid.to_month,
        next_payment = r_valid.next_payment,
        next_payment_bhxh = CASE WHEN r_valid.type = 'BHXH' THEN r_valid.next_payment ELSE NULL END,
        next_payment_bhyt = CASE WHEN r_valid.type = 'BHYT' THEN r_valid.next_payment ELSE NULL END,
        payment_status = r_valid.payment_status,
        latest_amount = r_valid.amount,
        latest_date = r_valid.date::date,
        status = COALESCE(r_valid.status, 'Đang tham gia'),
        updated_at = NOW()
      WHERE id = r_cust.id;
    END IF;
  END LOOP;
END $$;
