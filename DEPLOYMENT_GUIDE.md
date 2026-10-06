# SỔ TAY HƯỚNG DẪN TRIỂN KHAI & VẬN HÀNH HỆ THỐNG
## HỆ THỐNG QUẢN LÝ THU & DỊCH VỤ CÔNG BHXH / BHYT SÔNG MÃ (QLBHTN)

> **Loại tài liệu:** Hướng dẫn kỹ thuật chuẩn hóa (Master Deployment & Operations Manual)  
> **Kiến trúc:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4 | Database: Supabase PostgreSQL (RLS 4 cấp + GIN Trigram) | Hosting: Cloudflare Pages + Edge Network  
> **Lưu trữ:** File tài liệu sống (Living Document) – cập nhật liên tục mọi quy trình triển khai và mở rộng của hệ thống.

---

## 📌 LỊCH SỬ CẬP NHẬT (CHANGELOG)

| Phiên bản | Ngày cập nhật | Người thực hiện | Nội dung cập nhật |
| :--- | :--- | :--- | :--- |
| **v2.0.0** | 05/10/2026 | Ban Kỹ thuật / Đội phát triển | **Nâng cấp Toàn diện 5 Giai đoạn Kiến trúc (Enterprise Grade):**<br>1. Chuẩn hóa 100% Database `snake_case` & Hợp nhất Master Setup.<br>2. Xây dựng Service Layer (Anti-Corruption Layer).<br>3. Phân rã God Context & Modular UI Component.<br>4. Thiết lập Sổ cái Tài chính Bất biến (`financial_ledger`) Single Source of Truth.<br>5. Siết chặt TypeScript Strict Mode khắt khe 100%, Security Audit RPC và thiết lập GitHub Actions CI/CD Pipeline. |
| **v1.1.0** | 28/09/2026 | Ban Kỹ thuật / Đội phát triển | Bổ sung Mục 7.6: Sổ tay chuẩn hóa nhập liệu Excel (Phân tách Sổ quỹ & Danh bạ CRM, bộ parser thông minh chống lỗi Unicode NFD tiếng Việt, tính hạn đóng chính xác, hướng dẫn dọn dẹp bản ghi rác) |
| **v1.0.0** | 28/09/2026 | Ban Kỹ thuật / Đội phát triển | Khởi tạo tài liệu triển khai chuẩn: Supabase DB + GitHub + Cloudflare Pages + CI/CD tự động |

---

