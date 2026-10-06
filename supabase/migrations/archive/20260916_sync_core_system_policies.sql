-- ======================================================================
-- MIGRATION: ĐỒNG BỘ VÀ NẠP 5 NHÓM THAM SỐ CHÍNH SÁCH CỐT LÕI VÀO BẢNG POLICIES
-- 1. Mức lương cơ sở (NĐ 73/2024, NĐ 161/2026)
-- 2. Chuẩn nghèo nông thôn (NĐ 07/2021/NĐ-CP)
-- 3. Cài đặt Tỷ lệ Hoa hồng đại lý (QĐ 11/QĐ-BHXH, QĐ điều chỉnh 2026)
-- 4. Lãi suất đầu tư quỹ (0.31%/tháng)
-- 5. Hệ số trượt giá (JSON BHXH 2025, 2026)
-- ======================================================================

-- 1. Đảm bảo cấu trúc cột description và notes đồng bộ
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS created_by TEXT;
UPDATE public.policies SET notes = description WHERE notes IS NULL AND description IS NOT NULL;
UPDATE public.policies SET description = notes WHERE description IS NULL AND notes IS NOT NULL;

-- 2. Nạp dữ liệu 8 quyết định / chính sách cốt lõi nếu chưa tồn tại
-- 2.1. Mức lương cơ sở: NĐ 73/2024 (2.340.000đ)
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'base_salary', 'Nghị định 73/2024/NĐ-CP', '2340000'::jsonb, '2024-07-01'::date, false, 
       'Quy định mức lương cơ sở đối với cán bộ, công chức, viên chức và lực lượng vũ trang (2.340.000 đồng/tháng)',
       'Quy định mức lương cơ sở đối với cán bộ, công chức, viên chức và lực lượng vũ trang (2.340.000 đồng/tháng)'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'base_salary' AND name = 'Nghị định 73/2024/NĐ-CP'
);

-- 2.2. Mức lương cơ sở: NĐ 161/2026 (2.530.000đ)
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'base_salary', 'Nghị định số 161/2026/NĐ-CP', '2530000'::jsonb, '2026-07-01'::date, true, 
       'NĐ 161/2026/NĐ-CP ngày 15/5/2026 quy định mức lương cơ sở mới và chế độ tiền thưởng (2.530.000 đồng/tháng)',
       'NĐ 161/2026/NĐ-CP ngày 15/5/2026 quy định mức lương cơ sở mới và chế độ tiền thưởng (2.530.000 đồng/tháng)'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'base_salary' AND name = 'Nghị định số 161/2026/NĐ-CP'
);

-- 2.3. Chuẩn nghèo nông thôn: NĐ 07/2021/NĐ-CP (1.500.000đ)
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'poverty_standard', 'Chuẩn nghèo nông thôn 2026', '1500000'::jsonb, '2026-01-01'::date, true, 
       'Điều 3 Nghị định 07/2021/NĐ-CP quy định chuẩn nghèo đa chiều giai đoạn 2022-2025 và áp dụng 2026 (1.500.000 đồng/tháng)',
       'Điều 3 Nghị định 07/2021/NĐ-CP quy định chuẩn nghèo đa chiều giai đoạn 2022-2025 và áp dụng 2026 (1.500.000 đồng/tháng)'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'poverty_standard' AND name = 'Chuẩn nghèo nông thôn 2026'
);

-- 2.4. Tỷ lệ Hoa hồng: Quyết định 11/QĐ-BHXH (Cũ)
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'commission', 'Quyết định 11/QĐ-BHXH (Cũ)', '{"commBHXHNew": 5, "commBHYTNew": 5, "commBHXHRenew": 3, "commBHYTRenew": 3}'::jsonb, '2026-01-01'::date, false, 
       'Quyết định 11/QĐ-BHXH mức chi thù lao đại lý: BHXH mới 5%, gia hạn 3%; BHYT mới 5%, gia hạn 3%',
       'Quyết định 11/QĐ-BHXH mức chi thù lao đại lý: BHXH mới 5%, gia hạn 3%; BHYT mới 5%, gia hạn 3%'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'commission' AND name = 'Quyết định 11/QĐ-BHXH (Cũ)'
);

-- 2.5. Tỷ lệ Hoa hồng: Cài đặt Tỷ lệ Hoa hồng đại lý 2026
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'commission', 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026', '{"commBHXHNew": 15, "commBHYTNew": 9, "commBHXHRenew": 9, "commBHYTRenew": 5}'::jsonb, '2026-08-01'::date, true, 
       'Cơ chế tỷ lệ hoa hồng đại lý mới áp dụng từ tháng 08/2026: BHXH mới 15%, gia hạn 9%; BHYT mới 9%, gia hạn 5%',
       'Cơ chế tỷ lệ hoa hồng đại lý mới áp dụng từ tháng 08/2026: BHXH mới 15%, gia hạn 9%; BHYT mới 9%, gia hạn 5%'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'commission' AND name = 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026'
);

