import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { RecordType, CustomerType } from '../types';
import type { CustomerStatus } from '../../utils/customerStatus';
import { supabase } from '../../lib/supabase';
import { isDateLocked, checkFinancialLockViolation } from '../../utils/helpers';
import { withRetry } from '../../utils/networkHelper';
import { DEFAULT_SYSTEM_POLICIES } from '../../data/defaultPolicies';
import {
  sanitizeRecordForDb,
  handleSchemaCacheMissingColumn,
  formatPolicyFromDb,
  sanitizePolicyForDb,
  unsupportedRecordColumns,
  Policy
} from '../AppContext';
import { customerService } from '../../services/customerService';
import { useAdminContext } from './AdminContext';
import { useUIContext } from './UIContext';

export interface DataContextType {
  records: RecordType[];
  customers: CustomerType[];
  policies: Policy[];
  addRecord: (record: Omit<RecordType, 'id'>) => Promise<RecordType | null>;
  bulkPutRecords: (records: RecordType[]) => Promise<boolean>;
  updateRecord: (id: number, record: Partial<RecordType>) => Promise<boolean>;
  updateCustomerStatus: (recordId: number, newStatus: CustomerStatus, reason?: string) => Promise<boolean>;
  updateCustomerParticipation: (
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string;
    }
  ) => Promise<boolean>;
  deleteRecord: (id: number) => Promise<boolean>;
  bulkDeleteRecords: (ids: number[]) => Promise<boolean>;
  deleteCustomer: (customerKey: string) => Promise<boolean>;
  cancelRecordWithClawback: (recordId: number, reason: string, currentUserRole?: string) => Promise<boolean>;
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
  const { showToast, showAlert, setAdminTab } = useUIContext();

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recordsLive, setRecordsLive] = useState<RecordType[]>([]);
  const [customersLive, setCustomersLive] = useState<CustomerType[]>([]);
  const [policiesLive, setPoliciesLive] = useState<Policy[]>(DEFAULT_SYSTEM_POLICIES);

  const refreshData = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const safeQuery = useCallback(async <T,>(queryPromise: () => PromiseLike<T>): Promise<T | null> => {
    try {
      return await withRetry(async () => await queryPromise(), { maxRetries: 2, baseDelayMs: 800 });
    } catch (err) {
      console.warn('[DataContext safeQuery] Query failed after retry:', err);
      return null;
    }
  }, []);

  const fetchAllRecords = useCallback(async (): Promise<RecordType[]> => {
    try {
      let query = supabase
        .from('records')
        .select('*')
        .order('date', { ascending: false })
        .limit(2500);

      if (!isAdmin && currentUser?.id) {
        query = query.eq('staffId', currentUser.id);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [];
      }

      if (data.length > 0 && data[0]) {
        const sampleRow = data[0] as Record<string, any>;
        const candidateSnapshotCols = [
          'baseSalarySnapshot',
          'povertyStandardSnapshot',
          'policyVersionId',
          'appliedRates',
          'isAdjustment',
          'originalRecordId',
          'adjustmentReason',
          'isSubmittedBHXH',
          'submissionBatch',
          'submittedDate'
        ];
        candidateSnapshotCols.forEach(col => {
          if (!(col in sampleRow)) {
            unsupportedRecordColumns.add(col);
          }
        });
      }

      const normalized = (data as any[]).map(r => {
        const o = r.old_bhxh || r.oldBhxh;
        if (o) {
          r.old_bhxh = o;
          r.oldBhxh = o;
        }
        return r as RecordType;
      });
      return normalized;
    } catch (err) {
      console.warn('[DataContext] fetchAllRecords failed:', err);
      return [];
    }
  }, [currentUser?.id, isAdmin]);

  const fetchAllCustomers = useCallback(async (): Promise<CustomerType[]> => {
    try {
      let query = supabase.from('customers').select('*').order('updated_at', { ascending: false }).limit(2500);
      if (!isAdmin && currentUser?.id) {
        query = query.eq('staff_id', currentUser.id);
      }
      const { data, error } = await query;
      if (error || !data) return [];
      const normalized = (data as any[]).map(c => {
        const o = c.old_bhxh || c.oldBhxh;
        if (o) {
          c.old_bhxh = o;
          c.oldBhxh = o;
        }
        return c as CustomerType;
      });
      return normalized;
    } catch (err) {
      console.warn('[DataContext] fetchAllCustomers failed:', err);
      return [];
    }
  }, [currentUser?.id, isAdmin]);

  const fetchData = useCallback(async () => {
    try {
      if (!currentUser) {
        const policiesRes = await safeQuery(() => supabase.from('policies').select('*').order('effective_date', { ascending: false }));
        const policiesData = (policiesRes as any)?.data;
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
        setRecordsLive([]);
        setCustomersLive([]);
        return;
      }

      const [recordsData, customersData, policiesRes] = await Promise.all([
        fetchAllRecords().catch(() => []),
        fetchAllCustomers().catch(() => []),
        safeQuery(() => supabase.from('policies').select('*').order('effective_date', { ascending: false }))
      ]);

      if (recordsData) {
        setRecordsLive(recordsData as RecordType[]);
      }
      if (customersData) {
        setCustomersLive(customersData as CustomerType[]);
      }

      try {
        const policiesData = (policiesRes as any)?.data;
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
    } catch (err) {
      console.warn('[DataContext] fetchData error:', err);
    }
  }, [currentUser, fetchAllCustomers, fetchAllRecords, safeQuery]);

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

    const channel = supabase.channel('public_db_changes_data')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        debouncedFetchData();
      })
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData, refreshTrigger, isAuthReady]);

  const getLockedKeys = useCallback((policiesList: Policy[]): string[] => {
    const p = policiesList.find(x => x.parameter_type === 'locked_periods' && x.is_active);
    if (!p) return [];
    if (Array.isArray(p.value)) return p.value;
    if (p.value && Array.isArray(p.value.lockedKeys)) return p.value.lockedKeys;
    return [];
  }, []);

  const addRecord = useCallback(async (newRecordData: Omit<RecordType, 'id'>): Promise<RecordType | null> => {
    try {
      if (isDateLocked(newRecordData.date, getLockedKeys(policiesLive))) {
        showAlert('Dữ liệu đã bị khóa', `Kỳ tài chính của ngày "${newRecordData.date || ''}" đã BỊ KHÓA DỮ LIỆU. Không thể tạo mới hồ sơ thuộc kỳ này.`);
        return null;
      }

      let insertPayload = sanitizeRecordForDb(newRecordData, false);
      let data: any = null;
      let error: any = null;
      let maxRetries = 10;

      while (maxRetries > 0) {
        maxRetries--;
        const res = await supabase
          .from('records')
          .insert([insertPayload])
          .select()
          .single();

        data = res.data;
        error = res.error;
        if (!error) break;

        const handled = handleSchemaCacheMissingColumn(error, insertPayload);
        if (!handled) break;
      }

      if (error) throw error;
      await fetchData();
      if (data) {
        addAuditLog('Tạo hồ sơ mới', `Tạo hồ sơ ${data.type || ''} cho khách hàng ${data.name || ''}`);
      }
      return data as RecordType;
    } catch (error: any) {
      console.error('Error adding record:', error);
      throw error;
    }
  }, [addAuditLog, fetchData, getLockedKeys, policiesLive, showAlert]);

  const bulkPutRecords = useCallback(async (recordsList: RecordType[]): Promise<boolean> => {
    try {
      const lockedKeysList = getLockedKeys(policiesLive);
      const allowedItems: RecordType[] = [];
      const rejectedLockedItems: RecordType[] = [];

      for (const item of recordsList) {
        if (!item.id) {
          if (isDateLocked(item.date, lockedKeysList)) {
            rejectedLockedItems.push(item);
          } else {
            allowedItems.push(item);
          }
        } else {
          const orig = recordsLive.find(r => r.id === item.id);
          if (orig && isDateLocked(orig.date, lockedKeysList)) {
            const violation = checkFinancialLockViolation(orig, item, lockedKeysList);
            if (violation.isViolated) {
              rejectedLockedItems.push(item);
            } else {
              allowedItems.push(item);
            }
          } else if (orig && item.date && isDateLocked(item.date, lockedKeysList)) {
            rejectedLockedItems.push(item);
          } else {
            allowedItems.push(item);
          }
        }
      }

      if (allowedItems.length === 0 && rejectedLockedItems.length > 0) {
        showAlert('Dữ liệu đã bị khóa', `Tất cả ${rejectedLockedItems.length} hồ sơ trong danh sách thuộc kỳ tài chính đã BỊ KHÓA SỔ. Không được phép thay đổi thông tin tài chính.`);
        return false;
      }

      const BATCH_SIZE = 200;
      const newItems = allowedItems.filter(r => !r.id);
      const existingItems = allowedItems.filter(r => Boolean(r.id));

      if (newItems.length > 0) {
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
          let chunk = newItems.slice(i, i + BATCH_SIZE).map(({ id, ...item }) => sanitizeRecordForDb(item, false));
          let error: any = null;
          let maxRetries = 10;
          while (maxRetries > 0) {
            maxRetries--;
            const res = await supabase.from('records').insert(chunk);
            error = res.error;
            if (!error) break;
            const handled = handleSchemaCacheMissingColumn(error, chunk);
            if (!handled) break;
          }
          if (error) throw error;
        }
      }

      if (existingItems.length > 0) {
        for (let i = 0; i < existingItems.length; i += BATCH_SIZE) {
          let chunk = existingItems.slice(i, i + BATCH_SIZE).map(item => {
            const clean = sanitizeRecordForDb(item, false);
            clean.id = item.id;
            return clean;
          });
          let error: any = null;
          let maxRetries = 10;
          while (maxRetries > 0) {
            maxRetries--;
            const res = await supabase.from('records').upsert(chunk);
            error = res.error;
            if (!error) break;
            const handled = handleSchemaCacheMissingColumn(error, chunk);
            if (!handled) break;
          }
          if (error) throw error;
        }
      }

      await fetchData();

      if (rejectedLockedItems.length > 0) {
        showAlert(
          'Dữ liệu đã bị khóa (Bỏ qua hồ sơ vi phạm)',
          `Đã nhập/cập nhật thành công ${allowedItems.length} hồ sơ hợp lệ.\n\nBỏ qua ${rejectedLockedItems.length} hồ sơ do vi phạm khóa sổ tài chính (kỳ đã khóa).`,
          'warning'
        );
      }

      return true;
    } catch (error: any) {
      console.error('Error bulk adding records:', error);
      throw error;
    }
  }, [fetchData, getLockedKeys, policiesLive, recordsLive, showAlert]);

  const updateRecord = useCallback(async (id: number, updatedFields: Partial<RecordType>): Promise<boolean> => {
    try {
      const targetRecord = recordsLive.find(r => r.id === id);
      if (targetRecord) {
        const lockedKeysList = getLockedKeys(policiesLive);
        if (isDateLocked(targetRecord.date, lockedKeysList)) {
          const lockViolation = checkFinancialLockViolation(targetRecord, updatedFields, lockedKeysList);
          if (lockViolation.isViolated) {
            showAlert(
              'Kỳ tài chính đã bị khóa',
              `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã BỊ KHÓA SỔ. Không được phép chỉnh sửa các thông tin tài chính (${lockViolation.violatedFields.join(', ')}). Chỉ được phép cập nhật thông tin liên lạc / ghi chú.`
            );
            return false;
          }
        } else if (updatedFields.date && isDateLocked(updatedFields.date, lockedKeysList)) {
          showAlert(
            'Kỳ tài chính đã bị khóa',
            `Không thể chuyển ngày giao dịch sang ngày "${updatedFields.date}" vì kỳ này đã BỊ KHÓA SỔ.`
          );
          return false;
        }
      }

      let fieldsToUpdate = sanitizeRecordForDb(updatedFields, true);
      let error: any = null;
      let maxRetries = 10;

      while (maxRetries > 0) {
        maxRetries--;
        const res = await supabase
          .from('records')
          .update(fieldsToUpdate)
          .eq('id', id);

        error = res.error;
        if (!error) break;

        const handled = handleSchemaCacheMissingColumn(error, fieldsToUpdate);
        if (!handled) break;
      }

      if (error) {
        // Fallback: Nếu cập nhật trạng thái thanh toán gặp lỗi RLS từ PostgREST, thử gọi qua RPC bảo mật confirm_record_payment
        if (updatedFields.paymentStatus && (error.message?.includes('row-level security') || error.code === '42501')) {
          try {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('confirm_record_payment', {
              p_record_id: id,
              p_new_status: updatedFields.paymentStatus
            });
            if (!rpcErr && (rpcRes?.success === true || rpcRes === true)) {
              error = null;
            }
          } catch (rpcEx) {
            console.warn('[DataContext] RPC confirm_record_payment fallback:', rpcEx);
          }
        }
      }

      if (error) throw error;
      await fetchData();
      if (targetRecord) {
        addAuditLog('Cập nhật hồ sơ', `Cập nhật thông tin hồ sơ khách hàng ${targetRecord.name}`);
      }
      return true;
    } catch (error: any) {
      console.error('Error updating record:', error);
      showAlert('Lỗi cập nhật hồ sơ', error.message || 'Hệ thống từ chối cập nhật hồ sơ.');
      return false;
    }
  }, [addAuditLog, fetchData, getLockedKeys, policiesLive, recordsLive, showAlert]);

  const updateCustomerStatus = useCallback(async (recordId: number, newStatus: CustomerStatus, reason?: string): Promise<boolean> => {
    try {
      const targetRecord = recordsLive.find(r => r.id === recordId);
      if (!targetRecord) {
        showAlert('Không tìm thấy', 'Không tìm thấy hồ sơ khách hàng cần đổi trạng thái.');
        return false;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const reasonText = reason?.trim() ? ` [Lý do: ${reason.trim()}]` : '';
      const existingNotes = targetRecord.notes || '';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n[${todayStr}] Đổi trạng thái -> ${newStatus}${reasonText}`
        : `[${todayStr}] Đổi trạng thái -> ${newStatus}${reasonText}`;

      const res = await supabase
        .from('records')
        .update({
          status: newStatus,
          notes: updatedNotes
        })
        .eq('id', recordId);

      if (res.error) throw res.error;

      const customerKey = (targetRecord as any).customer_key || (targetRecord as any).customerKey;
      if (customerKey) {
        try {
          await supabase
            .from('customers')
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq('customer_key', customerKey);
        } catch (_) {}
      }

      await fetchData();
      addAuditLog(
        'Đổi trạng thái khách hàng',
        `Chuyển trạng thái khách hàng "${targetRecord.name}" sang "${newStatus}".${reasonText}`
      );
      return true;
    } catch (error: any) {
      console.error('Error updating customer status:', error);
      showAlert('Lỗi cập nhật trạng thái', error.message || 'Không thể cập nhật trạng thái khách hàng.');
      return false;
    }
  }, [addAuditLog, fetchData, recordsLive, showAlert]);

  const updateCustomerParticipation = useCallback(async (
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string;
    }
  ): Promise<boolean> => {
    try {
      const res = await customerService.updateCustomerParticipation(targetIdOrKey, data);
      if (!res.success) {
        throw res.error || new Error('Không thể lưu hồ sơ quá trình tham gia.');
      }

      setCustomersLive(prev => prev.map(c => {
        const matches = (c.id && String(c.id) === String(targetIdOrKey)) ||
                        (c.customer_key && c.customer_key === targetIdOrKey) ||
                        (c.cccd && c.cccd === targetIdOrKey) ||
                        (c.bhxh && c.bhxh === targetIdOrKey);
        if (matches) {
          return {
            ...c,
            prior_periods: data.prior_periods,
            prior_voluntary_months: data.prior_voluntary_months,
            prior_compulsory_months: data.prior_compulsory_months,
            prior_participation_notes: data.prior_participation_notes,
            updated_at: new Date().toISOString()
          };
        }
        return c;
      }));

      addAuditLog(
        'Cập nhật hồ sơ tham gia',
        `Cập nhật quá trình tham gia của khách hàng [${targetIdOrKey}]: ${data.prior_compulsory_months} tháng bắt buộc, ${data.prior_voluntary_months} tháng tự nguyện ngoài.`
      );
      showToast('Đã lưu hồ sơ quá trình tham gia thành công!', 'success');
      return true;
    } catch (err: any) {
      console.error('[updateCustomerParticipation] Lỗi:', err);
      showAlert('Lỗi cập nhật hồ sơ', err.message || 'Không thể lưu hồ sơ quá trình tham gia của khách hàng.', 'error');
      return false;
    }
  }, [addAuditLog, showAlert, showToast]);

  const cancelRecordWithClawback = useCallback(async (recordId: number, reason: string, currentUserRole?: string): Promise<boolean> => {
    try {
      const role = currentUserRole || currentUser?.role;
      const isHoc = (currentUser?.name || '').toLowerCase().includes('phạm văn học') || (currentUser?.name || '').toLowerCase().includes('pham van hoc');
      const hasPerm = role === 'Admin' || role === 'admin' || role === 'Quản lý' || isHoc;
      if (!hasPerm) {
        showAlert('Từ chối quyền hạn', 'Chỉ Quản lý hoặc Admin mới có quyền hủy giao dịch đã thu tiền / điều chỉnh hoa hồng.');
        return false;
      }

      const targetRecord = recordsLive.find(r => r.id === recordId);
      if (!targetRecord) {
        showAlert('Không tìm thấy', 'Không tìm thấy hồ sơ giao dịch cần hủy.');
        return false;
      }

      if (targetRecord.paymentStatus === 'Đã hủy') {
        showAlert('Đã hủy trước đó', `Giao dịch "${targetRecord.name}" đã ở trạng thái Đã hủy.`);
        return false;
      }

      if (targetRecord.isSubmittedBHXH) {
        showAlert('Hồ sơ đã chuyển BHXH', `Hồ sơ "${targetRecord.name}" ĐÃ ĐƯỢC CHUYỂN BHXH (${targetRecord.submissionBatch || 'Đã nộp'}). Vui lòng hủy đợt nộp BHXH trước khi hủy giao dịch.`);
        return false;
      }

      const lockedKeysList = getLockedKeys(policiesLive);
      const isLocked = isDateLocked(targetRecord.date, lockedKeysList);
      const todayStr = new Date().toISOString().split('T')[0];

      const isPaid = targetRecord.paymentStatus === 'Đã thu tiền' && (Number(targetRecord.amount) || 0) > 0;

      if (isLocked) {
        showAlert(
          'Kỳ tài chính đã khóa sổ',
          `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã chốt khóa sổ (${targetRecord.date ? String(targetRecord.date).slice(0, 7) : ''}). Hệ thống không tự động tạo bút toán bù trừ khi hủy giao dịch. Vui lòng sử dụng chức năng "Lập Bút Toán Thoái Thu" trong mục Báo Cáo & Chốt Sổ với đầy đủ Số Quyết Định và Ngày Quyết Định để thoái thu hoàn trả theo đúng quy định kế toán.`,
          'warning'
        );
        return false;
      } else {
        const { error: updErr } = await supabase
          .from('records')
          .update({
            paymentStatus: 'Đã hủy',
            payment_status: 'Đã hủy',
            notes: `${targetRecord.notes ? targetRecord.notes + ' | ' : ''}[ĐÃ HỦY] Lý do: ${reason || 'Không có'}`
          })
          .eq('id', targetRecord.id);

        if (updErr) throw updErr;

        // Đồng bộ trạng thái vào customers nếu có
        const custKey = (targetRecord as any).customer_key || (targetRecord as any).customerKey;
        if (custKey) {
          try {
            await supabase
              .from('customers')
              .update({ payment_status: 'Đã hủy', updated_at: new Date().toISOString() })
              .eq('customer_key', custKey);
          } catch (_) {}
        }

        addAuditLog('Hủy giao dịch', `Đã hủy giao dịch #${targetRecord.id} của khách hàng ${targetRecord.name}. Lý do: ${reason || 'Không có'}`);
        await fetchData();
        showToast('Đã hủy giao dịch thành công!', 'success');
        return true;
      }
    } catch (error: any) {
      console.error('Error cancelling record with clawback:', error);
      showAlert('Lỗi khi hủy giao dịch', error.message || 'Có lỗi xảy ra', 'error');
      return false;
    }
  }, [addAuditLog, currentUser?.role, fetchData, getLockedKeys, policiesLive, recordsLive, showAlert, showToast]);

  const deleteRecord = useCallback(async (id: number): Promise<boolean> => {
    try {
      const targetRecord = recordsLive.find(r => r.id === id);
      if (targetRecord?.isSubmittedBHXH) {
        showAlert('Hồ sơ đã chuyển BHXH', `Hồ sơ "${targetRecord.name}" ĐÃ ĐƯỢC CHUYỂN BHXH. Bạn không thể xóa hồ sơ này.`, 'warning');
        return false;
      }
      if (targetRecord && isDateLocked(targetRecord.date, getLockedKeys(policiesLive))) {
        showAlert('Dữ liệu đã bị khóa', `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã BỊ KHÓA DỮ LIỆU. Không thể xóa.`, 'warning');
        return false;
      }

      // Ưu tiên gọi RPC delete_record_safe (SECURITY DEFINER)
      let deleteSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_record_safe', { p_record_id: id });
        if (!rpcErr && rpcRes && rpcRes.success) {
          deleteSuccess = true;
        } else if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
          showAlert('Từ chối xóa giao dịch', rpcErr.message, 'warning');
          return false;
        } else if (rpcRes && !rpcRes.success) {
          showAlert('Từ chối xóa giao dịch', rpcRes.message || 'CSDL từ chối xóa giao dịch này.', 'warning');
          return false;
        }
      } catch (_) {}

      if (!deleteSuccess) {
        const { data: deletedRows, error } = await supabase
          .from('records')
          .delete()
          .eq('id', id)
          .select();

        if (error) throw error;
        if (!deletedRows || deletedRows.length === 0) {
          const isPending = targetRecord?.paymentStatus === 'Chờ thanh toán' || (targetRecord as any)?.payment_status === 'Chờ thanh toán';
          if (isPending) {
            showAlert(
              'Chưa cập nhật Trigger CSDL',
              'CSDL Supabase hiện đang kích hoạt Trigger ngăn cản xóa giao dịch (0 bản ghi bị xóa). Vui lòng chạy file SQL "20260920_fix_delete_trigger_and_persistence.sql" trong Supabase SQL Editor.',
              'warning'
            );
          } else {
            showAlert('Từ chối xóa', 'Hồ sơ không thể xóa trực tiếp (có thể do hồ sơ đã thu tiền hoặc bạn không đủ quyền hạn Quản lý/Admin). Vui lòng sử dụng tính năng Hủy giao dịch.', 'warning');
          }
          return false;
        }
      }

      // Cập nhật ngay lập tức UI để người dùng thấy giao dịch biến mất tức thì
      setRecordsLive(prev => prev.filter(r => r.id !== id));
      await fetchData();
      if (targetRecord) {
        addAuditLog('Xóa hồ sơ', `Xóa hồ sơ khách hàng ${targetRecord.name}`);
      }
      return true;
    } catch (error: any) {
      console.error('Error deleting record:', error);
      showAlert('Lỗi xóa hồ sơ', error.message || 'Hệ thống từ chối xóa giao dịch này.', 'error');
      return false;
    }
  }, [addAuditLog, fetchData, getLockedKeys, policiesLive, recordsLive, showAlert]);

  const bulkDeleteRecords = useCallback(async (ids: number[]): Promise<boolean> => {
    try {
      const submittedList = recordsLive.filter(r => ids.includes(r.id) && r.isSubmittedBHXH);
      if (submittedList.length > 0) {
        showAlert('Hồ sơ đã chuyển BHXH', `Có ${submittedList.length} hồ sơ trong danh sách ĐÃ ĐƯỢC CHUYỂN BHXH. Bạn không thể xóa các hồ sơ này. Vui lòng bỏ chọn trước khi xóa.`, 'warning');
        return false;
      }
      const lockedList = recordsLive.filter(r => ids.includes(r.id) && isDateLocked(r.date, getLockedKeys(policiesLive)));
      if (lockedList.length > 0) {
        showAlert('Dữ liệu đã bị khóa', `Có ${lockedList.length} hồ sơ trong danh sách thuộc kỳ tài chính đã BỊ KHÓA DỮ LIỆU. Vui lòng bỏ chọn các hồ sơ bị khóa trước khi xóa.`, 'warning');
        return false;
      }

      let bulkSuccess = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('bulk_delete_records_safe', { p_record_ids: ids });
        if (!rpcErr && rpcRes && rpcRes.success) {
          bulkSuccess = true;
        } else if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
          showAlert('Từ chối xóa hàng loạt', rpcErr.message, 'warning');
          return false;
        }
      } catch (_) {}

      if (!bulkSuccess) {
        const { data: deletedRows, error } = await supabase
          .from('records')
          .delete()
          .in('id', ids)
          .select();

        if (error) throw error;
        if (!deletedRows || deletedRows.length === 0) {
          showAlert('Từ chối xóa hàng loạt', 'Không có hồ sơ nào được xóa. Vui lòng kiểm tra quyền hạn hoặc chạy bản vá SQL cập nhật quyền trên Supabase.', 'warning');
          return false;
        }
      }

      // Cập nhật ngay lập tức UI
      setRecordsLive(prev => prev.filter(r => !ids.includes(r.id)));
      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error bulk deleting records:', error);
      showAlert('Lỗi xóa hàng loạt', error.message || 'Không thể xóa các hồ sơ được chọn.', 'error');
      return false;
    }
  }, [fetchData, getLockedKeys, policiesLive, recordsLive, showAlert]);

  const deleteCustomer = useCallback(async (customerKey: string): Promise<boolean> => {
    try {
      if (!customerKey) {
        showAlert('Lỗi xóa khách hàng', 'Không xác định được mã định danh khách hàng cần xóa.', 'error');
        return false;
      }
      const res = await customerService.deleteCustomerCascade(customerKey);
      if (!res.success && res.error) {
        console.warn('[DataContext] RPC delete_customer_cascade failed, executing direct cascade delete:', res.error);
        const { data: relatedRecords } = await supabase
          .from('records')
          .select('id')
          .or(`customer_key.eq.${customerKey},"customerKey".eq.${customerKey},bhxh.eq.${customerKey},cccd.eq.${customerKey},phone.eq.${customerKey}`);

        if (relatedRecords && relatedRecords.length > 0) {
          const ids = relatedRecords.map(r => r.id);
          const { error: delRecErr } = await supabase.from('records').delete().in('id', ids);
          if (delRecErr) throw delRecErr;
        }
        const { error: delCustErr } = await supabase.from('customers').delete().or(`customer_key.eq.${customerKey},"customerKey".eq.${customerKey},cccd.eq.${customerKey},bhxh.eq.${customerKey}`);
        if (delCustErr) throw delCustErr;
      } else if (!res.success) {
        showAlert('Từ chối xóa khách hàng', res.message || 'Không thể xóa khách hàng do ràng buộc an toàn dữ liệu.', 'warning');
        return false;
      }

      // Cập nhật ngay lập tức UI (Optimistic local state update)
      setCustomersLive(prev => prev.filter(c => 
        c.customer_key !== customerKey && 
        (c as any).customerKey !== customerKey &&
        c.cccd !== customerKey &&
        c.bhxh !== customerKey &&
        c.phone !== customerKey
      ));
      setRecordsLive(prev => prev.filter(r => 
        (r.customer_key || (r as any).customerKey) !== customerKey && 
        r.bhxh !== customerKey && 
        r.cccd !== customerKey && 
        r.phone !== customerKey
      ));

      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      showAlert('Lỗi xóa hồ sơ khách hàng', error.message || 'Hệ thống từ chối xóa hồ sơ khách hàng này.', 'error');
      return false;
    }
  }, [fetchData, showAlert]);

  const fetchCustomerTransactions = useCallback(async (customerIdOrKey: string): Promise<RecordType[]> => {
    try {
      if (!customerIdOrKey) return [];
      const clean = customerIdOrKey.trim();
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .or(`customerId.eq.${clean},customerKey.eq.${clean},cccd.eq.${clean},bhxh.eq.${clean}`)
        .order('date', { ascending: false });

      if (error || !data) {
        return recordsLive.filter(r => 
          r.customerId === clean || 
          r.customerKey === clean || 
          (r.cccd && r.cccd === clean) || 
          (r.bhxh && r.bhxh === clean)
        );
      }
      return data as RecordType[];
    } catch (err) {
      console.warn('[DataContext] fetchCustomerTransactions failed:', err);
      const clean = (customerIdOrKey || '').trim();
      return recordsLive.filter(r => 
        r.customerId === clean || 
        r.customerKey === clean || 
        (r.cccd && r.cccd === clean) || 
        (r.bhxh && r.bhxh === clean)
      );
    }
  }, [recordsLive]);

  const fetchCustomerByCode = useCallback(async (code: string): Promise<any> => {
    const clean = (code || '').replace(/\D/g, '');
    if (!clean || (clean.length !== 9 && clean.length !== 10 && clean.length !== 12)) return null;

    const matchedCustomer = customersLive.find(c => {
      const cCccd = (c.cccd || '').replace(/\D/g, '');
      const cBhxh = (c.bhxh || '').replace(/\D/g, '');
      const cOld = (c.old_bhxh || c.oldBhxh || '').replace(/\D/g, '');
      return cCccd === clean || cBhxh === clean || cOld === clean;
    });

    if (matchedCustomer) {
      return {
        name: matchedCustomer.name,
        dob: matchedCustomer.dob,
        gender: matchedCustomer.gender || 'Nam',
        nation: matchedCustomer.nation || 'Kinh',
        cccd: matchedCustomer.cccd || (clean.length === 12 ? clean : ''),
        phone: matchedCustomer.phone,
        email: matchedCustomer.email,
        address: matchedCustomer.address,
        bhxh: matchedCustomer.bhxh,
        oldBhxh: matchedCustomer.old_bhxh || matchedCustomer.oldBhxh || (matchedCustomer.bhxh && matchedCustomer.bhxh.length === 10 ? matchedCustomer.bhxh : ''),
        customerId: matchedCustomer.id,
        customerKey: matchedCustomer.customer_key,
        source: 'Danh bạ Khách hàng (Customers Master)'
      };
    }

    try {
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .or(`cccd.eq.${clean},bhxh.eq.${clean},old_bhxh.eq.${clean}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!custErr && custData) {
        return {
          name: custData.name,
          dob: custData.dob,
          gender: custData.gender || 'Nam',
          nation: custData.nation || 'Kinh',
          cccd: custData.cccd || (clean.length === 12 ? clean : ''),
          phone: custData.phone,
          email: custData.email,
          address: custData.address,
          bhxh: custData.bhxh,
          oldBhxh: custData.old_bhxh || custData.oldBhxh || (custData.bhxh && custData.bhxh.length === 10 ? custData.bhxh : ''),
          customerId: custData.id,
          customerKey: custData.customer_key,
          source: 'CSDL Khách hàng Supabase'
        };
      }
    } catch (err) {
      console.warn('[fetchCustomerByCode] Query customers error:', err);
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('lookup_customer_profile', { p_code: clean });
      if (!rpcError && rpcData && rpcData.length > 0) {
        const found = rpcData[0];
        return {
          ...found,
          oldBhxh: found.old_bhxh,
          source: 'RPC Định danh Khách hàng'
        };
      }
    } catch (e) {
      console.warn('[fetchCustomerByCode] RPC error:', e);
    }

    return null;
  }, [customersLive]);

  const addPolicy = useCallback(async (newPolicy: Omit<Policy, 'id'>): Promise<boolean> => {
    try {
      const payload = sanitizePolicyForDb(newPolicy);
      const { error } = await supabase.from('policies').insert([payload]);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error adding policy:', error);
      throw error;
    }
  }, [fetchData]);

  const updatePolicy = useCallback(async (id: number, updatedFields: Partial<Policy>): Promise<boolean> => {
    try {
      const payload = sanitizePolicyForDb(updatedFields);
      delete payload.id;
      const { error } = await supabase.from('policies').update(payload).eq('id', id);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error updating policy:', error);
      throw error;
    }
  }, [fetchData]);

  const deletePolicy = useCallback(async (id: number): Promise<boolean> => {
    try {
      const { error } = await supabase.from('policies').delete().eq('id', id);
      if (error) throw error;
      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      throw error;
    }
  }, [fetchData]);

  const activatePolicy = useCallback(async (id: number, parameterType: string): Promise<boolean> => {
    try {
      const { error: deactivateErr } = await supabase
        .from('policies')
        .update({ is_active: false })
        .eq('parameter_type', parameterType);

      if (deactivateErr) throw deactivateErr;

      const { error: activateErr } = await supabase
        .from('policies')
        .update({ is_active: true })
        .eq('id', id);

      if (activateErr) throw activateErr;

      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error activating policy:', error);
      throw error;
    }
  }, [fetchData]);

  const syncDefaultPolicies = useCallback(async (): Promise<boolean> => {
    try {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_system_policies', {
          p_policies: DEFAULT_SYSTEM_POLICIES.map(p => sanitizePolicyForDb(p))
        });
        if (!rpcErr && (rpcRes as any)?.success) {
          await fetchData();
          return true;
        }
      } catch (rpcCatch) {
        // fallback
      }

      for (const p of DEFAULT_SYSTEM_POLICIES) {
        const payload = sanitizePolicyForDb(p);
        let existingId: number | undefined;

        // Ưu tiên tìm theo parameter_type và name
        const { data: byName } = await supabase
          .from('policies')
          .select('id')
          .eq('parameter_type', p.parameter_type)
          .eq('name', p.name)
          .limit(1);

        if (byName && byName.length > 0) {
          existingId = byName[0].id;
        } else {
          // Nếu không thấy theo name, tìm theo parameter_type và effective_date
          const { data: byDate } = await supabase
            .from('policies')
            .select('id')
            .eq('parameter_type', p.parameter_type)
            .eq('effective_date', p.effective_date)
            .limit(1);
          if (byDate && byDate.length > 0) {
            existingId = byDate[0].id;
          }
        }

        if (existingId) {
          const { error: upErr } = await supabase.from('policies').update({
            name: payload.name,
            value: payload.value,
            effective_date: payload.effective_date,
            notes: payload.notes,
            description: payload.notes,
            is_active: payload.is_active
          }).eq('id', existingId);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase.from('policies').insert([payload]);
          if (insErr) throw insErr;
        }
      }
      await fetchData();
      return true;
    } catch (err: any) {
      console.error('[DataContext] syncDefaultPolicies error:', err);
      throw err;
    }
  }, [fetchData]);

  const value = useMemo<DataContextType>(() => ({
    records: recordsLive,
    customers: customersLive,
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
    recordsLive,
    customersLive,
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
