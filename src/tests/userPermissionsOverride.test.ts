import { describe, it, expect, beforeEach } from 'vitest';
import { 
  hasPermission, 
  getUserOverride, 
  getEffectivePermissionsForStaff, 
  sanitizeUserOverrides,
  DEFAULT_ROLE_PERMISSIONS, 
  ALL_PERMISSIONS,
  PermissionKey
} from '../utils/permissions';
import { 
  extractUserOverridesFromPolicies,
  getStoredUserOverrides,
  storeUserOverrides
} from '../utils/settingsHelper';
import { Policy } from '../context/types';

describe('Bộ Kiểm Thử Phân Quyền Đặc Cách Riêng Theo Nhân Viên (User Overrides RBAC Test Suite)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    };
    (globalThis as any).localStorage = storageMock;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = storageMock;
    }
  });

  const staffUser = {
    id: 'staff-001',
    staffCode: 'CB001',
    name: 'Nguyễn Văn Thu',
    role: 'Nhân viên',
    phone: '0988111222',
    email: 'vanthu@gmail.com'
  };

  const managerUser = {
    id: 'mgr-001',
    staffCode: 'QL001',
    name: 'Trần Thị Quản Lý',
    role: 'Quản lý',
    phone: '0988333444',
    email: 'quanly@gmail.com'
  };

  const adminUser = {
    id: 'admin-001',
    name: 'Phạm Văn Học',
    role: 'Admin',
    phone: '0988999888'
  };

  describe('1. Quyền mặc định theo Cấp vai trò (Baseline Inheritance)', () => {
    it('Nhân viên không có đặc cách: Hoạt động chuẩn xác theo quyền vai trò', () => {
      // Quyền cơ sở được phép
      expect(hasPermission(staffUser, 'customers.create')).toBe(true);
      expect(hasPermission(staffUser, 'finance.collect')).toBe(true);

      // Quyền cơ sở không được phép
      expect(hasPermission(staffUser, 'customers.view_all')).toBe(false);
      expect(hasPermission(staffUser, 'customers.delete')).toBe(false);
      expect(hasPermission(staffUser, 'finance.refund')).toBe(false);
      expect(hasPermission(staffUser, 'system.settings')).toBe(false);
    });
  });

  describe('2. Phân quyền Đặc cách CẤP THÊM (Grant Overrides)', () => {
    it('Cán bộ thu được cấp đặc cách các quyền nâng cao (xem toàn đại lý, xóa hồ sơ, thoái thu)', () => {
      const settingsWithGrant = {
        rolePermissions: DEFAULT_ROLE_PERMISSIONS,
        userOverrides: {
          'staff-001': {
            staffId: 'staff-001',
            staffName: 'Nguyễn Văn Thu',
            role: 'Nhân viên',
            granted: ['customers.view_all', 'customers.delete', 'finance.refund'] as PermissionKey[],
            revoked: [] as PermissionKey[]
          }
        }
      };

      // Quyền được cấp thêm -> thành true
      expect(hasPermission(staffUser, 'customers.view_all', settingsWithGrant)).toBe(true);
      expect(hasPermission(staffUser, 'customers.delete', settingsWithGrant)).toBe(true);
      expect(hasPermission(staffUser, 'finance.refund', settingsWithGrant)).toBe(true);

      // Quyền cơ sở vẫn được giữ nguyên
      expect(hasPermission(staffUser, 'customers.create', settingsWithGrant)).toBe(true);
      expect(hasPermission(staffUser, 'finance.collect', settingsWithGrant)).toBe(true);

      // Quyền không cấp thêm và vai trò không có -> vẫn là false
      expect(hasPermission(staffUser, 'system.settings', settingsWithGrant)).toBe(false);
    });

    it('Tra cứu override theo staffCode hoặc SĐT hoặc Email thành công', () => {
      const settingsByCode = {
        userOverrides: {
          'CB001': {
            staffId: 'staff-001',
            staffCode: 'CB001',
            granted: ['customers.view_all'] as PermissionKey[],
            revoked: [] as PermissionKey[]
          }
        }
      };
      expect(hasPermission(staffUser, 'customers.view_all', settingsByCode)).toBe(true);
    });
  });

  describe('3. Phân quyền Đặc cách CHẶN BỚT (Revoke Overrides)', () => {
    it('Cán bộ thu bị chặn quyền cụ thể dù Cấp vai trò của họ có quyền đó', () => {
      const settingsWithRevoke = {
        rolePermissions: DEFAULT_ROLE_PERMISSIONS,
        userOverrides: {
          'staff-001': {
            staffId: 'staff-001',
            granted: [] as PermissionKey[],
            revoked: ['customers.create', 'finance.collect'] as PermissionKey[]
          }
        }
      };

      // Mặc dù vai trò 'Nhân viên' có quyền create và collect, nhưng bị chặn -> false
      expect(hasPermission(staffUser, 'customers.create', settingsWithRevoke)).toBe(false);
      expect(hasPermission(staffUser, 'finance.collect', settingsWithRevoke)).toBe(false);

      // Các quyền khác không bị chặn vẫn bình thường
      expect(hasPermission(staffUser, 'customers.edit', settingsWithRevoke)).toBe(true);
      expect(hasPermission(staffUser, 'finance.view', settingsWithRevoke)).toBe(true);
    });

    it('Quản lý bị chặn quyền chốt sổ tài chính thông qua đặc cách', () => {
      const settingsManagerRevoke = {
        rolePermissions: DEFAULT_ROLE_PERMISSIONS,
        userOverrides: {
          'mgr-001': {
            staffId: 'mgr-001',
            granted: [] as PermissionKey[],
            revoked: ['finance.settlement'] as PermissionKey[]
          }
        }
      };

      // Quản lý thông thường có quyền settlement, nhưng quản lý này bị chặn
      expect(hasPermission(managerUser, 'finance.settlement', settingsManagerRevoke)).toBe(false);
      // Quyền khác của quản lý vẫn được giữ
      expect(hasPermission(managerUser, 'customers.view_all', settingsManagerRevoke)).toBe(true);
    });
  });

  describe('4. Kết hợp CẤP THÊM và CHẶN BỚT (Hybrid Overrides)', () => {
    it('Vừa được cấp quyền mới vừa bị thu hồi quyền cũ đồng thời', () => {
      const hybridSettings = {
        rolePermissions: DEFAULT_ROLE_PERMISSIONS,
        userOverrides: {
          'staff-001': {
            staffId: 'staff-001',
            granted: ['customers.view_all'] as PermissionKey[],
            revoked: ['customers.edit'] as PermissionKey[]
          }
        }
      };

      // Được cấp thêm view_all
      expect(hasPermission(staffUser, 'customers.view_all', hybridSettings)).toBe(true);
      // Bị chặn edit
      expect(hasPermission(staffUser, 'customers.edit', hybridSettings)).toBe(false);
      // Create không can thiệp -> kế thừa vai trò (true)
      expect(hasPermission(staffUser, 'customers.create', hybridSettings)).toBe(true);
    });

    it('Quy tắc an toàn: Nếu 1 quyền vô tình nằm ở cả granted và revoked, quyền revoked (Chặn) luôn có độ ưu tiên cao nhất', () => {
      const conflictSettings = {
        userOverrides: {
          'staff-001': {
            staffId: 'staff-001',
            granted: ['customers.delete'] as PermissionKey[],
            revoked: ['customers.delete'] as PermissionKey[] // Xung đột
          }
        }
      };
      // Chặn luôn thắng Cấp
      expect(hasPermission(staffUser, 'customers.delete', conflictSettings)).toBe(false);
    });
  });

  describe('5. Bảo vệ Tuyệt Đối Quyền Quản Trị Viên (Admin Safety Guard)', () => {
    it('Admin tối cao luôn giữ 100% quyền hạn, không thể bị tước quyền bởi bất kỳ cấu hình override nào', () => {
      const maliciousSettings = {
        userOverrides: {
          'admin-001': {
            staffId: 'admin-001',
            granted: [],
            revoked: ALL_PERMISSIONS.map(p => p.key) // Cố tình tước toàn bộ quyền của Admin
          }
        }
      };

      for (const p of ALL_PERMISSIONS) {
        expect(hasPermission(adminUser, p.key, maliciousSettings)).toBe(true);
      }
    });
  });

  describe('6. Danh sách Quyền Hiệu Lực Thực Tế (getEffectivePermissionsForStaff)', () => {
    it('Tính toán chính xác tập hợp quyền cuối cùng của cán bộ thu', () => {
      const settings = {
        userOverrides: {
          'staff-001': {
            staffId: 'staff-001',
            granted: ['customers.view_all', 'reports.view_all'] as PermissionKey[],
            revoked: ['customers.create'] as PermissionKey[]
          }
        }
      };

      const effectivePerms = getEffectivePermissionsForStaff(staffUser, settings);

      expect(effectivePerms).toContain('customers.view_all');
      expect(effectivePerms).toContain('reports.view_all');
      expect(effectivePerms).not.toContain('customers.create');
      expect(effectivePerms).toContain('customers.edit'); // Từ vai trò gốc
    });
  });

  describe('7. Chuẩn hóa & Lưu trữ Dữ liệu (Sanitization & Persistence)', () => {
    it('sanitizeUserOverrides loại bỏ các key quyền không hợp lệ và loại bỏ các bản ghi rỗng', () => {
      const rawOverrides = {
        'staff-001': {
          staffId: 'staff-001',
          granted: ['customers.create', 'fake_perm_123'],
          revoked: ['invalid_key_xyz']
        },
        'staff-002': {
          staffId: 'staff-002',
          granted: [],
          revoked: [] // Rỗng -> tự động bị loại bỏ
        }
      };

      const sanitized = sanitizeUserOverrides(rawOverrides);
      expect(sanitized['staff-001']).toBeDefined();
      expect(sanitized['staff-001']!.granted).toEqual(['customers.create']);
      expect(sanitized['staff-001']!.revoked).toEqual([]);
      expect(sanitized['staff-002']).toBeUndefined();
    });

    it('extractUserOverridesFromPolicies trích xuất chính xác từ Supabase policies', () => {
      const mockOverrides = {
        'staff-001': {
          staffId: 'staff-001',
          granted: ['customers.view_all'] as PermissionKey[],
          revoked: [] as PermissionKey[]
        }
      };

      const mockPolicies: Policy[] = [
        {
          id: 101,
          parameter_type: 'rbac_user_overrides',
          name: 'Phân Quyền Đặc Cách Riêng Theo Nhân Viên',
          value: mockOverrides,
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const extracted = extractUserOverridesFromPolicies(mockPolicies);
      expect(extracted['staff-001']).toBeDefined();
      expect(extracted['staff-001']!.granted).toContain('customers.view_all');
    });

    it('storeUserOverrides & getStoredUserOverrides đồng bộ an toàn qua localStorage', () => {
      const map = {
        'staff-001': {
          staffId: 'staff-001',
          granted: ['customers.delete'] as PermissionKey[],
          revoked: [] as PermissionKey[]
        }
      };

      storeUserOverrides(map);
      const stored = getStoredUserOverrides();
      expect(stored['staff-001']).toBeDefined();
      expect(stored['staff-001']!.granted).toContain('customers.delete');
    });
  });
});
