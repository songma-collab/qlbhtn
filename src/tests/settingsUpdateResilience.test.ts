import { describe, it, expect, beforeEach } from 'vitest';
import { 
  sanitizeSettingsForDb, 
  handleSettingsSchemaCacheMissingColumn, 
  mergeSettingsWithVietQR,
  extractVietQRConfig,
  getStoredVietQRConfig,
  hasVietQRFields,
  unsupportedSettingsColumns
} from '../utils/settingsHelper';

describe('Kiểm thử Độ bền và Phòng chống lỗi PGRST204 cho Settings & VietQR', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    unsupportedSettingsColumns.clear();
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    };
    (globalThis as any).localStorage = storageMock;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = storageMock;
    }
  });

  it('1. hasVietQRFields nhận diện chính xác các trường VietQR', () => {
    expect(hasVietQRFields({ accountHolder: 'NGUYEN VAN A' })).toBe(true);
    expect(hasVietQRFields({ accountNumber: '123456789' })).toBe(true);
    expect(hasVietQRFields({ bankBin: '970422' })).toBe(true);
    expect(hasVietQRFields({ bank_owner: 'NGUYEN VAN A' })).toBe(true);
    expect(hasVietQRFields({ agencyName: 'Đại lý ABC' })).toBe(true);
    expect(hasVietQRFields({ baseSalary: 2340000 })).toBe(false);
    expect(hasVietQRFields({ commBHXHNew: 5 })).toBe(false);
  });

  it('2. sanitizeSettingsForDb loại bỏ tuyệt đối các trường VietQR khỏi payload của bảng settings', () => {
    const payloadWithVietQR = {
      baseSalary: 2340000,
      povertyStandard: 1500000,
      accountHolder: 'DAI LY THU BHXH SONG MA',
      accountNumber: '0868123456',
      agencyName: 'Đại lý thu BHXH Sông Mã',
      bankBin: '970422',
      bankId: 'MB',
      bankName: 'MB (Ngân hàng Quân Đội)',
      qrTemplate: 'compact2'
    };

    const sanitized = sanitizeSettingsForDb(payloadWithVietQR);

    // Không được chứa các cột VietQR để tránh lỗi PGRST204
    expect(sanitized.accountHolder).toBeUndefined();
    expect(sanitized.accountNumber).toBeUndefined();
    expect(sanitized.agencyName).toBeUndefined();
    expect(sanitized.bankBin).toBeUndefined();
    expect(sanitized.bankId).toBeUndefined();
    expect(sanitized.bankName).toBeUndefined();
    expect(sanitized.qrTemplate).toBeUndefined();

    // Phải giữ lại cột hợp lệ trong DB
    expect(sanitized.baseSalary).toBe(2340000);
    expect(sanitized.povertyStandard).toBe(1500000);
  });

  it('3. Khi cập nhật chỉ chứa thông tin VietQR, sanitizeSettingsForDb trả về rỗng để không gọi vô ích vào bảng settings', () => {
    const vietqrOnly = {
      agencyName: 'Đại lý thu BHXH Sông Mã',
      agencyCode: 'VSS-SM-001',
      bankBin: '970422',
      bankId: 'MB',
      bankName: 'MB (Ngân hàng Quân Đội)',
      accountNumber: '0868123456',
      accountHolder: 'DAI LY THU BHXH SONG MA',
      qrTemplate: 'compact2'
    };

    const sanitized = sanitizeSettingsForDb(vietqrOnly);
    expect(Object.keys(sanitized).length).toBe(0);
  });

  it('4. extractVietQRConfig trích xuất đầy đủ và chuẩn hóa chuỗi', () => {
    const config = extractVietQRConfig({
      agencyName: '   Đại lý Mộc Châu   ',
      bankBin: '970436',
      bankId: 'VCB',
      bankName: 'Vietcombank',
      accountNumber: '0123456789',
      accountHolder: 'TRAN VAN B',
      qrTemplate: 'compact'
    });

    expect(config.agencyName).toBe('Đại lý Mộc Châu');
    expect(config.bankBin).toBe('970436');
    expect(config.bankId).toBe('VCB');
    expect(config.accountNumber).toBe('0123456789');
    expect(config.accountHolder).toBe('TRAN VAN B');
    expect(config.qrTemplate).toBe('compact');
  });

  it('5. Lưu và khôi phục cấu hình VietQR từ localStorage offline-first', () => {
    const newConfig = {
      agencyName: 'Đại lý thu BHXH Mai Sơn',
      agencyCode: 'VSS-MS-002',
      bankBin: '970415',
      bankId: 'CTG',
      bankName: 'VietinBank',
      accountNumber: '10987654321',
      accountHolder: 'DAI LY THU MAI SON',
      qrTemplate: 'qr_only'
    };

    localStorage.setItem('vss_vietqr_agency_config', JSON.stringify(newConfig));

    const restored = getStoredVietQRConfig();
    expect(restored.agencyName).toBe('Đại lý thu BHXH Mai Sơn');
    expect(restored.accountNumber).toBe('10987654321');
    expect(restored.accountHolder).toBe('DAI LY THU MAI SON');

    const merged = mergeSettingsWithVietQR({ baseSalary: 2340000 });
    expect(merged.agencyName).toBe('Đại lý thu BHXH Mai Sơn');
    expect(merged.accountNumber).toBe('10987654321');
    expect(merged.accountHolder).toBe('DAI LY THU MAI SON');
    expect(merged.baseSalary).toBe(2340000);
  });

  it('6. Phản hồi lỗi PGRST204 giả lập và loại trừ cột khỏi schema cache', () => {
    const payload: any = {
      baseSalary: 2340000,
      accountHolder: 'TEST HOLDER'
    };

    const pgrstError = {
      code: 'PGRST204',
      message: "Could not find the 'accountHolder' column of 'settings' in the schema cache"
    };

    const handled = handleSettingsSchemaCacheMissingColumn(pgrstError, payload);
    expect(handled).toBe(true);
    expect(payload.accountHolder).toBeUndefined();
    expect(payload.baseSalary).toBe(2340000);
    expect(unsupportedSettingsColumns.has('accountHolder')).toBe(true);
  });
});
