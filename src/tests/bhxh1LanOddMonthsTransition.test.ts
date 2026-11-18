import { describe, it, expect } from 'vitest';
import { calculateBHXH1LanBenefitYears } from '../utils/calculations';

describe('Kiểm thử công thức BHXH 1 lần - Quy tắc chuyển tháng lẻ trước 2014 (Khoản 4 Điều 19 Thông tư 59/2015/TT-BLĐTBXH)', () => {
  it('1. Ví dụ 34 Thông tư 59/2015: Ông T đóng 16 năm 4 tháng (10 năm 2 tháng trước 2014) -> Đúng 28.0 tháng Mbq', () => {
    // 10 năm 2 tháng trước 2014 = 122 tháng
    // 6 năm 2 tháng sau 2014 = 74 tháng
    // Tổng = 196 tháng
    const res = calculateBHXH1LanBenefitYears(122, 74);

    expect(res.totalMonths).toBe(196);
    expect(res.monthsPre).toBe(122);
    expect(res.monthsPost).toBe(74);

    // 02 tháng lẻ trước 2014 được chuyển sang sau 2014
    expect(res.preOddMonthsTransferred).toBe(2);
    expect(res.yearsPre).toBe(10); // 10 năm tròn x 1.5 = 15 tháng
    expect(res.monthsPostEffective).toBe(76); // 74 + 2 = 76 tháng = 6 năm 4 tháng
    expect(res.yearsPost).toBe(6.5); // 4 tháng lẻ (1..6) tính là 0.5 năm -> 6.5 năm x 2.0 = 13 tháng

    // Tổng hệ số tháng hưởng: 10 * 1.5 + 6.5 * 2.0 = 15 + 13 = 28 tháng
    expect(res.totalCoeffMonths).toBe(28);
    expect(res.explanation.transferNote).toContain('Áp dụng Khoản 4 Điều 19 TT 59/2015: 2 tháng lẻ trước 2014 được chuyển sang giai đoạn từ 2014 trở đi');
    expect(res.explanation.preText).toContain('10 năm × 1.5 = 15 tháng');
    expect(res.explanation.postText).toContain('6.5 năm × 2.0 = 13 tháng');
  });

  it('2. Người lao động chỉ có thời gian đóng trước 2014 có tháng lẻ (2 năm 5 tháng, sau 2014 = 0)', () => {
    // 2 năm 5 tháng = 29 tháng
    const res = calculateBHXH1LanBenefitYears(29, 0);

    expect(res.totalMonths).toBe(29);
    expect(res.preOddMonthsTransferred).toBe(5);
    expect(res.yearsPre).toBe(2); // 2 năm trước 2014 x 1.5 = 3.0 tháng
    expect(res.monthsPostEffective).toBe(5); // 5 tháng chuyển sang sau 2014
    expect(res.yearsPost).toBe(0.5); // 5 tháng lẻ (1..6) tính là 0.5 năm x 2.0 = 1.0 tháng

    // Tổng = 3.0 + 1.0 = 4.0 tháng
    expect(res.totalCoeffMonths).toBe(4.0);
  });

  it('3. Tháng lẻ trước 2014 kết hợp với tháng lẻ sau 2014 đủ làm tròn lên 1 năm (3 năm 8T trước, 2 năm 2T sau)', () => {
    // Trước 2014: 3 năm 8 tháng = 44 tháng
    // Sau 2014: 2 năm 2 tháng = 26 tháng
    const res = calculateBHXH1LanBenefitYears(44, 26);

    expect(res.preOddMonthsTransferred).toBe(8);
    expect(res.yearsPre).toBe(3); // 3 năm x 1.5 = 4.5 tháng
    expect(res.monthsPostEffective).toBe(34); // 26 + 8 = 34 tháng = 2 năm 10 tháng
    expect(res.yearsPost).toBe(3.0); // 10 tháng lẻ (7..11) tính là 1 năm -> 2 + 1 = 3 năm x 2.0 = 6.0 tháng

    // Tổng = 4.5 + 6.0 = 10.5 tháng
    expect(res.totalCoeffMonths).toBe(10.5);
  });

  it('4. Trường hợp trước 2014 là năm tròn (không có tháng lẻ chuyển tiếp)', () => {
    // Trước 2014: 5 năm tròn = 60 tháng
    // Sau 2014: 3 năm 7 tháng = 43 tháng
    const res = calculateBHXH1LanBenefitYears(60, 43);

    expect(res.preOddMonthsTransferred).toBe(0);
    expect(res.yearsPre).toBe(5); // 5 x 1.5 = 7.5 tháng
    expect(res.monthsPostEffective).toBe(43); // 3 năm 7 tháng
    expect(res.yearsPost).toBe(4.0); // 7 tháng lẻ tính 1 năm -> 4 năm x 2.0 = 8.0 tháng

    // Tổng = 7.5 + 8.0 = 15.5 tháng
    expect(res.totalCoeffMonths).toBe(15.5);
    expect(res.explanation.transferNote).toBeUndefined();
  });

  it('5. Trường hợp chỉ đóng từ năm 2014 trở đi (không có thời gian trước 2014)', () => {
    // Trước 2014: 0 tháng
    // Sau 2014: 3 năm 4 tháng = 40 tháng
    const res = calculateBHXH1LanBenefitYears(0, 40);

    expect(res.preOddMonthsTransferred).toBe(0);
    expect(res.yearsPre).toBe(0);
    expect(res.monthsPostEffective).toBe(40);
    expect(res.yearsPost).toBe(3.5); // 4 tháng lẻ tính 0.5 năm -> 3.5 năm x 2.0 = 7.0 tháng

    expect(res.totalCoeffMonths).toBe(7.0);
  });

  it('6. Trường hợp tổng thời gian dưới 12 tháng (< 1 năm)', () => {
    // 5 tháng trước 2014, 4 tháng sau 2014 -> Tổng 9 tháng
    const res = calculateBHXH1LanBenefitYears(5, 4);

    expect(res.totalMonths).toBe(9);
    expect(res.totalCoeffMonths).toBe(0);
    expect(res.explanation.totalText).toContain('dưới 12 tháng');
  });

  it('7. Tháng lẻ trước 2014 dồn sang sau 2014 vừa đúng tròn năm (1 năm 6T trước, 1 năm 6T sau)', () => {
    // Trước: 18 tháng (1 năm 6T)
    // Sau: 18 tháng (1 năm 6T)
    const res = calculateBHXH1LanBenefitYears(18, 18);

    expect(res.preOddMonthsTransferred).toBe(6);
    expect(res.yearsPre).toBe(1); // 1 x 1.5 = 1.5 tháng
    expect(res.monthsPostEffective).toBe(24); // 18 + 6 = 24 tháng = 2 năm tròn
    expect(res.yearsPost).toBe(2.0); // 2 x 2.0 = 4.0 tháng

    // Tổng = 1.5 + 4.0 = 5.5 tháng
    expect(res.totalCoeffMonths).toBe(5.5);
  });
});
