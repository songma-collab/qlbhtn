-- ======================================================================
-- MIGRATION: 20260917_add_customer_status_stop_contributing.sql
-- Mục tiêu: Bổ sung và đồng bộ hóa cột "Trạng thái khách hàng" (Customer Status)
-- với 2 trạng thái chính:
--   1. "Đang tham gia" (Active)
--   2. "Đã dừng đóng" (Suspended / Stopped)
--   3. "Chờ duyệt" (Pending)
--
-- Nghiệp vụ:
--   - Loại trừ người "Đã dừng đóng" khỏi danh sách đôn đốc tái tục / cảnh báo hết hạn
--   - Khi người này quay lại nộp tiền mới ("Đã thu tiền"), tự động kích hoạt lại "Đang tham gia"
--   - Tra cứu profile vẫn trả về đầy đủ thông tin kể cả khi "Đã dừng đóng"
-- ======================================================================

-- 1. CHUẨN HÓA CỘT STATUS VÀ RÀNG BUỘC CHECK TRÊN BẢNG CUSTOMERS & RECORDS
-- Đảm bảo các dữ liệu cũ (NULL, 'Hoạt động', 'Hoàn tất') được chuẩn hóa về 'Đang tham gia'
UPDATE public.customers 
SET status = 'Đang tham gia' 
WHERE status IS NULL OR status IN ('Hoạt động', 'Hoàn tất', 'Active', 'Hoat dong', '');

UPDATE public.records 
SET status = 'Đang tham gia' 
WHERE status IS NULL OR status IN ('Hoạt động', 'Hoàn tất', 'Active', 'Hoat dong', '');

-- Thiết lập giá trị mặc định cho bản ghi mới là 'Đang tham gia'
ALTER TABLE public.customers ALTER COLUMN status SET DEFAULT 'Đang tham gia';
ALTER TABLE public.records ALTER COLUMN status SET DEFAULT 'Đang tham gia';

-- Thêm ràng buộc Check Constraint cho cột status trên cả 2 bảng
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS chk_customers_status;
ALTER TABLE public.customers ADD CONSTRAINT chk_customers_status 
  CHECK (status IN ('Đang tham gia', 'Đã dừng đóng', 'Chờ duyệt'));

ALTER TABLE public.records DROP CONSTRAINT IF EXISTS chk_records_status;
ALTER TABLE public.records ADD CONSTRAINT chk_records_status 
  CHECK (status IN ('Đang tham gia', 'Đã dừng đóng', 'Chờ duyệt'));


-- 2. TẠO CÁC PARTIAL INDEXES TỐI ƯU HÓA TRUY VẤN ĐÔN ĐỐC TÁI TỤC
-- Tăng tốc độ truy vấn danh sách đôn đốc khi loại bỏ nhóm "Đã dừng đóng"
CREATE INDEX IF NOT EXISTS idx_customers_active_due 
  ON public.customers (next_payment, type) 
  WHERE status = 'Đang tham gia';

CREATE INDEX IF NOT EXISTS idx_records_active_due 
  ON public.records ("nextPayment", type) 
  WHERE status = 'Đang tham gia';

CREATE INDEX IF NOT EXISTS idx_customers_status_search 
  ON public.customers (status, type, next_payment);


-- 3. CẬP NHẬT TRIGGER sync_customer_from_record
-- Đồng bộ trạng thái khách hàng Master khi có thay đổi trên records:
-- - Khi bản ghi mới nhất chuyển thành 'Đã dừng đóng', customers.status = 'Đã dừng đóng'
-- - Khi phát sinh giao dịch mới với paymentStatus = 'Đã thu tiền', tự động chuyển lại 'Đang tham gia'
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
    v_target_status TEXT;
