import { describe, it, expect } from 'vitest';

describe('Kiểm thử Thống kê Dashboard (Recharts Data Mapping)', () => {
  const sampleRecords = [
    {
      id: 1,
      name: 'Nguyễn Văn A',
      cccd: '001200000001',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      date: '2026-09-02',
      status: 'Đã hoàn thành',
      paymentStatus: 'Đã thu tiền',
      amount: 1584000,
      isSubmittedBHXH: true
    },
    {
      id: 2,
      name: 'Trần Thị B',
      cccd: '001200000002',
      type: 'BHXH',
      actionType: 'Gia hạn',
      date: '2026-09-05',
      status: 'Đã hoàn thành',
      paymentStatus: 'Đã thu tiền',
      amount: 3168000,
      isSubmittedBHXH: true
    },
    {
      id: 3,
      name: 'Lê Văn C',
      cccd: '001200000003',
      type: 'BHYT',
      actionType: 'Đăng ký mới',
      date: '2026-09-10',
      status: 'Chờ xử lý',
      paymentStatus: 'Đã thu tiền',
      amount: 1263600,
      isSubmittedBHXH: false
    },
    {
      id: 4,
      name: 'Phạm Thị D',
      cccd: '001200000004',
      type: 'BHYT',
      actionType: 'Tái tục thẻ',
      date: '2026-09-12',
      status: 'Chờ nộp',
      paymentStatus: 'Đã thu tiền',
      amount: 1263600,
      isSubmittedBHXH: false,
      submissionBatch: 'DOT-202609-01'
    },
    {
      id: 5,
      name: 'Hoàng Văn E',
      cccd: '001200000005',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      date: '2026-09-15',
      status: 'Chờ xử lý',
      paymentStatus: 'Chờ thanh toán',
      amount: 2000000,
      isSubmittedBHXH: false
    },
    {
      id: 6,
      name: 'Vũ Thị F',
      cccd: '001200000006',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      date: '2026-09-18',
      status: 'Đã hủy',
      paymentStatus: 'Đã hủy',
      amount: 1584000,
      isSubmittedBHXH: false
    },
    // Bản ghi nhập Excel -> Phải bị loại trừ
    {
      id: 7,
      name: 'Bản ghi Excel G',
      type: 'BHXH',
      actionType: 'Nhập từ Excel',
      date: '2026-09-01',
      status: 'Đã hoàn thành',
      paymentStatus: 'Đã thu tiền',
      amount: 5000000
    }
  ];

  it('1. Phân loại chuẩn xác Hồ sơ mới và Hồ sơ gia hạn trong tháng 09/2026', () => {
    const isRenew = (r: any) => {
      const act = String(r.actionType || '').toLowerCase();
      return act.includes('gia hạn') || act.includes('tái tục') || act.includes('đóng tiếp');
    };

    const monthRecords = sampleRecords.filter(r => {
      if (r.actionType === 'Nhập từ Excel') return false;
      return (r.date || '').startsWith('2026-09');
    });

    const newRecords = monthRecords.filter(r => !isRenew(r));
    const renewRecords = monthRecords.filter(r => isRenew(r));

    expect(newRecords.length).toBe(4); // A, C, E, F
    expect(renewRecords.length).toBe(2); // B, D
    expect(monthRecords.length).toBe(6); // Tổng 6 hồ sơ (loại bỏ Excel G)
  });

  it('2. Thống kê đúng 5 nhóm trạng thái xử lý trong tháng cho biểu đồ Recharts Donut', () => {
    const monthRecords = sampleRecords.filter(r => {
      if (r.actionType === 'Nhập từ Excel') return false;
      return (r.date || '').startsWith('2026-09');
    });

    let countCompleted = 0;
    let countProcessing = 0;
    let countPendingSubmit = 0;
    let countPendingPayment = 0;
    let countCancelled = 0;

    monthRecords.forEach(r => {
      if (r.paymentStatus === 'Đã hủy' || r.status === 'Đã hủy') {
        countCancelled++;
      } else if (r.paymentStatus === 'Chờ thanh toán' || r.paymentStatus === 'Chưa thu tiền') {
        countPendingPayment++;
      } else if (r.status === 'Đã hoàn thành' || r.status === 'Đã duyệt' || r.isSubmittedBHXH) {
        countCompleted++;
      } else if (r.status === 'Chờ nộp' || (!r.isSubmittedBHXH && r.submissionBatch)) {
        countPendingSubmit++;
      } else {
        countProcessing++;
      }
    });

    expect(countCompleted).toBe(2); // A, B
    expect(countPendingSubmit).toBe(1); // D (submissionBatch & chưa nộp)
    expect(countPendingPayment).toBe(1); // E
    expect(countCancelled).toBe(1); // F
    expect(countProcessing).toBe(1); // C (Đã thu tiền, đang chờ duyệt)

    // Tỷ lệ hoàn tất = 2 / 6 = 33%
    const completionRate = Math.round((countCompleted / monthRecords.length) * 100);
    expect(completionRate).toBe(33);
  });
});
