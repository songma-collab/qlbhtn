import { supabase } from '../lib/supabase';

/**
 * MODULE BẢO VỆ DỮ LIỆU CÁ NHÂN NHẠY CẢM (PII DATA PROTECTION)
 * Tuân thủ Nghị định 13/2023/NĐ-CP về Bảo vệ Dữ liệu Cá nhân
 */

/**
 * Che giấu Số Căn Cước Công Dân (CCCD / CMND)
 * Quy tắc: Giữ 3 số đầu và 3 số cuối, che 6 số giữa (ví dụ: 001******234)
 * Nếu người dùng có quyền Admin / Quản trị viên thì hiển thị đầy đủ.
 */
export const maskCCCD = (cccd?: string | null, isAdmin: boolean = false): string => {
  if (!cccd) return '---';
  const clean = cccd.trim();
  if (isAdmin || clean.length < 6) return clean;

  if (clean.length === 12) {
    return `${clean.slice(0, 3)}******${clean.slice(9)}`;
  }
  if (clean.length === 9) {
    return `${clean.slice(0, 2)}*****${clean.slice(7)}`;
  }
  // Mặc định cho độ dài khác
  const visibleLen = Math.max(1, Math.floor(clean.length / 4));
  return `${clean.slice(0, visibleLen)}${'*'.repeat(clean.length - visibleLen * 2)}${clean.slice(clean.length - visibleLen)}`;
};

/**
 * Che giấu Số Điện Thoại
 * Quy tắc: Giữ 3 số đầu mạng và 3 số cuối thuê bao (ví dụ: 091****678)
 */
export const maskPhone = (phone?: string | null, isAdmin: boolean = false): string => {
  if (!phone) return '---';
  const clean = phone.trim().replace(/\s+/g, '');
  if (isAdmin || clean.length < 7) return clean;

  return `${clean.slice(0, 3)}****${clean.slice(clean.length - 3)}`;
};

/**
 * Che giấu Mã số BHXH / Số thẻ BHYT (10 ký tự số)
 * Quy tắc: Giữ 2 số đầu mã tỉnh và 3 số cuối (ví dụ: 79*****678)
 */
export const maskBHXH = (bhxh?: string | null, isAdmin: boolean = false): string => {
  if (!bhxh) return '---';
  const clean = bhxh.trim();
  if (isAdmin || clean.length < 6) return clean;

  if (clean.length === 10) {
    return `${clean.slice(0, 2)}*****${clean.slice(7)}`;
  }
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(clean.length - 2);
  return `${prefix}${'*'.repeat(Math.max(2, clean.length - 4))}${suffix}`;
};

/**
 * Che giấu Họ tên khách hàng (Tùy chọn hiển thị bảo mật)
 * Quy tắc: Giữ Họ và Tên chính, che phần tên đệm (ví dụ: Nguyễn *** An)
 */
export const maskName = (name?: string | null, isAdmin: boolean = false): string => {
  if (!name) return '---';
  const clean = name.trim();
  if (isAdmin) return clean;

  const parts = clean.split(/\s+/);
  if (parts.length <= 1) return clean;
  if (parts.length === 2) {
    return `${parts[0]} * ${parts[1]}`;
  }
  return `${parts[0]} *** ${parts[parts.length - 1]}`;
};

/**
 * Che giấu Địa chỉ cư trú chi tiết
 * Quy tắc: Giấu số nhà / ngõ xóm cụ thể, chỉ giữ lại cấp Phường/Xã, Quận/Huyện, Tỉnh
 */
export const maskAddress = (address?: string | null, isAdmin: boolean = false): string => {
  if (!address) return '---';
  const clean = address.trim();
  if (isAdmin) return clean;

  const parts = clean.split(',');
  if (parts.length > 2) {
    return `***, ${parts.slice(1).join(',').trim()}`;
  }
  return clean.replace(/^[^,]+/, '***');
};

/**
 * Vệ sinh chuỗi đầu vào (Sanitize Input / XSS Prevention)
 * Loại bỏ các thẻ script, iframe, onload, javascript: nguy hiểm
 */
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Ghi nhật ký kiểm toán bảo mật (Security Audit Logging)
 * Gọi RPC bảo mật server-side gắn kèm IP và định danh nhân viên
 */
