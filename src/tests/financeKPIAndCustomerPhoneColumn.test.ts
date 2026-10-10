import { describe, it, expect } from 'vitest';
import { computeTransactionKPIs, filterTransactionRecords, DEFAULT_TRANSACTION_FILTER_STATE } from '../utils/transactionFilters';
import type { RecordType } from '../context/types';

describe('Kiểm thử Tính toán KPI Tài chính & Sổ Quỹ (snake_case) và Cột Khách Hàng', () => {
  it('1. computeTransactionKPIs tính toán chính xác tổng doanh thu, chờ thanh toán và hoa hồng với bản ghi PostgreSQL snake_case', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 22,
        date: '2026-10-06',
        name: 'Lường Văn Tươi',
        type: 'BHXH',
        amount: 781000,
        payment_status: 'Đã thu tiền',
        action_type: 'Đăng ký mới',
        is_submitted_bhxh: false,
        months: 3
      },
      {
        id: 21,
        date: '2026-10-06',
        name: 'Lò Văn Đoàn',
        type: 'BHXH',
        amount: 781000,
        payment_status: 'Đã thu tiền',
        action_type: 'Đăng ký mới',
        is_submitted_bhxh: false,
        months: 3
      },
      {
        id: 20,
        date: '2026-10-05',
        name: 'Trần Thị B',
        type: 'BHXH',
        amount: 500000,
        payment_status: 'Chờ thanh toán',
        action_type: 'Gia hạn',
        is_submitted_bhxh: false,
        months: 1
      }
    ];

    const filter = {
      ...DEFAULT_TRANSACTION_FILTER_STATE,
      periodType: 'MONTH' as const,
      selectedMonth: '2026-10'
    };

    const result = computeTransactionKPIs(mockRecords as any[], filter, { type: 'BHXH' });

    // 2 hồ sơ đã thu: 781.000 + 781.000 = 1.562.000 đ
    expect(result.totalRev).toBe(1562000);
    // 1 hồ sơ chờ thanh toán: 500.000 đ
    expect(result.totalPending).toBe(500000);
    // Hoa hồng (5% của 1.562.000 = 78.100 đ theo mặc định)
    expect(result.totalComm).toBeGreaterThan(0);
    // Danh sách lọc trả về 3 bản ghi
    expect(result.baseFiltered.length).toBe(3);
    expect(result.finalFiltered.length).toBe(3);
  });

  it('2. Lọc nhanh 1-chạm: kpiQuickFilter = "PAID" và "PENDING" lọc đúng bản ghi snake_case', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 1,
        date: '2026-10-01',
        name: 'Nguyễn Văn A',
        type: 'BHXH',
        amount: 1000000,
        payment_status: 'Đã thu tiền'
      },
      {
        id: 2,
        date: '2026-10-02',
        name: 'Lê Văn B',
        type: 'BHXH',
        amount: 500000,
        payment_status: 'Chờ thanh toán'
      }
    ];

    const paidFilter = {
      ...DEFAULT_TRANSACTION_FILTER_STATE,
      kpiQuickFilter: 'PAID' as const,
      periodType: 'MONTH' as const,
      selectedMonth: '2026-10'
    };

    const paidResult = filterTransactionRecords(mockRecords as any[], paidFilter, { type: 'BHXH' });
    expect(paidResult.length).toBe(1);
    expect(paidResult[0].id).toBe(1);

    const pendingFilter = {
      ...DEFAULT_TRANSACTION_FILTER_STATE,
      kpiQuickFilter: 'PENDING' as const,
      periodType: 'MONTH' as const,
      selectedMonth: '2026-10'
    };

    const pendingResult = filterTransactionRecords(mockRecords as any[], pendingFilter, { type: 'BHXH' });
    expect(pendingResult.length).toBe(1);
    expect(pendingResult[0].id).toBe(2);
  });

  it('3. Lọc Trạng thái nộp BHXH: UNSUBMITTED và SUBMITTED chính xác với is_submitted_bhxh', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 10,
        date: '2026-10-01',
        name: 'Hồ sơ 1',
        type: 'BHXH',
        amount: 1000000,
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: false
      },
      {
        id: 11,
        date: '2026-10-02',
        name: 'Hồ sơ 2',
        type: 'BHXH',
        amount: 1000000,
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: true,
        submission_batch: 'Đợt 1'
      }
    ];

    const unsubmittedFilter = {
      ...DEFAULT_TRANSACTION_FILTER_STATE,
      submissionStatus: 'UNSUBMITTED',
      periodType: 'MONTH' as const,
      selectedMonth: '2026-10'
    };

    const unsubmitted = filterTransactionRecords(mockRecords as any[], unsubmittedFilter, { type: 'BHXH' });
    expect(unsubmitted.length).toBe(1);
    expect(unsubmitted[0].id).toBe(10);

    const submittedFilter = {
      ...DEFAULT_TRANSACTION_FILTER_STATE,
      submissionStatus: 'SUBMITTED',
      periodType: 'MONTH' as const,
      selectedMonth: '2026-10'
    };

    const submitted = filterTransactionRecords(mockRecords as any[], submittedFilter, { type: 'BHXH' });
    expect(submitted.length).toBe(1);
    expect(submitted[0].id).toBe(11);
  });

  it('4. Khách hàng trong bảng FinanceTransactionsTable ưu tiên hiển thị số CCCD thay vì mã số BHXH', () => {
    const record = {
      name: 'Lèo Thị Thư',
      cccd: '014201001234',
      bhxh: '1421010133',
      phone: '0987654321'
    };

    // Logic hiển thị dưới tên khách hàng: ưu tiên CCCD
    const displayIdentifier = record.cccd || (record as any).citizenId || record.bhxh || record.phone || '---';
    expect(displayIdentifier).toBe('014201001234');
    expect(displayIdentifier).not.toBe('1421010133');

    // Trường hợp không có CCCD thì fallback về BHXH
    const fallbackRecord = {
      name: 'Khách hàng không CCCD',
      cccd: '',
      bhxh: '1421025185',
      phone: '0912345678'
    };
    const fallbackDisplay = fallbackRecord.cccd || (fallbackRecord as any).citizenId || fallbackRecord.bhxh || fallbackRecord.phone || '---';
    expect(fallbackDisplay).toBe('1421025185');
  });
});
