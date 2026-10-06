import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';
import { groupRecordsByBatch, generateBatchCode, isValidBatchCode, getNextBatchSequence } from '../utils/batchSubmission';

describe('Kiểm thử Nghiệp vụ Báo Cáo Khách Hàng Theo Nhân Viên & Đợt Chuyển BHXH', () => {
  const mockRecords: RecordType[] = [
    {
      id: 1,
      name: 'Lò Văn C',
      cccd: '014095001234',
      phone: '0981111222',
      date: '2026-09-01',
      type: 'BHXH',
      amount: 1500000,
      months: 6,
      status: 'Hoạt động',
      payment_status: 'Đã thu tiền',
      staff_id: 'staff-1',
      is_submitted_bhxh: true,
      submission_batch: 'BATCH_20260905_01',
      submitted_date: '2026-09-05'
    },
    {
      id: 2,
      name: 'Lò Văn C', // Cùng một khách hàng Lò Văn C tham gia thêm BHYT
      cccd: '014095001234',
      phone: '0981111222',
      date: '2026-09-02',
      type: 'BHYT',
      amount: 800000,
      months: 12,
      status: 'Hoạt động',
      payment_status: 'Đã thu tiền',
      staff_id: 'staff-1',
      is_submitted_bhxh: true,
      submission_batch: 'BATCH_20260905_01',
      submitted_date: '2026-09-05'
    },
    {
      id: 3,
      name: 'Cầm Thị D',
      cccd: '014199005678',
      phone: '0983333444',
      date: '2026-09-10',
      type: 'BHXH',
      amount: 2000000,
      months: 12,
      status: 'Hoạt động',
      payment_status: 'Đã thu tiền',
      staff_id: 'staff-1',
      is_submitted_bhxh: false, // Chưa nộp BHXH
      submission_batch: ''
    },
    {
      id: 4,
      name: 'Vì Văn E',
      cccd: '014088009999',
      phone: '0985555666',
      date: '2026-09-12',
      type: 'BHYT',
      amount: 900000,
      months: 12,
      status: 'Hoạt động',
      payment_status: 'Đã thu tiền',
      staff_id: 'staff-2',
      is_submitted_bhxh: true,
      submission_batch: 'BATCH_20260915_01',
      submitted_date: '2026-09-15'
    },
    {
      id: 5,
      name: 'Bản ghi hủy',
      cccd: '014099999999',
      phone: '0987777777',
      date: '2026-09-03',
      type: 'BHXH',
      amount: 1000000,
      months: 3,
      status: 'Đã hủy',
      payment_status: 'Đã hủy',
      staff_id: 'staff-1',
      is_submitted_bhxh: false
    }
  ];

  describe('1. Thống kê Khách hàng theo Nhân viên (Deduplication & Metrics)', () => {
    it('Khách hàng có nhiều giao dịch (BHXH và BHYT) chỉ được tính là 1 khách hàng duy nhất của nhân viên', () => {
      // Lọc các bản ghi hợp lệ của staff-1
      const staff1Records = mockRecords.filter(r => r.staff_id === 'staff-1' && r.payment_status !== 'Đã hủy');
      
      const customerKeys = new Set<string>();
      let totalAmount = 0;

      staff1Records.forEach(r => {
        totalAmount += r.amount;
        const key = r.cccd || r.phone;
        customerKeys.add(key);
      });

      // Lò Văn C (2 bản ghi) + Cầm Thị D (1 bản ghi) = 2 khách hàng duy nhất
      expect(customerKeys.size).toBe(2);
      expect(staff1Records.length).toBe(3);
      expect(totalAmount).toBe(1500000 + 800000 + 2000000);
    });

    it('Không tính các bản ghi đã hủy vào tệp khách hàng và doanh thu', () => {
      const validRecords = mockRecords.filter(r => r.staff_id === 'staff-1' && r.payment_status !== 'Đã hủy');
      const canceledRecord = validRecords.find(r => r.id === 5);
      expect(canceledRecord).toBeUndefined();
    });
  });

  describe('2. Thống kê Đợt Chuyển BHXH (Batch Grouping & Sums)', () => {
    it('Gom nhóm chính xác theo mã đợt chuyển BATCH_YYYYMMDD_XX', () => {
      const batchMap = groupRecordsByBatch(mockRecords);

      // Có 3 nhóm: BATCH_20260905_01, BATCH_20260915_01, và UNASSIGNED (chưa gán đợt)
      expect(batchMap.has('BATCH_20260905_01')).toBe(true);
      expect(batchMap.has('BATCH_20260915_01')).toBe(true);
      expect(batchMap.has('UNASSIGNED')).toBe(true);

      const batch1 = batchMap.get('BATCH_20260905_01')!;
      expect(batch1.count).toBe(2);
      expect(batch1.totalAmount).toBe(2300000);
      expect(batch1.bhxhCount).toBe(1);
      expect(batch1.bhytCount).toBe(1);
      expect(batch1.isSubmittedBHXH).toBe(true);
      expect(batch1.submittedDate).toBe('2026-09-05');
    });

    it('Tính tổng chính xác hồ sơ đã chuyển cơ quan BHXH vs hồ sơ tồn đọng', () => {
      let submittedCount = 0;
      let submittedAmount = 0;
      let pendingCount = 0;
      let pendingAmount = 0;

      mockRecords.forEach(r => {
        if (r.payment_status === 'Đã hủy') return;
        if (r.is_submitted_bhxh) {
          submittedCount++;
          submittedAmount += r.amount;
        } else {
          pendingCount++;
          pendingAmount += r.amount;
        }
      });

      expect(submittedCount).toBe(3); // id: 1, 2, 4
      expect(submittedAmount).toBe(1500000 + 800000 + 900000); // 3.200.000
      expect(pendingCount).toBe(1); // id: 3 (Cầm Thị D)
      expect(pendingAmount).toBe(2000000);
    });

    it('Sinh mã đợt nộp chuẩn định dạng Đợt_YYYYMMDD_XX (ví dụ Đợt_20260919_02)', () => {
      const code = generateBatchCode('2026-09-19', 2);
      expect(code).toBe('Đợt_20260919_02');
      expect(isValidBatchCode(code)).toBe(true);
      expect(isValidBatchCode('BATCH_20260919_02')).toBe(true);
    });

    it('Tự động nhận diện đợt kế tiếp với cả tiền tố Đợt_ và BATCH_ cũ', () => {
      const existingDot = ['Đợt_20260919_01'];
      expect(getNextBatchSequence(existingDot, '2026-09-19')).toBe(2);

      const existingLegacy = ['BATCH_20260919_01'];
      expect(getNextBatchSequence(existingLegacy, '2026-09-19')).toBe(2);

      const mixed = ['BATCH_20260919_01', 'Đợt_20260919_02'];
      expect(getNextBatchSequence(mixed, '2026-09-19')).toBe(3);
    });
  });
});
