-- supabase/migrations/20260823000008_enhance_public_lookup.sql
-- CẬP NHẬT TRA CỨU QUÁ TRÌNH THAM GIA ĐẦY ĐỦ CÁC CỘT DỮ LIỆU (KHẮC PHỤC LỖI CAST DATE EMPTY STRING)

DROP FUNCTION IF EXISTS public.public_lookup_process(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.public_lookup_process(p_code TEXT, p_type TEXT)
RETURNS TABLE (
  name TEXT,
  cccd TEXT,
  type TEXT,
  fromMonth TEXT,
  toMonth TEXT,
  months INTEGER,
  income NUMERIC,
  amount NUMERIC,
  nextPayment TEXT,
  status TEXT,
  paymentStatus TEXT,
  registration_date TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) !~ '^\d{9}$|^\d{10}$|^\d{12}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(r.name, ''),
    COALESCE(r.cccd, ''),
    COALESCE(r.type, ''),
    COALESCE(r."fromMonth", ''),
    COALESCE(r."toMonth", ''),
    COALESCE(r.months, 1),
    COALESCE(r.income, 0),
    COALESCE(r.amount, 0),
    COALESCE(r."nextPayment"::text, ''),
    COALESCE(r.status, 'Đang tham gia'),
    COALESCE(r."paymentStatus", ''),
    COALESCE(to_char(r.date, 'YYYY-MM-DD'), '') AS registration_date
  FROM public.records r
  WHERE r."paymentStatus" != 'Đã hủy'
    AND r.type = UPPER(TRIM(p_type))
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO service_role, anon, authenticated;

NOTIFY pgrst, 'reload schema';
