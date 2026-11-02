import { SettingsType, Policy, ReminderMessageTemplates } from '../context/types';
export type { ReminderMessageTemplates };
import { VietQRConfig, DEFAULT_VIETQR_CONFIG } from './vietqr';
import { RolePermissionsMap, SanitizedRolePermissionsMap, DEFAULT_ROLE_PERMISSIONS, sanitizeRolePermissions, UserOverridesMap, sanitizeUserOverrides } from './permissions';

/**
 * Bộ nhớ đệm lưu các cột không tồn tại trên bảng settings thực tế
 * (phòng ngừa lỗi PostgREST PGRST204 khi schema cache chưa có hoặc DB chưa bổ sung cột)
 */
export const unsupportedSettingsColumns = new Set<string>();

/**
 * Danh mục các cột chuẩn đã được xác thực tồn tại trên bảng public.settings của PostgreSQL
 */
export const KNOWN_SETTINGS_COLUMNS = new Set<string>([
  'commBHXHNew',
  'commBHXHRenew',
  'commBHYTNew',
  'commBHYTRenew',
  'commBHXH',
  'commBHYT',
  'investmentRate',
  'baseSalary',
  'povertyStandard',
  'cpiIndex'
]);

const getStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) return (globalThis as any).localStorage;
  return null;
};

/**
 * Lấy cấu hình phân quyền vai trò từ localStorage (offline-first & persistent)
 */
export const getStoredRolePermissions = (): SanitizedRolePermissionsMap => {
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_rbac_role_permissions');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') {
          return sanitizeRolePermissions(parsed);
        }
      }
    }
  } catch (e) {
    // Không gián đoạn nếu môi trường chặn localStorage
  }
  return { ...DEFAULT_ROLE_PERMISSIONS };
};

/**
 * Lưu cấu hình phân quyền vai trò vào localStorage
 */
export const storeRolePermissions = (map?: RolePermissionsMap | Record<string, any> | null): void => {
  try {
    const storage = getStorage();
    if (storage) {
      const clean = sanitizeRolePermissions(map);
      storage.setItem('vss_rbac_role_permissions', JSON.stringify(clean));
    }
  } catch (e) {
    console.warn('[settingsHelper] Không thể lưu cache rolePermissions vào localStorage:', e);
  }
};

/**
 * Trích xuất bảng phân quyền vai trò từ danh sách Policies của Supabase
 */
export const extractRolePermissionsFromPolicies = (
  policies?: Policy[] | null,
  fallback?: RolePermissionsMap | Record<string, any> | null
): SanitizedRolePermissionsMap => {
  if (policies && Array.isArray(policies)) {
    const found = policies.find(p => p.parameter_type === 'rbac_role_permissions' && p.is_active !== false);
    if (found && found.value) {
      try {
        const val = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
        if (val && typeof val === 'object') {
          return sanitizeRolePermissions(val);
        }
      } catch (e) {
        console.warn('[settingsHelper] Lỗi parse policy rbac_role_permissions:', e);
      }
    }
  }

  if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
    return sanitizeRolePermissions(fallback);
  }

  return getStoredRolePermissions();
};

/**
 * Lấy cấu hình phân quyền đặc cách riêng theo nhân viên từ localStorage (offline-first & persistent)
 */
export const getStoredUserOverrides = (): UserOverridesMap => {
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_rbac_user_overrides');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') {
          return sanitizeUserOverrides(parsed);
        }
      }
    }
  } catch (e) {
    // Không gián đoạn nếu môi trường chặn localStorage
  }
  return {};
};

/**
 * Lưu cấu hình phân quyền đặc cách riêng theo nhân viên vào localStorage
 */
export const storeUserOverrides = (map?: Record<string, any> | null): void => {
  try {
    const storage = getStorage();
    if (storage) {
      const clean = sanitizeUserOverrides(map);
      storage.setItem('vss_rbac_user_overrides', JSON.stringify(clean));
    }
  } catch (e) {
    console.warn('[settingsHelper] Không thể lưu cache userOverrides vào localStorage:', e);
  }
};

/**
 * Trích xuất bảng phân quyền đặc cách riêng theo nhân viên từ danh sách Policies của Supabase
 */
export const extractUserOverridesFromPolicies = (
  policies?: Policy[] | null,
  fallback?: Record<string, any> | null
): UserOverridesMap => {
  if (policies && Array.isArray(policies)) {
    const found = policies.find(p => p.parameter_type === 'rbac_user_overrides' && p.is_active !== false);
    if (found && found.value) {
      try {
        const val = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
        if (val && typeof val === 'object') {
          return sanitizeUserOverrides(val);
        }
      } catch (e) {
        console.warn('[settingsHelper] Lỗi parse policy rbac_user_overrides:', e);
      }
    }
  }

  if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
    return sanitizeUserOverrides(fallback);
  }

  return getStoredUserOverrides();
};

