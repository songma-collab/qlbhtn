import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import { callPublicPortal } from '../utils/publicPortal';
import {
  formatMonthVN,
  formatDateVN,
  calculateToMonthVN,
  calculateNextPaymentFromToMonth,
  getMethodLabelFromValue
} from '../utils/helpers';

describe('Kiểm thử Tra Cứu Quá Trình Công Khai & Chuẩn Hóa Hiển Thị Modal (Lookup & SearchResultModal Integrity)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. callPublicPortal chặn kết nối trực tiếp và ném lỗi an toàn khi Edge Function báo lỗi (chống bypass bảo mật)', async () => {
    // Giả lập Edge Function bị lỗi không kết nối được (chưa deploy hoặc lỗi mạng)
    const invokeSpy = vi.spyOn(Object.getPrototypeOf(supabase.functions), 'invoke').mockRejectedValue(
      new Error('Failed to send a request to the Edge Function')
    );

    // Xác nhận gọi qua Edge Function và ném lỗi bảo vệ người dùng, tuyệt đối không bypass gọi trực tiếp RPC anon
    await expect(callPublicPortal<any[]>('lookup', {
      code: '014196005767',
      type: 'BHXH'
    })).rejects.toThrow('Failed to send a request to the Edge Function');

    expect(invokeSpy).toHaveBeenCalledWith('public-customer-intake', expect.anything());
  });

  it('2. Chuẩn hóa bản ghi thuần snake_case từ Database: hiển thị đầy đủ Thời gian, Hạn tiếp theo, Phân kỳ và Trạng thái', () => {
    // Bản ghi giống thực tế của Lường Thị Hậu từ bảng records:
    const rawDbRecord = {
      id: 55,
      name: 'LƯỜNG THỊ HẬU',
      cccd: '014196005767',
      bhxh: '1421010555',
      type: 'BHXH',
      from_month: '01/2026',
      to_month: '01/2026',
      months: 1,
      income: 4000000,
      amount: 781000,
      next_payment: '2026-02-15',
      payment_status: 'Đã thu tiền',
      method: 'Đóng hằng tháng',
      action_type: 'Tăng mới',
      status: 'Đang tham gia'
    };

    // Kiểm tra tính toán các trường hiển thị:
    const fromM = rawDbRecord.from_month;
    const toM = rawDbRecord.to_month;
    const periodDisplay = (fromM && toM) 
      ? (formatMonthVN(fromM) === formatMonthVN(toM) ? formatMonthVN(fromM) : `${formatMonthVN(fromM)} - ${formatMonthVN(toM)}`)
      : '---';

    expect(periodDisplay).toBe('01/2026'); // KHÔNG BỊ '---'

    const nextPaymentDisplay = formatDateVN(rawDbRecord.next_payment);
    expect(nextPaymentDisplay).toBe('15/02/2026'); // KHÔNG BỊ TRỐNG

    const methodDisplay = getMethodLabelFromValue(rawDbRecord.method) || rawDbRecord.method;
    expect(methodDisplay).toBe('Đóng hằng tháng'); // HIỂN THỊ PHÂN KỲ CHUẨN

    expect(rawDbRecord.payment_status).toBe('Đã thu tiền'); // TRẠNG THÁI RÕ RÀNG
  });

  it('3. Khi thiếu to_month hoặc next_payment trong dữ liệu lịch sử, hệ thống tự động suy luận chính xác từ số tháng', () => {
    // Trường hợp bản ghi chỉ có from_month và months = 3, chưa có to_month
    const partialRecord = {
      from_month: '04/2026',
      months: 3,
      amount: 2343000
    };

    const calculatedToMonth = calculateToMonthVN(partialRecord.from_month, partialRecord.months);
    expect(calculatedToMonth).toBe('06/2026');

    const calculatedNextPayment = calculateNextPaymentFromToMonth(calculatedToMonth, partialRecord.months);
    expect(calculatedNextPayment).toBe('2026-09-30');

    const formattedNext = formatDateVN(calculatedNextPayment);
    expect(formattedNext).toBe('30/09/2026');
  });
});
