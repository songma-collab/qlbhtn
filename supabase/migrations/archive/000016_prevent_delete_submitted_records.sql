-- ======================================================================
-- MIGRATION 000016: NGĂN CHẶN XÓA CÁC HỒ SƠ ĐÃ CHUYỂN BHXH
-- Mục tiêu: Bảo vệ toàn vẹn dữ liệu, chặn mọi hành vi xóa giao dịch
-- khi đã được tích "Đã chuyển BHXH".
-- ======================================================================

CREATE OR REPLACE FUNCTION public.prevent_delete_submitted_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF OLD."isSubmittedBHXH" = TRUE THEN
        -- Nếu là Admin override khẩn cấp thì cho phép, ngược lại chặn hoàn toàn
        IF current_setting('app.is_admin_override', true) IS DISTINCT FROM 'true' THEN
            RAISE EXCEPTION 'Bảo vệ dữ liệu: Giao dịch của khách hàng "%" (Mã số %) ĐÃ CHUYỂN BHXH. Thao tác xóa bị từ chối!', OLD.name, OLD.id
                USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_delete_submitted_records ON public.records;
CREATE TRIGGER trigger_prevent_delete_submitted_records
BEFORE DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_submitted_records();
