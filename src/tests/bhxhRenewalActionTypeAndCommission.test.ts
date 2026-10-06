import { describe, it, expect } from 'vitest';
import { getCommissionRateForRecord, getCustomerPreviousBHXHMonths } from '../utils/calculations';
import { isD05TSRenew } from '../utils/exportNationalStandardForms';
import type { RecordType, Policy, SettingsType } from '../context/types';

describe('Kiểm thử Nghiệp vụ Gia hạn BHXH Tự Nguyện & Phân loại Hồ sơ Tăng mới vs Gia hạn', () => {
  const mockSettings: Partial<SettingsType> = {
    commBHXHNew: 5,   // Hoa hồng tăng mới 5%
    commBHXHRenew: 3, // Hoa hồng gia hạn 3%
  };

  const mockPolicies: Policy[] = [
    {
      id: 1,
      parameter_type: 'commission',
      value: { commBHXHNew: 5, commBHXHRenew: 3, commBHYTNew: 5, commBHYTRenew: 3 },
      effective_date: '2026-01-01',
      is_active: true,
      description: 'Chính sách hoa hồng chuẩn',
      notes: ''
    }
  ];

  it('1. Hồ sơ được tích chọn "Tăng mới" được hưởng mức hoa hồng tăng mới (5%)', () => {
    const recordNew: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Tăng mới',
      amount: 1500000,
      date: '2026-10-06'
    };

    const rate = getCommissionRateForRecord(recordNew, mockPolicies, mockSettings);
    expect(rate).toBe(0.05); // 5%
  });

  it('2. Hồ sơ được tích chọn "Gia hạn" được hưởng mức hoa hồng gia hạn (3%)', () => {
    const recordRenew: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Gia hạn',
      amount: 1500000,
      date: '2026-10-06'
    };

    const rate = getCommissionRateForRecord(recordRenew, mockPolicies, mockSettings);
    expect(rate).toBe(0.03); // 3%
  });

  it('3. Người tham gia đóng 1 tháng, 3 tháng, 6 tháng: các lần sau vẫn được tính tăng mới cho đến khi đủ 12 tháng', () => {
    // Khách hàng A: Lần 1 đóng 3 tháng (tháng 01/2026 - 03/2026)
    const recordsHistory: Partial<RecordType>[] = [
      {
        id: 101,
        cccd: '001099000099',
        type: 'BHXH',
        action_type: 'Đăng ký mới',
        from_month: '2026-01',
        to_month: '2026-03',
        months: 3,
        payment_status: 'Đã thu tiền',
        date: '2026-01-10'
      }
    ];

    // Khi khách hàng đến gia hạn đóng tiếp kỳ 2 (tháng 04/2026 - 06/2026):
    const accumulatedBeforeRenewal = getCustomerPreviousBHXHMonths(
      recordsHistory as RecordType[],
      { cccd: '001099000099' },
      null,
      '04/2026'
    );

    expect(accumulatedBeforeRenewal).toBe(3); // Đã tích lũy 3 tháng (< 12 tháng)

    // Cán bộ thu tích chọn "Hồ sơ tăng mới" cho lần đóng 3 tháng tiếp theo
    const secondPayment: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Tăng mới', // Tích chọn tăng mới vì chưa đủ 12 tháng
      amount: 1200000,
      from_month: '2026-04',
      to_month: '2026-06',
      months: 3,
      date: '2026-04-05'
    };

    const rateSecondPayment = getCommissionRateForRecord(secondPayment, mockPolicies, mockSettings);
    expect(rateSecondPayment).toBe(0.05); // Vẫn hưởng hoa hồng tăng mới 5%
  });

  it('4. Khách hàng đã đóng ở đại lý khác rồi chuyển sang đại lý hiện tại: Tích chọn "Gia hạn" và hưởng hoa hồng gia hạn', () => {
    // Khách hàng đổi đại lý sang đại lý này: Không được tính tăng mới
    const transferredCustomerRecord: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Gia hạn', // Cán bộ thu chủ động tích chọn Gia hạn theo quy định
      amount: 2500000,
      months: 6,
      date: '2026-10-06'
    };

    const rate = getCommissionRateForRecord(transferredCustomerRecord, mockPolicies, mockSettings);
    expect(rate).toBe(0.03); // Hưởng hoa hồng gia hạn 3%
  });

  it('5. Biểu mẫu D05-TS: Hồ sơ Tăng mới ghi phương thức Tăng_mới, Hồ sơ Gia hạn ghi Đóng_tiếp', () => {
    const recordNewD05: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Tăng mới',
      isRenew: false
    };
    expect(isD05TSRenew(recordNewD05)).toBe(false); // Sẽ ghi 'Tăng_mới'

    const recordRenewD05: Partial<RecordType> = {
      type: 'BHXH',
      action_type: 'Gia hạn',
      isRenew: true
    };
    expect(isD05TSRenew(recordRenewD05)).toBe(true); // Sẽ ghi 'Đóng_tiếp'
  });
});