/**
 * Lấy cấu hình VietQR an toàn từ localStorage (offline-first & persistent)
 */
export const getStoredVietQRConfig = (): VietQRConfig => {
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_vietqr_agency_config');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_VIETQR_CONFIG,
            ...parsed
          };
        }
      }
    }
  } catch (e) {
    // Không gián đoạn nếu môi trường chặn localStorage
  }
  return { ...DEFAULT_VIETQR_CONFIG };
};

/**
 * Trích xuất cấu hình VietQR từ bất kỳ đối tượng nào chứa các trường VietQR
 */
export const extractVietQRConfig = (
  source: Partial<SettingsType> | Partial<VietQRConfig>,
  fallback?: Partial<SettingsType> | Partial<VietQRConfig>
): VietQRConfig => {
  const base = (fallback || {}) as Partial<SettingsType> & Partial<VietQRConfig>;
  const src = source as Partial<SettingsType> & Partial<VietQRConfig>;
  return {
    agencyName: (src.agencyName ?? src.agency_name ?? base.agencyName ?? base.agency_name ?? DEFAULT_VIETQR_CONFIG.agencyName)?.trim(),
    agencyCode: (src.agencyCode ?? src.agency_code ?? base.agencyCode ?? base.agency_code ?? DEFAULT_VIETQR_CONFIG.agencyCode)?.trim(),
    bankBin: (src.bankBin ?? src.bank_bin ?? base.bankBin ?? base.bank_bin ?? DEFAULT_VIETQR_CONFIG.bankBin)?.trim(),
    bankId: (src.bankId ?? src.bank_id ?? base.bankId ?? base.bank_id ?? DEFAULT_VIETQR_CONFIG.bankId)?.trim(),
    bankName: (src.bankName ?? src.bank_name ?? base.bankName ?? base.bank_name ?? DEFAULT_VIETQR_CONFIG.bankName)?.trim(),
    accountNumber: (src.accountNumber ?? src.accountNo ?? src.account_number ?? src.bank_account ?? base.accountNumber ?? base.account_number ?? base.bank_account ?? DEFAULT_VIETQR_CONFIG.accountNumber)?.trim(),
    accountNo: (src.accountNo ?? src.accountNumber ?? src.account_number ?? src.bank_account ?? base.accountNo ?? base.accountNumber ?? base.bank_account ?? DEFAULT_VIETQR_CONFIG.accountNo)?.trim(),
    accountHolder: (src.accountHolder ?? src.accountName ?? src.account_holder ?? src.bank_owner ?? base.accountHolder ?? base.account_holder ?? base.bank_owner ?? DEFAULT_VIETQR_CONFIG.accountHolder)?.trim(),
    accountName: (src.accountName ?? src.accountHolder ?? src.account_holder ?? src.bank_owner ?? base.accountName ?? base.account_holder ?? base.bank_owner ?? DEFAULT_VIETQR_CONFIG.accountName)?.trim(),
    qrTemplate: src.qrTemplate ?? src.qr_template ?? (src as any).template ?? base.qrTemplate ?? base.qr_template ?? DEFAULT_VIETQR_CONFIG.qrTemplate
  };
};

/**
 * Kiểm tra xem một đối tượng có chứa trường cấu hình VietQR hay không
 */
export const hasVietQRFields = (fields: Partial<SettingsType>): boolean => {
  if (!fields || typeof fields !== 'object') return false;
  return Boolean(
    fields.agencyName !== undefined || fields.agency_name !== undefined ||
    fields.agencyCode !== undefined || fields.agency_code !== undefined ||
    fields.bankBin !== undefined || fields.bank_bin !== undefined ||
    fields.bankId !== undefined || fields.bank_id !== undefined ||
    fields.bankName !== undefined || fields.bank_name !== undefined ||
    fields.accountNumber !== undefined || fields.accountNo !== undefined || 
    fields.account_number !== undefined || fields.bank_account !== undefined ||
    fields.accountHolder !== undefined || fields.accountName !== undefined || 
    fields.account_holder !== undefined || fields.bank_owner !== undefined ||
    fields.qrTemplate !== undefined || fields.qr_template !== undefined || (fields as any).template !== undefined
  );
};

/**
 * Định nghĩa cấu hình thông số in ấn và mẫu biểu báo cáo hành chính (Nghị định 30/2020/NĐ-CP)
 */
export interface ReportPrintConfig {
  parentAgencyName?: string | undefined;
  agencyName?: string | undefined;
  managerName?: string | undefined;
  reportLocation?: string | undefined;
  controllerName?: string | undefined;
  managerTitle?: string | undefined;
  creatorTitle?: string | undefined;
  controllerTitle?: string | undefined;
}

