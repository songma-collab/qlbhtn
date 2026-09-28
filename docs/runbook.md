# CẨM NANG VẬN HÀNH & BẢO MẬT HỆ THỐNG (RUNBOOK)

**Hệ Thống:** Nền tảng Quản lý Thu & Dịch vụ công BHXH / BHYT Sông Mã  
**Cập nhật lần cuối:** 23/08/2026  
**Ngôn ngữ:** Tiếng Việt  

---

## 1. Cấu Hình Biến Môi Trường (Environment Variables)

### 1.1. Phía Frontend (Cloudflare Pages / Vite)
Cấu hình trong file `.env` hoặc trên Cloudflare Pages Settings:

```env
# Supabase URL & Anon Key (Công khai trên client)
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Public Turnstile site key (được phép xuất hiện ở frontend)
VITE_TURNSTILE_SITE_KEY=0x4AAAAAA...

# Tuyệt đối KHÔNG cấu hình VITE_GEMINI_API_KEY hoặc VITE_SERVICE_ROLE_KEY trên Frontend!
```

### 1.2. Phía Backend Supabase Edge Functions (Secrets)
Cấu hình thông qua Supabase CLI hoặc giao diện Supabase Dashboard -> **Edge Functions** -> **Secrets**:

```bash
# Cấu hình khóa bí mật OCR Gemini AI (Chỉ lưu trên Server)
supabase secrets set GEMINI_API_KEY=AIzaSy...

# Cấu hình khóa xác minh CAPTCHA (Tùy chọn nếu bật Cloudflare Turnstile)
supabase secrets set CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAAAAA...
supabase secrets set APP_ALLOWED_ORIGINS=https://your-domain.example,https://www.your-domain.example
```

---

## 2. Thiết Lập & Nâng Cấp Cơ Sở Dữ Liệu

### 2.1. Thiết lập 1 bước duy nhất (Khuyến nghị cho CSDL mới hoặc nâng cấp toàn diện)
Mở **SQL Editor** trên Supabase Dashboard, sao chép toàn bộ nội dung tệp [`MASTER_SETUP_ALL_IN_ONE.sql`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/MASTER_SETUP_ALL_IN_ONE.sql) và bấm **Run**.

Tệp này đã gộp toàn bộ:
- Cấu trúc 5 bảng dữ liệu (`staff`, `records`, `settings`, `policies`, `auditlogs`).
- Toàn bộ Views, Indexes hiệu năng cao và Triggers khóa kỳ tài chính / server audit.
- Toàn bộ các Hàm RPC xử lý dịch vụ công an toàn.
- Hệ thống chính sách phân quyền RLS 4 cấp và phân quyền thực thi `GRANT`.
- Cấu hình dữ liệu tham số mặc định.

### 2.2. Kiểm tra xác minh sau khi thiết lập
Mở **SQL Editor** và chạy lần lượt 2 kịch bản kiểm thử:

1. **Kiểm tra Phân quyền RLS & Toàn vẹn dữ liệu:**  
   Chạy tệp [`test_security_rls_suite.sql`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/test_security_rls_suite.sql). Kết quả trả về bảng chi tiết **5/5 bài test ✅ PASS** (chặn anon ghi trực tiếp, kiểm soát RPC, khóa kỳ tài chính, audit log).
2. **Kiểm tra Chống Rò Rỉ Dữ Liệu Cá Nhân (PII Leak Protection):**  
   Chạy tệp [`test_pii_leak_patch.sql`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/test_pii_leak_patch.sql). Kết quả trả về bảng xác nhận:
   - ✅ **PASS**: Chặn anon gọi trực tiếp `public_get_renewal_info` qua REST API.
   - ✅ **PASS**: RPC tra cứu `public_lookup_process` trả về đúng định dạng.
   - ✅ **PASS**: Cơ chế Rate-limit IP chặn đứng tấn công vét cạn (Brute-force) sau ngưỡng cho phép.

### 2.3. Lịch sử Migration tuần tự (Dành cho CI/CD hoặc Supabase CLI)
Các tệp migration tuần tự từ `01` đến `09` được lưu trữ tại thư mục `supabase/migrations/` để phục vụ các công cụ quản lý migration tự động khi cần.

---

---

## 3. Quy Trình Triển Khai Supabase Edge Functions

Hệ thống sử dụng **2 Edge Functions** chạy trên nền tảng Deno / Supabase Serverless:
1. **`public-customer-intake`**: Cổng dịch vụ công tiếp nhận đăng ký, tra cứu quá trình và gia hạn nhanh.
2. **`gemini-ocr`**: Dịch vụ AI OCR bóc tách thông tin tờ rời BHXH / VssID.

---

### 🔹 CÁCH 1: Triển khai nhanh qua Supabase CLI (Khuyến nghị cho kỹ sư)

#### Bước 1: Đăng nhập & Liên kết dự án
```bash
# 1. Đăng nhập Supabase
supabase login

# 2. Liên kết với dự án Supabase (Lấy Project Reference ID trên thanh URL Dashboard)
supabase link --project-ref <your-project-ref>
```

