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

  it('4. Tuyệt đối không chứa các trường hoặc cú pháp giả mạo (Hallucination)', () => {
    const content = fs.readFileSync(masterPath, 'utf-8');
    // Các trường giả mạo bịa đặt từ bên ngoài không được phép xuất hiện
    expect(content).not.toContain('so_so_bhxh');
    expect(content).not.toContain('ngay_sinh');
    expect(content).not.toContain('성과');
  });
});
