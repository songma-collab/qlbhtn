import { describe, it, expect } from 'vitest';
import { 
  hasPermission, 
  getPermissionsForRole, 
  sanitizeRolePermissions, 
  DEFAULT_ROLE_PERMISSIONS, 
  ALL_PERMISSIONS 
} from '../utils/permissions';

describe('Role-Based Access Control (RBAC) Permissions Suite', () => {
  const adminUser = {
    id: 'admin-1',
    name: 'Phạm Văn Học',
    role: 'Admin',
    username: 'admin'
  };

  const managerUser = {
    id: 'manager-1',
    name: 'Nguyễn Văn Quản Lý',
    role: 'Quản lý',
    username: 'quanly'
  };

  const staffUser = {
    id: 'staff-1',
    name: 'Trần Thị Thu Ngân',
    role: 'Nhân viên',
    username: 'thungan'
  };

  it('Admin must always retain ALL permissions by default', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(hasPermission(adminUser, p.key)).toBe(true);
    }
  });

  it('Default permissions for Staff must match safety baseline', () => {
    // Staff should have basic operational rights
    expect(hasPermission(staffUser, 'customers.create')).toBe(true);
    expect(hasPermission(staffUser, 'customers.edit')).toBe(true);
    expect(hasPermission(staffUser, 'finance.view')).toBe(true);
    expect(hasPermission(staffUser, 'finance.collect')).toBe(true);

    // Staff should NOT have sensitive / destructive rights by default
    expect(hasPermission(staffUser, 'customers.delete')).toBe(false);
    expect(hasPermission(staffUser, 'finance.settlement')).toBe(false);
    expect(hasPermission(staffUser, 'system.staff')).toBe(false);
    expect(hasPermission(staffUser, 'system.roles')).toBe(false);
    expect(hasPermission(staffUser, 'system.settings')).toBe(false);
    expect(hasPermission(staffUser, 'reports.view_all')).toBe(false);
  });

  it('Default permissions for Manager should allow managing reports and records but protect system settings', () => {
    expect(hasPermission(managerUser, 'customers.create')).toBe(true);
    expect(hasPermission(managerUser, 'customers.edit')).toBe(true);
    expect(hasPermission(managerUser, 'customers.view_all')).toBe(true);
    expect(hasPermission(managerUser, 'reports.view_all')).toBe(true);
    expect(hasPermission(managerUser, 'finance.settlement')).toBe(true);

    // Manager default does not have full system roles modification
    expect(hasPermission(managerUser, 'system.roles')).toBe(false);
    expect(hasPermission(managerUser, 'system.settings')).toBe(false);
  });

  it('Custom permissions saved in settings should override defaults', () => {
    const customSettings = {
      rolePermissions: {
        'Nhân viên': [
          ...DEFAULT_ROLE_PERMISSIONS['Nhân viên'],
          'customers.delete',
          'reports.view_all'
        ]
      }
    };

    // Now staff has delete and view_all permissions
    expect(hasPermission(staffUser, 'customers.delete', customSettings)).toBe(true);
    expect(hasPermission(staffUser, 'reports.view_all', customSettings)).toBe(true);

    // Other non-granted permissions remain false
    expect(hasPermission(staffUser, 'system.roles', customSettings)).toBe(false);
  });

  it('Admin lockout protection: Custom settings cannot strip Admin permissions', () => {
    const evilSettings = {
      rolePermissions: {
        'Admin': [] // attempt to strip all Admin permissions
      }
    };

    // Admin should still retain ALL permissions
    expect(hasPermission(adminUser, 'customers.delete', evilSettings)).toBe(true);
    expect(hasPermission(adminUser, 'system.roles', evilSettings)).toBe(true);
    expect(hasPermission(adminUser, 'system.settings', evilSettings)).toBe(true);
  });

  it('sanitizeRolePermissions correctly resets invalid or corrupted role maps', () => {
    const sanitized = sanitizeRolePermissions({
      'Admin': ['customers.create'], // Missing most permissions
      'Nhân viên': ['invalid_permission_xyz', 'customers.create']
    });

    // Admin should be restored to all permissions
    expect(sanitized['Admin'].length).toBe(ALL_PERMISSIONS.length);

    // Staff should have valid permissions preserved and invalid stripped
    expect(sanitized['Nhân viên']).toContain('customers.create');
    expect(sanitized['Nhân viên']).not.toContain('invalid_permission_xyz');
  });

  it('getPermissionsForRole returns clean list of permissions with fallback', () => {
    const defaultManagerPerms = getPermissionsForRole('Quản lý');
    expect(defaultManagerPerms).toEqual(DEFAULT_ROLE_PERMISSIONS['Quản lý']);

    const customPerms = getPermissionsForRole('Nhân viên', {
      rolePermissions: {
        'Nhân viên': ['customers.create', 'customers.export']
      }
    });
    expect(customPerms).toContain('customers.create');
    expect(customPerms).toContain('customers.export');
  });
});
