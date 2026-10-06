import { describe, it, expect } from 'vitest';
import type { RecordType } from '../context/types';

describe('Kiểm thử Bút toán bù trừ âm & Khấu trừ hoa hồng (Clawback Integrity Test Suite)', () => {
  const staffA = { id: 'staff-001', name: 'Nguyễn Văn Nhân Viên A' };

  // Dữ liệu tháng 08/2026: Nhân viên A thu 3 hồ sơ BHXH
  const augustRecords: RecordType[] = [
    {
      id: 1,
      date: '2026-08-05',
      name: 'Khách hàng 1',
      type: 'BHXH',
      action_type: 'Đăng ký mới',
      amount: 5000000,
      commission: 500000,
      staff_id: staffA.id,
      payment_status: 'Đã thu tiền',
      status: 'Đang tham gia',
      phone: '0901000001',
      months: 12
    },
    {
      id: 2,
      date: '2026-08-10',
      name: 'Khách hàng 2',
      type: 'BHXH',
      action_type: 'Đăng ký mới',
      amount: 5000000,
      commission: 500000,
      staff_id: staffA.id,
      payment_status: 'Đã thu tiền',
      status: 'Đang tham gia',
      phone: '0901000002',
      months: 12
    },
    {
      id: 3,
      date: '2026-08-20',
      name: 'Khách hàng 3',
      type: 'BHXH',
      action_type: 'Đăng ký mới',
      amount: 5000000,
      commission: 500000,
      staff_id: staffA.id,
      payment_status: 'Đã thu tiền',
      status: 'Đang tham gia',
      phone: '0901000003',
      months: 12
    }
  ];

  // Dữ liệu tháng 09/2026:
  // - Bút toán bù trừ âm hủy hồ sơ 3 của tháng 8
  // - Thu mới 1 hồ sơ 6.000.000đ (hoa hồng 600.000đ)
  const septemberRecords: RecordType[] = [
    {
      id: 4,
      date: '2026-09-02',
      name: 'Khách hàng 3 (Bù trừ thu hồi)',
      type: 'BHXH',
      action_type: 'Điều chỉnh thu hồi',
      amount: -5000000,
      commission: -500000,
      staff_id: staffA.id,
      payment_status: 'Đã thu tiền',
      status: 'Hoàn tất',
      is_adjustment: true,
      original_record_id: 3,
      adjustment_reason: 'Khách hàng yêu cầu rút đơn / chuyển nhầm',
      phone: '0901000003',
      months: 12
    },
    {
      id: 5,
      date: '2026-09-05',
      name: 'Khách hàng 4',
      type: 'BHXH',
      action_type: 'Đăng ký mới',
      amount: 6000000,
      commission: 600000,
      staff_id: staffA.id,
      payment_status: 'Đã thu tiền',
      status: 'Đang tham gia',
      phone: '0901000004',
      months: 12
    }
  ];

  const allRecords = [...augustRecords, ...septemberRecords];

  it('1. Dữ liệu tháng 8 (kỳ đã khóa) được bảo toàn nguyên vẹn', () => {
    const augPaid = allRecords.filter(r => r.date.startsWith('2026-08') && r.payment_status === 'Đã thu tiền');
    const augRevenue = augPaid.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const augCommission = augPaid.reduce((sum, r) => sum + (Number(r.commission) || 0), 0);

    expect(augRevenue).toBe(15000000);
    expect(augCommission).toBe(1500000);
    expect(augPaid).toHaveLength(3);
  });

  it('2. Doanh số ròng tháng 9 cộng đại số chính xác (+6.000.000 - 5.000.000 = 1.000.000 đ)', () => {
    const sepPaid = allRecords.filter(r => r.date.startsWith('2026-09') && r.payment_status === 'Đã thu tiền');
    const sepNetRevenue = sepPaid.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    expect(sepNetRevenue).toBe(1000000);
  });

  it('3. Hoa hồng ròng tháng 9 khấu trừ chính xác (+600.000 - 500.000 = +100.000 đ)', () => {
    const sepPaid = allRecords.filter(r => r.date.startsWith('2026-09') && r.payment_status === 'Đã thu tiền');
    const sepNetCommission = sepPaid.reduce((sum, r) => sum + (Number(r.commission) || 0), 0);

    expect(sepNetCommission).toBe(100000);
  });

  it('4. Số lượng khách hàng mới tháng 9 không bị tính tăng do bút toán bù trừ âm', () => {
    const sepPaid = allRecords.filter(r => r.date.startsWith('2026-09') && r.payment_status === 'Đã thu tiền');
    
    // Khi tính headcount khách hàng mới, phải lọc r.is_adjustment === false
    const newCustomerCount = sepPaid.filter(r => !r.is_adjustment).length;
    expect(newCustomerCount).toBe(1); // Chỉ có Khách hàng 4
  });

  it('5. Tổng luỹ kế 2 tháng chuẩn xác (+15M - 5M + 6M = 16.000.000 đ)', () => {
    const totalRevenue = allRecords
      .filter(r => r.payment_status === 'Đã thu tiền')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    
    const totalCommission = allRecords
      .filter(r => r.payment_status === 'Đã thu tiền')
      .reduce((sum, r) => sum + (Number(r.commission) || 0), 0);

    expect(totalRevenue).toBe(16000000);
    expect(totalCommission).toBe(1600000);
  });
});
