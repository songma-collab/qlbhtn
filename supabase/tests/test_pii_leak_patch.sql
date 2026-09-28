-- test_pii_leak_patch.sql
-- KIỂM THỬ BẢN VÁ 20260823000009_patch_public_pii_leak.sql
-- Chạy trong SQL Editor của Supabase SAU KHI đã áp dụng migration 000009.
-- Mục tiêu: đảm bảo lỗ hổng rò rỉ PII qua public_get_renewal_info /
-- public_lookup_process không thể tái diễn trong các thay đổi sau này.

DROP TABLE IF EXISTS temp_pii_patch_results;
CREATE TEMP TABLE temp_pii_patch_results (
  stt INT,
  hang_muc_kiem_thu TEXT,
  ket_qua TEXT,
  chi_tiet TEXT
);
GRANT ALL ON temp_pii_patch_results TO anon, authenticated, public;

DO $$
DECLARE
  v_row RECORD;
  v_call_count INTEGER;
BEGIN
  -- -------------------------------------------------------------------
  -- TEST A: ANON KHÔNG ĐƯỢC GỌI TRỰC TIẾP public_get_renewal_info
  -- (Đây chính là RPC đã rò rỉ full PII trước khi vá)
  -- -------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM * FROM public.public_get_renewal_info('012345678901', 'BHXH');

    RESET ROLE;
    INSERT INTO temp_pii_patch_results VALUES (
      1,
      'Chặn anon gọi trực tiếp public_get_renewal_info',
      '❌ FAIL — LỖ HỔNG PII ĐÃ TÁI DIỄN',
      'Vai trò anon vẫn gọi được RPC trả về full PII (name, cccd, phone, dob, address, email).'
    );
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO temp_pii_patch_results VALUES (
      1,
      'Chặn anon gọi trực tiếp public_get_renewal_info',
      '✅ PASS',
      'Bị từ chối đúng như kỳ vọng: ' || SQLERRM
    );
  END;

  RESET ROLE;

  -- -------------------------------------------------------------------
  -- TEST B: public_lookup_process PHẢI TRẢ VỀ TÊN/CCCD ĐÃ CHE (MASKED),
  -- KHÔNG ĐƯỢC TRẢ PLAINTEXT
  -- -------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE anon;

    SELECT * INTO v_row FROM public.public_lookup_process('012345678901', 'BHXH') LIMIT 1;

    RESET ROLE;

    IF v_row IS NULL THEN
      INSERT INTO temp_pii_patch_results VALUES (
        2,
        'public_lookup_process trả về dữ liệu đã che (masked)',
        'ℹ️ SKIP',
        'Không có bản ghi mẫu khớp mã 012345678901 để kiểm tra — hãy chạy lại với mã CCCD/BHXH có thật trong dữ liệu test.'
      );
    ELSIF v_row.masked_name IS NULL OR v_row.masked_cccd IS NULL THEN
      INSERT INTO temp_pii_patch_results VALUES (
        2,
        'public_lookup_process trả về dữ liệu đã che (masked)',
        '❌ FAIL',
        'Không tìm thấy cột masked_name/masked_cccd trong kết quả trả về — có thể đã bị ghi đè bằng bản không che PII.'
      );
    ELSE
      INSERT INTO temp_pii_patch_results VALUES (
        2,
        'public_lookup_process trả về dữ liệu đã che (masked)',
        '✅ PASS',
        'masked_name = ' || v_row.masked_name || ', masked_cccd = ' || v_row.masked_cccd
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO temp_pii_patch_results VALUES (
      2,
      'public_lookup_process trả về dữ liệu đã che (masked)',
      '❌ FAIL',
      'Lỗi ngoại lệ: ' || SQLERRM
    );
  END;

  RESET ROLE;

  -- -------------------------------------------------------------------
  -- TEST C: RATE-LIMIT CHẶN VÉT CẠN (BRUTE-FORCE) SAU NGƯỠNG CHO PHÉP
  -- -------------------------------------------------------------------
  BEGIN
    SET LOCAL ROLE anon;
    v_call_count := 0;

    FOR i IN 1..15 LOOP
      BEGIN
        PERFORM * FROM public.public_lookup_process(lpad(i::text, 12, '0'), 'BHXH');
        v_call_count := v_call_count + 1;
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE 'RATE_LIMIT_EXCEEDED%' THEN
          EXIT;
        ELSE
          RAISE;
        END IF;
      END;
    END LOOP;

    RESET ROLE;

    IF v_call_count >= 15 THEN
      INSERT INTO temp_pii_patch_results VALUES (
        3,
        'Rate-limit chặn vét cạn (brute-force) public_lookup_process',
        '❌ FAIL',
        'Gọi được 15/15 lần liên tiếp mà không bị chặn — thiếu bảo vệ chống brute-force.'
      );
    ELSE
      INSERT INTO temp_pii_patch_results VALUES (
        3,
        'Rate-limit chặn vét cạn (brute-force) public_lookup_process',
        '✅ PASS',
        'Bị chặn sau ' || v_call_count || ' lượt gọi (ngưỡng cấu hình: 10 lượt/giờ/IP).'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO temp_pii_patch_results VALUES (
      3,
      'Rate-limit chặn vét cạn (brute-force) public_lookup_process',
      '❌ FAIL',
      'Lỗi ngoại lệ không mong đợi: ' || SQLERRM
    );
  END;

  RESET ROLE;
END $$;

SELECT * FROM temp_pii_patch_results ORDER BY stt;
