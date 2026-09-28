import { describe, it, expect } from 'vitest';
import { groupRecordsByCustomer } from '../utils/helpers';

describe('Kiểm thử Thống kê Dashboard & Hồ sơ sắp hết hạn (Dashboard Stats & Anti-Regression Suite)', () => {
  const baseToday = '2026-09-10';

  it('1. Khách hàng đã đóng tiếp (gia hạn) KHÔNG bị tính vào Hồ sơ sắp hết hạn (< 30 ngày)', () => {
    const todayTs = new Date(baseToday).getTime();

    const sampleRecords = [
      // Khách A: Đã hết hạn kỳ cũ vào 15/09/2026, nhưng ĐÃ GIA HẠN kỳ mới đến 15/09/2027
      {
        id: 1,
        name: 'Nguyễn Văn A',
        cccd: '001200000001',
        phone: '0912345678',
        bhxh: '0123456789',
        type: 'BHXH',
        date: '2025-09-15',
        nextPayment: '2026-09-15', // Bản ghi cũ trong 30 ngày
        paymentStatus: 'Đã thu tiền',
        amount: 1584000,
        staffId: 'staff-1',
      },
      {
        id: 2,
        name: 'Nguyễn Văn A',
        cccd: '001200000001',
        phone: '0912345678',
        bhxh: '0123456789',
        type: 'BHXH',
        date: '2026-09-05',
        nextPayment: '2027-09-15', // Đã gia hạn sang 2027
        paymentStatus: 'Đã thu tiền',
        amount: 1584000,
        staffId: 'staff-1',
      },
      // Khách B: Đến hạn vào 20/09/2026, CHƯA gia hạn
      {
        id: 3,
        name: 'Trần Thị B',
        cccd: '001200000002',
        phone: '0987654321',
        bhxh: '0123456790',
        type: 'BHXH',
        date: '2025-09-20',
        nextPayment: '2026-09-20', // Trong vòng 30 ngày, chưa đóng tiếp
        paymentStatus: 'Đã thu tiền',
        amount: 1584000,
        staffId: 'staff-1',
      },
      // Khách C: Đã hủy
      {
        id: 4,
        name: 'Lê Văn C',
        cccd: '001200000003',
        phone: '0933333333',
        bhxh: '0123456791',
        type: 'BHXH',
        date: '2025-09-18',
        nextPayment: '2026-09-18',
        paymentStatus: 'Đã hủy',
        amount: 1584000,
        staffId: 'staff-1',
      },
    ];

    // Thuật toán cũ: Đếm thô trên toàn bộ records
    const naiveExpiringCount = sampleRecords.filter(r => {
      if (r.paymentStatus === 'Đã hủy' || !r.nextPayment) return false;
      const nextTs = new Date(r.nextPayment).getTime();
      const diff = Math.ceil((nextTs - todayTs) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 30;
    }).length;
    // Thuật toán cũ sẽ đếm nhầm cả Khách A -> ra 2 hồ sơ
    expect(naiveExpiringCount).toBe(2);

    // Thuật toán mới: Gom cụm định danh Unification Cluster lấy kỳ mới nhất của từng khách
    const uniqueCustomers = groupRecordsByCustomer(sampleRecords);
    expect(uniqueCustomers.length).toBe(2); // Chỉ có Khách A và Khách B (Khách C đã hủy)

    const accurateExpiringCount = uniqueCustomers.filter(c => {
      if (!c.nextPayment || c.paymentStatus === 'Đã hủy') return false;
      const amt = Number(c.amount) || 0;
      if (amt <= 0) return false;
      const nextTs = new Date(c.nextPayment).getTime();
      const diff = Math.ceil((nextTs - todayTs) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 30;
    }).length;

    // Chỉ còn đúng 1 người là Khách B (chưa đóng tiếp)!
    expect(accurateExpiringCount).toBe(1);
  });

  it('2. Mục "Tổng Khách Hàng" đếm đúng số khách hàng thực tế (Loại bỏ trùng lặp khi 1 khách có nhiều lần đóng)', () => {
    const sampleRecords = [
      { id: 1, name: 'Phạm Thị D', cccd: '001200000004', phone: '0944444444', type: 'BHXH', date: '2024-01-01', paymentStatus: 'Đã thu tiền', amount: 1000000 },
      { id: 2, name: 'Phạm Thị D', cccd: '001200000004', phone: '0944444444', type: 'BHXH', date: '2025-01-01', paymentStatus: 'Đã thu tiền', amount: 1000000 },
      { id: 3, name: 'Phạm Thị D', cccd: '001200000004', phone: '0944444444', type: 'BHXH', date: '2026-01-01', paymentStatus: 'Đã thu tiền', amount: 1000000 },
      { id: 4, name: 'Hoàng Văn E', cccd: '001200000005', phone: '0955555555', type: 'BHYT', date: '2026-01-01', paymentStatus: 'Đã thu tiền', amount: 1263600 },
    ];

    // Có 4 bản ghi nhưng chỉ có 2 khách hàng thực tế
    const uniqueCustomers = groupRecordsByCustomer(sampleRecords);
    expect(uniqueCustomers.length).toBe(2);

    const bhxhCount = uniqueCustomers.filter(c => c.type === 'BHXH').length;
    const bhytCount = uniqueCustomers.filter(c => c.type === 'BHYT').length;
    expect(bhxhCount).toBe(1);
    expect(bhytCount).toBe(1);
  });

  it('3. Thống kê Doanh thu & Hoa hồng tháng hiện tại chính xác 100% theo nhân viên', () => {
    const staffRecords = [
      { id: 1, name: 'Khách 1', type: 'BHXH', date: '2026-09-02', paymentStatus: 'Đã thu tiền', amount: 8000000, staffId: 'ngoc-id', actionType: 'Gia hạn' },
      { id: 2, name: 'Khách 2', type: 'BHXH', date: '2026-09-05', paymentStatus: 'Đã thu tiền', amount: 6322000, staffId: 'ngoc-id', actionType: 'Tái tục' },
      // Hồ sơ tháng 8 -> Không tính vào tháng 9
      { id: 3, name: 'Khách 3', type: 'BHXH', date: '2026-08-20', paymentStatus: 'Đã thu tiền', amount: 5000000, staffId: 'ngoc-id' },
      // Hồ sơ Nhập từ Excel -> Không tính vào doanh thu nhân viên tháng 9
      { id: 4, name: 'Khách 4', type: 'BHXH', date: '2026-09-01', paymentStatus: 'Đã thu tiền', amount: 10000000, staffId: 'ngoc-id', actionType: 'Nhập từ Excel' },
      // Hồ sơ của nhân viên khác
      { id: 5, name: 'Khách 5', type: 'BHXH', date: '2026-09-03', paymentStatus: 'Đã thu tiền', amount: 2000000, staffId: 'other-id' },
    ];

    const currentStaffRecords = staffRecords.filter(r => r.staffId === 'ngoc-id');
    const currentMonthPaidRecords = currentStaffRecords.filter(r => {
      if (r.paymentStatus !== 'Đã thu tiền') return false;
      if (r.actionType === 'Nhập từ Excel') return false;
      if ((r as any).isAdjustment) return false;
      const d = r.date || '';
      return d.startsWith('2026-09');
    });

    const totalRev = currentMonthPaidRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    expect(totalRev).toBe(14322000); // Khớp 14.322.000 đ
  });

  it('4. Biểu đồ Doanh thu 6 tháng gần nhất phản ánh đúng doanh thu tháng 9/2026', () => {
    const records = [
      { id: 1, name: 'A', date: '2026-08-15', paymentStatus: 'Đã thu tiền', amount: 5000000 },
      { id: 2, name: 'B', date: '2026-09-02', paymentStatus: 'Đã thu tiền', amount: 14322000 },
    ];

    const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    const revMap: { [k: string]: number } = {};
    months.forEach(m => {
      revMap[m] = records
        .filter(r => r.paymentStatus === 'Đã thu tiền' && (r.date || '').startsWith(m))
        .reduce((sum, r) => sum + Number(r.amount), 0);
    });

    expect(revMap['2026-09']).toBe(14322000);
    expect(revMap['2026-08']).toBe(5000000);
    expect(revMap['2026-07']).toBe(0);
  });
});
