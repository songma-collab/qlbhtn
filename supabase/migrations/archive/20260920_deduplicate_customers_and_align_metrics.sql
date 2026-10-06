-- ======================================================================
-- BẢN VÁ: HỢP NHẤT VÀ LÀM SẠCH BẢN GHI TRÙNG LẶP TRONG BẢNG CUSTOMERS
-- Ngày cập nhật: 20/09/2026
-- Mục tiêu: 
-- 1. Khắc phục hiện tượng bảng public.customers tăng lên 2,931 bản ghi do tồn tại
--    song song cả 2 định dạng khóa định danh:
--    - Khóa cũ (000015): 'BHXH_BHXH_...' / 'BHYT_BHXH_...'
--    - Khóa mới chuẩn hóa: 'CUST_CCCD_...' / 'CUST_BHXH_...'
-- 2. Đưa số lượng khách hàng về chuẩn xác 100% tương ứng với số người tham gia.
-- ======================================================================

BEGIN;

-- 1. TẠM TẮT TRIGGER TRÊN BẢNG CUSTOMERS VÀ RECORDS ĐỂ THỰC HIỆN DỌN DẸP AN TOÀN
ALTER TABLE public.records DISABLE TRIGGER ALL;
ALTER TABLE public.customers DISABLE TRIGGER ALL;

-- 2. HỢP NHẤT DỮ LIỆU TÀI CHÍNH TỪ KHÓA CŨ SANG KHÓA MỚI TRƯỚC KHI XÓA
-- Chuyển số lần đóng (total_contributions) và số tiền đóng (total_amount_paid) nếu bản ghi mới chưa có
UPDATE public.customers new_c
SET 
    total_contributions = GREATEST(new_c.total_contributions, old_c.total_contributions),
    total_amount_paid = GREATEST(new_c.total_amount_paid, old_c.total_amount_paid),
    old_bhxh = COALESCE(new_c.old_bhxh, old_c.old_bhxh),
    address = COALESCE(new_c.address, old_c.address),
    dob = COALESCE(new_c.dob, old_c.dob),
    gender = COALESCE(new_c.gender, old_c.gender),
    status = CASE 
        WHEN new_c.status = 'Đã dừng đóng' OR old_c.status = 'Đã dừng đóng' THEN 'Đã dừng đóng'
        ELSE COALESCE(new_c.status, old_c.status, 'Đang tham gia')
    END,
    updated_at = NOW()
FROM public.customers old_c
WHERE (old_c.customer_key LIKE 'BHXH_%' OR old_c.customer_key LIKE 'BHYT_%')
  AND new_c.customer_key LIKE 'CUST_%'
  AND new_c.id != old_c.id
  AND (
    (new_c.cccd IS NOT NULL AND TRIM(new_c.cccd) != '' AND new_c.cccd = old_c.cccd)
    OR
    (new_c.bhxh IS NOT NULL AND TRIM(new_c.bhxh) != '' AND new_c.bhxh = old_c.bhxh)
  );

-- 3. XÓA BỎ CÁC BẢN GHI TRÙNG LẶP MANG KHÓA CŨ (BHXH_BHXH_... HOẶC BHYT_BHXH_...)
DELETE FROM public.customers old_c
WHERE (old_c.customer_key LIKE 'BHXH_%' OR old_c.customer_key LIKE 'BHYT_%')
  AND EXISTS (
      SELECT 1 FROM public.customers new_c
      WHERE new_c.id != old_c.id
        AND new_c.customer_key LIKE 'CUST_%'
        AND (
          (new_c.cccd IS NOT NULL AND TRIM(new_c.cccd) != '' AND new_c.cccd = old_c.cccd)
          OR
          (new_c.bhxh IS NOT NULL AND TRIM(new_c.bhxh) != '' AND new_c.bhxh = old_c.bhxh)
        )
  );

-- 4. CHUẨN HÓA CÁC BẢN GHI CÒN SÓT LẠI MANG KHÓA CŨ SANG ĐỊNH DẠNG KHÓA MỚI (CUST_...)
UPDATE public.customers c
SET 
    customer_key = public.generate_customer_key(c.type, c.bhxh, c.cccd, c.name, c.phone),
    updated_at = NOW()
WHERE (c.customer_key LIKE 'BHXH_%' OR c.customer_key LIKE 'BHYT_%')
  AND NOT EXISTS (
      SELECT 1 FROM public.customers exist_c
      WHERE exist_c.customer_key = public.generate_customer_key(c.type, c.bhxh, c.cccd, c.name, c.phone)
        AND exist_c.id != c.id
  );

-- 5. ĐỒNG BỘ LẠI CUSTOMER_KEY VÀ CUSTOMER_ID TRÊN BẢNG RECORDS ĐỂ TOÀN VẸN 100%
UPDATE public.records r
SET 
    customer_key = c.customer_key,
    customer_id = c.id
FROM public.customers c
WHERE (
    (c.cccd IS NOT NULL AND TRIM(c.cccd) != '' AND c.cccd = r.cccd)
    OR
    (c.bhxh IS NOT NULL AND TRIM(c.bhxh) != '' AND c.bhxh = r.bhxh)
)
AND (r.customer_key IS NULL OR r.customer_key != c.customer_key OR r.customer_id IS NULL OR r.customer_id != c.id);

-- 6. TÁI KÍCH HOẠT TRIGGER HỆ THỐNG
ALTER TABLE public.records ENABLE TRIGGER ALL;
ALTER TABLE public.customers ENABLE TRIGGER ALL;

COMMIT;

-- 7. KIỂM TRA LẠI SỐ LƯỢNG BẢN GHI SAU KHI DỌN DẸP
SELECT 
    (SELECT COUNT(*) FROM public.records) AS tong_giao_dich_records,
    (SELECT COUNT(*) FROM public.customers) AS tong_khach_hang_customers_sau_don_dep;
