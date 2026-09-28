# Phân tích dự án và kế hoạch nâng cấp

Ngày rà soát: 28/09/2026. Phạm vi: mã nguồn đang có trong repository; không kết nối Supabase production và không chạy migration trên dữ liệu thật.

## 1. Tổng quan kiến trúc

Đây là ứng dụng quản lý nghiệp vụ thu BHXH tự nguyện và BHYT hộ gia đình. Frontend dùng React 19, TypeScript, Vite và Tailwind; truy cập dữ liệu trực tiếp qua Supabase JS/PostgREST. PostgreSQL/Supabase đảm nhiệm schema, RLS, trigger, RPC và các tác vụ tổng hợp. Có thêm Express server cho dev/production và OCR Gemini; hai Supabase Edge Functions xử lý tiếp nhận công khai và OCR.

Các miền nghiệp vụ chính gồm hồ sơ thu (`records`), danh bạ tổng hợp (`customers`), nhân viên và phân quyền (`staff`/RBAC), chính sách (`policies`), kỳ tài chính và đối soát (`financial_settlements`), lô nộp hồ sơ (`submission_batches`), lịch sử tham gia (`customer_participations`), audit log, báo cáo, nhắc tái tục, VietQR, nhập/xuất biểu mẫu và tính toán BHXH/BHYT.

## 2. Luồng và cấu trúc dữ liệu

- UI và nghiệp vụ tập trung nhiều trong `src/components`, `src/context` và `src/utils`. Có service layer cho record, customer, finance và batch, nhưng `DataContext` vẫn truy vấn Supabase trực tiếp. Vì vậy có hơn một đường đi cho dữ liệu và quy tắc chuyển đổi/lọc có thể không đồng nhất.
- `records` là sổ giao dịch; `customers` là bảng tổng hợp phục vụ CRM, có đồng bộ từ record qua trigger. `customer_participations` giữ lịch sử thời gian tham gia. Các quan hệ và cách tính bảng tổng hợp cần được xác nhận với schema production trước khi đổi.
- TypeScript đã định nghĩa `DbRecordRow` theo snake_case và `recordToDb`/`dbToRecord` làm adapter. Tuy nhiên kiểu giao diện vẫn duy trì nhiều bí danh camelCase/snake_case (`oldBhxh`/`old_bhxh`, `staffId`/`staff_id`, `customerKey`/`customer_key`, hai cách biểu diễn tháng), phản ánh giai đoạn chuyển đổi chưa kết thúc.
- Migration mới nhất trong danh sách chuẩn hóa một số cột `records`, backfill bí danh, thêm index và thay RPC phân trang CRM/tài chính. Một migration phase 1 không tự chứng minh trạng thái DB thực tế; phải so sánh migration history và catalog của từng môi trường.
- Master SQL chứa schema, hàm `SECURITY DEFINER`, trigger, policy, quyền và RPC trong một tệp lớn. Nó là đường cài đặt song song với 43 tệp migration. Hai nguồn schema có nguy cơ lệch nhau nếu một thay đổi chỉ được thêm vào một nơi.

## 3. Đánh giá nhất quán và rủi ro cần xử lý

### Ưu tiên P0 — dữ liệu và phân quyền

1. **Một nguồn schema chuẩn chưa được xác lập:** cùng tồn tại `MASTER_SETUP_ALL_IN_ONE.sql` và chuỗi migrations. Tài liệu cài đặt yêu cầu chạy Master SQL, trong khi hướng dẫn migration dựa vào migrations; `docs/supabase-migration.md` còn nhắc `database_schema.sql` không thấy trong danh sách file. Cần chọn migrations làm nguồn tiến hóa chuẩn, xác định Master SQL là bootstrap được sinh ra hay bỏ luồng đó, đồng thời sửa tài liệu.
2. **Cột trùng tên/chuyển đổi dang dở:** `records` và type adapter vẫn xử lý alias camelCase cùng cột snake_case; migration chuẩn hóa có biểu thức tham chiếu cột alias. Việc migration có chạy được hay không phụ thuộc schema thật và thứ tự migration. Cần kiểm tra tất cả cột, dữ liệu xung đột, default, nullability, FK và code đọc/ghi trước khi drop alias.
3. **Ranh giới tin cậy của RPC:** nhiều hàm được khai báo `SECURITY DEFINER`. Cần lập ma trận cho từng hàm gồm caller/grant, xác thực vai trò, kiểm tra staff scope, `search_path`, dữ liệu trả về và khả năng bị gọi qua anon. Không kết luận chỉ từ tên hàm hoặc policy.
4. **Quy tắc bảo vệ giao dịch tài chính:** trigger/RPC xử lý khóa kỳ, giao dịch đã thu/nộp, thoái thu và audit. Cần đảm bảo trạng thái tài chính thay đổi nguyên tử ở DB, không chỉ UI; xác minh chống gọi lặp, quyền admin override, số tiền âm/dương và truy vết.

