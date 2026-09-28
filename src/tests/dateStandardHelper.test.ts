import { describe, it, expect } from 'vitest';
import {
  parseMonthAndYear,
  calculateMonthsBetween,
  calculateToMonthVN,
  toVnMonth,
  toIsoMonth,
  normalizePeriod,
  formatDateVN,
  parseDateISO,
  formatMonthVN,
  parseMonthISO,
  formatMonthInput,
  formatDateInput,
  toUIDate,
  toDbDate,
  toUIMonth,
  toDbMonth,
  calculateNextRenewalMonth
} from '../utils/dateStandardHelper';
import { calculateMonthsFromPeriods } from '../utils/calculations';

describe('dateStandardHelper: Unified Date & Month Management Suite', () => {

  describe('1. parseMonthAndYear', () => {
    it('phân tích chính xác định dạng MM/YYYY (chuẩn UI form Đăng ký)', () => {
      const res = parseMonthAndYear('05/2016');
      expect(res).toEqual({ month: 5, year: 2016 });
    });

    it('phân tích chính xác định dạng YYYY-MM (chuẩn DB ISO)', () => {
      const res = parseMonthAndYear('2024-09');
      expect(res).toEqual({ month: 9, year: 2024 });
    });

    it('hỗ trợ fallback sang ngày Date nếu monthStr rỗng', () => {
      const res = parseMonthAndYear('', '2026-11-20');
      expect(res).toEqual({ month: 11, year: 2026 });
    });
  });

  describe('2. calculateMonthsBetween & calculateToMonthVN', () => {
    it('tính số tháng chính xác cho các khoảng thời gian tham gia', () => {
      // 5/2016 đến 7/2017 = 15 tháng
      expect(calculateMonthsBetween('05/2016', '07/2017')).toBe(15);
      // 11/2017 đến 1/2019 = 15 tháng
      expect(calculateMonthsBetween('11/2017', '01/2019')).toBe(15);
      // 3/2019 đến 2/2021 = 24 tháng
      expect(calculateMonthsBetween('03/2019', '02/2021')).toBe(24);
      // 3/2021 đến 5/2026 = 63 tháng
      expect(calculateMonthsBetween('03/2021', '05/2026')).toBe(63);
      // Cùng 1 tháng (09/2026 đến 09/2026) = 1 tháng
      expect(calculateMonthsBetween('09/2026', '09/2026')).toBe(1);
    });

    it('tính chính xác toMonth từ fromMonth và số tháng', () => {
      expect(calculateToMonthVN('05/2016', 15)).toBe('07/2017');
      expect(calculateToMonthVN('09/2026', 1)).toBe('09/2026');
      expect(calculateToMonthVN('01/2024', 12)).toBe('12/2024');
    });
  });

  describe('3. Chuyển đổi Ngày sinh (DOB) & Tháng', () => {
    it('formatDateVN & parseDateISO chuyển đổi 2 chiều chính xác', () => {
      expect(parseDateISO('15/08/1990')).toBe('1990-08-15');
      expect(formatDateVN('1990-08-15')).toBe('15/08/1990');
    });

    it('formatMonthVN & parseMonthISO chuyển đổi 2 chiều chính xác', () => {
      expect(parseMonthISO('09/2026')).toBe('2026-09');
      expect(formatMonthVN('2026-09')).toBe('09/2026');
      expect(toVnMonth('2026-09')).toBe('09/2026');
      expect(toIsoMonth('09/2026')).toBe('2026-09');
    });

    it('formatMonthInput & formatDateInput tự động format mask khi nhập liệu', () => {
      expect(formatMonthInput('092026')).toBe('09/2026');
      expect(formatDateInput('15081990')).toBe('15/08/1990');
    });
  });

  describe('4. normalizePeriod: Tương thích 2 chiều hoàn hảo', () => {
    it('chuẩn hóa từ cấu trúc cũ { sm, sy, em, ey } sang đầy đủ fromMonth, toMonth, months', () => {
      const legacyPeriod = {
        id: 1,
        type: 'batbuoc' as const,
        sm: 5,
        sy: 2016,
        em: 7,
        ey: 2017,
        salary: '5.000.000'
      };

      const norm = normalizePeriod(legacyPeriod);
      expect(norm.fromMonth).toBe('05/2016');
      expect(norm.toMonth).toBe('07/2017');
      expect(norm.months).toBe(15);
      expect(norm.sm).toBe(5);
      expect(norm.sy).toBe(2016);
      expect(norm.em).toBe(7);
      expect(norm.ey).toBe(2017);
    });

    it('chuẩn hóa từ cấu trúc mới { fromMonth, toMonth } sang đầy đủ sm, sy, em, ey, months', () => {
      const modernPeriod = {
        id: 2,
        type: 'tunguyen' as const,
        fromMonth: '03/2019',
        toMonth: '02/2021',
        salary: '1.500.000'
      };

      const norm = normalizePeriod(modernPeriod);
      expect(norm.sm).toBe(3);
      expect(norm.sy).toBe(2019);
      expect(norm.em).toBe(2);
      expect(norm.ey).toBe(2021);
      expect(norm.months).toBe(24);
      expect(norm.fromMonth).toBe('03/2019');
      expect(norm.toMonth).toBe('02/2021');
    });
  });

  describe('5. calculateMonthsFromPeriods tích hợp', () => {
    it('tính toán chuẩn xác khi mảng gồm cả giai đoạn cũ và giai đoạn mới', () => {
      const mixedPeriods = [
        // Giai đoạn định dạng cũ
        { type: 'batbuoc', sm: 1, sy: 2020, em: 12, ey: 2020 }, // 12 tháng bắt buộc
        // Giai đoạn định dạng mới
        { type: 'tunguyen', fromMonth: '01/2021', toMonth: '12/2022' } // 24 tháng tự nguyện
      ];

      const res = calculateMonthsFromPeriods(mixedPeriods);
      expect(res.compulsoryMonths).toBe(12);
      expect(res.voluntaryMonths).toBe(24);
      expect(res.totalMonths).toBe(36);
    });
  });

  describe('6. toUIDate, toDbDate, toUIMonth, toDbMonth & calculateNextRenewalMonth', () => {
    it('toUIDate và toDbDate chuyển đổi ngày 2 chiều chuẩn xác', () => {
      expect(toUIDate('1995-10-25')).toBe('25/10/1995');
      expect(toUIDate('25/10/1995')).toBe('25/10/1995');
      expect(toDbDate('25/10/1995')).toBe('1995-10-25');
      expect(toDbDate('1995-10-25')).toBe('1995-10-25');
    });

    it('toUIMonth và toDbMonth xử lý cả 2 định dạng MM/YYYY và YYYY-MM mà không vỡ', () => {
      expect(toUIMonth('2026-09')).toBe('09/2026');
      expect(toUIMonth('09/2026')).toBe('09/2026');
      expect(toDbMonth('09/2026')).toBe('2026-09');
      expect(toDbMonth('2026-09')).toBe('2026-09');
    });

    it('calculateNextRenewalMonth tính chính xác tháng kế tiếp kể cả khi dữ liệu là YYYY-MM hoặc MM/YYYY', () => {
      // Từ YYYY-MM
      expect(calculateNextRenewalMonth('2026-09')).toBe('10/2026');
      // Từ MM/YYYY
      expect(calculateNextRenewalMonth('09/2026')).toBe('10/2026');
      // Chuyển giao năm từ tháng 12 sang tháng 1 năm sau
      expect(calculateNextRenewalMonth('2025-12')).toBe('01/2026');
      expect(calculateNextRenewalMonth('12/2025')).toBe('01/2026');
    });

    it('calculateNextRenewalMonth fallback sang nextPayment khi toMonth rỗng', () => {
      expect(calculateNextRenewalMonth('', '2026-11-15')).toBe('11/2026');
      expect(calculateNextRenewalMonth(null, '2027-01-20')).toBe('01/2027');
    });
  });
});
