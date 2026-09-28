-- =========================================================================================
-- BẢN VÁ CSDL TOÀN DIỆN: BỔ SUNG ĐẦY ĐỦ CÁC TRƯỜNG THÔNG TIN BÚT TOÁN THOÁI THU & RÀ SOÁT TOÀN HỆ THỐNG
-- Cổng thông tin Đại lý thu BHXH Sông Mã (Supabase / PostgreSQL)
-- =========================================================================================

-- 1. BẢNG RECORDS: BỔ SUNG CÁC TRƯỜNG BÚT TOÁN THOÁI THU VÀ THÔNG TIN ĐỒNG BỘ
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundType" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refund_type" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionNumber" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decision_number" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decisionDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "decision_date" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundMethod" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refund_method" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refund_beneficiary_name" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryAccount" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refund_beneficiary_account" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refundBeneficiaryBank" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "refund_beneficiary_bank" TEXT;

-- Bổ sung trường cơ sở khám chữa bệnh ban đầu (KCB BHYT)
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospitalCode" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospital_code" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospitalName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "hospital_name" TEXT;

-- Bổ sung các cột chuẩn hóa hai chiều camelCase & snake_case
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "staff_id" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "is_adjustment" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "original_record_id" BIGINT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "adjustment_reason" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. BẢNG CUSTOMERS: BỔ SUNG CÁC TRƯỜNG BẢO ĐẢM TOÀN VẸN HỒ SƠ MASTER
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "hospital_code" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "hospital_name" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "customerKey" TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS "staffId" TEXT;

-- 3. BẢNG STAFF: BỔ SUNG THÔNG TIN ĐẠI LÝ & TIMESTAMPS
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "agencyName" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "agency_name" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "agencyCode" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "agency_code" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. BẢNG SETTINGS: BẢO ĐẢM ĐẦY ĐỦ CÁC THIẾT LẬP VIETQR VÀ ĐẠI LÝ
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agencyName" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agency_name" TEXT DEFAULT 'Đại lý thu BHXH Sông Mã';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agencyCode" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "agency_code" TEXT DEFAULT 'VSS-SM-001';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bankBin" TEXT DEFAULT '970422';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_bin" TEXT DEFAULT '970422';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bankId" TEXT DEFAULT 'MB';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_id" TEXT DEFAULT 'MB';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bankName" TEXT DEFAULT 'MB (Ngân hàng Quân Đội)';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "bank_name" TEXT DEFAULT 'MB (Ngân hàng Quân Đội)';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "accountNumber" TEXT DEFAULT '0868123456';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "account_number" TEXT DEFAULT '0868123456';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "accountHolder" TEXT DEFAULT 'DAI LY THU BHXH SONG MA';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "account_holder" TEXT DEFAULT 'DAI LY THU BHXH SONG MA';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "qrTemplate" TEXT DEFAULT 'compact2';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "qr_template" TEXT DEFAULT 'compact2';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. TRIGGER TỰ ĐỘNG ĐỒNG BỘ 2 CHIỀU (CAMELCASE <-> SNAKE_CASE) TRÊN BẢNG RECORDS
CREATE OR REPLACE FUNCTION public.sync_record_aliases()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Đồng bộ thoái thu
    NEW."refundType" := COALESCE(NEW."refundType", NEW.refund_type);
    NEW.refund_type := COALESCE(NEW.refund_type, NEW."refundType");
    
    NEW."decisionNumber" := COALESCE(NEW."decisionNumber", NEW.decision_number);
    NEW.decision_number := COALESCE(NEW.decision_number, NEW."decisionNumber");
    
    NEW."decisionDate" := COALESCE(NEW."decisionDate", NEW.decision_date);
    NEW.decision_date := COALESCE(NEW.decision_date, NEW."decisionDate");
    
    NEW."refundMethod" := COALESCE(NEW."refundMethod", NEW.refund_method);
    NEW.refund_method := COALESCE(NEW.refund_method, NEW."refundMethod");
    
    NEW."refundBeneficiaryName" := COALESCE(NEW."refundBeneficiaryName", NEW.refund_beneficiary_name);
    NEW.refund_beneficiary_name := COALESCE(NEW.refund_beneficiary_name, NEW."refundBeneficiaryName");
    
    NEW."refundBeneficiaryAccount" := COALESCE(NEW."refundBeneficiaryAccount", NEW.refund_beneficiary_account);
    NEW.refund_beneficiary_account := COALESCE(NEW.refund_beneficiary_account, NEW."refundBeneficiaryAccount");
    
    NEW."refundBeneficiaryBank" := COALESCE(NEW."refundBeneficiaryBank", NEW.refund_beneficiary_bank);
    NEW.refund_beneficiary_bank := COALESCE(NEW.refund_beneficiary_bank, NEW."refundBeneficiaryBank");
    
    -- Đồng bộ bệnh viện đăng ký KCB ban đầu
    NEW."hospitalCode" := COALESCE(NEW."hospitalCode", NEW.hospital_code);
    NEW.hospital_code := COALESCE(NEW.hospital_code, NEW."hospitalCode");
    
    NEW."hospitalName" := COALESCE(NEW."hospitalName", NEW.hospital_name);
    NEW.hospital_name := COALESCE(NEW.hospital_name, NEW."hospitalName");
    
    -- Đồng bộ cán bộ thu & khách hàng
    NEW."staffId" := COALESCE(NEW."staffId", NEW.staff_id);
    NEW.staff_id := COALESCE(NEW.staff_id, NEW."staffId");
    
    NEW."customerId" := COALESCE(NEW."customerId", NEW.customer_id);
    NEW.customer_id := COALESCE(NEW.customer_id, NEW."customerId");
    
    NEW."customerKey" := COALESCE(NEW."customerKey", NEW.customer_key);
    NEW.customer_key := COALESCE(NEW.customer_key, NEW."customerKey");
    
    -- Đồng bộ thông tin bút toán bù trừ
    NEW."isAdjustment" := COALESCE(NEW."isAdjustment", NEW.is_adjustment, FALSE);
    NEW.is_adjustment := COALESCE(NEW.is_adjustment, NEW."isAdjustment", FALSE);
    
    NEW."originalRecordId" := COALESCE(NEW."originalRecordId", NEW.original_record_id);
    NEW.original_record_id := COALESCE(NEW.original_record_id, NEW."originalRecordId");
    
    NEW."adjustmentReason" := COALESCE(NEW."adjustmentReason", NEW.adjustment_reason);
    NEW.adjustment_reason := COALESCE(NEW.adjustment_reason, NEW."adjustmentReason");

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_record_aliases ON public.records;
CREATE TRIGGER trg_sync_record_aliases
BEFORE INSERT OR UPDATE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_record_aliases();