### Ưu tiên P1 — độ tin cậy và khả năng mở rộng

5. **Lấy dữ liệu nhiều lớp chưa nhất quán:** một số truy vấn trong `DataContext` giới hạn 2.500 dòng và lọc theo staff ở client/query layer, trong khi service đã có phân trang và RPC phía server. Dữ liệu vượt giới hạn có thể làm sai dashboard/báo cáo nếu không có truy vấn tổng hợp/phân trang tương ứng. RLS vẫn phải là lớp cưỡng chế cuối.
6. **Định danh/chuẩn hóa:** `idempotency_key` được tạo phía client nhưng cần xác minh unique constraint và xử lý conflict phía DB; quan hệ `records`–`customers` có cả `customer_id` và `customer_key`; chuẩn hóa khóa ngoại cần có chiến lược ghép dữ liệu trùng và rollback.
7. **Ngày tháng:** đang có tiện ích và migration riêng để chuyển chuỗi tháng thành ngày (`from_month_date`, `to_month_date`) trong khi vẫn giữ giá trị chuỗi. Cần chốt timezone, định dạng, biên tháng, dữ liệu lỗi và nguồn chuẩn để tránh lệch giữa UI, SQL và báo cáo.
8. **Giao diện và maintainability:** các màn CRM/Finance xuất hiện ở nhiều đường dẫn component và Context đang ôm nhiều trách nhiệm. Cần thống nhất module theo nghiệp vụ, kiểu dữ liệu, state và data access sau khi lập sơ đồ phụ thuộc; tránh refactor lớn đồng thời với migration schema.

### Ưu tiên P1/P2 — bảo mật vận hành

9. **Endpoint OCR Express:** `server.ts` nhận payload lớn, khởi tạo Gemini từ biến môi trường và có endpoint POST không thấy lớp xác thực/rate limit trong chính tệp này. Cần xác minh nơi endpoint được expose, proxy/auth ở hosting, xác thực người dùng, quota, MIME/giải mã base64, timeout và che PII trong log trước khi mở công khai.
10. **CORS và xác thực Edge Functions:** rà soát allowlist origin, xác minh JWT/role theo staff ID ổn định thay vì email khi phù hợp, secrets, rate limit và các đường public lookup. Kiểm tra cấu hình triển khai thực tế; mã nguồn đơn lẻ chưa cho biết gateway/network policy.
11. **Migration có tác động vận hành:** index trên bảng lớn, backfill, đổi RPC hoặc drop cột có thể khóa/ảnh hưởng lưu lượng. Chia expand/backfill/validate/contract, theo dõi thời gian và dung lượng, có backup/restore rehearsal và kế hoạch rollback tương thích dữ liệu.

## 4. Điểm tốt đã có

- Có 43 migration, 47 file test frontend, kiểm thử SQL cho RLS/PII, tài liệu runbook/deploy/security; package có lint, test, build và verify-baseline.
- Có RLS, audit triggers, snapshot chính sách, khóa kỳ tài chính, idempotency, adapter schema và các tiện ích bảo vệ CSV/XLSX. Đây là nền tảng tốt nhưng cần kiểm chứng trong CI và trên schema sạch/DB nâng cấp thực tế.
- Có quy trình Edge Function OCR xác minh JWT và giới hạn loại file/kích thước; cần đối chiếu tương tự với endpoint Express và cấu hình triển khai.

## 5. Kế hoạch nâng cấp đề xuất