#### Bước 2: Cài đặt biến bí mật (Secrets)
```bash
# Cấu hình các khóa bí mật trên máy chủ
supabase secrets set GEMINI_API_KEY="AIzaSy..."
supabase secrets set CLOUDFLARE_TURNSTILE_SECRET_KEY="0x4AAAAAA..."
supabase secrets set APP_ALLOWED_ORIGINS="https://qlkhbhxh.pages.dev,http://localhost:5173"
```

#### Bước 3: Chạy lệnh Deploy 2 Functions
```bash
# 1. Deploy cổng dịch vụ công (bắt buộc --no-verify-jwt để khách vãng lai gọi được)
supabase functions deploy public-customer-intake --no-verify-jwt

# 2. Deploy dịch vụ AI OCR
supabase functions deploy gemini-ocr --no-verify-jwt
```

---

### 🔹 CÁCH 2: Triển khai trực tiếp qua Giao diện Web Supabase Dashboard & GitHub Actions

Nếu bạn không muốn cài đặt dòng lệnh CLI trên máy tính, bạn có thể thực hiện hoàn toàn trên trình duyệt:

#### Bước 1: Cài đặt Secrets trên giao diện Web
1. Truy cập **Supabase Dashboard** -> chọn dự án của bạn.
2. Menu bên trái -> chọn **Edge Functions** -> chọn tab **Secrets** (hoặc icon bánh răng Settings).
3. Bấm **Add new secret** và lần lượt thêm:
   - `GEMINI_API_KEY`: Dán khóa API lấy từ Google AI Studio.
   - `CLOUDFLARE_TURNSTILE_SECRET_KEY`: Dán khóa bí mật Cloudflare Turnstile (nếu có).
   - `APP_ALLOWED_ORIGINS`: `https://qlkhbhxh.pages.dev,http://localhost:5173`

#### Bước 2: Tạo hoặc chỉnh sửa Function trực tiếp trên Web UI
1. Trên Supabase Dashboard -> chọn **Edge Functions** -> Bấm **Create function**.
2. Đặt tên hàm: `public-customer-intake`.
3. Sao chép toàn bộ mã nguồn từ tệp [`supabase/functions/public-customer-intake/index.ts`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/supabase/functions/public-customer-intake/index.ts) dán vào khung soạn thảo.
4. **Quan trọng:** Tắt tùy chọn *"Enforce JWT Verification"* (hoặc gạt tắt JWT verification) để cho phép khách vãng lai gọi được.
5. Bấm **Deploy**.
6. Lặp lại tương tự cho hàm `gemini-ocr` bằng mã nguồn từ tệp [`supabase/functions/gemini-ocr/index.ts`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/supabase/functions/gemini-ocr/index.ts).

---

## 4. Hướng Dẫn Đẩy Mã Nguồn Lên GitHub & Triển Khai Lên Cloudflare Pages

### 4.1. Hướng dẫn tải mã nguồn lên GitHub (Upload to GitHub)

