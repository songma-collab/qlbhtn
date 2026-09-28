# TÀI LIỆU KIẾN TRÚC CỐT LÕI BẤT BIẾN & BẢO VỆ CHỐNG LỖI HỒI QUY
## HỆ THỐNG QUẢN LÝ KHÁCH HÀNG THAM GIA BHXH TỰ NGUYỆN & BHYT HỘ GIA ĐÌNH
**Phiên bản:** `v1.0.0-baseline`  
**Ngày ban hành:** 2026-09-10  
**Tình trạng:** **ĐÓNG BĂNG MÃ NGUỒN GỐC (FROZEN ARCHITECTURE BASELINE)**  
**Cương vị chịu trách nhiệm:** Lead System Architect & Principal Release Engineer  

---

## 1. MỤC ĐÍCH & TUYÊN NGÔN KIẾN TRÚC (ARCHITECTURE STATEMENT)

Tài liệu này xác lập **Khuôn mẫu Kiến trúc Bất biến (Architecture Invariants)** của hệ thống tại thời điểm đạt trạng thái ổn định 100% (59/59 bài kiểm thử passed, biên dịch TypeScript 0 lỗi, CSDL sạch sẽ không dead tuples).

> [!IMPORTANT]
> **QUY TẮC BẢO VỆ VĨNH VIỄN (CARDINAL RULE):**  
> Mọi lập trình viên, kỹ sư phát triển tính năng, bảo trì hoặc AI Agent trong tương lai **BẮT BUỘC** phải kế thừa khung sườn kiến trúc được quy định trong tài liệu này.  
> **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP:**
> 1. Thay đổi logic gốc của các Invariants tại Tầng Lõi (Core Layer) mà không có sự phê duyệt bằng văn bản của Kiến trúc sư Trưởng.
> 2. Đưa mã nguồn mới lên nhánh `main` nếu làm hỏng (FAIL) bất kỳ bài kiểm thử nào trong bộ 59 Golden Test Cases.
> 3. Sửa đổi nội dung các file Migration SQL cũ đã triển khai vào CSDL production.

---

## 2. CÁC NGUYÊN TẮC CỐT LÕI BẤT BIẾN (CORE INVARIANTS)

Sáu trụ cột nghiệp vụ và kỹ thuật dưới đây là bất khả xâm phạm:

### Invariant 1: Khớp nối Định danh Đa tầng (Unification Cluster BFS)
- **Tập tin:** [`src/utils/helpers.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/utils/helpers.ts) -> `groupRecordsByCustomer()`
- **Đặc tả nghiệp vụ:** Khách hàng tham gia BHXH/BHYT qua nhiều kỳ thường bị phân mảnh thông tin (kỳ đầu có CCCD nhưng chưa có số sổ BHXH; kỳ sau có số sổ nhưng đổi số điện thoại; kỳ gia hạn chỉ lưu SĐT và Họ tên).
- **Thuật toán cốt lõi:** Thuật toán duyệt đồ thị theo chiều rộng (BFS - Breadth-First Search) gom cụm các bản ghi có chung:
  - Khóa 1: `type + cccd`
  - Khóa 2: `type + bhxh`
  - Khóa 3: `type + phone + name_chuan_hoa`
- **Quy tắc bất biến:**
  - Độ phức tạp thời gian phải duy trì $O(N)$ bằng Map lookup, không dùng vòng lặp lồng nhau $O(N^2)$.
  - Phải loại trừ bản ghi `paymentStatus === 'Đã hủy'` và `isAdjustment === true` khỏi danh sách đại diện khách hàng.
  - Luôn chọn bản ghi có `nextPayment` mới nhất làm đại diện cho khách hàng.

### Invariant 2: Phòng thủ Khóa kỳ Tài chính 2 Lớp (Financial Lock Guard)
- **Tập tin Client:** [`src/utils/helpers.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/utils/helpers.ts) -> `isDateLocked()`, `checkFinancialLockViolation()`
- **Tập tin Database:** PostgreSQL Trigger `trg_protect_financial_lock` trong [`20260910_financial_lock_and_snapshot.sql`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/supabase/migrations/20260910_financial_lock_and_snapshot.sql)
- **Quy tắc bất biến:**
  - **Lớp 1 (UI/Context):** Giao diện vô hiệu hóa các nút Sửa/Xóa số tiền, chuyển sang chế độ xem nếu ngày phát sinh giao dịch nằm trong kỳ tài chính đã bị khóa sổ (`policies` có `is_active = true` hoặc `notes LIKE '%LOCKED%'`).
  - **Lớp 2 (Database Trigger):** Chặn đứng mọi lệnh `UPDATE/DELETE` sửa đổi các trường tài chính (`amount`, `commission`, `date`, `income`, `wage`) ở cấp CSDL, ném lỗi ngoại lệ mã `P0001`. Kể cả khi kẻ tấn công gọi trực tiếp qua PostgREST API hoặc Service Key thì CSDL vẫn bảo vệ số liệu.

