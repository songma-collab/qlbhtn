import { describe, it, expect } from 'vitest';
import {
  formatMonthInput,
  monthISOToVN,
  parseMonthISO,
  formatDateVN,
  formatMonthVN,
  isDateLocked
} from '../utils/helpers';

describe('Financial Lock & Date Healing Regression Tests', () => {
  describe('Date Helpers & Anomaly Year 0264 Healing', () => {
    it('should heal 0264 and 264 years in parseMonthISO', () => {
      expect(parseMonthISO('02/0264')).toBe('2026-02');
      expect(parseMonthISO('04/264')).toBe('2026-04');
      expect(parseMonthISO('04/2026')).toBe('2026-04');
      expect(parseMonthISO('2026-04')).toBe('2026-04');
      expect(parseMonthISO('2026/04')).toBe('2026-04');
      expect(parseMonthISO('15/04/2026')).toBe('2026-04');
      expect(parseMonthISO('2026-04-15')).toBe('2026-04');
    });

    it('should heal 0264 and 264 years in monthISOToVN', () => {
      expect(monthISOToVN('0264-02')).toBe('02/2026');
      expect(monthISOToVN('264-04')).toBe('04/2026');
      expect(monthISOToVN('2026-04')).toBe('04/2026');
      expect(monthISOToVN('04/2026')).toBe('04/2026');
    });

    it('should heal 15/03/264 in formatDateVN to 15/03/2026', () => {
      expect(formatDateVN('0264-03-15')).toBe('15/03/2026');
      expect(formatDateVN('2026-03-15')).toBe('15/03/2026');
    });

    it('should correctly format input in formatMonthInput', () => {
      expect(formatMonthInput('042026')).toBe('04/2026');
      expect(formatMonthInput('2026-04')).toBe('04/2026');
      expect(formatMonthInput('020264')).toBe('02/2026');
    });

    it('should display correctly in formatMonthVN', () => {
      expect(formatMonthVN('2026-04')).toBe('04/2026');
      expect(formatMonthVN('0264-02')).toBe('02/2026');
    });
  });

  describe('Financial Period Lock Evaluation', () => {
    it('should allow modifications when lockedKeys is empty (all periods unlocked)', () => {
      const lockedKeys: string[] = [];
      expect(isDateLocked('2026-07-15', lockedKeys)).toBe(false);
      expect(isDateLocked('2026-04-01', lockedKeys)).toBe(false);
      expect(isDateLocked('2026-09-10', lockedKeys)).toBe(false);
    });

    it('should only block dates that match locked period keys', () => {
      const lockedKeys = ['month_07/2026', 'quarter_3_2026'];
      // Month 7/2026 is locked
      expect(isDateLocked('2026-07-15', lockedKeys)).toBe(true);
      // Month 4/2026 is NOT locked
      expect(isDateLocked('2026-04-01', lockedKeys)).toBe(false);
      // Month 8/2026 is Q3, so it is locked
      expect(isDateLocked('2026-08-10', lockedKeys)).toBe(true);
      // Month 5/2026 is Q2, so it is NOT locked
      expect(isDateLocked('2026-05-20', lockedKeys)).toBe(false);
    });

    it('should return false when locked period is unlocked (removed from lockedKeys)', () => {
      // Month 7 was locked, but then unlocked by Admin
      const lockedKeysAfterUnlock = ['month_06/2026'];
      expect(isDateLocked('2026-07-15', lockedKeysAfterUnlock)).toBe(false);
      expect(isDateLocked('2026-04-10', lockedKeysAfterUnlock)).toBe(false);
    });
  });
});