| Giai đoạn | Nội dung | Đầu ra/tiêu chí hoàn thành |
|---|---|---|
| 0. Khảo sát và baseline | Vẽ sơ đồ module, luồng nghiệp vụ, data flow, ERD; lập inventory bảng/cột/view/index/constraint/trigger/function/policy/grant; chạy lint/test/build hiện có và ghi nhận kết quả | Báo cáo có bằng chứng, danh sách sai lệch theo mức độ, không sửa dữ liệu |
| 1. Chuẩn hóa quản trị schema | Chọn migration làm nguồn thay đổi; xác định cách sinh/duy trì bootstrap; đối chiếu 43 migration với Master SQL và production; sửa hướng dẫn cài đặt | Một quy trình tái tạo DB mới và nâng cấp DB hiện hữu có thể lặp lại |
| 2. Kiểm soát bảo mật và tài chính | Ma trận RBAC/RLS; audit toàn bộ `SECURITY DEFINER`; rà quyền anon/authenticated; củng cố invariant tiền, khóa kỳ, audit, idempotency và public endpoints | SQL migration nhỏ, có kiểm thử quyền dương/âm và kịch bản concurrency; không nới quyền |
| 3. Chuẩn hóa dữ liệu | Báo cáo chất lượng/duplicate/orphan; chốt snake_case, FK và kiểu ngày; backfill có đối soát; giữ tương thích trong giai đoạn expand/contract | Ràng buộc DB rõ ràng, báo cáo số dòng trước/sau và không mất dữ liệu |
| 4. Kiến trúc truy cập dữ liệu | Chuyển truy vấn khỏi Context/UI về service/repository; phân trang/lọc/tổng hợp phía server; chuẩn hóa lỗi, retry, cache và invalidate | Không phụ thuộc ngầm vào giới hạn 2.500; cùng một quy tắc phân quyền ở DB và API |
| 5. Chất lượng và hiệu năng UI | Tách module theo domain, giảm component trùng lặp, cải thiện accessibility/responsive, tối ưu bundle và truy vấn; giữ luồng nghiệp vụ hiện tại | Kiểm tra hồi quy theo vai trò và luồng thu/hoàn/đối soát; đo trước/sau |
| 6. Phát hành có kiểm soát | CI lint/test/build, migration check, security tests; staging với bản sao dữ liệu đã khử định danh; backup/restore drill, giám sát và rollback | Checklist go-live, release notes và quyết định triển khai do người vận hành phê duyệt |

## 6. Prompt giao Antigravity

