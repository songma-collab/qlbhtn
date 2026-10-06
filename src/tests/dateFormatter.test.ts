import { describe, it, expect } from 'vitest';
import {
  formatDateToVN,
  formatDateToISO,
  formatMonthToVN,
  formatMonthToISO,
  formatDateTimeVN,
  formatDateInputMask,
  formatMonthInputMask,
  parseVNDate,
  parseVNMonth,
  isValidVNDate,
  isValidISODate,
  isValidVNMonth,
  isValidISOMonth,
  isLeapYear,
  getDaysInMonth,
  vnDateSchema,
  vnDobSchema,
  optionalVnDobSchema,
  vnMonthSchema,
  bhxhFormDateSchema,
  bhytFormDateSchema,
  renewalFormDateSchema,
  participationPeriodDateSchema,
  recordDatesValidationSchema,
  validateDOBInput,
  validateMonthInput
} from '../utils/dateFormatter';

describe('Date Formatter & Zod Validation Suite', () => {
  describe('1. Leap Year & Calendar Days Calculations', () => {
    it('nhận diện chính xác năm nhuận và năm thường', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
      expect(isLeapYear(2100)).toBe(false); // 2100 chia hết cho 100 nhưng không chia hết cho 400
      expect(isLeapYear(1900)).toBe(false);
    });

    it('tính chính xác số ngày trong tháng', () => {
      expect(getDaysInMonth(2, 2024)).toBe(29); // Tháng 2 năm nhuận
      expect(getDaysInMonth(2, 2026)).toBe(28); // Tháng 2 năm thường
      expect(getDaysInMonth(4, 2026)).toBe(30); // Tháng 4 có 30 ngày
      expect(getDaysInMonth(12, 2026)).toBe(31); // Tháng 12 có 31 ngày
    });
  });

  describe('2. Date & Month Format Conversions (ISO <-> VN)', () => {
    it('formatDateToVN chuyển đổi chuẩn xác các loại đầu vào sang DD/MM/YYYY', () => {
      expect(formatDateToVN('2026-09-24')).toBe('24/09/2026');
      expect(formatDateToVN('2026-09-24T08:30:00.000Z')).toBe('24/09/2026');
      expect(formatDateToVN('24/09/2026')).toBe('24/09/2026');
      expect(formatDateToVN('5/8/1990')).toBe('05/08/1990');
      expect(formatDateToVN(new Date(2026, 8, 24))).toBe('24/09/2026'); // Month is 0-indexed: 8 is Sept
      expect(formatDateToVN('')).toBe('');
      expect(formatDateToVN(null)).toBe('');
      expect(formatDateToVN(undefined)).toBe('');
    });

    it('formatDateToISO chuyển đổi chuẩn xác sang YYYY-MM-DD cho CSDL', () => {
      expect(formatDateToISO('24/09/2026')).toBe('2026-09-24');
      expect(formatDateToISO('05/08/1990')).toBe('1990-08-05');
      expect(formatDateToISO('5/8/1990')).toBe('1990-08-05');
      expect(formatDateToISO('2026-09-24')).toBe('2026-09-24');
      expect(formatDateToISO('2026-09-24T12:00:00Z')).toBe('2026-09-24');
      expect(formatDateToISO('')).toBe('');
      expect(formatDateToISO(null)).toBe('');
    });

    it('formatMonthToVN và formatMonthToISO chuyển đổi qua lại giữa MM/YYYY và YYYY-MM', () => {
      expect(formatMonthToVN('2026-09')).toBe('09/2026');
      expect(formatMonthToVN('09/2026')).toBe('09/2026');
      expect(formatMonthToVN('2026-09-24')).toBe('09/2026');

      expect(formatMonthToISO('09/2026')).toBe('2026-09');
      expect(formatMonthToISO('9/2026')).toBe('2026-09');
      expect(formatMonthToISO('2026-09')).toBe('2026-09');
    });

    it('formatDateTimeVN hiển thị chuẩn DD/MM/YYYY HH:mm', () => {
      const d = new Date(2026, 8, 24, 14, 30, 45);
      expect(formatDateTimeVN(d)).toBe('24/09/2026 14:30');
      expect(formatDateTimeVN(d, true)).toBe('24/09/2026 14:30:45');
    });
  });

  describe('3. Form Input Masks', () => {
    it('formatDateInputMask tự động tạo mask DD/MM/YYYY khi gõ phím', () => {
      expect(formatDateInputMask('24')).toBe('24');
      expect(formatDateInputMask('2409')).toBe('24/09');
      expect(formatDateInputMask('24092026')).toBe('24/09/2026');
      expect(formatDateInputMask('24/09/2026abc')).toBe('24/09/2026');
    });

    it('formatMonthInputMask tự động tạo mask MM/YYYY khi gõ phím', () => {
      expect(formatMonthInputMask('09')).toBe('09');
      expect(formatMonthInputMask('092026')).toBe('09/2026');
      expect(formatMonthInputMask('09/2026xyz')).toBe('09/2026');
    });
  });

  describe('4. Parsers & Calendar Validation', () => {
    it('parseVNDate phát hiện chính xác ngày hợp lệ và bất hợp lệ theo lịch', () => {
      expect(parseVNDate('29/02/2024')).not.toBeNull(); // Năm nhuận: hợp lệ
      expect(parseVNDate('29/02/2025')).toBeNull(); // Năm thường: không có ngày 29/02!
      expect(parseVNDate('31/04/2026')).toBeNull(); // Tháng 4 chỉ có 30 ngày!
      expect(parseVNDate('31/12/2026')?.day).toBe(31);
    });

    it('isValidVNDate và isValidISODate kiểm tra toàn diện', () => {
      expect(isValidVNDate('15/08/1990')).toBe(true);
      expect(isValidVNDate('32/01/2026')).toBe(false);
      expect(isValidVNDate('invalid')).toBe(false);

      expect(isValidISODate('2026-09-24')).toBe(true);
      expect(isValidISODate('2025-02-29')).toBe(false);
      expect(isValidISODate('2026-13-01')).toBe(false);
    });

    it('isValidVNMonth và isValidISOMonth kiểm tra tháng', () => {
      expect(isValidVNMonth('09/2026')).toBe(true);
      expect(isValidVNMonth('13/2026')).toBe(false);
      expect(isValidISOMonth('2026-09')).toBe(true);
      expect(isValidISOMonth('2026-00')).toBe(false);
    });
  });

  describe('5. Zod Validation Schemas for Dates', () => {
    it('vnDateSchema bắt lỗi định dạng và lịch', () => {
      expect(vnDateSchema.safeParse('15/08/1990').success).toBe(true);
      expect(vnDateSchema.safeParse('31/02/2026').success).toBe(false);
      expect(vnDateSchema.safeParse('15-08-1990').success).toBe(false);
    });

    it('vnDobSchema từ chối ngày sinh ở tương lai', () => {
      expect(vnDobSchema.safeParse('15/08/1990').success).toBe(true);
      // Ngày trong tương lai (năm 2099)
      const futureRes = vnDobSchema.safeParse('01/01/2099');
      expect(futureRes.success).toBe(false);
      if (!futureRes.success) {
        expect(futureRes.error.issues[0]!.message).toContain('tương lai');
      }
    });

    it('optionalVnDobSchema chấp nhận chuỗi rỗng nhưng kiểm tra khi có giá trị', () => {
      expect(optionalVnDobSchema.safeParse('').success).toBe(true);
      expect(optionalVnDobSchema.safeParse(null).success).toBe(true);
      expect(optionalVnDobSchema.safeParse(undefined).success).toBe(true);
      expect(optionalVnDobSchema.safeParse('15/08/1990').success).toBe(true);
      expect(optionalVnDobSchema.safeParse('31/04/2026').success).toBe(false);
    });
  });

  describe('6. Zod Form-Specific Validation Schemas', () => {
    it('bhxhFormDateSchema kiểm tra logic từ tháng đến tháng', () => {
      // Hợp lệ: Từ 01/2026 đến 12/2026
      const valid = bhxhFormDateSchema.safeParse({
        dob: '15/08/1990',
        fromMonth: '01/2026',
        toMonth: '12/2026'
      });
      expect(valid.success).toBe(true);

      // Bất hợp lệ: Từ 12/2026 đến 05/2026
      const invalid = bhxhFormDateSchema.safeParse({
        dob: '15/08/1990',
        fromMonth: '12/2026',
        toMonth: '05/2026'
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]!.message).toContain('Đến tháng không được nhỏ hơn');
      }
    });

    it('bhytFormDateSchema kiểm tra ngày sinh của danh sách thành viên', () => {
      const valid = bhytFormDateSchema.safeParse({
        members: [
          { dob: '15/08/1990' },
          { dob: '20/10/1995' }
        ],
        fromMonth: '01/2026'
      });
      expect(valid.success).toBe(true);

      const invalid = bhytFormDateSchema.safeParse({
        members: [
          { dob: '32/01/1990' } // Sai ngày
        ]
      });
      expect(invalid.success).toBe(false);
    });

    it('renewalFormDateSchema kiểm tra logic gia hạn', () => {
      const valid = renewalFormDateSchema.safeParse({
        fromMonth: '09/2026',
        toMonth: '12/2026',
        nextPayment: '15/12/2026'
      });
      expect(valid.success).toBe(true);

      const invalid = renewalFormDateSchema.safeParse({
        fromMonth: '09/2026',
        toMonth: '08/2026'
      });
      expect(invalid.success).toBe(false);
    });

    it('participationPeriodDateSchema kiểm tra giai đoạn tham gia', () => {
      expect(participationPeriodDateSchema.safeParse({
        fromMonth: '01/2020',
        toMonth: '12/2022'
      }).success).toBe(true);

      expect(participationPeriodDateSchema.safeParse({
        fromMonth: '12/2022',
        toMonth: '01/2020'
      }).success).toBe(false);
    });

    it('recordDatesValidationSchema kiểm tra tổng thể các trường ngày hồ sơ', () => {
      const valid = recordDatesValidationSchema.safeParse({
        dob: '15/08/1990',
        fromMonth: '01/2026',
        toMonth: '06/2026',
        nextPayment: '15/06/2026',
        effectiveDate: '01/01/2026',
        targetDate: '30/06/2026'
      });
      expect(valid.success).toBe(true);
    });
  });

  describe('7. Quick Input Field Validation Helpers', () => {
    it('validateDOBInput trả về chuỗi thông báo lỗi trực quan cho UI', () => {
      expect(validateDOBInput('')).toBe('');
      expect(validateDOBInput('15/08')).toContain('đủ 10 ký tự');
      expect(validateDOBInput('31/02/1995')).toContain('lịch');
      expect(validateDOBInput('01/01/2099')).toContain('tương lai');
      expect(validateDOBInput('15/08/1990')).toBe('');
    });

    it('validateMonthInput trả về chuỗi lỗi cho input tháng', () => {
      expect(validateMonthInput('')).toContain('Vui lòng nhập tháng');
      expect(validateMonthInput('09/20')).toContain('đủ 7 ký tự');
      expect(validateMonthInput('13/2026')).toContain('không hợp lệ');
      expect(validateMonthInput('09/2026')).toBe('');
    });
  });
});
