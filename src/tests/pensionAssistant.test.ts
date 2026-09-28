import { describe, it, expect } from 'vitest';
import { calculatePensionEffortRating } from '../utils/calculations';

describe('PensionAssistant - calculatePensionEffortRating Unit Tests', () => {
  it('handles unspecified actual income (actualIncome <= 0)', () => {
    // Premium <= 350.000
    const rating1 = calculatePensionEffortRating(264000, 0, 20, 0, 1500000, 1500000);
    expect(rating1.ratingText).toBe('Tiết kiệm tối đa');
    expect(rating1.effortLevel).toBe('very_light');

    // Premium 350.001 - 700.000
    const rating2 = calculatePensionEffortRating(600000, 0, 20, 0, 3000000, 1500000);
    expect(rating2.ratingText).toBe('Tối ưu chi phí');
    expect(rating2.effortLevel).toBe('optimal');

    // Premium 700.001 - 1.200.000
    const rating3 = calculatePensionEffortRating(900000, 0, 20, 0, 4500000, 1500000);
    expect(rating3.ratingText).toBe('Cân bằng tài chính');
    expect(rating3.effortLevel).toBe('balanced');

    // Premium > 1.200.000
    const rating4 = calculatePensionEffortRating(1500000, 0, 20, 0, 8000000, 1500000);
    expect(rating4.ratingText).toBe('Áp lực tài chính');
    expect(rating4.effortLevel).toBe('moderate');
  });

  it('correctly classifies poverty standard minimum floor', () => {
    // When chosenBHXH is at or below poverty line (1.500.000)
    const rating = calculatePensionEffortRating(264000, 10000000, 20, 2.64, 1500000, 1500000);
    expect(rating.ratingText).toBe('Tiết kiệm tối đa');
    expect(rating.effortLevel).toBe('very_light');
  });

  it('accurately differentiates 5 roadmaps for the user scenario (Income 10M, Pension 3M)', () => {
    // 15 years: ratio 13.0% -> 'Áp lực vừa - Hưởng sớm'
    const r15 = calculatePensionEffortRating(1300000, 10000000, 15, 13.0, 6000000, 1500000);
    expect(r15.ratingText).toBe('Áp lực vừa - Hưởng sớm');
    expect(r15.effortLevel).toBe('moderate');
    expect(r15.ratingBg).toContain('amber');

    // 20 years: ratio 9.5% -> 'Cân bằng - Vừa sức'
    const r20 = calculatePensionEffortRating(950000, 10000000, 20, 9.5, 4500000, 1500000);
    expect(r20.ratingText).toBe('Cân bằng - Vừa sức');
    expect(r20.effortLevel).toBe('balanced');
    expect(r20.ratingBg).toContain('teal');

    // 25 years: ratio 5.7% -> 'Tối ưu tài chính'
    const r25 = calculatePensionEffortRating(570000, 10000000, 25, 5.7, 3000000, 1500000);
    expect(r25.ratingText).toBe('Tối ưu tài chính');
    expect(r25.effortLevel).toBe('optimal');
    expect(r25.ratingBg).toContain('emerald');

    // 30 years: ratio 3.9% -> 'Rất nhẹ nhàng'
    const r30 = calculatePensionEffortRating(390000, 10000000, 30, 3.9, 2000000, 1500000);
    expect(r30.ratingText).toBe('Rất nhẹ nhàng');
    expect(r30.effortLevel).toBe('very_light');
    expect(r30.ratingBg).toContain('indigo');

    // 35 years: ratio 2.6% -> 'Tiết kiệm tối đa'
    const r35 = calculatePensionEffortRating(260000, 10000000, 35, 2.6, 1600000, 1500000);
    expect(r35.ratingText).toBe('Tiết kiệm tối đa');
    expect(r35.effortLevel).toBe('very_light');
    expect(r35.ratingBg).toContain('sky');
  });

  it('adapts thresholds dynamically for low income (<= 6M) and high ratio', () => {
    // Low income (5M) with 1.3M payment -> ratio 26% -> High burden
    const rLowHighRatio = calculatePensionEffortRating(1300000, 5000000, 15, 26.0, 6000000, 1500000);
    expect(rLowHighRatio.ratingText).toBe('Áp lực cao - Cần cân nhắc');
    expect(rLowHighRatio.effortLevel).toBe('high');
    expect(rLowHighRatio.ratingBg).toContain('rose');
  });

  it('adapts thresholds dynamically for high income (>= 20M)', () => {
    // High income (30M) with 1.3M payment -> ratio 4.3% -> Very light
    const rHigh = calculatePensionEffortRating(1300000, 30000000, 15, 4.33, 6000000, 1500000);
    expect(rHigh.ratingText).toBe('Rất nhẹ nhàng');
    expect(rHigh.effortLevel).toBe('very_light');
  });
});
