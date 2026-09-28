/**
 * Tiện ích Quản lý Phân Quyền Chi Tiết (Role-Based Access Control - RBAC)
 * Hệ thống Quản lý Khách hàng Thu BHXH Tự nguyện & BHYT Hộ gia đình
 */

export type PermissionKey =
  // Khách hàng & Hồ sơ
  | 'customers.view_all'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.delete'
  | 'customers.export'
  // Tài chính & Thu tiền
  | 'finance.view'
  | 'finance.collect'
  | 'finance.refund'
  | 'finance.settlement'
  // Báo cáo & Thống kê
  | 'reports.view_all'
  | 'reports.export_excel'
  | 'reports.export_pdf'
  | 'reports.leaderboard'
  // Đôn đốc & Gia hạn
  | 'dispatch.view'
  | 'dispatch.message'
  | 'dispatch.renew'
  | 'dispatch.export'
  // Quản trị hệ thống
  | 'system.staff'
  | 'system.roles'
  | 'system.settings'
  | 'system.audit';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  isSensitive?: boolean; // Quyền nhạy cảm (rủi ro thất thoát/sai lệch dữ liệu)
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  permissions: PermissionDefinition[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'customers',
    name: 'Quản Lý Khách Hàng & Hồ Sơ',
    description: 'Quyền thao tác với danh sách người tham gia BHXH / BHYT',
    color: 'blue',
    permissions: [
      {
        key: 'customers.view_all',
        label: 'Xem toàn bộ khách hàng trong đại lý',
        description: 'Cho phép xem dữ liệu toàn đại lý. Nếu tắt, cán bộ chỉ thấy hồ sơ do mình phụ trách.'
      },
      {
        key: 'customers.create',
        label: 'Thêm mới hồ sơ',
        description: 'Lập hồ sơ đăng ký mới BHXH tự nguyện hoặc BHYT hộ gia đình.'
      },
      {
        key: 'customers.edit',
        label: 'Chỉnh sửa thông tin hồ sơ',
        description: 'Cập nhật thông tin cá nhân, CCCD, số điện thoại, địa chỉ của người tham gia.'
      },
      {
        key: 'customers.delete',
        label: 'Xóa hồ sơ / khách hàng',
        description: 'Xóa dữ liệu khách hàng khỏi hệ thống (Hành động có rủi ro cao).',
        isSensitive: true
      },
      {
        key: 'customers.export',
        label: 'Xuất danh sách khách hàng ra Excel',
        description: 'Tải toàn bộ danh sách khách hàng và thông tin định danh ra file bảng tính.'
      }
    ]
  },
  {
    id: 'finance',
    name: 'Tài Chính & Thu Tiền',
    description: 'Quyền quản lý giao dịch thu, thoái thu hoàn trả và chốt sổ tài chính',
    color: 'emerald',
    permissions: [
      {
        key: 'finance.view',
        label: 'Xem nhật ký thu tiền & giao dịch',
        description: 'Theo dõi dòng tiền thu nộp của đại lý.'
      },
      {
        key: 'finance.collect',
        label: 'Lập phiếu thu & xác nhận thu tiền',
        description: 'Tạo phiếu nộp tiền, xác nhận đã nhận tiền và sinh mã VietQR thanh toán.'
      },
      {
        key: 'finance.refund',
        label: 'Lập bút toán thoái thu & hoàn trả',
        description: 'Hủy giao dịch thu, hoàn tiền theo quyết định cơ quan BHXH và thu hồi hoa hồng.',
        isSensitive: true
      },
      {
        key: 'finance.settlement',
        label: 'Báo cáo quyết toán & chốt sổ',
        description: 'Kiểm toán doanh thu, chốt sổ công nợ định kỳ và đối soát hoa hồng đại lý.',
        isSensitive: true
      }
    ]
  },
  {
    id: 'reports',
    name: 'Báo Cáo & Thống Kê',
    description: 'Quyền xem và xuất báo cáo kết quả thu theo định dạng chuẩn',
    color: 'amber',
    permissions: [
      {
        key: 'reports.view_all',
        label: 'Xem báo cáo doanh thu toàn đại lý',
        description: 'Cho phép xem tổng hợp số liệu thu của tất cả nhân viên trong đại lý.'
      },
      {
        key: 'reports.export_excel',
        label: 'Xuất báo cáo thống kê ra Excel',
        description: 'Xuất bảng tổng hợp thu theo mẫu Nghị định 30/2020/NĐ-CP ra file Excel.'
      },
      {
        key: 'reports.export_pdf',
        label: 'Xuất tài liệu PDF & In ấn chuẩn hành chính',
        description: 'Tạo bản in khổ A4 và tài liệu PDF có đầy đủ Quốc hiệu Tiêu ngữ và ô chữ ký.'
      },
      {
        key: 'reports.leaderboard',
        label: 'Xem bảng thi đua & chỉ số KPI',
        description: 'Theo dõi xếp hạng hiệu suất thu và mức độ hoàn thành chỉ tiêu của cán bộ.'
      }
    ]
  },
  {
    id: 'dispatch',
    name: 'Đôn Đốc & Nhắc Hạn Gia Hạn',
    description: 'Quyền truy cập trung tâm nhắc hạn và gửi thông báo cho khách hàng',
    color: 'purple',
    permissions: [
      {
        key: 'dispatch.view',
        label: 'Xem Trung tâm nhắc hạn & danh sách đôn đốc',
        description: 'Truy cập danh sách hồ sơ quá hạn, khẩn cấp và sắp đến hạn đóng tiếp theo.'
      },
      {
        key: 'dispatch.message',
        label: 'Gửi tin nhắn đôn đốc (Zalo / SMS)',
        description: 'Tạo mẫu tin nhắn nghiệp vụ và kích hoạt gửi thông báo gia hạn.'
      },
      {
        key: 'dispatch.renew',
        label: 'Thực hiện gia hạn nhanh 1 chạm',
        description: 'Mở form gia hạn thu tiền trực tiếp từ danh sách hồ sơ đến hạn.'
      },
      {
        key: 'dispatch.export',
        label: 'Xuất Excel danh sách đôn đốc',
        description: 'Tải danh sách khách hàng đến hạn đóng để cán bộ đi đôn đốc thực địa.'
      }
    ]
  },
  {
    id: 'system',
    name: 'Quản Trị Hệ Thống & Bảo Mật',
    description: 'Quyền can thiệp cấu hình, nhân sự và kiểm soát hoạt động',
    color: 'rose',
    permissions: [
      {
        key: 'system.staff',
        label: 'Quản lý danh sách nhân viên',
        description: 'Thêm mới nhân viên, cập nhật thông tin và khóa tài khoản cán bộ.',
        isSensitive: true
      },
      {
        key: 'system.roles',
        label: 'Thiết lập ma trận phân quyền',
        description: 'Thay đổi và lưu trữ quyền truy cập cho các cấp vai trò trong hệ thống.',
        isSensitive: true
      },
      {
        key: 'system.settings',
        label: 'Cấu hình tham số hệ thống',
        description: 'Điều chỉnh chuẩn nghèo, lương cơ sở, lãi suất và tỷ lệ hoa hồng đại lý.',
        isSensitive: true
      },
      {
        key: 'system.audit',
        label: 'Xem nhật ký kiểm toán hoạt động',
        description: 'Tra cứu lịch sử đăng nhập, thay đổi dữ liệu và các hành vi an ninh hệ thống.'
      }
    ]
  }
];