export const logSecurityAudit = async (
  action: string,
  details: string,
  metadata: Record<string, any> = {}
): Promise<boolean> => {
  try {
    const { data, error } = await supabase.rpc('log_security_audit_event', {
      p_action: action,
      p_details: details,
      p_metadata: metadata
    });

    if (error) {
      console.warn('[Security Audit] RPC failed, fallback to client record:', error.message);
      return false;
    }
    return !!data;
  } catch (err) {
    console.error('[Security Audit] Unexpected error:', err);
    return false;
  }
};

/**
 * Kiểm tra phân quyền cập nhật/ban hành chính sách (Policy Mutation RBAC Guard)
 * Chỉ tài khoản có vai trò 'Admin' mới được phép thêm, sửa, kích hoạt hoặc xóa chính sách.
 */
export const checkPolicyMutationPermission = (
  user?: { role?: string; id?: string | number; name?: string } | null
): { allowed: boolean; reason?: string } => {
  if (!user) {
    return { allowed: false, reason: 'Chưa đăng nhập hệ thống' };
  }
  if (user.role !== 'Admin') {
    return { allowed: false, reason: 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền tạo mới, sửa đổi hoặc xóa chính sách' };
  }
  return { allowed: true };
};

/**
 * Ghi nhật ký kiểm toán truy cập dữ liệu cá nhân nhạy cảm (PII Access Audit)
 * Ghi nhận khi tài khoản Quản trị/Quản lý nhấn "Hiển thị CCCD/SĐT đầy đủ" (Unmask PII)
 */
export const logPIIUnmaskAccess = async (
  targetCustomerId: string | number,
  currentUser?: { id?: string | number; name?: string; role?: string } | null,
  details?: string
): Promise<boolean> => {
  const timestamp = new Date().toISOString();
  const userId = currentUser?.id ? String(currentUser.id) : (currentUser?.name || 'UNKNOWN_USER');
  const action = 'VIEW_UNMASKED_PII';
  const detailText = details || `Người dùng ${currentUser?.name || userId} xem thông tin định danh cá nhân đầy đủ (CCCD/SĐT) của khách hàng #${targetCustomerId}`;

  try {
    const logged = await logSecurityAudit(action, detailText, {
      userId,
      targetCustomerId: String(targetCustomerId),
      timestamp
    });

    if (logged) return true;

    const { error } = await supabase.from('auditlogs').insert([{
      userId,
      userName: currentUser?.name || 'Cán bộ quản lý',
      action,
      details: `[${timestamp}] ${detailText} | Target: ${targetCustomerId}`,
      timestamp
    }]);

    return !error;
  } catch (err) {
    console.warn('[PII Audit] Lỗi ghi log unmask PII:', err);
    return false;
  }
};

/**
 * Ghi nhật ký kiểm toán xuất báo cáo danh bạ Excel (Excel Export Audit)
 * Lưu rõ tên cán bộ thực hiện, loại báo cáo (D03/D05), số lượng người tham gia xuất ra, và thời điểm xuất dữ liệu
 */
export const logExportExcelAudit = async (
  reportType: 'D03' | 'D05' | string,
  count: number,
  currentUser?: { id?: string | number; name?: string; role?: string } | null,
  extraDetails?: string
): Promise<boolean> => {
  const timestamp = new Date().toISOString();
  const staffName = currentUser?.name || 'Cán bộ phụ trách';
  const userId = currentUser?.id ? String(currentUser.id) : staffName;
  const action = `EXPORT_${reportType.toUpperCase()}_EXCEL`;
  const detailText = `Cán bộ [${staffName}] xuất biểu mẫu chuẩn ${reportType.toUpperCase()}-TS cho ${count} người tham gia lúc ${timestamp}${extraDetails ? ` (${extraDetails})` : ''}`;

  try {
    const logged = await logSecurityAudit(action, detailText, {
      reportType,
      participantCount: count,
      staffName,
      timestamp
    });

    if (logged) return true;

    const { error } = await supabase.from('auditlogs').insert([{
      userId,
      userName: staffName,
      action,
      details: detailText,
      timestamp
    }]);

    return !error;
  } catch (err) {
    console.warn('[Export Audit] Lỗi ghi log xuất Excel:', err);
    return false;
  }
};

/**
 * THẨM TRA TÍNH HỢP LỆ THÔNG TIN NHÂN VIÊN (Staff Input Validation)
 * Kiểm tra CCCD 9 hoặc 12 số, SĐT 10 số bắt đầu bằng 0, Mã nhân viên và Email
 */
export const validateStaffInput = (data: {
  staffCode?: string;
  name?: string;
  cccd?: string;
  phone?: string;
  email?: string;
  username?: string;
  role?: string;
}): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Họ và tên nhân viên phải từ 2 ký tự trở lên.');
  }

  if (!data.staffCode || data.staffCode.trim().length === 0) {
    errors.push('Mã nhân viên không được để trống.');
  }

  if (data.cccd && data.cccd.trim() !== '') {
    const cleanCCCD = data.cccd.trim().replace(/\D/g, '');
    if (cleanCCCD.length !== 9 && cleanCCCD.length !== 12) {
      errors.push('Số CCCD/CMND phải gồm đúng 9 hoặc 12 chữ số.');
    }
  }

  if (!data.phone || data.phone.trim() === '') {
    errors.push('Số điện thoại không được để trống.');
  } else {
    const cleanPhone = data.phone.trim().replace(/\D/g, '');
    if (!/^0\d{9}$/.test(cleanPhone)) {
      errors.push('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.');
    }
  }

  const emailToCheck = data.email || data.username;
  if (!emailToCheck || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToCheck.trim())) {
    errors.push('Email đăng nhập không đúng định dạng hợp lệ.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * PHÒNG VỆ KHÓA HỆ THỐNG TOÀN DIỆN (Zero-Admin Lockout Protection)
 * Ngăn chặn tình huống Admin duy nhất tự hạ vai trò hoặc tự khóa/xóa tài khoản của chính mình
 */
export const checkZeroAdminRisk = (
  staffList: Array<{ id?: string; role?: string; status?: string }>,
  targetStaffId: string,
  newRole?: string,
  newStatus?: string
): { isRisk: boolean; reason?: string } => {
  const target = staffList.find(s => s.id === targetStaffId);
  if (!target) return { isRisk: false };

  const isCurrentAdmin = target.role === 'Admin' && (target.status === 'Hoạt động' || target.status === 'Đang hoạt động');
  if (!isCurrentAdmin) return { isRisk: false };

  // Đếm số lượng Admin khác đang hoạt động
  const otherActiveAdmins = staffList.filter(s => 
    s.id !== targetStaffId && 
    s.role === 'Admin' && 
    (s.status === 'Hoạt động' || s.status === 'Đang hoạt động')
  );

  if (otherActiveAdmins.length === 0) {
    if (newRole && newRole !== 'Admin') {
      return {
        isRisk: true,
        reason: 'Hệ thống chỉ còn 1 Quản trị viên (Admin) duy nhất. Không thể hạ vai trò tài khoản này để tránh tình trạng mất quyền quản trị hệ thống (Zero-Admin Lockout).'
      };
    }

    if (newStatus && (newStatus === 'Tạm khóa' || newStatus === 'Ngừng hoạt động')) {
      return {
        isRisk: true,
        reason: 'Hệ thống chỉ còn 1 Quản trị viên (Admin) duy nhất. Không thể khóa tài khoản này để tránh kịch bản hệ thống không còn người quản trị.'
      };
    }
  }

  return { isRisk: false };
};

/**
 * THẨM TRA AN TOÀN KHI XÓA NHÂN VIÊN (Staff Delete Safety Guard)
 * Chặn Hard Delete nếu nhân viên đã có hồ sơ lịch sử hạch toán thu tiền để tránh mồ côi dữ liệu (Orphan Records)
 */
export const checkStaffDeleteSafety = (
  currentUser: { id?: string; role?: string } | null | undefined,
  targetStaff: { id?: string; name?: string; role?: string } | null | undefined,
  staffList: Array<{ id?: string; role?: string; status?: string }>,
  associatedRecordCount: number
): { allowed: boolean; reason?: string | undefined; suggestedAction?: 'SOFT_DELETE' | 'BLOCK' | undefined } => {
  if (!currentUser || currentUser.role !== 'Admin') {
    return {
      allowed: false,
      reason: 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền xóa nhân sự.'
    };
  }

  if (!targetStaff || !targetStaff.id) {
    return { allowed: false, reason: 'Không tìm thấy thông tin nhân viên cần xóa.' };
  }

  // 1. Kiểm tra Zero-Admin Lockout
  const zeroAdminCheck = checkZeroAdminRisk(staffList, targetStaff.id, 'Nhân viên', 'Tạm khóa');
  if (zeroAdminCheck.isRisk) {
    return {
      allowed: false,
      reason: zeroAdminCheck.reason,
      suggestedAction: 'BLOCK'
    };
  }

  // 2. Kiểm tra hồ sơ mồ côi (Orphan Records)
  if (associatedRecordCount > 0) {
    return {
      allowed: false,
      reason: `Nhân viên "${targetStaff.name || targetStaff.id}" đang phụ trách ${associatedRecordCount} hồ sơ thu tiền trong hệ thống. Nghiêm cấm xóa vĩnh viễn (Hard Delete) để tránh làm mất dấu vết đối soát và hoa hồng. Vui lòng chuyển trạng thái sang "Tạm khóa" (Soft Delete).`,
      suggestedAction: 'SOFT_DELETE'
    };
  }

  return { allowed: true };
};

/**
 * KIỂM TRA PHÂN QUYỀN CẬP NHẬT NHÂN VIÊN (Staff Update RBAC Policy)
 * Đối chiếu RLS staff_update_policy:
 * - Admin: Sửa mọi trường
 * - Nhân viên: Chỉ sửa SĐT, Địa chỉ của chính mình; KHÔNG sửa role, status, email hoặc nhân viên khác
 * - Quản lý: Không sửa được Admin
 */
export const checkStaffUpdatePermission = (
  currentUser: { id?: string; role?: string; status?: string } | null | undefined,
  targetStaff: { id?: string; role?: string; status?: string } | null | undefined,
  updatedFields: Record<string, any>
): { allowed: boolean; reason?: string } => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng.' };
  }

  if (currentUser.status === 'Tạm khóa' || currentUser.status === 'Ngừng hoạt động') {
    return { allowed: false, reason: 'Tài khoản đã bị tạm khóa, không thể thực hiện thao tác.' };
  }

  // Admin có quyền cao nhất
  if (currentUser.role === 'Admin') {
    return { allowed: true };
  }

  // Quản lý không được sửa tài khoản Admin
  if (currentUser.role === 'Quản lý') {
    if (targetStaff?.role === 'Admin') {
      return { allowed: false, reason: 'Quản lý không có quyền sửa thông tin của Quản trị viên (Admin).' };
    }
    if (updatedFields.role === 'Admin') {
      return { allowed: false, reason: 'Quản lý không có quyền thăng cấp tài khoản lên Quản trị viên (Admin).' };
    }
    return { allowed: true };
  }

  // Nhân viên thông thường
  if (currentUser.role === 'Nhân viên') {
    if (currentUser.id !== targetStaff?.id) {
      return { allowed: false, reason: 'Nhân viên chỉ có thể cập nhật hồ sơ cá nhân của chính mình.' };
    }

    if (updatedFields.role !== undefined && updatedFields.role !== targetStaff?.role) {
      return { allowed: false, reason: 'Nhân viên không có quyền tự thay đổi vai trò (Role).' };
    }

    if (updatedFields.status !== undefined) {
      return { allowed: false, reason: 'Nhân viên không có quyền tự kích hoạt hoặc đổi trạng thái tài khoản.' };
    }

    if (updatedFields.email || updatedFields.username) {
      return { allowed: false, reason: 'Nhân viên không có quyền tự đổi email định danh đăng nhập.' };
    }

    return { allowed: true };
  }

  return { allowed: false, reason: 'Vai trò không được nhận diện.' };
};

/**
 * KIỂM TRA PHÂN QUYỀN CẬP NHẬT THÔNG TIN THANH TOÁN VIETQR
 * Đối chiếu RLS settings_write_admin_only: Chỉ Quản trị viên (Admin) mới có quyền sửa tài khoản ngân hàng và điểm thu VietQR.
 */
export const checkVietQRSettingsPermission = (
  currentUser: { id?: string; role?: string; status?: string } | null | undefined
): { allowed: boolean; reason?: string } => {
  if (!currentUser) {
    return { allowed: false, reason: 'Chưa xác thực người dùng. Vui lòng đăng nhập.' };
  }
  if (currentUser.status === 'Tạm khóa' || currentUser.status === 'Ngừng hoạt động') {
    return { allowed: false, reason: 'Tài khoản đã bị tạm khóa, không thể thực hiện thao tác.' };
  }
  if (currentUser.role === 'Admin') {
    return { allowed: true };
  }
  return { 
    allowed: false, 
    reason: 'Chỉ Quản trị viên (Admin) mới có quyền cấu hình thông tin tài khoản ngân hàng đại lý.' 
  };
};

