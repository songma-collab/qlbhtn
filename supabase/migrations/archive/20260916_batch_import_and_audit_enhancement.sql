-- ======================================================================
-- MIGRATION 20260916: TỐI ƯU BULK BATCH IMPORT & AUDIT ENHANCEMENT
-- 1. Giải quyết triệt để nghẽn Trigger Row-by-Row khi Import file Excel hàng trăm/hàng nghìn dòng
-- 2. Tự động kiểm tra cờ phiên session app.is_batch_import để bỏ qua trigger per-row
-- 3. Cung cấp RPC public.import_records_batch(p_records JSONB, p_batch_name TEXT)
-- 4. Thực hiện UPSERT tập trung 1 lần duy nhất vào bảng public.customers
-- 5. Ghi 1 dòng nhật ký kiểm toán tập trung vào auditlogs
-- ======================================================================

-- 1. CẬP NHẬT TRIGGER FUNCTIONS ĐỂ NHẬN DIỆN CỜ PHIÊN SESSION app.is_batch_import

CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_customer_key TEXT;
  v_cust_id UUID;
BEGIN
  -- BỎ QUA NẾU ĐANG CHẠY TRONG PHIÊN IMPORT HÀNG LOẠT (BULK BATCH IMPORT)
  IF current_setting('app.is_batch_import', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_rec := COALESCE(NEW, OLD);
  
  -- Ưu tiên lấy customer_key đã có trên record
  v_customer_key := COALESCE(v_rec."customer_key", v_rec."customerKey");
  
  IF v_customer_key IS NULL OR TRIM(v_customer_key) = '' THEN
    v_customer_key := public.generate_customer_key(
      v_rec.type,
      v_rec.bhxh,
      v_rec.cccd,
      v_rec.name,
      v_rec.phone
    );
  END IF;

  IF v_customer_key IS NULL THEN
    RETURN v_rec;
  END IF;

  -- Đồng bộ tổng hợp cho khách hàng có khóa này
  PERFORM public.refresh_customer_summary(v_customer_key);

  RETURN v_rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.before_record_assign_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key TEXT;
  v_cust_id UUID;
  v_now DATE := COALESCE(NEW.date::DATE, CURRENT_DATE);
  v_dob DATE;
BEGIN
  -- BỎ QUA NẾU ĐANG CHẠY TRONG PHIÊN IMPORT HÀNG LOẠT (BULK BATCH IMPORT)
  IF current_setting('app.is_batch_import', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- 1. Chuẩn hóa customer_key nếu chưa có
  IF NEW."customer_key" IS NULL OR TRIM(NEW."customer_key") = '' THEN
    NEW."customer_key" := public.generate_customer_key(
      NEW.type,
      NEW.bhxh,
      NEW.cccd,
      NEW.name,
      NEW.phone
    );
  END IF;
  
  v_key := NEW."customer_key";
  NEW."customerKey" := v_key;

  IF v_key IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Tìm hoặc tạo khách hàng trong bảng customers
  SELECT id INTO v_cust_id FROM public.customers WHERE customer_key = v_key LIMIT 1;

  IF v_cust_id IS NULL THEN
    -- Parse dob an toàn
    BEGIN
      v_dob := NEW.dob::DATE;
    EXCEPTION WHEN OTHERS THEN
      v_dob := NULL;
    END;

    INSERT INTO public.customers (
      customer_key, type, name, cccd, bhxh, phone, address,
      dob, gender, nation, email,
      created_at, updated_at
    ) VALUES (
      v_key,
      COALESCE(NEW.type, 'BHXH'),
      COALESCE(TRIM(NEW.name), 'Khách hàng'),
      NULLIF(TRIM(NEW.cccd), ''),
      NULLIF(TRIM(NEW.bhxh), ''),
      NULLIF(TRIM(NEW.phone), ''),
      NULLIF(TRIM(NEW.address), ''),
      v_dob,
      COALESCE(NEW.gender, 'Nam'),
      COALESCE(NEW.nation, 'Kinh'),
      NULLIF(TRIM(NEW.email), ''),
      NOW(), NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE
    SET
      name = EXCLUDED.name,
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), customers.phone),
      address = COALESCE(NULLIF(EXCLUDED.address, ''), customers.address),
      updated_at = NOW()
    RETURNING id INTO v_cust_id;
  END IF;

  NEW."customerId" := v_cust_id;
  RETURN NEW;
END;
$$;

-- 2. TẠO RPC FUNCTION NHẬP HÀNG LOẠT: public.import_records_batch
CREATE OR REPLACE FUNCTION public.import_records_batch(
  p_records JSONB,
  p_batch_name TEXT DEFAULT 'EXCEL_BATCH_IMPORT'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER := 0;
  v_inserted_ids BIGINT[] := ARRAY[]::BIGINT[];
  v_keys TEXT[];
  v_staff_id TEXT;
  v_staff_name TEXT;
  v_uid UUID := auth.uid();
BEGIN
  -- 1. Kiểm tra đầu vào
  IF p_records IS NULL OR jsonb_array_length(p_records) = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'imported_count', 0,
      'record_ids', '[]'::jsonb,
      'message', 'Không có bản ghi nào để import.'
    );
  END IF;

  -- 2. KÍCH HOẠT CỜ PHIÊN SESSION ĐỂ TẠM DỪNG CÁC TRIGGER PER-ROW
  PERFORM set_config('app.is_batch_import', 'true', true);

  -- 3. CHÈN HÀNG LOẠT VÀO BẢNG public.records
  WITH raw_data AS (
    SELECT
      elem->>'name' AS name,
      NULLIF(TRIM(elem->>'cccd'), '') AS cccd,
      NULLIF(TRIM(elem->>'phone'), '') AS phone,
      NULLIF(TRIM(elem->>'bhxh'), '') AS bhxh,
      CASE 
        WHEN elem->>'dob' IS NOT NULL AND elem->>'dob' ~ '^\d{4}-\d{2}-\d{2}' THEN (elem->>'dob')::DATE
        ELSE NULL
      END AS dob,
      COALESCE(elem->>'gender', 'Nam') AS gender,
      COALESCE(elem->>'nation', 'Kinh') AS nation,
      NULLIF(TRIM(elem->>'email'), '') AS email,
      NULLIF(TRIM(elem->>'address'), '') AS address,
      NULLIF(TRIM(elem->>'notes'), '') AS notes,
      COALESCE(UPPER(TRIM(elem->>'type')), 'BHXH') AS type,
      COALESCE(elem->>'actionType', 'Đăng ký mới') AS "actionType",
      COALESCE(elem->>'paymentStatus', 'Đã thu tiền') AS "paymentStatus",
      COALESCE(elem->>'status', 'Hoàn tất') AS status,
      NULLIF(TRIM(elem->>'staffId'), '') AS "staffId",
      COALESCE((elem->>'income')::NUMERIC, 1500000) AS income,
      COALESCE((elem->>'months')::INT, 1) AS months,
      NULLIF(TRIM(elem->>'fromMonth'), '') AS "fromMonth",
      NULLIF(TRIM(elem->>'toMonth'), '') AS "toMonth",
      COALESCE((elem->>'amount')::NUMERIC, 0) AS amount,
      COALESCE((elem->>'wage')::NUMERIC, 0) AS wage,
      COALESCE((elem->>'supportPct')::NUMERIC, 0) AS "supportPct",
      COALESCE((elem->>'commission')::NUMERIC, 0) AS commission,
      COALESCE((elem->>'support')::NUMERIC, 0) AS support,
      elem->'members' AS members,
      NULLIF(TRIM(elem->>'recvName'), '') AS "recvName",
      NULLIF(TRIM(elem->>'recvPhone'), '') AS "recvPhone",
      NULLIF(TRIM(elem->>'recvAddress'), '') AS "recvAddress",
      NULLIF(TRIM(elem->>'ip_address'), '') AS ip_address,
      CASE 
        WHEN elem->>'date' IS NOT NULL AND elem->>'date' ~ '^\d{4}-\d{2}-\d{2}' THEN (elem->>'date')::DATE
        ELSE CURRENT_DATE
      END AS date,
      COALESCE(
        NULLIF(TRIM(elem->>'customer_key'), ''),
        NULLIF(TRIM(elem->>'customerKey'), ''),
        public.generate_customer_key(
          COALESCE(UPPER(TRIM(elem->>'type')), 'BHXH'),
          NULLIF(TRIM(elem->>'bhxh'), ''),
          NULLIF(TRIM(elem->>'cccd'), ''),
          elem->>'name',
          NULLIF(TRIM(elem->>'phone'), '')
        )
      ) AS customer_key
    FROM jsonb_array_elements(p_records) AS elem
  ),
  inserted_rows AS (
    INSERT INTO public.records (
      "name", "cccd", "phone", "bhxh", "dob", "gender", "nation", "email", "address", "notes",
      "type", "actionType", "paymentStatus", "status", "staffId",
      "income", "months", "fromMonth", "toMonth", "amount", "wage", "supportPct", "commission", "support",
      "members", "recvName", "recvPhone", "recvAddress", "ip_address", "date",
      "customer_key", "customerKey"
    )
    SELECT
      name, cccd, phone, bhxh, dob, gender, nation, email, address, notes,
      type, "actionType", "paymentStatus", status, "staffId",
      income, months, "fromMonth", "toMonth", amount, wage, "supportPct", commission, support,
      members, "recvName", "recvPhone", "recvAddress", ip_address, date,
      customer_key, customer_key
    FROM raw_data
    RETURNING id, customer_key
  )
  SELECT 
    COUNT(*), 
    COALESCE(array_agg(id), ARRAY[]::BIGINT[]),
    COALESCE(array_agg(DISTINCT customer_key), ARRAY[]::TEXT[])
  INTO v_count, v_inserted_ids, v_keys
  FROM inserted_rows;

  -- 4. THỰC HIỆN MỘT CÂU LỆNH UPSERT DUY NHẤT VÀO BẢNG public.customers
  IF array_length(v_keys, 1) > 0 THEN
    WITH distinct_keys AS (
      SELECT unnest(v_keys) AS ckey
    ),
    summary_data AS (
      SELECT 
        dk.ckey AS customer_key,
        COALESCE(
          (SELECT r.type FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) ORDER BY r.date DESC, r.id DESC LIMIT 1),
          'BHXH'
        ) AS type,
        COALESCE(
          (SELECT r.name FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) ORDER BY r.date DESC, r.id DESC LIMIT 1),
          'Khách hàng'
        ) AS name,
        (SELECT r.cccd FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.cccd IS NOT NULL AND r.cccd != '' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS cccd,
        (SELECT r.bhxh FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.bhxh IS NOT NULL AND r.bhxh != '' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS bhxh,
        (SELECT r.phone FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.phone IS NOT NULL AND r.phone != '' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS phone,
        (SELECT r.address FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.address IS NOT NULL AND r.address != '' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS address,
        (SELECT r.dob FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.dob IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1) AS dob,
        COALESCE((SELECT r.gender FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.gender IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1), 'Nam') AS gender,
        COALESCE((SELECT r.nation FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.nation IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1), 'Kinh') AS nation,
        (SELECT r.email FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.email IS NOT NULL AND r.email != '' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS email,
        
        -- Thống kê hoạt động
        (SELECT r.id FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus != 'Đã hủy' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS latest_record_id,
        (SELECT r.date FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus != 'Đã hủy' ORDER BY r.date DESC, r.id DESC LIMIT 1) AS latest_date,
        (SELECT r."effectiveDate" FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus != 'Đã hủy' AND r."effectiveDate" IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1) AS effective_date,
        (SELECT r."targetDate" FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus != 'Đã hủy' AND r."targetDate" IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1) AS next_payment,
        
        -- Lũy kế
        COALESCE((SELECT COUNT(*) FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus != 'Đã hủy'), 0) AS total_contributions,
        COALESCE((SELECT SUM(r.amount) FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.paymentStatus = 'Đã thu tiền'), 0) AS total_amount_paid,
        
        -- Đa dạng hóa dịch vụ
        EXISTS(SELECT 1 FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.type = 'BHXH' AND r.paymentStatus != 'Đã hủy') AS has_bhxh,
        EXISTS(SELECT 1 FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.type = 'BHYT' AND r.paymentStatus != 'Đã hủy') AS has_bhyt,
        (SELECT r."targetDate" FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.type = 'BHXH' AND r.paymentStatus != 'Đã hủy' AND r."targetDate" IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1) AS next_payment_bhxh,
        (SELECT r."targetDate" FROM public.records r WHERE (r.customer_key = dk.ckey OR r."customerKey" = dk.ckey) AND r.type = 'BHYT' AND r.paymentStatus != 'Đã hủy' AND r."targetDate" IS NOT NULL ORDER BY r.date DESC, r.id DESC LIMIT 1) AS next_payment_bhyt
      FROM distinct_keys dk
    )
    INSERT INTO public.customers (
      customer_key, type, name, cccd, bhxh, phone, address,
      dob, gender, nation, email,
      latest_record_id, latest_date, effective_date, next_payment,
      total_contributions, total_amount_paid,
      has_bhxh, has_bhyt, next_payment_bhxh, next_payment_bhyt,
      updated_at
    )
    SELECT
      customer_key, type, name, cccd, bhxh, phone, address,
      dob, gender, nation, email,
      latest_record_id, latest_date, effective_date, next_payment,
      total_contributions, total_amount_paid,
      has_bhxh, has_bhyt, next_payment_bhxh, next_payment_bhyt,
      NOW()
    FROM summary_data
    ON CONFLICT (customer_key) DO UPDATE SET
      type = EXCLUDED.type,
      name = EXCLUDED.name,
      cccd = COALESCE(EXCLUDED.cccd, customers.cccd),
      bhxh = COALESCE(EXCLUDED.bhxh, customers.bhxh),
      phone = COALESCE(EXCLUDED.phone, customers.phone),
      address = COALESCE(EXCLUDED.address, customers.address),
      dob = COALESCE(EXCLUDED.dob, customers.dob),
      gender = COALESCE(EXCLUDED.gender, customers.gender),
      nation = COALESCE(EXCLUDED.nation, customers.nation),
      email = COALESCE(EXCLUDED.email, customers.email),
      latest_record_id = COALESCE(EXCLUDED.latest_record_id, customers.latest_record_id),
      latest_date = COALESCE(EXCLUDED.latest_date, customers.latest_date),
      effective_date = COALESCE(EXCLUDED.effective_date, customers.effective_date),
      next_payment = COALESCE(EXCLUDED.next_payment, customers.next_payment),
      total_contributions = EXCLUDED.total_contributions,
      total_amount_paid = EXCLUDED.total_amount_paid,
      has_bhxh = EXCLUDED.has_bhxh,
      has_bhyt = EXCLUDED.has_bhyt,
      next_payment_bhxh = EXCLUDED.next_payment_bhxh,
      next_payment_bhyt = EXCLUDED.next_payment_bhyt,
      updated_at = NOW();

    -- Cập nhật liên kết customerId vào các bản ghi mới chèn
    UPDATE public.records r
    SET "customerId" = c.id
    FROM public.customers c
    WHERE (r.customer_key = c.customer_key OR r."customerKey" = c.customer_key)
      AND r.id = ANY(v_inserted_ids)
      AND r."customerId" IS NULL;
  END IF;

  -- 5. GHI 1 DÒNG NHẬT KÝ TẬP TRUNG VÀO auditlogs
  IF v_uid IS NOT NULL THEN
    SELECT id, name INTO v_staff_id, v_staff_name
    FROM public.staff
    WHERE auth_user_id = v_uid
    LIMIT 1;

    IF v_staff_name IS NULL THEN
      v_staff_name := COALESCE(auth.jwt() ->> 'email', 'N/A');
      v_staff_id := v_uid::text;
    END IF;
  ELSE
    v_staff_id := 'SYSTEM_IMPORT';
    v_staff_name := 'Hệ thống Nhập Dữ liệu';
  END IF;

  INSERT INTO public.auditlogs (
    "userId", "userName", "action", "details", "timestamp"
  ) VALUES (
    v_staff_id,
    v_staff_name,
    'IMPORT_RECORDS_BATCH',
    'Nhập thành công lô dữ liệu ' || v_count || ' bản ghi từ [' || COALESCE(p_batch_name, 'Tập tin Excel') || ']',
    NOW()
  );

  -- 6. RESET CỜ SESSION VỀ MẶC ĐỊNH
  PERFORM set_config('app.is_batch_import', 'false', true);

  -- 7. TRẢ VỀ KẾT QUẢ CHI TIẾT
  RETURN jsonb_build_object(
    'success', true,
    'imported_count', v_count,
    'record_ids', to_jsonb(v_inserted_ids),
    'batch_name', p_batch_name
  );

EXCEPTION WHEN OTHERS THEN
  -- Luôn luôn giải phóng cờ session nếu có lỗi xảy ra
  PERFORM set_config('app.is_batch_import', 'false', true);
  RAISE;
END;
$$;

-- Phân quyền thực thi
REVOKE EXECUTE ON FUNCTION public.import_records_batch(JSONB, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_records_batch(JSONB, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
