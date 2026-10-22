-- test_ledger_and_master_data_p1.sql
-- KỊCH BẢN KIỂM THỬ TỰ ĐỘNG GIAI ĐOẠN 2 (P1: SỔ CÁI TÀI CHÍNH & TOÀN VẸN MASTER DATA)
-- Chạy trực tiếp trong SQL Editor của Supabase để kiểm tra kết quả

DROP TABLE IF EXISTS temp_p1_test_results;
CREATE TEMP TABLE temp_p1_test_results (
  stt INT,
  hang_muc_kiem_thu TEXT,
  ket_qua TEXT,
  chi_tiet TEXT
);
GRANT ALL ON temp_p1_test_results TO anon, authenticated, public, service_role;

DO $$
DECLARE
  v_rec_id BIGINT;
  v_del_rec_id BIGINT;
  v_cust_key TEXT := 'TEST_CUST_P1_999999';
  v_cust RECORD;
  v_ledger_entry RECORD;
  v_prev_balance NUMERIC := 0;
  v_import_res JSONB;
BEGIN
  -- -------------------------------------------------------------------
  -- TEST 1: KIỂM TRA ĐỒNG BỘ BÚT TOÁN THU TIỀN VÀO SỔ CÁI FINANCIAL_LEDGER
  -- -------------------------------------------------------------------
  BEGIN
    SELECT COALESCE(balance, 0) INTO v_prev_balance
    FROM public.financial_ledger
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    INSERT INTO public.records (
      name, cccd, phone, type, payment_status, amount, date, customer_key
    ) VALUES (
      'Khách Hàng Test Sổ Cái', '012345999999', '0912999999', 'BHXH', 'Đã thu tiền', 1500000, NOW(), v_cust_key
    ) RETURNING id INTO v_rec_id;

    SELECT * INTO v_ledger_entry
    FROM public.financial_ledger
    WHERE record_id = v_rec_id;

    IF v_ledger_entry.id IS NOT NULL 
       AND v_ledger_entry.transaction_type = 'THU_TIEN' 
       AND v_ledger_entry.credit_amount = 1500000 
       AND v_ledger_entry.balance = v_prev_balance + 1500000 THEN
      INSERT INTO temp_p1_test_results VALUES (
        1,
        'Ghi sổ cái tự động khi hồ sơ Đã thu tiền (THU_TIEN)',
        '✅ PASS',
        format('Đã ghi nhận bút toán THU_TIEN +1,500,000 VNĐ, số dư mới = %s VNĐ', v_ledger_entry.balance)
      );
    ELSE
      INSERT INTO temp_p1_test_results VALUES (
        1,
        'Ghi sổ cái tự động khi hồ sơ Đã thu tiền (THU_TIEN)',
        '❌ FAIL',
        'Bút toán không được ghi nhận hoặc số dư lũy kế tính sai.'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO temp_p1_test_results VALUES (
      1,
      'Ghi sổ cái tự động khi hồ sơ Đã thu tiền (THU_TIEN)',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

  -- -------------------------------------------------------------------
  -- TEST 2: KIỂM TRA TỰ ĐỘNG BÙ BÚT TOÁN HOÀN TIỀN KHI XÓA HỒ SƠ ĐÃ THU (AFTER DELETE)
  -- -------------------------------------------------------------------
  BEGIN
    SELECT COALESCE(balance, 0) INTO v_prev_balance
    FROM public.financial_ledger
    ORDER BY created_at DESC, id DESC
    LIMIT 1;

    -- Xóa hồ sơ vừa tạo
    DELETE FROM public.records WHERE id = v_rec_id;

    -- Kiểm tra xem trigger có sinh bút toán HOAN_TIEN bù trừ không
    SELECT * INTO v_ledger_entry
    FROM public.financial_ledger
    WHERE transaction_type = 'HOAN_TIEN'
      AND debit_amount = 1500000
      AND reference_id = 'DEL_REC_' || v_rec_id::text;

    IF v_ledger_entry.id IS NOT NULL AND v_ledger_entry.balance = v_prev_balance - 1500000 THEN
      INSERT INTO temp_p1_test_results VALUES (
        2,
        'Tự động sinh bút toán HOAN_TIEN khi xóa hồ sơ đã thu tiền (AFTER DELETE)',
        '✅ PASS',
        format('Bút toán HOAN_TIEN bù trừ -1,500,000 VNĐ đã được tạo tự động, số dư mới = %s VNĐ', v_ledger_entry.balance)
      );
    ELSE
      INSERT INTO temp_p1_test_results VALUES (
        2,
        'Tự động sinh bút toán HOAN_TIEN khi xóa hồ sơ đã thu tiền (AFTER DELETE)',
        '❌ FAIL',
        'Không tìm thấy bút toán bù trừ HOAN_TIEN hoặc số dư sau xóa tính sai.'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO temp_p1_test_results VALUES (
      2,
      'Tự động sinh bút toán HOAN_TIEN khi xóa hồ sơ đã thu tiền (AFTER DELETE)',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

  -- -------------------------------------------------------------------
  -- TEST 3: ĐỒNG BỘ KHÁCH HÀNG THAM GIA CẢ HAI LOẠI HÌNH (BHXH + BHYT)
  -- -------------------------------------------------------------------
  BEGIN
    -- Tạo 1 hợp đồng BHXH
    INSERT INTO public.records (
      name, cccd, phone, type, payment_status, amount, date, next_payment, customer_key
    ) VALUES (
      'Nguyễn Văn Song Hành', '012345888888', '0912888888', 'BHXH', 'Đã thu tiền', 1500000, '2026-01-01', '2027-01-01', 'CUST_CCCD_012345888888'
    );

    -- Tạo thêm 1 hợp đồng BHYT cho cùng khách hàng
    INSERT INTO public.records (
      name, cccd, phone, type, payment_status, amount, date, next_payment, customer_key
    ) VALUES (
      'Nguyễn Văn Song Hành', '012345888888', '0912888888', 'BHYT', 'Đã thu tiền', 1200000, '2026-03-01', '2027-03-01', 'CUST_CCCD_012345888888'
    );

    SELECT * INTO v_cust
    FROM public.customers
    WHERE customer_key = 'CUST_CCCD_012345888888';

    IF v_cust.type = 'CẢ HAI' 
       AND v_cust.has_bhxh = true 
       AND v_cust.has_bhyt = true 
       AND v_cust.next_payment_bhxh = '2027-01-01' 
       AND v_cust.next_payment_bhyt = '2027-03-01'
       AND v_cust.next_payment = '2027-01-01' THEN
      INSERT INTO temp_p1_test_results VALUES (
        3,
        'Khách hàng tham gia 2 loại hình được gán chuẩn type = CẢ HAI và tách biệt hạn nộp',
        '✅ PASS',
        format('Loại hình: %s, has_bhxh=%s, has_bhyt=%s, Hạn BHXH: %s, Hạn BHYT: %s, Hạn sớm nhất: %s', 
          v_cust.type, v_cust.has_bhxh, v_cust.has_bhyt, v_cust.next_payment_bhxh, v_cust.next_payment_bhyt, v_cust.next_payment)
      );
    ELSE
      INSERT INTO temp_p1_test_results VALUES (
        3,
        'Khách hàng tham gia 2 loại hình được gán chuẩn type = CẢ HAI và tách biệt hạn nộp',
        '❌ FAIL',
        format('Dữ liệu không khớp: type=%s, has_bhxh=%s, has_bhyt=%s', v_cust.type, v_cust.has_bhxh, v_cust.has_bhyt)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO temp_p1_test_results VALUES (
      3,
      'Khách hàng tham gia 2 loại hình được gán chuẩn type = CẢ HAI và tách biệt hạn nộp',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

  -- -------------------------------------------------------------------
  -- TEST 4: CHỐNG THOÁI THU ĐÈ SỐ ÂM LÊN LATEST_AMOUNT TRONG MASTER DATA
  -- -------------------------------------------------------------------
  BEGIN
    -- Tạo một giao dịch thoái thu âm tiền (-500,000)
    INSERT INTO public.records (
      name, cccd, phone, type, action_type, is_adjustment, payment_status, amount, date, customer_key
    ) VALUES (
      'Nguyễn Văn Song Hành', '012345888888', '0912888888', 'BHXH', 'Thoái thu', true, 'Đã thu tiền', -500000, NOW(), 'CUST_CCCD_012345888888'
    );

    SELECT * INTO v_cust
    FROM public.customers
    WHERE customer_key = 'CUST_CCCD_012345888888';

    IF v_cust.latest_amount > 0 AND v_cust.total_amount_paid = (1500000 + 1200000 - 500000) THEN
      INSERT INTO temp_p1_test_results VALUES (
        4,
        'Chống thoái thu đè số âm lên latest_amount và tính đúng đại số total_amount_paid',
        '✅ PASS',
        format('latest_amount = %s VNĐ (> 0), total_amount_paid = %s VNĐ (đã trừ 500,000 VNĐ thoái thu)', v_cust.latest_amount, v_cust.total_amount_paid)
      );
    ELSE
      INSERT INTO temp_p1_test_results VALUES (
        4,
        'Chống thoái thu đè số âm lên latest_amount và tính đúng đại số total_amount_paid',
        '❌ FAIL',
        format('latest_amount = %s, total_amount_paid = %s', v_cust.latest_amount, v_cust.total_amount_paid)
      );
    END IF;

    -- Dọn dẹp dữ liệu test của Nguyễn Văn Song Hành
    DELETE FROM public.records WHERE customer_key = 'CUST_CCCD_012345888888';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO temp_p1_test_results VALUES (
      4,
      'Chống thoái thu đè số âm lên latest_amount và tính đúng đại số total_amount_paid',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

  -- -------------------------------------------------------------------
  -- TEST 5: IMPORT_RECORDS_BATCH TỰ ĐỘNG ĐỒNG BỘ KHÁCH HÀNG VÀO CUSTOMERS
  -- -------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE postgres; -- Quyền admin chạy import

    v_import_res := public.import_records_batch(
      jsonb_build_array(
        jsonb_build_object(
          'name', 'Lò Văn Import Test',
          'cccd', '012345777777',
          'phone', '0912777777',
          'type', 'BHXH',
          'amount', 1800000,
          'months', 12,
          'payment_status', 'Đã thu tiền'
        )
      ),
      'BATCH_TEST_P1'
    );

    IF EXISTS (SELECT 1 FROM public.customers WHERE cccd = '012345777777' AND name = 'Lò Văn Import Test') THEN
      INSERT INTO temp_p1_test_results VALUES (
        5,
        'import_records_batch tự động đồng bộ Master Data khách hàng sau import',
        '✅ PASS',
        'Khách hàng trong file import đã ngay lập tức xuất hiện trong bảng customers (Master Data).'
      );
    ELSE
      INSERT INTO temp_p1_test_results VALUES (
        5,
        'import_records_batch tự động đồng bộ Master Data khách hàng sau import',
        '❌ FAIL',
        'Khách hàng không được tạo trong bảng customers sau khi import.'
      );
    END IF;

    -- Dọn dẹp dữ liệu test Lò Văn Import Test
    DELETE FROM public.records WHERE cccd = '012345777777';
    DELETE FROM public.customers WHERE cccd = '012345777777';
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO temp_p1_test_results VALUES (
      5,
      'import_records_batch tự động đồng bộ Master Data khách hàng sau import',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

END;
$$;

SELECT stt, hang_muc_kiem_thu, ket_qua, chi_tiet FROM temp_p1_test_results ORDER BY stt;
