import { describe, it, expect } from 'vitest';
import { 
  getLastDayOfMonthISO, 
  calculateBHXH2024LegalDeadline, 
  calculateNextPaymentFromToMonth,
  formatDateVN,
  formatMonthVN
} from '../utils/helpers';
import { classifyRenewalRecords, generateRenewalMessage } from '../utils/renewalDispatchHelper';

describe('Kiểm thử Toàn diện Quy định Thời hạn Đóng BHXH Tự Nguyện theo Luật BHXH 2024', () => {

  describe('1. Tiện ích xác định ngày cuối cùng của tháng (getLastDayOfMonthISO)', () => {
    it('1.1. Tháng 2 năm thường (28 ngày)', () => {
      expect(getLastDayOfMonthISO(2025, 2)).toBe('2025-02-28');
      expect(getLastDayOfMonthISO(2026, 2)).toBe('2026-02-28');
      expect(getLastDayOfMonthISO(2027, 2)).toBe('2027-02-28');
    });

    it('1.2. Tháng 2 năm nhuận (29 ngày)', () => {
      expect(getLastDayOfMonthISO(2024, 2)).toBe('2024-02-29');
      expect(getLastDayOfMonthISO(2028, 2)).toBe('2028-02-29');
    });

    it('1.3. Các tháng có 30 ngày (Tháng 4, 6, 9, 11)', () => {
      expect(getLastDayOfMonthISO(2026, 4)).toBe('2026-04-30');
      expect(getLastDayOfMonthISO(2026, 6)).toBe('2026-06-30');
      expect(getLastDayOfMonthISO(2026, 9)).toBe('2026-09-30');
      expect(getLastDayOfMonthISO(2026, 11)).toBe('2026-11-30');
    });

    it('1.4. Các tháng có 31 ngày (Tháng 1, 3, 5, 7, 8, 10, 12)', () => {
      expect(getLastDayOfMonthISO(2026, 1)).toBe('2026-01-31');
      expect(getLastDayOfMonthISO(2026, 3)).toBe('2026-03-31');
      expect(getLastDayOfMonthISO(2026, 5)).toBe('2026-05-31');
      expect(getLastDayOfMonthISO(2026, 7)).toBe('2026-07-31');
      expect(getLastDayOfMonthISO(2026, 8)).toBe('2026-08-31');
      expect(getLastDayOfMonthISO(2026, 10)).toBe('2026-10-31');
      expect(getLastDayOfMonthISO(2026, 12)).toBe('2026-12-31');
    });
  });

  describe('2. Thời hạn đóng của kỳ hiện tại (calculateBHXH2024LegalDeadline - Khoản 3 Điều 36)', () => {
    it('2.1. Đóng hằng tháng: Trong tháng đó (Điểm a Khoản 3 Điều 36)', () => {
      const info = calculateBHXH2024LegalDeadline('11/2026', 1);
      expect(info).not.toBeNull();
      expect(info?.deadlineDate).toBe('2026-11-30');
      expect(info?.targetMonthIndex).toBe(1);
      expect(info?.legalBasis).toContain('Trong tháng đó');
    });

    it('2.2. Đóng 03 tháng một lần: Trong 03 tháng đó (Điểm b Khoản 3 Điều 36)', () => {
      // Kỳ đóng 10/2026 - 12/2026 -> Hạn chót là ngày cuối cùng tháng thứ 3 (31/12/2026)
      const info = calculateBHXH2024LegalDeadline('10/2026', 3);
      expect(info?.deadlineDate).toBe('2026-12-31');
      expect(info?.targetMonthIndex).toBe(3);

      // Kỳ đóng vắt năm: 11/2026 - 01/2027 -> Hạn chót là ngày cuối cùng tháng thứ 3 (31/01/2027)
      const infoRollover = calculateBHXH2024LegalDeadline('11/2026', 3);
      expect(infoRollover?.deadlineDate).toBe('2027-01-31');
    });

    it('2.3. Đóng 06 tháng một lần: Trong 04 tháng đầu của kỳ (Điểm c Khoản 3 Điều 36)', () => {
      // Kỳ đóng 6 tháng từ 01/2026 đến 06/2026 -> Hạn chót là ngày cuối cùng tháng thứ 4 (30/04/2026)
      const info = calculateBHXH2024LegalDeadline('01/2026', 6);
      expect(info?.deadlineDate).toBe('2026-04-30');
      expect(info?.targetMonthIndex).toBe(4);
      expect(info?.legalBasis).toContain('Trong 04 tháng đầu của kỳ');

      // Kỳ đóng 6 tháng từ 07/2026 đến 12/2026 -> Hạn chót là ngày cuối cùng tháng thứ 4 (31/10/2026)
      const infoH2 = calculateBHXH2024LegalDeadline('07/2026', 6);
      expect(infoH2?.deadlineDate).toBe('2026-10-31');
      expect(infoH2?.targetMonthIndex).toBe(4);
    });

    it('2.4. Đóng 12 tháng một lần: Trong 07 tháng đầu của kỳ (Điểm d Khoản 3 Điều 36)', () => {
      // Kỳ đóng 12 tháng từ 01/2026 đến 12/2026 -> Hạn chót là ngày cuối cùng tháng thứ 7 (31/07/2026)
      const info = calculateBHXH2024LegalDeadline('01/2026', 12);
      expect(info?.deadlineDate).toBe('2026-07-31');
      expect(info?.targetMonthIndex).toBe(7);
      expect(info?.legalBasis).toContain('Trong 07 tháng đầu của kỳ');

      // Kỳ đóng 12 tháng từ 10/2026 đến 09/2027 -> Hạn chót là tháng thứ 7 (tháng 04/2027)
      const infoRollover = calculateBHXH2024LegalDeadline('10/2026', 12);
      expect(infoRollover?.deadlineDate).toBe('2027-04-30');
      expect(infoRollover?.targetMonthIndex).toBe(7);
    });
  });

  describe('3. Hạn đóng tiếp theo của kỳ kế tiếp (calculateNextPaymentFromToMonth)', () => {
    it('3.1. Trường hợp khách hàng Lò Thị Thuận (Đóng hằng tháng, kỳ 11/2026 - 11/2026)', () => {
      // Kỳ tiếp theo là tháng 12/2026 -> Hạn chót là ngày cuối cùng tháng 12/2026 (31/12/2026)
      const nextPay = calculateNextPaymentFromToMonth('11/2026', 1, 'BHXH');
      expect(nextPay).toBe('2026-12-31');
      expect(formatDateVN(nextPay)).toBe('31/12/2026');
    });

    it('3.2. Trường hợp khách hàng Lò Thị Nga (Đóng 3 tháng, kỳ 10/2026 - 12/2026)', () => {
      // Kỳ tiếp theo là 01/2027 - 03/2027 -> Hạn chót là ngày cuối cùng tháng 03/2027 (31/03/2027)
      const nextPay = calculateNextPaymentFromToMonth('12/2026', 3, 'BHXH');
      expect(nextPay).toBe('2027-03-31');
      expect(formatDateVN(nextPay)).toBe('31/03/2027');
    });

    it('3.3. Trường hợp khách hàng Lèo Thị Thư (Đóng 3 tháng, kỳ 07/2026 - 09/2026)', () => {
      // Kỳ tiếp theo là 10/2026 - 12/2026 -> Hạn chót là ngày cuối cùng tháng 12/2026 (31/12/2026)
      const nextPay = calculateNextPaymentFromToMonth('09/2026', 3, 'BHXH');
      expect(nextPay).toBe('2026-12-31');
      expect(formatDateVN(nextPay)).toBe('31/12/2026');
    });

    it('3.4. Trường hợp khách hàng Nguyễn Văn Bốn (Đóng 3 tháng, kỳ 08/2026 - 10/2026)', () => {
      // Kỳ tiếp theo là 11/2026 - 01/2027 -> Hạn chót là ngày cuối cùng tháng 01/2027 (31/01/2027)
      const nextPay = calculateNextPaymentFromToMonth('10/2026', 3, 'BHXH');
      expect(nextPay).toBe('2027-01-31');
      expect(formatDateVN(nextPay)).toBe('31/01/2027');
    });

    it('3.5. Trường hợp đóng 6 tháng một lần (Kỳ cũ hết 06/2026)', () => {
      // Kỳ tiếp theo là 07/2026 - 12/2026 -> Hạn chót là trong 4 tháng đầu: ngày cuối cùng tháng 10/2026 (31/10/2026)
      const nextPay = calculateNextPaymentFromToMonth('06/2026', 6, 'BHXH');
      expect(nextPay).toBe('2026-10-31');
      expect(formatDateVN(nextPay)).toBe('31/10/2026');
    });

    it('3.6. Trường hợp đóng 12 tháng một lần (Kỳ cũ hết 12/2026)', () => {
      // Kỳ tiếp theo là 01/2027 - 12/2027 -> Hạn chót là trong 7 tháng đầu: ngày cuối cùng tháng 07/2027 (31/07/2027)
      const nextPay = calculateNextPaymentFromToMonth('12/2026', 12, 'BHXH');
      expect(nextPay).toBe('2027-07-31');
      expect(formatDateVN(nextPay)).toBe('31/07/2027');
    });

    it('3.7. Trường hợp BHYT Hộ gia đình (Kỳ cũ hết 12/2026)', () => {
      // Thẻ BHYT hết hạn ngày 31/12/2026 -> Hạn đóng gia hạn là ngày cuối cùng tháng 12/2026
      const nextPay = calculateNextPaymentFromToMonth('12/2026', 12, 'BHYT');
      expect(nextPay).toBe('2026-12-31');
      expect(formatDateVN(nextPay)).toBe('31/12/2026');
    });
  });

  describe('4. Độ bền phân loại đôn đốc & Loại bỏ hoàn toàn lỗi Chưa xác định', () => {
    it('4.1. classifyRenewalRecords tự động tính toán hạn khi next_payment trong bản ghi null', () => {
      // Hồ sơ đóng đến 09/2026, 1 tháng -> hạn tiếp là 31/10/2026 (trong vòng 30 ngày)
      const mockRecords = [
        {
          id: 1,
          name: 'Lò Thị Thuận',
          type: 'BHXH',
          to_month: '2026-09',
          months: 1,
          amount: 319000,
          payment_status: 'Đã thu tiền',
          next_payment: null // null trong DB
        }
      ];

      const classification = classifyRenewalRecords(mockRecords);
      expect(classification.all.length).toBe(1);
      const item = classification.all[0]!;
      expect(item.record.name).toBe('Lò Thị Thuận');
      expect(item.diffDays).toBeDefined();
    });

    it('4.2. Không bị lỗi undefined khi bản ghi dùng trường snake_case next_payment', () => {
      // next_payment trong vòng 10 ngày tới
      const mockDate = new Date();
      mockDate.setDate(mockDate.getDate() + 5);
      const mockDateStr = `${mockDate.getFullYear()}-${String(mockDate.getMonth() + 1).padStart(2, '0')}-${String(mockDate.getDate()).padStart(2, '0')}`;

      const mockRecord = {
        id: 2,
        name: 'Lèo Thị Thư',
        type: 'BHXH',
        to_month: '2026-09',
        months: 3,
        payment_status: 'Đã thu tiền',
        next_payment: mockDateStr
      };

      const classification = classifyRenewalRecords([mockRecord]);
      expect(classification.all.length).toBe(1);
    });

    it('4.3. generateRenewalMessage tạo tin nhắn Zalo chứa đúng ngày định dạng DD/MM/YYYY từ snake_case next_payment', () => {
      const mockRecord = {
        name: 'Lò Thị Thuận',
        type: 'BHXH',
        bhxhCode: '1428991153',
        next_payment: '2026-12-31'
      };

      const msg = generateRenewalMessage(mockRecord);
      expect(msg).toContain('31/12/2026');
      expect(msg).not.toContain('sắp tới');
    });

    it('4.4. generateRenewalMessage tự suy luận hạn đóng theo Luật 2024 khi next_payment bị null', () => {
      const mockRecord = {
        name: 'Lò Thị Nga',
        type: 'BHXH',
        bhxhCode: '1428953815',
        to_month: '12/2026',
        months: 3,
        next_payment: null
      };

      const msg = generateRenewalMessage(mockRecord);
      expect(msg).toContain('31/03/2027');
    });
  });
});
