import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';
import {
  calculateNextRenewalMonth,
  compareRecordsByContractLatest,
  normalizeMethodValue,
  getMethodLabelFromValue,
  getRecordEndMonthIndex
} from '../utils/dateUtils';
import { getCustomerPreviousBHXHMonths, calculateBHXH } from '../utils/calculations';

describe('Kiểm thử Giữ nguyên Phương thức đóng & Mức thu nhập khi Gia hạn (Test Case: Lò Thị Nga)', () => {
  // Giao dịch thực tế đã thu tiền của khách hàng Lò Thị Nga:
  // Đóng 3 tháng, từ 01/2026 đến 03/2026, mức thu nhập 1.600.000 đ, dân tộc Thiểu số (hỗ trợ 30%)
  const paidRecordNga: RecordType = {
    id: 101,
    date: '2026-01-10T08:00:00.000Z',
    name: 'Lò Thị Nga',
    cccd: '014198012345',
    bhxh: '1421010199',
    old_bhxh: '1421010199',
    phone: '0988776655',
    address: 'Bản Cang, Xã Chiềng Khoi, Huyện Yên Châu',
    dob: '1985-06-15',
    gender: 'Nữ',
    nation: 'Thiểu_số',
    type: 'BHXH',
    action_type: 'Tăng mới',
    method: 'Đóng 3 tháng',
    months: 3,
    income: 1600000,
    from_month: '01/2026',
    to_month: '03/2026',
    next_payment: '2026-04-15',
    payment_status: 'Đã thu tiền',
    status: 'Đang tham gia',
    amount: 759000,
    base_premium: 1056000,
    nn_support_pct: 30,
    nn_support_amount: 297000,
    dp_support_pct: 0,
    dp_support_amount: 0
  };

  // Giả lập 1 bản ghi nháp / chờ thanh toán phát sinh sai lệch kỳ đóng (ví dụ kỳ 10/2026)
  const pendingGarbageRecord: RecordType = {
    id: 102,
    date: '2026-02-01T08:00:00.000Z',
    name: 'Lò Thị Nga',
    cccd: '014198012345',
    bhxh: '1421010199',
    type: 'BHXH',
    action_type: 'Gia hạn',
    method: 'Đóng hằng tháng',
    months: 1,
    income: 1500000,
    from_month: '10/2026',
    to_month: '10/2026',
    next_payment: '2026-11-15',
    payment_status: 'Chờ thanh toán',
    status: 'Đang tham gia',
    amount: 231000
  };

  it('1. compareRecordsByContractLatest phải ưu tiên hợp đồng đã thu tiền hợp lệ trước bản ghi chờ thanh toán', () => {
    const list = [pendingGarbageRecord, paidRecordNga];
    const sorted = [...list].sort(compareRecordsByContractLatest);

    // Bản ghi đã thu tiền (paidRecordNga) phải được chọn đứng đầu
    expect(sorted[0].id).toBe(101);
    expect(sorted[0].income).toBe(1600000);
    expect(sorted[0].method).toBe('Đóng 3 tháng');
  });

  it('2. getRecordEndMonthIndex tính toán thứ tự thời gian chính xác theo năm và tháng toán học', () => {
    const idxMarch2026 = getRecordEndMonthIndex({ to_month: '03/2026' });
    const idxOct2026 = getRecordEndMonthIndex({ to_month: '10/2026' });
    const idxDec2025 = getRecordEndMonthIndex({ to_month: '12/2025' });

    expect(idxMarch2026).toBe(2026 * 12 + 3);
    expect(idxOct2026).toBe(2026 * 12 + 10);
    expect(idxDec2025).toBe(2025 * 12 + 12);
    expect(idxMarch2026).toBeGreaterThan(idxDec2025);
    expect(idxOct2026).toBeGreaterThan(idxMarch2026);
  });

  it('3. normalizeMethodValue và getMethodLabelFromValue nhận diện đúng và đủ mọi biến thể phương thức đóng', () => {
    // Chuỗi text chuẩn
    expect(normalizeMethodValue('Đóng 3 tháng')).toBe('3');
    expect(getMethodLabelFromValue('3')).toBe('Đóng 3 tháng');

    // Số hoặc chuỗi số
    expect(normalizeMethodValue('3')).toBe('3');
    expect(normalizeMethodValue(3)).toBe('3');

    // Fallback theo months khi method bị trống
    expect(normalizeMethodValue('', 3)).toBe('3');
    expect(normalizeMethodValue(undefined, 6)).toBe('6');
    expect(normalizeMethodValue(undefined, 12)).toBe('12');
  });

  it('4. getCustomerPreviousBHXHMonths loại trừ các bản ghi nháp/chờ thanh toán, tính chuẩn 3 tháng tích lũy', () => {
    const allRecords = [paidRecordNga, pendingGarbageRecord];
    const prevMonths = getCustomerPreviousBHXHMonths(
      allRecords,
      { cccd: '014198012345', bhxh: '1421010199' },
      null,
      '04/2026',
      []
    );

    // Chỉ có kỳ 01/2026 - 03/2026 đã thu tiền được tính -> chính xác 3 tháng
    expect(prevMonths).toBe(3);
  });

  it('5. Toàn chu trình: Gia hạn cho Lò Thị Nga kế thừa chính xác mức 1.600.000 đ, kỳ 04/2026-06/2026, thực thu 759.000 đ', () => {
    const allRecords = [paidRecordNga, pendingGarbageRecord];
    const activeRecords = allRecords.filter(r => r.payment_status !== 'Đã hủy');

    // Bước 1: Lấy bản ghi giao dịch thực tế mới nhất
    const sortedByContract = [...activeRecords].sort(compareRecordsByContractLatest);
    const newestByContract = sortedByContract[0];

    expect(newestByContract.id).toBe(101);
    expect(newestByContract.income).toBe(1600000);

    // Bước 2: Chuẩn hóa phương thức đóng và số tháng
    const methodVal = normalizeMethodValue(newestByContract.method, newestByContract.months);
    const customMonths = Number(newestByContract.months) || (methodVal === '3' ? 3 : 1);
    expect(methodVal).toBe('3');
    expect(customMonths).toBe(3);

    // Bước 3: Tính kỳ gia hạn tiếp theo nối tiếp kỳ 03/2026
    const nextStartMonth = calculateNextRenewalMonth(newestByContract.to_month, newestByContract.next_payment);
    expect(nextStartMonth).toBe('04/2026');

    // Bước 4: Tính toán mức đóng BHXH tự nguyện cho kỳ mới
    const calc = calculateBHXH(
      1600000,       // Mức thu nhập đóng cũ được giữ nguyên
      30,            // Tỷ lệ NSNN Thiểu số
      0,             // Hỗ trợ ĐP
      '3',           // Phương thức đóng 3 tháng
      3,             // Số tháng đóng
      '04/2026',     // Từ tháng
      0.08,          // Lãi suất
      1500000,       // Chuẩn nghèo
      undefined,     // policies
      3              // Số tháng đã tích lũy trước đó
    );

    expect(calc.toMonth).toBe('06/2026');
    expect(calc.basePremium).toBe(1056000);       // 1.600.000 * 22% * 3 tháng = 1.056.000 đ
    expect(calc.nnSupportAmount).toBe(297000);     // 1.500.000 * 22% * 30% * 3 tháng = 297.000 đ
    expect(calc.amount).toBe(759000);              // Thực thu 1.056.000 - 297.000 = 759.000 đ
    expect(calc.supportedMonthsCount).toBe(3);
    expect(calc.totalAccumulatedMonths).toBe(6);
  });
});
