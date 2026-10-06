import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { RecordType, StaffType, SettingsType, Policy, AuditLogType, CustomerType } from './types';
import { CustomerStatus } from '../utils/customerStatus';
import { withRetry } from '../utils/networkHelper';
import { 
  unsupportedSettingsColumns, 
  KNOWN_SETTINGS_COLUMNS, 
  getStoredVietQRConfig, 
  extractVietQRConfig, 
  hasVietQRFields, 
  mergeSettingsWithVietQR, 
  sanitizeSettingsForDb, 
  handleSettingsSchemaCacheMissingColumn 
} from '../utils/settingsHelper';

import { 
  UIProvider, 
  useUIContext, 
  AlertModalConfig, 
  PromptModalConfig,
  ToastConfig,
  ToastType,
  ToastAction,
  AlertType,
  GlobalRegisterModalState 
} from './providers/UIContext';
import { AdminProvider, useAdminContext } from './providers/AdminContext';
import { DataProvider, useDataContext } from './providers/DataContext';
import { parseToIsoDate, parseToIsoMonthDate, formatMonthVN } from '../utils/dateUtils';

export * from './types';
export {
  unsupportedSettingsColumns,
  KNOWN_SETTINGS_COLUMNS,
  getStoredVietQRConfig,
  extractVietQRConfig,
  hasVietQRFields,
  mergeSettingsWithVietQR,
  sanitizeSettingsForDb,
  handleSettingsSchemaCacheMissingColumn
};
export { usePolicy, PolicyProvider } from './PolicyContext';
export { useFeedback, FeedbackProvider } from './FeedbackContext';
export { useAuth, AuthProvider } from './AuthContext';
export { useUI, UIProvider, useUIContext } from './providers/UIContext';
export { AdminProvider, useAdminContext } from './providers/AdminContext';
export { DataProvider, useDataContext } from './providers/DataContext';
export { withRetry };

export interface AppContextType {
  records: RecordType[];
  customers: CustomerType[];
  staff: StaffType[];
  settings: SettingsType;
  policies: Policy[];
  auditLogs: AuditLogType[];

  currentUser: StaffType | null;
  setCurrentUser: (user: StaffType | null) => void;
  isAdmin: boolean;

  adminTab: string;
  setAdminTab: (tab: string) => void;

  crmFilter: string;
  setCrmFilter: (filter: string) => void;

  addRecord: (record: Omit<RecordType, 'id'>) => Promise<RecordType | null>;
  bulkPutRecords: (records: RecordType[]) => Promise<boolean>;
  updateRecord: (id: number, record: Partial<RecordType>) => Promise<boolean>;
  updateCustomerStatus: (recordId: number, newStatus: CustomerStatus, reason?: string | undefined) => Promise<boolean>;
  updateCustomerParticipation: (
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string | undefined;
    }
  ) => Promise<boolean>;
  deleteRecord: (id: number) => Promise<boolean>;
  bulkDeleteRecords: (ids: number[]) => Promise<boolean>;
  deleteCustomer: (customerKey: string) => Promise<boolean>;
  cancelRecordWithClawback: (recordId: number, reason: string, currentUserRole?: string | undefined) => Promise<boolean>;

  fetchCustomerTransactions: (customerIdOrKey: string) => Promise<RecordType[]>;
  fetchCustomerByCode: (code: string) => Promise<any>;

  addStaff: (staff: StaffType) => Promise<boolean>;
  updateStaff: (id: string, staff: Partial<StaffType>) => Promise<boolean>;
  deleteStaff: (id: string) => Promise<boolean>;

  addPolicy: (policy: Omit<Policy, 'id'>) => Promise<boolean>;
  updatePolicy: (id: number, policy: Partial<Policy>) => Promise<boolean>;
  deletePolicy: (id: number) => Promise<boolean>;
  activatePolicy: (id: number, parameterType: string) => Promise<boolean>;
  syncDefaultPolicies?: (() => Promise<boolean>) | undefined;

  updateSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  setSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  addAuditLog: (action: string, details: string) => Promise<void>;

  toastMessage: string | null;
  toastConfig: ToastConfig | null;
  toasts?: ToastConfig[] | undefined;
  showToast: (msg: string, type?: ToastType | string | { type?: ToastType; action?: ToastAction; duration?: number; title?: string; badge?: string; playSound?: boolean }) => void;
  hideToast?: ((id?: string) => void) | undefined;

  alertModalConfig: AlertModalConfig | null;
  showAlert: (title: string, message: string, onConfirmOrType?: (() => void) | AlertType | string, explicitType?: AlertType) => void;
  closeAlert: () => void;

  promptModalConfig: PromptModalConfig | null;
  showPrompt: (config: Omit<PromptModalConfig, 'isOpen'>) => void;
  closePrompt: () => void;

  globalRegisterModal: GlobalRegisterModalState;
  setGlobalRegisterModal: React.Dispatch<React.SetStateAction<GlobalRegisterModalState>>;

  refreshData: () => void;
  refreshTrigger: number;
  isAuthReady: boolean;
}