### Invariant 3: Kế toán Bút toán Bù trừ Âm (Clawback / Negative Adjustment)
- **Tập tin:** [`src/context/AppContext.tsx`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/context/AppContext.tsx) -> `cancelRecordWithClawback()`
- **Đặc tả nghiệp vụ:** Khi cần hủy hoặc điều chỉnh một biên lai thu tiền thuộc về kỳ tài chính đã khóa sổ:
  - **TUYỆT ĐỐI KHÔNG** sửa đổi hoặc xóa bản ghi gốc ở kỳ đã khóa (bảo toàn nguyên vẹn số liệu báo cáo của kỳ cũ).
  - Tự động sinh ra **Bút toán bù trừ âm** tại kỳ hiện tại với `amount = -abs(amount)`, `commission = -abs(commission)`, `isAdjustment = true`, `originalRecordId = targetRecord.id`.
  - Doanh thu và hoa hồng kỳ hiện tại được cộng trừ đại số chính xác; số lượng khách hàng mới (`headcount`) không bị tính trùng do có cờ `isAdjustment = true`.

### Invariant 4: Đóng băng Chính sách tại Thời điểm Lập (Point-in-Time Policy Snapshot)
- **Tập tin:** [`src/context/types.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/context/types.ts) -> các trường `baseSalarySnapshot`, `povertyStandardSnapshot`, `policyVersionId`, `appliedRates`
- **Quy tắc bất biến:**
  - Mỗi khi một giao dịch mới được tạo, các thông số chính sách tại thời điểm đó (Lương cơ sở 2.340.000đ, Chuẩn nghèo nông thôn 1.500.000đ, Tỷ lệ hỗ trợ) phải được đóng băng (snapshot) trực tiếp vào dòng giao dịch.
  - Khi Nhà nước điều chỉnh chính sách mới (ví dụ tăng lương cơ sở), số tiền và hoa hồng của các giao dịch trong quá khứ **không bao giờ bị tính toán lại theo chính sách mới**.

### Invariant 5: Tính toán BHYT Coterminous Tháng Lẻ theo Nghị định 146/2018/NĐ-CP
- **Tập tin:** [`src/utils/calculations.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/utils/calculations.ts) -> `calculateBHYTCoterminous()`
- **Quy tắc bất biến:**
  - Hộ gia đình được phép đóng số tháng lẻ độc lập cho từng thành viên để đồng bộ kỳ hạn hết hạn (Coterminous Expiration).
  - Tỷ lệ giảm trừ bậc thang phải được gán theo thứ tự thứ hạng thành viên: Người 1 (100%) -> Người 2 (70%) -> Người 3 (60%) -> Người 4 (50%) -> Người 5 trở đi (40%).
  - Mức đóng 1 tháng cơ sở: $\text{Lương cơ sở} \times 4.5\% = 105.300 \text{ VNĐ}$.
  - Sai số làm tròn giữa tổng hộ và từng thành viên phải đảm bảo $= 0 \text{ VNĐ}$.

