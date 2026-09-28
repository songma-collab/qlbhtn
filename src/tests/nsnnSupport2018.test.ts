import { describe, it, expect } from 'vitest';
import {
  calculatePeriodSupportedMonths,
  calculateCustomerParticipationSupport,
  NSNN_SUPPORT_START_YEAR,
  NSNN_SUPPORT_MAX_MONTHS
} from '../utils/customerParticipationHelper';
import {
  calculateMonthsFromPeriods,
  getCustomerPreviousBHXHMonths,
  calculateBHXH
} from '../utils/calculations';

describe('Chính sách NSNN hỗ trợ đóng BHXH tự nguyện tính từ 01/01/2018 (NĐ 134/2015 & Luật BHXH 2024)', () => {
  it('đảm bảo các mốc pháp lý cấu hình đúng chuẩn', () => {
    expect(NSNN_SUPPORT_START_YEAR).toBe(2018);
    expect(NSNN_SUPPORT_MAX_MONTHS).toBe(120);
  });

  describe('1. calculatePeriodSupportedMonths: Kiểm tra từng giai đoạn đóng', () => {
    it('giai đoạn kết thúc hoàn toàn trước 01/2018 (05/2016 -> 07/2017) không tính vào hỗ trợ NSNN', () => {
      const p = {
        type: 'tunguyen',
        sm: 5,
        sy: 2016,
        em: 7,
        ey: 2017,
        months: 15
      };
      const res = calculatePeriodSupportedMonths(p);
      expect(res.totalMonths).toBe(15);
      expect(res.supportedMonths).toBe(0);
      expect(res.unsupportedBefore2018Months).toBe(15);
    });

    it('giai đoạn giao nhau qua mốc 01/2018 (11/2017 -> 01/2019) tách chính xác 2 tháng trước 2018 và 13 tháng sau 2018', () => {
      const p = {
        type: 'tunguyen',
        sm: 11,
        sy: 2017,
        em: 1,
        ey: 2019,
        months: 15
      };
      const res = calculatePeriodSupportedMonths(p);
      expect(res.totalMonths).toBe(15);
      expect(res.unsupportedBefore2018Months).toBe(2); // Tháng 11/2017 và 12/2017
      expect(res.supportedMonths).toBe(13); // Từ 01/2018 đến 01/2019
    });

    it('giai đoạn hoàn toàn sau 01/2018 (03/2019 -> 02/2021) tính đủ 24 tháng hỗ trợ', () => {
      const p = {
        type: 'tunguyen',
        sm: 3,
        sy: 2019,
        em: 2,
        ey: 2021,
        months: 24
      };
      const res = calculatePeriodSupportedMonths(p);
      expect(res.totalMonths).toBe(24);
      expect(res.supportedMonths).toBe(24);
      expect(res.unsupportedBefore2018Months).toBe(0);
    });

    it('giai đoạn BHXH bắt buộc không bao giờ tính vào thời gian hỗ trợ của BHXH tự nguyện', () => {
      const p = {
        type: 'batbuoc',
        sm: 1,
        sy: 2019,
        em: 12,
        ey: 2022,
        months: 48
      };
      const res = calculatePeriodSupportedMonths(p);
      expect(res.supportedMonths).toBe(0);
      expect(res.unsupportedBefore2018Months).toBe(0);
    });
  });

  describe('2. Kiểm chứng thực tế trường hợp khách hàng Nguyễn Thị Ngọc', () => {
    // 4 giai đoạn tham gia trước đây của khách hàng Nguyễn Thị Ngọc:
    const nguyenThiNgocPriorPeriods = [
      { id: 1, type: 'tunguyen', sm: 5, sy: 2016, em: 7, ey: 2017, fromMonth: '05/2016', toMonth: '07/2017', months: 15 },
      { id: 2, type: 'tunguyen', sm: 11, sy: 2017, em: 1, ey: 2019, fromMonth: '11/2017', toMonth: '01/2019', months: 15 },
      { id: 3, type: 'tunguyen', sm: 3, sy: 2019, em: 2, ey: 2021, fromMonth: '03/2019', toMonth: '02/2021', months: 24 },
      { id: 4, type: 'tunguyen', sm: 3, sy: 2021, em: 5, ey: 2026, fromMonth: '03/2021', toMonth: '05/2026', months: 63 }
    ];

    // 1 giai đoạn phát sinh tại đại lý: 3 tháng (2026)
    const agencyPeriods = [
      { id: 101, type: 'tunguyen', sm: 1, sy: 2026, em: 3, ey: 2026, fromMonth: '01/2026', toMonth: '03/2026', months: 3 }
    ];

    it('calculateCustomerParticipationSupport tính đúng 103 tháng đã hỗ trợ và còn 17 tháng tiếp tục được hỗ trợ', () => {
      const stats = calculateCustomerParticipationSupport(nguyenThiNgocPriorPeriods, agencyPeriods);

      // Tổng tích lũy tự nguyện = 15 + 15 + 24 + 63 + 3 = 120 tháng
      expect(stats.totalVoluntary).toBe(120);

      // Số tháng đóng trước 01/2018 chưa có hỗ trợ = 15 (gđ 1) + 2 (gđ 2) = 17 tháng
      expect(stats.voluntaryUnsupportedBefore2018Months).toBe(17);

      // Số tháng đã được NSNN hỗ trợ = 0 + 13 + 24 + 63 + 3 = 103 tháng
      expect(stats.voluntarySupportedMonths).toBe(103);
      expect(stats.supportedMonthsCapped).toBe(103);

      // Số tháng còn lại được hỗ trợ = 120 - 103 = 17 tháng
      expect(stats.remainingSupportMonths).toBe(17);

      // Khách hàng KHÔNG bị đánh dấu hết hỗ trợ
      expect(stats.isSupportExpired).toBe(false);
    });

    it('calculateMonthsFromPeriods trích xuất đúng voluntarySupportedMonths = 100 cho 4 kỳ ngoài', () => {
      const stats = calculateMonthsFromPeriods(nguyenThiNgocPriorPeriods);
      expect(stats.voluntaryMonths).toBe(117);
      expect(stats.voluntaryUnsupportedBefore2018Months).toBe(17);
      expect(stats.voluntarySupportedMonths).toBe(100);
    });

    it('getCustomerPreviousBHXHMonths tính đúng 103 tháng hỗ trợ và kỳ đóng tiếp theo vẫn được hưởng hỗ trợ NSNN', () => {
      const mockRecords = [
        { id: 999, type: 'BHXH', cccd: '014184005160', bhxh: '1416001652', months: 3, fromMonth: '2026-01', toMonth: '2026-03', paymentStatus: 'Đã thu tiền' }
      ];

      const mockCustomer = {
        id: 'cust-ngoc',
        name: 'NGUYỄN THỊ NGỌC',
        cccd: '014184005160',
        bhxh: '1416001652',
        prior_voluntary_months: 117,
        prior_periods: nguyenThiNgocPriorPeriods
      };

      const prevSupportedMonths = getCustomerPreviousBHXHMonths(
        mockRecords,
        { cccd: '014184005160' },
        null,
        '04/2026',
        [mockCustomer]
      );

      // Đúng 103 tháng đã hỗ trợ (100 tháng nơi khác sau 2018 + 3 tháng tại đại lý)
      expect(prevSupportedMonths).toBe(103);

      // Khi đăng ký kỳ tiếp theo (tháng thứ 104), calculateBHXH vẫn áp dụng hỗ trợ NSNN đầy đủ
      const calcResult = calculateBHXH(
        1500000,
        20, // 20% hỗ trợ
        0,
        '1',
        1,
        '04/2026',
        0.0031,
        1500000,
        undefined,
        prevSupportedMonths
      );

      expect(calcResult.supportedMonthsCount).toBe(1);
      expect(calcResult.unsupportedMonthsCount).toBe(0);
      expect(calcResult.nnSupportAmount).toBeGreaterThan(0);
    });
  });
});
