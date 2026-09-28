import { describe, it, expect } from 'vitest';
import { 
  sanitizeRecordForDb, 
  handleSchemaCacheMissingColumn, 
  unsupportedRecordColumns,
  sanitizeSettingsForDb,
  handleSettingsSchemaCacheMissingColumn,
  unsupportedSettingsColumns,
  mergeSettingsWithVietQR
} from '../context/AppContext';

describe('Kiểm thử Độ bền Schema Cache (PostgREST PGRST204 Schema Resilience)', () => {
  it('1. sanitizeRecordForDb phải loại bỏ primary key id khi cập nhật (isUpdate = true)', () => {
    const input = {
      id: 12345,
      name: 'Nguyễn Văn A',
      phone: '0912345678',
      amount: 1500000,
      bhxhCu: '1234567890',
      staff_id: 'STAFF01',
      emptyField: undefined
    };

    const sanitized = sanitizeRecordForDb(input, true);

    expect(sanitized.id).toBeUndefined();
    expect(sanitized.bhxhCu).toBeUndefined();
    expect(sanitized.staff_id).toBeUndefined();
    expect(sanitized.emptyField).toBeUndefined();
    expect(sanitized.name).toBe('Nguyễn Văn A');
    expect(sanitized.phone).toBe('0912345678');
    expect(sanitized.amount).toBe(1500000);
  });

  it('2. handleSchemaCacheMissingColumn phát hiện và loại bỏ cột chưa có trong database', () => {
    const payload: any = {
      name: 'Trần Thị B',
      baseSalarySnapshot: 2340000,
      povertyStandardSnapshot: 1500000
    };

    const mockPostgrestError = {
      code: 'PGRST204',
      message: "Could not find the 'baseSalarySnapshot' column of 'records' in the schema cache"
    };

    const handled = handleSchemaCacheMissingColumn(mockPostgrestError, payload);

    expect(handled).toBe(true);
    expect(payload.baseSalarySnapshot).toBeUndefined();
    expect(payload.name).toBe('Trần Thị B');
    expect(unsupportedRecordColumns.has('baseSalarySnapshot')).toBe(true);

    // Kiểm tra lần sanitize sau tự động loại bỏ cột đã nhớ
    const nextPayload = {
      name: 'Lê Văn C',
      baseSalarySnapshot: 2340000,
      amount: 500000
    };
    const sanitizedNext = sanitizeRecordForDb(nextPayload, false);
    expect(sanitizedNext.baseSalarySnapshot).toBeUndefined();
    expect(sanitizedNext.name).toBe('Lê Văn C');
    expect(sanitizedNext.amount).toBe(500000);
  });

  it('3. sanitizeSettingsForDb tự động loại bỏ các trường VietQR và trường không tồn tại khỏi payload gửi lên settings', () => {
    const inputSettings = {
      id: 1,
      baseSalary: 2340000,
      povertyStandard: 1500000,
      commBHXHNew: 5,
      // Các trường VietQR không được gửi trực tiếp vào bảng settings gây PGRST204
      accountHolder: 'DAI LY THU BHXH SONG MA',
      accountNumber: '0868123456',
      agencyName: 'Đại lý thu BHXH Sông Mã',
      bankBin: '970422',
      bankId: 'MB',
      bankName: 'MB (Ngân hàng Quân Đội)',
      qrTemplate: 'compact2',
      bank_owner: 'DAI LY THU BHXH SONG MA',
      bank_account: '0868123456'
    };

    const dbPayload = sanitizeSettingsForDb(inputSettings);

    // id và các trường VietQR phải bị loại bỏ để bảo vệ Supabase query
    expect(dbPayload.id).toBeUndefined();
    expect(dbPayload.accountHolder).toBeUndefined();
    expect(dbPayload.accountNumber).toBeUndefined();
    expect(dbPayload.agencyName).toBeUndefined();
    expect(dbPayload.bankBin).toBeUndefined();
    expect(dbPayload.bankId).toBeUndefined();
    expect(dbPayload.bankName).toBeUndefined();
    expect(dbPayload.qrTemplate).toBeUndefined();
    expect(dbPayload.bank_owner).toBeUndefined();
    expect(dbPayload.bank_account).toBeUndefined();

    // Các cột thực sự của bảng settings phải được giữ nguyên
    expect(dbPayload.baseSalary).toBe(2340000);
    expect(dbPayload.povertyStandard).toBe(1500000);
    expect(dbPayload.commBHXHNew).toBe(5);
  });

  it('4. handleSettingsSchemaCacheMissingColumn xử lý lỗi PGRST204 và tự động ghi nhớ loại trừ', () => {
    const payload: any = {
      baseSalary: 2340000,
      extraLegacyField: 123
    };

    const mockPgrstError = {
      code: 'PGRST204',
      details: null,
      hint: null,
      message: "Could not find the 'accountHolder' column of 'settings' in the schema cache"
    };

    const handled = handleSettingsSchemaCacheMissingColumn(mockPgrstError, payload);
    expect(handled).toBe(true);
    expect(unsupportedSettingsColumns.has('accountHolder')).toBe(true);
  });

  it('5. mergeSettingsWithVietQR hợp nhất dữ liệu an toàn mà không làm mất thông tin tài khoản VietQR', () => {
    const dbSettings = {
      id: 1,
      baseSalary: 2340000,
      povertyStandard: 1500000
    };

    const merged = mergeSettingsWithVietQR(dbSettings);

    expect(merged.baseSalary).toBe(2340000);
    expect(merged.povertyStandard).toBe(1500000);
    expect(merged.accountHolder).toBeDefined();
    expect(merged.accountNumber).toBeDefined();
    expect(merged.bankBin).toBeDefined();
    expect(merged.agencyName).toBeDefined();
    expect(merged.qrTemplate).toBeDefined();
  });
});
