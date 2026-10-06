import { describe, it, expect, vi, beforeEach } from 'vitest';
import { customerService } from '../services/customerService';
import { supabase } from '../lib/supabase';
import { sanitizeRolePermissions, sanitizeUserOverrides } from '../utils/permissions';
import { extractRolePermissionsFromPolicies, extractUserOverridesFromPolicies } from '../utils/settingsHelper';

describe('Supabase Master Persistence Suite: Hồ Sơ Tham Gia & Phân Quyền RBAC/User Overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Hồ Sơ Tham Gia (Customer Participation Profile) Persistence', () => {
    it('Lưu trữ hồ sơ tham gia qua RPC save_customer_participation thành công', async () => {
      const mockRpc = vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
        data: { success: true, customer_id: 'cust-123', message: 'Lưu thành công' },
        error: null
      } as any);

      const res = await customerService.updateCustomerParticipation('cust-123', {
        prior_periods: [
          { type: 'batbuoc', position: 'Kế toán', workplace: 'Công ty A', sm: 1, sy: 2018, em: 12, ey: 2020, months: 36, salary: 5000000 }
        ],
        prior_voluntary_months: 0,
        prior_compulsory_months: 36,
        prior_participation_notes: 'Đã đóng 36 tháng tại Công ty A'
      });

      expect(mockRpc).toHaveBeenCalledWith('save_customer_participation', expect.objectContaining({
        p_target_key: 'cust-123',
        p_prior_compulsory_months: 36,
        p_prior_voluntary_months: 0
      }));
      expect(res.success).toBe(true);
      expect(res.error).toBeNull();
    });

    it('Tự động fallback direct update bảng customers khi RPC chưa khởi tạo', async () => {
      // Giả lập RPC trả về lỗi hoặc không tồn tại
      vi.spyOn(supabase, 'rpc').mockRejectedValueOnce(new Error('function public.save_customer_participation does not exist'));

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        or: vi.fn().mockResolvedValue({ error: null })
      });

      vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'customers') {
          return {
            update: mockUpdate,
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                })
              })
            })
          } as any;
        }
        return {
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null })
        } as any;
      });

      const res = await customerService.updateCustomerParticipation('cust-456', {
        prior_periods: [],
        prior_voluntary_months: 12,
        prior_compulsory_months: 0,
        prior_participation_notes: 'Đóng tự nguyện ở đại lý cũ 12 tháng'
      });

      expect(res.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        prior_voluntary_months: 12,
        prior_compulsory_months: 0
      }));
    });
  });

  describe('2. Phân Quyền Vai Trò & Đặc Cách Nhân Viên Supabase Persistence', () => {
    it('Trích xuất phân quyền vai trò từ bảng policies chính xác', () => {
      const mockPolicies = [
        {
          id: 101,
          parameter_type: 'rbac_role_permissions',
          name: 'Bảng Phân Quyền Vai Trò RBAC',
          value: {
            'Nhân viên': ['customers.create', 'finance.view'],
            'Quản lý': ['customers.create', 'finance.view', 'reports.view_all'],
            'Admin': ['customers.create', 'system.settings', 'system.audit']
          },
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const extracted = extractRolePermissionsFromPolicies(mockPolicies as any);
      expect(extracted['Nhân viên']).toContain('customers.create');
      expect(extracted['Quản lý']).toContain('reports.view_all');
      expect(extracted['Admin']).toContain('system.audit');
    });

    it('Trích xuất phân quyền đặc cách nhân viên (User Overrides) từ bảng policies chính xác', () => {
      const mockPolicies = [
        {
          id: 102,
          parameter_type: 'rbac_user_overrides',
          name: 'Phân Quyền Đặc Cách Riêng Theo Nhân Viên',
          value: {
            'staff-sung': {
              staffId: 'staff-sung',
              granted: ['reports.export_excel', 'finance.collect'],
              revoked: ['customers.delete']
            }
          },
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const overrides = extractUserOverridesFromPolicies(mockPolicies as any);
      expect(overrides['staff-sung']).toBeDefined();
      expect(overrides['staff-sung']!.granted).toContain('reports.export_excel');
      expect(overrides['staff-sung']!.granted).toContain('finance.collect');
      expect(overrides['staff-sung']!.revoked).toContain('customers.delete');
    });

    it('Đảm bảo sanitizeUserOverrides và sanitizeRolePermissions bảo vệ dữ liệu sạch trước khi ghi vào Supabase', () => {
      const rawOverrides = {
        'staff-01': {
          staffId: 'staff-01',
          granted: ['customers.create', 'invalid_permission', 'finance.view'],
          revoked: ['customers.delete', '']
        }
      };

      const cleaned = sanitizeUserOverrides(rawOverrides);
      expect(cleaned['staff-01']!.granted).toContain('customers.create');
      expect(cleaned['staff-01']!.granted).toContain('finance.view');
      expect(cleaned['staff-01']!.granted).not.toContain('invalid_permission');
      expect(cleaned['staff-01']!.revoked).toEqual(['customers.delete']);

      const rawRoles = {
        'Nhân viên': ['customers.create', 'finance.view', 'xyz_bad_perm']
      };
      const cleanedRoles = sanitizeRolePermissions(rawRoles);
      expect(cleanedRoles['Nhân viên']!).toContain('customers.create');
      expect(cleanedRoles['Nhân viên']!).toContain('finance.view');
      expect(cleanedRoles['Nhân viên']!).not.toContain('xyz_bad_perm');
    });
  });
});
