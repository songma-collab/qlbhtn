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
  deletePolicy: (id: number) => Promise<boolean>;
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

  // 3. Tải Policies
  const fetchPolicies = useCallback(async () => {
    try {
      const policiesRes = await policyService.fetchPolicies();
      const policiesData = policiesRes.data;
      const uniquePoliciesMap = new Map<string, Policy>();
      DEFAULT_SYSTEM_POLICIES.forEach(p => {
        uniquePoliciesMap.set(`${p.parameter_type}-${p.name}`, p);
      });
      if (policiesData && policiesData.length > 0) {
        policiesData.forEach((rawP: any) => {
          const p = formatPolicyFromDb(rawP);
          uniquePoliciesMap.set(`${p.parameter_type}-${p.name}`, p);
        });
      }
      setPoliciesLive(Array.from(uniquePoliciesMap.values()));
    } catch (policiesErr) {
      console.warn('Policies table warning:', policiesErr);
      setPoliciesLive(DEFAULT_SYSTEM_POLICIES);
    }
  }, []);

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

  const deletePolicy = useCallback(async (id: number): Promise<boolean> => {
    try {
      const { error } = await policyService.deletePolicy(id);
      if (error) throw error;
      await fetchPolicies();
      return true;
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }, [fetchPolicies]);

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