#### Bước 1: Tạo Repository mới trên GitHub
1. Đăng nhập vào [GitHub.com](https://github.com) -> Bấm dấu **+** ở góc trên cùng bên phải -> chọn **New repository**.
2. Đặt tên Repository (ví dụ: `qlkhbhxh`).
3. Chọn chế độ **Private** (khuyến nghị để bảo vệ mã nguồn nghiệp vụ) hoặc **Public**.
4. Không tích chọn tạo sẵn README hay .gitignore -> Bấm **Create repository**.

#### Bước 2: Đẩy mã nguồn từ máy tính lên GitHub
Mở Terminal / PowerShell tại thư mục dự án và chạy các lệnh:

```bash
# Di chuyển vào thư mục dự án
cd "E:\AI Agent\HOCSONGMA\qlkhBHXH\qlkhbhxh"

# Khởi tạo git (nếu chưa có)
git init

# Thêm toàn bộ file vào git
git add .

# Tạo commit đầu tiên
git commit -m "feat: initial commit for BHXH Song Ma platform"

# Đổi nhánh chính sang main
git branch -M main

# Liên kết với Repository GitHub của bạn (thay URL bên dưới bằng URL của bạn)
git remote add origin https://github.com/Mrphamm/qlkhbhxh.git

# Đẩy code lên GitHub
git push -u origin main
```

---

### 4.2. Hướng dẫn kết nối & Triển khai lên Cloudflare Pages (Deploy to Cloudflare)

Cloudflare Pages cung cấp nền tảng hosting CDN toàn cầu miễn phí, tốc độ cực nhanh và tự động có HTTPS/SSL.

#### Bước 1: Đăng nhập & Tạo ứng dụng Cloudflare Pages
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Ở thanh điều hướng bên trái, chọn **Workers & Pages** -> chọn tab **Pages**.
3. Bấm nút **Create application** -> Chọn tab **Pages** -> Bấm **Connect to Git**.

#### Bước 2: Kết nối tài khoản GitHub
1. Chọn tài khoản GitHub của bạn và cấp quyền truy cập vào kho chứa `qlkhbhxh`.
2. Chọn repository `qlkhbhxh` -> Bấm **Begin setup**.

#### Bước 3: Cấu hình thông số đóng gói (Build Settings)
Điền chính xác các thông số sau:
- **Project name:** `qlkhbhxh` (hoặc tên tùy chọn của bạn).
- **Production branch:** `main`
- **Framework preset:** Chọn **`Vite`**
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Root directory:** Để trống (hoặc `qlkhbhxh` nếu repo chứa cả thư mục cha).

#### Bước 4: Khai báo Biến môi trường (Environment Variables)
Bấm mở rộng mục **Environment variables (advanced)** -> Thêm 3 biến môi trường sau:

| Tên biến (Variable name) | Giá trị (Value) | Ghi chú |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Lấy tại Supabase Settings -> API |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Khóa anon công khai |
| `VITE_TURNSTILE_SITE_KEY` | `0x4AAAAAA...` | Public Site Key lấy từ Cloudflare Turnstile |

> **CẢNH BÁO AN NINH:** Tuyệt đối **KHÔNG** đưa `GEMINI_API_KEY` hay `SUPABASE_SERVICE_ROLE_KEY` vào Cloudflare Pages!

#### Bước 5: Bấm Triển khai (Save and Deploy)
1. Bấm nút **Save and Deploy**.
2. Cloudflare sẽ tự động cài đặt package và build trong khoảng 1 - 2 phút.
3. Khi hoàn tất, bạn sẽ nhận được một tên miền công khai dạng: `https://qlkhbhxh.pages.dev`.

#### Bước 6: Tự động hóa CI/CD (Cập nhật sau này)
- Từ nay, mỗi khi bạn sửa code trên máy tính và chạy:
  ```bash
  git add .
  git commit -m "cập nhật tính năng..."
  git push origin main
  ```
- Cloudflare Pages sẽ **tự động phát hiện, build lại và cập nhật website trực tiếp** mà bạn không cần phải làm thêm bất kỳ thao tác thủ công nào!

---

## 5. Khởi Tạo Tài Khoản Admin Đầu Tiên & Liên Kết Định Danh

### Bước 1: Tạo tài khoản Auth trên Supabase
1. Vào **Authentication** -> **Users** -> Bấm **Add user** -> **Create user**.
2. Nhập Email: `admin@bhxhsongma.vn` và Mật khẩu an toàn (tối thiểu 12 ký tự).
3. Sao chép lại chuỗi `User UID` (ví dụ: `8a7b3c2d-1234-5678-90ab-cdef12345678`).

### Bước 2: Tạo hoặc gán bản ghi nhân sự trong bảng `staff`
Chạy lệnh SQL sau trong **SQL Editor**:

```sql
INSERT INTO public.staff (id, name, email, role, status, area, staffCode, auth_user_id)
VALUES (
  'admin-root',
  'Quản Trị Viên Hệ Thống',
  'admin@bhxhsongma.vn',
  'Admin',
  'Đang hoạt động',
  'Sông Mã',
  'ADMIN01',
  '8a7b3c2d-1234-5678-90ab-cdef12345678'::uuid -- Dán User UID vào đây
)
ON CONFLICT (id) DO UPDATE 
SET auth_user_id = EXCLUDED.auth_user_id, role = 'Admin', status = 'Đang hoạt động';
```

---

## 6. Quy Trình Sao Lưu & Khôi Phục Dữ Liệu (Backup & Restore)

### 6.1. Sao lưu định kỳ (Automated / Manual Backup)
- Supabase tự động sao lưu hàng ngày (Daily Backup với Point-in-time Recovery).
- Để xuất bản sao lưu thủ công qua Supabase CLI:
  ```bash
  supabase db dump --data-only -f backup_data_$(date +%Y%m%d).sql
  ```

### 6.2. Khôi phục dữ liệu khẩn cấp
```bash
psql -h db.your-project.supabase.co -U postgres -d postgres -f backup_data_YYYYMMDD.sql
```

---

## 7. Quy Trình Ứng Phó Sự Cố & Xoay Vòng Secret (Incident Response)

1. **Khi phát hiện rò rỉ Gemini API Key:**
   - Đổi key mới trên Google AI Studio.
   - Cập nhật key mới ngay vào Supabase Secrets: `supabase secrets set GEMINI_API_KEY=new_key`.
   - Xóa key cũ trên Google Console.
2. **Khi phát hiện tài khoản nhân viên có hành vi đáng ngờ:**
   - Vào tab **Nhân Sự** trên phần mềm quản trị -> Chuyển trạng thái nhân viên sang **"Tạm khóa"**.
   - Ngay lập tức, tài khoản này sẽ bị RLS và Edge Function OCR từ chối toàn bộ mọi quyền truy cập dữ liệu.

