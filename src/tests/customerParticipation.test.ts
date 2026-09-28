import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateMonthsFromPeriods,
  getCustomerPreviousBHXHMonths,
  calculateBHXH
} from '../utils/calculations';
import { customerService } from '../services/customerService';
import { supabase } from '../lib/supabase';
import type { CustomerParticipationPeriod } from '../context/types';

describe('Kiểm thử Phân hệ Hồ Sơ Tham Gia BHXH & Quy tắc trần 10 năm Luật BHXH 2024', () => {

  describe('1. Hàm calculateMonthsFromPeriods', () => {
    it('tính chính xác số tháng cho từng giai đoạn và phân loại đúng loại hình', () => {
      const periods: CustomerParticipationPeriod[] = [
        // Giai đoạn bắt buộc doanh nghiệp: 2 năm (2020-01 đến 2021-12) = 24 tháng
        {
          id: 1,
          type: 'batbuoc',
          position: 'Công nhân may',
          workplace: 'Công ty CP May Sông Mã',
          sm: 1,
          sy: 2020,
          em: 12,
          ey: 2021,
          salary: '6000000'
        },
        // Giai đoạn nhà nước hệ số: 1 năm (2022-01 đến 2022-12) = 12 tháng
        {
          id: 2,
          type: 'nhanuoc',
          position: 'Cán bộ hợp đồng',
          workplace: 'UBND Huyện Sông Mã',
          sm: 1,
          sy: 2022,
          em: 12,
          ey: 2022,
          salary: '2.34'
        },
        // Giai đoạn tự nguyện đại lý khác: 3 năm (2023-01 đến 2025-12) = 36 tháng
        {
          id: 3,
          type: 'tunguyen',
          position: 'Tham gia BHXH tự nguyện',
          workplace: 'Đại lý Bưu điện Huyện',
          sm: 1,
          sy: 2023,
          em: 12,
          ey: 2025,
          salary: '1500000'
        }
      ];

      const res = calculateMonthsFromPeriods(periods);
      // Bắt buộc = 24 (DN) + 12 (Nhà nước) = 36 tháng
      expect(res.compulsoryMonths).toBe(36);
      // Tự nguyện ngoài = 36 tháng
      expect(res.voluntaryMonths).toBe(36);
      // Tổng cộng = 72 tháng (6 năm)
      expect(res.totalMonths).toBe(72);
    });

    it('xử lý an toàn khi danh sách giai đoạn rỗng hoặc null', () => {
      expect(calculateMonthsFromPeriods([])).toMatchObject({ compulsoryMonths: 0, voluntaryMonths: 0, totalMonths: 0 });
      expect(calculateMonthsFromPeriods(null)).toMatchObject({ compulsoryMonths: 0, voluntaryMonths: 0, totalMonths: 0 });
      expect(calculateMonthsFromPeriods(undefined)).toMatchObject({ compulsoryMonths: 0, voluntaryMonths: 0, totalMonths: 0 });
    });

    it('tính đúng cho giai đoạn 1 tháng (cùng tháng cùng năm)', () => {
      const singleMonthPeriod = [
        { id: 1, type: 'tunguyen', sm: 5, sy: 2026, em: 5, ey: 2026, salary: '1500000' }
      ];
      const res = calculateMonthsFromPeriods(singleMonthPeriod);
      expect(res.voluntaryMonths).toBe(1);
      expect(res.compulsoryMonths).toBe(0);
      expect(res.totalMonths).toBe(1);
    });
  });

  describe('2. Hàm getCustomerPreviousBHXHMonths tích hợp thời gian đóng nơi khác', () => {
    const mockRecords = [
      { id: 101, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, paymentStatus: 'Đã thu tiền' },
      { id: 102, type: 'BHXH', cccd: '014301001065', bhxh: '1421100097', months: 12, paymentStatus: 'Đã thu tiền' }
    ]; // Tổng trong records = 24 tháng

    it('cộng dồn số tháng tự nguyện đóng nơi khác khi truyền trực tiếp số', () => {
      // 24 tháng trong records + 48 tháng đóng ở đại lý khác = 72 tháng
      const total = getCustomerPreviousBHXHMonths(
        mockRecords,
        { cccd: '014301001065' },
        null,
        undefined,
        48 // prior voluntary months
      );
      expect(total).toBe(72);
    });

    it('tự động tra cứu khách hàng trong mảng customers để lấy prior_voluntary_months', () => {
      const mockCustomers = [
        {
          id: 'cust-1',
          name: 'Lò Văn A',
          cccd: '014301001065',
          bhxh: '1421100097',
          prior_voluntary_months: 60,
          prior_compulsory_months: 36
        }
      ];

      // Tìm theo CCCD
      const totalByCccd = getCustomerPreviousBHXHMonths(
        mockRecords,
        { cccd: '014301001065' },
        null,
        undefined,
        mockCustomers
      );
      // 24 (records) + 60 (prior_voluntary_months) = 84 tháng
      expect(totalByCccd).toBe(84);

      // Tìm theo Mã BHXH
      const totalByBhxh = getCustomerPreviousBHXHMonths(
        mockRecords,
        { bhxh: '1421100097' },
        null,
        undefined,
        mockCustomers
      );
      expect(totalByBhxh).toBe(84);
    });

    it('bảo đảm thời gian BHXH bắt buộc KHÔNG bị tính vào trần trừ hỗ trợ của BHXH tự nguyện', () => {
      const mockCustomers = [
        {
          id: 'cust-2',
          name: 'Hà Thị B',
          cccd: '014302002088',
          bhxh: '1422200088',
          prior_voluntary_months: 0,
          // Đóng 10 năm (120 tháng) BHXH bắt buộc trước đây
          prior_compulsory_months: 120
        }
      ];

      // Khách hàng chưa đóng tháng BHXH tự nguyện nào trong records
      const totalVoluntary = getCustomerPreviousBHXHMonths(
        [],
        { cccd: '014302002088' },
        null,
        undefined,
        mockCustomers
      );

      // Số tháng tự nguyện tích lũy tính trần hỗ trợ PHẢI LÀ 0 THÁNG (không bị trừ 120 tháng bắt buộc)
      expect(totalVoluntary).toBe(0);
    });
  });

  describe('3. Áp dụng trần hỗ trợ 10 năm (120 tháng) theo Luật BHXH 2024 khi khách hàng có thời gian đóng ngoài', () => {
    it('Khách hàng đã có 96 tháng tự nguyện ở nơi khác, đóng tiếp 36 tháng tại đại lý: phân kỳ đúng 24 tháng có hỗ trợ và 12 tháng đóng đủ', () => {
      // 96 tháng đã tích lũy ngoài hệ thống
      const priorMonths = 96;

      // Đăng ký đóng 36 tháng (3 năm)
      // Trong đó:
      // - 24 tháng đầu (từ tháng 97 đến 120): còn trong hạn mức 10 năm -> CÓ HỖ TRỢ NSNN
      // - 12 tháng sau (từ tháng 121 đến 132): vượt trần 10 năm -> 0đ HỖ TRỢ NSNN (nộp 100%)
      const calcResult = calculateBHXH(
        1500000,
        20, // Hỗ trợ 20% chuẩn nghèo
        0,  // Hỗ trợ địa phương 0%
        'pre_36',
        36,
        '01/2026',
        0.0031,
        1500000,
        [],
        priorMonths // Truyền 96 tháng tích lũy trước đó
      );

      expect(calcResult.previousMonths).toBe(96);
      expect(calcResult.supportedMonthsCount).toBe(24);
      expect(calcResult.unsupportedMonthsCount).toBe(12);
      expect(calcResult.totalAccumulatedMonths).toBe(132);

      // Tiền hỗ trợ NSNN chỉ được tính cho 24 tháng đầu: 24 * (1.500.000 * 22% * 20%) = 24 * 66.000 = 1.584.000 đ
      expect(calcResult.nnSupportAmount).toBe(1584000);
    });

    it('Khách hàng đã đủ 120 tháng tự nguyện ngoài hệ thống: nộp 100% tiền túi, không giảm trừ NSNN', () => {
      const priorMonths = 120;

      const calcResult = calculateBHXH(
        1500000,
        20,
        0,
        '12',
        12,
        '01/2026',
        0.0031,
        1500000,
        [],
        priorMonths
      );

      expect(calcResult.previousMonths).toBe(120);
      expect(calcResult.supportedMonthsCount).toBe(0);
      expect(calcResult.unsupportedMonthsCount).toBe(12);
      expect(calcResult.nnSupportAmount).toBe(0);
      // Mức nộp đủ 22%: 1.500.000 * 22% * 12 = 3.960.000 đ
      expect(calcResult.amount).toBe(3960000);
    });
  });

  describe('4. An toàn giao dịch: customerService.updateCustomerParticipation tuyệt đối không ghi vào records', () => {
    it('updateCustomerParticipation cập nhật bảng customers mà không gọi lệnh ghi bảng records', async () => {
      // Mock supabase
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        or: vi.fn().mockResolvedValue({ error: null })
      });

      const originalFrom = supabase.from;
      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'customers') {
          return { update: mockUpdate } as any;
        }
        if (table === 'records') {
          throw new Error('VI PHẠM AN TOÀN: Bảng records không được phép ghi khi cập nhật hồ sơ tham gia!');
        }
        return originalFrom.call(supabase, table);
      });

      const res = await customerService.updateCustomerParticipation('cust-12345678-0000-0000-0000-000000000000', {
        prior_periods: [
          { id: 1, type: 'batbuoc', sm: 1, sy: 2020, em: 12, ey: 2022, salary: '6000000', position: 'Công nhân' }
        ],
        prior_voluntary_months: 0,
        prior_compulsory_months: 36,
        prior_participation_notes: 'Chốt sổ BHXH Mạo Khê'
      });

      expect(res.success).toBe(true);
      expect(fromSpy).toHaveBeenCalledWith('customers');
      expect(fromSpy).not.toHaveBeenCalledWith('records');

      fromSpy.mockRestore();
    });
  });

});