### Invariant 6: Bảo vệ Dữ liệu Cá nhân (PII Masking) & Audit Logs Bất biến (Append-Only)
- **Tập tin:** [`src/utils/security.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/utils/security.ts) & PostgreSQL Trigger `trg_auditlog_append_only`
- **Quy tắc bất biến:**
  - **Mặt nạ dữ liệu:** CCCD (che 6 số giữa: `001******234`), SĐT (che 4 số giữa: `091****678`), Mã BHXH (che 5 số giữa) đối với tất cả vai trò không phải Admin theo Nghị định 13/2023/NĐ-CP.
  - **Audit Logs Append-Only:** Bảng `auditlogs` nghiêm cấm mọi lệnh `UPDATE` hoặc `DELETE`. Mọi hành vi xuất file Excel danh bạ đều phải ghi nhận log kèm IP và danh tính người thao tác.

---

## 3. BẢN ĐỒ PHÂN QUYỀN & RANH GIỚI MODULE (MODULE BOUNDARIES)

Để đảm bảo hệ thống không bị phá vỡ khi có nhiều lập trình viên cùng tham gia, mã nguồn được phân định thành 2 phân vùng ranh giới rõ ràng:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE LAYER (VÙNG BẤT BIẾN)                      │
│   [CẤM SỬA ĐỔI TRỰC TIẾP NẾU KHÔNG CÓ PHÊ DUYỆT KIẾN TRÚC SƯ TRƯỞNG]    │
├────────────────────────────────────────────────────────────────────────┤
│  • src/utils/calculations.ts      (Công thức toán tài chính BHXH/BHYT) │
│  • src/utils/helpers.ts           (BFS Unification & Financial Lock)   │
│  • src/utils/security.ts          (Data Masking & Security Audit)      │
│  • src/context/types.ts           (Cấu trúc Schema Type trung tâm)     │
│  • src/context/AppContext.tsx     (Trạng thái đồng bộ Data Store)      │
│  • supabase/migrations/*.sql      (Các migration cơ sở từ 000010->nay) │
└────────────────────────────────────────────────────────────────────────┘
                                    ▲
                                    │ Kế thừa / Gọi hàm
                                    │ (Không sửa ngược lại Core)
┌────────────────────────────────────────────────────────────────────────┐
│                    EXTENSION LAYER (VÙNG ĐƯỢC PHÉP MỞ RỘNG)            │
│                 [LẬP TRÌNH VIÊN THOẢI MÁI PHÁT TRIỂN THÊM]             │
├────────────────────────────────────────────────────────────────────────┤
│  • src/components/admin/          (Các View/Tabs quản trị mới)         │
│  • src/components/calculators/    (Các công cụ tính toán tham khảo mới)│
│  • src/components/modals/         (Các hộp thoại nghiệp vụ mới)        │
│  • src/hooks/                     (Custom hooks mở rộng)               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. HÀNG RÀO KIỂM THỬ CHỐNG HỒI QUY (GOLDEN TEST SUITE)

Bộ kiểm thử phòng thủ gồm **59 Test Cases** được chia thành 6 bộ test tự động trong thư mục `src/tests/` và `src/utils/`:

| Bộ Kiểm thử | Số Tests | Trọng tâm kiểm soát |
| :--- | :---: | :--- |
| [`calculations.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/utils/calculations.test.ts) | 21 | Công thức BHXH, chiết khấu đóng trước, phạt nộp muộn, BHYT bậc thang |
| [`financialLock.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/tests/financialLock.test.ts) | 8 | Kiểm tra chặn sửa trường tài chính ở kỳ khóa, cho phép sửa ghi chú |
| [`clawbackCommission.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/tests/clawbackCommission.test.ts) | 5 | Đối soát bút toán âm: doanh thu ròng, hoa hồng ròng, không tăng headcount |
| [`coterminousBHYT.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/tests/coterminousBHYT.test.ts) | 7 | Hộ 5 người [12,10,8,6,3] tháng, trường hợp 1 tháng lẻ, fallback an toàn |
| [`unificationCluster.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/tests/unificationCluster.test.ts) | 4 | Khớp nối CCCD/SĐT/Mã BHXH, Benchmark 1.000 records < 50ms |
| [`securityPrivacy.test.ts`](file:///e:/AI%20Agent/HOCSONGMA/qlkhBHXH/qlNTG/src/tests/securityPrivacy.test.ts) | 14 | Mặt nạ PII (CCCD, SĐT), Phòng chống XSS injection, Append-only Audit |

### Quy tắc Chạy Kiểm tra Bắt buộc (Verification Rule):
Mọi lập trình viên trước khi commit hoặc merge code mới **BẮT BUỘC** phải chạy lệnh:
```bash
npm run verify-baseline
```
Lệnh này tự động thực hiện chuỗi 3 bước:
1. `npx tsc --noEmit` (Kiểm tra kiểu dữ liệu tĩnh TypeScript).
2. `npx vitest run` (Chạy toàn bộ 59 bài test hồi quy).
3. `npm run build` (Kiểm tra khả năng đóng gói bundle production).

Nếu **bất kỳ bước nào bị lỗi**, việc cập nhật mã nguồn sẽ bị đình chỉ ngay lập tức.

---

## 5. HƯỚNG DẪN QUY CHUẨN MỞ RỘNG DÀNH CHO DEVELOPER TƯƠNG LAI

### 1. Khi muốn Thêm Màn hình / Phân hệ Mới
- Tạo component mới trong thư mục `src/components/admin/` (ví dụ `NewModuleView.tsx`).
- Nạp component bằng `React.lazy()` trong `src/App.tsx` hoặc tab con trong `AdminView.tsx`.
- Lấy dữ liệu thông qua hook `useAppContext()`:
  ```typescript
  const { records, currentUser, showToast, addAuditLog } = useAppContext();
  ```
- **Không được tự ý sửa đổi hàm `fetchData` hay các State gốc trong `AppContext.tsx`**.

### 2. Khi Nâng cấp Cơ sở Dữ liệu Supabase
- **Quy tắc bất biến:** TUYỆT ĐỐI KHÔNG sửa đổi nội dung các file SQL cũ trong `supabase/migrations/`.
- Luôn tạo file migration mới với định dạng thời gian: `supabase/migrations/YYYYMMDD_ten_nang_cap.sql`.
- Mọi bảng mới tạo thêm **BẮT BUỘC** phải có:
  ```sql
  ALTER TABLE public.ten_bang_moi ENABLE ROW LEVEL SECURITY;
  ```
  và cấp quyền rõ ràng theo vai trò `Admin`, `Quản lý`, `Nhân viên`, nghiêm cấm mở quyền tự do cho `anon`.

### 3. Khi Bổ sung Loại hình Bảo hiểm hoặc Công thức Mới
- Không sửa đổi trực tiếp vào thân hàm `calculateBHXH` hoặc `calculateBHYTCoterminous`.
- Sử dụng mô hình **Adapter Pattern**: Viết hàm tính toán mới riêng biệt (ví dụ `calculateBHTN`) và xuất ra từ file tiện ích mở rộng, sau đó tích hợp vào modal đăng ký.

---

## 6. LỆNH ĐÓNG BĂNG MÃ NGUỒN GỐC (GIT RELEASE TAG)

Dự án được đánh dấu mốc lịch sử phiên bản cơ sở vững chắc:
```bash
git tag -a v1.0.0-baseline -m "Baseline Production Release - 100% stable, 59 tests passed, zero TypeScript errors"
```
Mọi nhánh phát triển tiếp theo phải phân nhánh từ tag này (`git checkout -b feature/ten-tinh-nang v1.0.0-baseline`).
