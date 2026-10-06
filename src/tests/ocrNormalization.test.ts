import { describe, it, expect } from 'vitest';
import { formatOcrSalary, normalizeOcrPeriods } from '../utils/ocrHelper';

describe('OCR Normalization Unit Tests', () => {
  describe('formatOcrSalary', () => {
    it('formats state employee salary coefficients accurately', () => {
      const res1 = formatOcrSalary('2.34', 'nhanuoc');
      expect(res1.realType).toBe('nhanuoc');
      expect(res1.salary).toBe('2.34');

      const res2 = formatOcrSalary('2,67', 'batbuoc'); // should detect decimal coefficient
      expect(res2.realType).toBe('nhanuoc');
      expect(res2.salary).toBe('2.67');

      const res3 = formatOcrSalary('3.0', 'nhanuoc');
      expect(res3.realType).toBe('nhanuoc');
      expect(res3.salary).toBe('3.00');
    });

    it('formats enterprise salaries with Vietnamese thousand separators', () => {
      const res1 = formatOcrSalary('5000000', 'batbuoc');
      expect(res1.realType).toBe('batbuoc');
      expect(res1.salary).toBe('5.000.000');

      const res2 = formatOcrSalary('7,500,000', 'batbuoc');
      expect(res2.realType).toBe('batbuoc');
      expect(res2.salary).toBe('7.500.000');

      const res3 = formatOcrSalary('4.729.400', 'batbuoc');
      expect(res3.realType).toBe('batbuoc');
      expect(res3.salary).toBe('4.729.400');
    });

    it('formats voluntary insurance contributions', () => {
      const res = formatOcrSalary('2000000', 'tunguyen');
      expect(res.realType).toBe('tunguyen');
      expect(res.salary).toBe('2.000.000');
    });
  });

  describe('normalizeOcrPeriods', () => {
    it('sorts periods in ascending chronological order', () => {
      const input = [
        { type: 'batbuoc', sm: 1, sy: 2023, em: 12, ey: 2023, salary: '8,000,000' },
        { type: 'nhanuoc', sm: 1, sy: 2015, em: 12, ey: 2018, salary: '2.34' },
        { type: 'batbuoc', sm: 1, sy: 2019, em: 12, ey: 2022, salary: '6,500,000' }
      ];

      const result = normalizeOcrPeriods(input);
      expect(result).toHaveLength(3);
      expect(result[0]!.sy).toBe(2015);
      expect(result[0]!.salary).toBe('2.34');
      expect(result[1]!.sy).toBe(2019);
      expect(result[2]!.sy).toBe(2023);
    });

    it('handles 2-digit years and non-numeric month strings', () => {
      const input = [
        { type: 'nhanuoc', sm: 'T05', sy: '98', em: 'Tháng 12', ey: '02', salary: '1.86' },
        { type: 'batbuoc', sm: '01', sy: '23', em: '12', ey: '23', salary: '5000000' }
      ];

      const result = normalizeOcrPeriods(input);
      expect(result).toHaveLength(2);
      expect(result[0]!.sy).toBe(1998);
      expect(result[0]!.sm).toBe(5);
      expect(result[0]!.ey).toBe(2002);
      expect(result[0]!.em).toBe(12);

      expect(result[1]!.sy).toBe(2023);
      expect(result[1]!.ey).toBe(2023);
    });

    it('fixes inverted start and end dates', () => {
      const input = [
        { type: 'batbuoc', sm: 12, sy: 2022, em: 1, ey: 2020, salary: '6,000,000' }
      ];

      const result = normalizeOcrPeriods(input);
      expect(result[0]!.sy).toBe(2020);
      expect(result[0]!.sm).toBe(1);
      expect(result[0]!.ey).toBe(2022);
      expect(result[0]!.em).toBe(12);
    });

    it('fills zero or missing salary from previous valid period (maternity/leave scenario)', () => {
      const input = [
        { type: 'batbuoc', sm: 1, sy: 2021, em: 6, ey: 2021, salary: '7,000,000' },
        { type: 'batbuoc', sm: 7, sy: 2021, em: 12, ey: 2021, salary: '0' } // thai san TS
      ];

      const result = normalizeOcrPeriods(input);
      expect(result[1]!.salary).toBe('7.000.000');
    });
  });
});
