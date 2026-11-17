import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPolicyValueForDate,
  calculateBHXH,
  calculateBHYT,
  calculateBHYTCoterminous,
  getEffectiveCommissionConfig,
  getCommissionBreakdownForRecord,
  validateBHXHIncome
} from '../utils/calculations';
import {
  mergeSettingsWithVietQR,
  getStoredPrintConfig,
  storePrintConfig,
  getStoredReminderMessageTemplates,
  storeReminderMessageTemplates,
  getStoredVietQRConfig
} from '../utils/settingsHelper';
import type { Policy, SettingsType, RecordType } from '../context/types';

describe('Kiểm thử Audit Toàn Diện: Nghiệp vụ Thay đổi Thông số Cài đặt trong Cấu Hình Hệ Thống Chung', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
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

  /* ========================================================================
   * 1. MỨC LƯƠNG CƠ SỞ (base_salary)
   * ======================================================================== */
  describe('1. Mức lương cơ sở (base_salary) - Lan tỏa và áp dụng toàn hệ thống', () => {
    it('1.1. Khi thay đổi mức lương cơ sở (2.340.000đ -> 2.530.000đ), BHYT tự động cập nhật chính xác mức đóng 4.5%', () => {
      const bhytOld = calculateBHYT(12, 1, 2340000);
      expect(bhytOld.amount).toBe(1263600); // 2.340.000 * 4.5% * 12

      const bhytNew = calculateBHYT(12, 1, 2530000);
      expect(bhytNew.amount).toBe(1366200); // 2.530.000 * 4.5% * 12
      expect(bhytNew.amount - bhytOld.amount).toBe(102600);
    });

    it('1.2. Trần mức thu nhập đóng BHXH tự nguyện tự động tăng theo 20 lần mức lương cơ sở mới', () => {
      // Khi lương cơ sở 2.340.000đ: Trần là 46.800.000đ
      const checkOld = validateBHXHIncome(46800000, 1500000, 2340000);
      expect(checkOld.valid).toBe(true);
      expect(checkOld.maxIncome).toBe(46800000);
      expect(validateBHXHIncome(50000000, 1500000, 2340000).valid).toBe(false);

      // Khi điều chỉnh lương cơ sở lên 2.530.000đ: Trần mở rộng lên 50.600.000đ
      const checkNew = validateBHXHIncome(50000000, 1500000, 2530000);
      expect(checkNew.valid).toBe(true);
      expect(checkNew.maxIncome).toBe(50600000);
      expect(validateBHXHIncome(51000000, 1500000, 2530000).valid).toBe(false);
    });

    it('1.3. BHYT Hộ gia đình đồng hạn tự động phân bổ tỷ lệ giảm trừ (100%, 70%, 60%, 50%, 40%) theo lương cơ sở mới', () => {
      const hoGiaDinh = [
        { name: 'Chủ hộ', durationMonths: 12 },
        { name: 'Vợ', durationMonths: 12 },
        { name: 'Con 1', durationMonths: 12 },
        { name: 'Con 2', durationMonths: 12 },
        { name: 'Mẹ', durationMonths: 12 }
      ];

      const resOld = calculateBHYTCoterminous(hoGiaDinh, 2340000);
      // Người 1 (100%): 1.263.600đ
      expect(resOld.breakdown[0]!.amount).toBe(1263600);
      // Người 2 (70%): 884.520đ
      expect(resOld.breakdown[1]!.amount).toBe(884520);
      // Người 5 (40%): 505.440đ
      expect(resOld.breakdown[4]!.amount).toBe(505440);

      const resNew = calculateBHYTCoterminous(hoGiaDinh, 2530000);
      // Người 1 (100%): 1.366.200đ
      expect(resNew.breakdown[0]!.amount).toBe(1366200);
      // Người 2 (70%): 956.340đ
      expect(resNew.breakdown[1]!.amount).toBe(956340);
      // Người 5 (40%): 546.480đ
      expect(resNew.breakdown[4]!.amount).toBe(546480);
    });
  });

  /* ========================================================================
   * 2. CHUẨN NGHÈO NÔNG THÔN (poverty_standard)
   * ======================================================================== */
  describe('2. Chuẩn nghèo nông thôn (poverty_standard) - Mức sàn và tiền hỗ trợ NSNN', () => {
    it('2.1. Thay đổi chuẩn nghèo từ 1.500.000đ lên 1.800.000đ làm tăng tiền hỗ trợ NSNN theo đúng tỷ lệ', () => {
      const mockPoliciesOld: Policy[] = [
        { id: 1, name: 'Chuẩn nghèo 1.5M', parameter_type: 'poverty_standard', value: 1500000, effective_date: '2024-01-01', is_active: true }
      ];
      const mockPoliciesNew: Policy[] = [
        { id: 2, name: 'Chuẩn nghèo 1.8M', parameter_type: 'poverty_standard', value: 1800000, effective_date: '2026-01-01', is_active: true }
      ];

      // Đóng 12 tháng với mức thu nhập 2.000.000đ, đối tượng Khác (20%)
      const calcOld = calculateBHXH(2000000, 20, 0, '12', 12, '2026-07', 0.0031, 1500000, mockPoliciesOld);
      // Tiền hỗ trợ cũ: 1.500.000 * 22% * 20% * 12 = 792.000đ
      expect(calcOld.nnSupportAmount).toBe(792000);

      const calcNew = calculateBHXH(2000000, 20, 0, '12', 12, '2026-07', 0.0031, 1800000, mockPoliciesNew);
      // Tiền hỗ trợ mới: 1.800.000 * 22% * 20% * 12 = 950.400đ
      expect(calcNew.nnSupportAmount).toBe(950400);
      expect(calcNew.amount).toBe(calcOld.amount - (950400 - 792000));
    });

    it('2.2. Kiểm tra chặn mức sàn thu nhập lựa chọn: không được thấp hơn chuẩn nghèo', () => {
      expect(validateBHXHIncome(1400000, 1500000).valid).toBe(false);
      expect(validateBHXHIncome(1500000, 1500000).valid).toBe(true);

      // Khi chuẩn nghèo lên 1.800.000đ, mức 1.500.000đ không còn hợp lệ
      expect(validateBHXHIncome(1500000, 1800000).valid).toBe(false);
      expect(validateBHXHIncome(1800000, 1800000).valid).toBe(true);
    });
  });

  /* ========================================================================
   * 3. HOA HỒNG ĐẠI LÝ (commission)
   * ======================================================================== */
  describe('3. Cài đặt Tỷ lệ Hoa hồng đại lý (commission) - Đa tầng và Phân kỳ đóng trước', () => {
    it('3.1. Thay đổi cấu hình hoa hồng tác động trực tiếp lên tỷ lệ và tiền hoa hồng theo phương thức', () => {
      const customCommPolicy: Policy[] = [
        {
          id: 10,
          name: 'Hoa hồng điều chỉnh',
          parameter_type: 'commission',
          value: {
            commBHXHNew1M: 14,
            commBHXHNew3M: 16,
            commBHXHNew6M: 18,
            commBHXHNew12M: 22,
            commBHXHRenew: 10,
            commBHYTNew: 10,
            commBHYTRenew: 6
          },
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const config = getEffectiveCommissionConfig(customCommPolicy, null, '2026-07-01');
      expect(config.commBHXHNew1M).toBe(14);
      expect(config.commBHXHNew3M).toBe(16);
      expect(config.commBHXHNew6M).toBe(18);
      expect(config.commBHXHNew12M).toBe(22);
      expect(config.commBHXHRenew).toBe(10);
      expect(config.commBHYTNew).toBe(10);
      expect(config.commBHYTRenew).toBe(6);
    });

    it('3.2. Đóng trước 5 năm (60 tháng): Tự động tách 12 tháng đầu hưởng tỷ lệ mới và 48 tháng sau hưởng tỷ lệ gia hạn', () => {
      const policies: Policy[] = [
        {
          id: 20,
          name: 'Quy chuẩn 2026',
          parameter_type: 'commission',
          value: {
            commBHXHNew12M: 19,
            commBHXHRenew: 8,
            commBHXHNew1M: 12,
            commBHXHNew3M: 15,
            commBHXHNew6M: 17,
            commBHYTNew: 9,
            commBHYTRenew: 5
          },
          effective_date: '2026-01-01',
          is_active: true
        },
        {
          id: 21,
          name: 'Lãi suất 0.31%',
          parameter_type: 'investment_rate',
          value: 0.31,
          effective_date: '2026-01-01',
          is_active: true
        },
        {
          id: 22,
          name: 'Chuẩn nghèo 1.5M',
          parameter_type: 'poverty_standard',
          value: 1500000,
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const rec5Y: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        method: 'pre_60',
        months: 60,
        amount: 14138148,
        income: 1500000,
        nnSupportPct: 20,
        date: '2026-07-01',
        fromMonth: '2026-07'
      };

      const breakdown = getCommissionBreakdownForRecord(rec5Y, policies, null);
      expect(breakdown.isMultiStage).toBe(true);
      expect(breakdown.stage1Months).toBe(12);
      expect(breakdown.stage2Months).toBe(48);
      expect(breakdown.stage1RatePct).toBe(19);
      expect(breakdown.stage2RatePct).toBe(8);
      expect(breakdown.stage1Amount).toBe(3101379);
      expect(breakdown.stage2Amount).toBe(11036769);
      expect(breakdown.stage1Commission).toBe(589262);
      expect(breakdown.stage2Commission).toBe(882942);
      expect(breakdown.totalCommission).toBe(1472204);
    });
  });

  /* ========================================================================
   * 4. LÃI SUẤT ĐẦU TƯ QUỸ (investment_rate)
   * ======================================================================== */
  describe('4. Lãi suất đầu tư quỹ (investment_rate) - Chiết khấu PV và phân kỳ dòng tiền', () => {
    it('4.1. Thay đổi lãi suất đầu tư quỹ (0.31% -> 0.35%) tự động thay đổi số tiền chiết khấu đóng trước', () => {
      const policies031: Policy[] = [
        { id: 1, name: 'Lãi suất 0.31%', parameter_type: 'investment_rate', value: 0.31, effective_date: '2026-01-01', is_active: true }
      ];
      const policies035: Policy[] = [
        { id: 2, name: 'Lãi suất 0.35%', parameter_type: 'investment_rate', value: 0.35, effective_date: '2026-01-01', is_active: true }
      ];

      // Đóng trước 5 năm (pre_60), thu nhập 1.5M, đối tượng Khác
      const calc031 = calculateBHXH(1500000, 20, 0, 'pre_60', 60, '2026-07', 0.0031, 1500000, policies031);
      const calc035 = calculateBHXH(1500000, 20, 0, 'pre_60', 60, '2026-07', 0.0035, 1500000, policies035);

      // Lãi suất cao hơn -> chiết khấu nhiều hơn -> số tiền thực nộp thấp hơn
      expect(calc035.discountAmount).toBeGreaterThan(calc031.discountAmount);
      expect(calc035.amount).toBeLessThan(calc031.amount);
    });
  });

  /* ========================================================================
   * 5. ĐỒNG BỘ HAI CHIỀU POLICIES VÀ SETTINGS (mergeSettingsWithVietQR)
   * ======================================================================== */
  describe('5. Đồng bộ hai chiều Policies & Settings', () => {
    it('5.1. mergeSettingsWithVietQR tự động nạp các chính sách đang kích hoạt vào settingsLive', () => {
      const activePolicies: Policy[] = [
        { id: 1, name: 'Lương 2.530.000đ', parameter_type: 'base_salary', value: 2530000, effective_date: '2026-01-01', is_active: true },
        { id: 2, name: 'Chuẩn nghèo 1.800.000đ', parameter_type: 'poverty_standard', value: 1800000, effective_date: '2026-01-01', is_active: true },
        { id: 3, name: 'Lãi suất 0.33%', parameter_type: 'investment_rate', value: 0.33, effective_date: '2026-01-01', is_active: true },
        {
          id: 4,
          name: 'Hoa hồng mới',
          parameter_type: 'commission',
          value: { commBHXHNew12M: 21, commBHXHRenew: 9.5, commBHYTNew: 10, commBHYTRenew: 5.5, commBHXHNew1M: 13, commBHXHNew3M: 16, commBHXHNew6M: 18 },
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const baseSettings: Partial<SettingsType> = {
        baseSalary: 2340000,
        povertyStandard: 1500000,
        investmentRate: 0.31
      };

      const merged = mergeSettingsWithVietQR(baseSettings, activePolicies);
      expect(merged.baseSalary).toBe(2530000);
      expect(merged.povertyStandard).toBe(1800000);
      expect(merged.investmentRate).toBe(0.33);
      expect(merged.commBHXHNew12M).toBe(21);
      expect(merged.commBHXHRenew).toBe(9.5);
    });
  });

  /* ========================================================================
   * 6. VIETQR, PRINT SETTINGS & REMINDER MESSAGES
   * ======================================================================== */
  describe('6. Cài đặt VietQR, In Ấn & Mẫu Tin Nhắn Đôn Đốc', () => {
    it('6.1. Cấu hình in ấn được lưu trữ và nạp chính xác', () => {
      storePrintConfig({
        parentAgencyName: 'BHXH TỈNH SƠN LA - CƠ QUAN CẤP TRÊN',
        agencyName: 'ĐẠI LÝ THU BHXH SÔNG MÃ - SỐ 1',
        managerName: 'LÒ VĂN QUẢN LÝ'
      });

      const loaded = getStoredPrintConfig();
      expect(loaded.parentAgencyName).toBe('BHXH TỈNH SƠN LA - CƠ QUAN CẤP TRÊN');
      expect(loaded.agencyName).toBe('ĐẠI LÝ THU BHXH SÔNG MÃ - SỐ 1');
      expect(loaded.managerName).toBe('LÒ VĂN QUẢN LÝ');
    });

    it('6.2. Cấu hình mẫu tin nhắn đôn đốc được cập nhật và giữ nguyên các mẫu khác', () => {
      storeReminderMessageTemplates({
        renewal_bhxh: 'Kính gửi {ten_khach_hang}, BHXH sắp đến hạn đóng tiếp.',
        dispatch_urgent_bhxh: 'ĐÔN ĐỐC KHẨN CẤP: Mã BHXH {ma_so} nộp tiền gấp.'
      });

      const loaded = getStoredReminderMessageTemplates();
      expect(loaded.renewal_bhxh).toBe('Kính gửi {ten_khach_hang}, BHXH sắp đến hạn đóng tiếp.');
      expect(loaded.dispatch_urgent_bhxh).toBe('ĐÔN ĐỐC KHẨN CẤP: Mã BHXH {ma_so} nộp tiền gấp.');
      // Mẫu khác giữ nguyên mặc định
      expect(loaded.renewal_bhyt).toBeDefined();
    });
  });
});
