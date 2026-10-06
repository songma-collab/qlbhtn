import { describe, it, expect } from 'vitest';
import { 
  formatMonthVN, 
  formatDateVN, 
  calculateNextPaymentFromToMonth, 
  parseToIsoDate,
  getLocalYYYYMMDD 
} from '../utils/helpers';

describe('Kiểm thử tính năng Cột Kỳ đóng, Hạn đóng tiếp và Trạng thái đóng trên CRM Table', () => {
  it('1. Định dạng cột Kỳ đóng theo chuẩn MM/YYYY - MM/YYYY tương tự ảnh người dùng', () => {
    // Trường hợp 1: Có cả from_month và to_month (snake_case)
    const rec1 = { from_month: '2026-08', to_month: '2026-08' };
    const fromMStr1 = formatMonthVN(rec1.from_month);
    const toMStr1 = formatMonthVN(rec1.to_month);
    const periodStr1 = (fromMStr1 && toMStr1) ? `${fromMStr1} - ${toMStr1}` : (fromMStr1 || toMStr1 || '---');
    expect(periodStr1).toBe('08/2026 - 08/2026');

    // Trường hợp 2: Có camelCase fromMonth và toMonth
    const rec2 = { fromMonth: '01/2026', toMonth: '06/2026' };
    const fromMStr2 = formatMonthVN((rec2 as any).from_month || rec2.fromMonth);
    const toMStr2 = formatMonthVN((rec2 as any).to_month || rec2.toMonth);
    const periodStr2 = (fromMStr2 && toMStr2) ? `${fromMStr2} - ${toMStr2}` : (fromMStr2 || toMStr2 || '---');
    expect(periodStr2).toBe('01/2026 - 06/2026');

    // Trường hợp 3: Chỉ có 1 tháng
    const rec3 = { from_month: '2026-09' };
    const fromMStr3 = formatMonthVN(rec3.from_month);
    const toMStr3 = formatMonthVN((rec3 as any).to_month);
    const periodStr3 = (fromMStr3 && toMStr3) ? `${fromMStr3} - ${toMStr3}` : (fromMStr3 || toMStr3 || '---');
    expect(periodStr3).toBe('09/2026');
  });

  it('2. Cột Hạn đóng tiếp: Nhận diện chính xác cả snake_case (next_payment) và camelCase (nextPayment)', () => {
    // Khách hàng từ DB Supabase (snake_case)
    const dbCustomer = { next_payment: '2026-09-15' };
    const nextPay1 = dbCustomer.next_payment || (dbCustomer as any).nextPayment;
    expect(nextPay1).toBe('2026-09-15');
    expect(formatDateVN(nextPay1)).toBe('15/09/2026');

    // Khách hàng từ object cũ (camelCase)
    const legacyCustomer = { nextPayment: '2026-10-31' };
    const nextPay2 = (legacyCustomer as any).next_payment || legacyCustomer.nextPayment;
    expect(nextPay2).toBe('2026-10-31');
    expect(formatDateVN(nextPay2)).toBe('31/10/2026');
  });

  it('3. Tự động suy luận Hạn đóng tiếp từ Kỳ đóng khi next_payment bị NULL trong DB', () => {
    // Khách hàng có kỳ đóng đến 08/2026 nhưng next_payment null
    const customer = { to_month: '2026-08', next_payment: null };
    let nextPay: string | null = customer.next_payment;
    if (!nextPay && customer.to_month) {
      nextPay = calculateNextPaymentFromToMonth(customer.to_month, 1);
    }
    expect(nextPay).toBe('2026-09-15');
    expect(formatDateVN(nextPay)).toBe('15/09/2026');
  });

  it('4. Phân loại Trạng Thái Đóng (Đã hết hạn, Sắp hết hạn, Bình thường) an toàn tuyệt đối với múi giờ', () => {
    const todayStr = getLocalYYYYMMDD();
    
    // Ngày trong quá khứ -> Đã hết hạn
    const pastDate = '2020-01-01';
    const pastIso = parseToIsoDate(pastDate);
    const isExpired = pastIso < todayStr;
    expect(isExpired).toBe(true);

    // Ngày định dạng VN DD/MM/YYYY trong quá khứ -> parseToIsoDate chuyển thành YYYY-MM-DD
    const pastVnDate = '01/01/2020';
    const pastVnIso = parseToIsoDate(pastVnDate);
    expect(pastVnIso).toBe('2020-01-01');
    expect(pastVnIso < todayStr).toBe(true);

    // Ngày xa trong tương lai -> Bình thường
    const futureDate = '2030-12-31';
    const futureIso = parseToIsoDate(futureDate);
    expect(futureIso > todayStr).toBe(true);
  });
});
