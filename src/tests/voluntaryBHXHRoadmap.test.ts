import { describe, it, expect } from 'vitest';
import { calculateVoluntaryBHXHRoadmap } from '../utils/pensionAccumulation';
import { calculateBHXH, getCustomerPreviousBHXHMonths } from '../utils/calculations';

describe('Kiểm thử Lộ Trình Đóng BHXH Tự Nguyện Chuẩn Luật BHXH 2024 & NĐ 159/2025 (voluntaryBHXHRoadmap)', () => {
  const POVERTY_1500K = 1500000;

  describe('1. Kiểm thử phân kỳ 10 năm đầu được hỗ trợ & từ năm thứ 11 đóng đủ 100% gốc', () => {
    it('Lộ trình dưới hoặc bằng 10 năm: toàn bộ thời gian được hỗ trợ', () => {
      const res5Years = calculateVoluntaryBHXHRoadmap({
        income: POVERTY_1500K,
        years: 5,
        povertyStandard: POVERTY_1500K,
        nsnnRate: 20,
        dpRate: 0
      });

      expect(res5Years.supportedYears).toBe(5);
      expect(res5Years.unsupportedYears).toBe(0);
      expect(res5Years.supportedMonths).toBe(60);
      expect(res5Years.unsupportedMonths).toBe(0);
      expect(res5Years.first10YearsMonthly).toBe(264000); // 330.000 - 66.000
      expect(res5Years.totalContributed).toBe(60 * 264000); // 15.840.000đ
      expect(res5Years.totalSupportAmount).toBe(60 * 66000); // 3.960.000đ
    });

    it('Lộ trình đúng 10 năm (120 tháng): hưởng tối đa mức trần hỗ trợ của NSNN', () => {
      const res10Years = calculateVoluntaryBHXHRoadmap({
        income: POVERTY_1500K,
        years: 10,
        povertyStandard: POVERTY_1500K,
        nsnnRate: 20
      });

      expect(res10Years.supportedYears).toBe(10);
      expect(res10Years.unsupportedYears).toBe(0);
      expect(res10Years.supportedMonths).toBe(120);
      expect(res10Years.unsupportedMonths).toBe(0);
      expect(res10Years.totalContributed).toBe(120 * 264000); // 31.680.000đ
      expect(res10Years.totalSupportAmount).toBe(120 * 66000); // 7.920.000đ
    });

    it('Lộ trình trên 10 năm: đúng 120 tháng đầu có hỗ trợ, từ tháng 121 nộp đủ 100% mức gốc', () => {
      const res15Years = calculateVoluntaryBHXHRoadmap({
        income: POVERTY_1500K,
        years: 15,
        povertyStandard: POVERTY_1500K,
        nsnnRate: 20
      });

      expect(res15Years.supportedYears).toBe(10);
      expect(res15Years.unsupportedYears).toBe(5);
      expect(res15Years.supportedMonths).toBe(120);
      expect(res15Years.unsupportedMonths).toBe(60);
      expect(res15Years.first10YearsMonthly).toBe(264000);
      expect(res15Years.after10YearsMonthly).toBe(330000);
      expect(res15Years.totalContributed).toBe(120 * 264000 + 60 * 330000); // 51.480.000đ
    });
  });

  describe('2. Kiểm thử toàn diện 5 nhóm đối tượng hỗ trợ (50%, 40%, 30%, 20%, 10%) ở mức chuẩn nghèo', () => {
    // Mức chuẩn nghèo 1.500.000đ: Mức gốc = 330.000đ/tháng

    it('Nhóm Hộ nghèo / Xã đảo (50% hỗ trợ): 15 năm, 20 năm, 25 năm', () => {
      // Hỗ trợ = 330.000 * 50% = 165.000đ/th. Thực nộp 10 năm đầu = 165.000đ/th. Sau 10 năm = 330.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 15, povertyStandard: POVERTY_1500K, nsnnRate: 50 });
      const m20 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 20, povertyStandard: POVERTY_1500K, nsnnRate: 50 });
      const m25 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 25, povertyStandard: POVERTY_1500K, nsnnRate: 50 });

      expect(m15.first10YearsMonthly).toBe(165000);
      expect(m15.after10YearsMonthly).toBe(330000);
      expect(m15.totalContributed).toBe(120 * 165000 + 60 * 330000); // 39.600.000đ
      expect(m20.totalContributed).toBe(120 * 165000 + 120 * 330000); // 59.400.000đ
      expect(m25.totalContributed).toBe(120 * 165000 + 180 * 330000); // 79.200.000đ
    });

    it('Nhóm Hộ cận nghèo (40% hỗ trợ): 15 năm, 20 năm, 25 năm', () => {
      // Hỗ trợ = 330.000 * 40% = 132.000đ/th. Thực nộp 10 năm đầu = 198.000đ/th. Sau 10 năm = 330.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 15, povertyStandard: POVERTY_1500K, nsnnRate: 40 });
      const m20 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 20, povertyStandard: POVERTY_1500K, nsnnRate: 40 });
      const m25 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 25, povertyStandard: POVERTY_1500K, nsnnRate: 40 });

      expect(m15.first10YearsMonthly).toBe(198000);
      expect(m15.after10YearsMonthly).toBe(330000);
      expect(m15.totalContributed).toBe(120 * 198000 + 60 * 330000); // 43.560.000đ
      expect(m20.totalContributed).toBe(120 * 198000 + 120 * 330000); // 63.360.000đ
      expect(m25.totalContributed).toBe(120 * 198000 + 180 * 330000); // 83.160.000đ
    });

    it('Nhóm Người dân tộc thiểu số (30% hỗ trợ): 15 năm, 20 năm, 25 năm', () => {
      // Hỗ trợ = 330.000 * 30% = 99.000đ/th. Thực nộp 10 năm đầu = 231.000đ/th. Sau 10 năm = 330.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 15, povertyStandard: POVERTY_1500K, nsnnRate: 30 });
      const m20 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 20, povertyStandard: POVERTY_1500K, nsnnRate: 30 });
      const m25 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 25, povertyStandard: POVERTY_1500K, nsnnRate: 30 });

      expect(m15.first10YearsMonthly).toBe(231000);
      expect(m15.after10YearsMonthly).toBe(330000);
      expect(m15.totalContributed).toBe(120 * 231000 + 60 * 330000); // 47.520.000đ
      expect(m20.totalContributed).toBe(120 * 231000 + 120 * 330000); // 67.320.000đ
      expect(m25.totalContributed).toBe(120 * 231000 + 180 * 330000); // 87.120.000đ
    });

    it('Nhóm Đối tượng khác (20% hỗ trợ phổ thông): 15 năm, 20 năm, 25 năm', () => {
      // Hỗ trợ = 330.000 * 20% = 66.000đ/th. Thực nộp 10 năm đầu = 264.000đ/th. Sau 10 năm = 330.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 15, povertyStandard: POVERTY_1500K, nsnnRate: 20 });
      const m20 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 20, povertyStandard: POVERTY_1500K, nsnnRate: 20 });
      const m25 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 25, povertyStandard: POVERTY_1500K, nsnnRate: 20 });

      expect(m15.first10YearsMonthly).toBe(264000);
      expect(m15.after10YearsMonthly).toBe(330000);
      expect(m15.totalContributed).toBe(120 * 264000 + 60 * 330000); // 51.480.000đ
      expect(m20.totalContributed).toBe(120 * 264000 + 120 * 330000); // 71.280.000đ
      expect(m25.totalContributed).toBe(120 * 264000 + 180 * 330000); // 91.080.000đ
    });

    it('Nhóm Đối tượng khác (10% hỗ trợ theo diện mở rộng): 15 năm, 20 năm, 25 năm', () => {
      // Hỗ trợ = 330.000 * 10% = 33.000đ/th. Thực nộp 10 năm đầu = 297.000đ/th. Sau 10 năm = 330.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 15, povertyStandard: POVERTY_1500K, nsnnRate: 10 });
      const m20 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 20, povertyStandard: POVERTY_1500K, nsnnRate: 10 });
      const m25 = calculateVoluntaryBHXHRoadmap({ income: POVERTY_1500K, years: 25, povertyStandard: POVERTY_1500K, nsnnRate: 10 });

      expect(m15.first10YearsMonthly).toBe(297000);
      expect(m15.after10YearsMonthly).toBe(330000);
      expect(m15.totalContributed).toBe(120 * 297000 + 60 * 330000); // 55.440.000đ
      expect(m20.totalContributed).toBe(120 * 297000 + 120 * 330000); // 75.240.000đ
      expect(m25.totalContributed).toBe(120 * 297000 + 180 * 330000); // 95.040.000đ
    });
  });

  describe('3. Kiểm thử với mức thu nhập đóng cao hơn chuẩn nghèo và hỗ trợ từ địa phương', () => {
    it('Thu nhập 3.000.000đ, chuẩn nghèo 1.500.000đ, hỗ trợ 20%', () => {
      // Gốc = 3.000.000 * 22% = 660.000đ/th.
      // Hỗ trợ = 1.500.000 * 22% * 20% = 66.000đ/th.
      // 10 năm đầu: 660.000 - 66.000 = 594.000đ/th.
      // Sau 10 năm: 660.000đ/th.
      const m15 = calculateVoluntaryBHXHRoadmap({
        income: 3000000,
        years: 15,
        povertyStandard: POVERTY_1500K,
        nsnnRate: 20
      });

      expect(m15.grossMonthly).toBe(660000);
      expect(m15.monthlySupport).toBe(66000);
      expect(m15.first10YearsMonthly).toBe(594000);
      expect(m15.after10YearsMonthly).toBe(660000);
      expect(m15.totalContributed).toBe(120 * 594000 + 60 * 660000); // 110.880.000đ
    });

    it('Kèm theo chính sách hỗ trợ bổ sung từ Địa phương (dpRate: 10%)', () => {
      // NSNN 20% + ĐP 10% = 30% tổng hỗ trợ trên chuẩn nghèo
      const res = calculateVoluntaryBHXHRoadmap({
        income: POVERTY_1500K,
        years: 20,
        povertyStandard: POVERTY_1500K,
        nsnnRate: 20,
        dpRate: 10
      });

      expect(res.totalSupportRate).toBe(30);
      expect(res.monthlySupport).toBe(99000);
      expect(res.first10YearsMonthly).toBe(231000);
      expect(res.after10YearsMonthly).toBe(330000);
      expect(res.totalContributed).toBe(120 * 231000 + 120 * 330000); // 67.320.000đ
    });
  });

  describe('4. Kiểm thử tính năng động khi chuẩn nghèo thay đổi theo thời kỳ', () => {
    it('Chuẩn nghèo mới điều chỉnh lên 2.000.000đ: tự động tính lại toàn bộ lộ trình', () => {
      const NEW_POVERTY = 2000000;
      const res = calculateVoluntaryBHXHRoadmap({
        income: NEW_POVERTY,
        years: 15,
        povertyStandard: NEW_POVERTY,
        nsnnRate: 20
      });

      // Gốc = 2.000.000 * 22% = 440.000đ/th
      // Hỗ trợ = 2.000.000 * 22% * 20% = 88.000đ/th
      // 10 năm đầu: 440.000 - 88.000 = 352.000đ/th
      // Sau 10 năm: 440.000đ/th
      expect(res.grossMonthly).toBe(440000);
      expect(res.monthlySupport).toBe(88000);
      expect(res.first10YearsMonthly).toBe(352000);
      expect(res.after10YearsMonthly).toBe(440000);
      expect(res.totalContributed).toBe(120 * 352000 + 60 * 440000); // 68.640.000đ
    });
  });

  describe('5. Kiểm thử áp dụng trần hỗ trợ 10 năm (120 tháng) trong calculateBHXH & getCustomerPreviousBHXHMonths', () => {
    it('Trường hợp khách hàng đã đóng đủ 10 năm (previousMonths = 120): Năm thứ 11 không còn hỗ trợ NSNN, đóng 100% gốc', () => {
      // Khách hàng TÒNG THỊ TUYẾT: Đã đóng 10 năm (120 tháng), nay đóng tiếp 12 tháng năm thứ 11
      const resYear11 = calculateBHXH(
        1500000, // thu nhập chuẩn nghèo
        20,      // tỷ lệ hỗ trợ khác 20%
        0,       // ĐP 0%
        '12',    // 12 tháng
        1,
        '01/2028',
        undefined,
        1500000,
        undefined,
        120      // previousMonths = 120
      );

      // Mức gốc 1.500.000 * 22% * 12 = 3.960.000đ
      expect(resYear11.basePremium).toBe(3960000);
      // Hỗ trợ NSNN = 0 do đã vượt trần 120 tháng
      expect(resYear11.nnSupportAmount).toBe(0);
      expect(resYear11.dpSupportAmount).toBe(0);
      // Số tiền cá nhân thực nộp = 100% gốc = 3.960.000đ (KHÔNG PHẢI 3.168.000đ)
      expect(resYear11.amount).toBe(3960000);
      expect(resYear11.supportedMonthsCount).toBe(0);
      expect(resYear11.unsupportedMonthsCount).toBe(12);
      expect(resYear11.totalAccumulatedMonths).toBe(132);
    });

    it('Trường hợp giai đoạn chuyển tiếp (previousMonths = 118, đóng 6 tháng): 2 tháng đầu có hỗ trợ, 4 tháng sau đóng 100% gốc', () => {
      const resTransition = calculateBHXH(
        1500000,
        20, // 66.000đ/tháng hỗ trợ
        0,
        '6', // 6 tháng
        1,
        '01/2027',
        undefined,
        1500000,
        undefined,
        118 // previousMonths = 118
      );

      // Gốc 6 tháng = 330.000 * 6 = 1.980.000đ
      expect(resTransition.basePremium).toBe(1980000);
      // Chỉ 2 tháng đầu (tháng 119 và 120) được hỗ trợ = 66.000 * 2 = 132.000đ
      expect(resTransition.nnSupportAmount).toBe(132000);
      // Thực nộp = 2 tháng có hỗ trợ (2 * 264.000) + 4 tháng đóng 100% (4 * 330.000) = 528.000 + 1.320.000 = 1.848.000đ
      expect(resTransition.amount).toBe(1848000);
      expect(resTransition.supportedMonthsCount).toBe(2);
      expect(resTransition.unsupportedMonthsCount).toBe(4);
      expect(resTransition.totalAccumulatedMonths).toBe(124);
    });

    it('getCustomerPreviousBHXHMonths tính chính xác số tháng tích lũy từ lịch sử khách hàng', () => {
      const mockRecords = [
        { id: 1, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2018-01', toMonth: '2018-12', paymentStatus: 'Đã thu tiền' },
        { id: 2, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2019-01', toMonth: '2019-12', paymentStatus: 'Đã thu tiền' },
        { id: 3, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2020-01', toMonth: '2020-12', paymentStatus: 'Đã thu tiền' },
        { id: 4, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2021-01', toMonth: '2021-12', paymentStatus: 'Đã thu tiền' },
        { id: 5, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2022-01', toMonth: '2022-12', paymentStatus: 'Đã thu tiền' },
        { id: 6, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2023-01', toMonth: '2023-12', paymentStatus: 'Đã thu tiền' },
        { id: 7, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2024-01', toMonth: '2024-12', paymentStatus: 'Đã thu tiền' },
        { id: 8, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2025-01', toMonth: '2025-12', paymentStatus: 'Đã thu tiền' },
        { id: 9, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2026-01', toMonth: '2026-12', paymentStatus: 'Đã thu tiền' },
        { id: 10, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2027-01', toMonth: '2027-12', paymentStatus: 'Đã thu tiền' },
        // Bản ghi của người khác
        { id: 11, type: 'BHXH', cccd: '999999999999', bhxh: '9999999999', months: 12, fromMonth: '2020-01', toMonth: '2020-12', paymentStatus: 'Đã thu tiền' },
        // Bản ghi đã hủy
        { id: 12, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2028-01', toMonth: '2028-12', paymentStatus: 'Đã hủy' },
        // Bản ghi BHYT
        { id: 13, type: 'BHYT', cccd: '014301001065', bhxh: '1421100097', months: 12, fromMonth: '2020-01', toMonth: '2020-12', paymentStatus: 'Đã thu tiền' }
      ];

      // Tìm theo CCCD
      const totalByCccd = getCustomerPreviousBHXHMonths(mockRecords, { cccd: '014301001065' });
      expect(totalByCccd).toBe(120);

      // Tìm theo Mã BHXH
      const totalByBhxh = getCustomerPreviousBHXHMonths(mockRecords, { bhxh: '1421100097' });
      expect(totalByBhxh).toBe(120);

      // Có currentFromMonth = '01/2025' -> chỉ tính các kỳ trước 2025 (2018 - 2024 = 7 năm = 84 tháng)
      const totalBefore2025 = getCustomerPreviousBHXHMonths(mockRecords, '014301001065', null, '01/2025');
      expect(totalBefore2025).toBe(84);

      // Có excludeRecordId = 10 -> loại trừ kỳ thứ 10 (còn 108 tháng)
      const totalExclude10 = getCustomerPreviousBHXHMonths(mockRecords, '014301001065', 10);
      expect(totalExclude10).toBe(108);
    });
  });
});
