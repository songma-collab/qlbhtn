import { describe, it, expect } from 'vitest';
import { groupRecordsByCustomer } from '../utils/helpers';
import type { RecordType } from '../context/types';

describe('Kiểm thử sắp xếp mặc định: Khách hàng có giao dịch đóng mới nhất lên đầu', () => {
  it('groupRecordsByCustomer sắp xếp danh sách khách hàng theo giao dịch đóng mới nhất (date DESC, id DESC)', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 1,
        name: 'Nguyễn Văn A',
        cccd: '001099000001',
        phone: '0901000001',
        date: '2026-09-10',
        next_payment: '2027-09-10',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 1500000,
      },
      {
        id: 2,
        name: 'Trần Thị B',
        cccd: '001099000002',
        phone: '0901000002',
        date: '2026-10-05',
        next_payment: '2027-04-05',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 2000000,
      },
      {
        id: 3,
        name: 'Lê Văn C',
        cccd: '001099000003',
        phone: '0901000003',
        date: '2026-10-01',
        next_payment: '2027-10-01',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 1800000,
      },
      {
        id: 4,
        name: 'Phạm Thị D',
        cccd: '001099000004',
        phone: '0901000004',
        date: '2026-10-05', // cùng ngày với Trần Thị B nhưng id lớn hơn
        next_payment: '2027-01-05',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 1200000,
      },
    ];

    const result = groupRecordsByCustomer(mockRecords as RecordType[]);

    expect(result).toHaveLength(4);
    // Ngày 2026-10-05 mới nhất: id 4 (Phạm Thị D) và id 2 (Trần Thị B). id 4 > id 2 nên id 4 xếp trước.
    expect(result[0]?.name).toBe('Phạm Thị D');
    expect(result[1]?.name).toBe('Trần Thị B');
    // Ngày 2026-10-01: Lê Văn C
    expect(result[2]?.name).toBe('Lê Văn C');
    // Ngày 2026-09-10: Nguyễn Văn A
    expect(result[3]?.name).toBe('Nguyễn Văn A');
  });

  it('Khách hàng có nhiều lần đóng: hiển thị theo giao dịch đóng gần nhất của họ', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 10,
        name: 'Nguyễn Văn Đóng Cũ',
        cccd: '001099000010',
        phone: '0901000010',
        date: '2026-01-01',
        next_payment: '2026-07-01',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
      },
      {
        id: 20,
        name: 'Nguyễn Văn Đóng Mới',
        cccd: '001099000020',
        phone: '0901000020',
        date: '2026-05-01',
        next_payment: '2026-11-01',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
      },
      {
        id: 30, // Lần đóng gia hạn mới nhất của khách hàng Đóng Cũ
        name: 'Nguyễn Văn Đóng Cũ',
        cccd: '001099000010',
        phone: '0901000010',
        date: '2026-10-06',
        next_payment: '2027-01-01',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
      },
    ];

    const result = groupRecordsByCustomer(mockRecords as RecordType[]);

    expect(result).toHaveLength(2);
    // Nguyễn Văn Đóng Cũ có giao dịch mới nhất là 2026-10-06 -> phải lên vị trí đầu tiên
    expect(result[0]?.cccd).toBe('001099000010');
    expect(result[1]?.cccd).toBe('001099000020');
  });

  it('3. Khách hàng vừa phát sinh giao dịch đóng mới nhất (theo ngày nộp tiền date DESC) luôn được xếp lên đầu bảng, bất kể kỳ hạn hợp đồng', () => {
    const mockRecords: Partial<RecordType>[] = [
      {
        id: 101,
        name: 'Lèo Thị Thư',
        cccd: '014195011768',
        phone: '0342307910',
        date: '2026-04-01',
        from_month: '04/2026',
        to_month: '06/2026',
        next_payment: '2026-07-15',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 759000
      },
      {
        id: 102,
        name: 'Vì Văn Phong',
        cccd: '014082004599',
        phone: '0397593791',
        date: '2026-09-15',
        from_month: '11/2026',
        to_month: '11/2026',
        next_payment: '2026-12-15',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 253000
      },
      {
        id: 103,
        name: 'Lò Thị Nga',
        cccd: '014198012345',
        phone: '0988776655',
        date: '2026-10-10', // Vừa đóng giao dịch mới nhất
        from_month: '01/2026',
        to_month: '03/2026',
        next_payment: '2026-04-15',
        type: 'BHXH',
        payment_status: 'Đã thu tiền',
        amount: 759000
      }
    ];

    const result = groupRecordsByCustomer(mockRecords as RecordType[]);

    expect(result).toHaveLength(3);
    // 1. Lò Thị Nga có giao dịch đóng mới nhất (2026-10-10) -> đứng đầu tiên
    expect(result[0]?.name).toBe('Lò Thị Nga');
    expect(result[0]?.cccd).toBe('014198012345');
    // 2. Vì Văn Phong có giao dịch đóng ngày 2026-09-15 -> đứng thứ hai
    expect(result[1]?.name).toBe('Vì Văn Phong');
    expect(result[1]?.cccd).toBe('014082004599');
    // 3. Lèo Thị Thư có giao dịch cũ nhất (2026-04-01) -> đứng thứ ba
    expect(result[2]?.name).toBe('Lèo Thị Thư');
    expect(result[2]?.cccd).toBe('014195011768');
  });
});