export const DEFAULT_REPORT_PRINT_CONFIG: Required<ReportPrintConfig> = {
  parentAgencyName: 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA',
  agencyName: 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ',
  managerName: 'Thủ trưởng đơn vị',
  reportLocation: 'Sông Mã',
  controllerName: '',
  managerTitle: 'THỦ TRƯỞNG ĐƠN VỊ',
  creatorTitle: 'NGƯỜI LẬP BIỂU',
  controllerTitle: 'NGƯỜI KIỂM SOÁT'
};

/**
 * Lấy cấu hình thông số in ấn từ localStorage (offline-first & persistent)
 */
export const getStoredPrintConfig = (): ReportPrintConfig => {
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_report_print_settings');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_REPORT_PRINT_CONFIG,
            ...parsed
          };
        }
      }
    }
  } catch (e) {
    // Không gián đoạn nếu môi trường chặn localStorage
  }
  return { ...DEFAULT_REPORT_PRINT_CONFIG };
};

/**
 * Lưu cấu hình thông số in ấn vào localStorage
 */
export const storePrintConfig = (config: Partial<ReportPrintConfig>): void => {
  try {
    const storage = getStorage();
    if (storage) {
      const current = getStoredPrintConfig();
      const updated = { ...DEFAULT_REPORT_PRINT_CONFIG, ...current, ...config };
      storage.setItem('vss_report_print_settings', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[settingsHelper] Không thể lưu cache reportPrintSettings vào localStorage:', e);
  }
};

/**
 * Trích xuất cấu hình in ấn từ bảng Policies của Supabase
 */
export const extractPrintConfigFromPolicies = (
  policies?: Policy[] | null,
  fallback?: Partial<ReportPrintConfig> | null
): ReportPrintConfig => {
  if (policies && Array.isArray(policies)) {
    const found = policies.find(p => p.parameter_type === 'report_print_settings' && p.is_active !== false);
    if (found && found.value) {
      try {
        const val = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
        if (val && typeof val === 'object') {
          return {
            ...DEFAULT_REPORT_PRINT_CONFIG,
            ...val
          };
        }
      } catch (e) {
        console.warn('[settingsHelper] Lỗi parse policy report_print_settings:', e);
      }
    }
  }

  if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
    return {
      ...DEFAULT_REPORT_PRINT_CONFIG,
      ...fallback
    };
  }

  return getStoredPrintConfig();
};

/**
 * Trích xuất cấu hình thông số in ấn từ bất kỳ đối tượng nào chứa các trường in ấn
 */
export const extractPrintConfig = (
  source: Partial<SettingsType>,
  fallback?: Partial<SettingsType>
): ReportPrintConfig => {
  const base = fallback || {};
  return {
    parentAgencyName: (source.parentAgencyName ?? base.parentAgencyName ?? DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName)?.trim(),
    agencyName: (source.agencyName ?? source.agency_name ?? base.agencyName ?? base.agency_name)?.trim(),
    managerName: (source.managerName ?? base.managerName ?? DEFAULT_REPORT_PRINT_CONFIG.managerName)?.trim(),
    reportLocation: (source.reportLocation ?? base.reportLocation ?? DEFAULT_REPORT_PRINT_CONFIG.reportLocation)?.trim(),
    controllerName: (source.controllerName ?? base.controllerName ?? DEFAULT_REPORT_PRINT_CONFIG.controllerName)?.trim(),
    managerTitle: (source.managerTitle ?? base.managerTitle ?? DEFAULT_REPORT_PRINT_CONFIG.managerTitle)?.trim(),
    creatorTitle: (source.creatorTitle ?? base.creatorTitle ?? DEFAULT_REPORT_PRINT_CONFIG.creatorTitle)?.trim(),
    controllerTitle: (source.controllerTitle ?? base.controllerTitle ?? DEFAULT_REPORT_PRINT_CONFIG.controllerTitle)?.trim()
  };
};

/**
 * Kiểm tra xem một đối tượng có chứa trường cấu hình in ấn hay không
 */
export const hasPrintSettingsFields = (fields: Partial<SettingsType>): boolean => {
  if (!fields || typeof fields !== 'object') return false;
  return Boolean(
    fields.parentAgencyName !== undefined ||
    fields.managerName !== undefined ||
    fields.reportLocation !== undefined ||
    fields.controllerName !== undefined ||
    fields.managerTitle !== undefined ||
    fields.creatorTitle !== undefined ||
    fields.controllerTitle !== undefined
  );
};

export const DEFAULT_REMINDER_MESSAGE_TEMPLATES: Required<ReminderMessageTemplates> = {
  // 1. Mẫu tin nhắn Trung Tâm Quản Lý & Nhắc Hạn Hồ Sơ
  renewalReminderBHXH: `Kính gửi Anh/Chị {ten_khach_hang},
{ten_dai_ly} xin thông báo: Hợp đồng BHXH tự nguyện của Anh/Chị (Mã số BHXH: {ma_so}) sẽ đến hạn đóng kỳ tiếp theo vào ngày {ngay_het_han}.

📌 QUYỀN LỢI NGHỈ HƯU: Việc đóng đúng kỳ hạn giúp quá trình tích lũy năm đóng của Anh/Chị được bảo lưu liên tục, tối ưu tỷ lệ hưởng lương hưu hàng tháng và các chế độ trợ cấp thai sản, tử tuất theo Luật BHXH số 41/2024/QH15.

Anh/Chị vui lòng liên hệ cán bộ hỗ trợ để thực hiện nộp tiền và nhận biên lai điện tử:
Cán bộ phụ trách: {ten_can_bo}
Số điện thoại/Zalo: {sdt_can_bo}
Trân trọng cảm ơn Anh/Chị!`,

  renewal_bhxh: `Kính gửi Anh/Chị {ten_khach_hang},
{ten_dai_ly} xin thông báo: Hợp đồng BHXH tự nguyện của Anh/Chị (Mã số BHXH: {ma_so}) sẽ đến hạn đóng kỳ tiếp theo vào ngày {ngay_het_han}.

📌 QUYỀN LỢI NGHỈ HƯU: Việc đóng đúng kỳ hạn giúp quá trình tích lũy năm đóng của Anh/Chị được bảo lưu liên tục, tối ưu tỷ lệ hưởng lương hưu hàng tháng và các chế độ trợ cấp thai sản, tử tuất theo Luật BHXH số 41/2024/QH15.

Anh/Chị vui lòng liên hệ cán bộ hỗ trợ để thực hiện nộp tiền và nhận biên lai điện tử:
Cán bộ phụ trách: {ten_can_bo}
Số điện thoại/Zalo: {sdt_can_bo}
Trân trọng cảm ơn Anh/Chị!`,

  renewalReminderBHYT: `Kính gửi Anh/Chị {ten_khach_hang},
{ten_dai_ly} xin thông báo: Thẻ BHYT hộ gia đình của Anh/Chị (Mã thẻ: {ma_so}) sẽ đến hạn gia hạn vào ngày {ngay_het_han}.

⚠️ LƯU Ý QUAN TRỌNG: Theo Luật BHYT, để đảm bảo quyền lợi tham gia "5 NĂM LIÊN TỤC" (được quỹ BHYT chi trả 100% chi phí khám chữa bệnh vượt mức quy định), Anh/Chị vui lòng gia hạn trước hoặc trong vòng 3 tháng kể từ ngày hết hạn.

Để hoàn tất thủ tục gia hạn và nhận thẻ điện tử VssID nhanh chóng, Anh/Chị vui lòng liên hệ:
Cán bộ phụ trách: {ten_can_bo}
Số điện thoại/Zalo: {sdt_can_bo}
Trân trọng cảm ơn Anh/Chị đã đồng hành!`,

  renewal_bhyt: `Kính gửi Anh/Chị {ten_khach_hang},
{ten_dai_ly} xin thông báo: Thẻ BHYT hộ gia đình của Anh/Chị (Mã thẻ: {ma_so}) sẽ đến hạn gia hạn vào ngày {ngay_het_han}.

⚠️ LƯU Ý QUAN TRỌNG: Theo Luật BHYT, để đảm bảo quyền lợi tham gia "5 NĂM LIÊN TỤC" (được quỹ BHYT chi trả 100% chi phí khám chữa bệnh vượt mức quy định), Anh/Chị vui lòng gia hạn trước hoặc trong vòng 3 tháng kể từ ngày hết hạn.

Để hoàn tất thủ tục gia hạn và nhận thẻ điện tử VssID nhanh chóng, Anh/Chị vui lòng liên hệ:
Cán bộ phụ trách: {ten_can_bo}
Số điện thoại/Zalo: {sdt_can_bo}
Trân trọng cảm ơn Anh/Chị đã đồng hành!`,

  // 2. Kịch bản đôn đốc thu phí Trung Tâm Điều Phối & Đôn Đốc
  dispatchUrgentBHXH: `Kính gửi Anh/Chị {ten_khach_hang},
Đại lý BHXH xin thông báo: Số BHXH tự nguyện (Mã: {ma_so}) của Anh/Chị đến kỳ đóng tiếp vào ngày {ngay_het_han} với số tiền {so_tien}.
Kính mời Anh/Chị liên hệ đại lý để hoàn tất nộp phí, tích lũy liên tục thời gian hưởng Lương hưu theo Nghị định 158/2025. Trân trọng!`,

  dispatch_urgent_bhxh: `Kính gửi Anh/Chị {ten_khach_hang},
Đại lý BHXH xin thông báo: Số BHXH tự nguyện (Mã: {ma_so}) của Anh/Chị đến kỳ đóng tiếp vào ngày {ngay_het_han} với số tiền {so_tien}.
Kính mời Anh/Chị liên hệ đại lý để hoàn tất nộp phí, tích lũy liên tục thời gian hưởng Lương hưu theo Nghị định 158/2025. Trân trọng!`,

  dispatchUrgentBHYT: `Kính gửi Anh/Chị {ten_khach_hang},
Đại lý thu BHXH-BHYT xin thông báo: Thẻ BHYT (Mã: {ma_so}) của Anh/Chị sẽ hết hạn vào ngày {ngay_het_han}.
Để đảm bảo quyền lợi khám chữa bệnh và QUYỀN LỢI 5 NĂM LIÊN TỤC không bị gián đoạn, xin vui lòng đóng phí gia hạn (ước tính: {so_tien}).
Cán bộ đại lý sẽ hỗ trợ thu phí tại nhà hoặc qua chuyển khoản. Hotline: {sdt_can_bo}. Trân trọng!`,

  dispatch_urgent_bhyt: `Kính gửi Anh/Chị {ten_khach_hang},
Đại lý thu BHXH-BHYT xin thông báo: Thẻ BHYT (Mã: {ma_so}) của Anh/Chị sẽ hết hạn vào ngày {ngay_het_han}.
Để đảm bảo quyền lợi khám chữa bệnh và QUYỀN LỢI 5 NĂM LIÊN TỤC không bị gián đoạn, xin vui lòng đóng phí gia hạn (ước tính: {so_tien}).
Cán bộ đại lý sẽ hỗ trợ thu phí tại nhà hoặc qua chuyển khoản. Hotline: {sdt_can_bo}. Trân trọng!`,

  dispatchStandard: `Chào Anh/Chị {ten_khach_hang}, em là cán bộ đại lý thu BHXH - BHYT. Em xin phép gửi lịch nhắc kỳ đóng {loai_hinh} sắp tới hạn vào ngày {ngay_het_han} (Số tiền: {so_tien}). Anh/Chị cho em xin lịch hẹn thuận tiện nhất để qua hỗ trợ gia hạn hoặc hướng dẫn nộp online nhé ạ! Em cảm ơn Anh/Chị!`,

  dispatch_standard: `Chào Anh/Chị {ten_khach_hang}, em là cán bộ đại lý thu BHXH - BHYT. Em xin phép gửi lịch nhắc kỳ đóng {loai_hinh} sắp tới hạn vào ngày {ngay_het_han} (Số tiền: {so_tien}). Anh/Chị cho em xin lịch hẹn thuận tiện nhất để qua hỗ trợ gia hạn hoặc hướng dẫn nộp online nhé ạ! Em cảm ơn Anh/Chị!`,

  dispatch_periodic: `Chào Anh/Chị {ten_khach_hang}, em là cán bộ đại lý thu BHXH - BHYT. Em xin phép gửi lịch nhắc kỳ đóng {loai_hinh} sắp tới hạn vào ngày {ngay_het_han} (Số tiền: {so_tien}). Anh/Chị cho em xin lịch hẹn thuận tiện nhất để qua hỗ trợ gia hạn hoặc hướng dẫn nộp online nhé ạ! Em cảm ơn Anh/Chị!`,

  dispatchReceipt: `Xác nhận: Đại lý thu BHXH đã nhận được thông tin đăng ký gia hạn {loai_hinh} của khách hàng {ten_khach_hang} (Mã: {ma_so}). Hồ sơ đang được đồng bộ lên hệ thống BHXH Việt Nam. Cảm ơn Quý khách đã tin tưởng đồng hành!`,

  dispatch_receipt: `Xác nhận: Đại lý thu BHXH đã nhận được thông tin đăng ký gia hạn {loai_hinh} của khách hàng {ten_khach_hang} (Mã: {ma_so}). Hồ sơ đang được đồng bộ lên hệ thống BHXH Việt Nam. Cảm ơn Quý khách đã tin tưởng đồng hành!`,

  dispatch_confirmed: `Xác nhận: Đại lý thu BHXH đã nhận được thông tin đăng ký gia hạn {loai_hinh} của khách hàng {ten_khach_hang} (Mã: {ma_so}). Hồ sơ đang được đồng bộ lên hệ thống BHXH Việt Nam. Cảm ơn Quý khách đã tin tưởng đồng hành!`
};

/**
 * Đồng bộ hóa các thuộc tính camelCase và snake_case của mẫu tin nhắn
 */
export const normalizeReminderMessageTemplates = (
  raw?: Partial<ReminderMessageTemplates> | null
): ReminderMessageTemplates => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_REMINDER_MESSAGE_TEMPLATES };

  const renewal_bhxh = raw.renewal_bhxh ?? raw.renewalReminderBHXH ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewalReminderBHXH;
  const renewal_bhyt = raw.renewal_bhyt ?? raw.renewalReminderBHYT ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewalReminderBHYT;
  const dispatch_urgent_bhxh = raw.dispatch_urgent_bhxh ?? raw.dispatchUrgentBHXH ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatchUrgentBHXH;
  const dispatch_urgent_bhyt = raw.dispatch_urgent_bhyt ?? raw.dispatchUrgentBHYT ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatchUrgentBHYT;
  const dispatch_periodic = raw.dispatch_periodic ?? raw.dispatch_standard ?? raw.dispatchStandard ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatchStandard;
  const dispatch_confirmed = raw.dispatch_confirmed ?? raw.dispatch_receipt ?? raw.dispatchReceipt ?? DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatchReceipt;

  return {
    ...DEFAULT_REMINDER_MESSAGE_TEMPLATES,
    ...raw,
    renewalReminderBHXH: renewal_bhxh,
    renewal_bhxh,
    renewalReminderBHYT: renewal_bhyt,
    renewal_bhyt,
    dispatchUrgentBHXH: dispatch_urgent_bhxh,
    dispatch_urgent_bhxh,
    dispatchUrgentBHYT: dispatch_urgent_bhyt,
    dispatch_urgent_bhyt,
    dispatchStandard: dispatch_periodic,
    dispatch_standard: dispatch_periodic,
    dispatch_periodic,
    dispatchReceipt: dispatch_confirmed,
    dispatch_receipt: dispatch_confirmed,
    dispatch_confirmed
  };
};

