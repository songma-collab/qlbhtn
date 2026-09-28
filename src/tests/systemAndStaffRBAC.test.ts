import { describe, it, expect } from 'vitest';
import { 
  validateStaffInput, 
  checkZeroAdminRisk, 
  checkStaffDeleteSafety, 
  checkStaffUpdatePermission,
  checkPolicyMutationPermission,
  sanitizeInput
} from '../utils/security';
import { getPolicyValueForDate, getCommissionRateForRecord } from '../utils/calculations';
import { isDateLocked } from '../utils/helpers';
import type { Policy, RecordType } from '../context/types';

describe('BỘ KIỂM THỬ PHÂN QUYỀN HỆ THỐNG & CHÍNH SÁCH ĐA KỲ (SYSTEM & STAFF RBAC TEST SUITE)', () => {

  // ============================================================================
  // PHẦN 1: MA TRẬN PHÂN QUYỀN VÀ BẢO VỆ NHÂN SỰ (STAFF RBAC & SAFETY GUARDS)
  // ============================================================================
  describe('1. Thẩm tra Tính hợp lệ Dữ liệu Nhân sự (Staff Input Validation)', () => {
    it('Chấp nhận dữ liệu nhân sự chuẩn mực (CCCD 12 số, SĐT 10 số đầu 0, email chuẩn)', () => {
      const validStaff = {
        staffCode: 'NV001',
        name: 'Nguyễn Văn An',
        cccd: '001200001234',
        phone: '0912345678',
        email: 'an.nguyen@vss.gov.vn',
        role: 'Nhân viên'
      };
      const res = validateStaffInput(validStaff);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('Chấp nhận CMND cũ 9 số hợp lệ', () => {
      const validStaff9 = {
        staffCode: 'NV002',
        name: 'Trần Thị Bình',
        cccd: '012345678',
        phone: '0987654321',
        email: 'binh.tran@vss.gov.vn'
      };
      const res = validateStaffInput(validStaff9);
      expect(res.valid).toBe(true);
    });

    it('Từ chối CCCD sai độ dài (10 số hoặc 11 số)', () => {
      const invalidCCCD = {
        staffCode: 'NV003',
        name: 'Lê Văn Cường',
        cccd: '00123456789', // 11 số
        phone: '0912345678',
        email: 'cuong.le@vss.gov.vn'
      };
      const res = validateStaffInput(invalidCCCD);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('CCCD/CMND'))).toBe(true);
    });

    it('Từ chối Số điện thoại không bắt đầu bằng số 0 hoặc không đủ 10 chữ số', () => {
      const invalidPhone = {
        staffCode: 'NV004',
        name: 'Hoàng Văn Dũng',
        phone: '84912345678', // 11 số, bắt đầu 84
        email: 'dung.hoang@vss.gov.vn'
      };
      const res = validateStaffInput(invalidPhone);
      expect(res.valid).toBe(false);
      expect(res.errors.some(e => e.includes('Số điện thoại'))).toBe(true);
    });

    it('Từ chối email sai cú pháp và mã nhân viên rỗng', () => {
      const invalidEmail = {
        staffCode: '',
        name: 'Phạm Thị Em',
        phone: '0901234567',
        email: 'not-an-email'
      };
      const res = validateStaffInput(invalidEmail);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('2. Thẩm định Quyền Hạn CRUD Nhân Sự Theo 3 Vai Trò (Admin vs Quản lý vs Nhân viên)', () => {
    const adminUser = { id: 'admin_01', role: 'Admin', status: 'Hoạt động' };
    const managerUser = { id: 'mgr_01', role: 'Quản lý', status: 'Hoạt động' };
    const staffUser = { id: 'staff_01', role: 'Nhân viên', status: 'Hoạt động' };
    const lockedStaffUser = { id: 'staff_02', role: 'Nhân viên', status: 'Tạm khóa' };

    it('Admin có toàn quyền sửa thông tin của bất kỳ nhân sự nào', () => {
      const perm = checkStaffUpdatePermission(adminUser, staffUser, { role: 'Quản lý', status: 'Tạm khóa' });
      expect(perm.allowed).toBe(true);
    });

    it('Quản lý (Manager) bị CHẶN quyền sửa thông tin hoặc vai trò của tài khoản Admin', () => {
      const perm = checkStaffUpdatePermission(managerUser, adminUser, { name: 'Admin Đã Đổi Tên' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('Quản lý không có quyền');
    });

    it('Quản lý (Manager) bị CHẶN quyền tự thăng cấp tài khoản khác lên Admin', () => {
      const perm = checkStaffUpdatePermission(managerUser, staffUser, { role: 'Admin' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('thăng cấp');
    });

    it('Quản lý (Manager) được phép cập nhật thông tin nghiệp vụ của Nhân viên cấp dưới', () => {
      const perm = checkStaffUpdatePermission(managerUser, staffUser, { area: 'Xã Chiềng Khoi', phone: '0912349999' });
      expect(perm.allowed).toBe(true);
    });

    it('Nhân viên thông thường tự sửa SĐT và địa chỉ của chính mình: HỢP LỆ', () => {
      const perm = checkStaffUpdatePermission(staffUser, staffUser, { phone: '0988888888', area: 'Bản Nà Lốc' });
      expect(perm.allowed).toBe(true);
    });

    it('Nhân viên tự đổi Role của mình sang Admin: BỊ CHẶN NGAY LẬP TỨC', () => {
      const perm = checkStaffUpdatePermission(staffUser, staffUser, { role: 'Admin' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('không có quyền tự thay đổi vai trò');
    });

    it('Nhân viên tự đổi trạng thái tài khoản của mình: BỊ CHẶN', () => {
      const perm = checkStaffUpdatePermission(staffUser, staffUser, { status: 'Hoạt động' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('không có quyền tự kích hoạt hoặc đổi trạng thái');
    });

    it('Nhân viên cố gắng sửa thông tin của đồng nghiệp khác: BỊ CHẶN', () => {
      const perm = checkStaffUpdatePermission(staffUser, { id: 'staff_99', role: 'Nhân viên' }, { phone: '0999999999' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('chỉ có thể cập nhật hồ sơ cá nhân của chính mình');
    });

    it('Tài khoản đang bị "Tạm khóa" bị từ chối mọi thao tác', () => {
      const perm = checkStaffUpdatePermission(lockedStaffUser, lockedStaffUser, { phone: '0900000000' });
      expect(perm.allowed).toBe(false);
      expect(perm.reason).toContain('đã bị tạm khóa');
    });
  });

  describe('3. Phòng Vệ Mất Dấu Vết Dữ Liệu & Khóa Hệ Thống (Zero-Admin & Orphan Records Guard)', () => {
    const activeAdmin1 = { id: 'admin_1', role: 'Admin', status: 'Hoạt động' };
    const activeAdmin2 = { id: 'admin_2', role: 'Admin', status: 'Hoạt động' };
    const staffMember = { id: 'staff_1', name: 'Nguyễn Văn Thu', role: 'Nhân viên', status: 'Hoạt động' };

    it('Zero-Admin Lockout: Chặn hạ quyền Admin duy nhất còn lại trong hệ thống', () => {
      const singleAdminList = [activeAdmin1, staffMember];
      const riskCheck = checkZeroAdminRisk(singleAdminList, 'admin_1', 'Nhân viên');
      expect(riskCheck.isRisk).toBe(true);
      expect(riskCheck.reason).toContain('Zero-Admin Lockout');
    });

    it('Zero-Admin Lockout: Chặn khóa tài khoản Admin duy nhất còn lại trong hệ thống', () => {
      const singleAdminList = [activeAdmin1, staffMember];
      const riskCheck = checkZeroAdminRisk(singleAdminList, 'admin_1', undefined, 'Tạm khóa');
      expect(riskCheck.isRisk).toBe(true);
    });

    it('Zero-Admin Lockout: Cho phép đổi quyền Admin nếu hệ thống còn Admin hoạt động khác', () => {
      const multiAdminList = [activeAdmin1, activeAdmin2, staffMember];
      const riskCheck = checkZeroAdminRisk(multiAdminList, 'admin_1', 'Nhân viên');
      expect(riskCheck.isRisk).toBe(false);
    });

    it('Orphan Records Guard: Chặn Hard Delete nhân viên khi đã phụ trách 150 hồ sơ thu tiền', () => {
      const safety = checkStaffDeleteSafety(activeAdmin1, staffMember, [activeAdmin1, staffMember], 150);
      expect(safety.allowed).toBe(false);
      expect(safety.suggestedAction).toBe('SOFT_DELETE');
      expect(safety.reason).toContain('Nghiêm cấm xóa vĩnh viễn');
    });

    it('Cho phép Hard Delete nhân sự mới tạo thử nghiệm chưa từng phát sinh hồ sơ (0 records)', () => {
      const safety = checkStaffDeleteSafety(activeAdmin1, staffMember, [activeAdmin1, staffMember], 0);
      expect(safety.allowed).toBe(true);
    });

    it('Chặn người dùng Quản lý hoặc Nhân viên gọi lệnh xóa nhân sự', () => {
      const manager = { id: 'mgr_1', role: 'Quản lý' };
      const safety = checkStaffDeleteSafety(manager, staffMember, [activeAdmin1, staffMember], 0);
      expect(safety.allowed).toBe(false);
      expect(safety.reason).toContain('Chỉ tài khoản Quản trị viên (Admin)');
    });
  });

  // ============================================================================
  // PHẦN 2: LUỒNG BAN HÀNH CHÍNH SÁCH THEO THỜI GIAN HIỆU LỰC (POINT-IN-TIME POLICY)
  // ============================================================================
  describe('4. Điểm cắt Thời gian Hiệu lực Chính sách Lương cơ sở & Chuẩn nghèo', () => {
    const mockPolicies: Policy[] = [
      {
        id: 1,
        parameter_type: 'base_salary',
        name: 'Lương cơ sở NĐ 24/2023',
        value: 1800000,
        effective_date: '2023-07-01',
        is_active: false
      },
      {
        id: 2,
        parameter_type: 'base_salary',
        name: 'Lương cơ sở NĐ 73/2024',
        value: 2340000,
        effective_date: '2024-07-01',
        is_active: false
      },
      {
        id: 3,
        parameter_type: 'base_salary',
        name: 'Lương cơ sở NĐ 161/2026',
        value: 2530000,
        effective_date: '2026-07-01',
        is_active: true
      },
      {
        id: 4,
        parameter_type: 'poverty_standard',
        name: 'Chuẩn nghèo nông thôn NĐ 07/2021',
        value: 1500000,
        effective_date: '2022-01-01',
        is_active: true
      }
    ];

    it('Hồ sơ lập ngày 15/06/2026 (trước 01/07/2026) phải áp dụng mức lương 2.340.000đ', () => {
      const salary = getPolicyValueForDate(mockPolicies, 'base_salary', '2026-06-15', 2340000);
      expect(salary).toBe(2340000);
    });

    it('Hồ sơ lập ngày 01/07/2026 đúng ngày hiệu lực phải áp dụng mức lương mới 2.530.000đ', () => {
      const salary = getPolicyValueForDate(mockPolicies, 'base_salary', '2026-07-01', 2340000);
      expect(salary).toBe(2530000);
    });

    it('Hồ sơ lập ngày 20/08/2026 sau ngày hiệu lực phải áp dụng mức lương mới 2.530.000đ', () => {
      const salary = getPolicyValueForDate(mockPolicies, 'base_salary', '2026-08-20', 2340000);
      expect(salary).toBe(2530000);
    });

    it('Hồ sơ quá khứ ngày 10/10/2023 phải bảo lưu mức lương 1.800.000đ (Không bị sửa lệch)', () => {
      const salary = getPolicyValueForDate(mockPolicies, 'base_salary', '2023-10-10', 2340000);
      expect(salary).toBe(1800000);
    });

    it('Chuẩn nghèo nông thôn luôn trả về 1.500.000đ cho các giao dịch từ năm 2022 trở đi', () => {
      const poverty = getPolicyValueForDate(mockPolicies, 'poverty_standard', '2026-08-15', 1500000);
      expect(poverty).toBe(1500000);
    });
  });

  describe('5. Luồng Áp Dụng Tỷ Lệ Hoa Hồng Đại Lý Theo Ngày Hiệu Lực', () => {
    const commissionPolicies: Policy[] = [
      {
        id: 10,
        parameter_type: 'commission',
        name: 'Hoa hồng QĐ 11 Cũ',
        value: {
          commBHXHNew: 5,
          commBHXHRenew: 3,
          commBHYTNew: 5,
          commBHYTRenew: 3
        },
        effective_date: '2024-01-01',
        is_active: false
      },
      {
        id: 11,
        parameter_type: 'commission',
        name: 'Hoa hồng Cơ chế Mới 2026',
        value: {
          commBHXHNew: 15,
          commBHXHRenew: 9,
          commBHYTNew: 9,
          commBHYTRenew: 5
        },
        effective_date: '2026-08-01',
        is_active: true
      }
    ];

    it('Hồ sơ BHXH Đăng ký mới ngày 15/07/2026 (trước 01/08/2026) hưởng hoa hồng 5%', () => {
      const record: Partial<RecordType> = {
        date: '2026-07-15',
        type: 'BHXH',
        actionType: 'Đăng ký mới'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBe(0.05); // 5%
    });

    it('Hồ sơ BHXH Đăng ký mới ngày 10/08/2026 (sau 01/08/2026) hưởng hoa hồng mới 15%', () => {
      const record: Partial<RecordType> = {
        date: '2026-08-10',
        type: 'BHXH',
        actionType: 'Đăng ký mới'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBe(0.15); // 15%
    });

    it('Hồ sơ BHXH Tái tục/Gia hạn ngày 10/08/2026 hưởng hoa hồng tái tục mới 9%', () => {
      const record: Partial<RecordType> = {
        date: '2026-08-10',
        type: 'BHXH',
        actionType: 'Gia hạn định kỳ'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBe(0.09); // 9%
    });

    it('Hồ sơ BHYT Đăng ký mới ngày 10/08/2026 hưởng hoa hồng BHYT mới 9%', () => {
      const record: Partial<RecordType> = {
        date: '2026-08-10',
        type: 'BHYT',
        actionType: 'Đăng ký mới'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBe(0.09); // 9%
    });

    it('Hồ sơ BHYT Tái tục ngày 10/08/2026 hưởng hoa hồng BHYT tái tục mới 5%', () => {
      const record: Partial<RecordType> = {
        date: '2026-08-10',
        type: 'BHYT',
        actionType: 'Tái tục thẻ'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBe(0.05); // 5%
    });

    it('Xử lý an toàn khi ngày hồ sơ rỗng/NULL: Tự động fallback về ngày hiện tại', () => {
      const record: Partial<RecordType> = {
        date: undefined,
        type: 'BHXH',
        actionType: 'Đăng ký mới'
      };
      const rate = getCommissionRateForRecord(record, commissionPolicies, null);
      expect(rate).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // PHẦN 3: KHÓA KỲ TÀI CHÍNH ĐỘNG & BẢO VỆ BẤT BIẾN NHẬT KÝ KIỂM TOÁN
  // ============================================================================
  describe('6. Kiểm Thử Khóa Kỳ Tài Chính Động (Financial Period Lock)', () => {
    const lockedKeys = ['month_07/2026', 'month_08/2026', 'quarter_2_2026'];

    it('Xác định chính xác ngày trong tháng đã khóa: 15/07/2026 -> ĐÃ KHÓA', () => {
      expect(isDateLocked('2026-07-15', lockedKeys)).toBe(true);
    });

    it('Xác định chính xác ngày trong tháng đã khóa: 31/08/2026 -> ĐÃ KHÓA', () => {
      expect(isDateLocked('2026-08-31', lockedKeys)).toBe(true);
    });

    it('Xác định chính xác ngày trong tháng mở: 05/09/2026 -> ĐANG MỞ (Không bị khóa)', () => {
      expect(isDateLocked('2026-09-05', lockedKeys)).toBe(false);
    });
  });

  describe('7. Thẩm tra Phân quyền Ban hành Chính sách & Vệ sinh Dữ liệu XSS', () => {
    it('Chỉ Quản trị viên (Admin) mới có quyền ban hành chính sách mới', () => {
      expect(checkPolicyMutationPermission({ role: 'Admin' }).allowed).toBe(true);
      expect(checkPolicyMutationPermission({ role: 'Quản lý' }).allowed).toBe(false);
      expect(checkPolicyMutationPermission({ role: 'Nhân viên' }).allowed).toBe(false);
      expect(checkPolicyMutationPermission(null).allowed).toBe(false);
    });

    it('Vệ sinh XSS đầu vào: Loại bỏ script injection trong cài đặt trang chủ', () => {
      const dirtyTagline = 'Hệ Thống <script>alert("XSS")</script> Chuẩn NĐ 159';
      const clean = sanitizeInput(dirtyTagline);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('alert("XSS")');
      expect(clean).toBe('Hệ Thống  Chuẩn NĐ 159');
    });

    it('Vệ sinh XSS: Loại bỏ iframe và javascript: protocol', () => {
      const malicious = '<iframe src="evil.com"></iframe>javascript:malicious()';
      const clean = sanitizeInput(malicious);
      expect(clean).toBe('malicious()');
    });
  });
});
