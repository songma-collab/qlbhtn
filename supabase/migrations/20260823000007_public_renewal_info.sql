-- supabase/migrations/20260823000007_public_renewal_info.sql
-- GIAI ĐOẠN HOÀN THIỆN: HỖ TRỢ GIA HẠN NHANH ĐẦY ĐỦ THÔNG TIN HỢP ĐỒNG GẦN NHẤT

CREATE OR REPLACE FUNCTION public.public_get_renewal_info(p_code TEXT, p_type TEXT)
RETURNS TABLE (
  name TEXT,
  cccd TEXT,
  phone TEXT,
  bhxh TEXT,
  dob DATE,
  gender TEXT,
  nation TEXT,
  email TEXT,
  address TEXT,
  type TEXT,
  method TEXT,
  months INTEGER,
  income NUMERIC,
  fromMonth TEXT,
  toMonth TEXT,
  notes TEXT,
  recvName TEXT,
  recvPhone TEXT,
  recvAddress TEXT,
  members JSONB
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
    r.name,
    r.cccd,
    r.phone,
    r.bhxh,
    r.dob,
    r.gender,
    r.nation,
    r.email,
    r.address,
    r.type,
    r.method,
    r.months,
    r.income,
    r."fromMonth",
    r."toMonth",
    r.notes,
    r."recvName",
    r."recvPhone",
    r."recvAddress",
    r.members
  FROM public.records r
  WHERE r."paymentStatus" != 'Đã hủy'
    AND r.type = UPPER(TRIM(p_type))
    AND (
      (r.bhxh = TRIM(p_code) AND r.bhxh IS NOT NULL AND r.bhxh != '') OR 
      (r.cccd = TRIM(p_code) AND r.cccd IS NOT NULL AND r.cccd != '')
    )
  ORDER BY r.date DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) TO service_role, anon, authenticated;

NOTIFY pgrst, 'reload schema';
