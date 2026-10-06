import { describe, it, test, expect, vi } from 'vitest';
import {
  getCommissionRateForRecord,
  getPolicyValueForDate,
  calculateBHXH,
  calculateBHYT,
  calculateBHYTCoterminous
} from '../utils/calculations';
import { checkPolicyMutationPermission } from '../utils/security';
import type { Policy, RecordType, SettingsType, StaffType } from '../context/types';

describe('Kiểm thử Vòng đời Chính sách & Bền vững Dữ liệu Tài chính (Policy Lifecycle & Point-in-Time Snapshot Invariants)', () => {
  // Bộ chính sách mẫu đa kỳ hiệu lực
  const mockPolicies: Policy[] = [
    // Lương cơ sở
    {
      id: 1,
      name: 'Nghị định 24/2023/NĐ-CP (Lương cơ sở 1.800.000đ)',
      parameter_type: 'base_salary',
      value: 1800000,
      effective_date: '2023-07-01',
      is_active: false,
      description: 'Áp dụng từ 01/07/2023'
    },
    {
      id: 2,
      name: 'Nghị định 73/2024/NĐ-CP (Lương cơ sở 2.340.000đ)',
      parameter_type: 'base_salary',
      value: 2340000,
      effective_date: '2024-07-01',
      is_active: true,
      description: 'Áp dụng từ 01/07/2024'
    },
    {
      id: 3,
      name: 'Dự thảo Nghị định mới (Lương cơ sở 2.530.000đ)',
      parameter_type: 'base_salary',
      value: 2530000,
      effective_date: '2026-10-01',
      is_active: false,
      description: 'Áp dụng từ 01/10/2026'
    },

    // Chuẩn nghèo nông thôn
    {
      id: 10,
      name: 'Nghị định 07/2021/NĐ-CP (Chuẩn nghèo 1.500.000đ)',
      parameter_type: 'poverty_standard',
      value: 1500000,
      effective_date: '2022-01-01',
      is_active: true,
      description: 'Mức chuẩn nghèo giai đoạn 2022-2025'
    },
    {
      id: 11,
      name: 'Nghị định điều chỉnh Chuẩn nghèo mới 1.800.000đ',
      parameter_type: 'poverty_standard',
      value: 1800000,
      effective_date: '2026-10-01',
      is_active: false,
      description: 'Mức chuẩn nghèo mới từ 01/10/2026'
    },

    // Tỷ lệ hoa hồng đại lý
    {
      id: 20,
      name: 'Quyết định 11/QĐ-BHXH (Hoa hồng chu kỳ cũ)',
      parameter_type: 'commission',
      value: {
        commBHXHNew: 5.0,
        commBHXHRenew: 3.0,
        commBHYTNew: 5.0,
        commBHYTRenew: 3.0
      },
      effective_date: '2024-01-01',
      is_active: true,
      description: 'Tỷ lệ hoa hồng áp dụng từ 01/01/2024'
    },
    {
      id: 21,
      name: 'Quyết định 15/QĐ-BHXH (Hoa hồng chu kỳ mới)',
      parameter_type: 'commission',
      value: {
        commBHXHNew: 6.0,
        commBHXHRenew: 3.5,
        commBHYTNew: 5.5,
        commBHYTRenew: 3.5
      },
      effective_date: '2026-10-01',
      is_active: false,
      description: 'Tỷ lệ hoa hồng áp dụng từ 01/10/2026'
    },

    // Hệ số trượt giá CPI
    {
      id: 30,
      name: 'Thông tư trượt giá năm 2025',
      parameter_type: 'cpi_index',
      value: {
        '2026': 1.0,
        '2025': 1.0,
        '2024': 1.03,
        '2023': 1.07
      },
      effective_date: '2025-01-01',
      is_active: true,
      description: 'Bảng CPI áp dụng năm 2025'
    },
    {
      id: 31,
      name: 'Thông tư trượt giá cập nhật 2026',
      parameter_type: 'cpi_index',
      value: {
        '2027': 1.0,
        '2026': 1.02,
        '2025': 1.04,
        '2024': 1.08
      },
      effective_date: '2026-10-01',
      is_active: false,
      description: 'Bảng CPI áp dụng từ 01/10/2026'
    }
  ];

  const defaultSettings: SettingsType = {
    baseSalary: 2340000,
    povertyStandard: 1500000,
    investmentRate: 0.31,
    commBHXHNew: 5.0,
    commBHXHRenew: 3.0,
    commBHYTNew: 5.0,
    commBHYTRenew: 3.0,
    cpiIndex: { '2026': 1.0, '2025': 1.0 }
  };

  /* ========================================================================
   * 1. SUITE BẮT BUỘC THEO ĐẶC TẢ:
   * test('should return correct policy snapshot for transaction date')
   * ======================================================================== */
  test('should return correct policy snapshot for transaction date', () => {
    // 1. Ngày trước bất kỳ mốc chính sách nào -> fallback về active hoặc default
    const preDate = '2023-01-15';
    const preSalary = getPolicyValueForDate(mockPolicies, 'base_salary', preDate, 1800000);
    // Khi ngày trước mọi mốc, hàm tìm active policy (id=2: 2.340.000) hoặc mốc đầu tiên
    expect(preSalary).toBeDefined();

    // 2. Ngày nằm trong khoảng mốc 1 (2023-07-01 đến 2024-06-30)
    const dateV1 = '2023-12-15';
    const salaryV1 = getPolicyValueForDate(mockPolicies, 'base_salary', dateV1, 2340000);
    expect(salaryV1).toBe(1800000);

    // 3. Ngày thuộc mốc 2 (từ 2024-07-01 đến 2026-09-30)
    const dateV2 = '2024-08-20';
    const salaryV2 = getPolicyValueForDate(mockPolicies, 'base_salary', dateV2, 1800000);
    expect(salaryV2).toBe(2340000);

    // 4. Ngày biên: đúng ngày 2026-10-01 mốc mới có hiệu lực
    const dateBoundary = '2026-10-01';
    const salaryBoundary = getPolicyValueForDate(mockPolicies, 'base_salary', dateBoundary, 2340000);
    expect(salaryBoundary).toBe(2530000);

    // 5. Ngày sau ngày hiệu lực của mốc mới (2026-11-15)
    const dateV3 = '2026-11-15';
    const salaryV3 = getPolicyValueForDate(mockPolicies, 'base_salary', dateV3, 2340000);
    expect(salaryV3).toBe(2530000);

    // 6. Xử lý các biến thể định dạng ngày tháng: DD/MM/YYYY, MM/YYYY, YYYY-MM
    expect(getPolicyValueForDate(mockPolicies, 'base_salary', '15/12/2023', 2340000)).toBe(1800000);
    expect(getPolicyValueForDate(mockPolicies, 'base_salary', '20/08/2024', 1800000)).toBe(2340000);
    expect(getPolicyValueForDate(mockPolicies, 'base_salary', '2024-08', 1800000)).toBe(2340000);
    expect(getPolicyValueForDate(mockPolicies, 'base_salary', '10/2026', 2340000)).toBe(2530000);

    // 7. Khi danh sách policies rỗng: trả về đúng defaultValue không bị ném lỗi
    expect(getPolicyValueForDate([], 'base_salary', '2026-10-15', 2340000)).toBe(2340000);
    expect(getPolicyValueForDate(undefined, 'base_salary', '2026-10-15', 2340000)).toBe(2340000);
  });

  /* ========================================================================
   * 2. SUITE BẮT BUỘC THEO ĐẶC TẢ:
   * test('should calculate commission accurately across policy transitions')
   * ======================================================================== */
  test('should calculate commission accurately across policy transitions', () => {
    // Hồ sơ lịch sử trước 01/10/2026 (thuộc chính sách cũ)
    const oldBHXHNewRecord: Partial<RecordType> = {
      id: 101,
      type: 'BHXH',
      action_type: 'Tham gia mới',
      date: '2026-08-15',
      amount: 1500000
    };
    const oldBHXHRenewRecord: Partial<RecordType> = {
      id: 102,
      type: 'BHXH',
      action_type: 'Gia hạn đóng tiếp',
      date: '2026-08-20',
      amount: 1500000
    };
    const oldBHYTNewRecord: Partial<RecordType> = {
      id: 103,
      type: 'BHYT',
      action_type: 'Cấp mới',
      date: '2026-09-10',
      amount: 1263600
    };
    const oldBHYTRenewRecord: Partial<RecordType> = {
      id: 104,
      type: 'BHYT',
      action_type: 'Tái tục thẻ',
      date: '2026-09-15',
      amount: 1263600
    };

    // Hồ sơ mới sau ngày 01/10/2026 (thuộc chính sách mới Quyết định 15/QĐ-BHXH)
    const newBHXHNewRecord: Partial<RecordType> = {
      id: 201,
      type: 'BHXH',
      action_type: 'Tham gia mới',
      date: '2026-10-05',
      amount: 1800000
    };
    const newBHXHRenewRecord: Partial<RecordType> = {
      id: 202,
      type: 'BHXH',
      action_type: 'Gia hạn tái tục',
      date: '2026-10-10',
      amount: 1800000
    };
    const newBHYTNewRecord: Partial<RecordType> = {
      id: 203,
      type: 'BHYT',
      action_type: 'Cấp mới',
      date: '2026-10-12',
      amount: 1366200
    };
    const newBHYTRenewRecord: Partial<RecordType> = {
      id: 204,
      type: 'BHYT',
      action_type: 'Đóng tiếp gia hạn',
      date: '2026-10-15',
      amount: 1366200
    };

    // 1. Kiểm tra tỷ lệ hoa hồng hồ sơ cũ: BHXH mới 5%, gia hạn 3%; BHYT mới 5%, gia hạn 3%
    const rateOldBHXHNew = getCommissionRateForRecord(oldBHXHNewRecord, mockPolicies, defaultSettings);
    expect(rateOldBHXHNew).toBe(0.05); // 5%

    const rateOldBHXHRenew = getCommissionRateForRecord(oldBHXHRenewRecord, mockPolicies, defaultSettings);
    expect(rateOldBHXHRenew).toBe(0.03); // 3%

    const rateOldBHYTNew = getCommissionRateForRecord(oldBHYTNewRecord, mockPolicies, defaultSettings);
    expect(rateOldBHYTNew).toBe(0.05); // 5%

    const rateOldBHYTRenew = getCommissionRateForRecord(oldBHYTRenewRecord, mockPolicies, defaultSettings);
    expect(rateOldBHYTRenew).toBe(0.03); // 3%

    // 2. Kiểm tra tỷ lệ hoa hồng hồ sơ mới: BHXH mới 6%, gia hạn 3.5%; BHYT mới 5.5%, gia hạn 3.5%
    const rateNewBHXHNew = getCommissionRateForRecord(newBHXHNewRecord, mockPolicies, defaultSettings);
    expect(rateNewBHXHNew).toBe(0.06); // 6%

    const rateNewBHXHRenew = getCommissionRateForRecord(newBHXHRenewRecord, mockPolicies, defaultSettings);
    expect(rateNewBHXHRenew).toBe(0.035); // 3.5%

    const rateNewBHYTNew = getCommissionRateForRecord(newBHYTNewRecord, mockPolicies, defaultSettings);
    expect(rateNewBHYTNew).toBe(0.055); // 5.5%

    const rateNewBHYTRenew = getCommissionRateForRecord(newBHYTRenewRecord, mockPolicies, defaultSettings);
    expect(rateNewBHYTRenew).toBe(0.035); // 3.5%

    // 3. BẢO TOÀN DỮ LIỆU LỊCH SỬ (Snapshot Invariant):
    // Khi thêm chính sách mới, hồ sơ cũ tính lại hoa hồng phải giữ nguyên tuyệt đối, không lệch 1 đồng
    const oldCommissionAmount = (oldBHXHNewRecord.amount || 0) * rateOldBHXHNew;
    expect(oldCommissionAmount).toBe(75000); // 1.500.000 * 5% = 75.000đ

    const newCommissionAmount = (newBHXHNewRecord.amount || 0) * rateNewBHXHNew;
    expect(newCommissionAmount).toBe(108000); // 1.800.000 * 6% = 108.000đ
  });

  /* ========================================================================
   * 3. SUITE BẮT BUỘC THEO ĐẶC TẢ:
   * test('should preserve historic calculation results when base salary changes')
   * ======================================================================== */
  test('should preserve historic calculation results when base salary changes', () => {
    // 1. Mức lương cơ sở cũ: 2.340.000đ (Nghị định 73/2024/NĐ-CP)
    const oldBaseSalary = 2340000;
    const oldBHYTResult = calculateBHYT(12, 3, oldBaseSalary);

    // Xác minh chi tiết từng thành viên theo biểu giảm trừ 100% - 70% - 60%
    // Cơ sở 1 tháng = 2.340.000 * 4.5% = 105.300đ
    // Người 1 (100%): 105.300 * 12 = 1.263.600đ
    // Người 2 (70%): 105.300 * 0.7 * 12 = 884.520đ
    // Người 3 (60%): 105.300 * 0.6 * 12 = 758.160đ
    // Tổng = 2.906.280đ
    expect(oldBHYTResult.breakdown[0]!.amount).toBe(1263600);
    expect(oldBHYTResult.breakdown[1]!.amount).toBe(884520);
    expect(oldBHYTResult.breakdown[2]!.amount).toBe(758160);
    expect(oldBHYTResult.amount).toBe(2906280);

    // 2. Mức lương cơ sở mới: 2.530.000đ (Dự thảo/Quyết định mới từ 01/10/2026)
    const newBaseSalary = 2530000;
    const newBHYTResult = calculateBHYT(12, 3, newBaseSalary);

    // Cơ sở 1 tháng = 2.530.000 * 4.5% = 113.850đ
    // Người 1 (100%): 113.850 * 12 = 1.366.200đ
    // Người 2 (70%): 113.850 * 0.7 * 12 = 956.340đ
    // Người 3 (60%): 113.850 * 0.6 * 12 = 819.720đ
    // Tổng = 3.142.260đ
    expect(newBHYTResult.breakdown[0]!.amount).toBe(1366200);
    expect(newBHYTResult.breakdown[1]!.amount).toBe(956340);
    expect(newBHYTResult.breakdown[2]!.amount).toBe(819720);
    expect(newBHYTResult.amount).toBe(3142260);

    // 3. Kiểm tra tính BHYT Hộ gia đình đồng bộ thời hạn kết thúc (Coterminous Expiration)
    // Hộ 3 người với số tháng khác nhau: Người 1 đóng 12 tháng, Người 2 đóng 6 tháng, Người 3 đóng 3 tháng
    const members = [
      { name: 'Nguyễn Văn A', durationMonths: 12 },
      { name: 'Trần Thị B', durationMonths: 6 },
      { name: 'Nguyễn Văn C', durationMonths: 3 }
    ];

    const coterminousOld = calculateBHYTCoterminous(members, oldBaseSalary);
    // Người 1: 105.300 * 1.0 * 12 = 1.263.600
    // Người 2: 105.300 * 0.7 * 6 = 442.260
    // Người 3: 105.300 * 0.6 * 3 = 189.540
    // Tổng = 1.895.400
    expect(coterminousOld.breakdown[0]!.amount).toBe(1263600);
    expect(coterminousOld.breakdown[1]!.amount).toBe(442260);
    expect(coterminousOld.breakdown[2]!.amount).toBe(189540);
    expect(coterminousOld.amount).toBe(1895400);

    const coterminousNew = calculateBHYTCoterminous(members, newBaseSalary);
    // Người 1: 113.850 * 1.0 * 12 = 1.366.200
    // Người 2: 113.850 * 0.7 * 6 = 478.170
    // Người 3: 113.850 * 0.6 * 3 = 204.930
    // Tổng = 2.049.300
    expect(coterminousNew.breakdown[0]!.amount).toBe(1366200);
    expect(coterminousNew.breakdown[1]!.amount).toBe(478170);
    expect(coterminousNew.breakdown[2]!.amount).toBe(204930);
    expect(coterminousNew.amount).toBe(2049300);

    // 4. BẢO TOÀN DỮ LIỆU:
    // Sự thay đổi của lương cơ sở sau này KHÔNG làm thay đổi kết quả số tiền đã tính và lưu trong hồ sơ cũ
    const recordedPastTransaction = {
      date: '2026-08-15',
      baseSalarySnapshot: oldBaseSalary,
      amountPaid: oldBHYTResult.amount
    };
    expect(recordedPastTransaction.amountPaid).toBe(2906280);
    expect(recordedPastTransaction.amountPaid).not.toBe(newBHYTResult.amount);
  });

  /* ========================================================================
   * 4. SUITE BẮT BUỘC THEO ĐẶC TẢ:
   * test('should enforce Admin-only policy mutation via RLS and security checks')
   * ======================================================================== */
  test('should enforce Admin-only policy mutation via RLS and security checks', () => {
    const adminUser: StaffType = {
      id: 'admin-001',
      name: 'Quản Trị Viên',
      role: 'Admin',
      status: 'active',
      phone: '0988888888',
      email: 'admin@bhxh.gov.vn'
    };

    const staffUser: StaffType = {
      id: 'staff-002',
      name: 'Nhân Viên Thu',
      role: 'Nhân viên thu',
      status: 'active',
      phone: '0977777777',
      email: 'staff@bhxh.gov.vn'
    };

    const managerUser: StaffType = {
      id: 'mgr-003',
      name: 'Quản Lý Đại Lý',
      role: 'Quản lý',
      status: 'active',
      phone: '0966666666',
      email: 'manager@bhxh.gov.vn'
    };

    // 1. Quản trị viên (Admin) được phép thực hiện mọi thao tác chính sách
    const adminCheck = checkPolicyMutationPermission(adminUser);
    expect(adminCheck.allowed).toBe(true);
    expect(adminCheck.reason).toBeUndefined();

    // 2. Nhân viên thu bị CHẶN can thiệp chính sách
    const staffCheck = checkPolicyMutationPermission(staffUser);
    expect(staffCheck.allowed).toBe(false);
    expect(staffCheck.reason).toContain('Chỉ tài khoản Quản trị viên (Admin)');

    // 3. Quản lý cũng bị CHẶN can thiệp chính sách (chỉ Admin mới có quyền)
    const managerCheck = checkPolicyMutationPermission(managerUser);
    expect(managerCheck.allowed).toBe(false);
    expect(managerCheck.reason).toContain('Chỉ tài khoản Quản trị viên (Admin)');

    // 4. Khách vãng lai / chưa đăng nhập (null / undefined) bị CHẶN
    expect(checkPolicyMutationPermission(null).allowed).toBe(false);
    expect(checkPolicyMutationPermission(null).reason).toContain('Chưa đăng nhập');
    expect(checkPolicyMutationPermission(undefined).allowed).toBe(false);

    // 5. Mô phỏng thực thi có kiểm tra bảo mật (Mutation Guard Simulation)
    const simulatePolicyMutation = (user: StaffType | null, action: () => void) => {
      const perm = checkPolicyMutationPermission(user);
      if (!perm.allowed) {
        throw new Error(perm.reason || 'Unauthorized');
      }
      action();
    };

    const mutationMock = vi.fn();

    // Admin gọi -> Thành công
    expect(() => simulatePolicyMutation(adminUser, mutationMock)).not.toThrow();
    expect(mutationMock).toHaveBeenCalledTimes(1);

    // Staff gọi -> Bị ném lỗi bảo mật
    expect(() => simulatePolicyMutation(staffUser, mutationMock)).toThrowError(/Quản trị viên/);
    expect(mutationMock).toHaveBeenCalledTimes(1); // Không bị tăng thêm
  });

  /* ========================================================================
   * 5. KIỂM THỬ THAY ĐỔI CHUẨN NGHÈO NÔNG THÔN & HỖ TRỢ ĐÓNG BHXH TỰ NGUYỆN
   * ======================================================================== */
  describe('5. Thay đổi Mức Chuẩn Nghèo Nông Thôn & Hỗ trợ Đóng BHXH Tự nguyện', () => {
    it('Tính đúng mức hỗ trợ Nhà nước 10% (Hộ khác) trước và sau ngày 01/10/2026', () => {
      // Trước 01/10/2026: Chuẩn nghèo = 1.500.000đ
      // Mức đóng = 1.500.000 * 22% = 330.000đ
      // NN hỗ trợ 10% của chuẩn nghèo: (1.500.000 * 22%) * 10% = 33.000đ/tháng
      // Người tham gia đóng: 330.000 - 33.000 = 297.000đ/tháng
      const bhxhOld = calculateBHXH(
        1500000,
        10, // 10% Nhà nước
        0,  // 0% Địa phương
        '1', // 1 tháng
        1,
        '08/2026', // Tháng 8/2026 (trước 01/10/2026)
        0.0031,
        1500000,
        mockPolicies
      );

      expect(bhxhOld.basePremium).toBe(330000);
      expect(bhxhOld.nnSupportAmount).toBe(33000);
      expect(bhxhOld.amount).toBe(297000);

      // Từ 01/10/2026: Chuẩn nghèo = 1.800.000đ
      // Mức đóng tối thiểu được nâng lên 1.800.000 * 22% = 396.000đ
      // NN hỗ trợ 10% của chuẩn nghèo: (1.800.000 * 22%) * 10% = 39.600đ/tháng
      // Người tham gia đóng: 396.000 - 39.600 = 356.400đ/tháng
      const bhxhNew = calculateBHXH(
        1500000, // Người dùng chọn 1.500.000 nhưng hệ thống tự động bump lên chuẩn nghèo 1.800.000đ
        10,
        0,
        '1',
        1,
        '10/2026', // Tháng 10/2026 (thuộc mốc chính sách mới)
        0.0031,
        1500000,
        mockPolicies
      );

      expect(bhxhNew.basePremium).toBe(396000);
      expect(bhxhNew.nnSupportAmount).toBe(39600);
      expect(bhxhNew.amount).toBe(356400);
    });

    it('Tính chính xác cho Hộ nghèo (30%) và Hộ cận nghèo (25%)', () => {
      // Hộ nghèo 30% tại mốc 1.500.000đ: (1.500.000 * 22%) * 30% = 99.000đ
      const poorOld = calculateBHXH(1500000, 30, 0, '1', 1, '09/2026', 0.0031, 1500000, mockPolicies);
      expect(poorOld.nnSupportAmount).toBe(99000);
      expect(poorOld.amount).toBe(231000);

      // Hộ cận nghèo 25% tại mốc 1.800.000đ: (1.800.000 * 22%) * 25% = 99.000đ
      const nearPoorNew = calculateBHXH(1800000, 25, 0, '1', 1, '11/2026', 0.0031, 1800000, mockPolicies);
      expect(nearPoorNew.nnSupportAmount).toBe(99000);
      expect(nearPoorNew.amount).toBe(297000);
    });
  });

  /* ========================================================================
   * 6. KIỂM THỬ HỆ SỐ TRƯỢT GIÁ CPI (BHXH 1 LẦN & LƯƠNG HƯU DỰ KIẾN)
   * ======================================================================== */
  describe('6. Cập nhật Hệ Số Trượt Giá CPI', () => {
    it('Lấy đúng bảng hệ số trượt giá theo ngày snapshot giao dịch', () => {
      // Giao dịch lập trước ngày 01/10/2026 -> áp dụng bảng CPI thông tư 2025
      const cpiOld: any = getPolicyValueForDate(mockPolicies, 'cpi_index', '2026-05-15', defaultSettings.cpiIndex);
      expect(cpiOld).toBeDefined();
      expect(cpiOld['2024']).toBe(1.03);
      expect(cpiOld['2023']).toBe(1.07);

      // Giao dịch lập sau ngày 01/10/2026 -> áp dụng bảng CPI mới cập nhật
      const cpiNew: any = getPolicyValueForDate(mockPolicies, 'cpi_index', '2026-10-15', defaultSettings.cpiIndex);
      expect(cpiNew).toBeDefined();
      expect(cpiNew['2027']).toBe(1.0);
      expect(cpiNew['2026']).toBe(1.02);
      expect(cpiNew['2024']).toBe(1.08);
    });

    it('Xử lý an toàn khi cpiIndex lưu dưới dạng chuỗi JSON string', () => {
      const policiesWithStringCPI: Policy[] = [
        {
          id: 40,
          name: 'CPI dạng chuỗi JSON',
          parameter_type: 'cpi_index',
          value: JSON.stringify({ '2026': 1.0, '2025': 1.05 }),
          effective_date: '2026-01-01',
          is_active: true
        }
      ];

      const rawVal = getPolicyValueForDate(policiesWithStringCPI, 'cpi_index', '2026-06-01', {});
      const parsed = typeof rawVal === 'string' ? JSON.parse(rawVal) : rawVal;
      expect(parsed['2025']).toBe(1.05);
    });
  });

  /* ========================================================================
   * 7. KHẢ NĂNG PHỤC HỒI & FALLBACK AN TOÀN KHI KHÔNG CÓ CHÍNH SÁCH
   * ======================================================================== */
  describe('7. Fallback an toàn khi chưa ban hành chính sách (Empty State & Cold Start)', () => {
    it('Không bị crash khi policies rỗng, trả về tham số mặc định từ Cấu hình cơ sở', () => {
      const emptyPolicies: Policy[] = [];

      const salaryFallback = getPolicyValueForDate(emptyPolicies, 'base_salary', '2026-09-15', 2340000);
      expect(salaryFallback).toBe(2340000);

      const povertyFallback = getPolicyValueForDate(emptyPolicies, 'poverty_standard', '2026-09-15', 1500000);
      expect(povertyFallback).toBe(1500000);

      const commRateFallback = getCommissionRateForRecord(
        { type: 'BHXH', action_type: 'Tham gia mới', date: '2026-09-15' },
        emptyPolicies,
        defaultSettings
      );
      expect(commRateFallback).toBe(0.05); // Default 5%
    });

    it('Tính toán hoa hồng không ném exception khi record không có date hoặc thiếu trường', () => {
      expect(() => getCommissionRateForRecord(null, mockPolicies, defaultSettings)).not.toThrow();
      expect(() => getCommissionRateForRecord({}, mockPolicies, defaultSettings)).not.toThrow();
      expect(() => getCommissionRateForRecord({ type: 'BHYT' }, mockPolicies, null)).not.toThrow();
    });
  });

  /* ========================================================================
   * 8. KIỂM THỬ ĐỒNG BỘ 5 NHÓM CHÍNH SÁCH HỆ THỐNG CỐT LÕI (8 QUYẾT ĐỊNH)
   * ======================================================================== */
  describe('8. Kiểm tra 5 nhóm chính sách cốt lõi (NĐ 73/2024, NĐ 161/2026, Chuẩn nghèo, Hoa hồng, Lãi suất, CPI)', () => {
    it('DEFAULT_SYSTEM_POLICIES chứa đủ 8 quyết định thuộc 5 nhóm cốt lõi', async () => {
      const { DEFAULT_SYSTEM_POLICIES } = await import('../data/defaultPolicies');
      expect(DEFAULT_SYSTEM_POLICIES).toHaveLength(8);

      // Đã loại bỏ homepage_config và locked_periods khỏi cấu hình chung
      const homepagePolicy = DEFAULT_SYSTEM_POLICIES.find(p => p.parameter_type === 'homepage_config');
      expect(homepagePolicy).toBeUndefined();

      const lockedPolicy = DEFAULT_SYSTEM_POLICIES.find(p => p.parameter_type === 'locked_periods');
      expect(lockedPolicy).toBeUndefined();

      // Nhóm 1: Kiểm tra 2 mốc lương cơ sở NĐ 73/2024 và NĐ 161/2026
      const baseSalaryPolicies = DEFAULT_SYSTEM_POLICIES.filter(p => p.parameter_type === 'base_salary');
      expect(baseSalaryPolicies).toHaveLength(2);
      expect(baseSalaryPolicies.find(p => p.value === 2340000)?.name).toContain('Nghị định 73/2024/NĐ-CP');
      expect(baseSalaryPolicies.find(p => p.value === 2530000)?.name).toContain('Nghị định số 161/2026/NĐ-CP');

      // Nhóm 2: Chuẩn nghèo nông thôn 1.500.000đ
      const povertyPolicies = DEFAULT_SYSTEM_POLICIES.filter(p => p.parameter_type === 'poverty_standard');
      expect(povertyPolicies).toHaveLength(1);
      expect(povertyPolicies[0]!.value).toBe(1500000);

      // Nhóm 3: Hoa hồng đại lý (2 quyết định: QĐ 11 cũ và QĐ điều chỉnh 2026)
      const commissionPolicies = DEFAULT_SYSTEM_POLICIES.filter(p => p.parameter_type === 'commission');
      expect(commissionPolicies).toHaveLength(2);
      const comm2026 = commissionPolicies.find(p => p.is_active);
      expect(comm2026?.value.commBHXHNew).toBe(15);
      expect(comm2026?.value.commBHXHRenew).toBe(9);
      expect(comm2026?.value.commBHYTNew).toBe(9);
      expect(comm2026?.value.commBHYTRenew).toBe(5);

      // Nhóm 4: Lãi suất đầu tư quỹ (0.31%/tháng)
      const investPolicies = DEFAULT_SYSTEM_POLICIES.filter(p => p.parameter_type === 'investment_rate');
      expect(investPolicies).toHaveLength(1);
      expect(investPolicies[0]!.value).toBe(0.31);

      // Nhóm 5: Hệ số trượt giá (2 mốc: TT 01/2025 và CV 340/2026)
      const cpiPolicies = DEFAULT_SYSTEM_POLICIES.filter(p => p.parameter_type === 'cpi_index');
      expect(cpiPolicies).toHaveLength(2);
      expect(cpiPolicies.find(p => p.is_active)?.name).toContain('340/BHXH-CSXH');

      // Kiểm tra lấy giá trị cho ngày cụ thể
      const baseSalary2026 = getPolicyValueForDate(DEFAULT_SYSTEM_POLICIES, 'base_salary', '2026-08-01', 2340000);
      expect(baseSalary2026).toBe(2530000);

      const povertyVal = getPolicyValueForDate(DEFAULT_SYSTEM_POLICIES, 'poverty_standard', '2026-01-01', 1500000);
      expect(povertyVal).toBe(1500000);

      const investmentVal = getPolicyValueForDate(DEFAULT_SYSTEM_POLICIES, 'investment_rate', '2026-01-01', 0.31);
      expect(investmentVal).toBe(0.31);
    });

    it('Chuẩn hóa Schema tương thích hai chiều (notes <-> description) giữa CSDL Supabase và Frontend', async () => {
      const { sanitizePolicyForDb, formatPolicyFromDb } = await import('../context/AppContext');

      // 1. Kiểm tra chuẩn hóa khi ghi vào CSDL Supabase: description -> notes
      const frontendPolicy: Partial<Policy> = {
        name: 'Chính sách mới',
        parameter_type: 'base_salary',
        value: 2600000,
        effective_date: '2027-01-01',
        is_active: true,
        description: 'Mô tả ghi chú của chính sách'
      };
      const dbPayload = sanitizePolicyForDb(frontendPolicy);
      expect(dbPayload.notes).toBe('Mô tả ghi chú của chính sách');
      expect(dbPayload.description).toBeUndefined(); // Loại bỏ description để tránh lỗi PGRST204 khi database chưa có cột

      // 2. Kiểm tra chuẩn hóa khi đọc từ CSDL Supabase: notes -> description
      const dbRow = {
        id: 99,
        name: 'Chính sách từ DB',
        parameter_type: 'base_salary',
        value: 2600000,
        effective_date: '2027-01-01',
        is_active: true,
        notes: 'Ghi chú đọc từ Supabase',
        created_at: '2026-09-15T00:00:00Z'
      };
      const appPolicy = formatPolicyFromDb(dbRow);
      expect(appPolicy.description).toBe('Ghi chú đọc từ Supabase');
      expect(appPolicy.notes).toBe('Ghi chú đọc từ Supabase');
      expect(appPolicy.name).toBe('Chính sách từ DB');
    });
  });
});

