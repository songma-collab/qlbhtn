import { describe, it, expect } from 'vitest';
import {
  formatDateVN,
  formatMonthVN,
  parseToIsoDate,
  parseToIsoMonthDate,
  addMonthsToPeriod,
  calculateToMonthVN,
  calculateMonthsBetween,
  calculateNextRenewalMonth,
  formatDateInputMask,
  formatMonthInputMask,
  isLeapYear,
  getDaysInMonth,
  parseVNDate,
  parseVNMonth,
  parseMonthAndYear,
  normalizePeriod,
  toUIDate,
  toDbDate,
  toUIMonth,
  toDbMonth,
  vnDateSchema,
  vnDobSchema,
  vnMonthSchema,
  bhxhFormDateSchema,
  renewalFormDateSchema,
  participationPeriodDateSchema
} from '../utils/dateUtils';

describe('dateUtils - Comprehensive Three-Tier Edge Cases & Timezone Safety Test Suite', () => {

  describe('1. Pure Functions: formatDateVN (Safe against Timezone Shifts)', () => {
    it('chuyển đổi ISO Date YYYY-MM-DD sang DD/MM/YYYY không bị trừ 1 ngày do lệch múi giờ', () => {
      // Các mốc ngày nhạy cảm múi giờ UTC/GMT+7
      expect(formatDateVN('1990-08-15')).toBe('15/08/1990');
      expect(formatDateVN('2000-01-01')).toBe('01/01/2000');
      expect(formatDateVN('2026-12-31')).toBe('31/12/2026');
      expect(formatDateVN('2024-02-29')).toBe('29/02/2024'); // Năm nhuận
    });

    it('xử lý chuỗi ISO Timestamp có T00:00:00Z an toàn', () => {
      expect(formatDateVN('1990-08-15T00:00:00Z')).toBe('15/08/1990');
      expect(formatDateVN('2026-09-24T23:59:59.999Z')).toBe('24/09/2026');
    });

    it('giữ nguyên định dạng chuẩn nếu đã là DD/MM/YYYY', () => {
      expect(formatDateVN('15/08/1990')).toBe('15/08/1990');
      expect(formatDateVN('01/01/2026')).toBe('01/01/2026');
    });

    it('chuẩn hóa ngày tháng 1 chữ số dạng D/M/YYYY thành DD/MM/YYYY', () => {
      expect(formatDateVN('5/8/1990')).toBe('05/08/1990');
      expect(formatDateVN('1/1/2026')).toBe('01/01/2026');
    });

    it('xử lý an toàn khi đầu vào null, undefined, chuỗi rỗng hoặc rác', () => {
      expect(formatDateVN('')).toBe('');
      expect(formatDateVN(null as any)).toBe('');
      expect(formatDateVN(undefined as any)).toBe('');
      expect(formatDateVN('invalid-date-string')).toBe('');
      expect(formatDateVN('   ')).toBe('');
    });
  });

  describe('2. Pure Functions: formatMonthVN', () => {
    it('chuyển đổi YYYY-MM sang MM/YYYY chuẩn UI', () => {
      expect(formatMonthVN('2026-09')).toBe('09/2026');
      expect(formatMonthVN('2024-01')).toBe('01/2024');
      expect(formatMonthVN('2026-12')).toBe('12/2026');
    });

    it('chuyển đổi YYYY-MM-DD sang MM/YYYY', () => {
      expect(formatMonthVN('2026-09-01')).toBe('09/2026');
      expect(formatMonthVN('2024-02-29')).toBe('02/2024');
    });

    it('giữ nguyên nếu đã là MM/YYYY', () => {
      expect(formatMonthVN('09/2026')).toBe('09/2026');
      expect(formatMonthVN('9/2026')).toBe('09/2026');
    });

    it('xử lý an toàn với null, undefined hoặc rỗng', () => {
      expect(formatMonthVN('')).toBe('');
      expect(formatMonthVN(null as any)).toBe('');
      expect(formatMonthVN(undefined as any)).toBe('');
    });
  });

  describe('3. Pure Functions: parseToIsoDate', () => {
    it('chuyển đổi DD/MM/YYYY sang YYYY-MM-DD cho CSDL', () => {
      expect(parseToIsoDate('15/08/1990')).toBe('1990-08-15');
      expect(parseToIsoDate('01/01/2026')).toBe('2026-01-01');
      expect(parseToIsoDate('29/02/2024')).toBe('2024-02-29');
    });

    it('tự động sửa lỗi nếu nhập D/M/YYYY', () => {
      expect(parseToIsoDate('5/8/1990')).toBe('1990-08-05');
      expect(parseToIsoDate('1/9/2026')).toBe('2026-09-01');
    });

    it('giữ nguyên nếu đã là YYYY-MM-DD', () => {
      expect(parseToIsoDate('1990-08-15')).toBe('1990-08-15');
    });

    it('xử lý chuỗi rỗng / null', () => {
      expect(parseToIsoDate('')).toBe('');
      expect(parseToIsoDate(null as any)).toBe('');
      expect(parseToIsoDate(undefined as any)).toBe('');
    });
  });

  describe('4. Pure Functions: parseToIsoMonthDate', () => {
    it('chuyển đổi MM/YYYY sang ngày mùng 1 đầu tháng YYYY-MM-01', () => {
      expect(parseToIsoMonthDate('09/2026')).toBe('2026-09-01');
      expect(parseToIsoMonthDate('12/2024')).toBe('2024-12-01');
      expect(parseToIsoMonthDate('01/2025')).toBe('2025-01-01');
    });

    it('hỗ trợ chuyển đổi từ YYYY-MM sang YYYY-MM-01', () => {
      expect(parseToIsoMonthDate('2026-09')).toBe('2026-09-01');
    });

    it('xử lý đầu vào không hợp lệ', () => {
      expect(parseToIsoMonthDate('')).toBe('');
      expect(parseToIsoMonthDate(null as any)).toBe('');
      expect(parseToIsoMonthDate('13/2026')).toBe(''); // Tháng 13 không hợp lệ
      expect(parseToIsoMonthDate('00/2026')).toBe(''); // Tháng 00 không hợp lệ
    });
  });

  describe('5. addMonthsToPeriod & Rollover Chuyển Năm', () => {
    it('cộng tháng bình thường trong cùng một năm', () => {
      expect(addMonthsToPeriod('01/2026', 3)).toBe('04/2026'); // 1 + 3 = 4
      expect(addMonthsToPeriod('05/2026', 6)).toBe('11/2026'); // 5 + 6 = 11
      expect(addMonthsToPeriod('01/2026', 12)).toBe('01/2027'); // 1 + 12 = 13 (01/2027)
    });

    it('xử lý chính xác rollover chuyển giao từ cuối năm sang năm mới theo đúng quy chuẩn', () => {
      // Đúng theo đề bài: từ tháng 11/2026 + 3 tháng = tháng 02/2027
      expect(addMonthsToPeriod('11/2026', 3)).toBe('02/2027');
      // Từ tháng 10/2026 + 6 tháng = tháng 04/2027
      expect(addMonthsToPeriod('10/2026', 6)).toBe('04/2027');
      // Từ 01/2026 + 24 tháng = tháng 01/2028
      expect(addMonthsToPeriod('01/2026', 24)).toBe('01/2028');
    });

    it('calculateToMonthVN tương thích với addMonthsToPeriod', () => {
      expect(calculateToMonthVN('11/2026', 4)).toBe('02/2027');
      expect(calculateToMonthVN('12/2026', 1)).toBe('12/2026');
    });

    it('calculateMonthsBetween tính số tháng chính xác bao gồm cả 2 đầu mút', () => {
      expect(calculateMonthsBetween('11/2026', '01/2027')).toBe(3);
      expect(calculateMonthsBetween('01/2026', '12/2026')).toBe(12);
      expect(calculateMonthsBetween('09/2026', '09/2026')).toBe(1);
      expect(calculateMonthsBetween('12/2026', '11/2026')).toBe(0); // Khoảng ngược
    });

    it('calculateNextRenewalMonth tính kỳ kế tiếp chuẩn xác không bị NaN', () => {
      expect(calculateNextRenewalMonth('12/2026')).toBe('01/2027');
      expect(calculateNextRenewalMonth('09/2026')).toBe('10/2026');
      expect(calculateNextRenewalMonth('2026-12')).toBe('01/2027');
    });
  });

  describe('6. Kiểm thử Năm Nhuận (Leap Year) & Ngày Cuối Tháng', () => {
    it('kiểm tra chính xác năm nhuận', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2100)).toBe(false); // Quy tắc thế kỷ
    });

    it('số ngày trong tháng 2 năm nhuận và năm thường', () => {
      expect(getDaysInMonth(2, 2024)).toBe(29);
      expect(getDaysInMonth(2, 2026)).toBe(28);
      expect(getDaysInMonth(2, 2000)).toBe(29);
      expect(getDaysInMonth(2, 2100)).toBe(28);
    });

    it('kiểm tra ngày sinh 29/02/2024 hợp lệ nhưng 29/02/2026 không hợp lệ', () => {
      expect(vnDobSchema.safeParse('29/02/2024').success).toBe(true);
      expect(vnDobSchema.safeParse('29/02/2026').success).toBe(false);
      expect(vnDobSchema.safeParse('31/04/2026').success).toBe(false); // Tháng 4 chỉ có 30 ngày
      expect(vnDobSchema.safeParse('30/04/2026').success).toBe(true);
    });
  });

  describe('7. Input Mask: Mặt nạ nhập liệu tự động thêm gạch chéo', () => {
    it('formatDateInputMask thêm dấu / khi người dùng gõ ngày tháng', () => {
      expect(formatDateInputMask('15')).toBe('15');
      expect(formatDateInputMask('1508')).toBe('15/08');
      expect(formatDateInputMask('15081990')).toBe('15/08/1990');
      expect(formatDateInputMask('15/08/1990')).toBe('15/08/1990');
    });

    it('formatMonthInputMask thêm dấu / khi người dùng gõ tháng năm', () => {
      expect(formatMonthInputMask('09')).toBe('09');
      expect(formatMonthInputMask('092026')).toBe('09/2026');
      expect(formatMonthInputMask('09/2026')).toBe('09/2026');
    });
  });

  describe('8. Zod Form Validation Schemas', () => {
    it('bhxhFormDateSchema kiểm tra đầy đủ ngày sinh và kỳ tham gia', () => {
      const valid = {
        dob: '15/08/1990',
        fromMonth: '09/2026',
        toMonth: '11/2026'
      };
      expect(bhxhFormDateSchema.safeParse(valid).success).toBe(true);

      const invalidPeriod = {
        dob: '15/08/1990',
        fromMonth: '11/2026',
        toMonth: '09/2026' // Đến tháng nhỏ hơn từ tháng
      };
      expect(bhxhFormDateSchema.safeParse(invalidPeriod).success).toBe(false);
    });

    it('participationPeriodDateSchema kiểm tra giai đoạn tham gia', () => {
      expect(participationPeriodDateSchema.safeParse({
        fromMonth: '01/2020',
        toMonth: '12/2022'
      }).success).toBe(true);

      expect(participationPeriodDateSchema.safeParse({
        fromMonth: '01/2022',
        toMonth: '12/2020'
      }).success).toBe(false);
    });
  });

});
