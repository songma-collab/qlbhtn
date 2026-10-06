import { describe, it, expect } from 'vitest';
import { groupRecordsByCustomer } from '../utils/helpers';

describe('Kiểm thử Khớp nối định danh đa tầng & Stress-test gom cụm (Unification Cluster Test Suite)', () => {

  describe('1. Khớp nối đa tầng (Multi-tier Identity Linking)', () => {
    it('Gom cụm thành công 4 bản ghi phân mảnh thông tin của cùng 1 khách hàng về 1 hồ sơ duy nhất', () => {
      const records = [
        // Giao dịch 1: Đăng ký ban đầu, có CCCD và SĐT
        {
          id: 101,
          type: 'BHXH',
          name: 'Nguyễn Văn An',
          cccd: '001200000001',
          phone: '0912345678',
          bhxh: '',
          date: '2025-01-10',
          nextPayment: '2025-07-10',
          paymentStatus: 'Đã thu tiền',
          amount: 1584000
        },
        // Giao dịch 2: Gia hạn lần 1, mất CCCD nhưng khớp SĐT + Tên
        {
          id: 102,
          type: 'BHXH',
          name: 'Nguyễn Văn An',
          cccd: '',
          phone: '0912345678',
          bhxh: '',
          date: '2025-07-05',
          nextPayment: '2026-01-10',
          paymentStatus: 'Đã thu tiền',
          amount: 1584000
        },
        // Giao dịch 3: Cập nhật sổ BHXH, có mã BHXH và khớp lại CCCD
        {
          id: 103,
          type: 'BHXH',
          name: 'Nguyễn Văn An',
          cccd: '001200000001',
          phone: '',
          bhxh: '7912345678',
          date: '2026-01-08',
          nextPayment: '2026-07-10',
          paymentStatus: 'Đã thu tiền',
          amount: 1584000
        },
        // Giao dịch 4: Gia hạn mới nhất, đổi SĐT mới nhưng khớp qua Mã BHXH
        {
          id: 104,
          type: 'BHXH',
          name: 'Nguyễn Văn An',
          cccd: '',
          phone: '0988776655', // SĐT mới
          bhxh: '7912345678',  // Khớp mã BHXH
          date: '2026-07-02',
          nextPayment: '2027-01-10', // Hạn mới nhất
          paymentStatus: 'Đã thu tiền',
          amount: 1584000
        }
      ];

      const clustered = groupRecordsByCustomer(records, 'BHXH');

      // 4 bản ghi phân mảnh phải được gom thành ĐÚNG 1 khách hàng
      expect(clustered).toHaveLength(1);

      const customer = clustered[0]!;
      // Bản ghi đại diện phải là giao dịch mới nhất (ID 104, nextPayment 2027-01-10)
      expect(customer.id).toBe(104);
      expect(customer.next_payment || (customer as any).nextPayment).toBe('2027-01-10');
      expect(customer.phone).toBe('0988776655');
      // Tổng số lần đóng / lịch sử tham gia = 4
      expect(customer.totalHistoryCount).toBe(4);
    });

    it('Phân tách chính xác giữa 2 khách hàng trùng Họ tên nhưng khác SĐT và khác CCCD', () => {
      const records = [
        {
          id: 201,
          type: 'BHXH',
          name: 'Trần Văn Bình',
          cccd: '001200000002',
          phone: '0911111111',
          bhxh: '7911111111',
          date: '2026-01-01',
          nextPayment: '2026-07-01',
          paymentStatus: 'Đã thu tiền'
        },
        {
          id: 202,
          type: 'BHXH',
          name: 'Trần Văn Bình', // Cùng tên nhưng là người khác
          cccd: '001200000003', // Khác CCCD
          phone: '0922222222', // Khác SĐT
          bhxh: '7922222222', // Khác BHXH
          date: '2026-01-01',
          nextPayment: '2026-07-01',
          paymentStatus: 'Đã thu tiền'
        }
      ];

      const clustered = groupRecordsByCustomer(records, 'BHXH');
      expect(clustered).toHaveLength(2);
    });

    it('Loại trừ bản ghi Đã hủy và bản ghi Bút toán bù trừ âm khỏi danh sách khách hàng', () => {
      const records = [
        {
          id: 301,
          type: 'BHXH',
          name: 'Lê Thị Cúc',
          cccd: '001200000004',
          phone: '0933333333',
          nextPayment: '2026-06-01',
          paymentStatus: 'Đã thu tiền'
        },
        {
          id: 302,
          type: 'BHXH',
          name: 'Giao dịch bị hủy',
          cccd: '001200000005',
          phone: '0944444444',
          paymentStatus: 'Đã hủy'
        },
        {
          id: 303,
          type: 'BHXH',
          name: 'Bút toán bù trừ',
          cccd: '001200000006',
          phone: '0955555555',
          isAdjustment: true,
          paymentStatus: 'Đã thu tiền'
        }
      ];

      const clustered = groupRecordsByCustomer(records, 'BHXH');
      // Chỉ bản ghi 301 hợp lệ, 302 (Đã hủy) và 303 (Bút toán âm) bị loại trừ
      expect(clustered).toHaveLength(1);
      expect(clustered[0]!.id).toBe(301);
    });
  });

  describe('2. Stress-test Hiệu năng (Performance & Scalability Benchmark)', () => {
    it('Xử lý 1.000 bản ghi lộn xộn trong thời gian dưới 100ms', () => {
      const NUM_CUSTOMERS = 200;
      const RECORDS_PER_CUSTOMER = 5;
      const generatedRecords: any[] = [];

      let recordIdCounter = 1000;

      for (let c = 0; c < NUM_CUSTOMERS; c++) {
        const cccdBase = `001200${String(c).padStart(6, '0')}`;
        const phoneBase = `09${String(c).padStart(8, '0')}`;
        const bhxhBase = `79${String(c).padStart(8, '0')}`;
        const customerName = `Khách Hàng Thử Nghiệm ${c}`;

        for (let r = 0; r < RECORDS_PER_CUSTOMER; r++) {
          recordIdCounter++;
          // Mô phỏng dữ liệu phân mảnh thực tế: có bản ghi thiếu CCCD, có bản ghi thiếu SĐT hoặc BHXH
          const hasCccd = r % 2 === 0;
          const hasPhone = r % 3 !== 0;
          const hasBhxh = r % 2 !== 0;

          generatedRecords.push({
            id: recordIdCounter,
            type: 'BHXH',
            name: customerName,
            cccd: hasCccd ? cccdBase : '',
            phone: hasPhone ? phoneBase : '',
            bhxh: hasBhxh ? bhxhBase : '',
            date: `2025-${String((r % 12) + 1).padStart(2, '0')}-01`,
            nextPayment: `2026-${String((r % 12) + 1).padStart(2, '0')}-01`,
            paymentStatus: 'Đã thu tiền',
            amount: 1000000 + r * 100000
          });
        }
      }

      // Đảo ngẫu nhiên (shuffle) 1.000 bản ghi để giả lập tình trạng lưu trữ phi tuần tự
      for (let i = generatedRecords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [generatedRecords[i], generatedRecords[j]] = [generatedRecords[j], generatedRecords[i]];
      }

      expect(generatedRecords).toHaveLength(1000);

      // Đo lường thời gian thực thi (Execution time benchmark)
      const startTime = performance.now();
      const results = groupRecordsByCustomer(generatedRecords, 'BHXH');
      const endTime = performance.now();
      const durationMs = endTime - startTime;

      console.log(`\n  >> [BENCHMARK] Gom cụm 1.000 bản ghi lộn xộn hoàn thành trong: ${durationMs.toFixed(2)} ms`);

      // Kiểm tra độ chính xác: 200 khách hàng duy nhất
      expect(results).toHaveLength(NUM_CUSTOMERS);

      // Kiểm tra thời gian: phải dưới 100ms (thực tế BFS Map lookup O(N) thường chỉ 5-25ms)
      expect(durationMs).toBeLessThan(100);
    });
  });
});
