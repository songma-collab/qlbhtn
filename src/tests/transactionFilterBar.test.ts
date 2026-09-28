import { describe, it, expect } from 'vitest';
import {
  TransactionFilterState,
  getDefaultTransactionFilterState,
  filterTransactionRecords,
  computeTransactionKPIs,
  matchesTransactionSearch,
  toPeriodFilterValue,
  fromPeriodFilterValue,
  getTransactionDateRange
} from '../utils/transactionFilters';

describe('Kiểm thử Thanh công cụ lọc & Thẻ KPI 1-chạm (Transaction Filter Bar & KPI)', () => {
  const mockRecords = [
    {
      id: 1,
      name: 'Nguyễn Văn An',
      type: 'BHXH',
      amount: 1500000,
      date: '2026-09-10',
      paymentStatus: 'Đã thu tiền',
      isSubmittedBHXH: true,
      submissionBatch: 'BATCH_20260915_01',
      actionType: 'Đăng ký mới',
      staffId: 'staff_1',
      cccd: '001200001111',
      bhxh: '7912345678',
      phone: '0901234567'
    },
    {
      id: 2,
      name: 'Trần Thị Bình',
      type: 'BHXH',
      amount: 2000000,
      date: '2026-09-12',
      paymentStatus: 'Đã thu tiền',
      isSubmittedBHXH: false, // Chưa nộp cơ quan BHXH
      submissionBatch: null,
      actionType: 'Gia hạn',
      staffId: 'staff_1',
      cccd: '001200002222',
      bhxh: '7912345679',
      phone: '0902345678'
    },
    {
      id: 3,
      name: 'Lê Hoàng Cường',
      type: 'BHXH',
      amount: 1200000,
      date: '2026-09-14',
      paymentStatus: 'Chờ thanh toán',
      isSubmittedBHXH: false,
      submissionBatch: null,
      actionType: 'Đăng ký mới',
      staffId: 'staff_2',
      cccd: '001200003333',
      bhxh: '7912345680',
      phone: '0903456789'
    },
    {
      id: 4,
      name: 'Phạm Minh Đức',
      type: 'BHXH',
      amount: 3000000,
      date: '2026-09-15',
      paymentStatus: 'Đã thu tiền',
      isSubmittedBHXH: true,
      submissionBatch: 'BATCH_20260915_02',
      actionType: 'Gia hạn',
      staffId: 'staff_2',
      cccd: '001200004444',
      bhxh: '7912345681',
      phone: '0904567890'
    },
    {
      id: 5,
      name: 'Hoàng Lan Em',
      type: 'BHXH',
      amount: 1800000,
      date: '2026-09-16',
      paymentStatus: 'Đã hủy', // Hồ sơ đã hủy - PHẢI BỊ LOẠI TRỪ
      isSubmittedBHXH: false,
      actionType: 'Đăng ký mới',
      staffId: 'staff_1',
      cccd: '001200005555'
    },
    {
      id: 6,
      name: 'Đặng Tuấn Kiệt',
      type: 'BHXH',
      amount: 900000,
      date: '2026-09-17',
      paymentStatus: 'Chờ thanh toán',
      isSubmittedBHXH: false,
      actionType: 'Gia hạn',
      staffId: 'staff_1',
      cccd: '001200006666'
    }
  ];

  // Test 1: Click chọn Thẻ KPI "Chờ thanh toán" chỉ hiển thị các bản ghi có paymentStatus === 'Chờ thanh toán'
  it('Test 1: Click chọn Thẻ KPI "Chờ thanh toán" chỉ hiển thị các bản ghi có paymentStatus === "Chờ thanh toán"', () => {
    const filterState: TransactionFilterState = {
      ...getDefaultTransactionFilterState('2026-09-17'),
      kpiQuickFilter: 'PENDING'
    };

    const results = filterTransactionRecords(mockRecords, filterState, { type: 'BHXH' });

    expect(results.length).toBe(2);
    expect(results.every(r => r.paymentStatus === 'Chờ thanh toán')).toBe(true);
    expect(results.map(r => r.id)).toEqual([3, 6]);
  });

  // Test 2: Chọn "Chưa chuyển BHXH" lọc đúng các bản ghi đã thu tiền nhưng isSubmittedBHXH !== true
  it('Test 2: Chọn "Chưa chuyển BHXH" lọc đúng các bản ghi đã thu tiền nhưng isSubmittedBHXH !== true', () => {
    const filterState: TransactionFilterState = {
      ...getDefaultTransactionFilterState('2026-09-17'),
      submissionStatus: 'UNSUBMITTED'
    };

    const results = filterTransactionRecords(mockRecords, filterState, { type: 'BHXH' });

    // Chỉ có bản ghi id=2 là Đã thu tiền nhưng chưa nộp BHXH.
    // id=3 và id=6 là "Chờ thanh toán" nên không được tính vào hàng đợi gom nộp đợt mới.
    // id=5 là "Đã hủy" nên bị loại trừ.
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(2);
    expect(results[0].paymentStatus).toBe('Đã thu tiền');
    expect(results[0].isSubmittedBHXH).toBeFalsy();
  });

  // Test 3: Lọc theo một mã đợt nộp cụ thể (submissionBatch = 'BATCH_20260915_01') trả về chính xác danh sách thuộc đợt đó
  it('Test 3: Lọc theo một mã đợt nộp cụ thể (submissionBatch = "BATCH_20260915_01") trả về chính xác danh sách thuộc đợt đó', () => {
    const filterState: TransactionFilterState = {
      ...getDefaultTransactionFilterState('2026-09-17'),
      submissionStatus: 'BATCH_20260915_01'
    };

    const results = filterTransactionRecords(mockRecords, filterState, { type: 'BHXH' });

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(1);
    expect(results[0].submissionBatch).toBe('BATCH_20260915_01');
    expect(results[0].isSubmittedBHXH).toBe(true);

    // Cũng hỗ trợ tiền tố 'batch_BATCH_20260915_01' từ dropdown
    const filterStatePrefix: TransactionFilterState = {
      ...getDefaultTransactionFilterState('2026-09-17'),
      submissionStatus: 'batch_BATCH_20260915_01'
    };
    const resultsPrefix = filterTransactionRecords(mockRecords, filterStatePrefix, { type: 'BHXH' });
    expect(resultsPrefix.length).toBe(1);
    expect(resultsPrefix[0].id).toBe(1);
  });

  // Test 4: Thao tác Reset Filter đưa toàn bộ danh sách và KPI về trạng thái ban đầu
  it('Test 4: Thao tác Reset Filter đưa toàn bộ danh sách và KPI về trạng thái ban đầu', () => {
    // Ban đầu người dùng áp dụng nhiều bộ lọc: tìm kiếm, đợt nộp, KPI
    const dirtyFilter: TransactionFilterState = {
      kpiQuickFilter: 'PENDING',
      searchQuery: 'Hoàng Cường',
      submissionStatus: 'UNSUBMITTED',
      staffId: 'staff_2',
      periodType: 'CUSTOM',
      selectedMonth: '2026-08',
      customStartDate: '2026-08-01',
      customEndDate: '2026-08-31'
    };

    const dirtyResults = filterTransactionRecords(mockRecords, dirtyFilter, { type: 'BHXH' });
    expect(dirtyResults.length).toBe(0);

    // Thực hiện thao tác Reset bộ lọc
    const resetFilter = getDefaultTransactionFilterState('2026-09-17');
    expect(resetFilter.kpiQuickFilter).toBe('ALL');
    expect(resetFilter.searchQuery).toBe('');
    expect(resetFilter.submissionStatus).toBe('ALL');
    expect(resetFilter.staffId).toBe('ALL');
    expect(resetFilter.periodType).toBe('MONTH');
    expect(resetFilter.selectedMonth).toBe('2026-09');

    // Kiểm tra kết quả sau Reset
    const kpi = computeTransactionKPIs(mockRecords, resetFilter, { type: 'BHXH' });

    // Các bản ghi hợp lệ trong tháng 9 (id 1, 2, 3, 4, 6 - loại trừ id 5 đã hủy):
    expect(kpi.finalFiltered.length).toBe(5);

    // Tổng doanh thu đã thu: 1.500.000 (id 1) + 2.000.000 (id 2) + 3.000.000 (id 4) = 6.500.000
    expect(kpi.totalRev).toBe(6500000);

    // Tổng chờ thanh toán: 1.200.000 (id 3) + 900.000 (id 6) = 2.100.000
    expect(kpi.totalPending).toBe(2100000);

    // Tổng hoa hồng được tính chuẩn xác
    expect(kpi.totalComm).toBeGreaterThan(0);
  });

  // Test mở rộng: Tìm kiếm thông minh với chuẩn hóa số điện thoại, CCCD và Mã BHXH
  it('Khớp nối tìm kiếm thông minh đa trường (Tên, CCCD, Mã BHXH, SĐT)', () => {
    expect(matchesTransactionSearch(mockRecords[0], 'nguyễn văn')).toBe(true);
    expect(matchesTransactionSearch(mockRecords[0], '0012 0000 1111')).toBe(true);
    expect(matchesTransactionSearch(mockRecords[0], '7912345678')).toBe(true);
    expect(matchesTransactionSearch(mockRecords[0], '090.123.4567')).toBe(true);
    expect(matchesTransactionSearch(mockRecords[0], '999999999')).toBe(false);
  });

  // Test 5: Bộ điều khiển Thời gian Tác nghiệp (AccountingPeriodController & PeriodFilterValue)
  describe('Khối 4: Bộ điều khiển Thời gian Tác nghiệp (AccountingPeriodController)', () => {
    it('Chuyển đổi 2 chiều giữa TransactionFilterState và PeriodFilterValue', () => {
      // 1. Chế độ MONTH
      const filterMonth = getDefaultTransactionFilterState('2026-09-17');
      const valMonth = toPeriodFilterValue(filterMonth);
      expect(valMonth.mode).toBe('MONTH');
      expect(valMonth.selectedMonth).toBe('2026-09');

      const mappedBackMonth = fromPeriodFilterValue(valMonth);
      expect(mappedBackMonth.periodType).toBe('MONTH');
      expect(mappedBackMonth.selectedMonth).toBe('2026-09');

      // 2. Chế độ RANGE
      const valRange = {
        mode: 'RANGE' as const,
        selectedMonth: '2026-09',
        startDate: '2026-09-01',
        endDate: '2026-09-15'
      };
      const mappedBackRange = fromPeriodFilterValue(valRange);
      expect(mappedBackRange.periodType).toBe('RANGE');
      expect(mappedBackRange.startDate).toBe('2026-09-01');
      expect(mappedBackRange.endDate).toBe('2026-09-15');
      expect(mappedBackRange.customStartDate).toBe('2026-09-01');
      expect(mappedBackRange.customEndDate).toBe('2026-09-15');

      // 3. Chế độ ALL
      const valAll = {
        mode: 'ALL' as const,
        selectedMonth: '2026-09'
      };
      const mappedBackAll = fromPeriodFilterValue(valAll);
      expect(mappedBackAll.periodType).toBe('ALL');
    });

    it('Chế độ Theo Tháng (MONTH): Liên kết chặt chẽ với Invariant 2 Khóa kỳ tài chính (currentKey = month_MM/YYYY)', () => {
      const filter: TransactionFilterState = {
        ...getDefaultTransactionFilterState('2026-09-17'),
        selectedMonth: '2026-08'
      };

      const range = getTransactionDateRange(filter);
      expect(range.startDate).toBe('2026-08-01');
      expect(range.endDate).toBe('2026-08-31');
      expect(range.periodLabel).toBe('Tháng 08/2026');
      expect(range.currentKey).toBe('month_08/2026');

      // Khi đổi sang tháng 9/2026:
      const filterSep: TransactionFilterState = {
        ...getDefaultTransactionFilterState('2026-09-17'),
        selectedMonth: '2026-09'
      };
      const rangeSep = getTransactionDateRange(filterSep);
      expect(rangeSep.periodLabel).toBe('Tháng 09/2026');
      expect(rangeSep.currentKey).toBe('month_09/2026');
    });

    it('Chế độ Khoảng Ngày (RANGE): Lọc chính xác các bản ghi và không sinh currentKey khóa sổ', () => {
      const filterRange: TransactionFilterState = {
        ...getDefaultTransactionFilterState('2026-09-17'),
        periodType: 'RANGE',
        startDate: '2026-09-10',
        endDate: '2026-09-12'
      };

      const range = getTransactionDateRange(filterRange);
      expect(range.periodLabel).toBe('10/09/2026 - 12/09/2026');
      expect(range.currentKey).toBe(''); // Khoảng ngày tự do không có khóa kỳ cố định

      const filtered = filterTransactionRecords(mockRecords, filterRange, { type: 'BHXH' });
      // Chỉ có id 1 (2026-09-10) và id 2 (2026-09-12) nằm trong khoảng ngày này
      expect(filtered.map(r => r.id)).toEqual([1, 2]);
    });

    it('Chế độ Tất Cả (ALL): Hiển thị tất cả bản ghi hợp lệ trên toàn hệ thống', () => {
      const filterAll: TransactionFilterState = {
        ...getDefaultTransactionFilterState('2026-09-17'),
        periodType: 'ALL'
      };

      const range = getTransactionDateRange(filterAll);
      expect(range.periodLabel).toBe('Toàn bộ thời gian');
      expect(range.currentKey).toBe('');

      const filtered = filterTransactionRecords(mockRecords, filterAll, { type: 'BHXH' });
      // Tất cả 5 bản ghi hợp lệ (loại trừ id 5 đã hủy)
      expect(filtered.length).toBe(5);
    });
  });
});