```text
Bạn là nhóm kỹ sư full-stack, kiến trúc sư phần mềm, chuyên gia PostgreSQL/Supabase và bảo mật ứng dụng. Hãy nâng cấp dự án QLBHTN trong repository hiện tại theo cách an toàn, có kiểm chứng và giữ nguyên nghiệp vụ quản lý thu BHXH tự nguyện/BHYT hộ gia đình.

TÀI LIỆU ĐẦU VÀO
- Đọc toàn bộ repository, đặc biệt docs/phan-tich-va-prompt-nang-cap-antigravity.md, README.md, DEPLOYMENT_GUIDE.md, docs/, src/, supabase/migrations/, supabase/tests/ và MASTER_SETUP_ALL_IN_ONE.sql.
- Tài liệu phân tích là giả thuyết ban đầu từ mã nguồn, không phải bằng chứng về schema production. Tự kiểm tra lại mọi nhận định trước khi sửa.
- Trước khi làm, kiểm tra git status/diff. Giữ nguyên mọi thay đổi có sẵn của người dùng; không reset, checkout, stash, ghi đè hay xóa chúng.

MỤC TIÊU
1. Lập sơ đồ kiến trúc, luồng nghiệp vụ/data flow, ERD và inventory DB đầy đủ.
2. Đánh giá tính nhất quán giữa frontend types, adapters, services, Context, SQL migrations, Master SQL, RLS/RPC/triggers/tests và tài liệu.
3. Ưu tiên đúng đắn dữ liệu, quyền truy cập PII, sổ tài chính/audit, khả năng nâng cấp DB nhiều môi trường, sau đó mới tối ưu UI/hiệu năng.
4. Thực hiện nâng cấp thành các thay đổi nhỏ, tương thích ngược và có migration/kiểm thử/tài liệu đi kèm.

QUY TẮC AN TOÀN
- Không kết nối hoặc ghi vào production; không chạy SQL thay đổi trên Supabase thật; không deploy, merge, xóa dữ liệu hoặc thay secrets.
- Không drop/rename cột, bảng, RPC, policy hay dữ liệu cho đến khi có kiểm kê usage, đối soát dữ liệu và chiến lược expand/backfill/validate/contract. Nếu thiếu quyền truy cập DB production, ghi rõ mục nào cần chủ dự án xác minh; không giả định.
- Trước mọi migration có nguy cơ khóa bảng hoặc chuyển đổi dữ liệu lớn, đưa ra ước tính/tác động, kế hoạch backup/rollback và giới hạn staging. Ưu tiên migration additive, idempotent, transaction-safe.
- Không đưa PII/secrets vào log, tài liệu, fixture hoặc báo cáo. Dữ liệu dùng thử phải khử định danh.
- Không làm thay đổi quy tắc tính BHXH/BHYT, hoa hồng, trạng thái thu/nộp, quyền nghiệp vụ nếu chưa có bằng chứng và test hồi quy.
- Không tuyên bố an toàn/nhanh hơn nếu chưa có kiểm chứng. Phân biệt rõ phát hiện xác nhận được và câu hỏi cần xác minh.

TRÌNH TỰ THỰC HIỆN
A. Khảo sát repository và ghi baseline: git status, scripts, lint/test/build hiện có; kiểm kê cấu trúc frontend/backend/edge functions; liệt kê DB objects và migration ordering. Không sửa file người dùng đang thay đổi.
B. Viết báo cáo phát hiện theo P0/P1/P2, mỗi phát hiện gồm bằng chứng (đường dẫn và vị trí), tác động, cách xác minh và phương án sửa. Tạo sơ đồ ERD/module/luồng quyền bằng Mermaid khi có đủ căn cứ.
C. Xác định nguồn schema chuẩn. So sánh migrations với MASTER_SETUP_ALL_IN_ONE.sql và sửa tài liệu mâu thuẫn (bao gồm tham chiếu tệp schema không tồn tại). Không tự động sinh lại Master SQL nếu chưa xác định quy trình chuẩn.
D. Kiểm tra toàn bộ RLS/policy/grant/view và SECURITY DEFINER: search_path cố định, caller authorization, staff scope, dữ liệu trả về, anon exposure. Viết kiểm thử quyền âm/dương cho admin/accountant/staff/anon; kiểm tra giao dịch tài chính, kỳ khóa, audit bất biến, RPC gọi lặp và concurrency.
E. Kiểm tra nhất quán schema: snake_case/camelCase alias, constraints/FK/unique/index, orphan/duplicate, timezone/ngày tháng, idempotency. Đưa ra kế hoạch chuyển đổi trước; chỉ triển khai bước additive an toàn và có test.
F. Chuẩn hóa data access theo từng module; không để Context/UI gọi Supabase trực tiếp sau khi module được chuyển; dùng phân trang/lọc/tổng hợp server-side và không dựa vào limit cố định để tính tổng dữ liệu.
G. Rà soát endpoint Express OCR và Edge Functions: auth, role, CORS, MIME/content size, timeout, quota/rate limit, secrets và PII logs. Vá lỗi xác nhận được mà không làm hỏng luồng hợp lệ.
H. Thực hiện theo các PR-sized commits hoặc nhóm thay đổi nhỏ. Sau mỗi nhóm, chạy đúng các kiểm tra liên quan (lint/test/build và SQL tests nếu môi trường local có hỗ trợ); không cài package mới nếu chưa cần.
I. Cập nhật tài liệu cài mới/nâng cấp/rollback/runbook. Cuối cùng báo cáo: thay đổi, file, test đã chạy và kết quả, migration cần áp dụng, rủi ro còn lại, thao tác cần chủ dự án thực hiện.

THỨ TỰ ƯU TIÊN
1) Schema migration có thể tái lập và dữ liệu không mất; 2) RLS/RPC/PII; 3) bất biến tài chính/audit/idempotency; 4) chuẩn hóa schema và ngày tháng; 5) phân trang/data-access; 6) cấu trúc UI, accessibility và hiệu năng.

ĐIỀU KIỆN HOÀN THÀNH
- Có sơ đồ kiến trúc/ERD và ma trận role-permission được đối chiếu với mã nguồn.
- Mỗi P0 có biện pháp xử lý hoặc bước xác minh rõ ràng; không che giấu mục chưa xác minh production.
- DB mới cài được theo một đường dẫn chuẩn; DB hiện hữu có hướng dẫn nâng cấp tuần tự và rollback phù hợp.
- Kiểm thử chứng minh quyền đúng/sai theo vai trò và các invariant tài chính trọng yếu.
- Báo cáo cuối nêu chính xác kiểm tra đã chạy; không tuyên bố kiểm thử nếu chưa chạy.
```

## 7. Giới hạn rà soát

Đây là đánh giá tĩnh trên repository tại thời điểm ghi nhận. Không có quyền đọc catalog, dữ liệu, migration history hoặc cấu hình runtime của Supabase; do đó không thể xác nhận schema đang triển khai, RLS thực tế, dữ liệu trùng/orphan, hiệu năng truy vấn hay tính khả thi của rollback. Các file đang sửa sẵn tại thời điểm rà soát: `src/components/admin/FinanceView.tsx`, `src/components/admin/FinancialSettlement.tsx`, `src/components/admin/Leaderboard.tsx`, `src/utils/helpers.ts`; cần giữ nguyên và đưa vào phạm vi review riêng.
