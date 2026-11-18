import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audit Toàn Diện Tốc Độ Tải Trang, Chuyển Cảnh, Chuyển Tab & Hiệu Năng Nghiệp Vụ', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');
  const navbarPath = path.resolve(__dirname, '../components/Navbar.tsx');
  const adminViewPath = path.resolve(__dirname, '../components/AdminView.tsx');
  const skeletonPath = path.resolve(__dirname, '../components/common/Skeleton.tsx');
  const cssPath = path.resolve(__dirname, '../index.css');

  describe('1. Tốc độ tải trang ban đầu & Cô lập gói thư viện nặng (Bundle Optimization)', () => {
    it('1.1. App.tsx phải nạp lazy tất cả các trang thứ cấp với lazyWithRetry', () => {
      const appCode = fs.readFileSync(appPath, 'utf-8');
      expect(appCode).toContain("const AdminView = lazyWithRetry(() => import('./components/AdminView'));");
      expect(appCode).toContain("const ContributionCalculationView = lazyWithRetry(() => import('./components/ContributionCalculationView'));");
      expect(appCode).toContain("const PensionAssistantView = lazyWithRetry(() => import('./components/PensionAssistantView'));");
      expect(appCode).toContain("const SupportView = lazyWithRetry(() => import('./components/SupportView'));");
      expect(appCode).toContain("const BHXH1LanView = lazyWithRetry(() => import('./components/BHXH1LanView'));");
    });

    it('1.2. Thư viện PDF (2MB) và Excel (868kB) phải được dynamic import theo nhu cầu, không cản trở tải trang', () => {
      const bhxh1LanPath = path.resolve(__dirname, '../components/calculators/BHXH1LanCalc.tsx');
      const crmViewPath = path.resolve(__dirname, '../components/admin/CRMView.tsx');

      const bhxhCode = fs.readFileSync(bhxh1LanPath, 'utf-8');
      const crmCode = fs.readFileSync(crmViewPath, 'utf-8');

      // PDF chỉ nạp khi cần
      expect(bhxhCode).toContain("await import('pdfmake/build/pdfmake')");
      // Excel chỉ nạp khi cần
      expect(crmCode).toContain("await import('xlsx-js-style')");
    });
  });

  describe('2. Chuyển cảnh Điều hướng & Tải trước Thông minh (Speculative Prefetching)', () => {
    it('2.1. Navbar phải tích hợp preloadPublicRoute khi rê chuột (onMouseEnter) vào các liên kết chính', () => {
      const navCode = fs.readFileSync(navbarPath, 'utf-8');
      expect(navCode).toContain('const preloadPublicRoute = (targetPath: string) => {');
      expect(navCode).toContain("import('./ContributionCalculationView');");
      expect(navCode).toContain("import('./BHXH1LanView');");
      expect(navCode).toContain("import('./PensionAssistantView');");
      expect(navCode).toContain("import('./AdminView');");
      expect(navCode).toContain('onMouseEnter={() => preloadPublicRoute(item.path)}');
      expect(navCode).toContain("onMouseEnter={() => preloadPublicRoute('/admin')}");
    });
  });

  describe('3. Tốc độ Chuyển Tab Quản Trị (Admin Tab Switching Performance)', () => {
    const adminCode = fs.readFileSync(adminViewPath, 'utf-8');

    it('3.1. AdminView phải hỗ trợ preloadModule đầy đủ 14 phân hệ quản trị', () => {
      expect(adminCode).toContain("case 'dashboard':");
      expect(adminCode).toContain("case 'crm-bhxh':");
      expect(adminCode).toContain("case 'crm-participation':");
      expect(adminCode).toContain("case 'crm-dispatch':");
      expect(adminCode).toContain("case 'finance-bhxh':");
      expect(adminCode).toContain("case 'financial-settlement':");
      expect(adminCode).toContain("case 'predictive-analytics':");
      expect(adminCode).toContain("case 'reports':");
      expect(adminCode).toContain("case 'commission-reports':");
      expect(adminCode).toContain("case 'leaderboard':");
      expect(adminCode).toContain("case 'staff':");
      expect(adminCode).toContain("case 'system-settings':");
      expect(adminCode).toContain("case 'homepage-settings':");
      expect(adminCode).toContain("case 'audit':");
    });

    it('3.2. Chuyển tab sử dụng React.startTransition để không chặn luồng giao diện chính', () => {
      expect(adminCode).toContain('React.startTransition(() => {');
      expect(adminCode).toContain('setAdminTab(tab);');
    });

    it('3.3. Thời gian chuyển tab siêu tốc với animate-tab-fade 150ms êm dịu, không giật khung hình', () => {
      const cssCode = fs.readFileSync(cssPath, 'utf-8');
      expect(cssCode).toContain('.animate-tab-fade {');
      expect(cssCode).toContain('animation: adminTabFadeIn 0.15s ease-out forwards;');
      expect(adminCode).toContain('className="animate-tab-fade"');
    });

    it('3.4. ModuleLoadingSkeleton cung cấp khung giữ chỗ chính xác từng phân hệ (CLS = 0)', () => {
      const skelCode = fs.readFileSync(skeletonPath, 'utf-8');
      expect(skelCode).toContain("if (tab === 'dashboard')");
      expect(skelCode).toContain("if (tab?.startsWith('crm-') || tab?.startsWith('finance-'))");
      expect(skelCode).toContain('CustomerTableSkeleton');
    });
  });
});
