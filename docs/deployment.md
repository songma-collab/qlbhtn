# 📖 HƯỚNG DẪN CHI TIẾT TRIỂN KHAI DỰ ÁN QUẢN LÝ KH BHXH

Tài liệu này hướng dẫn chi tiết từng bước để khởi tạo **Cơ sở dữ liệu (CSDL) mới** trên Supabase và triển khai (Deploy) ứng dụng lên 4 nền tảng phổ biến: **Cloudflare Pages**, **Vercel**, **GitHub Pages** và **VPS Linux**.

---

## 🗄️ PHẦN 1: KHỞI TẠO CƠ SỞ DỮ LIỆU MỚI TRÊN SUPABASE

Khi chuyển sang một dự án mới hoặc tạo môi trường thử nghiệm độc lập, bạn cần tạo CSDL mới trên Supabase theo các bước sau:

### Bước 1: Tạo dự án Supabase mới
1. Truy cập [Supabase.com](https://supabase.com/) và đăng nhập.
2. Nhấp chọn **New Project**.
3. Điền tên dự án (ví dụ: `BHXH-Song-Ma`), chọn mật khẩu CSDL (Database Password) và chọn khu vực máy chủ (chọn **Singapore** hoặc gần Việt Nam nhất).
4. Nhấn **Create new project** và chờ khoảng 1 - 2 phút để Supabase khởi tạo.

### Bước 2: Chạy Script khởi tạo cấu trúc CSDL
1. Tại bảng điều khiển Supabase, chọn mục **SQL Editor** ở thanh menu bên trái.
2. Nhấp chọn **New query**.
3. Mở file [`database_schema.sql`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/database_schema.sql) trong mã nguồn dự án, sao chép toàn bộ nội dung và dán vào cửa sổ SQL Editor.
4. Bấm nút **Run** (hoặc Ctrl + Enter) để khởi tạo toàn bộ các bảng (`staff`, `records`, `settings`, `auditlogs`, `policies`), các View thống kê (`crm_customers`), hàm thống kê tài chính và cài đặt quy tắc bảo mật RLS.

### Bước 3: Chạy Script quản lý chính sách & chuẩn nghèo
1. Tạo một query mới trong SQL Editor.
2. Mở file [`policies_migration.sql`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/policies_migration.sql), sao chép toàn bộ nội dung và dán vào SQL Editor.
3. Bấm nút **Run** để nạp dữ liệu mẫu về Lương cơ sở (2.340.000đ & 2.530.000đ), Chuẩn nghèo (1.500.000đ), Lãi suất đầu tư (0.31%), Hệ số trượt giá CPI và Tỷ lệ hoa hồng.

### Bước 4: Lấy thông tin API Key để kết nối
1. Vào **Project Settings** (biểu tượng bánh răng góc dưới bên trái) ➔ Chọn **API**.
2. Lưu lại 2 thông tin quan trọng:
   * **Project URL** (dạng `https://xxxx.supabase.co`)
   * **API Key / anon public** (chuỗi mã hóa JWT bắt đầu bằng `eyJ...`)

---

## ☁️ PHẦN 2: TRIỂN KHAI LÊN CLOUDFLARE PAGES (Khuyên dùng)

### Các bước thực hiện:
1. Đảm bảo mã nguồn đã được `git push` lên GitHub repository của bạn.
2. Đăng nhập [Cloudflare Dashboard](https://dash.cloudflare.com/).
3. Vào **Workers & Pages** ➔ **Create application** ➔ Chọn tab **Pages** ➔ Chọn **Connect to Git**.
4. Chọn tài khoản GitHub và chọn repository `qlkhbhxh`.
5. Cấu hình khung đóng gói:
   * **Framework preset**: `React (Vite)`
   * **Build command**: `npm run build`
   * **Build output directory**: `dist`
6. Thêm biến môi trường tại mục **Environment variables (advanced)**:
   * `VITE_SUPABASE_URL` = `<Project URL của bạn>`
   * `VITE_SUPABASE_ANON_KEY` = `<API Key anon public của bạn>`
7. Bấm **Save and Deploy**. Cloudflare sẽ tự động build và cấp tên miền dạng `https://tendoan.pages.dev`.

---

## 📐 PHẦN 3: TRIỂN KHAI LÊN VERCEL

Dự án đã có sẵn file [`vercel.json`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/vercel.json) giúp điều hướng React Router chuẩn xác.

### Các bước thực hiện:
1. Đăng nhập [Vercel.com](https://vercel.com/).
2. Nhấn **Add New** ➔ **Project** ➔ Import repository `qlkhbhxh` từ GitHub.
3. Phần **Framework Preset** chọn `Vite`.
4. Mở rộng mục **Environment Variables** và điền:
   * `VITE_SUPABASE_URL` = `<Project URL>`
   * `VITE_SUPABASE_ANON_KEY` = `<API Key anon>`
5. Bấm **Deploy**. Vercel sẽ đưa trang web lên chạy sau vài giây.

---

## 🐙 PHẦN 4: TRIỂN KHAI LÊN GITHUB PAGES

Dự án đã có sẵn file trang lỗi [`public/404.html`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/public/404.html) và file tự động hóa CI/CD [`.github/workflows/deploy.yml`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/.github/workflows/deploy.yml).

### Các bước thực hiện:
1. Vào repository trên GitHub ➔ Chọn tab **Settings** ➔ chọn mục **Pages**.
2. Tại mục **Build and deployment / Source**, đổi từ `Deploy from a branch` thành **GitHub Actions**.
3. Vào **Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ Nhấn **New repository secret**:
   * Tạo Secret 1: `VITE_SUPABASE_URL`
   * Tạo Secret 2: `VITE_SUPABASE_ANON_KEY`
4. Mỗi khi bạn `git push` code mới lên nhánh `main`, GitHub Actions sẽ tự động đóng gói và xuất bản ứng dụng tại địa chỉ `https://<User>.github.io/<Repo>/`.

---

## 🖥️ PHẦN 5: TRIỂN KHAI LÊN MÁY CHỦ VPS LINUX (Ubuntu / CentOS)

### CÁCH A: Triển khai bằng Docker (Nhanh nhất & Dễ nhất)
1. Cài đặt Docker & Docker Compose trên VPS.
2. Upload toàn bộ mã nguồn lên VPS.
3. Tạo file `.env` trên VPS cạnh file `docker-compose.yml`:
   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Chạy lệnh:
   ```bash
   docker compose up -d --build
   ```
   Website sẽ chạy trực tiếp tại cổng 80 của VPS.

---

### CÁCH B: Triển khai bằng Nginx truyền thống
1. Cài đặt Node.js & Nginx trên VPS:
   ```bash
   sudo apt update && sudo apt install -y nginx nodejs npm
   ```
2. Build ứng dụng ở máy local hoặc trên VPS:
   ```bash
   npm run build
   ```
3. Copy toàn bộ nội dung thư mục `dist` vào `/var/www/qlkhbhxh/dist`.
4. Copy cấu hình từ file [`nginx.conf.example`](file:///E:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlkhbhxh/nginx.conf.example) dán vào `/etc/nginx/sites-available/default`.
5. Khởi động lại Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

---

### CÁCH C: Triển khai bằng Node.js / PM2
1. Chạy lệnh build:
   ```bash
   npm run build
   ```
2. Cài đặt PM2 để quản lý tiến trình ngầm:
   ```bash
   npm install -g pm2
   ```
3. Khởi chạy file HTTP Server tích hợp sẵn:
   ```bash
   pm2 start server.cjs --name "bhxh-app"
   pm2 save
   ```