-- 2.6. Lãi suất đầu tư quỹ: 0.31%/tháng
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'investment_rate', 'Quyết định điều chỉnh Lãi suất đầu tư quỹ 2026', '0.31'::jsonb, '2026-01-01'::date, true, 
       'Công văn 151/BHXH-ĐTQ và Công văn 59/TB-BHXH lãi suất đầu tư quỹ 0.31%/tháng',
       'Công văn 151/BHXH-ĐTQ và Công văn 59/TB-BHXH lãi suất đầu tư quỹ 0.31%/tháng'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'investment_rate' AND name = 'Quyết định điều chỉnh Lãi suất đầu tư quỹ 2026'
);

-- 2.7. Hệ số trượt giá: Thông tư 01/2025/TT-BLĐTBXH
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'cpi_index', 'Thông tư điều chỉnh Hệ số trượt giá (JSON BHXH) 2025', 
       '{"1994": 5.81, "1995": 4.91, "1996": 4.65, "1997": 4.5, "1998": 4.18, "1999": 4.01, "2000": 4.07, "2001": 4.09, "2002": 3.94, "2003": 3.81, "2004": 3.54, "2005": 3.27, "2006": 3.05, "2007": 2.81, "2008": 2.29, "2009": 2.14, "2010": 1.96, "2011": 1.65, "2012": 1.51, "2013": 1.42, "2014": 1.36, "2015": 1.36, "2016": 1.32, "2017": 1.28, "2018": 1.23, "2019": 1.2, "2020": 1.16, "2021": 1.14, "2022": 1.11, "2023": 1.07, "2024": 1.03, "2025": 1}'::jsonb, 
       '2025-01-01'::date, false, 
       'Thông tư số 01/2025/TT-BLĐTBXH ngày 10/1/2025 điều chỉnh tiền lương và thu nhập đã đóng BHXH',
       'Thông tư số 01/2025/TT-BLĐTBXH ngày 10/1/2025 điều chỉnh tiền lương và thu nhập đã đóng BHXH'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'cpi_index' AND name = 'Thông tư điều chỉnh Hệ số trượt giá (JSON BHXH) 2025'
);

-- 2.8. Hệ số trượt giá: Công văn 340/BHXH-CSXH 2026
INSERT INTO public.policies (parameter_type, name, value, effective_date, is_active, notes, description)
SELECT 'cpi_index', 'Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026', 
       '{"1994": 5.81, "1995": 4.91, "1996": 4.65, "1997": 4.5, "1998": 4.18, "1999": 4.01, "2000": 4.07, "2001": 4.09, "2002": 3.94, "2003": 3.81, "2004": 3.54, "2005": 3.27, "2006": 3.05, "2007": 2.81, "2008": 2.29, "2009": 2.14, "2010": 1.96, "2011": 1.65, "2012": 1.51, "2013": 1.42, "2014": 1.36, "2015": 1.36, "2016": 1.32, "2017": 1.28, "2018": 1.23, "2019": 1.2, "2020": 1.16, "2021": 1.14, "2022": 1.11, "2023": 1.07, "2024": 1.03, "2025": 1, "2026": 1}'::jsonb, 
       '2026-01-01'::date, true, 
       'Hệ số trượt giá năm 2026 theo Công văn 340/BHXH-CSXH',
       'Hệ số trượt giá năm 2026 theo Công văn 340/BHXH-CSXH'
WHERE NOT EXISTS (
  SELECT 1 FROM public.policies WHERE parameter_type = 'cpi_index' AND name = 'Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026'
);

-- 3. Tạo RPC sync_system_policies để client có thể gọi đồng bộ an toàn
CREATE OR REPLACE FUNCTION public.sync_system_policies(p_policies JSONB DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_count INT := 0;
  v_existing_id BIGINT;
BEGIN
  IF p_policies IS NOT NULL AND jsonb_array_length(p_policies) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_policies)
    LOOP
      SELECT id INTO v_existing_id
      FROM public.policies
      WHERE parameter_type = (v_item->>'parameter_type')
        AND name = (v_item->>'name')
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        UPDATE public.policies
        SET value = v_item->'value',
            effective_date = (v_item->>'effective_date')::date,
            is_active = COALESCE((v_item->>'is_active')::boolean, true),
            notes = COALESCE(v_item->>'notes', v_item->>'description', ''),
            description = COALESCE(v_item->>'description', v_item->>'notes', '')
        WHERE id = v_existing_id;
      ELSE
        INSERT INTO public.policies (name, parameter_type, value, effective_date, is_active, notes, description)
        VALUES (
          v_item->>'name',
          v_item->>'parameter_type',
          v_item->'value',
          (v_item->>'effective_date')::date,
          COALESCE((v_item->>'is_active')::boolean, true),
          COALESCE(v_item->>'notes', v_item->>'description', ''),
          COALESCE(v_item->>'description', v_item->>'notes', '')
        );
      END IF;
      v_count := v_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'synced_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_system_policies(JSONB) TO anon, authenticated, service_role;
