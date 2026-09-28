# 📖 HƯỚNG DẪN TRIỂN KHAI VÀ VẬN HÀNH HỆ THỐNG QLBHTN

> **Tài liệu chính thức & duy nhất (Single Source of Truth):**  
> Vui lòng tham khảo tệp tin đầy đủ tại: [DEPLOYMENT_GUIDE.md](file:///d:/HTML/Gravity/QLBHTN/DEPLOYMENT_GUIDE.md) nằm ở thư mục gốc của dự án.

---

### TÓM TẮT CÁC BƯỚC TRIỂN KHAI NHANH

1. **Khởi tạo CSDL Supabase:**
   - Mở Supabase SQL Editor và chạy [MASTER_SETUP_ALL_IN_ONE.sql](file:///d:/HTML/Gravity/QLBHTN/MASTER_SETUP_ALL_IN_ONE.sql).
   - Lấy `Project URL` và `anon key` tại `Project Settings -> API`.
   - Tạo người dùng Admin trong `Authentication -> Users` và liên kết với bảng `staff`.

2. **Đẩy mã nguồn lên GitHub:**
   - Cài đặt Git (nếu chưa có): `winget install --id Git.Git -e`.
   - Chạy lệnh đẩy mã nguồn:
     ```powershell
     git init -b main
     git add .
     git commit -m "feat: initial commit - QLBHTN v1.0.0 standardized"
     git remote add origin https://github.com/<tai-khoan>/qlbhtn-songma.git
     git push -u origin main
     ```

3. **Triển khai lên Cloudflare Pages:**
   - Kết nối với GitHub Repo vừa tạo.
   - **Framework preset**: `Vite` | **Build command**: `npm run build` | **Output directory**: `dist`.
   - Thêm biến môi trường:
     - `NODE_VERSION` = `20`
     - `VITE_SUPABASE_URL` = `<URL Supabase>`
     - `VITE_SUPABASE_ANON_KEY` = `<Anon Key>`
   - Bấm **Save and Deploy**.

Chi tiết từng bước, kiểm tra nghiệm thu, cấu hình tên miền riêng, Supabase Edge Functions và cách xử lý sự cố xem tại [DEPLOYMENT_GUIDE.md](file:///d:/HTML/Gravity/QLBHTN/DEPLOYMENT_GUIDE.md).