## 📑 MỤC LỤC
1. [Tổng Quan Kiến Trúc Triển Khai](#1-tổng-quan-kiến-trúc-triển-khai)
2. [Thiết Lập Cơ Sở Dữ Liệu Supabase](#2-thiết-lập-cơ-sở-dữ-liệu-supabase)
3. [Quản Lý Mã Nguồn Với GitHub](#3-quản-lý-mã-nguồn-với-github)
4. [Triển Khai Lên Cloudflare Pages](#4-triển-khai-lên-cloudflare-pages)
5. [Quy Trình Kiểm Tra & Nghiệm Thu Sau Triển Khai](#5-quy-trình-kiểm-tra--nghiệm-thu-sau-triển-khai)
6. [Quy Trình Cập Nhật & CI/CD Tự Động (Zero Downtime)](#6-quy-trình-cập-nhật--cicd-tự-động-zero-downtime)
7. [Các Hướng Dẫn Kỹ Thuật Mở Rộng (Bổ sung liên tục)](#7-các-hướng-dẫn-kỹ-thuật-mở-rộng-bổ-sung-liên-tục)
   - [7.1. Cấu hình Tên miền riêng (Custom Domain) & SSL](#71-cấu-hình-tên-miền-riêng-custom-domain--ssl)
   - [7.2. Triển khai Supabase Edge Functions (`gemini-ocr`, `public-intake`)](#72-triển-khai-supabase-edge-functions-gemini-ocr-public-intake)
   - [7.3. Kích hoạt Cloudflare Turnstile chống Spam/Bot](#73-kích-hoạt-cloudflare-turnstile-chống-spambot)
   - [7.4. Quy trình sao lưu dự phòng CSDL (Database Backup & Disaster Recovery)](#74-quy-trình-sao-lưu-dự-phòng-csdl-database-backup--disaster-recovery)
   - [7.5. Xử lý sự cố thường gặp (Troubleshooting FAQs)](#75-xử-lý-sự-cố-thường-gặp-troubleshooting-faqs)
   - [7.6. Chuẩn hóa & Xử lý sự cố nhập liệu Excel (CRM vs Sổ Quỹ Giao Dịch)](#76-chuẩn-hóa--xử-lý-sự-cố-nhập-liệu-excel-crm-vs-sổ-quỹ-giao-dịch)

---

## 1. TỔNG QUAN KIẾN TRÚC TRIỂN KHAI

Hệ thống được thiết kế theo mô hình **JAMstack Enterprise & Serverless BaaS** hiện đại, tách biệt hoàn toàn giữa giao diện người dùng và tầng dữ liệu:

```
┌─────────────────────────────────────────────────────────────┐
│                    NGƯỜI DÙNG / CÁN BỘ                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS (Edge CDN)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               CLOUDFLARE PAGES (Frontend SPA)               │
│  - React 19 + TypeScript 5.8 (Strict Mode 100%)             │
│  - Service Layer (Anti-Corruption Layer)                    │
│  - Phân phối toàn cầu qua Cloudflare Edge Network           │
│  - public/_redirects: SPA routing chống lỗi 404             │
│  - public/_headers: CSP cho phép kết nối Supabase, VietQR   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / WSS (REST & Realtime)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Backend BaaS)                   │
│  - PostgreSQL 15+ (100% snake_case)                         │
│  - Financial Ledger (Bút toán sổ cái kép bất biến)          │
│  - Supabase Auth (Quản lý đăng nhập cán bộ thu)             │
│  - Row Level Security (RLS) 4 cấp + Triggers tài chính      │
│  - Stored Procedures / RPCs tìm kiếm & Rate-limit an toàn   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. THIẾT LẬP CƠ SỞ DỮ LIỆU SUPABASE

### 2.1. Khởi tạo Project Supabase
1. Truy cập [https://supabase.com](https://supabase.com) và đăng nhập.
2. Bấm **New Project**:
   - **Organization**: Chọn tổ chức của bạn.
   - **Name**: `QLBHTN-SongMa` (hoặc tên dự án bạn muốn đặt).
   - **Database Password**: Thiết lập mật khẩu an toàn và lưu trữ cẩn thận.
   - **Region**: Chọn `Southeast Asia (Singapore)` để có độ trễ kết nối thấp nhất tại Việt Nam.
3. Bấm **Create new project** và chờ khoảng 1 - 2 phút để hệ thống khởi tạo.

### 2.2. Nạp Cấu Trúc Bảng Dữ Liệu (Schema, RLS, Triggers, RPCs & Financial Ledger)
Toàn bộ kiến trúc dữ liệu chuẩn hóa của dự án đã được tổng hợp hoàn chỉnh trong file:
👉 **`MASTER_SETUP_ALL_IN_ONE.sql`** *(ngay tại thư mục gốc của dự án)*.

**Cách thực hiện (Khuyến nghị 1-Click Setup):**
1. Tại giao diện quản trị Supabase, chọn mục **SQL Editor** ở thanh điều hướng bên trái.
2. Nhấn **New query**.
3. Mở file `MASTER_SETUP_ALL_IN_ONE.sql` trên máy tính của bạn, sao chép toàn bộ nội dung và dán vào cửa sổ SQL Editor.
4. Nhấn nút **Run** (hoặc nhấn tổ hợp phím `Ctrl + Enter`).
5. Kết quả báo `Success. No rows returned` nghĩa là toàn bộ 11 bảng dữ liệu (bao gồm `financial_ledger`), 3 Views, RLS 4 cấp, Triggers tính toán & khóa tài chính, GIN Trigram và 25+ RPCs đã được thiết lập thành công.

> [!TIP]
> **Bộ Migration Module hóa (dành cho Supabase CLI):**  
> Thư mục `supabase/migrations/` được phân tách khoa học theo chuẩn:  
> - `0001_baseline_schema.sql`: Lược đồ bảng 100% `snake_case`, kiểu dữ liệu và ràng buộc.  
> - `0002_security_rls.sql`: Chính sách RLS 4 cấp và helper phân quyền.  
> - `0003_rpc_and_functions.sql`: Stored Procedures, Rate-limiting, logic nghiệp vụ.  
> - `0004_triggers_and_audit.sql`: Triggers kiểm toán, tự động tính toán và date healing.  
> - `20261005000001_create_financial_ledger.sql`: Bảng sổ cái kép, trigger bất biến, logic bù trừ thoái thu.  
> - `archive/`: Chứa các bản vá cũ đã được hợp nhất an toàn.

### 2.3. Lấy Thông Tin API Key Kết Nối
1. Trên Supabase Dashboard, bấm vào biểu tượng bánh răng **Project Settings** (góc dưới bên trái) $\rightarrow$ chọn **API**.
2. Lưu lại 2 thông số sau:
   - **Project URL**: Ví dụ `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **Project API keys -> anon / public**: Chuỗi JWT bắt đầu bằng `eyJhbGci...`

### 2.4. Cấp Tài Khoản Quản Trị Viên Đầu Tiên (Admin Staff)
1. Trên Supabase Dashboard, vào mục **Authentication** $\rightarrow$ **Users** $\rightarrow$ chọn **Add user** $\rightarrow$ **Create user**.
2. Điền email (ví dụ: `admin@bhxhsongma.gov.vn`) và thiết lập mật khẩu ban đầu.
3. Quay lại **SQL Editor**, chạy đoạn mã sau để liên kết tài khoản Auth với bảng nhân sự cán bộ thu (`staff`) và phân quyền Admin:

```sql
INSERT INTO public.staff (id, name, email, role, status, auth_user_id)
VALUES (
    'STF-ADMIN',
    'Quản trị viên Hệ thống',
    'admin@bhxhsongma.gov.vn',
    'Admin',
    'Đang hoạt động',
    (SELECT id FROM auth.users WHERE email = 'admin@bhxhsongma.gov.vn')
)
ON CONFLICT (id) DO UPDATE SET 
    role = 'Admin',
    status = 'Đang hoạt động',
    auth_user_id = (SELECT id FROM auth.users WHERE email = 'admin@bhxhsongma.gov.vn');
```

---

## 3. QUẢN LÝ MÃ NGUỒN VỚI GITHUB

### 3.1. Cài đặt Git (nếu máy chưa có)
Mở cửa sổ PowerShell trên Windows và chạy lệnh sau để cài đặt Git tự động:
```powershell
winget install --id Git.Git -e
```
*(Sau khi cài đặt xong, đóng cửa sổ PowerShell và mở lại để hệ thống nhận diện lệnh `git`)*.

### 3.2. Kiểm tra an toàn trước khi đẩy code
File `.gitignore` của dự án đã được cấu hình chặt chẽ để loại trừ:
- `node_modules/` (thư viện nặng)
- `dist/`, `build/` (file build tạm)
- `.env*` (biến môi trường chứa secret key - **không bao giờ đẩy lên Git**)
- `*.xlsx` (file dữ liệu nội bộ)

### 3.3. Tạo Repository trên GitHub và đẩy mã nguồn
1. Đăng nhập [https://github.com](https://github.com) và bấm nút **New** (hoặc truy cập [https://github.com/new](https://github.com/new)).
2. Điền tên Repository: `qlbhtn-songma`.
3. Chọn chế độ **Private** (khuyến nghị cho dự án cơ quan/đại lý thu).
4. **Không** chọn *"Add a README file"*, *"Add .gitignore"*.
5. Bấm **Create repository**.
6. Tại thư mục dự án (`d:\HTML\Gravity\QLBHTN`), mở PowerShell và chạy các lệnh:

```powershell
# 1. Khởi tạo git repo cục bộ với nhánh chính main
git init -b main

# 2. Thêm tất cả tệp tin mã nguồn
git add .

# 3. Tạo commit đầu tiên
git commit -m "feat: initial commit - QLBHTN v1.0.0 standardized"

# 4. Gắn kết nối với GitHub (thay <tai-khoan> bằng username GitHub của bạn)
git remote add origin https://github.com/<tai-khoan>/qlbhtn-songma.git

# 5. Đẩy toàn bộ mã nguồn lên nhánh main
git push -u origin main
```

---

## 4. TRIỂN KHAI LÊN CLOUDFLARE PAGES

### 4.1. Kết nối Cloudflare Pages với GitHub Repository
1. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com).
2. Tại menu bên trái, chọn **Workers & Pages**.
3. Chọn tab **Pages** $\rightarrow$ bấm **Create application** (hoặc **Connect to Git**).
4. Bấm **Connect GitHub**, cấp quyền truy cập vào repo `qlbhtn-songma`.
5. Chọn repository `qlbhtn-songma` $\rightarrow$ bấm **Begin setup**.

### 4.2. Thiết lập cấu hình Build Settings
Điền các giá trị chính xác theo bảng sau:

| Mục cấu hình | Giá trị thiết lập | Mục đích |
| :--- | :--- | :--- |
| **Project name** | `qlbhtn-songma` | Định danh dự án, URL mặc định: `qlbhtn-songma.pages.dev` |
| **Production branch** | `main` | Nhánh phát hành chính thức |
| **Framework preset** | `Vite` | Cloudflare tối ưu hóa tiến trình đóng gói Vite |
| **Build command** | `npm run build` | Lệnh biên dịch mã nguồn React TypeScript |
| **Build output directory** | `dist` | Thư mục chứa tài nguyên tĩnh sau khi build |

### 4.3. Cấu hình Biến Môi Trường (Environment Variables)
Bấm mở rộng mục **Environment variables (advanced)** và thêm các cặp giá trị:

| Variable Name | Value | Giải thích |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20` | Ép Cloudflare dùng Node.js 20 tương thích Vite 6 & React 19 |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL Supabase lấy tại Bước 2.3 |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Khóa Anon lấy tại Bước 2.3 |
| `VITE_TURNSTILE_SITE_KEY` | *(Tùy chọn)* | Site Key của Cloudflare Turnstile (nếu bật chống bot) |

### 4.4. Đảm bảo cấu hình SPA Routing & CSP Headers
Dự án đã tích hợp sẵn 2 tệp tin cấu hình tự động trong thư mục `public/`:
1. **`public/_redirects`**: Chứa quy tắc `/* /index.html 200` giúp toàn bộ URL con (`/admin`, `/calc`, `/tracuu`) khi tải lại trang (F5) không bao giờ bị lỗi 404 Not Found.
2. **`public/_headers`**: Cấu hình Content Security Policy (CSP), cho phép kết nối an toàn tới `https://*.supabase.co`, `wss://*.supabase.co`, `https://api.vietqr.io` và `https://challenges.cloudflare.com`.

### 4.5. Thực hiện Triển khai
1. Bấm **Save and Deploy**.
2. Quá trình đóng gói sẽ tự động chạy trong khoảng 60 - 90 giây.
3. Khi màn hình xuất hiện thông báo xanh lá **"Success! Your site is deployed!"**, bạn có thể bấm vào đường link để truy cập ứng dụng trực tiếp trên Internet.

---

## 5. QUY TRÌNH KIỂM TRA & NGHIỆM THU SAU TRIỂN KHAI

| STT | Hạng mục kiểm tra | Thao tác thực hiện | Kết quả mong đợi |
| :---: | :--- | :--- | :--- |
| **1** | **SPA Routing (F5 Reload)** | Vào trang `/calc` hoặc `/admin`, nhấn phím `F5` tải lại trang | Trang web hiển thị bình thường, tuyệt đối **không** hiện lỗi `404 Not Found`. |
| **2** | **Kết nối Supabase (CSP)** | Nhấn `F12` $\rightarrow$ chọn tab **Console** và **Network** | Không có thông báo đỏ vi phạm CSP (`Content-Security-Policy`), request trả về mã `200 OK`. |
| **3** | **Đăng nhập Quản trị** | Truy cập `/admin`, nhập email `admin@bhxhsongma.gov.vn` và mật khẩu | Đăng nhập thành công, nạp thông tin quyền hạn Admin và hồ sơ cán bộ. |
| **4** | **Tra cứu & Phân trang** | Vào tab CRM, nhập số CCCD hoặc mã thẻ BHYT vào ô tìm kiếm | Kết quả trả về tức thì dưới 100ms nhờ RPC `crm_search_customers` và GIN Trigram index. |
| **5** | **Biểu phí BHXH / BHYT** | Thử chức năng tính phí đóng BHXH tự nguyện, BHYT hộ gia đình | Tính toán chính xác theo chuẩn nghèo 1.500.000đ và mức lương cơ sở hiện hành. |

---

## 6. QUY TRÌNH CẬP NHẬT & CI/CD TỰ ĐỘNG (ZERO DOWNTIME & QUALITY GATE)

Mỗi khi bạn phát triển thêm tính năng hoặc sửa lỗi mã nguồn ở máy tính cục bộ:

```powershell
# 1. Kiểm tra trạng thái các file thay đổi
git status

# 2. Kiểm thử chất lượng cục bộ trước khi push (Khuyên nghị)
npm run verify-baseline

# 3. Thêm file và commit nội dung
git add .
git commit -m "feat: bổ sung tính năng mới / fix: khắc phục giao diện"

# 4. Đẩy lên nhánh main
git push origin main
```

**Cơ chế hoạt động của Hàng rào Chất lượng (Quality Gate):**
1. **GitHub Actions (`.github/workflows/production.yml`):**
   - Tự động kích hoạt khi có lệnh `push` hoặc `pull_request` vào nhánh `main` hoặc `master`.
   - **Bước 1:** Cài đặt môi trường Node.js 20 LTS.
   - **Bước 2 (Strict Typecheck):** Chạy `npm run typecheck` (`tsc --noEmit`) dưới chế độ kiểm tra nghiêm ngặt nhất (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
   - **Bước 3 (Test Suite):** Chạy toàn bộ 50 Test Suites (461 bài kiểm thử Vitest) xác thực toàn vẹn tài chính, RLS và nghiệp vụ.
   - **Bước 4 (Production Build):** Biên dịch gói phân phối Vite (`dist/`).
2. **Cloudflare Pages Deployment:**
   - Sau khi CI vượt qua 100% kiểm thử, Cloudflare Pages tự động triển khai phiên bản mới ngầm trên mạng lưới Edge toàn cầu mà **không có bất kỳ thời gian gián đoạn nào (Zero Downtime)**.

---

## 7. CÁC HƯỚNG DẪN KỸ THUẬT MỞ RỘNG (BỔ SUNG LIÊN TỤC)

### 7.1. Cấu hình Tên miền riêng (Custom Domain) & SSL
Nếu cơ quan/đại lý có tên miền riêng (ví dụ: `bhxhsongma.vn` hoặc `qlthu.bhxhsongma.gov.vn`):
1. Vào Cloudflare Pages $\rightarrow$ chọn dự án `qlbhtn-songma` $\rightarrow$ chọn tab **Custom domains**.
2. Bấm nút **Set up a custom domain**.
3. Điền tên miền bạn sở hữu và bấm **Continue**.
4. Trỏ bản ghi DNS theo hướng dẫn của Cloudflare:
   - Nếu tên miền quản lý tại Cloudflare DNS: Hệ thống sẽ tự động kích hoạt CNAME chỉ sau 1 phút.
   - Nếu tên miền ở nhà cung cấp khác (như PA Vietnam, Mắt Bão, Viettel): Tạo bản ghi CNAME trỏ về `qlbhtn-songma.pages.dev`.
5. Cloudflare sẽ tự động cấp chứng chỉ bảo mật SSL/TLS (HTTPS) hoàn toàn miễn phí.

---

### 7.2. Triển khai Supabase Edge Functions (`gemini-ocr`, `public-intake`)
Dự án có sẵn 2 Edge Functions phục vụ quét OCR tự động căn cước/thẻ BHXH và tiếp nhận hồ sơ trực tuyến trong thư mục `supabase/functions/`:

**Cài đặt Supabase CLI và Deploy:**
```powershell
# 1. Đăng nhập Supabase CLI
npx supabase login

# 2. Liên kết với project của bạn (lấy Project Ref ID trong Project Settings)
npx supabase link --project-ref <your-project-ref-id>

# 3. Thiết lập biến môi trường bí mật trên Supabase cho Gemini AI
npx supabase secrets set GEMINI_API_KEY="AIzaSy..."

# 4. Triển khai 2 Edge Functions
npx supabase functions deploy gemini-ocr
npx supabase functions deploy public-customer-intake
```

---

### 7.3. Kích hoạt Cloudflare Turnstile chống Spam/Bot
Để bảo vệ form đăng ký dịch vụ công trực tuyến khỏi các công cụ spam tự động:
1. Tại Cloudflare Dashboard $\rightarrow$ chọn mục **Turnstile** ở thanh điều hướng bên trái.
2. Bấm **Add widget**:
   - **Widget name**: `Turnstile QLBHTN`
   - **Domain**: Thêm `qlbhtn-songma.pages.dev` và tên miền riêng của bạn.
   - **Widget Mode**: Chọn `Managed` (thông minh, tự động vượt qua không cần click).
3. Lấy **Site Key** và thêm vào Environment Variables trên Cloudflare Pages:
   - `VITE_TURNSTILE_SITE_KEY` = `<Site Key>`
4. Lấy **Secret Key** và cấu hình vào Edge Function hoặc Backend nếu cần xác minh token máy chủ.

---

### 7.4. Quy trình sao lưu dự phòng CSDL (Database Backup & Disaster Recovery)
1. **Sao lưu tự động của Supabase (Daily Backup):**
   - Mặc định Supabase tự động sao lưu CSDL hàng ngày tại mục **Database** $\rightarrow$ **Backups**.
2. **Xuất bản sao lưu thủ công (Manual SQL Dump):**
   - Có thể chạy lệnh sau bất cứ lúc nào qua Supabase CLI để tải toàn bộ dữ liệu về lưu trữ ngoại tuyến:
   ```powershell
   npx supabase db dump --project-ref <your-project-ref-id> -f "backup_$(Get-Date -Format 'yyyyMMdd_HHmm').sql"
   ```

---

### 7.5. Xử lý sự cố thường gặp (Troubleshooting FAQs)

#### Q1: Sau khi deploy, trang web bị trắng trang hoặc báo lỗi `Failed to fetch`?
* **Nguyên nhân:** Chưa cấu hình hoặc cấu hình sai biến môi trường `VITE_SUPABASE_URL` hoặc `VITE_SUPABASE_ANON_KEY`.
* **Cách xử lý:** Vào Cloudflare Pages $\rightarrow$ **Settings** $\rightarrow$ **Environment variables**, kiểm tra xem các giá trị có bị thừa khoảng trắng hay không, sau đó vào tab **Deployments** bấm **Retry deployment**.

#### Q2: Bấm F5 trên trang `/admin` bị lỗi 404 Not Found?
* **Nguyên nhân:** File `public/_redirects` bị thiếu hoặc không được đóng gói vào thư mục `dist/`.
* **Cách xử lý:** Đảm bảo file `public/_redirects` có dòng `/* /index.html 200` và chạy lại `npm run build` để kiểm tra file xuất hiện trong thư mục `dist/_redirects`.

#### Q3: Cán bộ thu đăng nhập báo lỗi tài khoản không hợp lệ hoặc không có quyền truy cập?
* **Nguyên nhân:** Tài khoản đã tạo trong Supabase Auth nhưng chưa được gán bản ghi tương ứng trong bảng `public.staff`.
* **Cách xử lý:** Thực hiện lại Bước 2.4 để chạy lệnh `INSERT INTO public.staff ...` liên kết `auth_user_id`.

---

### 7.6. Chuẩn hóa & Xử lý sự cố nhập liệu Excel (CRM vs Sổ Quỹ Giao Dịch)

Hệ thống QLBHTN áp dụng bộ công cụ nhập khẩu Excel thông minh (`src/utils/excelImportHelper.ts`) giải quyết triệt để các bài toán thực tế khi xử lý dữ liệu BHXH/BHYT:

#### 1. Phân biệt rõ ràng 2 luồng nhập liệu:
* **Luồng 1 - Nhập Sổ quỹ Thu tiền (Giao dịch tài chính):**
  - **Vị trí thao tác:** Vào menu **Tài chính BHXH** (hoặc BHYT) $\rightarrow$ Bấm nút **[Nhập Excel]** màu xanh lá trên thanh công cụ.
  - **Mục đích:** Ghi nhận tiền thu thực tế từ người tham gia, tính hoa hồng cho nhân viên thu, ghi nhận đợt nộp cho cơ quan BHXH.
  - **Cơ chế:** Đọc đầy đủ cột Số tiền thu, Mức thu nhập, Từ tháng - Đến tháng, Phương thức đóng, Ngân sách NN hỗ trợ, Tự động tính tỷ lệ hoa hồng theo chính sách hiện hành.
* **Luồng 2 - Nhập Danh bạ Khách hàng (Quản lý hồ sơ CRM):**
  - **Vị trí thao tác:** Vào menu **Quản lý BHXH** (hoặc BHYT) $\rightarrow$ Bấm nút **[Nhập Excel]**.
  - **Mục đích:** Lưu trữ hồ sơ nhân thân công dân (Họ tên, CCCD, SĐT, Địa chỉ, Ngày sinh, Hạn nộp tiếp theo).
  - **Hộp thoại tùy chọn thông minh:** Nếu file Excel tải lên có chứa thông tin tài chính (tiền đóng, kỳ đóng), hệ thống sẽ mở bảng hỏi xác nhận 2 chế độ:
    + *Lựa chọn 1: Đồng bộ toàn diện (Khuyên dùng):* Ghi nhận giao dịch vào Sổ quỹ + Cập nhật hồ sơ Danh bạ.
    + *Lựa chọn 2: Chỉ cập nhật Danh bạ khách hàng:* Chỉ cập nhật nhân thân vào bảng khách hàng, **tuyệt đối không tạo bản ghi $0$ đ phát sinh trong Sổ quỹ**.

#### 2. Các cơ chế tự động bảo vệ dữ liệu:
* **Chống lỗi lệch mã Unicode (NFC vs NFD):** Tự động khử toàn bộ lỗi so khớp chuỗi do gõ Unikey dựng sẵn/tổ hợp (ví dụ: `Tổng Tiền` và `Tổng Tiền`).
* **Tính toán hạn nộp tiếp theo khoa học:** Thay vì cộng bừa 365 ngày (1 năm), hệ thống tự động suy diễn từ tháng kết thúc đóng (`toMonth`). Ví dụ: Đóng đến tháng `09/2026` $\rightarrow$ Hạn nộp kế tiếp sẽ là ngày `15/10/2026`.
* **Gọi lại thông tin 100% khi Sửa / Gia hạn:** Modal đăng ký nhận diện đầy đủ `record` và `initialData`, giữ nguyên Họ tên, CCCD, Mức thu nhập, Kỳ đóng, Nhân viên thu khi mở form.

#### 3. Quy trình dọn dẹp các bản ghi phát sinh lỗi $0$ đ trước đó:
Nếu trong hệ thống đã lỡ nhập các dòng giao dịch $0$ đ hoặc thiếu kỳ hạn từ phiên bản cũ:
1. Truy cập vào menu **Tài chính BHXH** (`/admin/tai-chinh-bhxh`).
2. Tích vào ô vuông đầu dòng của các giao dịch bị lỗi ($0$ đ hoặc thiếu thông tin kỳ đóng).
3. Bấm vào nút **Xóa hàng loạt** (biểu tượng Thùng rác đỏ) trên thanh công cụ.
4. Xác nhận xóa để làm sạch sổ quỹ.
5. Thực hiện nhập lại file Excel bằng nút **[Nhập Excel]** mới; toàn bộ số tiền, kỳ hạn và hoa hồng sẽ được hiển thị chuẩn xác 100%.

---

> 📝 *Ghi chú cho các lập trình viên & quản trị viên:*  
> Khi bổ sung tính năng mới yêu cầu thêm biến môi trường, webhook hoặc kiến trúc serverless mới, vui lòng cập nhật trực tiếp vào **Mục 7** của tài liệu này để duy trì tính nhất quán cho toàn bộ dự án.

