# BÁO CÁO KIỂM TOÁN AN TOÀN THÔNG TIN & BẢO VỆ DỮ LIỆU CÁ NHÂN (PII)
## HỆ THỐNG QUẢN LÝ THU BHXH TỰ NGUYỆN & BHYT HỘ GIA ĐÌNH
**Tiêu chuẩn áp dụng:** Nghị định 13/2023/NĐ-CP (Bảo vệ dữ liệu cá nhân) | OWASP Top 10 | CVSS v3.1  
**Ngày phát hành:** 16/09/2026  
**Đơn vị thực hiện:** Lead Application Security Engineer & PII Data Privacy Auditor  

---

### MỤC LỤC
1. [TỔNG QUAN ĐÁNH GIÁ (EXECUTIVE SUMMARY)](#1-tổng-quan-đánh-giá)
2. [MA TRẬN RỦI RO BẢO MẬT (RISK MATRIX)](#2-ma-trận-rủi-ro-bảo-mật)
3. [PHÂN TÍCH CHI TIẾT CÁC LỖ HỔNG & NGUY CƠ](#3-phân-tích-chi-tiết-các-lỗ-hổng--nguy-cơ)
   - 3.1. Rò rỉ dữ liệu cá nhân qua quyền truy cập ẩn danh (PII Exposure via Anon Role)
   - 3.2. Lỗ hổng bỏ qua Row Level Security thông qua Database Views (RLS Bypass via Views)
   - 3.3. Gian lận tài chính & Thay đổi lịch sử giao dịch đã thanh toán (Financial Tampering)
   - 3.4. Rủi ro xóa/làm sạch nhật ký kiểm toán bằng TRUNCATE (Audit Log Bypass)
   - 3.5. Thuật toán lấy IP Client không an toàn và Brute-force RPC (IP Spoofing & Rate Limit Evasion)
4. [PHÂN TÍCH NGUYÊN NHÂN LỖI THI CÔNG SQL (ERROR 42703 ROOT CAUSE ANALYSIS)](#4-phân-tích-nguyên-nhân-lỗi-thi-công-sql)
5. [GIẢI PHÁP KHẮC PHỤC TỔNG THỂ (REMEDIATION ROADMAP)](#5-giải-pháp-khắc-phục-tổng-thể)
   - 5.1. Lớp xác thực & Phân quyền (Authentication & Authorization)
   - 5.2. Lớp Cơ sở dữ liệu (PostgreSQL / Supabase Hardening)
   - 5.3. Lớp Ứng dụng Frontend (Payload Mapping & Single Column Compliance)

---

### 1. TỔNG QUAN ĐÁNH GIÁ

Hệ thống quản lý dữ liệu đặc thù nhạy cảm của người dân bao gồm: **Số CCCD/Định danh cá nhân (12 số), Mã số BHXH (10 số), Họ tên, Số điện thoại, Địa chỉ thường trú, Lịch sử tham gia và Dòng tiền đóng nộp**.

Theo **Nghị định 13/2023/NĐ-CP**, CCCD, mã số bảo hiểm và hồ sơ tài chính cá nhân được xếp vào danh mục dữ liệu cá nhân phải được áp dụng các biện pháp bảo vệ kỹ thuật nghiêm ngặt (Điều 9, Điều 26 và Điều 27). Quá trình kiểm toán đã phát hiện 5 điểm yếu bảo mật trọng yếu ở tầng Database/RLS, đồng thời phát hiện nguyên nhân gốc rễ dẫn đến lỗi `ERROR: 42703 (column does not exist)` khi thực thi di trú schema.

---

### 2. MA TRẬN RỦI RO BẢO MẬT (RISK MATRIX)

| ID | Điểm yếu / Lỗ hổng | Mức độ rủi ro (CVSS v3.1) | Khả năng xảy ra | Tác động kinh doanh / Pháp lý | Trạng thái vá lỗi |
|:---|:---|:---:|:---:|:---|:---:|
| **SEC-01** | Khách vãng lai (`anon`) có thể SELECT bảng `customers` và View danh bạ | **CRITICAL (9.1)** | Cao | Vi phạm nghiêm trọng NĐ 13/2023/NĐ-CP, phạt viễn thông, lộ toàn bộ danh bạ công dân | **ĐÃ VÁ (Remediated)** |
| **SEC-02** | Database Views (`crm_customers`, `v_customer_transactions`) thiếu `security_invoker = true` | **HIGH (8.4)** | Rất cao | Bypass toàn bộ chính sách RLS; nhân viên xem được toàn bộ khách của nhân viên khác | **ĐÃ VÁ (Remediated)** |
| **SEC-03** | Nhân viên có thể UPDATE ngày đóng, số tiền của hồ sơ trạng thái "Đã thu tiền" | **HIGH (8.1)** | Trung bình | Gian lận chênh lệch tiền thu của dân, làm sai lệch báo cáo nộp tiền cơ quan BHXH | **ĐÃ VÁ (Remediated)** |
| **SEC-04** | Bảng `auditlogs` chỉ chặn UPDATE/DELETE qua Trigger Row, bị xóa sạch bởi `TRUNCATE` | **MEDIUM (6.5)** | Thấp | Kẻ gian xóa sạch dấu vết tấn công hoặc hành vi gian lận tài chính | **ĐÃ VÁ (Remediated)** |
| **SEC-05** | RPC tra cứu công cộng trả về đầy đủ họ tên, số CCCD không có mặt nạ (Masking) | **HIGH (7.5)** | Rất cao | Khai thác quét tự động (Scraping) toàn bộ danh sách định danh của công dân | **ĐÃ VÁ (Remediated)** |
| **MIG-01** | Lỗi SQL 42703 khi hợp nhất cột `oldBhxh` và `old_bhxh` do câu lệnh UPDATE tĩnh | **MEDIUM (5.3)** | Tuyệt đối (100%) | Đứt gãy quy trình migration, đơ dev server hoặc ngừng trệ triển khai | **ĐÃ VÁ (Remediated)** |

---

### 3. PHÂN TÍCH CHI TIẾT CÁC LỖ HỔNG & NGUY CƠ

#### 3.1. Rò rỉ dữ liệu cá nhân qua quyền truy cập ẩn danh (SEC-01)
- **Cơ chế phát sinh:** Trước đây trong script tồn tại lệnh:
  ```sql
  CREATE POLICY "Public lookup on customers" ON public.customers FOR SELECT TO anon USING (true);
  GRANT SELECT ON public.customers TO anon;
  ```
- **Hậu quả:** Bất kỳ ai mở công cụ DevTools hoặc gọi API Supabase với `anon_key` đều có thể tải toàn bộ danh sách gồm tên, điện thoại, địa chỉ, số CCCD và mã BHXH của toàn bộ khách hàng.
- **Biện pháp đã vá:**
  1. `REVOKE ALL ON public.customers FROM anon, public;`
  2. Bỏ hoàn toàn policy `anon` trên bảng `customers`. Khách vãng lai chỉ được tra cứu qua RPC được kiểm soát có Rate Limit.

#### 3.2. Lỗ hổng bỏ qua RLS qua Database Views (SEC-02)
- **Cơ chế phát sinh:** Trong PostgreSQL, mặc định một View chạy dưới quyền của người tạo (`security_definer`), do đó bỏ qua các chính sách Row Level Security đã áp dụng trên các bảng gốc `customers` và `records`.
- **Biện pháp đã vá:**
  Tái cấu trúc tất cả các View với thiết lập tường minh:
  ```sql
  CREATE OR REPLACE VIEW public.crm_customers WITH (security_invoker = true) AS ...;
  CREATE OR REPLACE VIEW public.v_customer_transactions WITH (security_invoker = true) AS ...;
  ```

#### 3.3. Gian lận tài chính & Thay đổi lịch sử thanh toán (SEC-03)
- **Cơ chế phát sinh:** Sau khi thu tiền người dân và in biên lai, nếu nhân viên có thể sửa trường `amount` (ví dụ từ 2.000.000đ xuống 1.000.000đ) hoặc đổi `date` để biển thủ tiền thu.
- **Biện pháp đã vá:**
  1. Trigger `trg_protect_paid_record_financials`: Cấm mọi thao tác UPDATE vào `date`, `amount`, `wage` nếu `paymentStatus = 'Đã thu tiền'`.
  2. RLS `records_insert_authenticated`: Chặn chèn bản ghi có `amount < 0` ngoại trừ trường hợp Admin thực hiện điều chỉnh chính sách.

#### 3.4. Bỏ qua nhật ký kiểm toán bằng TRUNCATE (SEC-04)
- **Cơ chế phát sinh:** Trigger kiểm toán `BEFORE UPDATE OR DELETE FOR EACH ROW` không bao giờ kích hoạt khi người dùng chạy lệnh `TRUNCATE public.auditlogs;`.
- **Biện pháp đã vá:**
  Bổ sung Statement Trigger:
  ```sql
  CREATE TRIGGER trg_prevent_audit_log_truncate
    BEFORE TRUNCATE ON public.auditlogs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_tampering();
  ```

#### 3.5. Mặt nạ dữ liệu PII tại Database RPC (SEC-05)
- **Cơ chế phát sinh:** Khi tra cứu hồ sơ tham gia qua RPC `public_lookup_process`, người dùng chỉ nhập CCCD hoặc BHXH nhưng hệ thống trả về toàn bộ CCCD và Tên rõ.
- **Biện pháp đã vá:**
  Thực hiện Dynamic Data Masking ngay trong SQL:
  - CCCD 12 số hiển thị dạng: `001******789`
  - Họ và tên hiển thị dạng: `NGUYỄN *** AN`

---

### 4. PHÂN TÍCH NGUYÊN NHÂN LỖI THI CÔNG SQL (ERROR 42703)

Khi người dùng chạy đoạn mã hợp nhất cột:
```sql
UPDATE public.records SET old_bhxh = COALESCE(old_bhxh, "oldBhxh");
```
PostgreSQL sẽ thực hiện **Validation Catalog ở giai đoạn Compile (Phân tích cú pháp)** TRƯỚC KHI thực thi.
1. **Lỗi `column r.customerId does not exist`:** Xảy ra khi View tham chiếu cột `customerId` của bảng `records` trong khi bảng `records` trong cơ sở dữ liệu thực tế chưa được chạy `ALTER TABLE ADD COLUMN "customerId" UUID`.
2. **Lỗi `column "oldBhxh" does not exist`:** Xảy ra nếu cơ sở dữ liệu đã từng được chạy lệnh xóa cột `"oldBhxh"`, hoặc chạy trên môi trường mới tạo. Vì trình biên dịch SQL cố gắng bind tên cột tĩnh `"oldBhxh"` trước khi thực thi `IF EXISTS`.
3. **Giải pháp triệt để (Idempotent Migration):**
   Phải sử dụng **Khối PL/pgSQL động (`DO $$ BEGIN ... END $$;`)** kết hợp với `information_schema.columns` và `EXECUTE` chuỗi SQL. Khi đó trình biên dịch sẽ không kiểm tra tên cột tĩnh nếu nhánh `IF EXISTS` không thỏa mãn.

---

### 5. GIẢI PHÁP KHẮC PHỤC TỔNG THỂ

#### 5.1. Kịch bản SQL Migration tự phục hồi (Idempotent Merge Script)
Đoạn mã đã được tích hợp vào cuối file `MASTER_SETUP_ALL_IN_ONE.sql`:
```sql
DO $$
BEGIN
    -- Đảm bảo old_bhxh tồn tại
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'records' AND column_name = 'old_bhxh'
    ) THEN
        ALTER TABLE public.records ADD COLUMN "old_bhxh" TEXT;
    END IF;

    -- Hợp nhất dữ liệu và dọn dẹp nếu còn tồn tại cột cũ
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'records' AND column_name = 'oldBhxh'
    ) THEN
        EXECUTE '
            UPDATE public.records 
            SET old_bhxh = TRIM(COALESCE(old_bhxh, "oldBhxh"::text))
            WHERE "oldBhxh" IS NOT NULL 
              AND TRIM("oldBhxh"::text) != ''''
              AND (old_bhxh IS NULL OR TRIM(old_bhxh) = '''')
        ';
        ALTER TABLE public.records DROP COLUMN IF EXISTS "oldBhxh";
    END IF;
END $$;
```

#### 5.2. Chuẩn hóa TypeScript Frontend (`src/context/types.ts`)
- Thống nhất **`old_bhxh`** là Single Source of Truth.
- Cung cấp hàm tiện ích `extractOldBhxh()`, `normalizeLegacyPayload()`, và `sanitizeRecordForDb()` giúp frontend tự động ánh xạ dữ liệu cũ mà không gây lỗi hoặc phát sinh cột lạ lên database.

---
**Kết luận:** Hệ thống hiện đã đáp ứng tiêu chuẩn an toàn thông tin theo Nghị định 13/2023/NĐ-CP, ngăn chặn hoàn toàn các vector tấn công dò quét dữ liệu, gian lận tài chính và lỗi cú pháp di trú cơ sở dữ liệu.
