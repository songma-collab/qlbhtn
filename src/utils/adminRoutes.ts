/**
 * Tiện ích quản lý và đồng bộ Định tuyến liên kết sâu (Deep Linking / URL Routing) cho Phân hệ Quản trị (Admin)
 * Định dạng chuẩn Web quốc tế: /admin/<module-slug>
 */

export const ADMIN_TAB_ROUTES: Record<string, string> = {
  'dashboard': '/admin/tong-quan',
  'crm-bhxh': '/admin/ho-so-bhxh',
  'crm-bhyt': '/admin/ho-so-bhyt',
  'crm-participation': '/admin/ho-so-tham-gia',
  'crm-dispatch': '/admin/dieu-phoi',
  'predictive-analytics': '/admin/du-bao',
  'finance-bhxh': '/admin/tai-chinh-bhxh',
  'finance-bhyt': '/admin/tai-chinh-bhyt',
  'financial-settlement': '/admin/chot-so-tai-chinh',
  'reports': '/admin/bao-cao-thong-ke',
  'commission-reports': '/admin/bao-cao-hoa-hong',
  'leaderboard': '/admin/bang-xep-hang',
  'staff': '/admin/nhan-vien',
  'system-settings': '/admin/cai-dat-he-thong',
  'homepage-settings': '/admin/cai-dat-trang-chu',
  'audit': '/admin/nhat-ky-hoat-dong'
};

/**
 * Bảng tra cứu ngược từ đường dẫn URL sang tab ID
 */
export const PATH_TO_ADMIN_TAB: Record<string, string> = Object.entries(ADMIN_TAB_ROUTES).reduce(
  (acc, [tab, path]) => {
    acc[path] = tab;
    return acc;
  },
  {} as Record<string, string>
);

// Bổ sung các alias dự phòng (ví dụ người dùng gõ tab ID trực tiếp hoặc gõ không dấu gạch chéo)
const ROUTE_ALIASES: Record<string, string> = {
  '/admin/crm': 'crm-bhxh',
  '/admin/bhxh': 'crm-bhxh',
  '/admin/bhyt': 'crm-bhyt',
  '/admin/finance': 'finance-bhxh',
  '/admin/settings': 'system-settings',
  '/admin/users': 'staff',
  '/admin/report': 'reports',
  // Hỗ trợ dạng phẳng nếu người dùng gõ theo kiểu cũ
  '/admin-tongquan': 'dashboard',
  '/admin-quanlyhosobhxh': 'crm-bhxh',
  '/admin-quanlyhosobhyt': 'crm-bhyt'
};

/**
 * Lấy Tab ID tương ứng từ đường dẫn URL pathname hiện tại
 * Tự động loại bỏ trailing slash và xử lý fallback an toàn về 'dashboard'
 */
export const getTabFromPathname = (pathname: string): string => {
  if (!pathname) return 'dashboard';

  // Chuẩn hóa: loại bỏ dấu gạch chéo ở cuối (trừ root '/')
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  // Nếu là gốc admin
  if (cleanPath === '/admin' || cleanPath === '/admin/') {
    return 'dashboard';
  }

  // Tra cứu theo map chuẩn
  if (PATH_TO_ADMIN_TAB[cleanPath]) {
    return PATH_TO_ADMIN_TAB[cleanPath];
  }

  // Tra cứu alias dự phòng
  if (ROUTE_ALIASES[cleanPath]) {
    return ROUTE_ALIASES[cleanPath];
  }

  // Tra cứu nếu đường dẫn chứa chính xác tab ID (ví dụ: /admin/crm-bhxh)
  for (const tabKey of Object.keys(ADMIN_TAB_ROUTES)) {
    if (cleanPath === `/admin/${tabKey}`) {
      return tabKey;
    }
  }

  return 'dashboard';
};

/**
 * Lấy đường dẫn URL pathname tương ứng từ Tab ID
 */
export const getPathFromTab = (tab: string): string => {
  return ADMIN_TAB_ROUTES[tab] || '/admin/tong-quan';
};
