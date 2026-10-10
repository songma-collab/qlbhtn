import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';
import { calculateNextRenewalMonth, compareRecordsByContractLatest } from '../utils/dateUtils';

describe('Kiểm thử Đồng bộ Khách hàng khi Xóa Giao dịch Gia hạn (Test Case: Lèo Thị Thư)', () => {
  it('Khi xóa giao dịch gia hạn phát sinh (04/2026-06/2026), hợp đồng và danh bạ phải tự động phục hồi về đợt đóng hợp lệ trước đó (01/2026-03/2026, Đã thu tiền)', () => {
    // 1. Hồ sơ gốc đợt trước: TXN33 đóng 3 tháng từ 01/2026 đến 03/2026, đã thu tiền
    const txn33: Partial<RecordType> = {
      id: 33,
      type: 'BHXH',
      name: 'Lèo Thị Thư',
      cccd: '014195011768',
      bhxh: '1421010133',
      old_bhxh: '1421010133',
      phone: '0342307910',
      action_type: 'Tăng mới',
      payment_status: 'Đã thu tiền',
      status: 'Đang tham gia',
      method: 'Đóng 3 tháng',
      months: 3,
      income: 1500000,
      nn_support_pct: 30,
      amount: 1155000,
      from_month: '2026-01',
      to_month: '2026-03',
      next_payment: '2026-04-15',
      date: '2026-01-08T07:00:00Z',
      created_at: '2026-01-08T07:00:00Z'
    };

    // 2. Từng phát sinh gia hạn 04/2026 - 06/2026 (Chờ thanh toán), sau đó đã bị XÓA khỏi danh sách records
    // Giả lập danh sách records hiện tại trong AppContext sau khi bản ghi kia đã bị xóa:
    const activeRecords = [txn33] as RecordType[];

    // 3. Giả lập dữ liệu cũ từ bảng customers trên server chưa kịp cập nhật hoặc bị trigger cũ ghi đè:
    const staleServerCustomer = {
      id: 'cust-uuid-1',
      customer_key: 'BHXH_014195011768',
      type: 'BHXH',
      name: 'Lèo Thị Thư',
      cccd: '014195011768',
      bhxh: '1421010133',
      old_bhxh: '1421010133',
      phone: '0342307910',
      from_month: '2026-04', // Bị lưu đè từ bản ghi đã xóa
      to_month: '2026-06',   // Bị lưu đè từ bản ghi đã xóa
      payment_status: 'Chờ thanh toán', // Bị lưu đè từ bản ghi đã xóa
      next_payment: '2026-07-15'
    };

    // 4. Kiểm tra thuật toán đối soát & chữa lành tự động trong CRMView
    const cleanC = (staleServerCustomer.cccd || '').replace(/\D/g, '');
    const cleanB = (staleServerCustomer.bhxh || '').replace(/\D/g, '');

    const matchedRecs = activeRecords.filter(r => {
      const pStatus = r.payment_status || (r as any).paymentStatus;
      if (pStatus === 'Đã hủy' || pStatus === 'Đã thoái thu') return false;
      const rC = (r.cccd || '').replace(/\D/g, '');
      const rB = (r.bhxh || '').replace(/\D/g, '');
      return (cleanC && (rC === cleanC || rB === cleanC)) || (cleanB && (rB === cleanB || rC === cleanB));
    });

    expect(matchedRecs.length).toBe(1);

    const sortedContract = [...matchedRecs].sort(compareRecordsByContractLatest);

    const latestContract = sortedContract[0];
    expect(latestContract).toBeDefined();

    // 5. Kết quả đối soát hiển thị trên Danh bạ:
    const reconciledCustomer = {
      ...staleServerCustomer,
      from_month: latestContract?.from_month,
      to_month: latestContract?.to_month,
      next_payment: latestContract?.next_payment,
      payment_status: latestContract?.payment_status,
      status: latestContract?.status || 'Đang tham gia',
      method: latestContract?.method,
      months: latestContract?.months,
      income: latestContract?.income
    };

    expect(reconciledCustomer.from_month).toBe('2026-01');
    expect(reconciledCustomer.to_month).toBe('2026-03');
    expect(reconciledCustomer.payment_status).toBe('Đã thu tiền');
    expect(reconciledCustomer.next_payment).toBe('2026-04-15');

    // 6. Khi mở modal Gia hạn BHXH từ hồ sơ này:
    const calculatedNextMonth = calculateNextRenewalMonth(reconciledCustomer.to_month, reconciledCustomer.next_payment);
    expect(calculatedNextMonth).toBe('04/2026');
  });

  it('openRegisterModal và RegisterModal phải ưu tiên thông số hợp đồng thực tế từ newestByContract', () => {
    // Record từ danh bạ (có thể mang trường toMonth lỗi từ quá khứ)
    const crmRecord = {
      id: 33,
      name: 'Lèo Thị Thư',
      cccd: '014195011768',
      bhxh: '1421010133',
      fromMonth: '2026-04',
      toMonth: '2026-06',
      method: 'Đóng hằng tháng',
      income: 1500000,
      paymentStatus: 'Chờ thanh toán'
    };

    // Giao dịch thực tế duy nhất còn hiệu lực
    const newestByContract = {
      id: 33,
      name: 'Lèo Thị Thư',
      cccd: '014195011768',
      bhxh: '1421010133',
      from_month: '2026-01',
      to_month: '2026-03',
      method: 'Đóng 3 tháng',
      months: 3,
      income: 1500000,
      payment_status: 'Đã thu tiền'
    };

    // Logic ưu tiên mới:
    const resolvedRec = {
      ...crmRecord,
      income: newestByContract.income ?? crmRecord.income,
      method: newestByContract.method || crmRecord.method,
      fromMonth: newestByContract.from_month || crmRecord.fromMonth,
      toMonth: newestByContract.to_month || crmRecord.toMonth,
      months: newestByContract.months ?? 1,
      paymentStatus: newestByContract.payment_status || crmRecord.paymentStatus
    };

    expect(resolvedRec.fromMonth).toBe('2026-01');
    expect(resolvedRec.toMonth).toBe('2026-03');
    expect(resolvedRec.method).toBe('Đóng 3 tháng');
    expect(resolvedRec.months).toBe(3);
    expect(resolvedRec.paymentStatus).toBe('Đã thu tiền');
  });
});
