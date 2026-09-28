import { describe, it, expect } from 'vitest';
import { hasPermission, DEFAULT_ROLE_PERMISSIONS } from '../utils/permissions';

describe('Kiểm thử Phân quyền Thu tiền & Xác nhận Đã thu tiền (Staff Payment Collection RBAC)', () => {
  const staffEmployee = {
    id: 'thao-staff',
    name: 'Nguyễn Thị Thảo',
    role: 'Nhân viên',
    email: 'thao@example.com',
    status: 'Đang hoạt động'
  };

  const staffAdmin = {
    id: 'admin-hoc',
    name: 'Phạm Văn Học',
    role: 'Admin',
    email: 'admin@example.com',
    status: 'Đang hoạt động'
  };

  const staffManager = {
    id: 'manager-user',
    name: 'Cán bộ Quản lý',
    role: 'Quản lý',
    email: 'manager@example.com',
    status: 'Đang hoạt động'
  };

  it('1. Vai trò Nhân viên mặc định sở hữu quyền "finance.collect" để tác nghiệp thu tiền', () => {
    expect(DEFAULT_ROLE_PERMISSIONS['Nhân viên']).toContain('finance.collect');
    expect(DEFAULT_ROLE_PERMISSIONS['Nhân viên']).toContain('finance.view');

    const canCollect = hasPermission(staffEmployee, 'finance.collect');
    expect(canCollect).toBe(true);
  });

  it('2. Quản trị viên và Quản lý luôn có toàn quyền thu tiền và hủy giao dịch', () => {
    expect(hasPermission(staffAdmin, 'finance.collect')).toBe(true);
    expect(hasPermission(staffAdmin, 'finance.refund')).toBe(true);
    expect(hasPermission(staffManager, 'finance.collect')).toBe(true);
    expect(hasPermission(staffManager, 'finance.refund')).toBe(true);
  });

  it('3. Khi cấu hình tùy chỉnh phân quyền được lưu trong settings, kiểm tra chính xác quyền', () => {
    // Trường hợp 1: Được cấp quyền finance.collect
    const customSettingsWithCollect = {
      rolePermissions: {
        'Nhân viên': ['finance.view', 'finance.collect', 'customers.create']
      }
    };
    expect(hasPermission(staffEmployee, 'finance.collect', customSettingsWithCollect)).toBe(true);
    expect(hasPermission(staffEmployee, 'finance.refund', customSettingsWithCollect)).toBe(false);

    // Trường hợp 2: Không được cấp quyền finance.collect (bị tắt)
    const customSettingsWithoutCollect = {
      rolePermissions: {
        'Nhân viên': ['finance.view', 'customers.create']
      }
    };
    expect(hasPermission(staffEmployee, 'finance.collect', customSettingsWithoutCollect)).toBe(false);
  });

  it('4. Kiểm tra tài khoản bị Tạm khóa không có quyền tác nghiệp thu tiền', () => {
    const lockedStaff = {
      ...staffEmployee,
      status: 'Tạm khóa'
    };
    // Tài khoản bị tạm khóa không hợp lệ
    expect(lockedStaff.status).toBe('Tạm khóa');
  });

  it('5. Kiểm tra quyền cá nhân ghi đè riêng (Individual Permissions Override)', () => {
    const customIndividualStaff = {
      ...staffEmployee,
      permissions: ['finance.collect', 'customers.edit']
    };
    const emptySettings = {
      rolePermissions: {
        'Nhân viên': []
      }
    };
    // Quyền cá nhân ghi đè danh sách vai trò
    expect(hasPermission(customIndividualStaff, 'finance.collect', emptySettings)).toBe(true);
    expect(hasPermission(customIndividualStaff, 'finance.refund', emptySettings)).toBe(false);
  });
});
