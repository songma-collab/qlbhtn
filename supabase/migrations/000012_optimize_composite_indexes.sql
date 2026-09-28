-- ======================================================================
-- Migration 000012: Tối ưu hóa Composite Indexes cho Hiệu năng cao
-- ======================================================================

-- 1. Index tối ưu cho bộ lọc Quản lý thu theo Loại hình, Cán bộ, Trạng thái đóng phí và Thời gian
CREATE INDEX IF NOT EXISTS idx_records_finance_filter_composite 
  ON public.records ("type", "staffId", "paymentStatus", "date" DESC);

-- 2. Index tối ưu cho theo dõi SLA Hạn đóng (Đôn đốc & CRM)
CREATE INDEX IF NOT EXISTS idx_records_next_payment_sla 
  ON public.records ("nextPayment", "paymentStatus") 
  WHERE "paymentStatus" != 'Đã hủy';

-- 3. Index tối ưu cho tra cứu chính sách động theo tham số và ngày hiệu lực
CREATE INDEX IF NOT EXISTS idx_policies_parameter_lookup 
  ON public.policies ("parameter_type", "effective_date" DESC, "is_active");

-- 4. Index tối ưu cho View CRM tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_records_crm_search_perf 
  ON public.records ("type", "name", "phone", "cccd", "bhxh") 
  WHERE "paymentStatus" != 'Đã hủy';
