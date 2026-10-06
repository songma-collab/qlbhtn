-- ======================================================================
-- MIGRATION 000015: TÁCH BẢNG KHÁCH HÀNG (CUSTOMERS SUMMARY TABLE) & TRIGGER ĐỒNG BỘ
-- Mục tiêu: Thay thế hoàn toàn câu truy vấn DISTINCT ON quét toàn bảng records,
-- tăng tốc độ truy vấn danh bạ khách hàng CRM lên gấp 5 - 10 lần.
-- ======================================================================

-- 0. Tự động kiểm tra và bổ sung các cột còn thiếu trên bảng records cũ
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "wage" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "supportPct" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "commission" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "support" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "householdId" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "effectiveDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "targetDate" DATE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "income" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "fromMonth" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "toMonth" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "discountAmount" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "penaltyAmount" NUMERIC;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "members" JSONB;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvName" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvPhone" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "recvAddress" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "ip_address" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "isSubmittedBHXH" BOOLEAN DEFAULT FALSE;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submissionBatch" TEXT;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS "submittedDate" DATE;

-- 1. Các hàm Helper phân quyền bảo mật
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = auth.uid() OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))))
      AND (LOWER(TRIM(role)) IN ('admin', 'quản trị viên', 'quan tri vien') OR role IS NULL)
      AND (status = 'Đang hoạt động' OR status IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff 
    WHERE (auth_user_id = auth.uid() OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))))
      AND (LOWER(TRIM(role)) IN ('admin', 'quản lý', 'quan ly', 'quản trị viên', 'quan tri vien') OR role IS NULL)
      AND (status = 'Đang hoạt động' OR status IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT public.is_manager_or_admin();
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id FROM public.staff 
  WHERE (auth_user_id = auth.uid() OR LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt() ->> 'email', ''))))
  LIMIT 1;
$$;

