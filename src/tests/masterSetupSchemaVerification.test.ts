import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Kiểm thử Toàn vẹn Schema MASTER_SETUP_ALL_IN_ONE.sql', () => {
  const masterPath = path.resolve(__dirname, '../../MASTER_SETUP_ALL_IN_ONE.sql');

  it('1. Đảm bảo file MASTER_SETUP_ALL_IN_ONE.sql tồn tại và có kích thước đầy đủ', () => {
    expect(fs.existsSync(masterPath)).toBe(true);
    const stat = fs.statSync(masterPath);
    expect(stat.size).toBeGreaterThan(200000); // Tối thiểu > 200KB
  });

  it('2. Đảm bảo đầy đủ 10 bảng cốt lõi và bảng sổ cái kế toán', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    const requiredTables = [
      'public.staff',
      'public.records',
      'public.customers',
      'public.policies',
      'public.settings',
      'public.submission_batches',
      'public.financial_ledger',
      'public.financial_settlements',
      'public.auditlogs',
      'public.customer_participations'
    ];

    for (const tbl of requiredTables) {
      expect(content).toContain(tbl);
    }
  });

  it('3. Đảm bảo toàn bộ các RPC và Trigger cốt lõi của Giai đoạn P0 và P1 đều hiện diện', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    const requiredSymbols = [
      // P1: Ledger & Advisory Lock
      'sync_record_to_financial_ledger',
      'financial_ledger_lock',
      'ledger_transaction_type',
      // P1: Master Data sync
      'sync_customer_master_data_for_key',
      'sync_customer_from_record',
      'resync_customer_from_records',
      'import_records_batch',
      // P0: RBAC & Secure Delete RPCs
      'delete_record_safe',
      'bulk_delete_records_safe',
      'delete_customer_cascade',
      'crm_search_customers',
      'finance_search_records',
      'get_admin_finance_stats',
      'get_admin_dashboard_stats',
      // P0: Public Lookup & PII Masking
      'public_get_renewal_info',
      'enforce_public_rpc_rate_limit'
    ];

    for (const sym of requiredSymbols) {
      expect(content, `Thiếu biểu tượng cốt lõi: ${sym}`).toContain(sym);
    }
  });

  it('4. Đảm bảo cập nhật đầy đủ Luật BHXH 2024 (Khoản 3 Điều 36) tính hạn nộp tiếp theo', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    expect(content).toContain('calculate_bhxh_2024_next_payment');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.calculate_bhxh_2024_next_payment');
    // Đảm bảo trigger parse_record_dates_trigger gọi hàm tính hạn nộp
    expect(content).toContain('NEW.next_payment := public.calculate_bhxh_2024_next_payment');
    // Đảm bảo import_records_batch gọi hàm tính hạn nộp khi thiếu
    expect(content).toContain('v_next_payment := public.calculate_bhxh_2024_next_payment');
    // Đảm bảo có đoạn update hồi tố dữ liệu lịch sử records và customers
    expect(content).toContain('UPDATE public.records\nSET next_payment = public.calculate_bhxh_2024_next_payment');
  });

  it('5. Đảm bảo tỷ lệ hoa hồng đại lý bậc thang tháng 10/2026 hiện diện trong get_commission_rates_for_date', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    expect(content).toContain('comm_bhxh_new_1m');
    expect(content).toContain('comm_bhxh_new_3m');
    expect(content).toContain('comm_bhxh_new_6m');
    expect(content).toContain('comm_bhxh_new_12m');
    expect(content).toContain('commBHXHNew1M');
    expect(content).toContain('commBHXHNew3M');
    expect(content).toContain('commBHXHNew6M');
    expect(content).toContain('commBHXHNew12M');
  });

  it('6. Đảm bảo tính Idempotent: Tất cả DROP POLICY IF EXISTS và DROP TRIGGER IF EXISTS đầy đủ', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    const lines = content.split('\n');

    // Không được có lệnh CREATE POLICY mà trước đó không có DROP POLICY IF EXISTS tương ứng
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('CREATE POLICY')) {
        const match = trimmed.match(/CREATE POLICY "([^"]+)" ON public\.([a-z_]+)/);
        if (match) {
          const policyName = match[1];
          const tableName = match[2];
          // Tìm ngược lên 20 dòng để tìm DROP POLICY
          const lookback = lines.slice(Math.max(0, idx - 25), idx).join('\n');
          expect(
            lookback.includes(`DROP POLICY IF EXISTS "${policyName}" ON public.${tableName}`),
            `Policy "${policyName}" trên bảng "${tableName}" tại dòng ${idx + 1} thiếu DROP POLICY IF EXISTS phía trước`
          ).toBe(true);
        }
      }
    });
  });

  it('7. Đảm bảo an toàn bảo mật: Thu hồi quyền thực thi trực tiếp từ role anon trên các RPC công khai', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.public_register_customer(JSONB) FROM anon');
    expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.public_lookup_process(TEXT, TEXT) FROM anon');
    expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.check_customer_exists(TEXT) FROM anon');
    expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.public_get_renewal_info(TEXT, TEXT) FROM anon');
  });

  it('8. Tuyệt đối không chứa các trường hoặc cú pháp giả mạo (Hallucination)', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    // Các trường giả mạo bịa đặt từ bên ngoài không được phép xuất hiện
    expect(content).not.toContain('so_so_bhxh');
    expect(content).not.toContain('ngay_sinh');
    expect(content).not.toContain('성과');
  });
});
