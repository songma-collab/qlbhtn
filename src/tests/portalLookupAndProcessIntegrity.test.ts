import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { supabase } from '../lib/supabase';
import { callPublicPortal } from '../utils/publicPortal';
import SearchResultModal from '../components/modals/SearchResultModal';
import { CustomerParticipationViewModal } from '../components/modals/CustomerParticipationViewModal';
import { calculateAutoRefundAmount } from '../utils/clawbackSettlement';
import {
  formatMonthVN,
  formatDateVN,
  calculateToMonthVN,
  calculateNextPaymentFromToMonth,
  getMethodLabelFromValue
} from '../utils/helpers';

vi.mock('react-router-dom', async () => {
  return {
    useNavigate: () => vi.fn()
  };
});

vi.mock('../context/AppContext', async () => {
  const actual = await vi.importActual<any>('../context/AppContext');
  return {
    ...actual,
    useAppContext: () => ({
      currentUser: { id: 'admin-1', role: 'admin', name: 'Quản trị viên' }
    })
  };
});

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

  it('4. Mục Kết Quả Tra Cứu Quá Trình (SearchResultModal): Chỉ hiển thị giao dịch có số tiền > 0, loại bỏ dòng số tiền 0 / --- (Nhập từ Excel), nhưng bảo toàn đầy đủ thông tin khách hàng', () => {
    // Giả lập dữ liệu khách hàng Luyện Thị Tính đúng như ảnh chụp thực tế của người dùng:
    const mockResults = [
      {
        id: 101,
        name: 'LUYỆN THỊ TÍNH',
        cccd: '014189001913',
        bhxh: '1420948156',
        type: 'BHXH',
        from_month: '11/2026',
        to_month: '11/2026',
        months: 1,
        income: 1650000,
        amount: 297000,
        action_type: 'Gia hạn',
        payment_status: 'Đã thu tiền'
      },
      {
        id: 102,
        name: 'LUYỆN THỊ TÍNH',
        cccd: '014189001913',
        bhxh: '1420948156',
        type: 'BHXH',
        from_month: '10/2026',
        to_month: '10/2026',
        months: 1,
        income: 1650000,
        amount: 297000,
        action_type: 'Tăng mới',
        payment_status: 'Đã thu tiền'
      },
      {
        id: 103,
        name: 'LUYỆN THỊ TÍNH',
        cccd: '014189001913',
        bhxh: '1420948156',
        type: 'BHXH',
        from_month: '10/2026',
        to_month: '10/2026',
        months: 1,
        income: 1650000,
        amount: 0, // Bút toán import danh bạ / khởi tạo, số tiền = 0
        action_type: 'Nhập từ Excel',
        payment_status: 'Đã thu tiền'
      }
    ];

    const html = renderToString(
      React.createElement(SearchResultModal, {
        isOpen: true,
        onClose: () => {},
        results: mockResults,
        searchCode: '014189001913'
      })
    );

    // 1. Phải giữ định danh khách hàng trên Header Modal:
    expect(html).toContain('LUYỆN THỊ TÍNH');
    expect(html).toContain('014189001913');
    expect(html).toContain('1420948156');

    // 2. Tổng tiền thanh toán chỉ tính 2 giao dịch có tiền > 0: 297.000 + 297.000 = 594.000 đ
    expect(html).toContain('594.000');

    // 3. Tổng thời gian BHXH tự nguyện tích lũy: CHỈ 2 THÁNG (không phải 3 tháng do dòng số tiền 0 đã bị loại bỏ)
    expect(html).toContain('2 tháng');
    expect(html).not.toContain('3 tháng');

    // 4. Bảng tra cứu không còn chứa dòng "Nhập từ Excel"
    expect(html).not.toContain('Nhập từ Excel');
    expect(html).toContain('Gia hạn');
    expect(html).toContain('Tăng mới');
  });

  it('5. SearchResultModal hiển thị empty state khi khách hàng chỉ có bản ghi khởi tạo không phát sinh số tiền > 0', () => {
    const mockZeroOnly = [
      {
        id: 104,
        name: 'NGUYỄN VĂN KHỞI TẠO',
        cccd: '012345678901',
        bhxh: '1234567890',
        type: 'BHXH',
        months: 1,
        amount: 0,
        action_type: 'Nhập từ Excel',
        payment_status: 'Đã thu tiền'
      }
    ];

    const html = renderToString(
      React.createElement(SearchResultModal, {
        isOpen: true,
        onClose: () => {},
        results: mockZeroOnly,
        searchCode: '012345678901'
      })
    );

    // Vẫn hiển thị tên khách hàng
    expect(html).toContain('NGUYỄN VĂN KHỞI TẠO');
    // Hiển thị thông báo rỗng rõ ràng
    expect(html).toContain('Chưa có giao dịch đóng phí nào phát sinh số tiền &gt; 0 tại đại lý');
    // Tổng tiền = 0
    expect(html).toContain('0 đ');
    // Không hiển thị thẻ tích lũy BHXH khi chưa có giao dịch hợp lệ
    expect(html).not.toContain('Tổng thời gian BHXH tự nguyện đã tích lũy');
  });

  it('6. calculateAutoRefundAmount: Tự động tính số tiền thoái thu khi chọn từ tháng đến tháng', () => {
    // Trường hợp 1: Hồ sơ gốc 12 tháng, 5.808.000 đ. Người dùng chọn từ 07/2026 đến 12/2026 (6 tháng)
    const origRecord: any = {
      id: 62,
      name: 'Ngô Thị Thảo',
      type: 'BHXH',
      from_month: '2026-01',
      to_month: '2026-12',
      months: 12,
      amount: 5808000
    };

    const autoAmt1 = calculateAutoRefundAmount(origRecord, 6);
    // 5.808.000 / 12 * 6 = 2.904.000 đ
    expect(autoAmt1).toBe(2904000);

    // Trường hợp 2: Chỉnh sửa bút toán thoái thu (Edit mode)
    // Hồ sơ gốc sau khi thoái thu đã bị trừ còn 6 tháng. Nhưng khi edit bút toán 6 tháng,
    // tổng tháng gốc phục hồi = 6 + 6 = 12 tháng. Người dùng điều chỉnh lại chỉ thoái thu 3 tháng:
    const modifiedOrigRecord: any = {
      id: 62,
      name: 'Ngô Thị Thảo',
      type: 'BHXH',
      from_month: '2026-01',
      to_month: '2026-06',
      months: 6,
      amount: 5808000
    };
    const autoAmt2 = calculateAutoRefundAmount(modifiedOrigRecord, 3, undefined, 6);
    // Tỷ lệ tháng gốc = 6 + 6 = 12 th. perMonth = 5.808.000 / 12 = 484.000 đ. 3 tháng = 1.452.000 đ
    expect(autoAmt2).toBe(1452000);
  });

  it('7. SearchResultModal: Hiển thị bút toán thoái trả với số tiền âm, bù trừ dòng tiền thực thu và giữ nguyên số tháng tích lũy', () => {
    // Trường hợp Ngô Thị Thảo trong ảnh thực tế:
    // 1. Tăng mới 12 tháng (01/2026 - 12/2026): 5.808.000 đ (sau đó đã ghi chú thoái trả 6 tháng 07/2026-12/2026)
    // 2. Gia hạn 3 tháng (10/2026 - 12/2026): 1.452.000 đ
    // 3. Bút toán thoái trả 6 tháng (07/2026 - 12/2026): -2.904.000 đ
    const mockThaoResults: any[] = [
      {
        id: 65,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        bhxh: '1420991171',
        type: 'BHXH',
        from_month: '2026-10',
        to_month: '2026-12',
        months: 3,
        income: 2500000,
        amount: 1452000,
        action_type: 'Gia hạn',
        payment_status: 'Đã thu tiền'
      },
      {
        id: 62,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        bhxh: '1420991171',
        type: 'BHXH',
        from_month: '2026-01',
        to_month: '2026-06',
        months: 6,
        income: 2500000,
        amount: 5808000,
        action_type: 'Tăng mới',
        payment_status: 'Đã thu tiền'
      },
      {
        id: 64,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        bhxh: '1420991171',
        type: 'BHXH',
        from_month: '2026-07',
        to_month: '2026-12',
        months: 6,
        income: 2500000,
        amount: -2904000,
        is_adjustment: true,
        action_type: 'Thoái thu hoàn trả',
        payment_status: 'Đã thoái thu'
      }
    ];

    const html = renderToString(
      React.createElement(SearchResultModal, {
        isOpen: true,
        onClose: () => {},
        results: mockThaoResults,
        searchCode: '014182000354'
      })
    );

    // 1. Phải hiển thị net dòng tiền: 1.452.000 + 5.808.000 - 2.904.000 = 4.356.000 đ
    expect(html).toContain('4.356.000');

    // 2. Tổng thời gian BHXH tự nguyện tích lũy giữ nguyên 9 tháng (6 + 3), bút toán thoái thu không bị cộng thêm tháng
    expect(html).toContain('9 tháng');

    // 3. Phải có badge "Thoái trả" và hiển thị số tiền âm hoàn trả
    expect(html).toContain('Thoái trả');
    expect(html).toContain('-2.904.000');
    expect(html).toContain('Đã thoái thu');
  });

  it('8. CustomerParticipationViewModal: Bổ sung phát sinh thoái trả vào Bảng 2 quá trình tại đại lý', () => {
    const mockCustomer: any = {
      id: 'cust-64',
      name: 'Ngô Thị Thảo',
      cccd: '014182000354',
      bhxh: '1420991171',
      prior_compulsory_months: 3,
      prior_voluntary_months: 0,
      prior_periods: [
        {
          id: 'p1',
          type: 'BAT_BUOC',
          unit: 'Hộ kinh doanh',
          job: 'Đóng BHXH bắt buộc',
          fromMonth: '07/2026',
          toMonth: '09/2026',
          months: 3,
          salary: 3000000
        }
      ]
    };

    const mockRecords: any[] = [
      {
        id: 65,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        type: 'BHXH',
        from_month: '2026-10',
        to_month: '2026-12',
        months: 3,
        amount: 1452000,
        nn_support_amount: 198000,
        payment_status: 'Đã thu tiền',
        date: '2026-11-03'
      },
      {
        id: 62,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        type: 'BHXH',
        from_month: '2026-01',
        to_month: '2026-06',
        months: 6,
        amount: 5808000,
        nn_support_amount: 792000,
        payment_status: 'Đã thu tiền',
        date: '2026-11-03'
      },
      {
        id: 64,
        name: 'Ngô Thị Thảo',
        cccd: '014182000354',
        type: 'BHXH',
        from_month: '2026-07',
        to_month: '2026-12',
        months: 6,
        amount: -2904000,
        nn_support_amount: -396000,
        is_adjustment: true,
        action_type: 'Thoái thu hoàn trả',
        payment_status: 'Đã thoái thu',
        decision_number: '112/QĐ-BHXH',
        date: '2026-11-03'
      }
    ];

    const html = renderToString(
      React.createElement(CustomerParticipationViewModal, {
        customer: mockCustomer,
        records: mockRecords,
        isOpen: true,
        onClose: () => {},
        onOpenEditModal: () => {}
      })
    );

    // Bảng 2 hiển thị tiêu đề gồm cả phát sinh thoái trả (3 phát sinh)
    expect(html).toContain('Quá trình phát sinh tại Đại lý này (Tự động từ phiếu thu &amp; phát sinh thoái trả)');
    expect(html).toMatch(/3.*phát sinh/);

    // Bảng 2 có dòng bút toán thoái trả với số tháng âm, số tiền âm, và badge Đã thoái thu
    expect(html).toContain('Bút toán thoái trả');
    expect(html).toContain('-6 th');
    expect(html).toContain('-2.904.000 đ');
    expect(html).toContain('-396.000 đ');
    expect(html).toContain('Đã thoái thu');
    expect(html).toContain('112/QĐ-BHXH');

    // Tổng số tháng tích lũy vẫn là 12 tháng (3 bắt buộc + 9 tự nguyện), không bị clawback tính thêm tháng
    expect(html).toMatch(/12.*tháng/);
  });
});