-- 6. TỐI ƯU HÓA CHỈ MỤC TRUY VẤN CHO BÚT TOÁN THOÁI THU
CREATE INDEX IF NOT EXISTS idx_records_is_adjustment ON public.records ("isAdjustment", "originalRecordId") WHERE "isAdjustment" = TRUE;
CREATE INDEX IF NOT EXISTS idx_records_decision_number ON public.records ("decisionNumber") WHERE "decisionNumber" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_refund_type ON public.records ("refundType") WHERE "refundType" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_refund_method ON public.records ("refundMethod") WHERE "refundMethod" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_hospital_code ON public.records ("hospitalCode") WHERE "hospitalCode" IS NOT NULL;

-- 7. CẬP NHẬT VIEW CRM ĐỂ BỔ SUNG CÁC TRƯỜNG THOÁI THU VÀ CƠ SỞ KCB BAN ĐẦU
DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers 
WITH (security_invoker = true) AS
SELECT 
    r.id,
    r.date,
    c.name,
    c.cccd,
    c.phone,
    c.address,
    c.bhxh,
    c.old_bhxh AS "oldBhxh",
    c.old_bhxh,
    r.type,
    r."subType",
    r.wage,
    r.months,
    r."supportPct",
    r.amount,
    c.status AS status,
    r."paymentStatus",
    r.notes,
    r."staffId",
    r."fromMonth",
    r."toMonth",
    r."basePremium",
    r."nnSupportPct",
    r."nnSupportAmount",
    r."dpSupportPct",
    r."dpSupportAmount",
    r."effectiveDate",
    r."targetDate",
    c.next_payment AS "nextPayment",
    c.next_payment_bhxh AS "nextPaymentBhxh",
    c.next_payment_bhyt AS "nextPaymentBhyt",
    c.has_bhxh AS "hasBhxh",
    c.has_bhyt AS "hasBhyt",
    r."householdId",
    r.members,
    r."recvName",
    r."recvPhone",
    r."recvAddress",
    r."isSubmittedBHXH",
    r."submissionBatch",
    r."submittedDate",
    r."actionType",
    c.dob,
    c.gender,
    c.nation,
    c.email,
    r.income,
    r.method,
    r."discountAmount",
    r."penaltyAmount",
    r.commission,
    r.support,
    r."baseSalarySnapshot",
    r."povertyStandardSnapshot",
    r."policyVersionId",
    r."appliedRates",
    r."isAdjustment",
    r."originalRecordId",
    r."adjustmentReason",
    r."refundType",
    r."decisionNumber",
    r."decisionDate",
    r."refundMethod",
    r."refundBeneficiaryName",
    r."refundBeneficiaryAccount",
    r."refundBeneficiaryBank",
    r."hospitalCode",
    r."hospitalName",
    c.customer_key AS "customerKey",
    c.id AS "customerId",
    c.total_contributions AS "totalContributions",
    c.total_amount_paid AS "totalAmountPaid"
FROM public.records r
LEFT JOIN public.customers c ON 
    (r."customerId" IS NOT NULL AND r."customerId" = c.id) OR
    (r."customer_id" IS NOT NULL AND r."customer_id" = c.id) OR
    (r."customerKey" IS NOT NULL AND r."customerKey" = c.customer_key) OR
    (r."customer_key" IS NOT NULL AND r."customer_key" = c.customer_key) OR
    (c.customer_key = public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone));
