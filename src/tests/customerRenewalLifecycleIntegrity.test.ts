import { describe, it, expect } from 'vitest';
import { groupRecordsByCustomer } from '../utils/helpers';
import { classifyRenewalRecords } from '../utils/renewalDispatchHelper';
import { calculateNextRenewalMonth } from '../utils/dateStandardHelper';
import { RecordType } from '../context/types';

describe('Kiểm thử Toàn vẹn Vòng đời Khách hàng & Chu trình Gia hạn (Customer Renewal Lifecycle)', () => {
  const initialRegistration: RecordType = {
    id: 101,
    date: '2026-01-05T08:00:00.000Z',
    name: 'Lò Văn Chiến',
    cccd: '014090001234',
    phone: '0987111222',
    address: 'Bản Phố, Xã Mường Giàng',
    bhxh: '1420123456',
    dob: '1990-05-15',
    gender: 'Nam',
    nation: 'Kinh',
    type: 'BHXH',
    action_type: 'Đăng ký mới',
    income: 2000000,
    method: 'Đóng 3 tháng',
    months: 3,
    from_month: '2026-01',
    to_month: '2026-03',
    next_payment: '2026-04-15',
    amount: 1188000,
    status: 'Đang tham gia',
    payment_status: 'Đã thu tiền'
  };

  const firstRenewalWithUpdatedInfo: RecordType = {
    id: 205,
    date: '2026-03-20T09:30:00.000Z',
    name: 'Lò Văn Chiến',
    cccd: '014090001234',
    phone: '0987999888', // Cập nhật SĐT mới
    address: 'Bản Bon, Xã Mường Chiên', // Cập nhật địa chỉ mới
    bhxh: '1420123456',
    dob: '1990-05-15',
    gender: 'Nam',
    nation: 'Kinh',
    type: 'BHXH',
    action_type: 'Gia hạn',
    income: 3000000, // Nâng mức thu nhập từ 2tr -> 3tr
    method: 'Đóng 6 tháng', // Đổi phương thức từ 3 tháng -> 6 tháng
    months: 6,
    from_month: '2026-04',
    to_month: '2026-09',
    next_payment: '2026-10-15',
    amount: 3564000,
    status: 'Đang tham gia',
    payment_status: 'Đã thu tiền'
  };

  it('1. groupRecordsByCustomer phải chọn đúng bản ghi gia hạn mới nhất thay vì bản ghi đăng ký cũ', () => {
    const history = [initialRegistration, firstRenewalWithUpdatedInfo];
    const grouped = groupRecordsByCustomer(history, 'BHXH');

    expect(grouped.length).toBe(1);
    const latest = grouped[0]!;

    // Phải lấy thông tin của bản ghi mới nhất (Lần gia hạn 1)
    expect(latest.id).toBe(205);
    expect(latest.income).toBe(3000000);
    expect(latest.method).toBe('Đóng 6 tháng');
    expect(latest.from_month || (latest as any).fromMonth).toBe('2026-04');
    expect(latest.to_month || (latest as any).toMonth).toBe('2026-09');
    expect(latest.next_payment || (latest as any).nextPayment).toBe('2026-10-15');
    expect(latest.phone).toBe('0987999888');
    expect(latest.address).toBe('Bản Bon, Xã Mường Chiên');
  });

  it('2. Tính toán kỳ gia hạn tiếp theo (calculateNextRenewalMonth) phải bắt đầu từ tháng kế tiếp của lần gia hạn gần nhất', () => {
    const latestToMonth = firstRenewalWithUpdatedInfo.to_month!;
    const latestNextPayment = firstRenewalWithUpdatedInfo.next_payment!;

    const nextRenewalStart = calculateNextRenewalMonth(latestToMonth, latestNextPayment);

    // Kỳ trước đóng đến 09/2026 -> Kỳ gia hạn tiếp theo phải bắt đầu từ 10/2026
    expect(nextRenewalStart).toBe('10/2026');
  });

  it('3. classifyRenewalRecords phải nhận diện ngày đôn đốc dựa trên next_payment của bản ghi mới nhất', () => {
    const history = [initialRegistration, firstRenewalWithUpdatedInfo];
    const classification = classifyRenewalRecords(history);

    // Không được để sót do sai tên trường camelCase/snake_case
    expect(classification.all.length).toBe(1);
    const item = classification.all[0]!;
    expect(item.record.id).toBe(205);
    expect(item.record.next_payment || item.record.nextPayment).toBe('2026-10-15');
  });

  it('4. Khách hàng thực hiện gia hạn lần 2: kế thừa đầy đủ mức đóng 3tr, phương thức 6 tháng và địa chỉ mới', () => {
    const history = [initialRegistration, firstRenewalWithUpdatedInfo];
    
    // Giả lập logic tra cứu bản ghi mới nhất như trên RegisterModal / CRMView
    const cleanCode = '014090001234';
    const activeRecords = history
      .filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy')
      .sort((a, b) => {
        const nextA = new Date(a.next_payment || (a as any).nextPayment || 0).getTime();
        const nextB = new Date(b.next_payment || (b as any).nextPayment || 0).getTime();
        if (nextB !== nextA) return nextB - nextA;
        const toMA = a.to_month || (a as any).toMonth || '';
        const toMB = b.to_month || (b as any).toMonth || '';
        if (toMB !== toMA) return toMB.localeCompare(toMA);
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });

    const matchedLatest = activeRecords.find(r => r.cccd === cleanCode);
    expect(matchedLatest).toBeDefined();
    expect(matchedLatest!.id).toBe(205);

    // Kiểm tra các thuộc tính được nạp vào modal gia hạn lần 2
    const nextStartMonth = calculateNextRenewalMonth(matchedLatest!.to_month, matchedLatest!.next_payment);
    expect(nextStartMonth).toBe('10/2026');
    expect(matchedLatest!.income).toBe(3000000);
    expect(matchedLatest!.method).toBe('Đóng 6 tháng');
    expect(matchedLatest!.address).toBe('Bản Bon, Xã Mường Chiên');
    expect(matchedLatest!.phone).toBe('0987999888');
  });
});
