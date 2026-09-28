# Hướng Dẫn Sao Lưu (Backup) & Di Chuyển Sang Supabase Mới

Việc sao lưu dữ liệu và chuyển đổi ứng dụng sang một Database (cơ sở dữ liệu) mới là một kỹ năng quan trọng để đảm bảo an toàn hoặc khi bạn muốn bàn giao dự án cho khách hàng.

Dưới đây là hướng dẫn chi tiết từng bước.

---

## 🛠 CÁCH 1: DI CHUYỂN / KHÔI PHỤC THỦ CÔNG (Đơn giản nhất cho tài khoản Miễn phí)

Tài khoản Supabase gói miễn phí (Free Tier) không có nút "Backup & Restore" tự động, do đó chúng ta sẽ làm theo cách xuất/nhập dữ liệu.

### Bước 1: Sao lưu (Export) Dữ liệu từ Supabase cũ
1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com) của dự án cũ.
2. Vào phần **Table Editor** (Biểu tượng bảng ở menu trái).
3. Chọn lần lượt từng bảng quan trọng: `records` (Khách hàng), `staff` (Nhân viên), `settings` (Cấu hình).
4. Ở góc trên cùng bên phải của bảng, nhấn nút **Export** và chọn **Export to CSV**.
5. *Lưu ý:* Việc export CSV chỉ tải dữ liệu bảng. Tài khoản đăng nhập (Auth Users) ở bảng gốc `auth.users` không thể export bằng CSV thông thường, bạn sẽ cần tạo lại thủ công ở dự án mới.

### Bước 2: Khởi tạo Project Supabase mới
1. Tạo một New Project trên Supabase.
2. Đặt mật khẩu Database an toàn và lưu lại.
3. Đợi vài phút để Supabase khởi tạo.

### Bước 3: Tái tạo cấu trúc (Schema) trên Supabase mới
Bạn không cần phải tự tay tạo lại từng bảng, tôi đã gom toàn bộ cấu trúc hệ thống vào file `database_schema.sql` trong thư mục dự án của bạn.
1. Ở Project Supabase mới, vào thẻ **SQL Editor**.
2. Nhấn **New Query**.
3. Mở file `database_schema.sql` trên máy tính của bạn (trong thư mục `E:\AI Agent\newBHXH\`), copy toàn bộ nội dung và dán vào cửa sổ SQL Editor.
4. Nhấn **Run**. 
   *(Sau bước này, toàn bộ bảng, cấu hình bảo mật RLS, các hàm RPC tính toán và 2 tài khoản mặc định `admin@local.com`, `hocsongma@gmail.com` sẽ được tự động tạo).*

### Bước 4: Nhập (Import) dữ liệu cũ vào (Nếu cần)
1. Vào **Table Editor** của Project mới.
2. Chọn bảng `records` (Khách hàng).
3. Nhấn **Insert** -> **Import data from CSV**.
4. Chọn file CSV bạn đã tải về ở Bước 1. (Làm tương tự cho các bảng khác nếu bạn muốn giữ lại dữ liệu).

### Bước 5: Kết nối Ứng dụng với Supabase mới
1. Mở Project Supabase mới, vào mục **Project Settings** (biểu tượng bánh răng) -> **API**.
2. Copy `Project URL` và `Project API keys (anon, public)`.
3. Mở file `.env` trong thư mục code của bạn (trên VS Code), sửa lại 2 dòng này:
   ```env
   VITE_SUPABASE_URL=dán_URL_mới_vào_đây
   VITE_SUPABASE_ANON_KEY=dán_ANON_KEY_mới_vào_đây
   ```
4. Lưu file `.env`. Mở terminal chạy `npm run dev` để kiểm tra. Hệ thống của bạn đã chạy trên Database mới tinh!

---

## 🚀 CÁCH 2: DÙNG SUPABASE CLI (Chuyên nghiệp, dành cho lập trình viên)

Nếu bạn có cài đặt [Supabase CLI](https://supabase.com/docs/guides/cli) trên máy tính, bạn có thể clone toàn bộ (cả cấu trúc, dữ liệu và danh sách tài khoản) rất dễ dàng.

**Bước 1: Link với project cũ**
```bash
supabase link --project-ref <ID_PROJECT_CŨ>
```

**Bước 2: Dump toàn bộ dữ liệu ra tệp sql**
```bash
supabase db dump --data-only -f backup_data.sql
```

**Bước 3: Link với project mới và đẩy dữ liệu lên**
```bash
supabase link --project-ref <ID_PROJECT_MỚI>
supabase db push
psql -h <HOST_DB_MỚI> -U postgres -d postgres -f backup_data.sql
```

*(Cách 2 đòi hỏi bạn phải có kiến thức về dòng lệnh và cài đặt Docker + Postgres client trên máy tính).*

---

### 💡 Lời khuyên cho bạn:
Đối với mô hình quản lý đại lý BHXH hiện tại, **CÁCH 1** là phương án an toàn, trực quan và dễ thực hiện nhất. File `database_schema.sql` chính là "bản thiết kế" hoàn hảo nhất của hệ thống này, nó cho phép bạn nhân bản ứng dụng này ra thành 100 dự án Supabase khác nhau chỉ bằng 1 cú click `Run SQL`!
