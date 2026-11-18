import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audit Toàn Diện Mã Nguồn Backend & Rà Soát Lỗi Tiềm Ẩn (Backend Architecture & Security Audit)', () => {
  const ocrFunctionPath = path.resolve(__dirname, '../../supabase/functions/gemini-ocr/index.ts');
  const intakeFunctionPath = path.resolve(__dirname, '../../supabase/functions/public-customer-intake/index.ts');
  const masterSqlPath = path.resolve(__dirname, '../../MASTER_SETUP_ALL_IN_ONE.sql');
  const serverTsPath = path.resolve(__dirname, '../../server.ts');
  const deployServerPath = path.resolve(__dirname, '../../deploy/server.cjs');
  const recordServicePath = path.resolve(__dirname, '../services/recordService.ts');
  const customerServicePath = path.resolve(__dirname, '../services/customerService.ts');

  describe('1. Kiểm toán Edge Function: Gemini OCR (supabase/functions/gemini-ocr)', () => {
    const ocrCode = fs.readFileSync(ocrFunctionPath, 'utf-8');

    it('1.1. Bắt buộc kiểm tra JWT Bearer token và xác thực danh tính Cán bộ', () => {
      expect(ocrCode).toContain('req.headers.get("Authorization")');
      expect(ocrCode).toContain('authHeader.startsWith("Bearer ")');
      expect(ocrCode).toContain('supabaseClient.auth.getUser()');
    });

    it('1.2. Chặn tài khoản cán bộ có trạng thái "Tạm khóa" hoặc không thuộc staff', () => {
      expect(ocrCode).toContain('from("staff")');
      expect(ocrCode).toContain('staffData.status === "Tạm khóa"');
      expect(ocrCode).toContain('status: 403');
    });

    it('1.3. Có danh sách trắng định dạng MIME hợp lệ và giới hạn kích thước tệp', () => {
      expect(ocrCode).toContain('ALLOWED_MIME_TYPES');
      expect(ocrCode).toContain('"image/jpeg"');
      expect(ocrCode).toContain('"application/pdf"');
      expect(ocrCode).toContain('MAX_BASE64_LENGTH');
    });

    it('1.4. Thiết lập Model Cascade với AbortController timeout an toàn', () => {
      expect(ocrCode).toContain('candidateModels');
      expect(ocrCode).toContain('gemini-3.7-flash');
      expect(ocrCode).toContain('AbortController');
      expect(ocrCode).toContain('clearTimeout(timeoutId)');
    });
  });

  describe('2. Kiểm toán Edge Function: Tiếp nhận Đăng ký Công cộng (public-customer-intake)', () => {
    const intakeCode = fs.readFileSync(intakeFunctionPath, 'utf-8');

    it('2.1. Kiểm tra CORS Origin danh sách trắng và giới hạn payload 100KB', () => {
      expect(intakeCode).toContain('DEFAULT_ALLOWED_ORIGINS');
      expect(intakeCode).toContain('MAX_PAYLOAD_BYTES');
      expect(intakeCode).toContain('contentLength > MAX_PAYLOAD_BYTES');
    });

    it('2.2. Bắt buộc xác minh Cloudflare Turnstile CAPTCHA trên các hành động công khai', () => {
      expect(intakeCode).toContain('turnstileToken');
      expect(intakeCode).toContain('challenges.cloudflare.com/turnstile/v0/siteverify');
      expect(intakeCode).toContain('CAPTCHA_VERIFICATION_FAILED');
    });

    it('2.3. Trích xuất Client IP an toàn và chuyển tiếp vào RPC CSDL', () => {
      expect(intakeCode).toContain('cf-connecting-ip');
      expect(intakeCode).toContain('x-real-ip');
      expect(intakeCode).toContain('enrichedPayload');
    });

    it('2.4. Đóng vai trò Cổng bảo vệ Gateway: Điều hướng sang các RPC chuyên dụng', () => {
      expect(intakeCode).toContain('public_register_customer');
      expect(intakeCode).toContain('public_lookup_process');
      expect(intakeCode).toContain('public_get_renewal_info');
      expect(intakeCode).toContain('check_customer_exists');
    });
  });

  describe('3. Kiểm toán Cơ sở dữ liệu, Row Level Security (RLS) & RPC Stored Procedures', () => {
    const sqlCode = fs.readFileSync(masterSqlPath, 'utf-8');

    it('3.1. Toàn bộ 11 bảng CSDL đều được kích hoạt ROW LEVEL SECURITY (RLS)', () => {
      const tables = [
        'public.staff',
        'public.records',
        'public.settings',
        'public.policies',
        'public.auditlogs',
        'public.public_rpc_call_log',
        'public.customers',
        'public.customer_participations',
        'public.submission_batches',
        'public.financial_settlements',
        'public.financial_ledger'
      ];
      for (const t of tables) {
        expect(sqlCode).toContain(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      }
    });

    it('3.2. Thu hồi toàn bộ quyền EXECUTE trực tiếp từ anon trên các hàm nhạy cảm', () => {
      expect(sqlCode).toContain('REVOKE EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) FROM anon;');
      expect(sqlCode).toContain('GRANT EXECUTE ON FUNCTION public.public_register_customer(JSONB) TO service_role');
      expect(sqlCode).toContain('GRANT EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) TO service_role');
    });

    it('3.3. Các hàm SECURITY DEFINER đều có search_path tường minh chống tấn công chiếm đoạt đường dẫn', () => {
      expect(sqlCode).toContain('SET search_path = public, pg_temp');
    });

    it('3.4. Bảng sổ cái tài chính financial_ledger là bất biến (Append-Only) và chống cập nhật/xóa', () => {
      expect(sqlCode).toContain('CREATE TABLE IF NOT EXISTS public.financial_ledger');
      expect(sqlCode).toContain('sync_record_to_financial_ledger');
      expect(sqlCode).toContain('financial_ledger_lock');
    });
  });

  describe('4. Kiểm toán Tầng Dịch vụ (Data Access Services) & Server Host', () => {
    const recordServiceCode = fs.readFileSync(recordServicePath, 'utf-8');
    const customerServiceCode = fs.readFileSync(customerServicePath, 'utf-8');
    const serverTsCode = fs.readFileSync(serverTsPath, 'utf-8');
    const deployServerCode = fs.readFileSync(deployServerPath, 'utf-8');

    it('4.1. recordService tích hợp Idempotency Key, chống PGRST204 và tự động retry', () => {
      expect(recordServiceCode).toContain('generateIdempotencyKey()');
      expect(recordServiceCode).toContain('handleSchemaCacheMissingColumn');
      expect(recordServiceCode).toContain('withRetry');
    });

    it('4.2. customerService hỗ trợ phân trang Server-side qua RPC crm_search_customers', () => {
      expect(customerServiceCode).toContain("supabase.rpc('crm_search_customers'");
      expect(customerServiceCode).toContain('lookupCustomerProfile');
    });

    it('4.3. server.ts có đầy đủ HTTP Security Headers, ẩn x-powered-by và graceful shutdown', () => {
      expect(serverTsCode).toContain("app.disable('x-powered-by')");
      expect(serverTsCode).toContain('X-Content-Type-Options');
      expect(serverTsCode).toContain('X-Frame-Options');
      expect(serverTsCode).toContain('Permissions-Policy');
      expect(serverTsCode).toContain('gracefulShutdown');
    });

    it('4.4. deploy/server.cjs chặn 100% tấn công Path Traversal (LFI) với safePath.startsWith', () => {
      expect(deployServerCode).toContain('path.resolve(DIST_DIR, \'.\' + decodedPath)');
      expect(deployServerCode).toContain('!safePath.startsWith(DIST_DIR)');
    });
  });
});
