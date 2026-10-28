import { describe, it, expect } from 'vitest';
import {
  getCommissionRateForRecord,
  getCommissionBreakdownForRecord,
  getEffectiveCommissionConfig
} from '../utils/calculations';
import { parseMonthISO, getLocalYYYYMMDD } from '../utils/helpers';
import type { Policy, SettingsType } from '../context/types';

describe('Kiểm thử Đồng bộ Tỷ lệ Hoa hồng Đại lý trong Modal Đăng Ký BHXH/BHYT', () => {
  // Cấu hình chính sách tỷ lệ hoa hồng đại lý tháng 10/2026 theo ID: #13 của người dùng
  const mockPoliciesOct2026: Policy[] = [
    {
      id: 13,
      name: 'Cập nhật Tỷ lệ Hoa hồng đại lý tháng 10/2026',
      parameter_type: 'commission',
      value: {
        commBHXHNew: 20,
        commBHXHRenew: 9,
        commBHYTNew: 8,
        commBHYTRenew: 4,
        commBHXHNew1M: 12,
        commBHXHNew3M: 15,
        commBHXHNew6M: 17,
        commBHXHNew12M: 20
      },
      effective_date: '2026-10-01',
      is_active: true,
      description: 'Chính sách tỷ lệ hoa hồng đại lý áp dụng từ tháng 10/2026',
      notes: ''
    }
  ];

  const mockSettings: Partial<SettingsType> = {
    commBHXHNew: 20,
    commBHXHRenew: 9,
    commBHYTNew: 8,
    commBHYTRenew: 4,
    commBHXHNew1M: 12,
    commBHXHNew3M: 15,
    commBHXHNew6M: 17,
    commBHXHNew12M: 20
  };

  /**
   * Hàm mô phỏng logic tạo simRecord và tính toán hoa hồng trong RegisterSummary.tsx
   */
  const simulateRegisterSummaryCommission = ({
    type,
    bhxhActionType,
    isRenew = false,
    bhxhCalc,
    bhytCalc,
    totalAmount,
    policies = mockPoliciesOct2026,
    settings = mockSettings
  }: {
    type: 'BHXH' | 'BHYT';
    bhxhActionType?: 'Tăng mới' | 'Gia hạn';
    isRenew?: boolean;
    bhxhCalc?: any;
    bhytCalc?: any;
    totalAmount: number;
    policies?: Policy[];
    settings?: Partial<SettingsType>;
  }) => {
    const simMonths = type === 'BHXH'
      ? (bhxhCalc?.method === 'post_custom'
          ? (Number(bhxhCalc.customMonths) || 1)
          : (typeof bhxhCalc?.method === 'string' && bhxhCalc.method.startsWith('pre_')
              ? (parseInt(bhxhCalc.method.split('_')[1] || '1', 10) || 1)
              : (parseInt(String(bhxhCalc?.method || '1'), 10) || 1)))
      : (Number(bhytCalc?.duration) || 12);

    const rawIso = bhxhCalc?.fromMonth ? parseMonthISO(bhxhCalc.fromMonth) : '';
    const simDate = (type === 'BHXH' && rawIso && rawIso.length >= 7)
      ? `${rawIso}-01`
      : getLocalYYYYMMDD();

    const simActionType = type === 'BHXH'
      ? (bhxhActionType || (isRenew ? 'Gia hạn' : 'Tăng mới'))
      : (isRenew ? 'Gia hạn' : 'Tăng mới');

    const simRecord = {
      type,
      action_type: simActionType,
      actionType: simActionType,
      months: simMonths,
      method: type === 'BHXH' ? bhxhCalc?.method : String(simMonths),
      amount: totalAmount,
      date: simDate
    };

    const breakdown = getCommissionBreakdownForRecord(simRecord, policies, settings);
    const rateDec = getCommissionRateForRecord(simRecord, policies, settings);

    return {
      simMonths,
      simDate,
      simActionType,
      simRecord,
      rateDec,
      effectiveRate: breakdown.effectiveRatePct,
      estimatedComm: breakdown.totalCommission,
      isMultiStage: breakdown.isMultiStage,
      stage1RatePct: breakdown.stage1RatePct,
      stage2RatePct: breakdown.stage2RatePct,
      stage2Months: breakdown.stage2Months
    };
  };

  describe('1. BHXH Tăng mới: Đổi phương thức đóng -> Hoa hồng đại lý cập nhật chuẩn xác', () => {
    it('1.1. Phương thức Đóng 12 tháng -> Tỷ lệ 20%, Hoa hồng = 633.600 đ trên thực thu 3.168.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '12',
        fromMonth: '10/2026',
        toMonth: '09/2027',
        amount: 3168000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 3168000
      });

      expect(result.simMonths).toBe(12);
      expect(result.effectiveRate).toBe(20); // 20%
      expect(result.estimatedComm).toBe(633600); // 3.168.000 * 20% = 633.600 đ
      expect(result.isMultiStage).toBe(false);
    });

    it('1.2. Phương thức Đóng 6 tháng -> Tỷ lệ 17%, Hoa hồng = 269.280 đ trên thực thu 1.584.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '6',
        fromMonth: '10/2026',
        toMonth: '03/2027',
        amount: 1584000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 1584000
      });

      expect(result.simMonths).toBe(6);
      expect(result.effectiveRate).toBe(17); // 17%
      expect(result.estimatedComm).toBe(269280); // 1.584.000 * 17% = 269.280 đ
    });

    it('1.3. Phương thức Đóng 3 tháng -> Tỷ lệ 15%, Hoa hồng = 118.800 đ trên thực thu 792.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '3',
        fromMonth: '10/2026',
        toMonth: '12/2026',
        amount: 792000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 792000
      });

      expect(result.simMonths).toBe(3);
      expect(result.effectiveRate).toBe(15); // 15%
      expect(result.estimatedComm).toBe(118800); // 792.000 * 15% = 118.800 đ
    });

    it('1.4. Phương thức Đóng hằng tháng -> Tỷ lệ 12%, Hoa hồng = 31.680 đ trên thực thu 264.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '1',
        fromMonth: '10/2026',
        toMonth: '10/2026',
        amount: 264000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 264000
      });

      expect(result.simMonths).toBe(1);
      expect(result.effectiveRate).toBe(12); // 12%
      expect(result.estimatedComm).toBe(31680); // 264.000 * 12% = 31.680 đ
    });
  });

  describe('2. BHXH Gia hạn: Tỷ lệ cố định 9% theo chính sách tháng 10/2026', () => {
    it('2.1. Gia hạn 12 tháng -> Tỷ lệ 9%, Hoa hồng = 285.120 đ trên thực thu 3.168.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '12',
        fromMonth: '10/2026',
        toMonth: '09/2027',
        amount: 3168000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Gia hạn',
        isRenew: true,
        bhxhCalc,
        totalAmount: 3168000
      });

      expect(result.simMonths).toBe(12);
      expect(result.effectiveRate).toBe(9); // 9%
      expect(result.estimatedComm).toBe(285120); // 3.168.000 * 9% = 285.120 đ
    });

    it('2.2. Gia hạn 6 tháng -> Tỷ lệ 9%, Hoa hồng = 142.560 đ trên thực thu 1.584.000 đ', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: '6',
        fromMonth: '10/2026',
        toMonth: '03/2027',
        amount: 1584000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Gia hạn',
        isRenew: true,
        bhxhCalc,
        totalAmount: 1584000
      });

      expect(result.simMonths).toBe(6);
      expect(result.effectiveRate).toBe(9); // 9%
      expect(result.estimatedComm).toBe(142560); // 1.584.000 * 9% = 142.560 đ
    });
  });

  describe('3. BHXH Đóng trước > 12 tháng & Đóng bù: Hoa hồng phân kỳ đa tầng', () => {
    it('3.1. Đóng trước 2 năm (pre_24) -> 24 tháng: 12T đầu 20%, 12T sau 9% -> Tỷ lệ bình quân 14.5%', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: 'pre_24',
        fromMonth: '10/2026',
        toMonth: '09/2028',
        amount: 6336000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 6336000
      });

      expect(result.simMonths).toBe(24);
      expect(result.isMultiStage).toBe(true);
      expect(result.stage1RatePct).toBe(20);
      expect(result.stage2RatePct).toBe(9);
      expect(result.stage2Months).toBe(12);
      expect(result.effectiveRate).toBe(14.5); // (12 * 20 + 12 * 9) / 24 = 14.5%
      expect(result.estimatedComm).toBe(918720); // 6.336.000 * 14.5% = 918.720 đ
    });

    it('3.2. Đóng bù thời gian thiếu (post_custom, customMonths = 36) -> 36 tháng: 12T đầu 20%, 24T sau 9%', () => {
      const bhxhCalc = {
        income: 1500000,
        nnSupport: 20,
        dpSupport: 0,
        method: 'post_custom',
        customMonths: 36,
        fromMonth: '10/2026',
        toMonth: '09/2029',
        amount: 9504000
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHXH',
        bhxhActionType: 'Tăng mới',
        isRenew: false,
        bhxhCalc,
        totalAmount: 9504000
      });

      expect(result.simMonths).toBe(36);
      expect(result.isMultiStage).toBe(true);
      expect(result.stage1RatePct).toBe(20);
      expect(result.stage2RatePct).toBe(9);
      expect(result.stage2Months).toBe(24);
      // (12 * 20 + 24 * 9) / 36 = (240 + 216) / 36 = 456 / 36 = 12.6666...% -> 12.67%
      expect(result.effectiveRate).toBe(12.67);
      expect(result.estimatedComm).toBe(1203840);
    });
  });

  describe('4. BHYT Hộ gia đình: Hoa hồng Tăng mới và Gia hạn', () => {
    it('4.1. BHYT Tăng mới 12 tháng -> Tỷ lệ 8% theo chính sách tháng 10/2026', () => {
      const bhytCalc = {
        duration: 12,
        amount: 1263600
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHYT',
        isRenew: false,
        bhytCalc,
        totalAmount: 1263600
      });

      expect(result.simMonths).toBe(12);
      expect(result.effectiveRate).toBe(8); // 8%
      expect(result.estimatedComm).toBe(101088); // 1.263.600 * 8% = 101.088 đ
    });

    it('4.2. BHYT Gia hạn 12 tháng -> Tỷ lệ 4% theo chính sách tháng 10/2026', () => {
      const bhytCalc = {
        duration: 12,
        amount: 1263600
      };

      const result = simulateRegisterSummaryCommission({
        type: 'BHYT',
        isRenew: true,
        bhytCalc,
        totalAmount: 1263600
      });

      expect(result.simMonths).toBe(12);
      expect(result.effectiveRate).toBe(4); // 4%
      expect(result.estimatedComm).toBe(50544); // 1.263.600 * 4% = 50.544 đ
    });
  });

  describe('5. Tính toán cấu hình hiệu lực đồng bộ trong RegisterModal', () => {
    it('5.1. getEffectiveCommissionConfig trả về đúng cấu hình tháng 10/2026', () => {
      const config = getEffectiveCommissionConfig(mockPoliciesOct2026, mockSettings, '2026-10-15');
      expect(config.commBHXHNew1M).toBe(12);
      expect(config.commBHXHNew3M).toBe(15);
      expect(config.commBHXHNew6M).toBe(17);
      expect(config.commBHXHNew12M).toBe(20);
      expect(config.commBHXHRenew).toBe(9);
      expect(config.commBHYTNew).toBe(8);
      expect(config.commBHYTRenew).toBe(4);
    });
  });
});
