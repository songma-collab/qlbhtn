import { describe, it, expect } from 'vitest';
import { 
  calculateBHXH, 
  calculateBHYT, 
  calculateBHYTCoterminous, 
  getPolicyValueForDate, 
  getCommissionRateForRecord,
  getNNSupportRate,
  validateBHXHIncome,
  NN_SUPPORT_RATES
} from './calculations';
import { Policy } from '../context/AppContext';

describe('Bộ kiểm thử tính toán tài chính BHXH & BHYT (Financial Calculations Test Suite)', () => {

  describe('1. Tính toán BHXH Tự nguyện theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP', () => {
    it('Tính đúng mức đóng 1 tháng chuẩn nghèo (1.500.000đ) với hỗ trợ Nhà nước 20% (Khác)', () => {
      // 1.500.000 * 22% = 330.000đ
      // NN hỗ trợ 20%: 330.000 * 20% = 66.000đ
      // Người dân đóng: 330.000 - 66.000 = 264.000đ
      const result = calculateBHXH(1500000, NN_SUPPORT_RATES.OTHER, 0, '1', 0, '01/2026');
      expect(result.basePremium).toBe(330000);
      expect(result.nnSupportAmount).toBe(66000);
      expect(result.dpSupportAmount).toBe(0);
      expect(result.amount).toBe(264000);
      expect(result.toMonth).toBe('01/2026');
    });

    it('Tính đúng mức đóng 1 tháng chuẩn nghèo với hỗ trợ Người dân tộc thiểu số 30% (NĐ 159/2025/NĐ-CP)', () => {
      // NN hỗ trợ 30%: 330.000 * 30% = 99.000đ
      // Người dân đóng: 330.000 - 99.000 = 231.000đ
      const result = calculateBHXH(1500000, NN_SUPPORT_RATES.ETHNIC_MINORITY, 0, '1', 0, '01/2026');
      expect(result.basePremium).toBe(330000);
      expect(result.nnSupportAmount).toBe(99000);
      expect(result.amount).toBe(231000);
    });

    it('Tính đúng mức đóng 1 tháng chuẩn nghèo với hỗ trợ Hộ cận nghèo 40% (NĐ 159/2025/NĐ-CP)', () => {
      // NN hỗ trợ 40%: 330.000 * 40% = 132.000đ
      // Người dân đóng: 330.000 - 132.000 = 198.000đ
      const result = calculateBHXH(1500000, NN_SUPPORT_RATES.NEAR_POOR, 0, '1', 0, '01/2026');
      expect(result.basePremium).toBe(330000);
      expect(result.nnSupportAmount).toBe(132000);
      expect(result.amount).toBe(198000);
    });

    it('Tính đúng mức đóng 1 tháng chuẩn nghèo với hỗ trợ Hộ nghèo, người ở xã đảo, đặc khu 50% (NĐ 159/2025/NĐ-CP)', () => {
      // NN hỗ trợ 50%: 330.000 * 50% = 165.000đ
      // Người dân đóng: 330.000 - 165.000 = 165.000đ
      const result = calculateBHXH(1500000, NN_SUPPORT_RATES.POOR_OR_ISLAND, 0, '1', 0, '01/2026');
      expect(result.basePremium).toBe(330000);
      expect(result.nnSupportAmount).toBe(165000);
      expect(result.amount).toBe(165000);
    });

    it('Kiểm thử hàm getNNSupportRate: Áp dụng chuẩn xác tỷ lệ và mức cao nhất khi thuộc nhiều nhóm', () => {
      expect(getNNSupportRate('Hộ nghèo')).toBe(50);
      expect(getNNSupportRate('Người ở xã đảo')).toBe(50);
      expect(getNNSupportRate('Đặc khu')).toBe(50);
      expect(getNNSupportRate('Hộ cận nghèo')).toBe(40);
      expect(getNNSupportRate('Người dân tộc thiểu số')).toBe(30);
      expect(getNNSupportRate('Đối tượng khác')).toBe(20);

      // Nếu 1 người thuộc nhiều nhóm đối tượng, áp dụng mức hỗ trợ cao nhất:
      expect(getNNSupportRate(['Dân tộc thiểu số', 'Hộ cận nghèo'])).toBe(40);
      expect(getNNSupportRate(['Dân tộc thiểu số', 'Xã đảo'])).toBe(50);
      expect(getNNSupportRate(['Hộ nghèo', 'Hộ cận nghèo'])).toBe(50);
    });

    it('Tính đúng khi người dân chọn mức thu nhập 3.550.000đ và có hỗ trợ Địa phương thêm 10%', () => {
      // Thu nhập: 3.550.000đ
      // Base premium = 3.550.000 * 22% = 781.000đ
      // NN hỗ trợ (tính trên chuẩn nghèo 1.500.000đ): 1.500.000 * 22% * 20% = 66.000đ
      // ĐP hỗ trợ (10% chuẩn nghèo): 1.500.000 * 22% * 10% = 33.000đ
      // Tổng hỗ trợ: 99.000đ
      // Người dân đóng: 781.000 - 99.000 = 682.000đ
      const result = calculateBHXH(3550000, 20, 10, '1', 0, '05/2026');
      expect(result.basePremium).toBe(781000);
      expect(result.nnSupportAmount).toBe(66000);
      expect(result.dpSupportAmount).toBe(33000);
      expect(result.amount).toBe(682000);
      expect(result.toMonth).toBe('05/2026');
    });

    it('Tính đúng chu kỳ đóng trước 6 tháng (pre_6) kèm chiết khấu lãi suất quỹ', () => {
      const result = calculateBHXH(1500000, 20, 0, 'pre_6', 0, '01/2026', 0.0031);
      expect(result.basePremium).toBe(330000 * 6); // 1.980.000đ
      expect(result.nnSupportAmount).toBe(66000 * 6); // 396.000đ
      expect(result.discountAmount).toBeGreaterThan(0);
      expect(result.amount).toBeLessThan(264000 * 6);
      expect(result.toMonth).toBe('06/2026');
    });

    it('Tính đúng chu kỳ đóng bù sau 3 tháng (post_custom) kèm lãi phạt nộp muộn', () => {
      const result = calculateBHXH(1500000, 20, 0, 'post_custom', 3, '01/2026', 0.0031);
      expect(result.basePremium).toBe(330000 * 3);
      expect(result.penaltyAmount).toBeGreaterThan(0);
      expect(result.amount).toBeGreaterThan(264000 * 3);
      expect(result.toMonth).toBe('03/2026');
    });

    it('Kiểm tra hàm validateBHXHIncome: chặn thu nhập dưới chuẩn nghèo (1.5M) hoặc vượt 20 lần lương cơ sở (46.8M / 50.6M)', () => {
      // Dưới chuẩn nghèo: không hợp lệ
      const lowCheck = validateBHXHIncome(1000000, 1500000, 2340000);
      expect(lowCheck.valid).toBe(false);
      expect(lowCheck.error).toContain('không được thấp hơn chuẩn nghèo');

      // Chuẩn nghèo (1.500.000đ): hợp lệ
      const minCheck = validateBHXHIncome(1500000, 1500000, 2340000);
      expect(minCheck.valid).toBe(true);

      // Mức thông thường (5.000.000đ): hợp lệ
      const normalCheck = validateBHXHIncome(5000000, 1500000, 2340000);
      expect(normalCheck.valid).toBe(true);

      // Mức trần 20 lần lương cơ sở 2.340.000đ (46.800.000đ): hợp lệ
      const maxCheck = validateBHXHIncome(46800000, 1500000, 2340000);
      expect(maxCheck.valid).toBe(true);

      // Vượt mức trần (50.000.000đ với lương cơ sở 2.340.000đ): không hợp lệ
      const overCheck = validateBHXHIncome(50000000, 1500000, 2340000);
      expect(overCheck.valid).toBe(false);
      expect(overCheck.error).toContain('không được vượt quá 20 lần mức lương cơ sở');

      // Với lương cơ sở mới 2.530.000đ (trần 50.600.000đ theo NĐ 161/2026)
      const newBaseCheck = validateBHXHIncome(50000000, 1500000, 2530000);
      expect(newBaseCheck.valid).toBe(true);
      const newBaseOver = validateBHXHIncome(51000000, 1500000, 2530000);
      expect(newBaseOver.valid).toBe(false);
    });

    it('calculateBHXH tự động ép mức thu nhập vào khoảng [chuẩn nghèo, 20x lương cơ sở]', () => {
      // Nhập thu nhập 500.000đ (dưới chuẩn nghèo 1.5M) -> tự động nâng lên 1.5M
      const underResult = calculateBHXH(500000, 20, 0, '1', 1, '01/2026');
      expect(underResult.basePremium).toBe(1500000 * 0.22); // 330.000đ

      // Nhập thu nhập 60.000.000đ (vượt 20x 2.34M = 46.8M) -> tự động giới hạn ở 46.8M
      const overResult = calculateBHXH(60000000, 20, 0, '1', 1, '01/2026');
      expect(overResult.basePremium).toBe(46800000 * 0.22); // 10.296.000đ
    });
  });

  describe('2. Tính toán BHYT Hộ gia đình (calculateBHYT)', () => {
    it('Tính đúng 1 người tham gia 12 tháng với mức lương cơ sở 2.340.000đ', () => {
      // 2.340.000 * 4.5% * 12 = 1.263.600đ
      const result = calculateBHYT(12, 1, 2340000);
      expect(result.amount).toBe(1263600);
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].label).toBe('100%');
      expect(result.breakdown[0].amount).toBe(1263600);
    });

    it('Tính đúng 1 người tham gia 3 tháng và 6 tháng', () => {
      // 3 tháng: 2.340.000 * 4.5% * 3 = 315.900đ
      expect(calculateBHYT(3, 1, 2340000).amount).toBe(315900);
      // 6 tháng: 2.340.000 * 4.5% * 6 = 631.800đ
      expect(calculateBHYT(6, 1, 2340000).amount).toBe(631800);
    });

    it('Tính đúng giảm trừ bậc thang cho hộ gia đình 5 người tham gia 12 tháng', () => {
      // Người 1 (100%): 1.263.600đ
      // Người 2 (70%):  884.520đ
      // Người 3 (60%):  758.160đ
      // Người 4 (50%):  631.800đ
      // Người 5 (40%):  505.440đ
      // Tổng: 4.043.520đ
      const result = calculateBHYT(12, 5, 2340000);
      expect(result.breakdown).toHaveLength(5);
      expect(result.breakdown[0].amount).toBe(1263600);
      expect(result.breakdown[1].amount).toBe(884520);
      expect(result.breakdown[2].amount).toBe(758160);
      expect(result.breakdown[3].amount).toBe(631800);
      expect(result.breakdown[4].amount).toBe(505440);
      expect(result.amount).toBe(4043520);
    });
  });

  describe('3. Tìm kiếm chính sách theo ngày hiệu lực (getPolicyValueForDate)', () => {
    const mockPolicies: Policy[] = [
      {
        id: 1,
        parameter_type: 'base_salary',
        name: 'Lương cơ sở 1.800.000đ',
        value: 1800000,
        effective_date: '2023-07-01',
        is_active: false
      },
      {
        id: 2,
        parameter_type: 'base_salary',
        name: 'Lương cơ sở 2.340.000đ',
        value: 2340000,
        effective_date: '2024-07-01',
        is_active: true
      }
    ];

    it('Lấy đúng lương cơ sở cũ trước ngày 01/07/2024', () => {
      const val = getPolicyValueForDate(mockPolicies, 'base_salary', '2024-01-15', 1800000);
      expect(val).toBe(1800000);
    });

    it('Lấy đúng lương cơ sở mới từ ngày 01/07/2024', () => {
      const val = getPolicyValueForDate(mockPolicies, 'base_salary', '2024-07-01', 1800000);
      expect(val).toBe(2340000);
    });

    it('Trả về giá trị mặc định nếu không có chính sách phù hợp', () => {
      const val = getPolicyValueForDate([], 'poverty_standard', '2026-01-01', 1500000);
      expect(val).toBe(1500000);
    });
  });

  describe('4. Xác định tỷ lệ hoa hồng thu (getCommissionRateForRecord)', () => {
    const mockSettings = {
      commBHXHNew: 6,
      commBHXHRenew: 3.5,
      commBHYTNew: 5,
      commBHYTRenew: 3
    };

    it('Xác định đúng hoa hồng BHXH Tăng mới', () => {
      const r = { type: 'BHXH', actionType: 'Đăng ký mới', date: '2026-08-01' };
      const rate = getCommissionRateForRecord(r, [], mockSettings);
      expect(rate).toBe(0.06); // 6%
    });

    it('Xác định đúng hoa hồng BHXH Gia hạn', () => {
      const r = { type: 'BHXH', actionType: 'Gia hạn', date: '2026-08-01' };
      const rate = getCommissionRateForRecord(r, [], mockSettings);
      expect(rate).toBe(0.035); // 3.5%
    });

    it('Xác định đúng hoa hồng BHYT Tăng mới', () => {
      const r = { type: 'BHYT', actionType: 'Đăng ký mới', date: '2026-08-01' };
      const rate = getCommissionRateForRecord(r, [], mockSettings);
      expect(rate).toBe(0.05); // 5%
    });

    it('Xác định đúng hoa hồng BHYT Gia hạn', () => {
      const r = { type: 'BHYT', actionType: 'Gia hạn', date: '2026-08-01' };
      const rate = getCommissionRateForRecord(r, [], mockSettings);
      expect(rate).toBe(0.03); // 3%
    });
  });

  describe('5. Tính toán BHYT Hộ gia đình đồng bộ ngày hết hạn (calculateBHYTCoterminous)', () => {
    it('Tính đúng mức đóng khi các thành viên có số tháng lẻ khác nhau (coterminous expiration)', () => {
      // Lương cơ sở: 2.340.000đ -> Mức đóng 1 tháng người thứ 1: 2.340.000 * 4.5% = 105.300đ
      // Người 1 (100%): 12 tháng -> 105.300 * 12 = 1.263.600đ
      // Người 2 (70%): 7 tháng -> (105.300 * 0.7) * 7 = 73.710 * 7 = 515.970đ
      // Người 3 (60%): 3 tháng -> (105.300 * 0.6) * 3 = 63.180 * 3 = 189.540đ
      // Tổng: 1.263.600 + 515.970 + 189.540 = 1.969.110đ
      const members = [
        { name: 'Nguyễn Văn A', durationMonths: 12 },
        { name: 'Trần Thị B', durationMonths: 7 },
        { name: 'Nguyễn Văn C', durationMonths: 3 },
      ];
      const result = calculateBHYTCoterminous(members, 2340000);
      expect(result.amount).toBe(1969110);
      expect(result.breakdown).toHaveLength(3);
      expect(result.breakdown[0].amount).toBe(1263600);
      expect(result.breakdown[1].amount).toBe(515970);
      expect(result.breakdown[2].amount).toBe(189540);
    });

    it('Tính đúng cho hộ 5 người với người thứ 5 áp dụng tỷ lệ 40%', () => {
      // Người 1: 105.300 * 6 = 631.800đ
      // Người 2 (70%): 73.710 * 6 = 442.260đ
      // Người 3 (60%): 63.180 * 6 = 379.080đ
      // Người 4 (50%): 52.650 * 6 = 315.900đ
      // Người 5 (40%): 42.120 * 6 = 252.720đ
      // Tổng = 2.021.760đ
      const members = [
        { durationMonths: 6 },
        { durationMonths: 6 },
        { durationMonths: 6 },
        { durationMonths: 6 },
        { durationMonths: 6 },
      ];
      const result = calculateBHYTCoterminous(members, 2340000);
      expect(result.amount).toBe(2021760);
      expect(result.breakdown[4].ratePct).toBe(40);
      expect(result.breakdown[4].amount).toBe(252720);
    });
  });

});
