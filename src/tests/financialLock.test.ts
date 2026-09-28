import { describe, it, expect } from 'vitest';
import { isDateLocked, checkFinancialLockViolation } from '../utils/helpers';
import type { RecordType } from '../context/types';

describe('Kiểm thử Khóa sổ kỳ tài chính (Financial Lock Guard Test Suite)', () => {
  const lockedKeys = ['month_08/2026', 'quarter_2_2026', 'year_2025'];

  const sampleRecord: RecordType = {
    id: 101,
    date: '2026-08-15',
    name: 'Nguyễn Văn Test',
    cccd: '001200000001',
    phone: '0987654321',
    address: 'Hà Nội',
    type: 'BHXH',
    amount: 1500000,
    months: 6,
    fromMonth: '2026-08',
    toMonth: '2027-01',
    paymentStatus: 'Đã thu tiền',
    status: 'Đang tham gia',
    notes: 'Khách hàng đóng đợt 1'
  };

  describe('1. Kiểm tra xác định kỳ bị khóa (isDateLocked)', () => {
    it('Nhận diện chính xác định dạng month_MM/YYYY (tháng 8/2026 bị khóa)', () => {
      expect(isDateLocked('2026-08-15', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-08-01', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-08-31', lockedKeys)).toBe(true);
    });

    it('Khớp định dạng dấu gạch dưới month_MM_YYYY lẫn dấu gạch chéo month_MM/YYYY', () => {
      const keysWithUnderscore = ['month_08_2026'];
      expect(isDateLocked('2026-08-20', keysWithUnderscore)).toBe(true);
    });

    it('Nhận diện chính xác Quý bị khóa (quarter_2_2026: tháng 4, 5, 6)', () => {
      expect(isDateLocked('2026-04-10', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-05-20', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-06-30', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-07-01', lockedKeys)).toBe(false); // Quý 3 không khóa
    });

    it('Nhận diện chính xác Năm bị khóa (year_2025)', () => {
      expect(isDateLocked('2025-01-01', lockedKeys)).toBe(true);
      expect(isDateLocked('2025-12-31', lockedKeys)).toBe(true);
      expect(isDateLocked('2026-09-01', lockedKeys)).toBe(false); // Tháng 9/2026 mở
    });

    it('Trả về false nếu danh sách lockedKeys rỗng hoặc ngày không hợp lệ', () => {
      expect(isDateLocked('2026-08-15', [])).toBe(false);
      expect(isDateLocked(null, lockedKeys)).toBe(false);
      expect(isDateLocked(undefined, lockedKeys)).toBe(false);
    });
  });

  describe('2. Kiểm tra vi phạm trường tài chính (checkFinancialLockViolation)', () => {
    it('CHẶN thay đổi trường số tiền (amount) khi kỳ bị khóa', () => {
      const result = checkFinancialLockViolation(sampleRecord, { amount: 2000000 }, lockedKeys);
      expect(result.isViolated).toBe(true);
      expect(result.violatedFields).toContain('amount');
    });

    it('CHẶN thay đổi kỳ đóng (months, fromMonth, toMonth) khi kỳ bị khóa', () => {
      const result = checkFinancialLockViolation(sampleRecord, { months: 12, toMonth: '2027-07' }, lockedKeys);
      expect(result.isViolated).toBe(true);
      expect(result.violatedFields).toContain('months');
      expect(result.violatedFields).toContain('toMonth');
    });

    it('CHẶN thay đổi trạng thái thanh toán (paymentStatus) khi kỳ bị khóa', () => {
      const result = checkFinancialLockViolation(sampleRecord, { paymentStatus: 'Đã hủy' }, lockedKeys);
      expect(result.isViolated).toBe(true);
      expect(result.violatedFields).toContain('paymentStatus');
    });

    it('CHO PHÉP cập nhật thông tin liên lạc (phone, address, notes) khi kỳ bị khóa', () => {
      const result = checkFinancialLockViolation(
        sampleRecord,
        {
          phone: '0912345678',
          address: 'TP. Hồ Chí Minh',
          notes: 'Đã gọi điện chăm sóc khách hàng định kỳ'
        },
        lockedKeys
      );
      expect(result.isViolated).toBe(false);
      expect(result.violatedFields).toHaveLength(0);
    });

    it('CHẶN nếu vừa sửa thông tin liên hệ vừa lén sửa số tiền', () => {
      const result = checkFinancialLockViolation(
        sampleRecord,
        {
          phone: '0912345678',
          amount: 1000000 // Vi phạm
        },
        lockedKeys
      );
      expect(result.isViolated).toBe(true);
      expect(result.violatedFields).toEqual(['amount']);
    });

    it('CHO PHÉP cập nhật mọi trường tài chính nếu kỳ giao dịch ĐANG MỞ (chưa khóa)', () => {
      const openRecord: RecordType = {
        ...sampleRecord,
        date: '2026-09-05' // Tháng 9/2026 chưa bị khóa
      };
      const result = checkFinancialLockViolation(openRecord, { amount: 5000000, months: 12 }, lockedKeys);
      expect(result.isViolated).toBe(false);
      expect(result.violatedFields).toHaveLength(0);
    });
  });
});
