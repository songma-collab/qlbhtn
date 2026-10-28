import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customerService } from '../services/customerService';
import { recordService } from '../services/recordService';

// Mock Supabase
vi.mock('../lib/supabase', () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return {
    supabase: {
      from: mockFrom,
      rpc: mockRpc,
    },
  };
});

import { supabase } from '../lib/supabase';

describe('Kiểm thử Chọn Khách hàng, Chuyển Trạng thái & Phân công Cán bộ (CRM Selection & Assignment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Logic Tích chọn Khách hàng (Row Selection) hỗ trợ cả UUID và Numeric ID', () => {
    it('Chọn và bỏ chọn ID dạng UUID (String) không bị biến thành NaN', () => {
      let selectedIds: (number | string)[] = [];

      const handleSelectRow = (id: string | number) => {
        if (!id) return;
        selectedIds = selectedIds.some(item => String(item) === String(id))
          ? selectedIds.filter(item => String(item) !== String(id))
          : [...selectedIds, id];
      };

      const uuid1 = 'c3b28b78-757c-47bc-877f-1dcfda6ee58e';
      const uuid2 = '9a8b7c6d-5e4f-3a2b-1c0d-e9f8a7b6c5d4';

      // Chọn row 1
      handleSelectRow(uuid1);
      expect(selectedIds).toHaveLength(1);
      expect(selectedIds[0]).toBe(uuid1);
      expect(Number.isNaN(selectedIds[0])).toBe(false);

      // Chọn row 2
      handleSelectRow(uuid2);
      expect(selectedIds).toHaveLength(2);
      expect(selectedIds).toContain(uuid1);
      expect(selectedIds).toContain(uuid2);

      // Bỏ chọn row 1
      handleSelectRow(uuid1);
      expect(selectedIds).toHaveLength(1);
      expect(selectedIds).not.toContain(uuid1);
      expect(selectedIds).toContain(uuid2);
    });

    it('So khớp chính xác trạng thái checkbox của hàng bằng String comparison', () => {
      const selectedIds: (number | string)[] = ['c3b28b78-757c-47bc-877f-1dcfda6ee58e', 105];

      const rowUUID = { id: 'c3b28b78-757c-47bc-877f-1dcfda6ee58e', name: 'Lèo Thị Thư' };
      const rowNumber = { id: 105, name: 'Nguyễn Văn Bốn' };
      const rowUnselected = { id: 'other-uuid-1234', name: 'Lò Thị Thuận' };

      const isChecked = (r: { id: any }) => r.id ? selectedIds.some(sid => String(sid) === String(r.id)) : false;

      expect(isChecked(rowUUID)).toBe(true);
      expect(isChecked(rowNumber)).toBe(true);
      expect(isChecked(rowUnselected)).toBe(false);
    });
  });

  describe('2. Phân công cán bộ (assignStaffToCustomers & assignStaffToRecords)', () => {
    it('Phân công thành công khi danh sách khóa chứa UUID id của bảng customers', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'c3b28b78-757c-47bc-877f-1dcfda6ee58e' }],
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            update: mockUpdate,
            in: mockIn,
            select: mockSelect,
          };
        }
        return {};
      });

      const customerKeys = ['c3b28b78-757c-47bc-877f-1dcfda6ee58e'];
      const targetStaffId = 'staff_hoc1_01';

      const count = await customerService.assignStaffToCustomers(customerKeys, targetStaffId);

      expect(count).toBe(1);
      expect(supabase.from).toHaveBeenCalledWith('customers');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ staff_id: targetStaffId })
      );
      expect(mockIn).toHaveBeenCalledWith('id', ['c3b28b78-757c-47bc-877f-1dcfda6ee58e']);
    });

    it('Phân công thành công khi danh sách khóa chứa customer_key hoặc CCCD', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockIn = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'uuid-1' }, { id: 'uuid-2' }],
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            update: mockUpdate,
            in: mockIn,
            select: mockSelect,
          };
        }
        return {};
      });

      const customerKeys = ['c_014195011768', '014181005653'];
      const targetStaffId = 'staff_hoc1_01';

      const count = await customerService.assignStaffToCustomers(customerKeys, targetStaffId);

      expect(count).toBe(2);
      expect(mockIn).toHaveBeenCalledWith('customer_key', ['c_014195011768', '014181005653']);
    });
  });

  describe('3. Cập nhật trạng thái khách hàng (updateCustomerStatus)', () => {
    it('Cập nhật trạng thái trong bảng customers qua UUID mà không báo lỗi', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            update: mockUpdate,
            eq: mockEq,
          };
        }
        return {};
      });

      const res = await customerService.updateCustomerStatus(
        'c3b28b78-757c-47bc-877f-1dcfda6ee58e',
        'Đã dừng đóng'
      );

      expect(res.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Đã dừng đóng' })
      );
      expect(mockEq).toHaveBeenCalledWith('id', 'c3b28b78-757c-47bc-877f-1dcfda6ee58e');
    });

    it('Cập nhật trạng thái trong bảng customers qua customer_key hoặc CCCD', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockResolvedValue({ error: null });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            update: mockUpdate,
            or: mockOr,
          };
        }
        return {};
      });

      const res = await customerService.updateCustomerStatus(
        '014195011768',
        'Đã dừng đóng'
      );

      expect(res.success).toBe(true);
      expect(mockOr).toHaveBeenCalledWith(
        expect.stringContaining('014195011768')
      );
    });
  });
});
