import { SettingsType, Policy } from '../context/types';
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
  source: Partial<SettingsType>,
  fallback?: Partial<SettingsType>
): VietQRConfig => {
  const base = fallback || {};
  return {
    agencyName: (source.agencyName ?? source.agency_name ?? base.agencyName ?? base.agency_name ?? DEFAULT_VIETQR_CONFIG.agencyName)?.trim(),
    agencyCode: (source.agencyCode ?? source.agency_code ?? base.agencyCode ?? base.agency_code ?? DEFAULT_VIETQR_CONFIG.agencyCode)?.trim(),
    bankBin: (source.bankBin ?? source.bank_bin ?? base.bankBin ?? base.bank_bin ?? DEFAULT_VIETQR_CONFIG.bankBin)?.trim(),
    bankId: (source.bankId ?? source.bank_id ?? base.bankId ?? base.bank_id ?? DEFAULT_VIETQR_CONFIG.bankId)?.trim(),
    bankName: (source.bankName ?? source.bank_name ?? base.bankName ?? base.bank_name ?? DEFAULT_VIETQR_CONFIG.bankName)?.trim(),
    accountNumber: (source.accountNumber ?? source.accountNo ?? source.account_number ?? source.bank_account ?? base.accountNumber ?? base.account_number ?? base.bank_account ?? DEFAULT_VIETQR_CONFIG.accountNumber)?.trim(),
    accountNo: (source.accountNo ?? source.accountNumber ?? source.account_number ?? source.bank_account ?? base.accountNo ?? base.accountNumber ?? base.bank_account ?? DEFAULT_VIETQR_CONFIG.accountNo)?.trim(),
    accountHolder: (source.accountHolder ?? source.accountName ?? source.account_holder ?? source.bank_owner ?? base.accountHolder ?? base.account_holder ?? base.bank_owner ?? DEFAULT_VIETQR_CONFIG.accountHolder)?.trim(),
    accountName: (source.accountName ?? source.accountHolder ?? source.account_holder ?? source.bank_owner ?? base.accountName ?? base.account_holder ?? base.bank_owner ?? DEFAULT_VIETQR_CONFIG.accountName)?.trim(),
    qrTemplate: source.qrTemplate ?? source.qr_template ?? (source as any).template ?? base.qrTemplate ?? base.qr_template ?? DEFAULT_VIETQR_CONFIG.qrTemplate
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
  parentAgencyName?: string;
  agencyName?: string;
  managerName?: string;
  reportLocation?: string;
  controllerName?: string;
  managerTitle?: string;
  creatorTitle?: string;
  controllerTitle?: string;
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
