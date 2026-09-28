import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { StaffType, SettingsType, AuditLogType } from '../types';
import { supabase } from '../../lib/supabase';
import { logSecurityAudit } from '../../utils/security';
import { DEFAULT_SYSTEM_POLICIES } from '../../data/defaultPolicies';
import {
  mergeSettingsWithVietQR,
  hasVietQRFields,
  extractVietQRConfig,
  sanitizeSettingsForDb,
  handleSettingsSchemaCacheMissingColumn,
  storeRolePermissions,
  storeUserOverrides,
  hasPrintSettingsFields,
  extractPrintConfig,
  storePrintConfig
} from '../../utils/settingsHelper';
import { sanitizeRolePermissions, sanitizeUserOverrides } from '../../utils/permissions';
import { Policy } from '../AppContext';

export interface AdminContextType {
  currentUser: StaffType | null;
  setCurrentUser: (user: StaffType | null) => void;
  isAdmin: boolean;
  staff: StaffType[];
  settings: SettingsType;
  auditLogs: AuditLogType[];
  addStaff: (staff: StaffType) => Promise<boolean>;
  updateStaff: (id: string, staff: Partial<StaffType>) => Promise<boolean>;
  deleteStaff: (id: string) => Promise<boolean>;
  updateSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  setSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  addAuditLog: (action: string, details: string) => Promise<void>;
  isAuthReady: boolean;
  refreshAdminData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: ReactNode; policies?: Policy[] }> = ({ children, policies = DEFAULT_SYSTEM_POLICIES }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [staffLive, setStaffLive] = useState<StaffType[]>([]);
  const [auditLogsLive, setAuditLogsLive] = useState<AuditLogType[]>([]);
  const [settingsLive, setSettingsLive] = useState<SettingsType>(() => {
    const baseInitial: SettingsType = { 
      id: 1, commBHXHNew: 5, commBHXHRenew: 3, commBHYTNew: 5, commBHYTRenew: 3, commBHXH: 5, commBHYT: 5,
      investmentRate: 0.31,
      baseSalary: 2340000,
      povertyStandard: 1500000,
      cpiIndex: { "2026": 1.0, "2025": 1.0, "2024": 1.03, "2023": 1.07, "2022": 1.11, "2021": 1.14, "2020": 1.16, "2019": 1.20, "2018": 1.23, "2017": 1.28, "2016": 1.32, "2015": 1.36, "2014": 1.36, "2013": 1.42, "2012": 1.51, "2011": 1.65, "2010": 1.96, "2009": 2.14, "2008": 2.29, "2007": 2.81, "2006": 3.05, "2005": 3.27, "2004": 3.54, "2003": 3.81, "2002": 3.94, "2001": 4.09, "2000": 4.07, "1999": 4.01, "1998": 4.18, "1997": 4.50, "1996": 4.91, "1994": 5.81 }
    };
    return mergeSettingsWithVietQR(baseInitial, policies);
  });

  // Không lưu trữ hoặc khôi phục currentUser từ localStorage để chống giả mạo quyền (Client-Side Role Tampering)
  const [currentUser, setCurrentUserState] = useState<StaffType | null>(null);

  // setCurrentUser chỉ cập nhật trên bộ nhớ RAM (React State), tuyệt đối không lưu tệp plain-text vào localStorage
  const setCurrentUser = useCallback((user: StaffType | null) => {
    setCurrentUserState(user);
    if (typeof window !== 'undefined') {
      try {
        // Chủ động dọn dẹp khóa cũ nếu còn sót lại từ các phiên bản trước
        window.localStorage.removeItem('vss_current_user');
        window.localStorage.removeItem('bhxh_current_user');
      } catch {
        // Bỏ qua nếu môi trường chặn truy cập storage
      }
    }
  }, []);

  // isAdmin được tính toán độc quyền dựa trên dữ liệu định danh đã được kiểm chứng bởi Server
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = (currentUser.role || '').toLowerCase().trim();
    return r === 'admin' || r === 'quản trị viên' || r === 'quan tri vien' || r === 'quản lý' || r === 'quan ly';
  }, [currentUser]);

  // Thẩm tra xác thực trực tiếp với Supabase Server qua JWT (Zero-Trust Frontend)
  const verifyAndSyncSession = useCallback(async () => {
    try {
      // Dọn dẹp cache rác cũ trên trình duyệt
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('vss_current_user');
          window.localStorage.removeItem('bhxh_current_user');
        } catch {
          // Ignored
        }
      }

      // 1. Kiểm tra session hợp lệ trực tiếp với Supabase Auth Server (chữ ký số mật mã)
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setCurrentUserState(null);
        return;
      }

      // 2. Tra cứu hồ sơ nhân sự chính thức từ Server qua RPC get_current_staff_profile
      let staffUser: StaffType | null = null;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('get_current_staff_profile');
        if (!rpcErr && rpcRes?.success && rpcRes?.profile) {
          staffUser = rpcRes.profile;
        }
      } catch (rpcEx) {
        console.warn('[AdminContext] RPC get_current_staff_profile fallback:', rpcEx);
      }

      // 3. Fallback: Nếu RPC chưa nạp hoặc trả về null, tra cứu theo auth_user_id
      if (!staffUser) {
        const { data: byAuthId } = await supabase
          .from('staff')
          .select('id, name, email, role, status, staffCode, area, username')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (byAuthId) {
          staffUser = byAuthId as StaffType;
        } else if (user.email) {
          const userEmail = user.email.trim().toLowerCase();
          const { data: byEmail } = await supabase
            .from('staff')
            .select('id, name, email, role, status, staffCode, area, username')
            .ilike('email', userEmail)
            .maybeSingle();

          if (byEmail) {
            staffUser = byEmail as StaffType;
            // Tự động liên kết auth_user_id vào hồ sơ nhân sự
            await supabase.from('staff').update({ auth_user_id: user.id }).eq('id', byEmail.id);
          }
        }
      }

      // 4. Kiểm tra trạng thái hoạt động của nhân viên
      if (staffUser) {
        if (staffUser.status === 'Tạm khóa') {
          console.warn('[AdminContext] Tài khoản nhân viên đang bị tạm khóa. Đăng xuất ngay.');
          await supabase.auth.signOut();
          setCurrentUserState(null);
        } else {
          const { password, ...safeStaff } = staffUser as any;
          setCurrentUserState(safeStaff as StaffType);
        }
      } else {
        console.warn('[AdminContext] Người dùng Supabase Auth chưa được phân quyền trong bảng staff.');
        setCurrentUserState(null);
      }
    } catch (err) {
      console.error('[AdminContext] Lỗi xác thực phiên làm việc:', err);
      setCurrentUserState(null);
    } finally {
      setIsAuthReady(true);
    }
  }, []);

  // Lắng nghe sự kiện xác thực thời gian thực từ Supabase Auth
  useEffect(() => {
    verifyAndSyncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setCurrentUserState(null);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem('vss_current_user');
            window.localStorage.removeItem('bhxh_current_user');
          } catch {
            // Ignored
          }
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        await verifyAndSyncSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [verifyAndSyncSession]);

  const fetchAdminData = useCallback(async () => {
    try {
      const [settingsRes, staffRes, logsRes] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('staff').select('*'),
        isAdmin ? supabase.from('auditlogs').select('*').order('timestamp', { ascending: false }).limit(500) : Promise.resolve({ data: [] })
      ]);

      if (settingsRes.data) {
        setSettingsLive(mergeSettingsWithVietQR(settingsRes.data, policies));
      }

      if (staffRes.data && staffRes.data.length > 0) {
        const cleanedStaff = (staffRes.data as any[]).map(s => {
          const { password, ...safeStaff } = s;
          return safeStaff as StaffType;
        });
        setStaffLive(cleanedStaff);
      } else if (currentUser) {
        setStaffLive([currentUser]);
      }

      if (logsRes.data) {
        setAuditLogsLive(logsRes.data as AuditLogType[]);
      }
    } catch (err) {
      console.warn('[AdminContext] fetchAdminData error:', err);
    }
  }, [isAdmin, policies, currentUser]);

  useEffect(() => {
    if (isAuthReady) {
      fetchAdminData();
    }
  }, [fetchAdminData, isAuthReady]);

  const addStaff = useCallback(async (newStaffData: StaffType): Promise<boolean> => {
    try {
      const { error } = await supabase.from('staff').insert([newStaffData]);
      if (error) throw error;
      await fetchAdminData();
      return true;
    } catch (error: any) {
      console.error('Error adding staff:', error);
      throw error;
    }
  }, [fetchAdminData]);

  const updateStaff = useCallback(async (id: string, updatedFields: Partial<StaffType>): Promise<boolean> => {
    try {
      const { error } = await supabase.from('staff').update(updatedFields).eq('id', id);
      if (error) throw error;
      await fetchAdminData();
      return true;
    } catch (error: any) {
      console.error('Error updating staff:', error);
      return false;
    }
  }, [fetchAdminData]);

  const deleteStaff = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      await fetchAdminData();
      return true;
    } catch (error: any) {
      console.error('Error deleting staff:', error);
      return false;
    }
  }, [fetchAdminData]);

  const updateSettings = useCallback(async (updatedFields: Partial<SettingsType>): Promise<boolean> => {
    try {
      const containsVietQR = hasVietQRFields(updatedFields);
      let vietQRConfig: any = null;

      if (containsVietQR) {
        vietQRConfig = extractVietQRConfig(updatedFields, settingsLive);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('vss_vietqr_agency_config', JSON.stringify(vietQRConfig));
          }
        } catch (lsErr) {
          console.warn('[AdminContext] Lưu localStorage VietQR thất bại:', lsErr);
        }

        try {
          const existingPolicy = policies.find(p => p.parameter_type === 'payment_vietqr');
          if (existingPolicy?.id) {
            await supabase.from('policies').update({
              value: vietQRConfig,
              is_active: true
            }).eq('id', existingPolicy.id);
          } else {
            await supabase.from('policies').insert([{
              parameter_type: 'payment_vietqr',
              name: 'Cấu hình VietQR Đại lý',
              value: vietQRConfig,
              effective_date: '2026-01-01',
              description: 'Cấu hình tài khoản ngân hàng thụ hưởng VietQR NAPAS 247 của Đại lý',
              notes: 'Cấu hình tài khoản ngân hàng thụ hưởng VietQR NAPAS 247 của Đại lý',
              is_active: true
            }]);
          }
        } catch (policyErr) {
          console.warn('[AdminContext] Lưu policy payment_vietqr:', policyErr);
        }
      }

      // Xử lý lưu RBAC Role Permissions vào bảng policies và settings nếu có
      let cleanRolePerms: any = null;
      if (updatedFields.rolePermissions) {
        cleanRolePerms = sanitizeRolePermissions(updatedFields.rolePermissions);
        storeRolePermissions(cleanRolePerms);
        (updatedFields as any).role_permissions = cleanRolePerms;

        try {
          const existingPolicy = policies.find(p => p.parameter_type === 'rbac_role_permissions');
          if (existingPolicy?.id) {
            await supabase.from('policies').update({
              value: cleanRolePerms,
              is_active: true
            }).eq('id', existingPolicy.id);
          } else {
            await supabase.from('policies').insert([{
              parameter_type: 'rbac_role_permissions',
              name: 'Bảng Phân Quyền Vai Trò RBAC',
              value: cleanRolePerms,
              effective_date: '2026-01-01',
              description: 'Cấu hình phân quyền vai trò nhân sự và cán bộ đại lý',
              notes: 'Ma trận phân quyền vai trò chi tiết quản trị viên thiết lập',
              is_active: true
            }]);
          }
        } catch (rbacErr) {
          console.warn('[AdminContext] Lưu policy rbac_role_permissions:', rbacErr);
        }
      }

      // Xử lý lưu RBAC User Overrides vào bảng policies, settings và bảng staff nếu có
      let cleanUserOverrides: any = null;
      if (updatedFields.userOverrides) {
        cleanUserOverrides = sanitizeUserOverrides(updatedFields.userOverrides);
        storeUserOverrides(cleanUserOverrides);
        (updatedFields as any).user_overrides = cleanUserOverrides;

        try {
          const existingPolicy = policies.find(p => p.parameter_type === 'rbac_user_overrides');
          if (existingPolicy?.id) {
            await supabase.from('policies').update({
              value: cleanUserOverrides,
              is_active: true
            }).eq('id', existingPolicy.id);
          } else {
            await supabase.from('policies').insert([{
              parameter_type: 'rbac_user_overrides',
              name: 'Phân Quyền Đặc Cách Riêng Theo Nhân Viên',
              value: cleanUserOverrides,
              effective_date: '2026-01-01',
              description: 'Cấu hình phân quyền đặc cách riêng (User Overrides) cho từng cán bộ thu',
              notes: 'Quyền cấp thêm hoặc chặn riêng cho từng tài khoản nhân viên',
              is_active: true
            }]);
          }

          // Đồng bộ đặc cách riêng trực tiếp vào bảng staff cho từng nhân viên
          const staffEntries = Object.entries(cleanUserOverrides);
          for (const [staffId, override] of staffEntries) {
            const ov = override as { granted?: string[]; revoked?: string[] };
            await supabase.from('staff').update({
              custom_permissions: ov?.granted || [],
              revoked_permissions: ov?.revoked || []
            }).eq('id', staffId);
          }
        } catch (overrideErr) {
          console.warn('[AdminContext] Lưu policy rbac_user_overrides / staff:', overrideErr);
        }
      }

      // Gọi RPC save_rbac_permissions nếu có cập nhật quyền
      if (cleanRolePerms || cleanUserOverrides) {
        try {
          await supabase.rpc('save_rbac_permissions', {
            p_role_permissions: cleanRolePerms || null,
            p_user_overrides: cleanUserOverrides || null
          });
        } catch (rpcErr) {
          // Fallback qua direct update bảng settings và policies đã thực hiện
        }
      }

      // Xử lý lưu Report Print Settings vào bảng policies nếu có
      if (hasPrintSettingsFields(updatedFields) || updatedFields.agencyName) {
        const printConfig = extractPrintConfig(updatedFields, settingsLive);
        storePrintConfig(printConfig);

        try {
          const existingPolicy = policies.find(p => p.parameter_type === 'report_print_settings');
          if (existingPolicy?.id) {
            await supabase.from('policies').update({
              value: printConfig,
              is_active: true
            }).eq('id', existingPolicy.id);
          } else {
            await supabase.from('policies').insert([{
              parameter_type: 'report_print_settings',
              name: 'Cấu hình Thông số In ấn & Báo cáo',
              value: printConfig,
              effective_date: '2026-01-01',
              description: 'Cấu hình thông tin cơ quan cấp trên, tên đại lý thu, thủ trưởng đơn vị và các chức danh in biểu mẫu',
              notes: 'Thông số in ấn và mẫu biểu chuẩn Nghị định 30/2020/NĐ-CP',
              is_active: true
            }]);
          }
        } catch (printErr) {
          console.warn('[AdminContext] Lưu policy report_print_settings:', printErr);
        }
      }

      const dbSettingsPayload = sanitizeSettingsForDb(updatedFields);

      if (Object.keys(dbSettingsPayload).length > 0) {
        let attempts = 0;
        while (attempts < 5) {
          attempts++;
          const { error } = await supabase
            .from('settings')
            .update(dbSettingsPayload)
            .eq('id', 1);

          if (!error) break;

          const handled = handleSettingsSchemaCacheMissingColumn(error, dbSettingsPayload);
          if (handled && Object.keys(dbSettingsPayload).length > 0) {
            continue;
          }
          if (handled && Object.keys(dbSettingsPayload).length === 0) {
            break;
          }
          throw error;
        }
      }

      setSettingsLive(prev => {
        const next = {
          ...prev,
          ...updatedFields,
          ...(vietQRConfig || {})
        };
        return mergeSettingsWithVietQR(next, policies);
      });

      await fetchAdminData();
      return true;
    } catch (error: any) {
      console.error('Error updating settings:', error);
      return false;
    }
  }, [fetchAdminData, policies, settingsLive]);

  const addAuditLog = useCallback(async (action: string, details: string) => {
    try {
      await logSecurityAudit(action, details);
    } catch (err) {
      console.warn('[AdminContext] addAuditLog warning:', err);
    }
  }, []);

  const value = useMemo<AdminContextType>(() => ({
    currentUser,
    setCurrentUser,
    isAdmin,
    staff: staffLive,
    settings: settingsLive,
    auditLogs: auditLogsLive,
    addStaff,
    updateStaff,
    deleteStaff,
    updateSettings,
    setSettings: updateSettings,
    addAuditLog,
    isAuthReady,
    refreshAdminData: fetchAdminData
  }), [
    currentUser,
    setCurrentUser,
    isAdmin,
    staffLive,
    settingsLive,
    auditLogsLive,
    addStaff,
    updateStaff,
    deleteStaff,
    updateSettings,
    addAuditLog,
    isAuthReady,
    fetchAdminData
  ]);

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};

export const useAdminContext = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdminContext must be used within an AdminProvider');
  }
  return context;
};
