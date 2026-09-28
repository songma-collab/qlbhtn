import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  DEFAULT_REPORT_PRINT_CONFIG, 
  getStoredPrintConfig, 
  storePrintConfig, 
  extractPrintConfigFromPolicies,
  extractPrintConfig,
  hasPrintSettingsFields,
  mergeSettingsWithVietQR,
  ReportPrintConfig
} from '../utils/settingsHelper';
import { exportRevenueReportToExcel, exportRevenueReportToPdf } from '../utils/reportExportHelper';

// Mock localStorage
const mockStorage: Record<string, string> = {};
beforeEach(() => {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => {
      for (const key of Object.keys(mockStorage)) {
        delete mockStorage[key];
      }
    }
  });
});

describe('Kiểm thử Cấu hình Thông số In ấn & Báo cáo (Report Print Settings)', () => {
  it('1. DEFAULT_REPORT_PRINT_CONFIG chứa đầy đủ các thông số chuẩn Nghị định 30', () => {
    expect(DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName).toBe('BẢO HIỂM XÃ HỘI TỈNH SƠN LA');
    expect(DEFAULT_REPORT_PRINT_CONFIG.agencyName).toBe('ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ');
    expect(DEFAULT_REPORT_PRINT_CONFIG.managerName).toBe('Thủ trưởng đơn vị');
    expect(DEFAULT_REPORT_PRINT_CONFIG.reportLocation).toBe('Sông Mã');
    expect(DEFAULT_REPORT_PRINT_CONFIG.managerTitle).toBe('THỦ TRƯỞNG ĐƠN VỊ');
    expect(DEFAULT_REPORT_PRINT_CONFIG.creatorTitle).toBe('NGƯỜI LẬP BIỂU');
    expect(DEFAULT_REPORT_PRINT_CONFIG.controllerTitle).toBe('NGƯỜI KIỂM SOÁT');
  });

  it('2. getStoredPrintConfig và storePrintConfig lưu trữ và nạp chính xác từ cache', () => {
    // Ban đầu chưa có gì trong storage
    const initial = getStoredPrintConfig();
    expect(initial.parentAgencyName).toBe('BẢO HIỂM XÃ HỘI TỈNH SƠN LA');

    // Lưu thông số mới
    storePrintConfig({
      parentAgencyName: 'BHXH TỈNH SƠN LA - CHI NHÁNH SÔNG MÃ',
      agencyName: 'ĐIỂM THU BHXH TỰ NGUYỆN SỐ 1',
      managerName: 'Phạm Văn Học',
      reportLocation: 'Thị trấn Sông Mã'
    });

    const reloaded = getStoredPrintConfig();
    expect(reloaded.parentAgencyName).toBe('BHXH TỈNH SƠN LA - CHI NHÁNH SÔNG MÃ');
    expect(reloaded.agencyName).toBe('ĐIỂM THU BHXH TỰ NGUYỆN SỐ 1');
    expect(reloaded.managerName).toBe('Phạm Văn Học');
    expect(reloaded.reportLocation).toBe('Thị trấn Sông Mã');
  });

  it('3. extractPrintConfigFromPolicies trích xuất cấu hình in ấn từ bảng Policies của Supabase', () => {
    const mockPolicies = [
      {
        parameter_type: 'base_salary',
        name: 'Mức lương cơ sở',
        value: 2340000,
        effective_date: '2026-01-01',
        is_active: true
      },
      {
        parameter_type: 'report_print_settings',
        name: 'Cấu hình Thông số In ấn & Báo cáo',
        value: {
          parentAgencyName: 'BẢO HIỂM XÃ HỘI VIỆT NAM',
          agencyName: 'TỔNG ĐẠI LÝ THU SƠN LA',
          managerName: 'Nguyễn Văn Giám Đốc',
          reportLocation: 'Sơn La',
          managerTitle: 'GIÁM ĐỐC ĐẠI LÝ'
        },
        effective_date: '2026-01-01',
        is_active: true
      }
    ];

    const extracted = extractPrintConfigFromPolicies(mockPolicies);
    expect(extracted.parentAgencyName).toBe('BẢO HIỂM XÃ HỘI VIỆT NAM');
    expect(extracted.agencyName).toBe('TỔNG ĐẠI LÝ THU SƠN LA');
    expect(extracted.managerName).toBe('Nguyễn Văn Giám Đốc');
    expect(extracted.managerTitle).toBe('GIÁM ĐỐC ĐẠI LÝ');
    expect(extracted.reportLocation).toBe('Sơn La');
  });

  it('4. hasPrintSettingsFields nhận diện chính xác các trường cấu hình in ấn', () => {
    expect(hasPrintSettingsFields({ parentAgencyName: 'Cơ quan A' })).toBe(true);
    expect(hasPrintSettingsFields({ managerName: 'Nguyễn Văn A' })).toBe(true);
    expect(hasPrintSettingsFields({ reportLocation: 'Hà Nội' })).toBe(true);
    expect(hasPrintSettingsFields({ baseSalary: 2340000 })).toBe(false);
  });

  it('5. mergeSettingsWithVietQR hợp nhất đồng bộ thông số in ấn vào Settings tổng', () => {
    const dbSettings = {
      baseSalary: 2340000,
      povertyStandard: 1500000
    };

    const mockPolicies = [
      {
        parameter_type: 'report_print_settings',
        name: 'Cấu hình Thông số In ấn',
        value: {
          parentAgencyName: 'BẢO HIỂM XÃ HỘI HUYỆN SÔNG MÃ',
          agencyName: 'ĐẠI LÝ THU TƯ NHÂN VSS',
          managerName: 'Phạm Văn Học'
        },
        effective_date: '2026-01-01',
        is_active: true
      }
    ];

    const merged = mergeSettingsWithVietQR(dbSettings, mockPolicies);
    expect(merged.parentAgencyName).toBe('BẢO HIỂM XÃ HỘI HUYỆN SÔNG MÃ');
    expect(merged.agencyName).toBe('ĐẠI LÝ THU TƯ NHÂN VSS');
    expect(merged.managerName).toBe('Phạm Văn Học');
    expect(merged.reportLocation).toBe('Sông Mã'); // default
  });

  it('6. exportRevenueReportToExcel chấp nhận các tham số in ấn tùy chỉnh mà không gây lỗi', async () => {
    // Tạo sample staff data
    const sampleStaff = [
      {
        name: 'Nguyễn Thị Ngọc',
        bhxhCount: 5,
        bhxhRevenue: 10000000,
        bhxhCommission: 1000000,
        bhytCount: 2,
        bhytRevenue: 2000000,
        bhytCommission: 200000,
        revenue: 12000000,
        commission: 1200000
      }
    ];

    // Không ném exception khi gọi
    await expect(
      exportRevenueReportToExcel({
        periodText: 'Tháng 9/2026',
        agencyName: 'ĐẠI LÝ BHXH SÔNG MÃ TUYỆT VỜI',
        parentAgencyName: 'BHXH TỈNH SƠN LA',
        staffData: sampleStaff,
        currentUserName: 'Phạm Văn Học',
        managerName: 'Trưởng Đại Lý',
        reportLocation: 'Sông Mã',
        managerTitle: 'GIÁM ĐỐC',
        creatorTitle: 'CÁN BỘ LẬP',
        controllerTitle: 'KẾ TOÁN TRƯỞNG'
      })
    ).resolves.not.toThrow();
  });
});
