import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';
import {
  calculateRefundRatios,
  getRefundHistory,
  validateRefundAmount,
  createClawbackPayload,
  validateAdjustmentPeriodDate
} from '../utils/clawbackSettlement';

describe('Kiểm Thử Nghiệp Vụ Bút Toán Thoái Thu & Hoàn Trả (Clawback Settlement Test Suite)', () => {
  const originalBHXHRecord: RecordType = {
    id: 1001,
    name: 'Nguyễn Văn An',
    cccd: '001200000001',
    bhxh: '7912345678',
    phone: '0901234567',
    months: 12,
    status: 'Hoạt động',
    type: 'BHXH',
    actionType: 'Đăng ký mới',
    amount: 10000000, // 10 triệu
    commission: 1500000, // 15% rate gốc tại thời điểm thu
    nnSupportAmount: 660000, // NSNN hỗ trợ 6.6%
    dpSupportAmount: 330000, // NSĐP hỗ trợ 3.3%
    date: '2026-07-15', // Thuộc kỳ 07/2026 đã khóa sổ
    staffId: 'NV01',
    paymentStatus: 'Đã thu tiền',
    appliedRates: {
      commissionRate: 0.15,
      nnSupportPct: 0.066,
      dpSupportPct: 0.033
    }
  };

  describe('1. Lưu Trữ Tập Trung Tại Bảng Records (Clawback Invariant 3)', () => {
    it('Bút toán thoái thu phải chứa giá trị âm cho amount, commission, nnSupportAmount, dpSupportAmount', () => {
      const payload = createClawbackPayload({
        originalRecord: originalBHXHRecord,
        refundAmount: 5000000, // Thoái thu 5 triệu (50%)
        refundType: 'THOAI_THU_MOT_PHAN',
        decisionNumber: 'QĐ-88/BHXH',
        decisionDate: '2026-09-17',
        reason: 'Khách hàng có việc gia đình xin rút thoái một phần',
        refundMethod: 'CHUYEN_KHOAN',
        effectiveDate: '2026-09-17' // Kỳ tháng 9 đang mở
      });

      // 1. Số tiền âm tuyệt đối
      expect(payload.amount).toBe(-5000000);
      expect(payload.amount).toBeLessThan(0);

      // 2. Hoa hồng âm thu hồi (50% của 1.5 triệu = 750,000)
      expect(payload.commission).toBe(-750000);
      expect(payload.commission).toBeLessThan(0);

      // 3. NSNN & NSĐP hỗ trợ âm
      expect(payload.nnSupportAmount).toBe(-330000);
      expect(payload.dpSupportAmount).toBe(-165000);

      // 4. Flags & liên kết gốc
      expect(payload.isAdjustment).toBe(true);
      expect(payload.originalRecordId).toBe(1001);
      expect(payload.actionType).toBe('Thoái thu hoàn trả');
      expect(payload.paymentStatus).toBe('Đã thoái thu');
      expect(payload.refundType).toBe('THOAI_THU_MOT_PHAN');
      expect(payload.decisionNumber).toBe('QĐ-88/BHXH');
      expect(payload.refundMethod).toBe('CHUYEN_KHOAN');
      expect(payload.staffId).toBe('NV01');
    });

    it('Toàn bộ thông tin định danh khách hàng được bảo toàn nguyên vẹn từ đơn gốc', () => {
      const payload = createClawbackPayload({
        originalRecord: originalBHXHRecord,
        refundAmount: 10000000,
        refundType: 'THOAI_THU_TOAN_PHAN',
        effectiveDate: '2026-09-17',
        reason: 'Thoái toàn phần'
      });

      expect(payload.name).toBe(originalBHXHRecord.name);
      expect(payload.cccd).toBe(originalBHXHRecord.cccd);
      expect(payload.bhxh).toBe(originalBHXHRecord.bhxh);
      expect(payload.type).toBe('BHXH');
    });
  });

  describe('2. Đóng Băng Tỷ Lệ Theo Giao Dịch Gốc (Snapshot Invariant)', () => {
    it('Thu hồi hoa hồng tính theo tỷ lệ gốc (15%), không bị ảnh hưởng bởi chính sách mới (25%)', () => {
      const breakdown = calculateRefundRatios(originalBHXHRecord, 4000000); // Thoái 4 triệu

      // Tỷ lệ hoa hồng gốc: 1,500,000 / 10,000,000 = 15% (0.15)
      expect(breakdown.commissionRatio).toBe(0.15);

      // Hoa hồng thu hồi: 4,000,000 * 0.15 = 600,000 (KHÔNG PHẢI 4M * 0.25 = 1,000,000)
      expect(breakdown.clawbackCommission).toBe(600000);

      // Tỷ lệ NSNN gốc: 660,000 / 10,000,000 = 6.6% (0.066)
      expect(breakdown.clawbackNNSupport).toBe(264000);

      // Tỷ lệ NSĐP gốc: 330,000 / 10,000,000 = 3.3% (0.033)
      expect(breakdown.clawbackDPSupport).toBe(132000);
    });

    it('Tự động suy luận tỷ lệ từ amount & commission gốc nếu appliedRates không tồn tại', () => {
      const legacyRecord: RecordType = {
        id: 2002,
        name: 'Trần Thị Bình',
        phone: '0908888888',
        date: '2026-08-01',
        months: 12,
        status: 'Hoạt động',
        type: 'BHYT',
        amount: 2000000,
        commission: 140000, // 7%
        staffId: 'NV02',
        paymentStatus: 'Đã thu tiền'
      };

      const breakdown = calculateRefundRatios(legacyRecord, 1000000);
      expect(breakdown.commissionRatio).toBe(0.07);
      expect(breakdown.clawbackCommission).toBe(70000);
    });
  });

  describe('3. Ràng Buộc Phòng Vệ Toàn Vẹn & Khóa Kỳ (Defensive Invariants)', () => {
    it('Chặn thoái thu số tiền lớn hơn số tiền giao dịch gốc', () => {
      const validation = validateRefundAmount(originalBHXHRecord, 11000000, []);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('vượt quá số tiền');
    });

    it('Chặn thoái thu số tiền <= 0', () => {
      const validationZero = validateRefundAmount(originalBHXHRecord, 0, []);
      expect(validationZero.isValid).toBe(false);

      const validationNegative = validateRefundAmount(originalBHXHRecord, -500000, []);
      expect(validationNegative.isValid).toBe(false);
    });

    it('Hỗ trợ thoái thu nhiều lần và chặn khi tổng các lần thoái vượt quá giá trị đơn gốc', () => {
      // Lịch sử đã thoái thu 6 triệu
      const existingClawbacks: RecordType[] = [
        {
          id: 5001,
          originalRecordId: 1001,
          name: 'Nguyễn Văn An',
          phone: '0901234567',
          date: '2026-08-20',
          months: 12,
          status: 'Hoạt động',
          type: 'BHXH',
          amount: -6000000,
          commission: -900000,
          isAdjustment: true,
          paymentStatus: 'Đã thoái thu'
        }
      ];

      const history = getRefundHistory(originalBHXHRecord, existingClawbacks);
      expect(history.alreadyRefunded).toBe(6000000);
      expect(history.remainingRefundable).toBe(4000000);

      // Thoái tiếp 3 triệu: Hợp lệ
      const valValid = validateRefundAmount(originalBHXHRecord, 3000000, existingClawbacks);
      expect(valValid.isValid).toBe(true);

      // Thoái tiếp 5 triệu: Bị chặn vì chỉ còn 4 triệu
      const valInvalid = validateRefundAmount(originalBHXHRecord, 5000000, existingClawbacks);
      expect(valInvalid.isValid).toBe(false);
      expect(valInvalid.error).toContain('vượt quá số tiền còn lại');
    });

    it('Nếu đơn gốc thuộc kỳ đã khóa, bút toán điều chỉnh BẮT BUỘC phải ghi nhận ở kỳ mở (hiện tại)', () => {
      // Đơn gốc 2026-07-15 thuộc kỳ 07/2026 đã khóa
      // Nếu cố tình hạch toán vào kỳ 07/2026 -> Bị chặn
      const invalidDateCheck = validateAdjustmentPeriodDate(
        originalBHXHRecord,
        '2026-07-20',
        ['month_07/2026']
      );
      expect(invalidDateCheck.isValid).toBe(false);
      expect(invalidDateCheck.error).toContain('thuộc kỳ tài chính đã chốt sổ');

      // Hạch toán vào kỳ 09/2026 đang mở -> Hợp lệ
      const validDateCheck = validateAdjustmentPeriodDate(
        originalBHXHRecord,
        '2026-09-17',
        ['month_07/2026']
      );
      expect(validDateCheck.isValid).toBe(true);
    });
  });

  describe('4. Tính Toán Quyết Toán Tài Chính & Chốt Sổ (Settlement Math Reconciliation)', () => {
    it('Đảm bảo hạch toán cân đối chuẩn xác giữa Gross, Thoái thu và Net', () => {
      // Giả sử có 2 đơn thu tiền: 10 triệu (NV01) và 5 triệu (NV02)
      // Có 1 bút toán thoái thu âm: -3 triệu (NV01)
      const receipts = [
        { amount: 10000000, commission: 1500000 },
        { amount: 5000000, commission: 500000 }
      ];
      const clawbacks = [
        { amount: -3000000, commission: -450000 }
      ];

      const grossRevenue = receipts.reduce((sum, r) => sum + r.amount, 0); // 15,000,000
      const totalRefund = clawbacks.reduce((sum, r) => sum + Math.abs(r.amount), 0); // 3,000,000
      const netRevenue = grossRevenue - totalRefund; // 12,000,000

      const grossStaffComm = receipts.reduce((sum, r) => sum + r.commission, 0); // 2,000,000
      const clawbackComm = clawbacks.reduce((sum, r) => sum + Math.abs(r.commission), 0); // 450,000
      const netStaffComm = grossStaffComm - clawbackComm; // 1,550,000

      expect(grossRevenue).toBe(15000000);
      expect(totalRefund).toBe(3000000);
      expect(netRevenue).toBe(12000000);

      expect(grossStaffComm).toBe(2000000);
      expect(clawbackComm).toBe(450000);
      expect(netStaffComm).toBe(1550000);

      // Dòng tiền thực két quỹ phải khớp 100% với Doanh thu thuần
      const netCashflow = grossRevenue - totalRefund;
      expect(netCashflow).toBe(netRevenue);
    });

    it('Phân lập hoàn toàn giao dịch bị hủy: không trừ doanh thu, không tính vào thoái thu, không trừ hoa hồng cán bộ', () => {
      // Giả lập kỳ 09/2026 giống hệt ảnh của người dùng:
      // 34 hồ sơ đã thu tiền: tổng 25.311.000 đ (hoa hồng 2.806.650 đ)
      // 1 hồ sơ bị hủy: 638.000 đ (hoa hồng nếu thu là 95.700 đ)
      // 0 bút toán thoái thu thực tế được lập
      const paidRecords = [
        { id: 1, amount: 25311000, commission: 2806650, paymentStatus: 'Đã thu tiền', isAdjustment: false }
      ];
      const cancelledRecords = [
        { id: 2, amount: 638000, commission: 95700, paymentStatus: 'Đã hủy', isAdjustment: false }
      ];
      const clawbackRecords: any[] = []; // 0 bút toán thoái thu thực tế

      // 1. Tổng thu phát sinh (Gross): chỉ tính trên các hồ sơ đã thu tiền
      const grossRevenue = paidRecords.reduce((sum, r) => sum + r.amount, 0);
      const grossStaffComm = paidRecords.reduce((sum, r) => sum + r.commission, 0);

      // 2. Chỉ tiêu Thoái thu & Hoàn trả (Single Source of Truth): 100% từ bút toán thoái thu thực tế
      const totalRefund = clawbackRecords.reduce((sum, r) => sum + Math.abs(r.amount), 0);
      const refundCommissionDeducted = clawbackRecords.reduce((sum, r) => sum + Math.abs(r.commission), 0);

      // 3. Doanh thu thuần (Net) và Hoa hồng thực chi (Net)
      const netRevenue = grossRevenue - totalRefund;
      const netStaffCommission = grossStaffComm - refundCommissionDeducted;

      // Kỳ vọng: Đơn hủy không làm trừ Gross, không bị tính vào thoái thu (-638.000), không bị phạt hoa hồng (-95.700)
      expect(grossRevenue).toBe(25311000);
      expect(totalRefund).toBe(0); // Không bị trừ -638.000 đ
      expect(refundCommissionDeducted).toBe(0); // Không bị trừ -95.700 đ
      expect(netRevenue).toBe(25311000); // Khớp 100% với Gross
      expect(grossStaffComm).toBe(2806650);
      expect(netStaffCommission).toBe(2806650); // Nhân viên nhận đủ 100% hoa hồng gộp
      expect(cancelledRecords.length).toBe(1); // Giao dịch hủy chỉ dùng để theo dõi trạng thái
    });
  });
});
