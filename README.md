# Hệ thống Quản lý thu BHXH tự nguyện & BHYT hộ gia đình

> **Cổng thông tin Nghiệp vụ & Dịch vụ công Đại lý thu BHXH Sông Mã**  
> Nền tảng quản lý hồ sơ, giao dịch thu, kế toán tài chính, tính toán chế độ và chăm sóc khách hàng tham gia Bảo hiểm xã hội tự nguyện & Bảo hiểm y tế hộ gia đình.

---

## 📌 Tổng quan Hệ thống

Hệ thống được phát triển chuyên biệt nhằm số hóa toàn diện quy trình thu, quản lý hồ sơ đối tượng tham gia BHXH tự nguyện và BHYT hộ gia đình, hỗ trợ đồng bộ dữ liệu thời gian thực, đảm bảo tính toàn vẹn tài chính và tuân thủ nghiêm ngặt các quy định pháp luật hiện hành.

### Các Tính năng & Nghiệp vụ Trọng tâm:
1. **Quản lý Hồ sơ & Gom cụm Định danh (Identity Unification Cluster):**
   - Thuật toán BFS gom cụm đa tầng theo CCCD (12 số), Mã số BHXH (10 số), Số điện thoại, Mã hộ gia đình.
   - Tự động phát hiện và liên kết hồ sơ biến động, giải quyết triệt để vấn đề trùng lặp hoặc phân mảnh dữ liệu.
2. **Kế toán Sổ cái Tài chính & Bút toán Bất biến (Financial Ledger Single Source of Truth):**
   - Thiết kế chuẩn kế toán: Bảng `financial_ledger` bất biến (Append-Only), nghiêm cấm UPDATE / DELETE / TRUNCATE qua trigger CSDL.
   - Bút toán ghi nhận đa dòng: Thu tiền (`THU_TIEN`), Hoàn tiền (`HOAN_TIEN`), Điều chỉnh (`DIEU_CHINH`), Chi hoa hồng (`CHI_HOA_HONG`).
   - Khóa kỳ tài chính động tháng/quý/năm, snapshot chính sách tại thời điểm lập giao dịch và thoái thu bù trừ (Clawback).
3. **Kiến trúc Phân tầng Anti-Corruption Layer & Modular UI:**
   - Service Layer (`recordService`, `customerService`, `financeService`, `policyService`) cắt đứt liên kết trực tiếp giữa UI và Supabase DB.
   - UI phân rã rõ ràng với Domain Custom Hooks (`useRecordsState`, `useCustomersState`) và Sub-components theo miền nghiệp vụ.
4. **Tuân thủ Pháp luật & Cập nhật Chính sách:**
   - Hỗ trợ công thức tính theo **Luật BHXH 2024** (Nhà nước hỗ trợ 50% Hộ nghèo, 40% Cận nghèo, 20% Đối tượng khác).
   - Cơ chế tính BHYT hộ gia đình giảm trừ bậc thang và BHYT Đồng hạn (Coterminous BHYT).
   - Xuất biểu mẫu chuẩn quốc gia **Mẫu D05-TS** (BHXH) và **Mẫu D03-TS** (BHYT) có cơ chế phòng chống mã độc Formula Injection (CWE-1236).
5. **Bảo mật Đa tầng & Bảo vệ Dữ liệu Cá nhân:**
   - Tuân thủ Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (Masking PII: ẩn số CCCD, SĐT, địa chỉ trên cổng tra cứu công khai).
   - Row Level Security (RLS) phân quyền 4 cấp: Quản trị viên (Admin), Kế toán (Accountant), Nhân viên thu (Staff), Cổng tra cứu công cộng (Anon/Rate-limited).
   - Bảo mật RPC với xác thực quyền `is_manager_or_admin()` và kiểm soát tần suất IP (`enforce_public_rpc_rate_limit`).
6. **Thanh toán VietQR NAPAS 247:**
   - Tạo mã QR động tự động điền số tài khoản, tên đơn vị thụ hưởng, số tiền và nội dung chuyển khoản chuẩn hóa.

---

## 🛠️ Công nghệ Sử dụng (Tech Stack)