// Bộ nhớ đệm lưu các cột không tồn tại trên bảng records thực tế (phòng ngừa lỗi PostgREST PGRST204)
export const unsupportedRecordColumns = new Set<string>();

export const sanitizeRecordForDb = (record: any, isUpdate = false): any => {
  if (!record || typeof record !== 'object') return record;
  const clean: any = { ...record };
  if (isUpdate) {
    delete clean.id; // Không bao giờ cập nhật primary key 'id'
  }
  delete clean.bhxhCu; // Thuộc tính phụ chỉ dùng ở giao diện
  delete clean.staff_id; // Cột chuẩn trong DB là staffId

  // Chuẩn hóa oldBhxh -> old_bhxh (cột chuẩn duy nhất trong CSDL PostgreSQL Supabase)
  if (clean.oldBhxh !== undefined && (clean.old_bhxh === undefined || clean.old_bhxh === '')) {
    clean.old_bhxh = clean.oldBhxh;
  }
  delete clean.oldBhxh; // Xóa key camelCase để tránh lỗi PostgREST PGRST204 khi DB đã drop cột "oldBhxh"

  // Đồng bộ ngày tháng sang chuẩn ISO Date YYYY-MM-DD cho PostgreSQL (tránh lỗi múi giờ)
  if (clean.dob) clean.dob = parseToIsoDate(clean.dob) || clean.dob;
  if (clean.effectiveDate) clean.effectiveDate = parseToIsoDate(clean.effectiveDate) || clean.effectiveDate;
  if (clean.effective_date) clean.effective_date = parseToIsoDate(clean.effective_date) || clean.effective_date;
  if (clean.targetDate) clean.targetDate = parseToIsoDate(clean.targetDate) || clean.targetDate;
  if (clean.target_date) clean.target_date = parseToIsoDate(clean.target_date) || clean.target_date;
  if (clean.nextPayment) clean.nextPayment = parseToIsoDate(clean.nextPayment) || clean.nextPayment;
  if (clean.next_payment) clean.next_payment = parseToIsoDate(clean.next_payment) || clean.next_payment;
  if (clean.submittedDate) clean.submittedDate = parseToIsoDate(clean.submittedDate) || clean.submittedDate;
  if (clean.submitted_date) clean.submitted_date = parseToIsoDate(clean.submitted_date) || clean.submitted_date;
  if (clean.decisionDate) clean.decisionDate = parseToIsoDate(clean.decisionDate) || clean.decisionDate;
  if (clean.decision_date) clean.decision_date = parseToIsoDate(clean.decision_date) || clean.decision_date;

  // Tự động gán from_month_date & to_month_date (ngày 01 của tháng)
  const fMonth = clean.fromMonth || clean.from_month;
  if (fMonth && !clean.from_month_date) {
    const fDate = parseToIsoMonthDate(fMonth);
    if (fDate) clean.from_month_date = fDate;
  }
  const tMonth = clean.toMonth || clean.to_month;
  if (tMonth && !clean.to_month_date) {
    const tDate = parseToIsoMonthDate(tMonth);
    if (tDate) clean.to_month_date = tDate;
  }

  // Loại bỏ các cột đã biết là chưa được tạo trong database
  unsupportedRecordColumns.forEach(col => {
    delete clean[col];
  });

  // Loại bỏ các trường mang giá trị undefined
  Object.keys(clean).forEach(k => {
    if (clean[k] === undefined) delete clean[k];
  });
  return clean;
};

export const sanitizeRecordForPostgres = (record: any): any => {
  return sanitizeRecordForDb(record, false);
};

export const formatRecordFromDb = (raw: any): RecordType => {
  if (!raw) return raw;
  const copy = { ...raw };
  const o = copy.old_bhxh || copy.oldBhxh;
  if (o) {
    copy.old_bhxh = o;
    copy.oldBhxh = o;
  }
  // Đồng bộ kỳ đóng bảo hiểm
  if (!copy.fromMonth && copy.from_month) {
    copy.fromMonth = formatMonthVN(copy.from_month);
  } else if (!copy.fromMonth && copy.from_month_date) {
    copy.fromMonth = formatMonthVN(copy.from_month_date);
  }
  if (!copy.toMonth && copy.to_month) {
    copy.toMonth = formatMonthVN(copy.to_month);
  } else if (!copy.toMonth && copy.to_month_date) {
    copy.toMonth = formatMonthVN(copy.to_month_date);
  }
  return copy as RecordType;
};

