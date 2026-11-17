import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Audit Toàn Diện Các Công Việc Vừa Triển Khai (Recent Deployments Audit)', () => {
  const crmTablePath = path.resolve(__dirname, '../components/admin/crm/CustomerTableView.tsx');
  const dispatchOpsPath = path.resolve(__dirname, '../components/admin/DispatchOperations.tsx');
  const reminderModalPath = path.resolve(__dirname, '../components/modals/RenewalReminderModal.tsx');

  describe('1. Phân hệ CRM - Khắc phục Popup "Thao tác bổ trợ" bị chìm / che khuất', () => {
    const crmCode = fs.readFileSync(crmTablePath, 'utf-8');

    it('1.1. Phải import và sử dụng createPortal từ react-dom', () => {
      expect(crmCode).toContain("import { createPortal } from 'react-dom';");
      expect(crmCode).toContain("createPortal(");
    });

    it('1.2. Popup menu phải được render với tầng hiển thị z-[99999] và position fixed', () => {
      expect(crmCode).toContain("fixed z-[99999]");
      expect(crmCode).toContain("action-menu-portal");
    });

    it('1.3. Cơ chế định vị thông minh: tính toán lật ngược (openUpwards) và clamp mép màn hình', () => {
      expect(crmCode).toContain("const spaceBelow = window.innerHeight - rect.bottom;");
      expect(crmCode).toContain("const openUpwards = spaceBelow < 300 && rect.top > 300;");
      expect(crmCode).toContain("let rightPos = window.innerWidth - rect.right;");
      expect(crmCode).toContain("if (rightPos < 10) rightPos = 10;");
      expect(crmCode).toContain("rightPos = Math.max(10, window.innerWidth - menuWidth - 10);");
    });

    it('1.4. Lắng nghe và tự động đóng menu khi nhấp ngoài, Escape, scroll hoặc resize', () => {
      expect(crmCode).toContain("document.addEventListener('pointerdown', handleOutsideClick);");
      expect(crmCode).toContain("document.addEventListener('keydown', handleKeyDown);");
      expect(crmCode).toContain("window.addEventListener('resize', handleScrollOrResize);");
      expect(crmCode).toContain("window.addEventListener('scroll', handleScrollOrResize, true);");
    });

    it('1.5. Đảm bảo chứa đầy đủ 7 chức năng tác nghiệp trong popup', () => {
      expect(crmCode).toContain("Tạo mã VietQR nộp tiền");
      expect(crmCode).toContain("Sao chép tin nhắn Zalo");
      expect(crmCode).toContain("Hồ sơ tham gia trước đây");
      expect(crmCode).toContain("Đổi trạng thái tham gia");
      expect(crmCode).toContain("Phân công cán bộ quản lý");
      expect(crmCode).toContain("Chỉnh sửa thông tin");
      expect(crmCode).toContain("Xóa khách hàng");
    });

    it('1.6. Khung chứa bảng trên máy tính phải có min-h-[300px] để đảm bảo độ cao tối thiểu khi lọc 1 người', () => {
      expect(crmCode).toContain("min-h-[300px]");
    });
  });

  describe('2. Phân hệ Điều Phối & Đôn Đốc Thu Phí - Nhật Ký Tác Nghiệp & Icon CCCD', () => {
    const dispatchCode = fs.readFileSync(dispatchOpsPath, 'utf-8');

    it('2.1. Đã thay dòng chữ thừa "ĐDCN/CCCD:" bằng icon IdCard', () => {
      expect(dispatchCode).not.toContain("`ĐDCN/CCCD: ${c.cccd || c.bhxh}`");
      expect(dispatchCode).toContain("IdCard");
      expect(dispatchCode).toContain("<IdCard className=\"w-3 h-3 text-slate-400 shrink-0\" />");
    });

    it('2.2. Dòng định danh CCCD phải được căn chỉnh 1 hàng (whitespace-nowrap flex items-center)', () => {
      expect(dispatchCode).toContain("flex items-center gap-1.5 text-[10px] text-slate-500 font-mono font-medium mt-0.5 whitespace-nowrap");
    });

    it('2.3. Cột Nhật ký tác nghiệp phải có ràng buộc độ rộng chống tràn sang cột khác', () => {
      expect(dispatchCode).toContain('th className="py-3.5 px-3 min-w-[170px] max-w-[210px]">Nhật Ký Tác Nghiệp</th>');
      expect(dispatchCode).toContain('td className="py-3.5 px-3 min-w-[170px] max-w-[210px]"');
    });

    it('2.4. Select trạng thái và dòng ghi chú chi tiết phải có class truncate max-w-[190px]', () => {
      expect(dispatchCode).toContain('max-w-[190px]');
      expect(dispatchCode).toContain('truncate block');
      expect(dispatchCode).toContain('text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[190px]');
    });
  });

  describe('3. Phân hệ Trung Tâm Quản Lý & Nhắc Hạn Hồ Sơ', () => {
    const reminderCode = fs.readFileSync(reminderModalPath, 'utf-8');

    it('3.1. Tiêu đề cột được đổi thành "SĐT & Số tiền" và định dạng căn giữa (text-center)', () => {
      expect(reminderCode).toContain('th className="px-3 py-3 text-center">SĐT & Số tiền</th>');
      expect(reminderCode).toContain('td className="px-3 py-3 text-center"');
    });

    it('3.2. Không còn hiển thị dấu gạch ngang --- thừa thãi ở cột SĐT & Số tiền', () => {
      expect(reminderCode).not.toContain("<div className=\"font-mono text-xs text-gray-600\">{code || '---'}</div>");
    });

    it('3.3. Cột "Kỳ Đóng Gần Nhất" hiển thị chính xác chuỗi kỳ đóng', () => {
      expect(reminderCode).toContain('th className="px-3 py-3 text-left">Kỳ Đóng Gần Nhất</th>');
      expect(reminderCode).toContain('periodDisplay');
    });

    it('3.4. Có tab/thẻ đếm "Kỳ Đóng Mới (Luật 2024)"', () => {
      expect(reminderCode).toContain('Kỳ Đóng Mới (Luật 2024)');
    });
  });
});
