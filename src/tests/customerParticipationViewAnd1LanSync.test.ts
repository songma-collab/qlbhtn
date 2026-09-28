import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMonthAndYear,
  doesRecordMatchCustomer,
  extractAgencyPeriods,
  buildCompleteParticipationPeriods,
  transferCustomerTo1Lan
} from '../utils/customerParticipationHelper';
import { CustomerType, RecordType } from '../context/types';
import { groupRecordsByCustomer } from '../utils/helpers';

// Mock sessionStorage for Node environment in tests
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
};

const storageMock = createStorageMock();
(globalThis as any).sessionStorage = storageMock;
if (typeof window !== 'undefined') {
  (window as any).sessionStorage = storageMock;
}

describe('customerParticipationHelper & 1-Lan Sync Suite', () => {
  beforeEach(() => {
    // Reset sessionStorage mock
    storageMock.clear();
    vi.clearAllMocks();
  });

  describe('parseMonthAndYear', () => {
    it('phân tích chính xác định dạng YYYY-MM', () => {
      const res = parseMonthAndYear('2024-05');
      expect(res).toEqual({ month: 5, year: 2024 });
    });

    it('phân tích chính xác định dạng MM/YYYY', () => {
      const res = parseMonthAndYear('08/2023');
      expect(res).toEqual({ month: 8, year: 2023 });
    });

    it('fallback sang fallbackDateStr nếu monthStr rỗng hoặc không hợp lệ', () => {
      const res = parseMonthAndYear('', '2025-11-15');
      expect(res).toEqual({ month: 11, year: 2025 });
    });

    it('trả về tháng mặc định nếu cả 2 đều không hợp lệ', () => {
      const res = parseMonthAndYear('invalid', 'invalid-date');
      expect(res.month).toBe(1);
      expect(res.year).toBe(new Date().getFullYear());
    });
  });

  describe('doesRecordMatchCustomer', () => {
    const customer: CustomerType = {
      id: 'cust-101',
      customer_key: 'KEY-101',
      type: 'BHXH',
      name: 'Nguyễn Văn A',
      phone: '0912345678',
      cccd: '001200000001',
      bhxh: '7912345678',
      status: 'active',
      payment_status: 'paid',
      total_contributions: 1,
      total_amount_paid: 1000000
    };

    it('khớp theo CCCD', () => {
      const rec = { id: 1, cccd: '001200000001', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec, customer)).toBe(true);
    });

    it('khớp theo Mã BHXH', () => {
      const rec = { id: 2, bhxh: '7912345678', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec, customer)).toBe(true);
    });

    it('khớp theo customerId / customerKey', () => {
      const rec1 = { id: 3, customerId: 'cust-101', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec1, customer)).toBe(true);

      const rec2 = { id: 4, customerKey: 'KEY-101', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec2, customer)).toBe(true);
    });

    it('khớp theo Họ tên + Số điện thoại', () => {
      const rec = { id: 5, name: 'nguyễn văn a', phone: '0912.345.678', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec, customer)).toBe(true);
    });

    it('không khớp nếu thông tin không trùng', () => {
      const rec = { id: 6, cccd: '999999999999', phone: '0988888888', type: 'BHXH' } as RecordType;
      expect(doesRecordMatchCustomer(rec, customer)).toBe(false);
    });
  });

  describe('extractAgencyPeriods', () => {
    const customer: CustomerType = {
      id: 'cust-102',
      customer_key: 'KEY-102',
      type: 'BHXH',
      cccd: '001200000002',
      name: 'Trần Thị B',
      status: 'active',
      payment_status: 'paid',
      total_contributions: 1,
      total_amount_paid: 1000000
    };

    it('trích xuất đúng các bản ghi BHXH và bỏ qua bản ghi BHYT hoặc Đã hủy', () => {
      const records: RecordType[] = [
        {
          id: 10,
          cccd: '001200000002',
          type: 'BHXH',
          fromMonth: '2024-01',
          toMonth: '2024-06',
          months: 6,
          wage: 5000000,
          paymentStatus: 'Đã thanh toán'
        } as any,
        {
          id: 11,
          cccd: '001200000002',
          type: 'BHYT', // Loại BHYT không tính vào quá trình BHXH
          fromMonth: '2024-07',
          months: 12,
          amount: 1000000
        } as any,
        {
          id: 12,
          cccd: '001200000002',
          type: 'BHXH',
          fromMonth: '2024-07',
          months: 3,
          amount: 990000,
          paymentStatus: 'Đã hủy' // Bỏ qua bản ghi đã hủy
        } as any,
        {
          id: 13,
          cccd: '001200000002',
          type: 'BHXH',
          fromMonth: '2024-07',
          months: 6,
          income: 6000000,
          paymentStatus: 'Đã thanh toán'
        } as any
      ];

      const periods = extractAgencyPeriods(customer, records);
      expect(periods.length).toBe(2);

      // Period 1
      expect(periods[0].sm).toBe(1);
      expect(periods[0].sy).toBe(2024);
      expect(periods[0].em).toBe(6);
      expect(periods[0].ey).toBe(2024);
      expect(periods[0].salary).toBe('5.000.000');
      expect(periods[0].type).toBe('tunguyen');

      // Period 2 (tự động tính toMonth từ số tháng nếu toMonth không có)
      expect(periods[1].sm).toBe(7);
      expect(periods[1].sy).toBe(2024);
      expect(periods[1].em).toBe(12);
      expect(periods[1].ey).toBe(2024);
      expect(periods[1].salary).toBe('6.000.000');
    });
  });

  describe('buildCompleteParticipationPeriods', () => {
    it('gộp cả prior_periods và agencyPeriods, đồng thời sắp xếp chuẩn theo thứ tự thời gian', () => {
      const customer: CustomerType = {
        id: 'cust-103',
        customer_key: 'KEY-103',
        type: 'BHXH',
        cccd: '001200000003',
        name: 'Lê Văn C',
        payment_status: 'paid',
        total_contributions: 1,
        total_amount_paid: 1000000,
        prior_periods: [
          {
            id: 1,
            type: 'batbuoc',
            sm: 1,
            sy: 2018,
            em: 12,
            ey: 2020,
            salary: '4500000',
            workplace: 'Công ty Cổ phần May XK'
          },
          {
            id: 2,
            type: 'tunguyen',
            sm: 1,
            sy: 2021,
            em: 12,
            ey: 2022,
            salary: '2000000',
            workplace: 'Bưu điện Huyện'
          }
        ],
        status: 'active'
      };

      const records: RecordType[] = [
        {
          id: 50,
          cccd: '001200000003',
          type: 'BHXH',
          fromMonth: '2023-01',
          toMonth: '2023-12',
          months: 12,
          wage: 3000000,
          paymentStatus: 'Đã thanh toán'
        } as any
      ];

      const fullPeriods = buildCompleteParticipationPeriods(customer, records);
      expect(fullPeriods.length).toBe(3);

      // Thứ tự tăng dần thời gian: 2018-2020 -> 2021-2022 -> 2023
      expect(fullPeriods[0].sy).toBe(2018);
      expect(fullPeriods[0].type).toBe('batbuoc');
      expect(fullPeriods[1].sy).toBe(2021);
      expect(fullPeriods[1].type).toBe('tunguyen');
      expect(fullPeriods[2].sy).toBe(2023);
      expect(fullPeriods[2].type).toBe('tunguyen');
      expect(fullPeriods[2].salary).toBe('3.000.000');
    });
  });

  describe('transferCustomerTo1Lan', () => {
    it('đóng gói đúng payload vào sessionStorage và kích hoạt autoCalculate: true', () => {
      const customer: CustomerType = {
        id: 'cust-104',
        customer_key: 'KEY-104',
        type: 'BHXH',
        name: 'Phạm Thị D',
        cccd: '001200000004',
        bhxh: '0123456789',
        gender: 'Nữ',
        payment_status: 'paid',
        total_contributions: 1,
        total_amount_paid: 1000000,
        prior_periods: [
          {
            id: 1,
            type: 'batbuoc',
            sm: 1,
            sy: 2019,
            em: 12,
            ey: 2021,
            salary: '5000000'
          }
        ],
        status: 'active'
      };

      const navigateMock = vi.fn();
      const toastMock = vi.fn();

      const ok = transferCustomerTo1Lan(customer, [], navigateMock, toastMock);
      expect(ok).toBe(true);
      expect(navigateMock).toHaveBeenCalledWith('/bhxh1lan');
      expect(toastMock).toHaveBeenCalled();

      const storedJson = sessionStorage.getItem('TRANSFER_TO_BHXH1LAN');
      expect(storedJson).toBeTruthy();
      const parsed = JSON.parse(storedJson!);
      expect(parsed.customerName).toBe('Phạm Thị D');
      expect(parsed.customerCccd).toBe('001200000004');
      expect(parsed.customerBhxh).toBe('0123456789');
      expect(parsed.gender).toBe('female');
      expect(parsed.autoCalculate).toBe(true);
      expect(parsed.periods.length).toBe(1);
    });

    it('từ chối chuyển và hiển thị cảnh báo nếu không có giai đoạn nào', () => {
      const customer: CustomerType = {
        id: 'cust-105',
        customer_key: 'KEY-105',
        type: 'BHXH',
        name: 'Vũ Văn E',
        status: 'active',
        payment_status: 'paid',
        total_contributions: 0,
        total_amount_paid: 0,
        prior_periods: []
      };

      const navigateMock = vi.fn();
      const toastMock = vi.fn();

      const ok = transferCustomerTo1Lan(customer, [], navigateMock, toastMock);
      expect(ok).toBe(false);
      expect(navigateMock).not.toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.stringContaining('Khách hàng chưa có thời gian đóng BHXH nào'),
        'warning'
      );
    });
  });

  describe('priorPeriods durationMonths calculation in view modal', () => {
    it('tính chính xác số tháng cho từng giai đoạn tham gia trước đây', () => {
      const priorPeriods = [
        { sm: 5, sy: 2016, em: 7, ey: 2017 },  // (2017 - 2016)*12 + (7 - 5) + 1 = 15 tháng
        { sm: 11, sy: 2017, em: 1, ey: 2019 }, // (2019 - 2017)*12 + (1 - 11) + 1 = 15 tháng
        { sm: 3, sy: 2019, em: 2, ey: 2021 },  // (2021 - 2019)*12 + (2 - 3) + 1 = 24 tháng
        { sm: 3, sy: 2021, em: 5, ey: 2026 },  // (2026 - 2021)*12 + (5 - 3) + 1 = 63 tháng
      ];

      const calculatedMonths = priorPeriods.map(p => {
        const sm = Number(p.sm) || 1;
        const sy = Number(p.sy) || 0;
        const em = Number(p.em) || 12;
        const ey = Number(p.ey) || 0;
        return (sy > 0 && ey > 0)
          ? Math.max(0, (ey - sy) * 12 + (em - sm) + 1)
          : 0;
      });

      expect(calculatedMonths).toEqual([15, 15, 24, 63]);
      const total = calculatedMonths.reduce((a, b) => a + b, 0);
      expect(total).toBe(117);
    });
  });

  describe('Unified Customer Directory & Master Data Enrichment', () => {
    it('đồng bộ chính xác số lượng khách hàng duy nhất từ records và map đúng prior_periods', () => {
      // Giả lập 3 giao dịch của 2 khách hàng thực tế (Khách 1 có 2 hợp đồng, Khách 2 có 1 hợp đồng)
      const mockRecords: RecordType[] = [
        {
          id: 1,
          name: 'Nguyễn Thị Ngọc',
          phone: '0912000001',
          cccd: '014188000001',
          bhxh: '1418800001',
          type: 'BHXH',
          status: 'Hoạt động',
          paymentStatus: 'Đã thu tiền',
          months: 12,
          date: '2025-01-01',
          amount: 2000000
        },
        {
          id: 2,
          name: 'Nguyễn Thị Ngọc',
          phone: '0912000001',
          cccd: '014188000001',
          bhxh: '1418800001',
          type: 'BHXH',
          status: 'Hoạt động',
          paymentStatus: 'Đã thu tiền',
          months: 6,
          date: '2026-01-01',
          amount: 1000000
        },
        {
          id: 3,
          name: 'Trần Văn Nam',
          phone: '0912000002',
          cccd: '014188000002',
          bhxh: '1418800002',
          type: 'BHYT',
          status: 'Hoạt động',
          paymentStatus: 'Đã thu tiền',
          months: 12,
          date: '2025-06-01',
          amount: 1200000
        }
      ];

      // Master data lưu trong bảng customers
      const mockCustomersMaster: CustomerType[] = [
        {
          id: 'cust-uuid-1',
          customer_key: 'CUST_014188000001',
          type: 'BHXH',
          name: 'Nguyễn Thị Ngọc',
          cccd: '014188000001',
          bhxh: '1418800001',
          status: 'active',
          payment_status: 'paid',
          total_contributions: 2,
          total_amount_paid: 3000000,
          prior_compulsory_months: 24,
          prior_voluntary_months: 60,
          prior_periods: [
            { id: 101, type: 'batbuoc', sm: 1, sy: 2020, em: 12, ey: 2021, salary: '5,000,000' }
          ]
        }
      ];

      // 1. Gom cụm records theo khách hàng duy nhất
      const unifiedCustomers = groupRecordsByCustomer(mockRecords);
      expect(unifiedCustomers.length).toBe(2); // Khách 1 và Khách 2, không bị trùng lặp thành 3

      // 2. Tạo customerMasterMap
      const customerMasterMap = new Map<string, CustomerType>();
      for (const c of mockCustomersMaster) {
        if (c.cccd) customerMasterMap.set(`cccd_${c.cccd}`, c);
        if (c.bhxh) customerMasterMap.set(`bhxh_${c.bhxh}`, c);
      }

      // 3. Enrich
      const enriched = unifiedCustomers.map((c: any) => {
        const cccd = (c.cccd || '').trim();
        const bhxh = (c.bhxh || '').trim();
        const master = (cccd ? customerMasterMap.get(`cccd_${cccd}`) : null)
          || (bhxh ? customerMasterMap.get(`bhxh_${bhxh}`) : null);

        return {
          ...c,
          id: master?.id || c.id,
          prior_periods: master?.prior_periods || [],
          compulsoryMonths: Number(master?.prior_compulsory_months || 0),
          priorVoluntaryMonths: Number(master?.prior_voluntary_months || 0),
          hasPrior: Boolean(master?.prior_periods?.length || master?.prior_compulsory_months)
        };
      });

      expect(enriched.length).toBe(2);
      const ngoc = enriched.find((c: any) => c.name === 'Nguyễn Thị Ngọc');
      expect(ngoc).toBeDefined();
      expect(ngoc.id).toBe('cust-uuid-1');
      expect(ngoc.compulsoryMonths).toBe(24);
      expect(ngoc.prior_periods.length).toBe(1);
      expect(ngoc.hasPrior).toBe(true);

      const nam = enriched.find((c: any) => c.name === 'Trần Văn Nam');
      expect(nam).toBeDefined();
      expect(nam.compulsoryMonths).toBe(0);
      expect(nam.hasPrior).toBe(false);
    });
  });
});