export type RolePermissionsMap = Record<string, (PermissionKey | string)[]>;
export type SanitizedRolePermissionsMap = Record<string, PermissionKey[]>;

/**
 * Cấu hình phân quyền mặc định an toàn cho các cấp vai trò
 */
export const DEFAULT_ROLE_PERMISSIONS: SanitizedRolePermissionsMap = {
  Admin: [
    // Admin có toàn bộ 100% quyền hạn
    'customers.view_all',
    'customers.create',
    'customers.edit',
    'customers.delete',
    'customers.export',
    'finance.view',
    'finance.collect',
    'finance.refund',
    'finance.settlement',
    'reports.view_all',
    'reports.export_excel',
    'reports.export_pdf',
    'reports.leaderboard',
    'dispatch.view',
    'dispatch.message',
    'dispatch.renew',
    'dispatch.export',
    'system.staff',
    'system.roles',
    'system.settings',
    'system.audit'
  ],
  'Quản lý': [
    // Quản lý: Có quyền giám sát, xuất báo cáo toàn đại lý, đôn đốc nhưng hạn chế xóa dữ liệu và cấu hình hệ thống
    'customers.view_all',
    'customers.create',
    'customers.edit',
    'customers.export',
    'finance.view',
    'finance.collect',
    'finance.refund',
    'finance.settlement',
    'reports.view_all',
    'reports.export_excel',
    'reports.export_pdf',
    'reports.leaderboard',
    'dispatch.view',
    'dispatch.message',
    'dispatch.renew',
    'dispatch.export',
    'system.audit'
  ],
  'Nhân viên': [
    // Nhân viên: Tập trung vào tác nghiệp trực tiếp, chỉ xem hồ sơ và báo cáo cá nhân
    'customers.create',
    'customers.edit',
    'finance.view',
    'finance.collect',
    'reports.export_excel',
    'reports.export_pdf',
    'reports.leaderboard',
    'dispatch.view',
    'dispatch.message',
    'dispatch.renew',
    'dispatch.export'
  ]
};

