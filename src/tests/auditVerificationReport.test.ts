import { describe, it, expect } from 'vitest';
import { 
  calculateBHXH, 
  getCommissionBreakdownForRecord, 
  getCommissionRateForRecord,
  isPrePaymentForFutureYears
} from '../utils/calculations';
import type { Policy, RecordType } from '../context/types';

describe('Audit Đối Soát Toàn Diện: Tính Hoa Hồng Đóng Trước Nhiều Năm Khớp 100% Báo Cáo', () => {
  const testPolicies: Policy[] = [
    {
      id: 1,
      name: 'Chính sách hoa hồng 19% và 8%',
      parameter_type: 'commission',
      value: {
        commBHXHNew: 19,
        commBHXHRenew: 8,
        commBHYTNew: 9,
        commBHYTRenew: 5,
        commBHXHNew1M: 12,
        commBHXHNew3M: 15,
        commBHXHNew6M: 17,
        commBHXHNew12M: 19
      },
      effective_date: '2026-01-01',
      is_active: true,
      description: '',
      notes: ''
    },
    {
      id: 2,
      name: 'Lãi suất quỹ 0.31%',
      parameter_type: 'investment_rate',
      value: 0.31,
      effective_date: '2026-01-01',
      is_active: true,
      description: '',
      notes: ''
    },
    {
      id: 3,
      name: 'Chuẩn nghèo 1.500.000',
      parameter_type: 'poverty_standard',
      value: 1500000,
      effective_date: '2026-01-01',
      is_active: true,
      description: '',
      notes: ''
    }
  ];

  it('1. Thực thu 60 tháng từ calculateBHXH phải khớp đúng 14.138.148 đ', () => {
    const calc60 = calculateBHXH(1500000, 20, 0, 'pre_60', 1, '11/2026', 0.0031, 1500000, testPolicies);
    expect(calc60.amount).toBe(14138148);
  });

  it('2. Thực thu 12 tháng đầu từ calculateBHXH phải khớp đúng 3.101.379 đ', () => {
    const calc12 = calculateBHXH(1500000, 20, 0, 'pre_12', 12, '11/2026', 0.0031, 1500000, testPolicies);
    expect(calc12.amount).toBe(3101379);
  });

  it('3. Phân kỳ hoa hồng từ getCommissionBreakdownForRecord khớp 100% từng con số với báo cáo', () => {
    const testRec: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Tăng mới',
      income: 1500000,
      nn_support_pct: 20,
      dp_support_pct: 0,
      months: 60,
      method: 'Đóng trước 5 năm',
      amount: 14138148,
      date: '2026-11-01'
    };

    const breakdown = getCommissionBreakdownForRecord(testRec, testPolicies, undefined);
    expect(breakdown.isMultiStage).toBe(true);

    // Tiền 12 tháng đầu và tiền 48 tháng sau
    expect(breakdown.stage1Amount).toBe(3101379);
    expect(breakdown.stage2Amount).toBe(11036769);

    // Thù lao hoa hồng
    expect(breakdown.stage1Commission).toBe(589262); // 19% của 3.101.379 đ
    expect(breakdown.stage2Commission).toBe(882942); // 8% của 11.036.769 đ
    expect(breakdown.totalCommission).toBe(1472204); // Tổng thù lao

    // Tỷ lệ hiệu dụng
    expect(breakdown.effectiveRatePct).toBe(10.41);

    // Đồng bộ getCommissionRateForRecord
    const rate = getCommissionRateForRecord(testRec, testPolicies, undefined);
    expect(Math.round(testRec.amount! * rate)).toBe(1472204);
  });

  it('4. Nhận diện chính xác tất cả các phương thức đóng trước (2, 3, 4, 5 năm)', () => {
    expect(isPrePaymentForFutureYears('pre_24', 24)).toBe(true);
    expect(isPrePaymentForFutureYears('pre_36', 36)).toBe(true);
    expect(isPrePaymentForFutureYears('pre_48', 48)).toBe(true);
    expect(isPrePaymentForFutureYears('pre_60', 60)).toBe(true);
    expect(isPrePaymentForFutureYears('Đóng trước 2 năm', 24)).toBe(true);
    expect(isPrePaymentForFutureYears('Đóng trước 5 năm', 60)).toBe(true);
    expect(isPrePaymentForFutureYears('post_custom', 15)).toBe(false);
    expect(isPrePaymentForFutureYears('12', 12)).toBe(false);
  });
});
