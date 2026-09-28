import { describe, it, expect } from 'vitest';
import { 
  validateCCCD, 
  validateBHXH, 
  validatePhone, 
  cleanRawInput,
  customerRegistrationSchema 
} from './validators';

describe('Bộ kiểm thử Chuẩn hóa & Xác thực Dữ liệu Đầu vào (Zod Input Validation)', () => {
  describe('1. Hàm làm sạch chuỗi (cleanRawInput)', () => {
    it('Loại bỏ khoảng trắng thừa và zero-width space', () => {
      const dirty = '  001201009999\u200B  ';
      expect(cleanRawInput(dirty)).toBe('001201009999');
    });

    it('Xử lý an toàn khi giá trị null/undefined', () => {
      expect(cleanRawInput(null)).toBe('');
      expect(cleanRawInput(undefined)).toBe('');
    });
  });

  describe('2. Xác thực CCCD / Số ĐDCN (validateCCCD)', () => {
    it('Chấp nhận số CCCD đúng chuẩn 12 chữ số', () => {
      const res = validateCCCD('001201009999');
      expect(res.success).toBe(true);
      expect(res.data).toBe('001201009999');
    });

    it('Tự động làm sạch các khoảng trắng và dấu cách trong số CCCD', () => {
      const res = validateCCCD(' 001 201 009 999 ');
      expect(res.success).toBe(true);
      expect(res.data).toBe('001201009999');
    });

    it('Từ chối CCCD có độ dài khác 12 chữ số', () => {
      const resShort = validateCCCD('00120100999');
      expect(resShort.success).toBe(false);
      expect(resShort.error).toContain('12');

      const resLong = validateCCCD('0012010099999');
      expect(resLong.success).toBe(false);
    });
  });

  describe('3. Xác thực Mã số BHXH (validateBHXH)', () => {
    it('Chấp nhận mã số BHXH đúng 10 chữ số', () => {
      const res = validateBHXH('7912345678');
      expect(res.success).toBe(true);
      expect(res.data).toBe('7912345678');
    });

    it('Tự động loại bỏ ký tự lạ trong mã số BHXH', () => {
      const res = validateBHXH('79-1234-5678');
      expect(res.success).toBe(true);
      expect(res.data).toBe('7912345678');
    });

    it('Từ chối mã số BHXH không đủ 10 chữ số', () => {
      const res = validateBHXH('791234567');
      expect(res.success).toBe(false);
    });
  });

  describe('4. Xác thực Số điện thoại (validatePhone)', () => {
    it('Chấp nhận các đầu số hợp lệ của Việt Nam (09, 08, 03, 07, 05)', () => {
      expect(validatePhone('0912345678').success).toBe(true);
      expect(validatePhone('0868123456').success).toBe(true);
      expect(validatePhone('0398765432').success).toBe(true);
    });

    it('Từ chối số điện thoại không bắt đầu bằng số 0 hợp lệ', () => {
      expect(validatePhone('1234567890').success).toBe(false);
      expect(validatePhone('0123456789').success).toBe(false); // Đầu 01 cũ 11 số
    });
  });

  describe('5. Xác thực Form Đăng ký Tổng hợp (customerRegistrationSchema)', () => {
    it('Hợp lệ khi có đầy đủ họ tên và ít nhất CCCD hoặc BHXH', () => {
      const res = customerRegistrationSchema.safeParse({
        name: 'Nguyễn Văn An',
        cccd: '001201008888',
        phone: '0912345678',
        type: 'BHXH'
      });
      expect(res.success).toBe(true);
    });

    it('Báo lỗi khi thiếu cả CCCD lẫn Mã BHXH', () => {
      const res = customerRegistrationSchema.safeParse({
        name: 'Nguyễn Văn An',
        phone: '0912345678',
        type: 'BHXH'
      });
      expect(res.success).toBe(false);
    });
  });
});
