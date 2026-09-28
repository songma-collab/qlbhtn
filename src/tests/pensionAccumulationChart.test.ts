import { describe, it, expect } from 'vitest';
import {
  calculatePensionRate2024,
  getCpiMultiplier,
  generateAccumulationTimeline,
  generateBreakEvenAnalysis
} from '../utils/pensionAccumulation';
import { calculateBHXH } from '../utils/calculations';

describe('Kiểm thử Mô Phỏng Lương Hưu Luật BHXH 2024 & Điểm Hòa Vốn Hưu Trí', () => {
  describe('1. Xác thực công thức tỷ lệ hưởng lương hưu theo Luật BHXH 2024', () => {
    it('Chưa đủ 15 năm đóng: tỷ lệ hưu bằng 0%', () => {
      expect(calculatePensionRate2024(10, 'female')).toBe(0);
      expect(calculatePensionRate2024(14, 'male')).toBe(0);
    });

    it('Nữ giới: 15 năm = 45%, mỗi năm thêm +2%, tối đa 75% tại 30 năm', () => {
      expect(calculatePensionRate2024(15, 'female')).toBe(0.45);
      expect(calculatePensionRate2024(16, 'female')).toBe(0.47);
      expect(calculatePensionRate2024(20, 'female')).toBe(0.55);
      expect(calculatePensionRate2024(25, 'female')).toBe(0.65);
      expect(calculatePensionRate2024(30, 'female')).toBe(0.75);
      expect(calculatePensionRate2024(35, 'female')).toBe(0.75); // Không vượt quá trần 75%
    });

    it('Nam giới: 15 năm = 40%, 15-20 năm mỗi năm +1%, sau đó mỗi năm +2%, tối đa 75% tại 35 năm', () => {
      expect(calculatePensionRate2024(15, 'male')).toBe(0.40);
      expect(calculatePensionRate2024(16, 'male')).toBe(0.41);
      expect(calculatePensionRate2024(19, 'male')).toBe(0.44);
      expect(calculatePensionRate2024(20, 'male')).toBe(0.45);
      expect(calculatePensionRate2024(21, 'male')).toBe(0.47);
      expect(calculatePensionRate2024(25, 'male')).toBe(0.55);
      expect(calculatePensionRate2024(30, 'male')).toBe(0.65);
      expect(calculatePensionRate2024(35, 'male')).toBe(0.75);
      expect(calculatePensionRate2024(38, 'male')).toBe(0.75); // Không vượt quá trần 75%
    });
  });

  describe('2. Xác thực chuỗi tích lũy đóng phí & Lương hưu tháng (Chế độ 1)', () => {
    it('Tính chính xác tiền cá nhân thực nộp, NSNN hỗ trợ và quỹ tích lũy theo năm', () => {
      const timeline = generateAccumulationTimeline({
        income: 3000000,
        gender: 'female',
        povertyStandard: 1500000,
        nsnnRate: 20, // 20% của 1.500.000 * 22% = 66.000đ/tháng
        dpRate: 0,
        applyCpi: false,
        maxYears: 35
      });

      expect(timeline).toHaveLength(35);

      // Tháng đầu tiên
      const y1 = timeline[0];
      expect(y1.grossMonthly).toBe(660000); // 3.000.000 * 22%
      expect(y1.supportMonthly).toBe(66000); // 1.500.000 * 22% * 20%
      expect(y1.personalMonthly).toBe(594000); // 660.000 - 66.000
      expect(y1.cumulativePersonal).toBe(594000 * 12);
      expect(y1.cumulativeSupport).toBe(66000 * 12);
      expect(y1.totalAccumulated).toBe(660000 * 12);
      expect(y1.isEligibleForPension).toBe(false);
      expect(y1.monthlyPension).toBe(0);

      // Mốc năm thứ 15 (Đủ điều kiện hưởng lương hưu)
      // Theo Luật BHXH 2024 & NĐ 159/2025: NSNN hỗ trợ tối đa 10 năm (120 tháng)
      // 10 năm đầu: 120 * 594.000 = 71.280.000đ
      // 5 năm sau: 60 * 660.000 = 39.600.000đ
      // Tổng cá nhân nộp: 71.280.000 + 39.600.000 = 110.880.000đ
      const y15 = timeline[14];
      expect(y15.year).toBe(15);
      expect(y15.isEligibleForPension).toBe(true);
      expect(y15.pensionRatePct).toBe(45);
      expect(y15.cumulativePersonal).toBe(110880000);
      expect(y15.cumulativeSupport).toBe(66000 * 120); // Dừng ở 10 năm = 7.920.000đ
      expect(y15.totalAccumulated).toBe(660000 * 180); // 118.800.000đ
      expect(y15.monthlyPension).toBe(1350000); // 3.000.000 * 45%

      // Mốc năm thứ 30 (Kịch trần 75% cho Nữ)
      // 10 năm đầu: 120 * 594.000 = 71.280.000đ
      // 20 năm sau: 240 * 660.000 = 158.400.000đ
      // Tổng cá nhân nộp: 71.280.000 + 158.400.000 = 229.680.000đ
      const y30 = timeline[29];
      expect(y30.year).toBe(30);
      expect(y30.pensionRatePct).toBe(75);
      expect(y30.cumulativePersonal).toBe(229680000);
      expect(y30.cumulativeSupport).toBe(66000 * 120); // Vẫn giữ nguyên 7.920.000đ
      expect(y30.monthlyPension).toBe(2250000); // 3.000.000 * 75%
    });

    it('Xác thực chuẩn nghèo: NSNN chỉ hỗ trợ tối đa 10 năm (120 tháng), sau 10 năm đóng đủ 100% gốc', () => {
      // 15 năm mức chuẩn nghèo 1.500.000đ:
      // Gốc: 330.000đ/tháng. Hỗ trợ 20% = 66.000đ. Thực nộp 10 năm đầu = 264.000đ/tháng.
      // 15 năm = 120 tháng * 264.000 + 60 tháng * 330.000 = 31.680.000 + 19.800.000 = 51.480.000đ
      const analysis15 = generateBreakEvenAnalysis({
        roadmapYears: 15,
        income: 1500000,
        gender: 'male',
        povertyStandard: 1500000,
        baseSalary: 2340000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: false
      });

      expect(analysis15.totalContributed).toBe(51480000); // 264.000 * 120 + 330.000 * 60
      expect(analysis15.supportedYears).toBe(10);
      expect(analysis15.unsupportedYears).toBe(5);

      // 25 năm mức chuẩn nghèo 1.500.000đ:
      // 25 năm = 120 tháng * 264.000 + 180 tháng * 330.000 = 31.680.000 + 59.400.000 = 91.080.000đ
      const analysis25 = generateBreakEvenAnalysis({
        roadmapYears: 25,
        income: 1500000,
        gender: 'male',
        povertyStandard: 1500000,
        baseSalary: 2340000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: false
      });

      expect(analysis25.totalContributed).toBe(91080000); // 264.000 * 120 + 330.000 * 180
      expect(analysis25.supportedYears).toBe(10);
      expect(analysis25.unsupportedYears).toBe(15);
    });

    it('Xác thực điều chỉnh trượt giá CPI làm tăng giá trị thu nhập bình quân và lương hưu', () => {
      const timelineWithoutCpi = generateAccumulationTimeline({
        income: 5000000,
        gender: 'male',
        povertyStandard: 1500000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: false
      });

      const timelineWithCpi = generateAccumulationTimeline({
        income: 5000000,
        gender: 'male',
        povertyStandard: 1500000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: true
      });

      const pensionWithoutCpi = timelineWithoutCpi[19].monthlyPension; // 20 năm = 45%
      const pensionWithCpi = timelineWithCpi[19].monthlyPension;

      expect(pensionWithoutCpi).toBe(2250000); // 5.000.000 * 45%
      expect(pensionWithCpi).toBeGreaterThan(pensionWithoutCpi);
    });
  });

  describe('3. Xác thực Dòng tiền nhận lương hưu & Điểm hòa vốn an sinh (Chế độ 2)', () => {
    it('Tính điểm hòa vốn an sinh hưu trí chính xác (thường chỉ mất từ 2 đến 6 năm)', () => {
      const analysis = generateBreakEvenAnalysis({
        roadmapYears: 20,
        income: 5000000,
        gender: 'male',
        povertyStandard: 1500000,
        baseSalary: 2340000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: true,
        retirementHorizonYears: 25
      });

      // Tổng vốn cá nhân đã đóng
      expect(analysis.totalContributed).toBeGreaterThan(0);
      // Lương hưu tháng
      expect(analysis.monthlyPension).toBeGreaterThan(0);
      // Giá trị BHYT miễn phí mỗi năm (4.5% lương cơ sở)
      expect(analysis.annualBHYTValue).toBe(Math.round(2340000 * 0.045 * 12));
      // Điểm hòa vốn hợp lý
      expect(analysis.breakEvenYears).toBeGreaterThan(1);
      expect(analysis.breakEvenYears).toBeLessThanOrEqual(8);

      // Điểm hòa vốn trong timeline
      const breakEvenItem = analysis.timeline.find(t => t.isBreakeven);
      expect(breakEvenItem).toBeDefined();
      expect(breakEvenItem!.netSurplus).toBeGreaterThanOrEqual(0);

      // Đến năm thứ 25 hưu trí: giá trị an sinh nhận được gấp nhiều lần tổng vốn đóng
      const finalYear = analysis.timeline[24];
      expect(finalYear.cumulativeBenefitWithBHYT).toBeGreaterThan(analysis.totalContributed * 3);
    });
  });

  describe('4. Xác thực Bảng so sánh các phương thức đóng & Chiết khấu đóng trước', () => {
    it('Các phương thức đóng trước (24, 36, 60 tháng) được chiết khấu giảm trừ lãi suất', () => {
      const monthly = calculateBHXH(3000000, 20, 0, '1', 1);
      const quarterly = calculateBHXH(3000000, 20, 0, '3', 1);
      const yearly = calculateBHXH(3000000, 20, 0, '12', 1);
      const pre2Years = calculateBHXH(3000000, 20, 0, 'pre_24', 1);
      const pre5Years = calculateBHXH(3000000, 20, 0, 'pre_60', 1);

      // Đóng hàng tháng: không có chiết khấu
      expect(monthly.discountAmount).toBe(0);
      // Đóng theo quý và năm thông thường
      expect(quarterly.discountAmount).toBe(0);
      expect(yearly.discountAmount).toBe(0);

      // Đóng trước 2 năm và 5 năm: có khoản chiết khấu ưu đãi do lãi suất quỹ BHXH
      expect(pre2Years.discountAmount).toBeGreaterThan(0);
      expect(pre5Years.discountAmount).toBeGreaterThan(pre2Years.discountAmount);

      // Số tiền thực đóng của gói đóng trước nhỏ hơn mức đóng nhân số tháng
      const raw24MonthsTotal = (monthly.basePremium - monthly.nnSupportAmount) * 24;
      expect(pre2Years.amount).toBeLessThan(raw24MonthsTotal);
    });
  });

  describe('5. Xác thực tính năng xuất biểu đồ & hồ sơ dự phòng (PNG 2x & PDF A4)', () => {
    it('Module exportPensionProjection định nghĩa đầy đủ các hàm xuất file chất lượng cao', async () => {
      const exportModule = await import('../utils/exportPensionProjection');
      expect(typeof exportModule.exportChartToPNG).toBe('function');
      expect(typeof exportModule.exportPensionProjectionToPDF).toBe('function');
    });

    it('Xác thực cấu trúc thông số đầu vào cho hồ sơ PDF theo Luật BHXH 2024', () => {
      const breakEvenData = generateBreakEvenAnalysis({
        roadmapYears: 20,
        income: 3000000,
        gender: 'female',
        povertyStandard: 1500000,
        baseSalary: 2340000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: true
      });

      const params = {
        roadmapYears: 20,
        income: 3000000,
        gender: 'female' as const,
        povertyStandard: 1500000,
        baseSalary: 2340000,
        nsnnRate: 20,
        dpRate: 0,
        applyCpi: true,
        breakEvenData,
        agencyName: 'ĐẠI LÝ THU BHXH SÔNG MÃ'
      };

      expect(params.roadmapYears).toBe(20);
      expect(params.breakEvenData.monthlyPension).toBeGreaterThan(0);
      expect(params.breakEvenData.supportedYears).toBe(10);
      expect(params.breakEvenData.unsupportedYears).toBe(10);
      expect(params.breakEvenData.breakEvenYears).toBeGreaterThan(0);
    });
  });
});

