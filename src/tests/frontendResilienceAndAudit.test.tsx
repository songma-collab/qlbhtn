import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audit Toàn Diện Giao Diện Frontend & Phòng Vệ Lỗi Tiềm Ẩn (Frontend Resilience Audit)', () => {
  const appPath = path.resolve(__dirname, '../App.tsx');
  const adminViewPath = path.resolve(__dirname, '../components/AdminView.tsx');
  const customerTablePath = path.resolve(__dirname, '../components/admin/crm/CustomerTableView.tsx');

  describe('1. Cấu trúc Phòng thủ Đa tầng (Multi-tier Error Boundary Defense)', () => {
    it('1.1. App.tsx phải bọc DeferredRoute trong ErrorBoundary để cô lập lỗi ở các trang con', () => {
      const appCode = fs.readFileSync(appPath, 'utf-8');
      expect(appCode).toContain('<ErrorBoundary>');
      expect(appCode).toContain('<React.Suspense');
      // Đảm bảo ErrorBoundary bọc ngoài hoặc trong DeferredRoute
      expect(appCode).toMatch(/const DeferredRoute = \({\s*children\s*}\s*:\s*{\s*children:\s*React\.ReactNode\s*}\)\s*=>\s*\(\s*<ErrorBoundary>/);
    });

    it('1.2. AdminView.tsx phải bọc các tab quản trị trong ErrorBoundary động theo tab', () => {
      const adminCode = fs.readFileSync(adminViewPath, 'utf-8');
      expect(adminCode).toContain("import { ErrorBoundary } from './common/ErrorBoundary';");
      expect(adminCode).toContain('<ErrorBoundary');
      expect(adminCode).toContain('key={adminTab}');
      expect(adminCode).toContain('fallbackTitle="Đã xảy ra sự cố trong phân hệ này"');
    });
  });

  describe('2. An toàn Portal & Ngăn chặn Null Pointer Dereference trong CustomerTableView', () => {
    it('2.1. Portal Thao tác bổ trợ phải có kiểm tra an toàn if (!r || !rect) return null', () => {
      const tableCode = fs.readFileSync(customerTablePath, 'utf-8');
      expect(tableCode).toContain('if (!r || !rect) return null;');
    });
  });

  describe('3. Tải động thành công các Phân hệ Frontend (Lazy Component Load Integrity)', () => {
    it('3.1. Nạp thành công PensionAssistant & PensionAssistantView không lỗi ReferenceError', async () => {
      const pensionMod = await import('../components/calculators/PensionAssistant');
      expect(pensionMod.default).toBeDefined();

      const pensionViewMod = await import('../components/PensionAssistantView');
      expect(pensionViewMod.default).toBeDefined();
    });

    it('3.2. Nạp thành công BHXH1LanCalc & BHXH1LanView', async () => {
      const bhxh1LanMod = await import('../components/calculators/BHXH1LanCalc');
      expect(bhxh1LanMod.default).toBeDefined();

      const bhxh1LanViewMod = await import('../components/BHXH1LanView');
      expect(bhxh1LanViewMod.default).toBeDefined();
    });

    it('3.3. Nạp thành công DispatchOperations & CustomerTableView', async () => {
      const dispatchMod = await import('../components/admin/DispatchOperations');
      expect(dispatchMod.default).toBeDefined();

      const tableMod = await import('../components/admin/crm/CustomerTableView');
      expect(tableMod.CustomerTableView).toBeDefined();
    });
  });
});
