import { describe, it, expect } from 'vitest';
import { calculateBHYTCoterminous } from '../utils/calculations';

describe('Kiểm thử BHYT Hộ gia đình đồng bộ kỳ hạn (Coterminous Expiration Test Suite)', () => {
  const BASE_SALARY_2026 = 2340000; // Lương cơ sở hiện hành: 2.340.000 VNĐ
  const MONTHLY_BASE_PREMIUM = BASE_SALARY_2026 * 0.045; // 105.300 VNĐ / tháng cho người thứ nhất

  describe('1. Kịch bản nghiệp vụ chuẩn: Hộ gia đình 5 thành viên [12, 10, 8, 6, 3] tháng', () => {
    const familyMembers = [
      { name: 'Nguyễn Văn Chủ Hộ', durationMonths: 12 }, // Người 1: 100%
      { name: 'Trần Thị Vợ', durationMonths: 10 },       // Người 2: 70%
      { name: 'Nguyễn Con Cả', durationMonths: 8 },       // Người 3: 60%
      { name: 'Nguyễn Con Thứ', durationMonths: 6 },      // Người 4: 50%
      { name: 'Nguyễn Con Út', durationMonths: 3 }        // Người 5: 40%
    ];

    it('Xác nhận mức đóng cơ sở 1 tháng đạt chuẩn 105.300 VNĐ', () => {
      expect(MONTHLY_BASE_PREMIUM).toBe(105300);
    });

    it('Tính chính xác số tiền cho từng thành viên theo bậc thang giảm trừ NĐ 146/2018', () => {
      const result = calculateBHYTCoterminous(familyMembers, BASE_SALARY_2026);

      expect(result.breakdown).toHaveLength(5);

      // Người 1: 100% rate, 12 tháng -> 105.300 * 12 = 1.263.600 VNĐ
      const m1 = result.breakdown[0];
      expect(m1.ratePct).toBe(100);
      expect(m1.monthlyPremium).toBe(105300);
      expect(m1.amount).toBe(1263600);

      // Người 2: 70% rate, 10 tháng -> 73.710 * 10 = 737.100 VNĐ
      const m2 = result.breakdown[1];
      expect(m2.ratePct).toBe(70);
      expect(m2.monthlyPremium).toBe(73710);
      expect(m2.amount).toBe(737100);

      // Người 3: 60% rate, 8 tháng -> 63.180 * 8 = 505.440 VNĐ
      const m3 = result.breakdown[2];
      expect(m3.ratePct).toBe(60);
      expect(m3.monthlyPremium).toBe(63180);
      expect(m3.amount).toBe(505440);

      // Người 4: 50% rate, 6 tháng -> 52.650 * 6 = 315.900 VNĐ
      const m4 = result.breakdown[3];
      expect(m4.ratePct).toBe(50);
      expect(m4.monthlyPremium).toBe(52650);
      expect(m4.amount).toBe(315900);

      // Người 5: 40% rate, 3 tháng -> 42.120 * 3 = 126.360 VNĐ
      const m5 = result.breakdown[4];
      expect(m5.ratePct).toBe(40);
      expect(m5.monthlyPremium).toBe(42120);
      expect(m5.amount).toBe(126360);
    });

    it('Xác nhận tổng tiền toàn hộ đạt chính xác 2.948.400 VNĐ và sai số làm tròn bằng 0', () => {
      const result = calculateBHYTCoterminous(familyMembers, BASE_SALARY_2026);
      
      const expectedTotal = 1263600 + 737100 + 505440 + 315900 + 126360;
      expect(expectedTotal).toBe(2948400);
      expect(result.amount).toBe(2948400);

      // Kiểm tra tổng từng phần tử khớp chính xác với kết quả tổng trả về
      const sumBreakdown = result.breakdown.reduce((acc, item) => acc + item.amount, 0);
      expect(sumBreakdown).toBe(result.amount);
    });
  });

  describe('2. Kiểm thử các trường hợp biên & ngoại lệ (Edge Cases)', () => {
    it('Trường hợp tối thiểu: Hộ 1 người đóng 1 tháng lẻ', () => {
      const result = calculateBHYTCoterminous([{ name: 'Độc thân', durationMonths: 1 }], BASE_SALARY_2026);
      expect(result.amount).toBe(105300);
      expect(result.breakdown[0].ratePct).toBe(100);
      expect(result.breakdown[0].durationMonths).toBe(1);
    });

    it('Trường hợp hộ 2 người cùng đóng trọn vẹn 12 tháng', () => {
      const result = calculateBHYTCoterminous([
        { name: 'Người 1', durationMonths: 12 },
        { name: 'Người 2', durationMonths: 12 }
      ], BASE_SALARY_2026);

      // Người 1: 1.263.600
      // Người 2: 73.710 * 12 = 884.520
      // Tổng: 2.148.120 VNĐ
      expect(result.amount).toBe(2148120);
      expect(result.breakdown[0].amount).toBe(1263600);
      expect(result.breakdown[1].amount).toBe(884520);
    });

    it('Trường hợp hộ trên 5 người (người thứ 6 và 7 vẫn giữ nguyên tỷ lệ 40%)', () => {
      const members = [
        { durationMonths: 12 },
        { durationMonths: 12 },
        { durationMonths: 12 },
        { durationMonths: 12 },
        { durationMonths: 12 },
        { durationMonths: 12 }, // Người thứ 6
        { durationMonths: 12 }  // Người thứ 7
      ];
      const result = calculateBHYTCoterminous(members, BASE_SALARY_2026);
      expect(result.breakdown[5].ratePct).toBe(40);
      expect(result.breakdown[6].ratePct).toBe(40);
      expect(result.breakdown[5].amount).toBe(42120 * 12); // 505.440
      expect(result.breakdown[6].amount).toBe(42120 * 12); // 505.440
    });

    it('Phòng thủ dữ liệu: Tự động fallback về 12 tháng nếu durationMonths bị khuyết hoặc bằng 0', () => {
      const members = [
        { name: 'Khuyết số tháng' } as any,
        { name: 'Số tháng 0', durationMonths: 0 }
      ];
      const result = calculateBHYTCoterminous(members, BASE_SALARY_2026);
      expect(result.breakdown[0].durationMonths).toBe(12);
      expect(result.breakdown[1].durationMonths).toBe(12);
      expect(result.breakdown[0].amount).toBe(1263600);
      expect(result.breakdown[1].amount).toBe(884520);
    });
  });
});
