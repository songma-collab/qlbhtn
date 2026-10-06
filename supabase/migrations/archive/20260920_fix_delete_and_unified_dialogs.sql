-- ======================================================================
-- SUPABASE MIGRATION: 20260920_fix_delete_and_unified_dialogs.sql
-- Mục đích:
-- 1. Khắc phục lỗi không thể hủy/xóa giao dịch (Trigger sync_record_aliases đồng bộ 2 chiều khi UPDATE).
-- 2. Cập nhật RLS Policy cho phép Quản lý & Admin xóa giao dịch hợp lệ.
-- 3. Khắc phục lỗi xóa hồ sơ khách hàng liên đới (RPC delete_customer_cascade & bảng auditlogs).
-- ======================================================================

-- 1. Bổ sung các cột tương thích cho bảng auditlogs nếu chưa có
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS "userName" TEXT;
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS "user" TEXT;
ALTER TABLE public.auditlogs ADD COLUMN IF NOT EXISTS "ip_address" TEXT;

-- 2. Cập nhật hàm trigger đồng bộ alias 2 chiều cả khi INSERT và UPDATE
-- ======================================================================
-- BẢN VÁ: ĐỒNG BỘ 2 CHIỀU CỘT ALIAS (SNAKE_CASE <-> CAMELCASE) TRÊN BẢNG RECORDS
-- ======================================================================
CREATE OR REPLACE FUNCTION public.sync_record_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- 1. staff_id <-> "staffId" (Tự động gán định danh cán bộ phụ trách nếu rỗng, đồng bộ 2 chiều)
  IF (NEW.staff_id IS NULL OR TRIM(NEW.staff_id) = '') AND (NEW."staffId" IS NULL OR TRIM(NEW."staffId") = '') THEN
    NEW.staff_id := public.current_staff_id();
    NEW."staffId" := NEW.staff_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.staff_id IS DISTINCT FROM OLD.staff_id AND NEW."staffId" IS NOT DISTINCT FROM OLD."staffId" THEN
    NEW."staffId" := NEW.staff_id;
  ELSIF TG_OP = 'UPDATE' AND NEW."staffId" IS DISTINCT FROM OLD."staffId" AND NEW.staff_id IS NOT DISTINCT FROM OLD.staff_id THEN
    NEW.staff_id := NEW."staffId";
  ELSIF NEW.staff_id IS NOT NULL AND NEW."staffId" IS NULL THEN
    NEW."staffId" := NEW.staff_id;
  ELSIF NEW."staffId" IS NOT NULL AND NEW.staff_id IS NULL THEN
    NEW.staff_id := NEW."staffId";
  END IF;

  -- 2. payment_status <-> "paymentStatus"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW."paymentStatus" IS NOT DISTINCT FROM OLD."paymentStatus" THEN
      NEW."paymentStatus" := NEW.payment_status;
    ELSIF NEW."paymentStatus" IS DISTINCT FROM OLD."paymentStatus" AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
      NEW.payment_status := NEW."paymentStatus";
    ELSIF NEW.payment_status IS NOT NULL AND NEW."paymentStatus" IS NULL THEN
      NEW."paymentStatus" := NEW.payment_status;
    ELSIF NEW."paymentStatus" IS NOT NULL AND NEW.payment_status IS NULL THEN
      NEW.payment_status := NEW."paymentStatus";
    END IF;
  ELSE
    IF NEW.payment_status IS NOT NULL AND NEW."paymentStatus" IS NULL THEN
      NEW."paymentStatus" := NEW.payment_status;
    ELSIF NEW."paymentStatus" IS NOT NULL AND NEW.payment_status IS NULL THEN
      NEW.payment_status := NEW."paymentStatus";
    END IF;
  END IF;

  -- 3. action_type <-> "actionType"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.action_type IS DISTINCT FROM OLD.action_type AND NEW."actionType" IS NOT DISTINCT FROM OLD."actionType" THEN
      NEW."actionType" := NEW.action_type;
    ELSIF NEW."actionType" IS DISTINCT FROM OLD."actionType" AND NEW.action_type IS NOT DISTINCT FROM OLD.action_type THEN
      NEW.action_type := NEW."actionType";
    ELSIF NEW.action_type IS NOT NULL AND NEW."actionType" IS NULL THEN
      NEW."actionType" := NEW.action_type;
    ELSIF NEW."actionType" IS NOT NULL AND NEW.action_type IS NULL THEN
      NEW.action_type := NEW."actionType";
    END IF;
  ELSE
    IF NEW.action_type IS NOT NULL AND NEW."actionType" IS NULL THEN
      NEW."actionType" := NEW.action_type;
    ELSIF NEW."actionType" IS NOT NULL AND NEW.action_type IS NULL THEN
      NEW.action_type := NEW."actionType";
    END IF;
  END IF;

  -- 4. sub_type <-> "subType"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.sub_type IS DISTINCT FROM OLD.sub_type AND NEW."subType" IS NOT DISTINCT FROM OLD."subType" THEN
      NEW."subType" := NEW.sub_type;
    ELSIF NEW."subType" IS DISTINCT FROM OLD."subType" AND NEW.sub_type IS NOT DISTINCT FROM OLD.sub_type THEN
      NEW.sub_type := NEW."subType";
    ELSIF NEW.sub_type IS NOT NULL AND NEW."subType" IS NULL THEN
      NEW."subType" := NEW.sub_type;
    ELSIF NEW."subType" IS NOT NULL AND NEW.sub_type IS NULL THEN
      NEW.sub_type := NEW."subType";
    END IF;
  ELSE
    IF NEW.sub_type IS NOT NULL AND NEW."subType" IS NULL THEN
      NEW."subType" := NEW.sub_type;
    ELSIF NEW."subType" IS NOT NULL AND NEW.sub_type IS NULL THEN
      NEW.sub_type := NEW."subType";
    END IF;
  END IF;

  -- 5. support_pct <-> "supportPct"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.support_pct IS DISTINCT FROM OLD.support_pct AND NEW."supportPct" IS NOT DISTINCT FROM OLD."supportPct" THEN
      NEW."supportPct" := NEW.support_pct;
    ELSIF NEW."supportPct" IS DISTINCT FROM OLD."supportPct" AND NEW.support_pct IS NOT DISTINCT FROM OLD.support_pct THEN
      NEW.support_pct := NEW."supportPct";
    ELSIF NEW.support_pct IS NOT NULL AND NEW."supportPct" IS NULL THEN
      NEW."supportPct" := NEW.support_pct;
    ELSIF NEW."supportPct" IS NOT NULL AND NEW.support_pct IS NULL THEN
      NEW.support_pct := NEW."supportPct";
    END IF;
  ELSE
    IF NEW.support_pct IS NOT NULL AND NEW."supportPct" IS NULL THEN
      NEW."supportPct" := NEW.support_pct;
    ELSIF NEW."supportPct" IS NOT NULL AND NEW.support_pct IS NULL THEN
      NEW.support_pct := NEW."supportPct";
    END IF;
  END IF;

  -- 6. household_id <-> "householdId"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.household_id IS DISTINCT FROM OLD.household_id AND NEW."householdId" IS NOT DISTINCT FROM OLD."householdId" THEN
      NEW."householdId" := NEW.household_id;
    ELSIF NEW."householdId" IS DISTINCT FROM OLD."householdId" AND NEW.household_id IS NOT DISTINCT FROM OLD.household_id THEN
      NEW.household_id := NEW."householdId";
    ELSIF NEW.household_id IS NOT NULL AND NEW."householdId" IS NULL THEN
      NEW."householdId" := NEW.household_id;
    ELSIF NEW."householdId" IS NOT NULL AND NEW.household_id IS NULL THEN
      NEW.household_id := NEW."householdId";
    END IF;
  ELSE
    IF NEW.household_id IS NOT NULL AND NEW."householdId" IS NULL THEN
      NEW."householdId" := NEW.household_id;
    ELSIF NEW."householdId" IS NOT NULL AND NEW.household_id IS NULL THEN
      NEW.household_id := NEW."householdId";
    END IF;
  END IF;

  -- 7. effective_date <-> "effectiveDate"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.effective_date IS DISTINCT FROM OLD.effective_date AND NEW."effectiveDate" IS NOT DISTINCT FROM OLD."effectiveDate" THEN
      NEW."effectiveDate" := NEW.effective_date;
    ELSIF NEW."effectiveDate" IS DISTINCT FROM OLD."effectiveDate" AND NEW.effective_date IS NOT DISTINCT FROM OLD.effective_date THEN
      NEW.effective_date := NEW."effectiveDate";
    ELSIF NEW.effective_date IS NOT NULL AND NEW."effectiveDate" IS NULL THEN
      NEW."effectiveDate" := NEW.effective_date;
    ELSIF NEW."effectiveDate" IS NOT NULL AND NEW.effective_date IS NULL THEN
      NEW.effective_date := NEW."effectiveDate";
    END IF;
  ELSE
    IF NEW.effective_date IS NOT NULL AND NEW."effectiveDate" IS NULL THEN
      NEW."effectiveDate" := NEW.effective_date;
    ELSIF NEW."effectiveDate" IS NOT NULL AND NEW.effective_date IS NULL THEN
      NEW.effective_date := NEW."effectiveDate";
    END IF;
  END IF;

  -- 8. target_date <-> "targetDate"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.target_date IS DISTINCT FROM OLD.target_date AND NEW."targetDate" IS NOT DISTINCT FROM OLD."targetDate" THEN
      NEW."targetDate" := NEW.target_date;
    ELSIF NEW."targetDate" IS DISTINCT FROM OLD."targetDate" AND NEW.target_date IS NOT DISTINCT FROM OLD.target_date THEN
      NEW.target_date := NEW."targetDate";
    ELSIF NEW.target_date IS NOT NULL AND NEW."targetDate" IS NULL THEN
      NEW."targetDate" := NEW.target_date;
    ELSIF NEW."targetDate" IS NOT NULL AND NEW.target_date IS NULL THEN
      NEW.target_date := NEW."targetDate";
    END IF;
  ELSE
    IF NEW.target_date IS NOT NULL AND NEW."targetDate" IS NULL THEN
      NEW."targetDate" := NEW.target_date;
    ELSIF NEW."targetDate" IS NOT NULL AND NEW.target_date IS NULL THEN
      NEW.target_date := NEW."targetDate";
    END IF;
  END IF;

  -- 9. nn_support_pct <-> "nnSupportPct"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.nn_support_pct IS DISTINCT FROM OLD.nn_support_pct AND NEW."nnSupportPct" IS NOT DISTINCT FROM OLD."nnSupportPct" THEN
      NEW."nnSupportPct" := NEW.nn_support_pct;
    ELSIF NEW."nnSupportPct" IS DISTINCT FROM OLD."nnSupportPct" AND NEW.nn_support_pct IS NOT DISTINCT FROM OLD.nn_support_pct THEN
      NEW.nn_support_pct := NEW."nnSupportPct";
    ELSIF NEW.nn_support_pct IS NOT NULL AND NEW."nnSupportPct" IS NULL THEN
      NEW."nnSupportPct" := NEW.nn_support_pct;
    ELSIF NEW."nnSupportPct" IS NOT NULL AND NEW.nn_support_pct IS NULL THEN
      NEW.nn_support_pct := NEW."nnSupportPct";
    END IF;
  ELSE
    IF NEW.nn_support_pct IS NOT NULL AND NEW."nnSupportPct" IS NULL THEN
      NEW."nnSupportPct" := NEW.nn_support_pct;
    ELSIF NEW."nnSupportPct" IS NOT NULL AND NEW.nn_support_pct IS NULL THEN
      NEW.nn_support_pct := NEW."nnSupportPct";
    END IF;
  END IF;

  -- 10. dp_support_pct <-> "dpSupportPct"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.dp_support_pct IS DISTINCT FROM OLD.dp_support_pct AND NEW."dpSupportPct" IS NOT DISTINCT FROM OLD."dpSupportPct" THEN
      NEW."dpSupportPct" := NEW.dp_support_pct;
    ELSIF NEW."dpSupportPct" IS DISTINCT FROM OLD."dpSupportPct" AND NEW.dp_support_pct IS NOT DISTINCT FROM OLD.dp_support_pct THEN
      NEW.dp_support_pct := NEW."dpSupportPct";
    ELSIF NEW.dp_support_pct IS NOT NULL AND NEW."dpSupportPct" IS NULL THEN
      NEW."dpSupportPct" := NEW.dp_support_pct;
    ELSIF NEW."dpSupportPct" IS NOT NULL AND NEW.dp_support_pct IS NULL THEN
      NEW.dp_support_pct := NEW."dpSupportPct";
    END IF;
  ELSE
    IF NEW.dp_support_pct IS NOT NULL AND NEW."dpSupportPct" IS NULL THEN
      NEW."dpSupportPct" := NEW.dp_support_pct;
    ELSIF NEW."dpSupportPct" IS NOT NULL AND NEW.dp_support_pct IS NULL THEN
      NEW.dp_support_pct := NEW."dpSupportPct";
    END IF;
  END IF;

  -- 11. from_month <-> "fromMonth"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.from_month IS DISTINCT FROM OLD.from_month AND NEW."fromMonth" IS NOT DISTINCT FROM OLD."fromMonth" THEN
      NEW."fromMonth" := NEW.from_month;
    ELSIF NEW."fromMonth" IS DISTINCT FROM OLD."fromMonth" AND NEW.from_month IS NOT DISTINCT FROM OLD.from_month THEN
      NEW.from_month := NEW."fromMonth";
    ELSIF NEW.from_month IS NOT NULL AND NEW."fromMonth" IS NULL THEN
      NEW."fromMonth" := NEW.from_month;
    ELSIF NEW."fromMonth" IS NOT NULL AND NEW.from_month IS NULL THEN
      NEW.from_month := NEW."fromMonth";
    END IF;
  ELSE
    IF NEW.from_month IS NOT NULL AND NEW."fromMonth" IS NULL THEN
      NEW."fromMonth" := NEW.from_month;
    ELSIF NEW."fromMonth" IS NOT NULL AND NEW.from_month IS NULL THEN
      NEW.from_month := NEW."fromMonth";
    END IF;
  END IF;

  -- 12. to_month <-> "toMonth"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.to_month IS DISTINCT FROM OLD.to_month AND NEW."toMonth" IS NOT DISTINCT FROM OLD."toMonth" THEN
      NEW."toMonth" := NEW.to_month;
    ELSIF NEW."toMonth" IS DISTINCT FROM OLD."toMonth" AND NEW.to_month IS NOT DISTINCT FROM OLD.to_month THEN
      NEW.to_month := NEW."toMonth";
    ELSIF NEW.to_month IS NOT NULL AND NEW."toMonth" IS NULL THEN
      NEW."toMonth" := NEW.to_month;
    ELSIF NEW."toMonth" IS NOT NULL AND NEW.to_month IS NULL THEN
      NEW.to_month := NEW."toMonth";
    END IF;
  ELSE
    IF NEW.to_month IS NOT NULL AND NEW."toMonth" IS NULL THEN
      NEW."toMonth" := NEW.to_month;
    ELSIF NEW."toMonth" IS NOT NULL AND NEW.to_month IS NULL THEN
      NEW.to_month := NEW."toMonth";
    END IF;
  END IF;

  -- 13. base_premium <-> "basePremium"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.base_premium IS DISTINCT FROM OLD.base_premium AND NEW."basePremium" IS NOT DISTINCT FROM OLD."basePremium" THEN
      NEW."basePremium" := NEW.base_premium;
    ELSIF NEW."basePremium" IS DISTINCT FROM OLD."basePremium" AND NEW.base_premium IS NOT DISTINCT FROM OLD.base_premium THEN
      NEW.base_premium := NEW."basePremium";
    ELSIF NEW.base_premium IS NOT NULL AND NEW."basePremium" IS NULL THEN
      NEW."basePremium" := NEW.base_premium;
    ELSIF NEW."basePremium" IS NOT NULL AND NEW.base_premium IS NULL THEN
      NEW.base_premium := NEW."basePremium";
    END IF;
  ELSE
    IF NEW.base_premium IS NOT NULL AND NEW."basePremium" IS NULL THEN
      NEW."basePremium" := NEW.base_premium;
    ELSIF NEW."basePremium" IS NOT NULL AND NEW.base_premium IS NULL THEN
      NEW.base_premium := NEW."basePremium";
    END IF;
  END IF;

  -- 14. nn_support_amount <-> "nnSupportAmount"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.nn_support_amount IS DISTINCT FROM OLD.nn_support_amount AND NEW."nnSupportAmount" IS NOT DISTINCT FROM OLD."nnSupportAmount" THEN
      NEW."nnSupportAmount" := NEW.nn_support_amount;
    ELSIF NEW."nnSupportAmount" IS DISTINCT FROM OLD."nnSupportAmount" AND NEW.nn_support_amount IS NOT DISTINCT FROM OLD.nn_support_amount THEN
      NEW.nn_support_amount := NEW."nnSupportAmount";
    ELSIF NEW.nn_support_amount IS NOT NULL AND NEW."nnSupportAmount" IS NULL THEN
      NEW."nnSupportAmount" := NEW.nn_support_amount;
    ELSIF NEW."nnSupportAmount" IS NOT NULL AND NEW.nn_support_amount IS NULL THEN
      NEW.nn_support_amount := NEW."nnSupportAmount";
    END IF;
  ELSE
    IF NEW.nn_support_amount IS NOT NULL AND NEW."nnSupportAmount" IS NULL THEN
      NEW."nnSupportAmount" := NEW.nn_support_amount;
    ELSIF NEW."nnSupportAmount" IS NOT NULL AND NEW.nn_support_amount IS NULL THEN
      NEW.nn_support_amount := NEW."nnSupportAmount";
    END IF;
  END IF;

  -- 15. dp_support_amount <-> "dpSupportAmount"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.dp_support_amount IS DISTINCT FROM OLD.dp_support_amount AND NEW."dpSupportAmount" IS NOT DISTINCT FROM OLD."dpSupportAmount" THEN
      NEW."dpSupportAmount" := NEW.dp_support_amount;
    ELSIF NEW."dpSupportAmount" IS DISTINCT FROM OLD."dpSupportAmount" AND NEW.dp_support_amount IS NOT DISTINCT FROM OLD.dp_support_amount THEN
      NEW.dp_support_amount := NEW."dpSupportAmount";
    ELSIF NEW.dp_support_amount IS NOT NULL AND NEW."dpSupportAmount" IS NULL THEN
      NEW."dpSupportAmount" := NEW.dp_support_amount;
    ELSIF NEW."dpSupportAmount" IS NOT NULL AND NEW.dp_support_amount IS NULL THEN
      NEW.dp_support_amount := NEW."dpSupportAmount";
    END IF;
  ELSE
    IF NEW.dp_support_amount IS NOT NULL AND NEW."dpSupportAmount" IS NULL THEN
      NEW."dpSupportAmount" := NEW.dp_support_amount;
    ELSIF NEW."dpSupportAmount" IS NOT NULL AND NEW.dp_support_amount IS NULL THEN
      NEW.dp_support_amount := NEW."dpSupportAmount";
    END IF;
  END IF;

  -- 16. discount_amount <-> "discountAmount"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.discount_amount IS DISTINCT FROM OLD.discount_amount AND NEW."discountAmount" IS NOT DISTINCT FROM OLD."discountAmount" THEN
      NEW."discountAmount" := NEW.discount_amount;
    ELSIF NEW."discountAmount" IS DISTINCT FROM OLD."discountAmount" AND NEW.discount_amount IS NOT DISTINCT FROM OLD.discount_amount THEN
      NEW.discount_amount := NEW."discountAmount";
    ELSIF NEW.discount_amount IS NOT NULL AND NEW."discountAmount" IS NULL THEN
      NEW."discountAmount" := NEW.discount_amount;
    ELSIF NEW."discountAmount" IS NOT NULL AND NEW.discount_amount IS NULL THEN
      NEW.discount_amount := NEW."discountAmount";
    END IF;
  ELSE
    IF NEW.discount_amount IS NOT NULL AND NEW."discountAmount" IS NULL THEN
      NEW."discountAmount" := NEW.discount_amount;
    ELSIF NEW."discountAmount" IS NOT NULL AND NEW.discount_amount IS NULL THEN
      NEW.discount_amount := NEW."discountAmount";
    END IF;
  END IF;

  -- 17. penalty_amount <-> "penaltyAmount"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.penalty_amount IS DISTINCT FROM OLD.penalty_amount AND NEW."penaltyAmount" IS NOT DISTINCT FROM OLD."penaltyAmount" THEN
      NEW."penaltyAmount" := NEW.penalty_amount;
    ELSIF NEW."penaltyAmount" IS DISTINCT FROM OLD."penaltyAmount" AND NEW.penalty_amount IS NOT DISTINCT FROM OLD.penalty_amount THEN
      NEW.penalty_amount := NEW."penaltyAmount";
    ELSIF NEW.penalty_amount IS NOT NULL AND NEW."penaltyAmount" IS NULL THEN
      NEW."penaltyAmount" := NEW.penalty_amount;
    ELSIF NEW."penaltyAmount" IS NOT NULL AND NEW.penalty_amount IS NULL THEN
      NEW.penalty_amount := NEW."penaltyAmount";
    END IF;
  ELSE
    IF NEW.penalty_amount IS NOT NULL AND NEW."penaltyAmount" IS NULL THEN
      NEW."penaltyAmount" := NEW.penalty_amount;
    ELSIF NEW."penaltyAmount" IS NOT NULL AND NEW.penalty_amount IS NULL THEN
      NEW.penalty_amount := NEW."penaltyAmount";
    END IF;
  END IF;

  -- 18. next_payment <-> "nextPayment"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.next_payment IS DISTINCT FROM OLD.next_payment AND NEW."nextPayment" IS NOT DISTINCT FROM OLD."nextPayment" THEN
      NEW."nextPayment" := NEW.next_payment;
    ELSIF NEW."nextPayment" IS DISTINCT FROM OLD."nextPayment" AND NEW.next_payment IS NOT DISTINCT FROM OLD.next_payment THEN
      NEW.next_payment := NEW."nextPayment";
    ELSIF NEW.next_payment IS NOT NULL AND NEW."nextPayment" IS NULL THEN
      NEW."nextPayment" := NEW.next_payment;
    ELSIF NEW."nextPayment" IS NOT NULL AND NEW.next_payment IS NULL THEN
      NEW.next_payment := NEW."nextPayment";
    END IF;
  ELSE
    IF NEW.next_payment IS NOT NULL AND NEW."nextPayment" IS NULL THEN
      NEW."nextPayment" := NEW.next_payment;
    ELSIF NEW."nextPayment" IS NOT NULL AND NEW.next_payment IS NULL THEN
      NEW.next_payment := NEW."nextPayment";
    END IF;
  END IF;

  -- 19. recv_name <-> "recvName"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.recv_name IS DISTINCT FROM OLD.recv_name AND NEW."recvName" IS NOT DISTINCT FROM OLD."recvName" THEN
      NEW."recvName" := NEW.recv_name;
    ELSIF NEW."recvName" IS DISTINCT FROM OLD."recvName" AND NEW.recv_name IS NOT DISTINCT FROM OLD.recv_name THEN
      NEW.recv_name := NEW."recvName";
    ELSIF NEW.recv_name IS NOT NULL AND NEW."recvName" IS NULL THEN
      NEW."recvName" := NEW.recv_name;
    ELSIF NEW."recvName" IS NOT NULL AND NEW.recv_name IS NULL THEN
      NEW.recv_name := NEW."recvName";
    END IF;
  ELSE
    IF NEW.recv_name IS NOT NULL AND NEW."recvName" IS NULL THEN
      NEW."recvName" := NEW.recv_name;
    ELSIF NEW."recvName" IS NOT NULL AND NEW.recv_name IS NULL THEN
      NEW.recv_name := NEW."recvName";
    END IF;
  END IF;

  -- 20. recv_phone <-> "recvPhone"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.recv_phone IS DISTINCT FROM OLD.recv_phone AND NEW."recvPhone" IS NOT DISTINCT FROM OLD."recvPhone" THEN
      NEW."recvPhone" := NEW.recv_phone;
    ELSIF NEW."recvPhone" IS DISTINCT FROM OLD."recvPhone" AND NEW.recv_phone IS NOT DISTINCT FROM OLD.recv_phone THEN
      NEW.recv_phone := NEW."recvPhone";
    ELSIF NEW.recv_phone IS NOT NULL AND NEW."recvPhone" IS NULL THEN
      NEW."recvPhone" := NEW.recv_phone;
    ELSIF NEW."recvPhone" IS NOT NULL AND NEW.recv_phone IS NULL THEN
      NEW.recv_phone := NEW."recvPhone";
    END IF;
  ELSE
    IF NEW.recv_phone IS NOT NULL AND NEW."recvPhone" IS NULL THEN
      NEW."recvPhone" := NEW.recv_phone;
    ELSIF NEW."recvPhone" IS NOT NULL AND NEW.recv_phone IS NULL THEN
      NEW.recv_phone := NEW."recvPhone";
    END IF;
  END IF;

  -- 21. recv_address <-> "recvAddress"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.recv_address IS DISTINCT FROM OLD.recv_address AND NEW."recvAddress" IS NOT DISTINCT FROM OLD."recvAddress" THEN
      NEW."recvAddress" := NEW.recv_address;
    ELSIF NEW."recvAddress" IS DISTINCT FROM OLD."recvAddress" AND NEW.recv_address IS NOT DISTINCT FROM OLD.recv_address THEN
      NEW.recv_address := NEW."recvAddress";
    ELSIF NEW.recv_address IS NOT NULL AND NEW."recvAddress" IS NULL THEN
      NEW."recvAddress" := NEW.recv_address;
    ELSIF NEW."recvAddress" IS NOT NULL AND NEW.recv_address IS NULL THEN
      NEW.recv_address := NEW."recvAddress";
    END IF;
  ELSE
    IF NEW.recv_address IS NOT NULL AND NEW."recvAddress" IS NULL THEN
      NEW."recvAddress" := NEW.recv_address;
    ELSIF NEW."recvAddress" IS NOT NULL AND NEW.recv_address IS NULL THEN
      NEW.recv_address := NEW."recvAddress";
    END IF;
  END IF;

  -- 22. is_submitted_bhxh <-> "isSubmittedBHXH"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_submitted_bhxh IS DISTINCT FROM OLD.is_submitted_bhxh AND NEW."isSubmittedBHXH" IS NOT DISTINCT FROM OLD."isSubmittedBHXH" THEN
      NEW."isSubmittedBHXH" := NEW.is_submitted_bhxh;
    ELSIF NEW."isSubmittedBHXH" IS DISTINCT FROM OLD."isSubmittedBHXH" AND NEW.is_submitted_bhxh IS NOT DISTINCT FROM OLD.is_submitted_bhxh THEN
      NEW.is_submitted_bhxh := NEW."isSubmittedBHXH";
    ELSIF NEW.is_submitted_bhxh IS NOT NULL AND NEW."isSubmittedBHXH" IS NULL THEN
      NEW."isSubmittedBHXH" := NEW.is_submitted_bhxh;
    ELSIF NEW."isSubmittedBHXH" IS NOT NULL AND NEW.is_submitted_bhxh IS NULL THEN
      NEW.is_submitted_bhxh := NEW."isSubmittedBHXH";
    END IF;
  ELSE
    IF NEW.is_submitted_bhxh IS NOT NULL AND NEW."isSubmittedBHXH" IS NULL THEN
      NEW."isSubmittedBHXH" := NEW.is_submitted_bhxh;
    ELSIF NEW."isSubmittedBHXH" IS NOT NULL AND NEW.is_submitted_bhxh IS NULL THEN
      NEW.is_submitted_bhxh := NEW."isSubmittedBHXH";
    END IF;
  END IF;

  -- 23. submission_batch <-> "submissionBatch"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.submission_batch IS DISTINCT FROM OLD.submission_batch AND NEW."submissionBatch" IS NOT DISTINCT FROM OLD."submissionBatch" THEN
      NEW."submissionBatch" := NEW.submission_batch;
    ELSIF NEW."submissionBatch" IS DISTINCT FROM OLD."submissionBatch" AND NEW.submission_batch IS NOT DISTINCT FROM OLD.submission_batch THEN
      NEW.submission_batch := NEW."submissionBatch";
    ELSIF NEW.submission_batch IS NOT NULL AND NEW."submissionBatch" IS NULL THEN
      NEW."submissionBatch" := NEW.submission_batch;
    ELSIF NEW."submissionBatch" IS NOT NULL AND NEW.submission_batch IS NULL THEN
      NEW.submission_batch := NEW."submissionBatch";
    END IF;
  ELSE
    IF NEW.submission_batch IS NOT NULL AND NEW."submissionBatch" IS NULL THEN
      NEW."submissionBatch" := NEW.submission_batch;
    ELSIF NEW."submissionBatch" IS NOT NULL AND NEW.submission_batch IS NULL THEN
      NEW.submission_batch := NEW."submissionBatch";
    END IF;
  END IF;

  -- 24. submitted_date <-> "submittedDate"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.submitted_date IS DISTINCT FROM OLD.submitted_date AND NEW."submittedDate" IS NOT DISTINCT FROM OLD."submittedDate" THEN
      NEW."submittedDate" := NEW.submitted_date;
    ELSIF NEW."submittedDate" IS DISTINCT FROM OLD."submittedDate" AND NEW.submitted_date IS NOT DISTINCT FROM OLD.submitted_date THEN
      NEW.submitted_date := NEW."submittedDate";
    ELSIF NEW.submitted_date IS NOT NULL AND NEW."submittedDate" IS NULL THEN
      NEW."submittedDate" := NEW.submitted_date;
    ELSIF NEW."submittedDate" IS NOT NULL AND NEW.submitted_date IS NULL THEN
      NEW.submitted_date := NEW."submittedDate";
    END IF;
  ELSE
    IF NEW.submitted_date IS NOT NULL AND NEW."submittedDate" IS NULL THEN
      NEW."submittedDate" := NEW.submitted_date;
    ELSIF NEW."submittedDate" IS NOT NULL AND NEW.submitted_date IS NULL THEN
      NEW.submitted_date := NEW."submittedDate";
    END IF;
  END IF;

  -- 25. is_adjustment <-> "isAdjustment"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_adjustment IS DISTINCT FROM OLD.is_adjustment AND NEW."isAdjustment" IS NOT DISTINCT FROM OLD."isAdjustment" THEN
      NEW."isAdjustment" := NEW.is_adjustment;
    ELSIF NEW."isAdjustment" IS DISTINCT FROM OLD."isAdjustment" AND NEW.is_adjustment IS NOT DISTINCT FROM OLD.is_adjustment THEN
      NEW.is_adjustment := NEW."isAdjustment";
    ELSIF NEW.is_adjustment IS NOT NULL AND NEW."isAdjustment" IS NULL THEN
      NEW."isAdjustment" := NEW.is_adjustment;
    ELSIF NEW."isAdjustment" IS NOT NULL AND NEW.is_adjustment IS NULL THEN
      NEW.is_adjustment := NEW."isAdjustment";
    END IF;
  ELSE
    IF NEW.is_adjustment IS NOT NULL AND NEW."isAdjustment" IS NULL THEN
      NEW."isAdjustment" := NEW.is_adjustment;
    ELSIF NEW."isAdjustment" IS NOT NULL AND NEW.is_adjustment IS NULL THEN
      NEW.is_adjustment := NEW."isAdjustment";
    END IF;
  END IF;

  -- 26. original_record_id <-> "originalRecordId"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.original_record_id IS DISTINCT FROM OLD.original_record_id AND NEW."originalRecordId" IS NOT DISTINCT FROM OLD."originalRecordId" THEN
      NEW."originalRecordId" := NEW.original_record_id;
    ELSIF NEW."originalRecordId" IS DISTINCT FROM OLD."originalRecordId" AND NEW.original_record_id IS NOT DISTINCT FROM OLD.original_record_id THEN
      NEW.original_record_id := NEW."originalRecordId";
    ELSIF NEW.original_record_id IS NOT NULL AND NEW."originalRecordId" IS NULL THEN
      NEW."originalRecordId" := NEW.original_record_id;
    ELSIF NEW."originalRecordId" IS NOT NULL AND NEW.original_record_id IS NULL THEN
      NEW.original_record_id := NEW."originalRecordId";
    END IF;
  ELSE
    IF NEW.original_record_id IS NOT NULL AND NEW."originalRecordId" IS NULL THEN
      NEW."originalRecordId" := NEW.original_record_id;
    ELSIF NEW."originalRecordId" IS NOT NULL AND NEW.original_record_id IS NULL THEN
      NEW.original_record_id := NEW."originalRecordId";
    END IF;
  END IF;

  -- 27. adjustment_reason <-> "adjustmentReason"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.adjustment_reason IS DISTINCT FROM OLD.adjustment_reason AND NEW."adjustmentReason" IS NOT DISTINCT FROM OLD."adjustmentReason" THEN
      NEW."adjustmentReason" := NEW.adjustment_reason;
    ELSIF NEW."adjustmentReason" IS DISTINCT FROM OLD."adjustmentReason" AND NEW.adjustment_reason IS NOT DISTINCT FROM OLD.adjustment_reason THEN
      NEW.adjustment_reason := NEW."adjustmentReason";
    ELSIF NEW.adjustment_reason IS NOT NULL AND NEW."adjustmentReason" IS NULL THEN
      NEW."adjustmentReason" := NEW.adjustment_reason;
    ELSIF NEW."adjustmentReason" IS NOT NULL AND NEW.adjustment_reason IS NULL THEN
      NEW.adjustment_reason := NEW."adjustmentReason";
    END IF;
  ELSE
    IF NEW.adjustment_reason IS NOT NULL AND NEW."adjustmentReason" IS NULL THEN
      NEW."adjustmentReason" := NEW.adjustment_reason;
    ELSIF NEW."adjustmentReason" IS NOT NULL AND NEW.adjustment_reason IS NULL THEN
      NEW.adjustment_reason := NEW."adjustmentReason";
    END IF;
  END IF;

  -- 28. customer_id <-> "customerId"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NEW."customerId" IS NOT DISTINCT FROM OLD."customerId" THEN
      NEW."customerId" := NEW.customer_id;
    ELSIF NEW."customerId" IS DISTINCT FROM OLD."customerId" AND NEW.customer_id IS NOT DISTINCT FROM OLD.customer_id THEN
      NEW.customer_id := NEW."customerId";
    ELSIF NEW.customer_id IS NOT NULL AND NEW."customerId" IS NULL THEN
      NEW."customerId" := NEW.customer_id;
    ELSIF NEW."customerId" IS NOT NULL AND NEW.customer_id IS NULL THEN
      NEW.customer_id := NEW."customerId";
    END IF;
  ELSE
    IF NEW.customer_id IS NOT NULL AND NEW."customerId" IS NULL THEN
      NEW."customerId" := NEW.customer_id;
    ELSIF NEW."customerId" IS NOT NULL AND NEW.customer_id IS NULL THEN
      NEW.customer_id := NEW."customerId";
    END IF;
  END IF;

  -- 29. customer_key <-> "customerKey"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.customer_key IS DISTINCT FROM OLD.customer_key AND NEW."customerKey" IS NOT DISTINCT FROM OLD."customerKey" THEN
      NEW."customerKey" := NEW.customer_key;
    ELSIF NEW."customerKey" IS DISTINCT FROM OLD."customerKey" AND NEW.customer_key IS NOT DISTINCT FROM OLD.customer_key THEN
      NEW.customer_key := NEW."customerKey";
    ELSIF NEW.customer_key IS NOT NULL AND NEW."customerKey" IS NULL THEN
      NEW."customerKey" := NEW.customer_key;
    ELSIF NEW."customerKey" IS NOT NULL AND NEW.customer_key IS NULL THEN
      NEW.customer_key := NEW."customerKey";
    END IF;
  ELSE
    IF NEW.customer_key IS NOT NULL AND NEW."customerKey" IS NULL THEN
      NEW."customerKey" := NEW.customer_key;
    ELSIF NEW."customerKey" IS NOT NULL AND NEW.customer_key IS NULL THEN
      NEW.customer_key := NEW."customerKey";
    END IF;
  END IF;

  -- 30. old_bhxh <-> "oldBhxh"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.old_bhxh IS DISTINCT FROM OLD.old_bhxh AND NEW."oldBhxh" IS NOT DISTINCT FROM OLD."oldBhxh" THEN
      NEW."oldBhxh" := NEW.old_bhxh;
    ELSIF NEW."oldBhxh" IS DISTINCT FROM OLD."oldBhxh" AND NEW.old_bhxh IS NOT DISTINCT FROM OLD.old_bhxh THEN
      NEW.old_bhxh := NEW."oldBhxh";
    ELSIF NEW.old_bhxh IS NOT NULL AND NEW."oldBhxh" IS NULL THEN
      NEW."oldBhxh" := NEW.old_bhxh;
    ELSIF NEW."oldBhxh" IS NOT NULL AND NEW.old_bhxh IS NULL THEN
      NEW.old_bhxh := NEW."oldBhxh";
    END IF;
  ELSE
    IF NEW.old_bhxh IS NOT NULL AND NEW."oldBhxh" IS NULL THEN
      NEW."oldBhxh" := NEW.old_bhxh;
    ELSIF NEW."oldBhxh" IS NOT NULL AND NEW.old_bhxh IS NULL THEN
      NEW.old_bhxh := NEW."oldBhxh";
    END IF;
  END IF;

  -- 31. idempotency_key <-> "idempotencyKey"
  IF TG_OP = 'UPDATE' THEN
    IF NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key AND NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey" THEN
      NEW."idempotencyKey" := NEW.idempotency_key;
    ELSIF NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" AND NEW.idempotency_key IS NOT DISTINCT FROM OLD.idempotency_key THEN
      NEW.idempotency_key := NEW."idempotencyKey";
    ELSIF NEW.idempotency_key IS NOT NULL AND NEW."idempotencyKey" IS NULL THEN
      NEW."idempotencyKey" := NEW.idempotency_key;
    ELSIF NEW."idempotencyKey" IS NOT NULL AND NEW.idempotency_key IS NULL THEN
      NEW.idempotency_key := NEW."idempotencyKey";
    END IF;
  ELSE
    IF NEW.idempotency_key IS NOT NULL AND NEW."idempotencyKey" IS NULL THEN
      NEW."idempotencyKey" := NEW.idempotency_key;
    ELSIF NEW."idempotencyKey" IS NOT NULL AND NEW.idempotency_key IS NULL THEN
      NEW.idempotency_key := NEW."idempotencyKey";
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_sync_record_aliases ON public.records;
CREATE TRIGGER trg_sync_record_aliases
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_record_aliases();