export interface UserPermissionOverride {
  staffId: string;
  staffName?: string;
  staffCode?: string;
  role?: string;
  granted: PermissionKey[];
  revoked: PermissionKey[];
  notes?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type UserOverridesMap = Record<string, UserPermissionOverride>;

/**
 * Tra cứu đặc cách quyền hạn riêng của một nhân viên
 */
export const getUserOverride = (
  user: any,
  settings?: any
): UserPermissionOverride | null => {
  if (!user || !settings?.userOverrides) return null;
  const map: Record<string, UserPermissionOverride> = settings.userOverrides;

  const staffId = user.id ? String(user.id) : '';
  const staffCode = user.staffCode ? String(user.staffCode) : '';
  const email = user.email ? String(user.email).toLowerCase() : '';
  const phone = user.phone ? String(user.phone) : '';
  const username = user.username ? String(user.username).toLowerCase() : '';

  return (
    (staffId && map[staffId]) ||
    (staffCode && map[staffCode]) ||
    (email && map[email]) ||
    (phone && map[phone]) ||
    (username && map[username]) ||
    null
  );
};

/**
 * Kiểm tra xem người dùng hiện tại có quyền thực hiện hành động hay không
 * Thứ tự ưu tiên:
 * 1. Quản trị viên (Admin) tối cao: Toàn quyền tuyệt đối 100%
 * 2. Phân quyền đặc cách riêng theo nhân viên (User Overrides):
 *    - Bị CHẶN (Revoked): Từ chối ngay lập tức
 *    - Được CẤP (Granted): Cho phép ngay lập tức
 * 3. Quyền gắn trực tiếp trên profile session (currentUser.permissions)
 * 4. Kế thừa từ Cấp vai trò (Role Permissions)
 * @param currentUser Người dùng đang đăng nhập
 * @param permission Quyền hạn cần kiểm tra
 * @param settings Cấu hình hệ thống (chứa bảng phân quyền vai trò và đặc cách)
 */
export const hasPermission = (
  currentUser: any,
  permission: PermissionKey,
  settings?: any
): boolean => {
  if (!currentUser) return false;

  const role = (currentUser.role || '').trim();
  const lowerRole = role.toLowerCase();
  const userName = (currentUser.name || '').toLowerCase();

  // 1. Quản trị viên tối cao (Admin / Chủ đại lý Phạm Văn Học) luôn có toàn quyền tuyệt đối
  if (
    lowerRole === 'admin' ||
    lowerRole === 'quản trị viên' ||
    userName.includes('phạm văn học') ||
    userName.includes('pham van hoc')
  ) {
    return true;
  }

  // 2. Tra cứu đặc cách riêng theo nhân viên từ settings.userOverrides
  const override = getUserOverride(currentUser, settings);
  if (override) {
    // 2.1. Nếu bị đặc cách CHẶN (Revoked) -> từ chối ngay lập tức (ưu tiên chặn bảo mật)
    if (Array.isArray(override.revoked) && override.revoked.includes(permission)) {
      return false;
    }
    // 2.2. Nếu được đặc cách CẤP (Granted) -> cho phép ngay lập tức
    if (Array.isArray(override.granted) && override.granted.includes(permission)) {
      return true;
    }
  }

  // 3. Kiểm tra nếu có quyền ghi đè riêng cho tài khoản này (custom individual permissions trên session)
  if (Array.isArray(currentUser.permissions)) {
    if (currentUser.permissions.includes(permission)) return true;
  }

  // 4. Lấy ma trận quyền của vai trò từ cấu hình đã lưu (settings.rolePermissions) hoặc mặc định
  const savedPermissions: RolePermissionsMap = settings?.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
  const rolePerms = savedPermissions[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];

  return rolePerms.includes(permission);
};

/**
 * Lấy danh sách quyền hạn hiện tại của một vai trò
 */
export const getPermissionsForRole = (
  role: string,
  settings?: any
): PermissionKey[] => {
  if (role === 'Admin') {
    return DEFAULT_ROLE_PERMISSIONS.Admin;
  }
  const cleanMap = sanitizeRolePermissions(settings?.rolePermissions);
  return cleanMap[role] || DEFAULT_ROLE_PERMISSIONS[role] || [];
};

export const ALL_PERMISSIONS: PermissionDefinition[] = PERMISSION_GROUPS.flatMap(g => g.permissions);

/**
 * Chuẩn hóa bảng phân quyền trước khi lưu trữ (loại bỏ key rác và bảo vệ quyền cốt lõi của Admin)
 */
export const sanitizeRolePermissions = (
  map?: RolePermissionsMap | Record<string, any> | null
): SanitizedRolePermissionsMap => {
  const cleanMap: SanitizedRolePermissionsMap = {};
  const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));

  for (const [role, perms] of Object.entries(map || {})) {
    if (Array.isArray(perms)) {
      cleanMap[role] = perms.filter(k => validKeys.has(k as PermissionKey)) as PermissionKey[];
    }
  }

  return {
    ...cleanMap,
    Admin: [...DEFAULT_ROLE_PERMISSIONS.Admin] // Luôn giữ 100% quyền cho Admin
  };
};