BEGIN
    -- BỎ QUA NẾU ĐANG CHẠY TRONG PHIÊN IMPORT HÀNG LOẠT (BULK BATCH IMPORT)
    IF current_setting('app.is_batch_import', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    -- Lấy customer_key
    v_key := COALESCE(v_rec."customer_key", v_rec."customerKey");
    IF v_key IS NULL OR TRIM(v_key) = '' THEN
        v_key := public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone);
    END IF;

    IF v_key IS NULL THEN RETURN v_rec; END IF;

    -- Tìm bản ghi mới nhất nhưng LOẠI TRỪ các bản ghi đã hủy hoặc bút toán bù trừ âm
    SELECT * INTO v_latest
    FROM public.records r
    WHERE (
        r."customer_key" = v_key 
        OR r."customerKey" = v_key 
        OR public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      )
      AND r."paymentStatus" != 'Đã hủy'
      AND (r."isAdjustment" IS NULL OR r."isAdjustment" = false)
    ORDER BY r.date DESC, r.id DESC
    LIMIT 1;

    -- Nếu không còn bản ghi nào hợp lệ, xóa khỏi danh bạ master
    IF v_latest IS NULL THEN
        DELETE FROM public.customers WHERE customer_key = v_key;
        RETURN v_rec;
    END IF;

    -- Xác định trạng thái Master khách hàng (Customer Status Invariant)
    -- Quy tắc:
    -- 1. Nếu giao dịch mới là nộp tiền (paymentStatus = 'Đã thu tiền' và amount > 0 và không phải thoái thu),
    --    tự động kích hoạt lại thành 'Đang tham gia'.
    -- 2. Nếu bản ghi mới nhất được đánh dấu 'Đã dừng đóng', Master cập nhật 'Đã dừng đóng'.
    -- 3. Mặc định kế thừa từ v_latest.status hoặc 'Đang tham gia'.
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') 
       AND NEW."paymentStatus" = 'Đã thu tiền' 
       AND COALESCE(NEW.amount, 0) > 0 
       AND (NEW."isAdjustment" IS NULL OR NEW."isAdjustment" = false) 
       AND (NEW.status IS NULL OR NEW.status != 'Đã dừng đóng') THEN
        v_target_status := 'Đang tham gia';
    ELSIF v_latest.status = 'Đã dừng đóng' THEN
        v_target_status := 'Đã dừng đóng';
    ELSE
        v_target_status := COALESCE(v_latest.status, 'Đang tham gia');
    END IF;

    -- Tính tổng số kỳ và tổng tiền đã đóng
    SELECT 
        GREATEST(0, COUNT(*) FILTER (WHERE r."isAdjustment" IS NOT TRUE) - COUNT(*) FILTER (WHERE r."isAdjustment" = TRUE)),
        COALESCE(SUM(amount), 0)
    INTO v_total_contrib, v_total_paid
    FROM public.records r
    WHERE (
        r."customer_key" = v_key 
        OR r."customerKey" = v_key 
        OR public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      )
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
        v_target_status, v_latest."paymentStatus", v_latest.notes, v_latest."staffId",
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
        status = v_target_status,
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


-- 4. CẬP NHẬT VIEW crm_customers
-- Đảm bảo trường status phản ánh chính xác từ customers.status
DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers AS
SELECT 
    r.id,
    r.date,
    r.name,
    r.cccd,
    r.phone,
    r.address,
    r.bhxh,
    r.type,
    r."subType",
    r.wage,
    r.months,
    r."supportPct",
    r.amount,
    COALESCE(c.status, r.status, 'Đang tham gia') AS status,
    r."paymentStatus",
    r.notes,
    r."staffId",
    r."fromMonth",
    r."toMonth",
    r."basePremium",
    r."nnSupportPct",
    r."nnSupportAmount",
    r."dpSupportPct",
    r."dpSupportAmount",
    r."effectiveDate",
    r."targetDate",
    c.next_payment AS "nextPayment",
    r."householdId",
    r.members,
    r."recvName",
    r."recvPhone",
    r."recvAddress",
    r."isSubmittedBHXH",
    r."submissionBatch",
    r."submittedDate",
    r."actionType",
    r.dob,
    r.gender,
    r.nation,
    r.email,
    r.income,
    r.method,
    r."discountAmount",
    r."penaltyAmount",
    r.commission,
    r.support,
    c.total_contributions AS "totalContributions",
    c.total_amount_paid AS "totalAmountPaid"
FROM public.customers c
JOIN public.records r ON c.latest_record_id = r.id;

-- Phân quyền truy cập view crm_customers
GRANT SELECT ON public.crm_customers TO authenticated, service_role;


-- 5. ĐẢM BẢO RPC TRA CỨU TÁI TỤC lookup_customer_profile & public_get_renewal_info
-- Vẫn cho phép tra cứu ra dữ liệu của khách hàng dù đang ở trạng thái 'Đã dừng đóng'
-- để cán bộ dễ dàng tự động điền form khi họ đến tham gia lại.
CREATE OR REPLACE FUNCTION public.lookup_customer_profile(p_code TEXT)
RETURNS TABLE (
  name TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  cccd TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  bhxh TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Chỉ tài khoản cán bộ thu hoặc quản trị viên đã đăng nhập mới có quyền tra cứu PII đầy đủ
  IF auth.role() != 'authenticated' OR public.get_my_role() NOT IN ('Admin', 'Quản lý', 'Nhân viên') THEN
    RAISE EXCEPTION 'Access denied: Yêu cầu đăng nhập tài khoản cán bộ để tra cứu hồ sơ người dân.';
  END IF;

  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    r.name,
    r.dob,
    r.gender,
    r.nation,
    r.cccd,
    r.phone,
    r.email,
    r.address,
    r.bhxh
  FROM public.records r
  WHERE r."paymentStatus" != 'Đã hủy'
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC, r.id DESC
  LIMIT 1;
END;
$$;

-- Đảm bảo quyền execute
REVOKE EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lookup_customer_profile(TEXT) TO authenticated, service_role;