-- 3. Cập nhật RLS Policy xóa bản ghi trên bảng records
-- Quản lý & Admin được xóa giao dịch; Cán bộ/Nhân viên được xóa bất kỳ giao dịch nào ở trạng thái Chờ thanh toán / Chưa thu tiền
DROP POLICY IF EXISTS "records_delete_authenticated" ON public.records;
CREATE POLICY "records_delete_authenticated" ON public.records
  FOR DELETE TO authenticated
  USING (
    public.is_manager_or_admin()
    OR COALESCE(records.payment_status, records."paymentStatus") IN ('Chờ thanh toán', 'Chờ thu tiền', 'Chưa thu tiền', 'Đã hủy')
    OR COALESCE(records.payment_status, records."paymentStatus") != 'Đã thu tiền'
  );

-- 3.1. Tạo hàm RPC delete_record_safe (SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.delete_record_safe(BIGINT) CASCADE;
CREATE OR REPLACE FUNCTION public.delete_record_safe(p_record_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
  v_user_name TEXT;
  v_deleted_count INT := 0;
BEGIN
  SELECT id, name, type, "isSubmittedBHXH", is_submitted_bhxh,
         COALESCE(payment_status, "paymentStatus") AS p_status,
         customer_key, "customerKey"
  INTO v_rec
  FROM public.records
  WHERE id = p_record_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Không tìm thấy hồ sơ giao dịch #' || p_record_id
    );
  END IF;

  IF COALESCE(v_rec."isSubmittedBHXH", v_rec.is_submitted_bhxh, false) = true THEN
    RAISE EXCEPTION 'Hồ sơ "%" (Mã #%) ĐÃ ĐƯỢC CHUYỂN BHXH. Thao tác xóa bị từ chối!', v_rec.name, p_record_id
      USING ERRCODE = '23514';
  END IF;

  IF v_rec.p_status = 'Đã thu tiền' AND NOT public.is_manager_or_admin() THEN
    RAISE EXCEPTION 'Giao dịch #% của "%" đã thu tiền. Chỉ Quản lý hoặc Admin mới có quyền xóa. Vui lòng sử dụng tính năng Hủy giao dịch!', p_record_id, v_rec.name
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.records WHERE id = p_record_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Cán bộ thu');
  INSERT INTO public.auditlogs ("action", "details", "userId", "userName", "timestamp")
  VALUES (
    'Xóa giao dịch',
    'Đã xóa giao dịch #' || p_record_id || ' (' || COALESCE(v_rec.type, 'BHXH/BHYT') || ' - ' || COALESCE(v_rec.p_status, 'Chờ thanh toán') || ') của khách hàng ' || COALESCE(v_rec.name, ''),
    COALESCE(auth.uid()::TEXT, 'system'),
    v_user_name,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_id', p_record_id,
    'message', 'Đã xóa giao dịch thành công'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_record_safe(BIGINT) TO authenticated, service_role;

-- 3.2. Tạo hàm RPC bulk_delete_records_safe (SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.bulk_delete_records_safe(BIGINT[]) CASCADE;
CREATE OR REPLACE FUNCTION public.bulk_delete_records_safe(p_record_ids BIGINT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count INT := 0;
  v_user_name TEXT;
  v_submitted_count INT := 0;
  v_paid_non_admin_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_submitted_count
  FROM public.records
  WHERE id = ANY(p_record_ids)
    AND COALESCE("isSubmittedBHXH", is_submitted_bhxh, false) = true;

  IF v_submitted_count > 0 THEN
    RAISE EXCEPTION 'Có % hồ sơ trong danh sách ĐÃ ĐƯỢC CHUYỂN BHXH. Không thể xóa!', v_submitted_count
      USING ERRCODE = '23514';
  END IF;

  IF NOT public.is_manager_or_admin() THEN
    SELECT COUNT(*) INTO v_paid_non_admin_count
    FROM public.records
    WHERE id = ANY(p_record_ids)
      AND COALESCE(payment_status, "paymentStatus") = 'Đã thu tiền';

    IF v_paid_non_admin_count > 0 THEN
      RAISE EXCEPTION 'Có % hồ sơ đã thu tiền. Nhân viên không được phép xóa giao dịch đã thu tiền!', v_paid_non_admin_count
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.records
  WHERE id = ANY(p_record_ids);
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  v_user_name := COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Cán bộ thu');
  INSERT INTO public.auditlogs ("action", "details", "userId", "userName", "timestamp")
  VALUES (
    'Xóa giao dịch hàng loạt',
    'Đã xóa hàng loạt ' || v_deleted_count || ' giao dịch (IDs: ' || array_to_string(p_record_ids, ', ') || ')',
    COALESCE(auth.uid()::TEXT, 'system'),
    v_user_name,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'message', 'Đã xóa hàng loạt giao dịch thành công'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_delete_records_safe(BIGINT[]) TO authenticated, service_role;

-- 4. Cập nhật hàm RPC xóa khách hàng liên đới an toàn (delete_customer_cascade)
DROP FUNCTION IF EXISTS public.delete_customer_cascade(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.delete_customer_cascade CASCADE;

CREATE OR REPLACE FUNCTION public.delete_customer_cascade(p_customer_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_deleted_records_count INT := 0;
    v_cust_name TEXT;
    v_cust_id UUID;
BEGIN
    -- Kiểm tra quyền hạn: Chỉ Admin hoặc Quản lý
    IF NOT public.is_manager_or_admin() THEN
        RAISE EXCEPTION 'Quyền truy cập bị từ chối: Chỉ Quản lý hoặc Quản trị viên mới có thể xóa khách hàng.'
            USING ERRCODE = '42501';
    END IF;

    -- Lấy thông tin khách hàng
    SELECT id, name INTO v_cust_id, v_cust_name FROM public.customers WHERE customer_key = p_customer_key;

    -- Xóa các giao dịch trong bảng records có customer_key hoặc customer_id tương ứng
    WITH deleted_rows AS (
        DELETE FROM public.records
        WHERE customer_key = p_customer_key
           OR "customerKey" = p_customer_key
           OR (v_cust_id IS NOT NULL AND (customer_id = v_cust_id OR "customerId" = v_cust_id))
           OR public.generate_customer_key(type, bhxh, cccd, name, phone) = p_customer_key
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_records_count FROM deleted_rows;

    -- Xóa bản ghi trong bảng customers
    DELETE FROM public.customers WHERE customer_key = p_customer_key;

    -- Ghi audit log chuẩn xác
    INSERT INTO public.auditlogs ("action", "details", "userId", "userName", "timestamp")
    VALUES (
        'Xóa khách hàng liên đới',
        'Xóa khách hàng ' || COALESCE(v_cust_name, p_customer_key) || ' (Đã xóa liên đới ' || v_deleted_records_count || ' giao dịch)',
        COALESCE(auth.uid()::TEXT, 'system'),
        COALESCE(auth.jwt() ->> 'name', auth.jwt() ->> 'email', 'Hệ thống'),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'customer_key', p_customer_key,
        'deleted_records', v_deleted_records_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_customer_cascade(TEXT) TO authenticated, service_role;
