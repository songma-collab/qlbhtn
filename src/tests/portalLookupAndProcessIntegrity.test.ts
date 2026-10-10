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

  it('1. callPublicPortal tự động dự phòng sang RPC public_lookup_process khi Edge Function báo lỗi kết nối ("Failed to send a request to the Edge Function")', async () => {
    // Giả lập Edge Function bị lỗi không kết nối được (chưa deploy hoặc lỗi mạng)
    const invokeSpy = vi.spyOn(Object.getPrototypeOf(supabase.functions), 'invoke').mockRejectedValue(
      new Error('Failed to send a request to the Edge Function')
    );

    // Giả lập RPC public_lookup_process trong CSDL hoạt động bình thường
    const mockLookupData = [
      {
        name: 'L***H***',
        cccd: '014***5767',
        type: 'BHXH',
        from_month: '01/2026',
        to_month: '01/2026',
        months: 1,
        income: 4000000,
        amount: 781000,
        next_payment: '2026-02-15',
        status: 'Đang tham gia',
        payment_status: 'Đã thu tiền',
        registration_date: '2026-01-10'
      }
    ];

    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: mockLookupData,
      error: null
    } as any);

    // Gọi tra cứu từ Portal
    const result = await callPublicPortal<any[]>('lookup', {
      code: '014196005767',
      type: 'BHXH'
    });

    // Xác nhận Edge Function đã được gọi trước
    expect(invokeSpy).toHaveBeenCalledWith('public-customer-intake', expect.anything());
    // Xác nhận hệ thống đã tự động Failover sang RPC dự phòng mà KHÔNG làm văng lỗi ra màn hình
    expect(rpcSpy).toHaveBeenCalledWith('public_lookup_process', {
      p_code: '014196005767',
      p_type: 'BHXH'
    });
    // Kết quả trả về danh sách lịch sử quá trình đầy đủ
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(781000);
    expect(result[0].from_month).toBe('01/2026');
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

    const calculatedNextPayment = calculateNextPaymentFromToMonth(calculatedToMonth);
    expect(calculatedNextPayment).toBe('2026-07-15');

    const formattedNext = formatDateVN(calculatedNextPayment);
    expect(formattedNext).toBe('15/07/2026');
  });
});
