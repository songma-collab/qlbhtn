-- ======================================================================
-- Migration 000013: Cập nhật View CRM_CUSTOMERS và Cấp quyền SELECT
-- ======================================================================

DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers AS
SELECT DISTINCT ON (COALESCE(NULLIF(r.bhxh, ''), r.cccd, r.name))
    r.*
FROM public.records r
WHERE r."paymentStatus" != 'Đã hủy'
ORDER BY COALESCE(NULLIF(r.bhxh, ''), r.cccd, r.name), r.date DESC;

GRANT SELECT ON public.crm_customers TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
