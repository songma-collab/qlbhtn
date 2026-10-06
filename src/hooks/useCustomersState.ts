import { useState, useCallback } from 'react';
import type { CustomerType, RecordType } from '../context/types';
import type { CustomerStatus } from '../utils/customerStatus';
import { customerService } from '../services/customerService';
import { recordService } from '../services/recordService';

export interface UseCustomersStateOptions {
  currentUser?: any;
  isAdmin?: boolean;
  recordsLive?: RecordType[];
  addAuditLog?: (action: string, detail: string) => void;
  showAlert?: (title: string, message: string, type?: any) => void;
  showToast?: (message: string, type?: any) => void;
  onCustomerChanged?: () => void;
}

export function useCustomersState(options: UseCustomersStateOptions = {}) {
  const {
    currentUser,
    isAdmin = false,
    recordsLive = [],
    addAuditLog,
    showAlert,
    showToast,
    onCustomerChanged
  } = options;

  const [customers, setCustomers] = useState<CustomerType[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  const fetchCustomers = useCallback(async (): Promise<CustomerType[]> => {
    setIsLoadingCustomers(true);
    try {
      const staffId = !isAdmin && currentUser?.id ? currentUser.id : undefined;
      const data = await customerService.fetchAllCustomers({ staff_id: staffId, limit: 2500 });
      setCustomers(data);
      return data;
    } catch (err) {
      console.warn('[useCustomersState] fetchCustomers error:', err);
      return [];
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [currentUser?.id, isAdmin]);

  const updateCustomerStatus = useCallback(async (
    recordId: number, 
    newStatus: CustomerStatus, 
    reason?: string
  ): Promise<boolean> => {
    try {
      const targetRecord = recordsLive.find(r => r.id === recordId);
      if (!targetRecord) {
        showAlert?.('Không tìm thấy', 'Không tìm thấy hồ sơ khách hàng cần đổi trạng thái.');
        return false;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const reasonText = reason?.trim() ? ` [Lý do: ${reason.trim()}]` : '';
      const existingNotes = targetRecord.notes || '';
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n[${todayStr}] Đổi trạng thái -> ${newStatus}${reasonText}`
        : `[${todayStr}] Đổi trạng thái -> ${newStatus}${reasonText}`;

      const { error: recErr } = await recordService.updateRecordStatusAndNotes(recordId, newStatus, updatedNotes);
      if (recErr) throw recErr;

      const customerKey = (targetRecord as any).customer_key || (targetRecord as any).customerKey;
      if (customerKey) {
        try {
          await customerService.updateCustomerStatus(customerKey, newStatus);
        } catch (syncErr) {
          console.warn('[useCustomersState] Failed to sync status to customer master:', syncErr);
        }
      }

      await fetchCustomers();
      onCustomerChanged?.();

      addAuditLog?.(
        'Đổi trạng thái khách hàng',
        `Chuyển trạng thái khách hàng "${targetRecord.name}" sang "${newStatus}".${reasonText}`
      );
      return true;
    } catch (error: any) {
      console.error('[useCustomersState] Error updating customer status:', error);
      showAlert?.('Lỗi cập nhật trạng thái', error.message || 'Không thể cập nhật trạng thái khách hàng.');
      return false;
    }
  }, [addAuditLog, fetchCustomers, onCustomerChanged, recordsLive, showAlert]);

  const updateCustomerParticipation = useCallback(async (
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string | undefined;
    }
  ): Promise<boolean> => {
    try {
      const res = await customerService.updateCustomerParticipation(targetIdOrKey, data);
      if (!res.success) {
        throw res.error || new Error('Không thể lưu hồ sơ quá trình tham gia.');
      }

      setCustomers(prev => prev.map(c => {
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

      addAuditLog?.(
        'Cập nhật hồ sơ tham gia',
        `Cập nhật quá trình tham gia của khách hàng [${targetIdOrKey}]: ${data.prior_compulsory_months} tháng bắt buộc, ${data.prior_voluntary_months} tháng tự nguyện ngoài.`
      );
      showToast?.('Đã lưu hồ sơ quá trình tham gia thành công!', 'success');
      onCustomerChanged?.();
      return true;
    } catch (err: any) {
      console.error('[useCustomersState] updateCustomerParticipation error:', err);
      showAlert?.('Lỗi cập nhật hồ sơ', err.message || 'Không thể lưu hồ sơ quá trình tham gia của khách hàng.', 'error');
      return false;
    }
  }, [addAuditLog, onCustomerChanged, showAlert, showToast]);

  const deleteCustomer = useCallback(async (customerKey: string): Promise<boolean> => {
    try {
      if (!customerKey) {
        showAlert?.('Lỗi xóa khách hàng', 'Không xác định được mã định danh khách hàng cần xóa.', 'error');
        return false;
      }
      const res = await customerService.deleteCustomerCascade(customerKey);
      if (!res.success && res.error) {
        console.warn('[useCustomersState] RPC delete_customer_cascade failed, executing direct cascade fallback:', res.error);
        const fbRes = await customerService.deleteCustomerCascadeFallback(customerKey);
        if (!fbRes.success) throw fbRes.error;
      } else if (!res.success) {
        showAlert?.('Từ chối xóa khách hàng', res.message || 'Không thể xóa khách hàng do ràng buộc an toàn dữ liệu.', 'warning');
        return false;
      }

      setCustomers(prev => prev.filter(c => 
        c.customer_key !== customerKey && 
        (c as any).customerKey !== customerKey &&
        c.cccd !== customerKey &&
        c.bhxh !== customerKey &&
        c.phone !== customerKey
      ));

      await fetchCustomers();
      onCustomerChanged?.();
      return true;
    } catch (error: any) {
      console.error('[useCustomersState] Error deleting customer:', error);
      showAlert?.('Lỗi xóa hồ sơ khách hàng', error.message || 'Hệ thống từ chối xóa hồ sơ khách hàng này.', 'error');
      return false;
    }
  }, [fetchCustomers, onCustomerChanged, showAlert]);

  const fetchCustomerByCode = useCallback(async (code: string): Promise<any> => {
    const clean = (code || '').replace(/\D/g, '');
    if (!clean || (clean.length !== 9 && clean.length !== 10 && clean.length !== 12)) return null;

    const matchedCustomer = customers.find(c => {
      const cCccd = (c.cccd || '').replace(/\D/g, '');
      const cBhxh = (c.bhxh || '').replace(/\D/g, '');
      const cOld = (c.old_bhxh || (c as any).oldBhxh || '').replace(/\D/g, '');
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
        old_bhxh: matchedCustomer.old_bhxh || (matchedCustomer.bhxh && matchedCustomer.bhxh.length === 10 ? matchedCustomer.bhxh : ''),
        customer_id: matchedCustomer.id,
        customer_key: matchedCustomer.customer_key,
        source: 'Danh bạ Khách hàng (Customers Master)'
      };
    }

    try {
      const custData = await customerService.findCustomerByCode(clean);
      if (custData) {
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
          old_bhxh: custData.old_bhxh || (custData.bhxh && custData.bhxh.length === 10 ? custData.bhxh : ''),
          customer_id: custData.id,
          customer_key: custData.customer_key,
          source: 'CSDL Khách hàng Supabase'
        };
      }
    } catch (err) {
      console.warn('[useCustomersState] Query customers error:', err);
    }

    try {
      const found = await customerService.lookupCustomerProfile(clean);
      if (found) {
        return {
          ...found,
          old_bhxh: found.old_bhxh,
          source: 'RPC Định danh Khách hàng'
        };
      }
    } catch (e) {
      console.warn('[useCustomersState] RPC error:', e);
    }

    return null;
  }, [customers]);

  return {
    customers,
    setCustomers,
    isLoadingCustomers,
    fetchCustomers,
    updateCustomerStatus,
    updateCustomerParticipation,
    deleteCustomer,
    fetchCustomerByCode
  };
}
