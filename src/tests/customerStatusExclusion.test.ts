import { describe, it, expect } from 'vitest';
import { groupRecordsByCustomer } from '../utils/helpers';
import { 
  filterRenewalDispatchCustomers, 
  reActivateCustomerOnNewContribution,
  countActiveAndStoppedParticipants,
  isCustomerEligibleForRenewalAlert
} from '../utils/customerStatus';

describe('Kiểm thử Quản lý Trạng thái Khách hàng & Loại trừ Đôn đốc Tái tục (Customer Status & Exclusion)', () => {

  describe('1. Loại trừ khách hàng "Đã dừng đóng" khỏi Đôn đốc Tái tục & Cảnh báo SLA', () => {
    it('Khách hàng "Đã dừng đóng" bị loại trừ 100% khỏi danh sách đôn đốc, dù ngày hết hạn nằm trong ngưỡng cảnh báo', () => {
      const customers = [
        {
          id: 1,
          name: 'Nguyễn Văn A',
          cccd: '001200000001',
          status: 'Đang tham gia',
          nextPayment: '2026-09-25',
          amount: 1500000
        },
        {
          id: 2,
          name: 'Trần Thị B (Dừng đóng)',
          cccd: '001200000002',
          status: 'Đã dừng đóng',
          nextPayment: '2026-09-20', // Hết hạn gần kề nhưng đã dừng đóng
          amount: 1500000
        },
        {
          id: 3,
          name: 'Lê Văn C',
          cccd: '001200000003',
          status: undefined, // Mặc định là Đang tham gia
          nextPayment: '2026-10-05',
          amount: 972000
        }
      ];

      const activeList = filterRenewalDispatchCustomers(customers);

      expect(activeList.length).toBe(2);
      expect(activeList.some(c => c.cccd === '001200000002')).toBe(false);
      expect(activeList.some(c => c.cccd === '001200000001')).toBe(true);
      expect(activeList.some(c => c.cccd === '001200000003')).toBe(true);
    });

    it('Hàm isCustomerEligibleForRenewalAlert trả về false cho người đã dừng đóng và true cho người đang tham gia', () => {
      expect(isCustomerEligibleForRenewalAlert({ status: 'Đã dừng đóng' })).toBe(false);
      expect(isCustomerEligibleForRenewalAlert({ status: 'Đang tham gia' })).toBe(true);
      expect(isCustomerEligibleForRenewalAlert({})).toBe(true);
    });
  });

  describe('2. Tự động Kích hoạt lại (Re-activate) khi khách hàng cũ đóng tiếp', () => {
    it('Khi khách hàng "Đã dừng đóng" quay lại nộp tiền thành công, trạng thái tự động chuyển thành "Đang tham gia"', () => {
      const stoppedCustomer = {
        id: 99,
        customer_key: '001200000099',
        name: 'Phạm Văn Tái Tục',
        status: 'Đã dừng đóng' as const,
        notes: 'Khách tạm dừng vì đi làm công ty'
      };

      const newContribution = {
        amount: 1584000,
        paymentStatus: 'Đã thu tiền',
        actionType: 'Tái tục BHXH'
      };

      const result = reActivateCustomerOnNewContribution(stoppedCustomer, newContribution);

      expect(result.status).toBe('Đang tham gia');
      expect(result.wasReactivated).toBe(true);
      expect(result.notes).toContain('Kích hoạt lại');
    });

    it('Giao dịch chưa thu tiền hoặc bằng 0 không làm thay đổi trạng thái nếu không hợp lệ', () => {
      const stoppedCustomer = {
        id: 99,
        customer_key: '001200000099',
        name: 'Phạm Văn Tái Tục',
        status: 'Đã dừng đóng' as const
      };

      const invalidContribution = {
        amount: 0,
        paymentStatus: 'Chờ thu tiền'
      };

      const result = reActivateCustomerOnNewContribution(stoppedCustomer, invalidContribution);

      expect(result.status).toBe('Đã dừng đóng');
      expect(result.wasReactivated).toBe(false);
    });
  });

  describe('3. Thống kê Headcount Phát triển thực tế (Dashboard KPIs)', () => {
    it('Phân tách chính xác Tổng khách hàng, Đang tham gia và Đã dừng đóng', () => {
      const customers = [
        { id: 1, name: 'A', status: 'Đang tham gia' },
        { id: 2, name: 'B', status: 'Đang tham gia' },
        { id: 3, name: 'C', status: 'Đã dừng đóng' },
        { id: 4, name: 'D', status: 'Đang tham gia' },
        { id: 5, name: 'E', status: 'Đã dừng đóng' }
      ];

      const counts = countActiveAndStoppedParticipants(customers);

      expect(counts.total).toBe(5);
      expect(counts.active).toBe(3);
      expect(counts.stopped).toBe(2);
    });
  });

  describe('4. Bảo toàn Dữ liệu Lịch sử & BFS Unification Cluster', () => {
    it('Gom cụm Unification Cluster bảo toàn toàn bộ giao dịch lịch sử khi trạng thái khách hàng thay đổi', () => {
      const historicalRecords = [
        // Kỳ 1: Đóng năm 2024
        {
          id: 101,
          type: 'BHXH',
          name: 'Hoàng Minh Tuấn',
          cccd: '001200000888',
          phone: '0901234567',
          bhxh: '7912345678',
          date: '2024-01-10',
          nextPayment: '2025-01-10',
          paymentStatus: 'Đã thu tiền',
          status: 'Đang tham gia',
          amount: 1584000
        },
        // Kỳ 2: Đóng năm 2025
        {
          id: 102,
          type: 'BHXH',
          name: 'Hoàng Minh Tuấn',
          cccd: '001200000888',
          phone: '0901234567',
          bhxh: '7912345678',
          date: '2025-01-08',
          nextPayment: '2026-01-10',
          paymentStatus: 'Đã thu tiền',
          status: 'Đang tham gia',
          amount: 1584000
        },
        // Kỳ 3: Tháng 02/2026, khách báo dừng đóng
        {
          id: 103,
          type: 'BHXH',
          name: 'Hoàng Minh Tuấn',
          cccd: '001200000888',
          phone: '0901234567',
          bhxh: '7912345678',
          date: '2026-02-01',
          nextPayment: '2026-01-10',
          paymentStatus: 'Đã thu tiền',
          status: 'Đã dừng đóng',
          amount: 0,
          notes: 'Chuyển sang làm công nhân công ty'
        }
      ];

      const unified = groupRecordsByCustomer(historicalRecords);

      // Khách hàng vẫn được gom cụm duy nhất thành 1 người
      expect(unified.length).toBe(1);
      const customer = unified[0];
      expect(customer.cccd).toBe('001200000888');
      expect(customer.bhxh).toBe('7912345678');
      // Trạng thái mới nhất là "Đã dừng đóng"
      expect(customer.status).toBe('Đã dừng đóng');

      // Khi lọc theo đôn đốc, hồ sơ này bị loại trừ
      const renewalList = filterRenewalDispatchCustomers(unified);
      expect(renewalList.length).toBe(0);

      // Kỳ 4: Tháng 09/2026, khách quay lại đóng tiếp (Re-activate)
      const newPaymentRecord = {
        id: 104,
        type: 'BHXH',
        name: 'Hoàng Minh Tuấn',
        cccd: '001200000888',
        phone: '0901234567',
        bhxh: '7912345678',
        date: '2026-09-17',
        nextPayment: '2027-09-17',
        paymentStatus: 'Đã thu tiền',
        status: 'Đang tham gia',
        amount: 2000000
      };

      const updatedHistory = [...historicalRecords, newPaymentRecord];
      const reUnified = groupRecordsByCustomer(updatedHistory);

      expect(reUnified.length).toBe(1);
      expect(reUnified[0].status).toBe('Đang tham gia');

      // Lúc này khách hàng xuất hiện trở lại trong danh sách quản lý
      const reRenewalList = filterRenewalDispatchCustomers(reUnified);
      expect(reRenewalList.length).toBe(1);
      expect(reRenewalList[0].cccd).toBe('001200000888');
    });
  });

});
