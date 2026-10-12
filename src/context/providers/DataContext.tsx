import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { RecordType, CustomerType } from '../types';
import type { CustomerStatus } from '../../utils/customerStatus';
import { DEFAULT_SYSTEM_POLICIES } from '../../data/defaultPolicies';
import { formatPolicyFromDb, Policy } from '../AppContext';
import { policyService, realtimeService } from '../../services';
import { useAdminContext } from './AdminContext';
import { useUIContext } from './UIContext';
import { useRecordsState } from '../../hooks/useRecordsState';
import { useCustomersState } from '../../hooks/useCustomersState';

export interface DataContextType {
  records: RecordType[];
  customers: CustomerType[];
  policies: Policy[];
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
  addPolicy: (policy: Omit<Policy, 'id'>) => Promise<boolean>;
  updatePolicy: (id: number, policy: Partial<Policy>) => Promise<boolean>;
  deletePolicy: (id: number, name?: string) => Promise<boolean>;
  activatePolicy: (id: number, parameterType: string) => Promise<boolean>;
  syncDefaultPolicies?: () => Promise<boolean>;
  refreshData: () => void;
  refreshTrigger: number;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, addAuditLog, isAuthReady } = useAdminContext();
  const { showToast, showAlert } = useUIContext();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [policiesLive, setPoliciesLive] = useState<Policy[]>(DEFAULT_SYSTEM_POLICIES);

  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // 1. Domain Hook cho Records
  const {
    records,
    setRecords,
    fetchRecords,
    addRecord,
    bulkPutRecords,
    updateRecord,
    deleteRecord,
    bulkDeleteRecords,
    cancelRecordWithClawback,
    fetchCustomerTransactions
  } = useRecordsState({
    currentUser,
    isAdmin,
    policies: policiesLive,
    addAuditLog,
    showAlert,
    showToast,
    onRecordChanged: refreshData
  });

  // 2. Domain Hook cho Customers
  const {
    customers,
    setCustomers,
    fetchCustomers,
    updateCustomerStatus,
    updateCustomerParticipation,
    deleteCustomer: deleteCustomerHook,
    fetchCustomerByCode
  } = useCustomersState({
    currentUser,
    isAdmin,
    recordsLive: records,
    addAuditLog,
    showAlert,
    showToast,
    onCustomerChanged: refreshData
  });

  // Xóa khách hàng kèm theo lọc sạch bản ghi bộ nhớ đệm
  const deleteCustomer = useCallback(async (customerKey: string): Promise<boolean> => {
    const success = await deleteCustomerHook(customerKey);
    if (success) {
      setRecords(prev => prev.filter(r => 
        (r as any).customer_key !== customerKey && 
        (r as any).customerKey !== customerKey && 
        r.bhxh !== customerKey && 
        r.cccd !== customerKey && 
        r.phone !== customerKey
      ));
    }
    return success;
  }, [deleteCustomerHook, setRecords]);

  // 3. Quản lý danh sách định danh chính sách đã bị xóa (chống hồi sinh từ DEFAULT_SYSTEM_POLICIES)
  const DELETED_POLICIES_KEY = 'vss_deleted_policy_identifiers';

  const getDeletedIdentifiers = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(DELETED_POLICIES_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  }, []);

  const isPolicyDeleted = useCallback((p: Policy, deletedSet: Set<string>): boolean => {
    if (p.id !== undefined && p.id !== null && deletedSet.has(`id:${p.id}`)) return true;
    if (p.name && deletedSet.has(`name:${p.name.trim().toLowerCase()}`)) return true;
    if (p.name && p.parameter_type && deletedSet.has(`key:${p.parameter_type}-${p.name.trim().toLowerCase()}`)) return true;
    return false;
  }, []);

  // Tải Policies từ Supabase (DB là Single Source of Truth, không tự ý ghép lại các chính sách đã xóa)
  const fetchPolicies = useCallback(async () => {
    try {
      const policiesRes = await policyService.fetchPolicies();
      const policiesData = policiesRes.data;
      const deletedSet = getDeletedIdentifiers();

      if (policiesData && policiesData.length > 0) {
        // CSDL có dữ liệu: Sử dụng trực tiếp danh sách từ CSDL và lọc bỏ các bản ghi đã xóa
        const formatted = policiesData
          .map((rawP: any) => formatPolicyFromDb(rawP))
          .filter(p => !isPolicyDeleted(p, deletedSet));
        setPoliciesLive(formatted);
      } else {
        // Fallback về DEFAULT_SYSTEM_POLICIES chỉ khi CSDL hoàn toàn trống hoặc mạng offline
        const fallback = DEFAULT_SYSTEM_POLICIES.filter(p => !isPolicyDeleted(p, deletedSet));
        setPoliciesLive(fallback);
      }
    } catch (policiesErr) {
      console.warn('Policies table warning:', policiesErr);
      const deletedSet = getDeletedIdentifiers();
      setPoliciesLive(DEFAULT_SYSTEM_POLICIES.filter(p => !isPolicyDeleted(p, deletedSet)));
    }
  }, [getDeletedIdentifiers, isPolicyDeleted]);

  // 4. Tải toàn bộ dữ liệu tổng hợp
  const fetchData = useCallback(async () => {
    try {
      if (!currentUser) {
        await fetchPolicies();
        setRecords([]);
        setCustomers([]);
        return;
      }

      await Promise.all([
        fetchRecords().catch(() => []),
        fetchCustomers().catch(() => []),
        fetchPolicies()
      ]);
    } catch (err) {
      console.error('Critical DataContext loading error:', err);
    }
  }, [currentUser, fetchCustomers, fetchPolicies, fetchRecords, setCustomers, setRecords]);

  // 5. Đồng bộ Realtime
  useEffect(() => {
    if (!isAuthReady) return;

    fetchData();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedFetchData = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData();
      }, 300);
    };

    const unsubscribe = realtimeService.subscribeToPublicChanges(debouncedFetchData);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [fetchData, refreshTrigger, isAuthReady]);

  // 6. Quản lý chính sách (Policies CRUD)
  const addPolicy = useCallback(async (newPolicy: Omit<Policy, 'id'>): Promise<boolean> => {
    try {
      const { error } = await policyService.addPolicy(newPolicy);
      if (error) throw error;
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Error adding policy:', error);
      throw error;
    }
  }, [fetchPolicies]);

  const updatePolicy = useCallback(async (id: number, updatedFields: Partial<Policy>): Promise<boolean> => {
    try {
      const { error } = await policyService.updatePolicy(id, updatedFields);
      if (error) throw error;
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Error updating policy:', error);
      throw error;
    }
  }, [fetchPolicies]);

  const deletePolicy = useCallback(async (id: number, name?: string): Promise<boolean> => {
    try {
      const target = policiesLive.find(p => p.id === id || (name && p.name === name));
      const targetName = name || target?.name;
      const targetType = target?.parameter_type;

      // 1. Ghi nhận xóa vào danh sách nhận diện đã xóa (localStorage)
      if (typeof window !== 'undefined') {
        try {
          const current = getDeletedIdentifiers();
          if (id !== undefined && id !== null && !isNaN(Number(id))) current.add(`id:${id}`);
          if (targetName) current.add(`name:${targetName.trim().toLowerCase()}`);
          if (targetName && targetType) current.add(`key:${targetType}-${targetName.trim().toLowerCase()}`);
          window.localStorage.setItem(DELETED_POLICIES_KEY, JSON.stringify(Array.from(current)));
        } catch (e) {
          console.warn('[DataContext] Lỗi lưu blacklist xóa chính sách:', e);
        }
      }

      // 2. Cập nhật state lạc quan ngay lập tức (Optimistic UI Update)
      setPoliciesLive(prev => prev.filter(p => p.id !== id && (!targetName || p.name !== targetName)));

      // 3. Thực hiện xóa trên CSDL Supabase
      const { error } = await policyService.deletePolicy(id, targetName);
      if (error) {
        console.warn('[DataContext] CSDL deletePolicy thông báo:', error);
      }

      // 4. Đồng bộ lại dữ liệu từ Server
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }, [policiesLive, getDeletedIdentifiers, fetchPolicies]);

  const activatePolicy = useCallback(async (id: number, parameterType: string): Promise<boolean> => {
    try {
      const { error } = await policyService.activatePolicy(id, parameterType);
      if (error) throw error;
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Error activating policy:', error);
      throw error;
    }
  }, [fetchPolicies]);

  const syncDefaultPolicies = useCallback(async (): Promise<boolean> => {
    try {
      // Khi người dùng chủ động bấm "Đồng bộ chính sách mặc định", xóa blacklist để khôi phục
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(DELETED_POLICIES_KEY);
      }
      const { error } = await policyService.syncDefaultPolicies(DEFAULT_SYSTEM_POLICIES);
      if (error) throw error;
      await fetchPolicies();
      return true;
    } catch (err: any) {
      console.error('[DataContext] syncDefaultPolicies error:', err);
      throw err;
    }
  }, [fetchPolicies]);

  const value = useMemo<DataContextType>(() => ({
    records,
    customers,
    policies: policiesLive,
    addRecord,
    bulkPutRecords,
    updateRecord,
    updateCustomerStatus,
    updateCustomerParticipation,
    deleteRecord,
    bulkDeleteRecords,
    deleteCustomer,
    cancelRecordWithClawback,
    fetchCustomerTransactions,
    fetchCustomerByCode,
    addPolicy,
    updatePolicy,
    deletePolicy,
    activatePolicy,
    syncDefaultPolicies,
    refreshData,
    refreshTrigger
  }), [
    records,
    customers,
    policiesLive,
    addRecord,
    bulkPutRecords,
    updateRecord,
    updateCustomerStatus,
    updateCustomerParticipation,
    deleteRecord,
    bulkDeleteRecords,
    deleteCustomer,
    cancelRecordWithClawback,
    fetchCustomerTransactions,
    fetchCustomerByCode,
    addPolicy,
    updatePolicy,
    deletePolicy,
    activatePolicy,
    syncDefaultPolicies,
    refreshData,
    refreshTrigger
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useDataContext = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};
