import { describe, it, expect } from 'vitest';

interface RecordMock {
  id: number;
  name: string;
  type: 'BHXH' | 'BHYT';
  amount: number;
  date: string;
  isSubmittedBHXH: boolean;
  submissionBatch?: string;
  submittedDate?: string;
  actionType: string;
  paymentStatus: string;
  staffId?: string;
}

// Logic hàm tính toán availableBatches chuẩn hóa
function computeAvailableBatches(
  records: RecordMock[],
  type: 'BHXH' | 'BHYT',
  options: {
    effectiveStaffId?: string | null;
    startDateRPC?: string;
    endDateRPC?: string;
  }
) {
  const map = new Map<string, { count: number; totalAmount: number; date?: string | undefined }>();

  records
    .filter(r => {
      // 1. Đúng phân hệ BHXH / BHYT
      if (r.type !== type) return false;
      // 2. Phải là hồ sơ đã nộp và có tên đợt chuyển
      if (!r.isSubmittedBHXH || !r.submissionBatch) return false;
      // 3. Luôn loại trừ hồ sơ Nhập từ Excel
      if (r.actionType === 'Nhập từ Excel') return false;
      // 4. Loại trừ hồ sơ Đã hủy
      if (r.paymentStatus === 'Đã hủy') return false;
      // 5. Phân quyền nhân viên
      if (options.effectiveStaffId && r.staffId !== options.effectiveStaffId) return false;
      // 6. Đồng bộ theo khoảng thời gian đang lọc
      if (options.startDateRPC && options.endDateRPC) {
        if (!r.date) return false;
        const dStr = r.date.slice(0, 10);
        if (dStr < options.startDateRPC || dStr > options.endDateRPC) return false;
      }
      return true;
    })
    .forEach(r => {
      const batchKey = r.submissionBatch!.trim();
      const existing = map.get(batchKey) || { count: 0, totalAmount: 0, date: r.submittedDate };
      existing.count += 1;
      existing.totalAmount += (Number(r.amount) || 0);
      if (!existing.date && r.submittedDate) existing.date = r.submittedDate;
      map.set(batchKey, existing);
    });

  return Array.from(map.entries())
    .map(([batch, info]) => ({
      batch,
      count: info.count,
      totalAmount: info.totalAmount,
      date: info.date
    }))
    .sort((a, b) => a.batch.localeCompare(b.batch, undefined, { numeric: true }));
}

