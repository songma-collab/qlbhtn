import { describe, it, expect } from 'vitest';
import { 
  getCommissionRateForRecord, 
  getCommissionBreakdownForRecord, 
  getRecordMonths,
  getEffectiveCommissionConfig 
} from '../utils/calculations';
import type { RecordType, Policy, SettingsType } from '../context/types';

describe('Kiểm thử Toàn diện Cơ chế Cài đặt Tỷ lệ Hoa hồng Đại lý Mới', () => {
  // Cấu hình chính sách mới chuẩn 2026
  const mockPolicies2026: Policy[] = [
    {
      id: 5,
      name: 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026',
      parameter_type: 'commission',
      value: {
        commBHXHNew: 20,
        commBHXHRenew: 9,
        commBHYTNew: 9,
        commBHYTRenew: 5,
        commBHXHNew1M: 12,
        commBHXHNew3M: 15,
        commBHXHNew6M: 17,
        commBHXHNew12M: 20
      },
      effective_date: '2026-08-01',
      is_active: true,
      description: 'Chính sách tỷ lệ hoa hồng đại lý mới 2026',
      notes: ''
    }
  ];

  const mockSettings2026: Partial<SettingsType> = {
    commBHXHNew: 20,
    commBHXHRenew: 9,
    commBHYTNew: 9,
    commBHYTRenew: 5,
    commBHXHNew1M: 12,
    commBHXHNew3M: 15,
    commBHXHNew6M: 17,
    commBHXHNew12M: 20
  };

  // 1. BHXH TĂNG MỚI THEO CÁC MỐC
  describe('1. BHXH Tăng mới theo phương thức đóng (<= 12 tháng)', () => {
    it('1.1. Tăng mới đóng 1 tháng -> Hoa hồng 12%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 1,
        method: '1',
        amount: 1000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.12); // 12%

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.effectiveRatePct).toBe(12);
      expect(breakdown.totalCommission).toBe(120000);
      expect(breakdown.isMultiStage).toBe(false);
    });

    it('1.2. Tăng mới đóng 3 tháng -> Hoa hồng 15%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 3,
        method: '3',
        amount: 3000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.15); // 15%

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.effectiveRatePct).toBe(15);
      expect(breakdown.totalCommission).toBe(450000);
    });

    it('1.3. Tăng mới đóng 6 tháng -> Hoa hồng 17%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 6,
        method: '6',
        amount: 6000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.17); // 17%

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.effectiveRatePct).toBe(17);
      expect(breakdown.totalCommission).toBe(1020000);
    });

    it('1.4. Tăng mới đóng 12 tháng -> Hoa hồng 20%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 12,
        method: '12',
        amount: 12000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.20); // 20%

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.effectiveRatePct).toBe(20);
      expect(breakdown.totalCommission).toBe(2400000);
    });
  });

  // 2. BHXH GIA HẠN THÔNG THƯỜNG
  describe('2. BHXH Gia hạn (đóng tiếp) thông thường', () => {
    it('2.1. Gia hạn 1 tháng -> Hoa hồng 9%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 1,
        amount: 1000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.09);
    });

    it('2.2. Gia hạn 3 tháng -> Hoa hồng 9%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 3,
        amount: 3000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.09);
    });

    it('2.3. Gia hạn 6 tháng -> Hoa hồng 9%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 6,
        amount: 6000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.09);
    });

    it('2.4. Gia hạn 12 tháng -> Hoa hồng 9%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 12,
        amount: 12000000,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.09);
    });
  });

  // 3. ĐÓNG TRƯỚC / ĐÓNG CHO NHỮNG NĂM CÒN THIẾU (> 12 THÁNG)
  describe('3. Phân bổ bậc thang khi đóng trước / đóng cho năm còn thiếu (> 12 tháng)', () => {
    it('3.1. Đóng 24 tháng (2 năm): 12 tháng đầu 20%, 12 tháng tiếp theo 9% -> Tỷ lệ 14.5%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 24,
        method: 'pre_24',
        amount: 24000000,
        date: '2026-08-15'
      };

      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      // (12 * 20 + 12 * 9) / 24 = (240 + 108) / 24 = 348 / 24 = 14.5% = 0.145
      expect(rate).toBeCloseTo(0.145, 4);

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.isMultiStage).toBe(true);
      expect(breakdown.effectiveRatePct).toBe(14.5);
      expect(breakdown.stage1Months).toBe(12);
      expect(breakdown.stage1RatePct).toBe(20);
      expect(breakdown.stage1Amount).toBe(12000000);
      expect(breakdown.stage1Commission).toBe(2400000); // 12tr * 20%
      expect(breakdown.stage2Months).toBe(12);
      expect(breakdown.stage2RatePct).toBe(9);
      expect(breakdown.stage2Amount).toBe(12000000);
      expect(breakdown.stage2Commission).toBe(1080000); // 12tr * 9%
      expect(breakdown.totalCommission).toBe(3480000); // 2.4tr + 1.08tr
    });

    it('3.2. Đóng 15 tháng (năm còn thiếu): 12 tháng đầu 20%, 3 tháng tiếp theo 9% -> Tỷ lệ 17.8%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 15,
        method: 'post_custom',
        amount: 15000000,
        date: '2026-08-15'
      };

      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      // (12 * 20 + 3 * 9) / 15 = (240 + 27) / 15 = 267 / 15 = 17.8% = 0.178
      expect(rate).toBeCloseTo(0.178, 4);

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.isMultiStage).toBe(true);
      expect(breakdown.effectiveRatePct).toBe(17.8);
      expect(breakdown.stage1Months).toBe(12);
      expect(breakdown.stage1RatePct).toBe(20);
      expect(breakdown.stage1Amount).toBe(12000000);
      expect(breakdown.stage1Commission).toBe(2400000);
      expect(breakdown.stage2Months).toBe(3);
      expect(breakdown.stage2RatePct).toBe(9);
      expect(breakdown.stage2Amount).toBe(3000000);
      expect(breakdown.stage2Commission).toBe(270000);
      expect(breakdown.totalCommission).toBe(2670000);
    });

    it('3.3. Đóng trước 36 tháng (3 năm): 12 tháng đầu 20%, 24 tháng tiếp theo 9% -> Tỷ lệ ~12.67%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        months: 36,
        method: 'pre_36',
        amount: 36000000,
        date: '2026-08-15'
      };

      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      // (12 * 20 + 24 * 9) / 36 = (240 + 216) / 36 = 456 / 36 = 12.6666...%
      expect(rate).toBeCloseTo(0.1267, 3);
    });

    it('3.4. Đóng trước 60 tháng (5 năm): 12 tháng đầu 20%, 48 tháng tiếp theo 9% -> Tỷ lệ 11.2%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        months: 60,
        method: 'pre_60',
        amount: 60000000,
        date: '2026-08-15'
      };

      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      // (12 * 20 + 48 * 9) / 60 = (240 + 432) / 60 = 672 / 60 = 11.2%
      expect(rate).toBeCloseTo(0.112, 4);
    });

    it('3.5. Hồ sơ Gia hạn đóng trước 24 tháng: 12 tháng đầu 20%, 12 tháng tiếp theo 9% -> Tỷ lệ 14.5%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 24,
        method: 'pre_24',
        amount: 24000000,
        date: '2026-08-15'
      };

      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBeCloseTo(0.145, 4);

      const breakdown = getCommissionBreakdownForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(breakdown.isMultiStage).toBe(true);
      expect(breakdown.effectiveRatePct).toBe(14.5);
      expect(breakdown.totalCommission).toBe(3480000);
    });
  });

  // 4. BHYT HỘ GIA ĐÌNH
  describe('4. BHYT Hộ gia đình', () => {
    it('4.1. BHYT Tăng mới -> Hưởng 9%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHYT',
        action_type: 'Đăng ký mới',
        months: 12,
        amount: 1263600,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.09);
    });

    it('4.2. BHYT Gia hạn -> Hưởng 5%', () => {
      const rec: Partial<RecordType> = {
        type: 'BHYT',
        action_type: 'Gia hạn thẻ',
        months: 12,
        amount: 1263600,
        date: '2026-08-15'
      };
      const rate = getCommissionRateForRecord(rec, mockPolicies2026, mockSettings2026);
      expect(rate).toBe(0.05);
    });
  });

  // 5. TRÍCH XUẤT SỐ THÁNG TỪ METHOD VÀ THUỘC TÍNH
  describe('5. Trích xuất số tháng linh hoạt', () => {
    it('5.1. Nhận diện từ chuỗi method "pre_24" -> 24 tháng', () => {
      expect(getRecordMonths({ method: 'pre_24' })).toBe(24);
    });

    it('5.2. Nhận diện từ chuỗi method "pre_36" -> 36 tháng', () => {
      expect(getRecordMonths({ method: 'pre_36' })).toBe(36);
    });

    it('5.3. Nhận diện từ chuỗi tiếng Việt "Đóng trước 2 năm" -> 24 tháng', () => {
      expect(getRecordMonths({ method: 'Đóng trước 2 năm' })).toBe(24);
    });

    it('5.4. Nhận diện từ chuỗi tiếng Việt "15 tháng" -> 15 tháng', () => {
      expect(getRecordMonths({ method: '15 tháng' })).toBe(15);
    });
  });

  // 6. TƯƠNG THÍCH NGƯỢC VỚI CHÍNH SÁCH CŨ
  describe('6. Tương thích ngược với chính sách cũ', () => {
    it('6.1. Chính sách cũ chỉ có commBHXHNew: 5, commBHXHRenew: 3 -> Hoạt động chuẩn xác 5% và 3%', () => {
      const legacyPolicies: Policy[] = [
        {
          id: 4,
          name: 'Quyết định 11 cũ',
          parameter_type: 'commission',
          value: { commBHXHNew: 5, commBHXHRenew: 3, commBHYTNew: 5, commBHYTRenew: 3 },
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const newRec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Tăng mới',
        months: 1,
        amount: 1000000,
        date: '2026-01-15'
      };
      expect(getCommissionRateForRecord(newRec, legacyPolicies)).toBe(0.05);

      const renewRec: Partial<RecordType> = {
        type: 'BHXH',
        action_type: 'Gia hạn',
        months: 6,
        amount: 6000000,
        date: '2026-01-15'
      };
      expect(getCommissionRateForRecord(renewRec, legacyPolicies)).toBe(0.03);
    });
  });
});