/**
 * Lấy cấu hình mẫu tin nhắn đôn đốc từ localStorage (offline-first & persistent)
 */
export const getStoredReminderMessageTemplates = (): ReminderMessageTemplates => {
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_reminder_message_templates');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed && typeof parsed === 'object') {
          return normalizeReminderMessageTemplates(parsed);
        }
      }
    }
  } catch (e) {
    // Không gián đoạn nếu môi trường chặn localStorage
  }
  return { ...DEFAULT_REMINDER_MESSAGE_TEMPLATES };
};

/**
 * Lưu cấu hình mẫu tin nhắn đôn đốc vào localStorage
 */
export const storeReminderMessageTemplates = (templates: Partial<ReminderMessageTemplates>): void => {
  try {
    const storage = getStorage();
    if (storage) {
      const current = getStoredReminderMessageTemplates();
      const incoming: Partial<ReminderMessageTemplates> = { ...templates };
      if (templates.renewal_bhxh && !templates.renewalReminderBHXH) {
        incoming.renewalReminderBHXH = templates.renewal_bhxh;
      } else if (templates.renewalReminderBHXH && !templates.renewal_bhxh) {
        incoming.renewal_bhxh = templates.renewalReminderBHXH;
      }

      if (templates.renewal_bhyt && !templates.renewalReminderBHYT) {
        incoming.renewalReminderBHYT = templates.renewal_bhyt;
      } else if (templates.renewalReminderBHYT && !templates.renewal_bhyt) {
        incoming.renewal_bhyt = templates.renewalReminderBHYT;
      }

      if (templates.dispatch_urgent_bhxh && !templates.dispatchUrgentBHXH) {
        incoming.dispatchUrgentBHXH = templates.dispatch_urgent_bhxh;
      } else if (templates.dispatchUrgentBHXH && !templates.dispatch_urgent_bhxh) {
        incoming.dispatch_urgent_bhxh = templates.dispatchUrgentBHXH;
      }

      if (templates.dispatch_urgent_bhyt && !templates.dispatchUrgentBHYT) {
        incoming.dispatchUrgentBHYT = templates.dispatch_urgent_bhyt;
      } else if (templates.dispatchUrgentBHYT && !templates.dispatch_urgent_bhyt) {
        incoming.dispatch_urgent_bhyt = templates.dispatchUrgentBHYT;
      }

      const periodicVal = templates.dispatch_periodic || templates.dispatch_standard || templates.dispatchStandard;
      if (periodicVal) {
        incoming.dispatchStandard = periodicVal;
        incoming.dispatch_standard = periodicVal;
        incoming.dispatch_periodic = periodicVal;
      }

      const receiptVal = templates.dispatch_confirmed || templates.dispatch_receipt || templates.dispatchReceipt;
      if (receiptVal) {
        incoming.dispatchReceipt = receiptVal;
        incoming.dispatch_receipt = receiptVal;
        incoming.dispatch_confirmed = receiptVal;
      }

      const updated = { ...DEFAULT_REMINDER_MESSAGE_TEMPLATES, ...current, ...incoming };
      storage.setItem('vss_reminder_message_templates', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('[settingsHelper] Không thể lưu cache reminderMessageTemplates vào localStorage:', e);
  }
};

/**
 * Trích xuất cấu hình mẫu tin nhắn từ bảng policies hoặc settings
 */
export const extractReminderMessageTemplates = (
  dbSettingsOrPolicies?: Partial<SettingsType> | Policy[] | null,
  maybePolicies?: Policy[] | null
): ReminderMessageTemplates => {
  let dbSettings: Partial<SettingsType> | null = null;
  let policies: Policy[] | null = null;

  if (Array.isArray(dbSettingsOrPolicies)) {
    policies = dbSettingsOrPolicies;
    dbSettings = null;
  } else {
    dbSettings = dbSettingsOrPolicies || null;
    policies = maybePolicies || null;
  }

  if (policies && Array.isArray(policies)) {
    const found = policies.find(p => p.parameter_type === 'reminder_message_templates' && p.is_active !== false);
    if (found && found.value) {
      try {
        const val = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
        if (val && typeof val === 'object') {
          return normalizeReminderMessageTemplates(val);
        }
      } catch (e) {
        console.warn('[settingsHelper] Lỗi parse policy reminder_message_templates:', e);
      }
    }
  }

  const settingTpls = dbSettings?.reminder_message_templates || dbSettings?.reminderMessageTemplates;
  if (settingTpls && typeof settingTpls === 'object' && Object.keys(settingTpls).length > 0) {
    return normalizeReminderMessageTemplates(settingTpls);
  }

  return getStoredReminderMessageTemplates();
};

/**
 * Thay thế linh hoạt các tham số trong mẫu tin nhắn (case-insensitive)
 */
export const renderReminderMessageTemplate = (
  template: string,
  variables: Record<string, string | number | undefined | null>
): string => {
  if (!template) return '';
  const lowerVars: Record<string, string> = {};
  for (const [key, val] of Object.entries(variables)) {
    lowerVars[key.toLowerCase()] = val != null ? String(val) : '';
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    const lk = key.toLowerCase();
    if (lowerVars[lk] !== undefined) {
      return lowerVars[lk];
    }
    return match;
  });
};

/**
 * Hợp nhất an toàn cấu hình hệ thống từ DB, cấu hình VietQR, và cấu hình thông số in ấn
 */
export const mergeSettingsWithVietQR = (
  dbSettings: Partial<SettingsType> | null | undefined,
  policies?: Policy[] | null
): SettingsType => {
  const localVietQR = getStoredVietQRConfig();

  let policyVietQR: any = null;
  if (policies && Array.isArray(policies)) {
    const found = policies.find(p => p.parameter_type === 'payment_vietqr' && p.is_active !== false);
    if (found && found.value) {
      try {
        policyVietQR = typeof found.value === 'string' ? JSON.parse(found.value) : found.value;
      } catch (e) {
        policyVietQR = found.value;
      }
    }
  }

  const effectiveVietQR = extractVietQRConfig(
    policyVietQR || {},
    extractVietQRConfig(localVietQR, dbSettings || {})
  );

  const effectiveRolePermissions = extractRolePermissionsFromPolicies(
    policies,
    dbSettings?.rolePermissions || getStoredRolePermissions()
  );

  const effectiveUserOverrides = extractUserOverridesFromPolicies(
    policies,
    dbSettings?.userOverrides || getStoredUserOverrides()
  );

  let policyPrint: any = null;
  if (policies && Array.isArray(policies)) {
    const foundPrint = policies.find(p => p.parameter_type === 'report_print_settings' && p.is_active !== false);
    if (foundPrint && foundPrint.value) {
      try {
        policyPrint = typeof foundPrint.value === 'string' ? JSON.parse(foundPrint.value) : foundPrint.value;
      } catch (e) {
        policyPrint = foundPrint.value;
      }
    }
  }

  const effectivePrint = extractPrintConfigFromPolicies(
    policies,
    extractPrintConfig(dbSettings || {}, getStoredPrintConfig())
  );

  const effectiveMessageTemplates = extractReminderMessageTemplates(
    dbSettings,
    policies
  );

  // Xác định tên đại lý ưu tiên theo nguồn tùy chỉnh rõ ràng
  let customPrintAgencyName: string | undefined = undefined;
  try {
    const storage = getStorage();
    if (storage) {
      const item = storage.getItem('vss_report_print_settings');
      if (item) {
        const parsed = JSON.parse(item);
        if (parsed?.agencyName) customPrintAgencyName = parsed.agencyName.trim();
      }
    }
  } catch {}
  if (policyPrint?.agencyName) {
    customPrintAgencyName = policyPrint.agencyName.trim();
  }
  if (dbSettings?.agencyName || dbSettings?.agency_name) {
    customPrintAgencyName = (dbSettings.agencyName || dbSettings.agency_name)?.trim();
  }

  const effectiveAgencyName = 
    customPrintAgencyName || 
    effectiveVietQR.agencyName || 
    DEFAULT_REPORT_PRINT_CONFIG.agencyName;

  const effectiveParentAgencyName = 
    effectivePrint.parentAgencyName || 
    dbSettings?.parentAgencyName || 
    DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName;

  const effectiveManagerName = 
    effectivePrint.managerName || 
    dbSettings?.managerName || 
    DEFAULT_REPORT_PRINT_CONFIG.managerName;

  const effectiveReportLocation = 
    effectivePrint.reportLocation || 
    dbSettings?.reportLocation || 
    DEFAULT_REPORT_PRINT_CONFIG.reportLocation;

  const effectiveManagerTitle = 
    effectivePrint.managerTitle || 
    dbSettings?.managerTitle || 
    DEFAULT_REPORT_PRINT_CONFIG.managerTitle;

  const effectiveCreatorTitle = 
    effectivePrint.creatorTitle || 
    dbSettings?.creatorTitle || 
    DEFAULT_REPORT_PRINT_CONFIG.creatorTitle;

  const effectiveControllerTitle = 
    effectivePrint.controllerTitle || 
    dbSettings?.controllerTitle || 
    DEFAULT_REPORT_PRINT_CONFIG.controllerTitle;

  return {
    ...DEFAULT_VIETQR_CONFIG,
    ...effectiveVietQR,
    ...DEFAULT_REPORT_PRINT_CONFIG,
    ...effectivePrint,
    ...(dbSettings || {}),
    rolePermissions: effectiveRolePermissions,
    userOverrides: effectiveUserOverrides,
    // Đảm bảo tên đại lý và thông tin ngân hàng được bảo toàn
    agencyName: effectiveAgencyName,
    agencyCode: effectiveVietQR.agencyCode,
    bankBin: effectiveVietQR.bankBin,
    bankId: effectiveVietQR.bankId,
    bankName: effectiveVietQR.bankName,
    accountNumber: effectiveVietQR.accountNumber,
    accountNo: effectiveVietQR.accountNumber,
    accountHolder: effectiveVietQR.accountHolder,
    accountName: effectiveVietQR.accountHolder,
    qrTemplate: effectiveVietQR.qrTemplate,
    // Thuộc tính cấu hình in ấn
    parentAgencyName: effectiveParentAgencyName,
    managerName: effectiveManagerName,
    reportLocation: effectiveReportLocation,
    controllerName: effectivePrint.controllerName ?? dbSettings?.controllerName ?? '',
    managerTitle: effectiveManagerTitle,
    creatorTitle: effectiveCreatorTitle,
    controllerTitle: effectiveControllerTitle,
    // Cấu hình mẫu tin nhắn đôn đốc & kịch bản thu phí
    reminder_message_templates: effectiveMessageTemplates,
    reminderMessageTemplates: effectiveMessageTemplates,
    // Alias tương thích
    agency_name: effectiveAgencyName,
    agency_code: effectiveVietQR.agencyCode,
    bank_bin: effectiveVietQR.bankBin,
    bank_name: effectiveVietQR.bankName,
    account_number: effectiveVietQR.accountNumber,
    account_holder: effectiveVietQR.accountHolder,
    qr_template: effectiveVietQR.qrTemplate,
    bank_account: effectiveVietQR.accountNumber,
    bank_owner: effectiveVietQR.accountHolder
  };
};

/**
 * Chuẩn hóa dữ liệu trước khi gửi sang bảng settings của Supabase PostgreSQL
 * Chỉ giữ lại các cột đã biết và chưa bị đánh dấu unsupported
 */
export const sanitizeSettingsForDb = (settings: Partial<SettingsType>): any => {
  if (!settings || typeof settings !== 'object') return {};
  const clean: any = {};
  for (const [key, val] of Object.entries(settings)) {
    if (key === 'id') continue;
    if (val === undefined) continue;
    if (KNOWN_SETTINGS_COLUMNS.has(key) && !unsupportedSettingsColumns.has(key)) {
      clean[key] = val;
    }
  }
  return clean;
};

/**
 * Xử lý lỗi PostgREST PGRST204 khi cập nhật bảng settings
 */
export const handleSettingsSchemaCacheMissingColumn = (error: any, payload: any): boolean => {
  if (!error) return false;
  const errorMsg = error.message || '';
  if (
    error.code === 'PGRST204' ||
    errorMsg.includes('in the schema cache') ||
    errorMsg.includes('Could not find the')
  ) {
    const match = errorMsg.match(/Could not find the '([^']+)' column/);
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`[Supabase Settings Schema Fallback] Database chưa có cột '${missingCol}', tự động loại trừ và ghi nhớ.`);
      unsupportedSettingsColumns.add(missingCol);
      if (payload && typeof payload === 'object') {
        delete payload[missingCol];
      }
      return true;
    }
  }
  return false;
};
