import { describe, it, expect } from 'vitest';
import { 
  classifyRenewalRecords, 
  generateRenewalMessage 
} from '../utils/renewalDispatchHelper';

describe('Kiểm thử Phân loại Nhắc Hạn & Đôn Đốc Gia Hạn BHXH/BHYT', () => {
  const getFutureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const sampleRecords = [
    {
      id: 'rec-1',
      name: 'Nguyễn Văn Quá Hạn',
      type: 'BHXH',
      citizenId: '012345678901',
      bhxhCode: '7912345678',
      phone: '0912345678',
      nextPayment: getFutureDate(-10), // Quá hạn 10 ngày
      paymentStatus: 'Đã thu tiền'
    },
    {
      id: 'rec-2',
      name: 'Trần Thị Khẩn Cấp',
      type: 'BHYT',
      citizenId: '012345678902',
      bhytCode: 'GD4010123456789',
      phone: '0912345679',
      nextPayment: getFutureDate(3), // Khẩn cấp 3 ngày (≤7 ngày)
      paymentStatus: 'Đã thu tiền'
    },
    {
      id: 'rec-3',
      name: 'Lê Văn Cận Hạn',
      type: 'BHYT',
      citizenId: '012345678903',
      bhytCode: 'GD4010123456790',
      phone: '0912345680',
      nextPayment: getFutureDate(12), // Cận hạn (8-15 ngày)
      paymentStatus: 'Đã thu tiền'
    },
    {
      id: 'rec-4',
      name: 'Phạm Thị Sắp Đến',
      type: 'BHXH',
      citizenId: '012345678904',
      bhxhCode: '7912345679',
      phone: '0912345681',
      nextPayment: getFutureDate(25), // Sắp đến hạn (16-30 ngày)
      paymentStatus: 'Đã thu tiền'
    },
    {
      id: 'rec-5',
      name: 'Hoàng Văn Quá Xa',
      type: 'BHXH',
      citizenId: '012345678905',
      bhxhCode: '7912345680',
      nextPayment: getFutureDate(90), // > 30 ngày (không cần đôn đốc)
      paymentStatus: 'Đã thu tiền'
    },
    {
      id: 'rec-6',
      name: 'Vũ Thị Đã Hủy',
      type: 'BHYT',
      citizenId: '012345678906',
      bhytCode: 'GD4010123456791',
      nextPayment: getFutureDate(2),
      paymentStatus: 'Đã hủy' // Bị hủy bỏ -> Phải loại trừ
    },
    {
      id: 'rec-7',
      name: 'Đặng Văn Dừng Đóng',
      type: 'BHXH',
      citizenId: '012345678907',
      bhxhCode: '7912345681',
      nextPayment: getFutureDate(2),
      status: 'Đã dừng đóng' // Dừng đóng -> Phải loại trừ
    }
  ];

  it('phân loại chuẩn xác 4 cấp độ và loại trừ giao dịch hủy / dừng đóng', () => {
    const result = classifyRenewalRecords(sampleRecords);

    expect(result.totalActionable).toBe(4);
    expect(result.overdue.length).toBe(1);
    expect(result.overdue[0]!.record.name).toBe('Nguyễn Văn Quá Hạn');
    expect(result.overdue[0]!.urgency).toBe('overdue');

    expect(result.urgent.length).toBe(1);
    expect(result.urgent[0]!.record.name).toBe('Trần Thị Khẩn Cấp');
    expect(result.urgent[0]!.urgency).toBe('urgent');

    expect(result.warning.length).toBe(1);
    expect(result.warning[0]!.record.name).toBe('Lê Văn Cận Hạn');
    expect(result.warning[0]!.urgency).toBe('warning');

    expect(result.upcoming.length).toBe(1);
    expect(result.upcoming[0]!.record.name).toBe('Phạm Thị Sắp Đến');
    expect(result.upcoming[0]!.urgency).toBe('upcoming');
  });

  it('sinh nội dung tin nhắn Zalo/SMS chuẩn nghiệp vụ cho BHYT với cảnh báo 5 năm liên tục', () => {
    const record = sampleRecords[1]!; // BHYT
    const staff = { name: 'Nguyễn Thị Mai', phone: '0988.123.456' };
    const msg = generateRenewalMessage(record, staff);

    expect(msg).toContain('Trần Thị Khẩn Cấp');
    expect(msg).toContain('GD4010123456789');
    expect(msg).toContain('5 NĂM LIÊN TỤC');
    expect(msg).toContain('100% chi phí khám chữa bệnh');
    expect(msg).toContain('Nguyễn Thị Mai');
    expect(msg).toContain('0988.123.456');
  });

  it('sinh nội dung tin nhắn Zalo/SMS chuẩn nghiệp vụ cho BHXH tự nguyện với Luật BHXH 41/2024/QH15', () => {
    const record = sampleRecords[0]; // BHXH
    const staff = { name: 'Trần Văn Bình', phone: '0977.654.321' };
    const msg = generateRenewalMessage(record, staff);

    expect(msg).toContain('Nguyễn Văn Quá Hạn');
    expect(msg).toContain('7912345678');
    expect(msg).toContain('Luật BHXH số 41/2024/QH15');
    expect(msg).toContain('lương hưu');
    expect(msg).toContain('Trần Văn Bình');
    expect(msg).toContain('0977.654.321');
  });
});
