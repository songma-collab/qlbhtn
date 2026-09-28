import { describe, it, expect } from 'vitest';
import { isDateLocked, checkFinancialLockViolation } from '../utils/helpers';
import type { RecordType } from '../context/types';

describe('Kiểm thử Đồng Thời & Khóa Ngăn Chặn Xung Đột Dữ Liệu (Concurrency Lock & Race Condition Prevention)', () => {
  const lockedKeys = ['month_08/2026', 'quarter_2_2026', 'year_2025'];

  const originalRecord: RecordType = {
    id: 501,
    date: '2026-08-15',
    name: 'Phạm Thị Lan',
    cccd: '014195001234',
    bhxh: '1410123456',
    phone: '0977889900',
    type: 'BHXH',
    amount: 5000000,
    commission: 500000,
    staffId: 'staff-01',
    paymentStatus: 'Đã thanh toán',
    status: 'Đang tham gia',
    fromMonth: '2026-08',
    toMonth: '2027-07',
    months: 12,
    updated_at: '2026-08-15T10:00:00.000Z'
  };

  describe('1. Mô phỏng 2 giao dịch cập nhật đồng thời (Optimistic Concurrency Simulation)', () => {
    it('1.1. Luồng 1 cập nhật thành công, Luồng 2 mang snapshot cũ bị từ chối (Lost Update Prevention)', () => {
      // Giả lập state Database ban đầu
      let dbRecord = { ...originalRecord, version: 1 };

      // Hàm update an toàn theo chuẩn Optimistic Concurrency Control (OCC)
      const updateRecordWithOCC = (incomingUpdate: Partial<RecordType> & { expectedVersion: number }) => {
        if (dbRecord.version !== incomingUpdate.expectedVersion) {
          throw new Error('CONCURRENCY_CONFLICT: Bản ghi đã bị thay đổi bởi giao dịch khác. Vui lòng tải lại dữ liệu mới nhất!');
        }
        dbRecord = {
          ...dbRecord,
          ...incomingUpdate,
          version: dbRecord.version + 1,
          updated_at: new Date().toISOString()
        };
        return dbRecord;
      };

      // Luồng 1 (Thread 1): Đọc version 1 và cập nhật SĐT
      const thread1Update = {
        phone: '0988111222',
        expectedVersion: 1
      };
      const result1 = updateRecordWithOCC(thread1Update);
      expect(result1.phone).toBe('0988111222');
      expect(result1.version).toBe(2);

      // Luồng 2 (Thread 2): Chạy song song, vẫn cầm version 1 cũ định sửa địa chỉ
      const thread2Update = {
        address: 'Địa chỉ mới cập nhật từ kênh mobile',
        expectedVersion: 1
      };

      // Luồng 2 phải bị từ chối với lỗi xung đột phiên bản
      expect(() => updateRecordWithOCC(thread2Update)).toThrow('CONCURRENCY_CONFLICT');
      // Dữ liệu trong DB vẫn an toàn của Luồng 1, không bị ghi đè mất mát
      expect(dbRecord.phone).toBe('0988111222');
    });
  });

  describe('2. Mô phỏng Clawback đồng thời: Ngăn chặn triệt để Double-Clawback', () => {
    it('2.1. Khi có 2 yêu cầu Clawback gửi đồng thời cho 1 hồ sơ gốc, chỉ 1 yêu cầu được tạo bút toán bù trừ', () => {
      // Danh sách bản ghi hiện có
      let recordLedger: RecordType[] = [{ ...originalRecord }];

      // Hàm thực hiện Clawback có bảo vệ chống Race Condition
      const executeClawbackSafe = (targetRecordId: number, reason: string) => {
        const target = recordLedger.find(r => r.id === targetRecordId);
        if (!target) throw new Error('Hồ sơ không tồn tại.');

        // Kiểm tra xem đã có bút toán bù trừ âm nào cho hồ sơ này chưa
        const existingClawback = recordLedger.find(r => r.isAdjustment && r.originalRecordId === targetRecordId);
        if (existingClawback) {
          throw new Error('ALREADY_CLAWED_BACK: Hồ sơ này đã được bù trừ hoàn tất trước đó. Không thể bù trừ lần thứ 2!');
        }

        if (target.paymentStatus === 'Đã hủy') {
          throw new Error('INVALID_STATUS: Hồ sơ đã ở trạng thái Đã hủy.');
        }

        // Tạo bút toán bù trừ âm trong kỳ hiện tại
        const clawbackEntry: RecordType = {
          id: Date.now() + Math.floor(Math.random() * 1000),
          date: '2026-09-16',
          name: `${target.name} (Bù trừ thu hồi)`,
          type: target.type,
          actionType: 'Điều chỉnh thu hồi',
          amount: -(Number(target.amount) || 0),
          commission: -(Number(target.commission) || 0),
          staffId: target.staffId,
          paymentStatus: 'Đã thu tiền',
          status: 'Hoàn tất',
          phone: target.phone,
          isAdjustment: true,
          originalRecordId: target.id,
          adjustmentReason: reason,
          months: target.months
        };

        // Cập nhật trạng thái bản ghi gốc
        target.paymentStatus = 'Đã hủy';
        recordLedger.push(clawbackEntry);

        return clawbackEntry;
      };

      // Yêu cầu 1 (Request A): Bù trừ do khách hàng rút hồ sơ
      const clawbackA = executeClawbackSafe(501, 'Khách hàng rút hồ sơ');
      expect(clawbackA.amount).toBe(-5000000);
      expect(clawbackA.commission).toBe(-500000);
      expect(recordLedger).toHaveLength(2);

      // Yêu cầu 2 (Request B): Gửi đồng thời do mạng lag hoặc nhân viên nhấn đúp
      expect(() => executeClawbackSafe(501, 'Yêu cầu trùng lặp')).toThrow('ALREADY_CLAWED_BACK');

      // Xác minh trong sổ cái chỉ có duy nhất 1 bút toán bù trừ âm
      const clawbackEntries = recordLedger.filter(r => r.originalRecordId === 501);
      expect(clawbackEntries).toHaveLength(1);

      // Tổng hoa hồng của nhân viên staff-01 sau khi hủy: 500k - 500k = 0đ (không bị âm do trừ 2 lần)
      const staffTotalCommission = recordLedger
        .filter(r => r.staffId === 'staff-01')
        .reduce((sum, r) => sum + (Number(r.commission) || 0), 0);
      expect(staffTotalCommission).toBe(0);
    });
  });

  describe('3. Ngăn chặn Double-Counting Hoa Hồng (Idempotency & Duplicate Prevention)', () => {
    it('3.1. Khi một giao dịch được đồng bộ nhiều lần, không làm tăng hoa hồng hay doanh thu gấp bội', () => {
      const recordsMap = new Map<number, RecordType>();

      const syncRecordIdempotent = (rec: RecordType) => {
        // Upsert theo ID
        recordsMap.set(rec.id!, { ...rec });
      };

      // Lần 1: Đồng bộ giao dịch
      syncRecordIdempotent(originalRecord);
      expect(recordsMap.size).toBe(1);

      // Lần 2: Mạng chập chờn, client gửi lại đúng bản ghi đó
      syncRecordIdempotent(originalRecord);
      expect(recordsMap.size).toBe(1);

      // Lần 3: Đồng bộ batch lại
      syncRecordIdempotent({ ...originalRecord, updated_at: '2026-08-16T12:00:00.000Z' });
      expect(recordsMap.size).toBe(1);

      const totalCommission = Array.from(recordsMap.values())
        .reduce((sum, r) => sum + (Number(r.commission) || 0), 0);
      expect(totalCommission).toBe(500000); // Vẫn giữ 500.000đ, không bị nhân 3 thành 1.500.000đ
    });
  });

  describe('4. Bất biến Khóa Kỳ Tài Chính dưới tác động của các luồng đồng thời', () => {
    it('4.1. Mọi nỗ lực sửa trường tài chính trong kỳ đã khóa đều bị chặn đứng, bất kể luồng nào thực hiện', () => {
      // Kỳ tháng 08/2026 đã bị khóa
      expect(isDateLocked(originalRecord.date, lockedKeys)).toBe(true);

      const concurrentAttempts = [
        { amount: 6000000 },
        { commission: 700000 },
        { date: '2026-08-10' },
        { paymentStatus: 'Đã hủy' }
      ];

      concurrentAttempts.forEach(attempt => {
        const check = checkFinancialLockViolation(originalRecord, attempt, lockedKeys);
        expect(check.isViolated).toBe(true);
        expect(check.violatedFields.length).toBeGreaterThan(0);
      });

      // Tuy nhiên trường phi tài chính (notes, address) vẫn được phép sửa để phục vụ chăm sóc khách hàng
      const nonFinancialAttempt = { notes: 'Khách hàng đổi SĐT Zalo sang số phụ' };
      const checkNonFin = checkFinancialLockViolation(originalRecord, nonFinancialAttempt, lockedKeys);
      expect(checkNonFin.isViolated).toBe(false);
      expect(checkNonFin.violatedFields).toHaveLength(0);
    });
  });
});