export const handleSchemaCacheMissingColumn = (error: any, payload: any): boolean => {
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
      console.warn(`[Supabase Schema Fallback] Database chưa có cột '${missingCol}', tự động loại trừ và ghi nhớ.`);
      unsupportedRecordColumns.add(missingCol);
      if (Array.isArray(payload)) {
        payload.forEach(item => {
          if (item && typeof item === 'object') delete item[missingCol];
        });
      } else if (payload && typeof payload === 'object') {
        delete payload[missingCol];
      }
      return true;
    }
  }
  return false;
};

export const formatPolicyFromDb = (raw: any): Policy => ({
  id: raw.id,
  name: raw.name,
  parameter_type: raw.parameter_type,
  value: raw.value,
  effective_date: raw.effective_date,
  is_active: raw.is_active,
  created_at: raw.created_at,
  created_by: raw.created_by,
  description: raw.notes || raw.description || '',
  notes: raw.notes || raw.description || ''
});

export const sanitizePolicyForDb = (policy: Partial<Policy>) => {
  const payload: any = {};
  if (policy.name !== undefined) payload.name = policy.name;
  if (policy.parameter_type !== undefined) payload.parameter_type = policy.parameter_type;
  if (policy.value !== undefined) payload.value = policy.value;
  if (policy.effective_date !== undefined) payload.effective_date = policy.effective_date;
  if (policy.is_active !== undefined) payload.is_active = policy.is_active;
  const notesVal = policy.notes ?? policy.description;
  if (notesVal !== undefined) {
    payload.notes = notesVal;
  }
  return payload;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const AppContextFacadeBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
  const data = useDataContext();
  const admin = useAdminContext();
  const ui = useUIContext();

  const value = useMemo<AppContextType>(() => ({
    // DataContext
    records: data.records,
    customers: data.customers,
    policies: data.policies,
    addRecord: data.addRecord,
    bulkPutRecords: data.bulkPutRecords,
    updateRecord: data.updateRecord,
    updateCustomerStatus: data.updateCustomerStatus,
    updateCustomerParticipation: data.updateCustomerParticipation,
    deleteRecord: data.deleteRecord,
    bulkDeleteRecords: data.bulkDeleteRecords,
    deleteCustomer: data.deleteCustomer,
    cancelRecordWithClawback: data.cancelRecordWithClawback,
    fetchCustomerTransactions: data.fetchCustomerTransactions,
    fetchCustomerByCode: data.fetchCustomerByCode,
    addPolicy: data.addPolicy,
    updatePolicy: data.updatePolicy,
    deletePolicy: data.deletePolicy,
    activatePolicy: data.activatePolicy,
    syncDefaultPolicies: data.syncDefaultPolicies,
    refreshData: data.refreshData,
    refreshTrigger: data.refreshTrigger,

    // AdminContext
    currentUser: admin.currentUser,
    setCurrentUser: admin.setCurrentUser,
    isAdmin: admin.isAdmin,
    staff: admin.staff,
    settings: admin.settings,
    auditLogs: admin.auditLogs,
    addStaff: admin.addStaff,
    updateStaff: admin.updateStaff,
    deleteStaff: admin.deleteStaff,
    updateSettings: admin.updateSettings,
    setSettings: admin.setSettings,
    addAuditLog: admin.addAuditLog,
    isAuthReady: admin.isAuthReady,

    // UIContext
    adminTab: ui.adminTab,
    setAdminTab: ui.setAdminTab,
    crmFilter: ui.crmFilter,
    setCrmFilter: ui.setCrmFilter,
    toastMessage: ui.toastMessage,
    toastConfig: ui.toastConfig,
    toasts: ui.toasts,
    showToast: ui.showToast,
    hideToast: ui.hideToast,
    alertModalConfig: ui.alertModalConfig,
    showAlert: ui.showAlert,
    closeAlert: ui.closeAlert,
    promptModalConfig: ui.promptModalConfig,
    showPrompt: ui.showPrompt,
    closePrompt: ui.closePrompt,
    globalRegisterModal: ui.globalRegisterModal,
    setGlobalRegisterModal: ui.setGlobalRegisterModal,
  }), [data, admin, ui]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <UIProvider>
      <AdminProvider>
        <DataProvider>
          <AppContextFacadeBridge>
            {children}
          </AppContextFacadeBridge>
        </DataProvider>
      </AdminProvider>
    </UIProvider>
  );
};

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
