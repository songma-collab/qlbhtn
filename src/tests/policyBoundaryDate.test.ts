import { describe, it, expect } from 'vitest';
import {
  getPolicyValueForDate,
  calculateBHYT,
  calculateBHXH
} from '../utils/calculations';
import type { Policy, RecordType } from '../context/types';

describe('Kiểm thử Ranh Giới Ngày Hiệu Lực Chính Sách (Policy Boundary Date Transitions)', () => {
  const policyTimeline: Policy[] = [
    // 1. Lương cơ sở
    {
      id: 1,
      name: 'Nghị định 38/2019/NĐ-CP (Lương cơ sở 1.490.000đ)',
      parameter_type: 'base_salary',
      value: 1490000,
      effective_date: '2019-07-01',
      is_active: false
    },
    {
      id: 2,
      name: 'Nghị định 24/2023/NĐ-CP (Lương cơ sở 1.800.000đ)',
      parameter_type: 'base_salary',
      value: 1800000,
      effective_date: '2023-07-01',
      is_active: false
    },
    {
      id: 3,
      name: 'Nghị định 73/2024/NĐ-CP (Lương cơ sở 2.340.000đ)',
      parameter_type: 'base_salary',
      value: 2340000,
      effective_date: '2024-07-01',
      is_active: true
    },
    {
      id: 4,
      name: 'Dự thảo Nghị định 2026 (Lương cơ sở 2.500.000đ)',
      parameter_type: 'base_salary',
      value: 2500000,
      effective_date: '2026-10-01',
      is_active: false
    },

    // 2. Chuẩn nghèo nông thôn
    {
      id: 10,
      name: 'Nghị định 07/2021/NĐ-CP (Chuẩn nghèo 1.500.000đ)',
      parameter_type: 'poverty_standard',
      value: 1500000,
      effective_date: '2022-01-01',
      is_active: true
    },
    {
      id: 11,
      name: 'Nghị định Chuẩn nghèo mới 2026 (1.800.000đ)',
      parameter_type: 'poverty_standard',
      value: 1800000,
      effective_date: '2026-10-01',
      is_active: false
    }
  ];

  describe('1. Ranh giới Lương cơ sở: 2024-06-30 vs 2024-07-01 (1.800.000đ -> 2.340.000đ)', () => {
    it('1.1. Tra cứu lương cơ sở tại 2024-06-30 (phút cuối hiệu lực NĐ 24/2023) phải ra đúng 1.800.000đ', () => {
      const salaryBefore = getPolicyValueForDate(policyTimeline, 'base_salary', '2024-06-30', 2340000);
      expect(salaryBefore).toBe(1800000);
    });

    it('1.2. Tra cứu lương cơ sở tại 2024-07-01 (ngày đầu tiên áp dụng NĐ 73/2024) phải ra đúng 2.340.000đ', () => {
      const salaryAfter = getPolicyValueForDate(policyTimeline, 'base_salary', '2024-07-01', 2340000);
      expect(salaryAfter).toBe(2340000);
    });

    it('1.3. Tính phí BHYT HGĐ 12 tháng tại 2024-06-30 vs 2024-07-01: Chênh lệch chuẩn xác từng đồng', () => {
      // 1 người đóng 12 tháng trước mốc 01/07/2024 (lương 1.800.000đ)
      const bhytBefore = calculateBHYT(12, 1, 1800000);
      // 4.5% * 1.800.000 * 12 = 972.000đ
      expect(bhytBefore.amount).toBe(972000);

      // 1 người đóng 12 tháng từ mốc 01/07/2024 trở đi (lương 2.340.000đ)
      const bhytAfter = calculateBHYT(12, 1, 2340000);
      // 4.5% * 2.340.000 * 12 = 1.263.600đ
      expect(bhytAfter.amount).toBe(1263600);

      // Mức chênh lệch đúng bằng 4.5% * (2.340.000 - 1.800.000) * 12 = 291.600đ
      expect(bhytAfter.amount - bhytBefore.amount).toBe(291600);
    });

    it('1.4. Tính phí hộ gia đình nhiều thành viên (1-5 người) tại 2 ranh giới ngày', () => {
      // Hộ 2 người trước mốc (12 tháng, 1.8M): Người 1 (100%) = 972k, Người 2 (70%) = 680.4k. Tổng = 1.652.400đ
      const ho2Before = calculateBHYT(12, 2, 1800000);
      expect(ho2Before.breakdown[0]!.amount).toBe(972000);
      expect(ho2Before.breakdown[1]!.amount).toBe(680400);
      expect(ho2Before.amount).toBe(1652400);

      // Hộ 2 người sau mốc (12 tháng, 2.34M): Người 1 = 1.263.600đ, Người 2 = 884.520đ. Tổng = 2.148.120đ
      const ho2After = calculateBHYT(12, 2, 2340000);
      expect(ho2After.breakdown[0]!.amount).toBe(1263600);
      expect(ho2After.breakdown[1]!.amount).toBe(884520);
      expect(ho2After.amount).toBe(2148120);

      // Hộ 5 người trước mốc: Người thứ 5 hưởng 40% (388.800đ)
      const ho5Before = calculateBHYT(12, 5, 1800000);
      expect(ho5Before.breakdown[4]!.amount).toBe(388800);

      // Hộ 5 người sau mốc: Người thứ 5 hưởng 40% (505.440đ)
      const ho5After = calculateBHYT(12, 5, 2340000);
      expect(ho5After.breakdown[4]!.amount).toBe(505440);
    });
  });

  describe('2. Ranh giới Tương lai 2026-09-30 vs 2026-10-01 (Lương cơ sở 2.340.000đ -> 2.500.000đ)', () => {
    it('2.1. Tra cứu lương cơ sở tại 2026-09-30 vẫn giữ 2.340.000đ', () => {
      const salary = getPolicyValueForDate(policyTimeline, 'base_salary', '2026-09-30', 2340000);
      expect(salary).toBe(2340000);
    });

    it('2.2. Tra cứu lương cơ sở tại 2026-10-01 chuyển sang 2.500.000đ', () => {
      const salary = getPolicyValueForDate(policyTimeline, 'base_salary', '2026-10-01', 2340000);
      expect(salary).toBe(2500000);
    });

    it('2.3. Chuẩn nghèo nông thôn chuyển từ 1.500.000đ sang 1.800.000đ tại 2026-10-01', () => {
      const povertyBefore = getPolicyValueForDate(policyTimeline, 'poverty_standard', '2026-09-30', 1500000);
      expect(povertyBefore).toBe(1500000);

      const povertyAfter = getPolicyValueForDate(policyTimeline, 'poverty_standard', '2026-10-01', 1500000);
      expect(povertyAfter).toBe(1800000);
    });
  });

  describe('3. Ranh giới Định dạng Ngày Tháng linh hoạt (Date Format Resilience)', () => {
    it('3.1. Hỗ trợ đầy đủ các định dạng ngày: YYYY-MM-DD, YYYY-MM, MM/YYYY, DD/MM/YYYY, ISO String', () => {
      // Cùng ngày 01/07/2024 ở các định dạng khác nhau đều phải nhận lương 2.340.000đ
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '2024-07-01', 1800000)).toBe(2340000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '2024-07', 1800000)).toBe(2340000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '07/2024', 1800000)).toBe(2340000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '01/07/2024', 1800000)).toBe(2340000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '2024-07-01T08:30:00.000Z', 1800000)).toBe(2340000);

      // Định dạng tháng 06/2024 phải nhận 1.800.000đ
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '2024-06', 2340000)).toBe(1800000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '06/2024', 2340000)).toBe(1800000);
      expect(getPolicyValueForDate(policyTimeline, 'base_salary', '30/06/2024', 2340000)).toBe(1800000);
    });
  });

  describe('4. Tính Bất biến của Policy Snapshot (Point-in-Time Snapshot Invariance)', () => {
    it('4.1. Hồ sơ đã lưu với baseSalarySnapshot=1800000 không bao giờ bị tính lại theo lương 2.340.000đ', () => {
      const historicalRecord: RecordType = {
        id: 99,
        type: 'BHYT',
        name: 'Hoàng Văn Cũ',
        phone: '0912345678',
        status: 'Đang tham gia',
        months: 12,
        from_month: '2024-01',
        to_month: '2024-12',
        date: '2024-01-15',
        amount: 972000,
        base_salary_snapshot: 1800000, // Snapshot thời điểm tháng 01/2024
        payment_status: 'Đã thanh toán'
      };

      // Khi tái tính toán hoặc kiểm tra, nếu có snapshot thì dùng snapshot
      const salaryToUse = historicalRecord.base_salary_snapshot || 2340000;
      const reCalc = calculateBHYT(historicalRecord.months, 1, salaryToUse);
      expect(reCalc.amount).toBe(972000);
      expect(reCalc.amount).toBe(historicalRecord.amount);
    });

    it('4.2. Hồ sơ BHXH có povertyStandardSnapshot=1500000 giữ nguyên mức hỗ trợ NSNN ngay cả khi chuẩn nghèo mới tăng', () => {
      const historicalBHXH: RecordType = {
        id: 100,
        type: 'BHXH',
        name: 'Vàng Thị Pàng',
        phone: '0912345679',
        status: 'Đang tham gia',
        amount: 1386000,
        income: 1500000,
        months: 6,
        from_month: '2024-01',
        to_month: '2024-06',
        date: '2024-01-10',
        nn_support_pct: 30,
        poverty_standard_snapshot: 1500000,
        payment_status: 'Đã thanh toán'
      };

      const povertyToUse = historicalBHXH.poverty_standard_snapshot || 1800000;
      const res = calculateBHXH(
        historicalBHXH.income || 0,
        historicalBHXH.nn_support_pct || 0,
        0, // dpSupportPct
        '6', // method 6 tháng
        0, // customMonths
        '01/2024',
        0.08,
        povertyToUse
      );

      // Tiền NSNN hỗ trợ: 1.500.000 * 22% * 30% * 6 = 594.000đ
      expect(res.nnSupportAmount).toBe(594000);
      // Tiền tự đóng thực tế: (1.500.000 * 22% * 6) - 594.000 = 1.980.000 - 594.000 = 1.386.000đ
      expect(res.amount).toBe(1386000);
    });
  });
});