describe('Kiểm thử Tính chuẩn xác Thống kê Số lượng Hồ sơ theo Đợt Chuyển BHXH (Finance Batch Count Suite)', () => {
  // Bộ dữ liệu thực tế mô phỏng:
  // - Tháng 8: Đợt 1 có 5 hồ sơ, Đợt 2 có 1 hồ sơ
  // - Tháng 9: Đợt 1 có 15 hồ sơ, Đợt 2 có 11 hồ sơ
  const mockRecords: RecordMock[] = [];

  // 1. Tháng 8/2026: 5 hồ sơ Đợt 1
  for (let i = 1; i <= 5; i++) {
    mockRecords.push({
      id: 1000 + i,
      name: `Khách hàng Tháng 8 - Đợt 1 - ${i}`,
      type: 'BHXH',
      amount: 300000,
      date: '2026-08-15',
      isSubmittedBHXH: true,
      submissionBatch: 'Đợt 1',
      submittedDate: '2026-08-15',
      actionType: 'Gia hạn',
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-ngoc'
    });
  }

  // 2. Tháng 8/2026: 1 hồ sơ Đợt 2
  mockRecords.push({
    id: 1010,
    name: 'Khách hàng Tháng 8 - Đợt 2 - 1',
    type: 'BHXH',
    amount: 500000,
    date: '2026-08-30',
    isSubmittedBHXH: true,
    submissionBatch: 'Đợt 2',
    submittedDate: '2026-08-30',
    actionType: 'Gia hạn',
    paymentStatus: 'Đã thu tiền',
    staffId: 'staff-ngoc'
  });

  // 3. Tháng 9/2026: 15 hồ sơ Đợt 1
  for (let i = 1; i <= 15; i++) {
    mockRecords.push({
      id: 1100 + i,
      name: `Khách hàng Tháng 9 - Đợt 1 - ${i}`,
      type: 'BHXH',
      amount: 400000,
      date: '2026-09-05',
      isSubmittedBHXH: true,
      submissionBatch: 'Đợt 1',
      submittedDate: '2026-09-05',
      actionType: 'Gia hạn',
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-ngoc'
    });
  }

  // 4. Tháng 9/2026: 11 hồ sơ Đợt 2
  for (let i = 1; i <= 11; i++) {
    mockRecords.push({
      id: 1200 + i,
      name: `Khách hàng Tháng 9 - Đợt 2 - ${i}`,
      type: 'BHXH',
      amount: 600000,
      date: '2026-09-10',
      isSubmittedBHXH: true,
      submissionBatch: 'Đợt 2',
      submittedDate: '2026-09-10',
      actionType: 'Gia hạn',
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-ngoc'
    });
  }

  it('1. Khi chọn Tháng 09/2026: Đợt 2 hiển thị đúng 11 hồ sơ (Khớp 100% với bảng dữ liệu, không bị cộng 1 hồ sơ của tháng 8)', () => {
    const batches = computeAvailableBatches(mockRecords, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '2026-09-01',
      endDateRPC: '2026-09-30'
    });

    const batch2 = batches.find(b => b.batch === 'Đợt 2');
    expect(batch2).toBeDefined();
    expect(batch2!.count).toBe(11);
    expect(batch2!.date).toBe('2026-09-10');
  });

  it('2. Khi chọn Tháng 09/2026: Đợt 1 hiển thị đúng 15 hồ sơ (Không bị cộng 5 hồ sơ của tháng 8 thành 20)', () => {
    const batches = computeAvailableBatches(mockRecords, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '2026-09-01',
      endDateRPC: '2026-09-30'
    });

    const batch1 = batches.find(b => b.batch === 'Đợt 1');
    expect(batch1).toBeDefined();
    expect(batch1!.count).toBe(15);
    expect(batch1!.date).toBe('2026-09-05');
  });

  it('3. Khi chọn Tháng 08/2026: Hiển thị đúng Đợt 1 (5 hồ sơ) và Đợt 2 (1 hồ sơ)', () => {
    const batches = computeAvailableBatches(mockRecords, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '2026-08-01',
      endDateRPC: '2026-08-31'
    });

    const batch1 = batches.find(b => b.batch === 'Đợt 1');
    const batch2 = batches.find(b => b.batch === 'Đợt 2');
    expect(batch1?.count).toBe(5);
    expect(batch2?.count).toBe(1);
  });

  it('4. Khi chọn Tất cả thời gian: Đợt 1 cộng gộp đủ 20 hồ sơ, Đợt 2 cộng gộp đủ 12 hồ sơ', () => {
    const batches = computeAvailableBatches(mockRecords, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '',
      endDateRPC: ''
    });

    const batch1 = batches.find(b => b.batch === 'Đợt 1');
    const batch2 = batches.find(b => b.batch === 'Đợt 2');
    expect(batch1?.count).toBe(20);
    expect(batch2?.count).toBe(12);
  });

  it('5. Loại trừ đúng các hồ sơ "Nhập từ Excel" và "Đã hủy"', () => {
    const recordsWithExcelAndCancelled: RecordMock[] = [
      ...mockRecords,
      {
        id: 9991,
        name: 'Hồ sơ Excel rác',
        type: 'BHXH',
        amount: 500000,
        date: '2026-09-10',
        isSubmittedBHXH: true,
        submissionBatch: 'Đợt 2',
        submittedDate: '2026-09-10',
        actionType: 'Nhập từ Excel',
        paymentStatus: 'Đã thu tiền',
        staffId: 'staff-ngoc'
      },
      {
        id: 9992,
        name: 'Hồ sơ bị hủy/hoàn tiền',
        type: 'BHXH',
        amount: 500000,
        date: '2026-09-10',
        isSubmittedBHXH: true,
        submissionBatch: 'Đợt 2',
        submittedDate: '2026-09-10',
        actionType: 'Gia hạn',
        paymentStatus: 'Đã hủy',
        staffId: 'staff-ngoc'
      }
    ];

    const batches = computeAvailableBatches(recordsWithExcelAndCancelled, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '2026-09-01',
      endDateRPC: '2026-09-30'
    });

    const batch2 = batches.find(b => b.batch === 'Đợt 2');
    // Vẫn đúng 11 hồ sơ, không bị tính 2 hồ sơ không hợp lệ
    expect(batch2?.count).toBe(11);
  });

  it('6. Lọc chính xác theo Nhân viên (RBAC / Staff Filter)', () => {
    const recordsWithOtherStaff: RecordMock[] = [
      ...mockRecords,
      {
        id: 9993,
        name: 'Hồ sơ của cán bộ khác',
        type: 'BHXH',
        amount: 500000,
        date: '2026-09-10',
        isSubmittedBHXH: true,
        submissionBatch: 'Đợt 2',
        submittedDate: '2026-09-10',
        actionType: 'Gia hạn',
        paymentStatus: 'Đã thu tiền',
        staffId: 'staff-other'
      }
    ];

    // Staff Ngọc xem: Chỉ thấy 11 hồ sơ
    const ngocBatches = computeAvailableBatches(recordsWithOtherStaff, 'BHXH', {
      effectiveStaffId: 'staff-ngoc',
      startDateRPC: '2026-09-01',
      endDateRPC: '2026-09-30'
    });
    expect(ngocBatches.find(b => b.batch === 'Đợt 2')?.count).toBe(11);

    // Admin xem toàn cơ quan: Thấy 12 hồ sơ
    const adminBatches = computeAvailableBatches(recordsWithOtherStaff, 'BHXH', {
      effectiveStaffId: null,
      startDateRPC: '2026-09-01',
      endDateRPC: '2026-09-30'
    });
    expect(adminBatches.find(b => b.batch === 'Đợt 2')?.count).toBe(12);
  });

  describe('Tự động cập nhật Tổng Doanh Thu Đã Thu và Tổng Hoa Hồng khi lọc theo Đợt (Batch Stats Dynamic Sync)', () => {
    function computeBatchStats(
      records: any[],
      type: 'BHXH' | 'BHYT',
      options: {
        staffFilterParam: string;
        submittedFilter: string;
        startDateRPC?: string;
        endDateRPC?: string;
        commRatePct?: number;
      }
    ) {
      const commRate = options.commRatePct !== undefined ? options.commRatePct : 9; // Giả lập tỷ lệ 9%
      let filtered = records.filter((r: any) => r.type === type && r.actionType !== 'Nhập từ Excel');
      if (options.staffFilterParam !== 'all') {
        filtered = filtered.filter((r: any) => r.staffId === options.staffFilterParam);
      }
      if (options.submittedFilter === 'submitted') {
        filtered = filtered.filter((r: any) => r.isSubmittedBHXH === true);
      } else if (options.submittedFilter === 'unsubmitted') {
        filtered = filtered.filter((r: any) => !r.isSubmittedBHXH);
      } else if (options.submittedFilter.startsWith('batch_')) {
        const batchName = options.submittedFilter.replace('batch_', '');
        filtered = filtered.filter((r: any) => r.isSubmittedBHXH === true && r.submissionBatch === batchName);
      }

      if (options.startDateRPC && options.endDateRPC) {
        filtered = filtered.filter((r: any) => {
          if (!r.date) return false;
          const dStr = r.date.slice(0, 10);
          return dStr >= options.startDateRPC! && dStr <= options.endDateRPC!;
        });
      }

      const paidRecs = filtered.filter((r: any) => r.paymentStatus === 'Đã thu tiền');
      const pendingRecs = filtered.filter((r: any) => r.paymentStatus === 'Chờ thanh toán');

      const rev = paidRecs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      const pending = pendingRecs.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      const comm = paidRecs.reduce((sum: number, r: any) => sum + ((Number(r.amount) || 0) * commRate / 100), 0);

      return { totalRev: rev, totalPending: pending, totalComm: comm, count: filtered.length };
    }

    it('7. Khi lọc theo Đợt 1: Doanh thu và Hoa hồng tự động tính chính xác theo 15 hồ sơ của Đợt 1', () => {
      const stats = computeBatchStats(mockRecords, 'BHXH', {
        staffFilterParam: 'staff-ngoc',
        submittedFilter: 'batch_Đợt 1',
        startDateRPC: '2026-09-01',
        endDateRPC: '2026-09-30',
        commRatePct: 9
      });

      // 15 hồ sơ * 400.000 = 6.000.000 đ
      expect(stats.count).toBe(15);
      expect(stats.totalRev).toBe(6000000);
      // Hoa hồng 9% * 6.000.000 = 540.000 đ
      expect(stats.totalComm).toBe(540000);
      expect(stats.totalPending).toBe(0);
    });

    it('8. Khi lọc theo Đợt 2: Doanh thu và Hoa hồng tự động thay đổi theo 11 hồ sơ của Đợt 2', () => {
      const stats = computeBatchStats(mockRecords, 'BHXH', {
        staffFilterParam: 'staff-ngoc',
        submittedFilter: 'batch_Đợt 2',
        startDateRPC: '2026-09-01',
        endDateRPC: '2026-09-30',
        commRatePct: 9
      });

      // 11 hồ sơ * 600.000 = 6.600.000 đ
      expect(stats.count).toBe(11);
      expect(stats.totalRev).toBe(6600000);
      // Hoa hồng 9% * 6.600.000 = 594.000 đ
      expect(stats.totalComm).toBe(594000);
      expect(stats.totalPending).toBe(0);
    });

    it('9. Khi chọn Tất cả chuyển BHXH: Doanh thu và Hoa hồng tính tổng toàn bộ cả 2 đợt trong tháng', () => {
      const stats = computeBatchStats(mockRecords, 'BHXH', {
        staffFilterParam: 'staff-ngoc',
        submittedFilter: 'all',
        startDateRPC: '2026-09-01',
        endDateRPC: '2026-09-30',
        commRatePct: 9
      });

      // 15 hồ sơ Đợt 1 (6.000.000) + 11 hồ sơ Đợt 2 (6.600.000) = 26 hồ sơ (12.600.000 đ)
      expect(stats.count).toBe(26);
      expect(stats.totalRev).toBe(12600000);
      expect(stats.totalComm).toBe(1134000);
    });

    it('10. Nhãn Badge trên thẻ thống kê phản ánh đúng tên Đợt đang chọn', () => {
      const getBadgeLabel = (_periodFilter: string, monthVal: string, submittedFilter?: string) => {
        let periodLabel = `Tháng ${monthVal}`;
        if (submittedFilter && submittedFilter !== 'all') {
          if (submittedFilter.startsWith('batch_')) {
            return submittedFilter.replace('batch_', '');
          } else if (submittedFilter === 'submitted') {
            return `${periodLabel} • Đã chuyển`;
          } else if (submittedFilter === 'unsubmitted') {
            return `${periodLabel} • Chưa chuyển`;
          }
        }
        return periodLabel;
      };

      expect(getBadgeLabel('month', '09/2026', 'batch_Đợt 1 (09/09/2026)')).toBe('Đợt 1 (09/09/2026)');
      expect(getBadgeLabel('month', '09/2026', 'batch_Đợt 2 (10/09/2026)')).toBe('Đợt 2 (10/09/2026)');
      expect(getBadgeLabel('month', '09/2026', 'all')).toBe('Tháng 09/2026');
      expect(getBadgeLabel('month', '09/2026', 'submitted')).toBe('Tháng 09/2026 • Đã chuyển');
    });
  });
});
