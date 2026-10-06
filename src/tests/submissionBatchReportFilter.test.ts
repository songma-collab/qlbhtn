import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';
import {
  getDefaultPeriodState,
  isDateInSubmissionPeriod,
  batchMatchesPeriod,
  calculateBatchKPIs,
  getPeriodDisplayLabel,
  stepMonth,
  groupRecordsIntoBatches,
  type BatchDetailData
} from '../utils/submissionBatchFilters';

describe('Kiểm thử Bộ lọc Thời gian (Tháng / Quý / Năm) cho Báo Cáo Đợt Chuyển BHXH & BHYT', () => {
  it('1. Trạng thái mặc định phải là Tháng hiện tại của lịch hệ thống', () => {
    const fixedNow = new Date('2026-09-22T12:00:00Z');
    const state = getDefaultPeriodState(fixedNow);

    expect(state.periodMode).toBe('MONTH');
    expect(state.selectedMonth).toBe('2026-09');
    expect(state.selectedQuarter).toBe(3);
    expect(state.selectedYear).toBe(2026);
  });

  it('2. Kiểm tra hàm stepMonth lùi/tiến tháng chính xác qua giao thừa năm', () => {
    expect(stepMonth('2026-09', 'prev')).toBe('2026-08');
    expect(stepMonth('2026-09', 'next')).toBe('2026-10');
    expect(stepMonth('2026-01', 'prev')).toBe('2025-12');
    expect(stepMonth('2026-12', 'next')).toBe('2027-01');
  });

  it('3. Kiểm tra nhãn hiển thị kỳ báo cáo (getPeriodDisplayLabel)', () => {
    expect(getPeriodDisplayLabel('MONTH', '2026-09', 3, 2026)).toBe('Tháng 09/2026');
    expect(getPeriodDisplayLabel('QUARTER', '2026-09', 3, 2026)).toBe('Quý 3/2026');
    expect(getPeriodDisplayLabel('YEAR', '2026-09', 3, 2026)).toBe('Năm 2026');
    expect(getPeriodDisplayLabel('ALL', '2026-09', 3, 2026)).toBe('Toàn bộ thời gian');
  });

  it('4. Kiểm tra đối soát ngày theo Tháng, Quý, Năm (isDateInSubmissionPeriod)', () => {
    // Tháng 09/2026
    expect(isDateInSubmissionPeriod('2026-09-15', 'MONTH', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2026-08-31', 'MONTH', '2026-09', 3, 2026)).toBe(false);

    // Quý 3/2026 (Tháng 7, 8, 9)
    expect(isDateInSubmissionPeriod('2026-07-01', 'QUARTER', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2026-08-15', 'QUARTER', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2026-09-30', 'QUARTER', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2026-10-01', 'QUARTER', '2026-09', 3, 2026)).toBe(false);
    expect(isDateInSubmissionPeriod('2025-08-15', 'QUARTER', '2026-09', 3, 2026)).toBe(false);

    // Năm 2026
    expect(isDateInSubmissionPeriod('2026-01-01', 'YEAR', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2026-12-31', 'YEAR', '2026-09', 3, 2026)).toBe(true);
    expect(isDateInSubmissionPeriod('2025-12-31', 'YEAR', '2026-09', 3, 2026)).toBe(false);

    // Toàn thời gian
    expect(isDateInSubmissionPeriod('2024-05-10', 'ALL', '2026-09', 3, 2026)).toBe(true);
  });

  it('5. Kiểm tra đợt nộp khớp kỳ: đợt đã nộp (submittedDate) và đợt tồn đọng (records.date)', () => {
    const submittedBatch: BatchDetailData = {
      batchKey: 'BATCH_1',
      batchName: 'Đợt 1',
      submittedDate: '2026-09-10',
      isSubmitted: true,
      totalRecords: 2,
      totalAmount: 2000000,
      bhxhCount: 2,
      bhytCount: 0,
      participatingStaffCount: 1,
      records: []
    };

    const pendingBatch: BatchDetailData = {
      batchKey: 'BATCH_PENDING',
      batchName: 'Chưa nộp',
      submittedDate: 'Chưa nộp',
      isSubmitted: false,
      totalRecords: 1,
      totalAmount: 1000000,
      bhxhCount: 1,
      bhytCount: 0,
      participatingStaffCount: 1,
      records: [
        {
          id: 10,
          name: 'Nguyễn Văn A',
          date: '2026-09-05',
          type: 'BHXH',
          amount: 1000000,
          months: 6,
          status: 'Hoạt động',
          payment_status: 'Đã thu tiền',
          phone: '0981111222'
        } as RecordType
      ]
    };

    // Khớp Tháng 09/2026
    expect(batchMatchesPeriod(submittedBatch, 'MONTH', '2026-09', 3, 2026)).toBe(true);
    expect(batchMatchesPeriod(pendingBatch, 'MONTH', '2026-09', 3, 2026)).toBe(true);

    // Không khớp Tháng 08/2026
    expect(batchMatchesPeriod(submittedBatch, 'MONTH', '2026-08', 3, 2026)).toBe(false);
    expect(batchMatchesPeriod(pendingBatch, 'MONTH', '2026-08', 3, 2026)).toBe(false);

    // Khớp Quý 3/2026 và Năm 2026
    expect(batchMatchesPeriod(submittedBatch, 'QUARTER', '2026-09', 3, 2026)).toBe(true);
    expect(batchMatchesPeriod(submittedBatch, 'YEAR', '2026-09', 3, 2026)).toBe(true);
  });

  it('6. Kiểm tra tính toán KPI đồng bộ chính xác theo từng kỳ thời gian', () => {
    const mockRecords: RecordType[] = [
      // Tháng 8/2026: 1 đợt nộp 1.500.000đ
      {
        id: 1,
        name: 'Nguyễn Văn Tám',
        phone: '0981111222',
        date: '2026-08-10',
        type: 'BHXH',
        amount: 1500000,
        months: 6,
        status: 'Hoạt động',
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: true,
        submission_batch: 'BATCH_AUG_01',
        submitted_date: '2026-08-15'
      },
      // Tháng 9/2026: 2 đợt nộp (1 đợt 2tr, 1 đợt 3tr) + 1 hồ sơ chưa nộp (500k)
      {
        id: 2,
        name: 'Trần Văn Chín A',
        phone: '0981111222',
        date: '2026-09-01',
        type: 'BHXH',
        amount: 2000000,
        months: 6,
        status: 'Hoạt động',
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: true,
        submission_batch: 'BATCH_SEP_01',
        submitted_date: '2026-09-05'
      },
      {
        id: 3,
        name: 'Trần Văn Chín B',
        phone: '0981111222',
        date: '2026-09-10',
        type: 'BHYT',
        amount: 3000000,
        months: 12,
        status: 'Hoạt động',
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: true,
        submission_batch: 'BATCH_SEP_02',
        submitted_date: '2026-09-12'
      },
      {
        id: 4,
        name: 'Lê Tồn Đọng',
        phone: '0981111222',
        date: '2026-09-20',
        type: 'BHXH',
        amount: 500000,
        months: 3,
        status: 'Hoạt động',
        payment_status: 'Đã thu tiền',
        is_submitted_bhxh: false,
        submission_batch: ''
      }
    ];

    const allBatches = groupRecordsIntoBatches(mockRecords, 'ALL');

    // A. Khi chọn Tháng 09/2026 (Mặc định khi mở tab)
    const sepBatches = allBatches.filter(b => batchMatchesPeriod(b, 'MONTH', '2026-09', 3, 2026));
    const sepKpis = calculateBatchKPIs(sepBatches);

    expect(sepKpis.totalSubmittedBatches).toBe(2); // BATCH_SEP_01 & BATCH_SEP_02
    expect(sepKpis.totalSubmittedRecords).toBe(2);
    expect(sepKpis.totalSubmittedAmount).toBe(5000000); // 2tr + 3tr
    expect(sepKpis.pendingRecords).toBe(1); // Lê Tồn Đọng
    expect(sepKpis.pendingAmount).toBe(500000);

    // B. Khi chuyển sang Tháng 08/2026
    const augBatches = allBatches.filter(b => batchMatchesPeriod(b, 'MONTH', '2026-08', 3, 2026));
    const augKpis = calculateBatchKPIs(augBatches);

    expect(augKpis.totalSubmittedBatches).toBe(1); // BATCH_AUG_01
    expect(augKpis.totalSubmittedAmount).toBe(1500000);
    expect(augKpis.pendingRecords).toBe(0);

    // C. Khi chuyển sang Quý 3/2026 (bao gồm cả tháng 8 và tháng 9)
    const q3Batches = allBatches.filter(b => batchMatchesPeriod(b, 'QUARTER', '2026-09', 3, 2026));
    const q3Kpis = calculateBatchKPIs(q3Batches);

    expect(q3Kpis.totalSubmittedBatches).toBe(3); // 1 đợt T8 + 2 đợt T9
    expect(q3Kpis.totalSubmittedAmount).toBe(6500000); // 1.5tr + 5tr
    expect(q3Kpis.pendingRecords).toBe(1);
    expect(q3Kpis.pendingAmount).toBe(500000);

    // D. Khi chuyển sang lọc riêng BHYT (typeFilter = 'BHYT')
    const bhytBatches = groupRecordsIntoBatches(mockRecords, 'BHYT');
    const bhytSepBatches = bhytBatches.filter(b => batchMatchesPeriod(b, 'MONTH', '2026-09', 3, 2026));
    const bhytKpis = calculateBatchKPIs(bhytSepBatches);

    expect(bhytKpis.totalSubmittedBatches).toBe(1); // BATCH_SEP_02
    expect(bhytKpis.totalSubmittedAmount).toBe(3000000);
  });
});