-- 2. Tạo bảng danh bạ khách hàng độc lập (Summary Table)
CREATE TABLE IF NOT EXISTS public.customers (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "customer_key" TEXT NOT NULL UNIQUE,
    "type" TEXT NOT NULL DEFAULT 'BHXH',
    "name" TEXT NOT NULL,
    "cccd" TEXT,
    "bhxh" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "dob" DATE,
    "gender" TEXT,
    "nation" TEXT,
    "email" TEXT,
    "latest_record_id" BIGINT,
    "latest_date" DATE,
    "effective_date" DATE,
    "next_payment" DATE,
    "latest_amount" NUMERIC DEFAULT 0,
    "status" TEXT DEFAULT 'Đang tham gia',
    "payment_status" TEXT DEFAULT 'Đã thu tiền',
    "notes" TEXT,
    "staff_id" TEXT,
    "total_contributions" INT DEFAULT 1,
    "total_amount_paid" NUMERIC DEFAULT 0,
    "household_id" TEXT,
    "members" JSONB,
    "recv_name" TEXT,
    "recv_phone" TEXT,
    "recv_address" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo Indexes hiệu năng cao cho bảng customers & records
CREATE INDEX IF NOT EXISTS idx_customers_type_status ON public.customers ("type", "status");
CREATE INDEX IF NOT EXISTS idx_customers_search_perf ON public.customers ("type", "name", "phone", "cccd", "bhxh");
CREATE INDEX IF NOT EXISTS idx_customers_next_payment ON public.customers ("next_payment", "status");
CREATE INDEX IF NOT EXISTS idx_customers_staff_id ON public.customers ("staff_id");
CREATE INDEX IF NOT EXISTS idx_customers_customer_key ON public.customers ("customer_key");

CREATE INDEX IF NOT EXISTS idx_records_lookup_perf 
  ON public.records ("bhxh", "cccd") 
  WHERE "paymentStatus" != 'Đã hủy';

-- 4. Hàm tính toán và sinh Khóa định danh khách hàng
CREATE OR REPLACE FUNCTION public.generate_customer_key(
    p_type TEXT,
    p_bhxh TEXT,
    p_cccd TEXT,
    p_name TEXT,
    p_phone TEXT
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_bhxh IS NOT NULL AND TRIM(p_bhxh) <> '' THEN
        RETURN UPPER(TRIM(p_type)) || '_BHXH_' || TRIM(p_bhxh);
    END IF;
    IF p_cccd IS NOT NULL AND TRIM(p_cccd) <> '' THEN
        RETURN UPPER(TRIM(p_type)) || '_CCCD_' || TRIM(p_cccd);
    END IF;
    RETURN UPPER(TRIM(p_type)) || '_NAME_' || LOWER(REGEXP_REPLACE(TRIM(COALESCE(p_name, '')), '\s+', '_', 'g')) || '_' || COALESCE(TRIM(p_phone), 'none');
END;
$$;

-- 5. Hàm Trigger tự động đồng bộ thời gian thực từ records sang customers
CREATE OR REPLACE FUNCTION public.sync_customer_from_record()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_rec RECORD;
    v_key TEXT;
    v_latest RECORD;
    v_total_contrib INT;
    v_total_paid NUMERIC;
BEGIN
    v_rec := COALESCE(NEW, OLD);
    IF v_rec IS NULL THEN RETURN v_rec; END IF;

    v_key := public.generate_customer_key(v_rec.type, v_rec.bhxh, v_rec.cccd, v_rec.name, v_rec.phone);

    SELECT * INTO v_latest
    FROM public.records r
    WHERE public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      AND r."paymentStatus" != 'Đã hủy'
    ORDER BY r.date DESC, r.id DESC
    LIMIT 1;

    IF v_latest IS NULL THEN
        DELETE FROM public.customers WHERE customer_key = v_key;
        RETURN v_rec;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_total_contrib, v_total_paid
    FROM public.records r
    WHERE public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone) = v_key
      AND r."paymentStatus" = 'Đã thu tiền';

    INSERT INTO public.customers (
        customer_key, type, name, cccd, bhxh, phone, address, dob, gender, nation, email,
        latest_record_id, latest_date, effective_date, next_payment, latest_amount,
        status, payment_status, notes, staff_id, total_contributions, total_amount_paid,
        household_id, members, recv_name, recv_phone, recv_address, updated_at
    ) VALUES (
        v_key, v_latest.type, v_latest.name, v_latest.cccd, v_latest.bhxh, v_latest.phone, v_latest.address,
        v_latest.dob, v_latest.gender, v_latest.nation, v_latest.email,
        v_latest.id, v_latest.date, v_latest."effectiveDate", v_latest."nextPayment", v_latest.amount,
        v_latest.status, v_latest."paymentStatus", v_latest.notes, v_latest."staffId",
        v_total_contrib, v_total_paid, v_latest."householdId",
        CASE WHEN v_latest.members IS NOT NULL THEN to_jsonb(v_latest.members) ELSE NULL END,
        v_latest."recvName",
        v_latest."recvPhone",
        v_latest."recvAddress",
        NOW()
    )
    ON CONFLICT (customer_key) DO UPDATE SET
        type = EXCLUDED.type,
        name = EXCLUDED.name,
        cccd = EXCLUDED.cccd,
        bhxh = EXCLUDED.bhxh,
        phone = EXCLUDED.phone,
        address = EXCLUDED.address,
        dob = EXCLUDED.dob,
        gender = EXCLUDED.gender,
        nation = EXCLUDED.nation,
        email = EXCLUDED.email,
        latest_record_id = EXCLUDED.latest_record_id,
        latest_date = EXCLUDED.latest_date,
        effective_date = EXCLUDED.effective_date,
        next_payment = EXCLUDED.next_payment,
        latest_amount = EXCLUDED.latest_amount,
        status = EXCLUDED.status,
        payment_status = EXCLUDED.payment_status,
        notes = EXCLUDED.notes,
        staff_id = EXCLUDED.staff_id,
        total_contributions = EXCLUDED.total_contributions,
        total_amount_paid = EXCLUDED.total_amount_paid,
        household_id = EXCLUDED.household_id,
        members = EXCLUDED.members,
        recv_name = EXCLUDED.recv_name,
        recv_phone = EXCLUDED.recv_phone,
        recv_address = EXCLUDED.recv_address,
        updated_at = NOW();

    RETURN v_rec;
END;
$$;

-- 6. Gắn Trigger tự động trên bảng records
DROP TRIGGER IF EXISTS trigger_sync_customer_from_record ON public.records;
CREATE TRIGGER trigger_sync_customer_from_record
AFTER INSERT OR UPDATE OR DELETE ON public.records
FOR EACH ROW
EXECUTE FUNCTION public.sync_customer_from_record();

-- 7. Tự động nạp dữ liệu ban đầu từ bảng records vào customers (Backfill Data)
DO $$
DECLARE
    r RECORD;
    v_key TEXT;
BEGIN
    FOR r IN (
        SELECT DISTINCT ON (public.generate_customer_key(type, bhxh, cccd, name, phone))
            *
        FROM public.records
        WHERE "paymentStatus" != 'Đã hủy'
        ORDER BY public.generate_customer_key(type, bhxh, cccd, name, phone), date DESC, id DESC
    ) LOOP
        v_key := public.generate_customer_key(r.type, r.bhxh, r.cccd, r.name, r.phone);
        
        INSERT INTO public.customers (
            customer_key, type, name, cccd, bhxh, phone, address, dob, gender, nation, email,
            latest_record_id, latest_date, effective_date, next_payment, latest_amount,
            status, payment_status, notes, staff_id, total_contributions, total_amount_paid,
            household_id, members, recv_name, recv_phone, recv_address, updated_at
        ) VALUES (
            v_key, r.type, r.name, r.cccd, r.bhxh, r.phone, r.address, r.dob, r.gender, r.nation, r.email,
            r.id, r.date, r."effectiveDate", r."nextPayment", r.amount,
            r.status, r."paymentStatus", r.notes, r."staffId",
            (SELECT COUNT(*) FROM public.records rec WHERE public.generate_customer_key(rec.type, rec.bhxh, rec.cccd, rec.name, rec.phone) = v_key AND rec."paymentStatus" = 'Đã thu tiền'),
            (SELECT COALESCE(SUM(amount), 0) FROM public.records rec WHERE public.generate_customer_key(rec.type, rec.bhxh, rec.cccd, rec.name, rec.phone) = v_key AND rec."paymentStatus" = 'Đã thu tiền'),
            r."householdId",
            CASE WHEN r.members IS NOT NULL THEN to_jsonb(r.members) ELSE NULL END,
            r."recvName",
            r."recvPhone",
            r."recvAddress",
            NOW()
        )
        ON CONFLICT (customer_key) DO UPDATE SET
            latest_record_id = EXCLUDED.latest_record_id,
            latest_date = EXCLUDED.latest_date,
            next_payment = EXCLUDED.next_payment,
            latest_amount = EXCLUDED.latest_amount,
            status = EXCLUDED.status,
            updated_at = NOW();
    END LOOP;
END;
$$;

-- 8. Nâng cấp View crm_customers trỏ trực tiếp sang bảng records qua JOIN bảng customers
DROP VIEW IF EXISTS public.crm_customers CASCADE;

CREATE OR REPLACE VIEW public.crm_customers AS
SELECT 
    r.id,
    r.date,
    r.name,
    r.cccd,
    r.phone,
    r.address,
    r.bhxh,
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
    r."householdId",
    r.members,
    r."recvName",
    r."recvPhone",
    r."recvAddress",
    r."isSubmittedBHXH",
    r."submissionBatch",
    r."submittedDate",
    r."actionType",
    r.dob,
    r.gender,
    r.nation,
    r.email,
    r.income,
    r.method,
    r."discountAmount",
    r."penaltyAmount",
    r.commission,
    r.support,
    c.total_contributions AS "totalContributions",
    c.total_amount_paid AS "totalAmountPaid"
FROM public.customers c
JOIN public.records r ON c.latest_record_id = r.id;

GRANT SELECT ON public.crm_customers TO anon, authenticated, service_role;

-- 9. Phân quyền RLS cho bảng customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public lookup on customers" ON public.customers;
CREATE POLICY "Public lookup on customers" ON public.customers
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "Staff select own customers" ON public.customers;
CREATE POLICY "Staff select own customers" ON public.customers
    FOR SELECT TO authenticated
    USING (
        public.is_admin_or_manager() 
        OR staff_id = public.current_staff_id()
    );

DROP POLICY IF EXISTS "Admin manage customers" ON public.customers;
CREATE POLICY "Admin manage customers" ON public.customers
    FOR ALL TO authenticated
    USING (public.is_admin_or_manager())
    WITH CHECK (public.is_admin_or_manager());

GRANT ALL ON public.customers TO authenticated, service_role;
GRANT SELECT ON public.customers TO anon;