/**
 * Tính toán danh sách quyền hiệu lực thực tế cuối cùng của một nhân viên
 * (Kết hợp quyền vai trò cơ sở + Quyền được cấp đặc cách - Quyền bị chặn đặc cách)
 */
export const getEffectivePermissionsForStaff = (
  staff: any,
  settings?: any
): PermissionKey[] => {
  if (!staff) return [];
  const role = staff.role || 'Nhân viên';

  // Admin luôn có toàn quyền 100%
  if (
    role.toLowerCase() === 'admin' ||
    role.toLowerCase() === 'quản trị viên' ||
    (staff.name || '').toLowerCase().includes('phạm văn học')
  ) {
    return [...DEFAULT_ROLE_PERMISSIONS.Admin];
  }

  // 1. Quyền cơ sở từ vai trò
  const baseRolePerms = getPermissionsForRole(role, settings);
  const effectiveSet = new Set<PermissionKey>(baseRolePerms);

  // 2. Áp dụng đặc cách riêng nếu có
  const override = getUserOverride(staff, settings);
  if (override) {
    // 2.1. Cấp thêm
    if (Array.isArray(override.granted)) {
      override.granted.forEach(k => effectiveSet.add(k));
    }
    // 2.2. Chặn lại
    if (Array.isArray(override.revoked)) {
      override.revoked.forEach(k => effectiveSet.delete(k));
    }
  }

  return Array.from(effectiveSet);
};

/**
 * Chuẩn hóa bảng phân quyền đặc cách riêng theo nhân viên trước khi lưu
 */
export const sanitizeUserOverrides = (
  map?: Record<string, any> | null
): UserOverridesMap => {
  if (!map || typeof map !== 'object') return {};
  const validKeys = new Set(ALL_PERMISSIONS.map(p => p.key));
  const sanitized: UserOverridesMap = {};

  for (const [key, val] of Object.entries(map)) {
    if (val && typeof val === 'object') {
      const granted = Array.isArray(val.granted)
        ? (val.granted.filter((k: any) => validKeys.has(k)) as PermissionKey[])
        : [];
      const revoked = Array.isArray(val.revoked)
        ? (val.revoked.filter((k: any) => validKeys.has(k)) as PermissionKey[])
        : [];

      // Chỉ lưu nếu nhân viên có ít nhất 1 quyền cấp thêm hoặc bị chặn
      if (granted.length > 0 || revoked.length > 0) {
        sanitized[key] = {
          staffId: val.staffId || key,
          staffName: val.staffName || '',
          staffCode: val.staffCode || '',
          role: val.role || '',
          granted,
          revoked,
          notes: val.notes || '',
          updatedAt: val.updatedAt || new Date().toISOString(),
          updatedBy: val.updatedBy || ''
        };
      }
    }
  }

  return sanitized;
};

