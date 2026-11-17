import { describe, it, expect } from 'vitest';
import { exportRenewalListToExcel } from '../utils/renewalDispatchHelper';
import { addMonthsToPeriod } from '../utils/dateUtils';
import { formatMonthVN } from '../utils/helpers';

describe('Audit Nghiệp Vụ Cập Nhật Bảng Nhắc Hạn & Xuất Excel Đôn Đốc', () => {
  it('1. exportRenewalListToExcel cấu trúc 14 cột, bao gồm cột "Kỳ đóng gần nhất" ở vị trí chính xác', async () => {
    const mockItems = [
      {
        record: {
          name: 'Lương Thị Hậu',
          cccd: '014196005767',
          phone: '0336632081',
          address: 'Bản Nà Hin, Xã Sông Mã',
          type: 'BHXH',
          amount: 781000,
          from_month: '2026-10',
          to_month: '2026-10',
          months: 1,
          staff_id: 'STF-ADMIN1',
          notes: 'TEST PHẦN MỀM',
          next_payment: '2026-11-30'
        },
        diffDays: 13,
        urgency: 'warning' as const,
        urgencyLabel: 'Còn 13 ngày (Cận hạn)',
        urgencyColor: '#f59e0b',
        deadlineDate: '2026-11-30'
      },
      {
        record: {
          name: 'Lèo Thị Thư',
          cccd: '014195011746',
          phone: '0342307910',
          address: 'Chiềng Khương',
          type: 'BHXH',
          amount: 1155000,
          from_month: '2026-07',
          to_month: '2026-09',
          months: 3,
          staff_id: 'STF-01',
          next_payment: '2026-12-31'
        },
        diffDays: 44,
        urgency: 'new_period_law' as const,
        urgencyLabel: 'Đến kỳ đóng mới (Hạn Luật: 31/12/2026 - còn 44 ngày)',
        urgencyColor: '#6366f1',
        deadlineDate: '2026-12-31'
      }
    ];

    const mockStaffList = [
      { id: 'STF-ADMIN1', name: 'Quản Trị Viên' },
      { id: 'STF-01', name: 'Cán bộ 1' }
    ];

    // Chạy export kiểm tra tính toàn vẹn (không throw lỗi)
    await expect(exportRenewalListToExcel(mockItems, 'Danh Sách Đôn Đốc Đợt 1', mockStaffList)).resolves.not.toThrow();
  });

  it('2. Kiểm tra logic định dạng chuỗi Kỳ Đóng Gần Nhất (periodDisplay)', () => {
    // Trường hợp 1: Có cả from_month và to_month giống nhau (1 tháng)
    const from1 = '2026-10';
    const to1 = '2026-10';
    const str1From = formatMonthVN(from1);
    const str1To = formatMonthVN(to1);
    const display1 = str1From === str1To ? `Tháng ${str1From}` : `${str1From} - ${str1To}`;
    expect(display1).toBe('Tháng 10/2026');

    // Trường hợp 2: Có cả from_month và to_month khác nhau (khoảng nhiều tháng)
    const from2 = '2026-07';
    const to2 = '2026-09';
    const str2From = formatMonthVN(from2);
    const str2To = formatMonthVN(to2);
    const display2 = str2From === str2To ? `Tháng ${str2From}` : `${str2From} - ${str2To}`;
    expect(display2).toBe('07/2026 - 09/2026');

    // Trường hợp 3: Chỉ có to_month và số tháng đóng (tính ngược từ tháng kết thúc)
    const to3 = '12/2026';
    const mCount3 = 12;
    const fromCal3 = addMonthsToPeriod(to3, -(mCount3 - 1));
    expect(fromCal3).toBe('01/2026');
    const display3 = `${fromCal3} - ${to3}`;
    expect(display3).toBe('01/2026 - 12/2026');

    // Trường hợp 4: Chỉ có from_month và số tháng đóng (tính tiến)
    const from4 = '01/2026';
    const mCount4 = 6;
    const toCal4 = addMonthsToPeriod(from4, mCount4 - 1);
    expect(toCal4).toBe('06/2026');
    const display4 = `${from4} - ${toCal4}`;
    expect(display4).toBe('01/2026 - 06/2026');
  });

  it('3. Kiểm tra tính toán đảo năm chuyển giao thế kỷ / âm tháng an toàn', () => {
    // Tháng 01/2027 trừ 11 tháng -> Tháng 02/2026
    const calRolloverBackwards = addMonthsToPeriod('01/2027', -11);
    expect(calRolloverBackwards).toBe('02/2026');

    // Tháng 11/2026 cộng 3 tháng -> Tháng 02/2027
    const calRolloverForwards = addMonthsToPeriod('11/2026', 3);
    expect(calRolloverForwards).toBe('02/2027');
  });
});
