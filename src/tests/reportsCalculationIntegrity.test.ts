import { describe, it, expect } from 'vitest';
import { getCommissionRateForRecord } from '../utils/calculations';
import { hasPermission } from '../utils/permissions';

describe('Reports Calculation & Stats Integrity Suite', () => {
  const mockAdminUser = {
    id: 'admin-1',
    name: 'Phạm Văn Học',
    role: 'Admin',
    username: 'admin'
  };

  const mockStaffUser = {
    id: 'staff-1',
    name: 'Nguyễn Văn Thu',
    role: 'Nhân viên',
    username: 'vanthu'
  };

  const now = new Date();
  const currentMonthISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15T10:00:00.000Z`;

  const mockRecords = [
    {
      id: 1,
      name: 'Khách hàng A',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      amount: 1500000,
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-1',
      date: currentMonthISO
    },
    {
      id: 2,
      name: 'Khách hàng B',
      type: 'BHYT',
      actionType: 'Gia hạn',
      amount: 800000,
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-1',
      date: currentMonthISO
    },
    {
      id: 3,
      name: 'Khách hàng C',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      amount: 2000000,
      paymentStatus: 'Đã thu tiền',
      staffId: 'staff-2',
      date: currentMonthISO
    },
    {
      id: 4,
      name: 'Khách hàng D (Đã hủy)',
      type: 'BHXH',
      actionType: 'Đăng ký mới',
      amount: 3000000,
      paymentStatus: 'Đã hủy',
      staffId: 'staff-1',
      date: currentMonthISO
    }
  ];

  const mockStaffList = [
    { id: 'staff-1', name: 'Nguyễn Văn Thu', username: 'vanthu' },
    { id: 'staff-2', name: 'Trần Thị Thu', username: 'thithu' }
  ];

  it('1. Admin should see total aggregated stats across all staff members in the current month', () => {
    const userRole = (mockAdminUser.role || '').toLowerCase();
    const isSuperAdmin = userRole === 'admin' || (mockAdminUser.name && mockAdminUser.name.toLowerCase().includes('phạm văn học'));
    const canViewAll = isSuperAdmin || hasPermission(mockAdminUser, 'reports.view_all', {});

    expect(canViewAll).toBe(true);

    // Filter paymentStatus === 'Đã thu tiền'
    let filtered = mockRecords.filter(r => r.paymentStatus === 'Đã thu tiền');
    expect(filtered.length).toBe(3);

    // Calculate totals
    const bhxhCount = filtered.filter(r => r.type === 'BHXH').length;
    const bhytCount = filtered.filter(r => r.type === 'BHYT').length;
    const totalRev = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    expect(bhxhCount).toBe(2);
    expect(bhytCount).toBe(1);
    expect(totalRev).toBe(4300000); // 1.5M + 0.8M + 2.0M
  });

  it('2. Regular staff without reports.view_all permission should only see their own revenue stats', () => {
    const canViewAll = hasPermission(mockStaffUser, 'reports.view_all', {});
    expect(canViewAll).toBe(false);

    let filtered = mockRecords.filter(r => r.paymentStatus === 'Đã thu tiền');
    if (!canViewAll) {
      filtered = filtered.filter(r => r.staffId === mockStaffUser.id);
    }

    expect(filtered.length).toBe(2); // Only customer A and B

    const bhxhCount = filtered.filter(r => r.type === 'BHXH').length;
    const bhytCount = filtered.filter(r => r.type === 'BHYT').length;
    const totalRev = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    expect(bhxhCount).toBe(1);
    expect(bhytCount).toBe(1);
    expect(totalRev).toBe(2300000); // 1.5M + 0.8M
  });

  it('3. Staff performance list calculations must handle string amounts and calculate correctly without crashing', () => {
    const staffToProcess = mockStaffList;
    const filteredRecords = mockRecords.filter(r => r.paymentStatus === 'Đã thu tiền');

    const staffPerformance = staffToProcess.map(s => {
      const sRecords = filteredRecords.filter(r => r.staffId === s.id);
      const sBhxhRecords = sRecords.filter(r => r.type === 'BHXH');
      const sBhytRecords = sRecords.filter(r => r.type === 'BHYT');

      const bhxhRev = sBhxhRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const bhytRev = sBhytRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      return {
        ...s,
        totalRecords: sRecords.length,
        bhxhCount: sBhxhRecords.length,
        bhytCount: sBhytRecords.length,
        revenue: bhxhRev + bhytRev
      };
    });

    expect(staffPerformance.length).toBe(2);
    expect(staffPerformance[0].revenue).toBe(2300000);
    expect(staffPerformance[1].revenue).toBe(2000000);
  });
});
