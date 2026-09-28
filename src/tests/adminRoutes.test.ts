import { describe, it, expect } from 'vitest';
import { 
  ADMIN_TAB_ROUTES, 
  PATH_TO_ADMIN_TAB, 
  getTabFromPathname, 
  getPathFromTab 
} from '../utils/adminRoutes';

describe('Kiểm thử Hệ thống Định tuyến Phân hệ Quản trị (Admin URL Deep Linking)', () => {
  it('1. Đảm bảo toàn bộ 15 phân hệ quản trị đều có đường dẫn chuẩn quốc tế (/admin/...)', () => {
    const expectedModules = [
      'dashboard',
      'crm-bhxh',
      'crm-bhyt',
      'crm-dispatch',
      'predictive-analytics',
      'finance-bhxh',
      'finance-bhyt',
      'financial-settlement',
      'reports',
      'commission-reports',
      'leaderboard',
      'staff',
      'system-settings',
      'homepage-settings',
      'audit'
    ];

    for (const mod of expectedModules) {
      expect(ADMIN_TAB_ROUTES[mod]).toBeDefined();
      expect(ADMIN_TAB_ROUTES[mod].startsWith('/admin/')).toBe(true);
    }
  });

  it('2. getPathFromTab trả về đúng đường dẫn cho từng tab nghiệp vụ', () => {
    expect(getPathFromTab('dashboard')).toBe('/admin/tong-quan');
    expect(getPathFromTab('crm-bhxh')).toBe('/admin/ho-so-bhxh');
    expect(getPathFromTab('crm-bhyt')).toBe('/admin/ho-so-bhyt');
    expect(getPathFromTab('crm-dispatch')).toBe('/admin/dieu-phoi');
    expect(getPathFromTab('predictive-analytics')).toBe('/admin/du-bao');
    expect(getPathFromTab('finance-bhxh')).toBe('/admin/tai-chinh-bhxh');
    expect(getPathFromTab('finance-bhyt')).toBe('/admin/tai-chinh-bhyt');
    expect(getPathFromTab('financial-settlement')).toBe('/admin/chot-so-tai-chinh');
    expect(getPathFromTab('reports')).toBe('/admin/bao-cao-thong-ke');
    expect(getPathFromTab('commission-reports')).toBe('/admin/bao-cao-hoa-hong');
    expect(getPathFromTab('leaderboard')).toBe('/admin/bang-xep-hang');
    expect(getPathFromTab('staff')).toBe('/admin/nhan-vien');
    expect(getPathFromTab('system-settings')).toBe('/admin/cai-dat-he-thong');
    expect(getPathFromTab('homepage-settings')).toBe('/admin/cai-dat-trang-chu');
    expect(getPathFromTab('audit')).toBe('/admin/nhat-ky-hoat-dong');

    // Tab không tồn tại -> fallback về tổng quan
    expect(getPathFromTab('unknown_xyz')).toBe('/admin/tong-quan');
  });

  it('3. getTabFromPathname phân tích chính xác tab id từ đường dẫn URL', () => {
    expect(getTabFromPathname('/admin/tong-quan')).toBe('dashboard');
    expect(getTabFromPathname('/admin/ho-so-bhxh')).toBe('crm-bhxh');
    expect(getTabFromPathname('/admin/ho-so-bhyt')).toBe('crm-bhyt');
    expect(getTabFromPathname('/admin/dieu-phoi')).toBe('crm-dispatch');
    expect(getTabFromPathname('/admin/tai-chinh-bhxh')).toBe('finance-bhxh');
    expect(getTabFromPathname('/admin/bao-cao-thong-ke')).toBe('reports');
    expect(getTabFromPathname('/admin/nhan-vien')).toBe('staff');
    expect(getTabFromPathname('/admin/cai-dat-he-thong')).toBe('system-settings');
  });

  it('4. Tự động xử lý trailing slash và các trường hợp nhập URL đặc biệt', () => {
    // Có dấu gạch chéo ở đuôi
    expect(getTabFromPathname('/admin/tong-quan/')).toBe('dashboard');
    expect(getTabFromPathname('/admin/ho-so-bhxh/')).toBe('crm-bhxh');
    expect(getTabFromPathname('/admin/bao-cao-thong-ke/')).toBe('reports');

    // Đường dẫn gốc /admin hoặc /admin/
    expect(getTabFromPathname('/admin')).toBe('dashboard');
    expect(getTabFromPathname('/admin/')).toBe('dashboard');

    // Fallback an toàn cho đường dẫn lạ
    expect(getTabFromPathname('/admin/duong-dan-khong-ton-tai')).toBe('dashboard');
  });

  it('5. Hỗ trợ các alias dự phòng và URL trực tiếp', () => {
    expect(getTabFromPathname('/admin/crm-bhxh')).toBe('crm-bhxh');
    expect(getTabFromPathname('/admin/crm-bhyt')).toBe('crm-bhyt');
    expect(getTabFromPathname('/admin/bhxh')).toBe('crm-bhxh');
    expect(getTabFromPathname('/admin/bhyt')).toBe('crm-bhyt');
    expect(getTabFromPathname('/admin/settings')).toBe('system-settings');
  });

  it('6. Tính toàn vẹn hai chiều (Bi-directional Consistency) giữa getTabFromPathname và getPathFromTab', () => {
    // Đảm bảo mọi tab nghiệp vụ khi đổi sang URL rồi đọc lại từ URL đều cho ra đúng tab ban đầu 100%
    for (const [tabKey, routePath] of Object.entries(ADMIN_TAB_ROUTES)) {
      expect(getTabFromPathname(routePath)).toBe(tabKey);
      expect(getPathFromTab(tabKey)).toBe(routePath);
    }
  });

  it('7. Trích xuất đúng tab nghiệp vụ khi người dùng chia sẻ link trực tiếp từ bên ngoài', () => {
    // Kịch bản chia sẻ link: /admin/tai-chinh-bhxh
    const sharedFinancePath = '/admin/tai-chinh-bhxh';
    const resolvedTab = getTabFromPathname(sharedFinancePath);
    expect(resolvedTab).toBe('finance-bhxh');
    expect(getPathFromTab(resolvedTab)).toBe(sharedFinancePath);

    // Kịch bản chia sẻ link: /admin/dieu-phoi
    const sharedDispatchPath = '/admin/dieu-phoi';
    expect(getTabFromPathname(sharedDispatchPath)).toBe('crm-dispatch');

    // Kịch bản chia sẻ link: /admin/bang-xep-hang
    const sharedLeaderboardPath = '/admin/bang-xep-hang';
    expect(getTabFromPathname(sharedLeaderboardPath)).toBe('leaderboard');
  });
});