- **Frontend:** React 19, TypeScript 5.8 (Strict Mode khắt khe 100%: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vite 6, Tailwind CSS 4, Lucide React, Chart.js.
- **Backend & Database:** Supabase PostgreSQL (100% `snake_case`), Row Level Security (RLS), PL/pgSQL Stored Procedures, Financial Ledger Triggers, Realtime Subscriptions.
- **Xử lý Dữ liệu & Biểu mẫu:** XLSX-js-style, PDFMake, HTML2Canvas, Zod.
- **Kiểm thử tự động:** Vitest (50 test suites, 461 tests passed, 100% baseline).
- **CI/CD Pipeline:** GitHub Actions (`.github/workflows/production.yml`) kiểm duyệt tự động Typecheck, Unit/Integration Tests và Production Build.

---

## 📁 Cấu trúc Thư mục Chuẩn (Project Layout)

```text
qlNTG/
├── deploy/                     # Cấu hình triển khai hạ tầng VPS & Docker
│   ├── docker-compose.yml      # Cấu hình chạy container Docker Compose
│   ├── Dockerfile              # Docker build nhiều tầng (Multi-stage build)
│   ├── nginx.conf.example      # File mẫu cấu hình Nginx chuẩn bảo mật (CSP, Cache, SSL)
│   └── server.cjs              # HTTP Server Node.js phục vụ SPA
├── docs/                       # Tài liệu kỹ thuật chi tiết
│   ├── architecture.md         # Kiến trúc hệ thống tổng thể & phân tầng
│   ├── deployment-golive.md    # Hướng dẫn Go-live môi trường thực tế
│   ├── deployment.md           # Hướng dẫn triển khai chi tiết
│   ├── runbook.md              # Sổ tay vận hành (Runbook) & xử lý sự cố
│   ├── security-audit.md       # Báo cáo đánh giá bảo mật & RLS
│   └── supabase-migration.md   # Hướng dẫn migration CSDL Supabase
├── public/                     # Tài nguyên tĩnh, PWA Manifest, Service Worker
├── src/                        # Mã nguồn ứng dụng (Frontend)
│   ├── components/             # React components (Admin, Modals, Calculators, Common)
│   ├── context/                # React Contexts (Auth, Data, Policy, UI)
│   ├── hooks/                  # Custom React Hooks
│   ├── lib/                    # Cấu hình SDK (Supabase client)
│   ├── services/               # Data Access & API Services Layer
│   ├── tests/                  # Kiểm thử tự động nghiệp vụ và bảo mật (Vitest)
│   └── utils/                  # Hàm tiện ích tính toán, chuẩn hóa, định dạng
├── supabase/                   # Cấu hình Supabase & CSDL
│   ├── functions/              # Edge Functions
│   ├── migrations/             # Lịch sử các bản vá CSDL PostgreSQL
│   └── tests/                  # Bộ script SQL kiểm thử bảo mật RLS & PII
├── MASTER_SETUP_ALL_IN_ONE.sql # Master Schema CSDL duy nhất toàn diện cho Supabase
├── package.json                # Dependencies và scripts chạy dự án
└── vite.config.ts              # Cấu hình Vite bundler & tối ưu hóa
```

---

## 🚀 Hướng dẫn Cài đặt & Phát triển Cục bộ

### Điều kiện tiên quyết:
- **Node.js:** Phiên bản `>= 20.0.0`
- **NPM:** Phiên bản `>= 10.0.0`

### 1. Khởi tạo môi trường:
```bash
# Clone kho lưu trữ
git clone https://github.com/hocbhxh/qlNTG.git
cd qlNTG

# Cài đặt thư viện phụ thuộc
npm install
```

### 2. Cấu hình Biến Môi trường:
Sao chép `.env.example` thành `.env` và điền thông tin dự án Supabase của bạn:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Thiết lập Cơ sở Dữ liệu Supabase:
Sao chép toàn bộ nội dung file [`MASTER_SETUP_ALL_IN_ONE.sql`](MASTER_SETUP_ALL_IN_ONE.sql) và dán vào mục **SQL Editor** trong bảng điều khiển Supabase của bạn rồi nhấn **Run**.

### 4. Chạy Ứng dụng:
```bash
# Chạy môi trường phát triển (Dev server)
npm run dev

# Kiểm tra chất lượng mã nguồn (TypeScript linting)
npm run lint

# Chạy toàn bộ 25 bài kiểm thử tự động
npm test

# Build phiên bản Production
npm run build

# Chạy toàn bộ quy trình xác minh baseline trước khi phát hành
npm run verify-baseline
```

---

## 📖 Tài liệu Tham khảo Bổ sung

- [**Sổ tay Triển khai & Vận hành Chuẩn (Deployment Guide)**](DEPLOYMENT_GUIDE.md) *(Khuyên dùng - Chi tiết Supabase + GitHub + Cloudflare Pages)*
- [Kiến trúc Hệ thống (Architecture Specification)](docs/architecture.md)
- [Hướng dẫn Vận hành & Khắc phục Sự cố (Runbook)](docs/runbook.md)
- [Hướng dẫn Triển khai Chi tiết](docs/deployment.md)
- [Đánh giá An toàn Thông tin & RLS Policy](docs/security-audit.md)

---

## ⚖️ Bản quyền & Giấy phép

Dự án thuộc bản quyền phát triển của Đại lý thu BHXH Sông Mã. Mọi hành vi sao chép, sử dụng trái phép dữ liệu cá nhân của người tham gia đều bị nghiêm cấm theo quy định của Pháp luật Việt Nam.
