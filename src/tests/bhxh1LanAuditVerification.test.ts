import { describe, it, expect } from 'vitest';
import { calculateBHXH1LanBenefitYears } from '../utils/calculations';
import fs from 'fs';
import path from 'path';

describe('Audit Toàn Diện Nghiệp Vụ Chuẩn Hóa BHXH 1 Lần (TT 59/2015/TT-BLĐTBXH)', () => {
  const calcPath = path.resolve(__dirname, '../components/calculators/BHXH1LanCalc.tsx');
  const calcCode = fs.readFileSync(calcPath, 'utf-8');

  describe('1. Kiểm tra đối soát thuật toán chuyển tiếp tháng lẻ trước năm 2014', () => {
    it('1.1. Ví dụ 34 Thông tư 59/2015: Ông T đóng 16 năm 4 tháng (10 năm 2 tháng trước 2014) đạt chính xác 28 tháng Mbq', () => {
      // Trước 2014: 122 tháng = 10 năm 2 tháng
      // Từ 2014: 74 tháng = 6 năm 2 tháng
      const res = calculateBHXH1LanBenefitYears(122, 74);
      expect(res.totalMonths).toBe(196);
      expect(res.yearsPre).toBe(10);
      expect(res.preOddMonthsTransferred).toBe(2);
      expect(res.monthsPostEffective).toBe(76); // 6 năm 4 tháng
      expect(res.yearsPost).toBe(6.5);
      expect(res.totalCoeffMonths).toBe(28); // 10 * 1.5 + 6.5 * 2.0 = 28
    });

    it('1.2. Ca biên: 6 tháng trước 2014 + 6 tháng sau 2014 (vừa đủ 12 tháng)', () => {
      // 6 tháng trước 2014 chuyển sang sau 2014 -> sau 2014 có 12 tháng tròn = 1.0 năm
      const res = calculateBHXH1LanBenefitYears(6, 6);
      expect(res.totalMonths).toBe(12);
      expect(res.yearsPre).toBe(0);
      expect(res.preOddMonthsTransferred).toBe(6);
      expect(res.monthsPostEffective).toBe(12);
      expect(res.yearsPost).toBe(1.0);
      expect(res.totalCoeffMonths).toBe(2.0); // 1.0 * 2.0 = 2.0 tháng
    });

    it('1.3. Ca biên: 11 tháng trước 2014 + 1 tháng sau 2014 (chuyển 11 tháng lẻ sang sau)', () => {
      const res = calculateBHXH1LanBenefitYears(11, 1);
      expect(res.totalMonths).toBe(12);
      expect(res.yearsPre).toBe(0);
      expect(res.preOddMonthsTransferred).toBe(11);
      expect(res.monthsPostEffective).toBe(12);
      expect(res.yearsPost).toBe(1.0);
      expect(res.totalCoeffMonths).toBe(2.0);
    });

    it('1.4. Ca biên: Tròn 12 tháng trước 2014 (không có thời gian sau 2014)', () => {
      const res = calculateBHXH1LanBenefitYears(12, 0);
      expect(res.totalMonths).toBe(12);
      expect(res.yearsPre).toBe(1);
      expect(res.preOddMonthsTransferred).toBe(0);
      expect(res.monthsPostEffective).toBe(0);
      expect(res.yearsPost).toBe(0);
      expect(res.totalCoeffMonths).toBe(1.5); // 1 * 1.5 = 1.5 tháng
    });

    it('1.5. Ca biên: Đóng 2 năm 7 tháng trước 2014 (sau 2014 = 0)', () => {
      // 31 tháng = 2 năm 7 tháng
      // 7 tháng lẻ chuyển sang sau 2014 -> từ 7..11 tháng quy đổi thành 1.0 năm sau 2014
      const res = calculateBHXH1LanBenefitYears(31, 0);
      expect(res.yearsPre).toBe(2); // 2 * 1.5 = 3.0 tháng
      expect(res.preOddMonthsTransferred).toBe(7);
      expect(res.monthsPostEffective).toBe(7);
      expect(res.yearsPost).toBe(1.0); // 1.0 * 2.0 = 2.0 tháng
      expect(res.totalCoeffMonths).toBe(5.0); // 3.0 + 2.0 = 5.0 tháng
    });

    it('1.6. Dưới 12 tháng không áp dụng hệ số năm mà tính theo 22% mức đóng', () => {
      const res = calculateBHXH1LanBenefitYears(5, 5);
      expect(res.totalMonths).toBe(10);
      expect(res.totalCoeffMonths).toBe(0);
      expect(res.explanation.totalText).toContain('dưới 12 tháng');
    });

    it('1.7. Kiểm tra độ bền với giá trị âm hoặc null/undefined', () => {
      const res = calculateBHXH1LanBenefitYears(-5 as any, null as any);
      expect(res.totalMonths).toBe(0);
      expect(res.totalCoeffMonths).toBe(0);
    });
  });

  describe('2. Kiểm tra tính toàn vẹn tích hợp mã nguồn trong BHXH1LanCalc.tsx', () => {
    it('2.1. Đã import và sử dụng calculateBHXH1LanBenefitYears', () => {
      expect(calcCode).toContain("import { getPolicyValueForDate, calculateBHXH1LanBenefitYears } from '../../utils/calculations';");
      expect(calcCode).toContain("const benefitYears = calculateBHXH1LanBenefitYears(mPreCount, mPostCount);");
    });

    it('2.2. res1Time và survivorBase sử dụng totalCoeffMonths chuẩn hóa', () => {
      expect(calcCode).toContain("const res1Time = Math.round(tM < 12 ? (mbq * tM * 0.22) : (mbq * totalCoeffMonths) - tD);");
      expect(calcCode).toContain("const survivorBase = mbq * totalCoeffMonths;");
    });

    it('2.3. systemCore lưu trữ đầy đủ các thuộc tính chuyển tiếp tháng lẻ', () => {
      expect(calcCode).toContain("preOddMonthsTransferred,");
      expect(calcCode).toContain("monthsPostEffective,");
      expect(calcCode).toContain("totalCoeffMonths,");
      expect(calcCode).toContain("benefitExplanation,");
    });

    it('2.4. Giao diện hiển thị rõ ràng căn cứ Khoản 4 Điều 19 TT 59/2015', () => {
      expect(calcCode).toContain("Khoản 4 Điều 19 TT 59/2015:");
      expect(calcCode).toContain("tháng lẻ trước 2014 được chuyển sang giai đoạn từ 2014");
    });

    it('2.5. Biểu mẫu xuất PDF có ghi chú chuyển tiếp tháng lẻ và trích dẫn TT 59/2015', () => {
      expect(calcCode).toContain("Khoản 4 Điều 19 Thông tư 59/2015/TT-BLĐTBXH");
      expect(calcCode).toContain("Chuyển tháng lẻ chuyển tiếp: Đã chuyển");
    });
  });
});
