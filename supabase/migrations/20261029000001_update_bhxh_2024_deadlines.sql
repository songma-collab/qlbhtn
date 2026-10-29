-- ======================================================================
-- BẢN VÁ: CẬP NHẬT HẠN ĐÓNG TIẾP THEO KHOẢN 3 ĐIỀU 36 LUẬT BHXH 2024
-- ======================================================================
-- Quy định thời hạn đóng BHXH Tự nguyện (có hiệu lực từ 01/07/2025):
-- 1. Đóng hằng tháng: Ngày cuối cùng của tháng đó.
-- 2. Đóng 3 tháng một lần: Ngày cuối cùng của 3 tháng đó.
-- 3. Đóng 6 tháng một lần: Ngày cuối cùng của 4 tháng đầu kỳ.
-- 4. Đóng 12 tháng một lần: Ngày cuối cùng của 7 tháng đầu kỳ.
-- BHYT: Hạn đóng tiếp là ngày cuối cùng của tháng hết hạn thẻ (to_month).

CREATE OR REPLACE FUNCTION public.calculate_bhxh_2024_next_payment(
  p_to_month TEXT,
  p_months INT DEFAULT 1,
  p_type TEXT DEFAULT 'BHXH'
) RETURNS DATE AS $$
DECLARE
  v_parts TEXT[];
  v_m INT;
  v_y INT;
  v_base_date DATE;
  v_offset INT;
  v_next_period_start DATE;
  v_target_month DATE;
BEGIN
  IF p_to_month IS NULL OR TRIM(p_to_month) = '' THEN
    RETURN NULL;
  END IF;

  -- Phân tích định dạng MM/YYYY hoặc YYYY-MM
  IF p_to_month LIKE '%/%' THEN
    v_parts := string_to_array(p_to_month, '/');
    v_m := v_parts[1]::INT;
    v_y := v_parts[2]::INT;
  ELSIF p_to_month LIKE '%-%' THEN
    v_parts := string_to_array(p_to_month, '-');
    v_y := v_parts[1]::INT;
    v_m := v_parts[2]::INT;
  ELSE
    RETURN NULL;
  END IF;

  IF v_m < 1 OR v_m > 12 OR v_y < 1900 OR v_y > 2100 THEN
    RETURN NULL;
  END IF;

  v_base_date := make_date(v_y, v_m, 1);

  -- Đối với BHYT: Hạn chót là ngày cuối cùng của tháng kết thúc thẻ
  IF UPPER(COALESCE(p_type, '')) = 'BHYT' THEN
    RETURN (v_base_date + INTERVAL '1 month - 1 day')::DATE;
  END IF;

  -- Đối với BHXH Tự Nguyện: Kỳ tiếp theo bắt đầu từ tháng liền kề sau to_month
  v_next_period_start := (v_base_date + INTERVAL '1 month')::DATE;

  IF COALESCE(p_months, 1) >= 12 THEN
    v_offset := 6; -- Trong vòng 7 tháng đầu kỳ (offset 6 tháng)
  ELSIF COALESCE(p_months, 1) >= 6 THEN
    v_offset := 3; -- Trong vòng 4 tháng đầu kỳ (offset 3 tháng)
  ELSIF COALESCE(p_months, 1) >= 3 THEN
    v_offset := 2; -- Trong vòng 3 tháng đó (offset 2 tháng)
  ELSE
    v_offset := 0; -- Trong tháng đó (offset 0 tháng)
  END IF;

  v_target_month := (v_next_period_start + (v_offset || ' month')::INTERVAL)::DATE;
  RETURN (v_target_month + INTERVAL '1 month - 1 day')::DATE;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Cho phép authenticated và service_role thực thi
GRANT EXECUTE ON FUNCTION public.calculate_bhxh_2024_next_payment(TEXT, INT, TEXT) TO authenticated, service_role;

-- Cập nhật hồi tố dữ liệu lịch sử trên bảng records
UPDATE public.records
SET next_payment = public.calculate_bhxh_2024_next_payment(to_month, COALESCE(months, 1), type)
WHERE to_month IS NOT NULL AND TRIM(to_month) != '';

-- Đồng bộ lại trường next_payment trên bảng customers
UPDATE public.customers c
SET 
  next_payment = sub.latest_next_payment,
  next_payment_bhxh = sub.latest_next_payment_bhxh,
  next_payment_bhyt = sub.latest_next_payment_bhyt
FROM (
  SELECT 
    customer_id,
    MAX(next_payment) as latest_next_payment,
    MAX(CASE WHEN type = 'BHXH' THEN next_payment ELSE NULL END) as latest_next_payment_bhxh,
    MAX(CASE WHEN type = 'BHYT' THEN next_payment ELSE NULL END) as latest_next_payment_bhyt
  FROM public.records
  WHERE payment_status != 'Đã hủy' AND customer_id IS NOT NULL
  GROUP BY customer_id
) sub
WHERE c.id = sub.customer_id;
