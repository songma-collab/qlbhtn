import { useState, useCallback } from 'react';
import type { RecordType, Policy } from '../context/types';
import { recordService, customerService } from '../services';
import { isDateLocked, checkFinancialLockViolation } from '../utils/helpers';

export interface UseRecordsStateOptions {
  currentUser?: any;
  isAdmin?: boolean;
  policies?: Policy[];
  addAuditLog?: (action: string, detail: string) => void;
  showAlert?: (title: string, message: string, type?: any) => void;
  showToast?: (message: string, type?: any) => void;
  onRecordChanged?: () => void;
}

export function useRecordsState(options: UseRecordsStateOptions = {}) {
  const {
    currentUser,
    isAdmin = false,
    policies = [],
    addAuditLog,
    showAlert,
    showToast,
    onRecordChanged
  } = options;

  const [records, setRecords] = useState<RecordType[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);

  const getLockedKeys = useCallback((policiesList: Policy[]): string[] => {
    const p = policiesList.find(x => x.parameter_type === 'locked_periods' && x.is_active);
    if (!p) return [];
    if (Array.isArray(p.value)) return p.value;
    if (p.value && Array.isArray(p.value.lockedKeys)) return p.value.lockedKeys;
    return [];
  }, []);

  const fetchRecords = useCallback(async (): Promise<RecordType[]> => {
    setIsLoadingRecords(true);
    try {
      const staffId = !isAdmin && currentUser?.id ? currentUser.id : undefined;
      const data = await recordService.fetchAllRecords({ staff_id: staffId, limit: 2500 });
      setRecords(data);
      return data;
    } catch (err) {
      console.warn('[useRecordsState] fetchRecords error:', err);
      return [];
    } finally {
      setIsLoadingRecords(false);
    }
  }, [currentUser?.id, isAdmin]);

  const addRecord = useCallback(async (newRecordData: Omit<RecordType, 'id'>): Promise<RecordType | null> => {
    try {
      if (isDateLocked(newRecordData.date, getLockedKeys(policies))) {
        showAlert?.('Dữ liệu đã bị khóa', `Kỳ tài chính của ngày "${newRecordData.date || ''}" đã BỊ KHÓA DỮ LIỆU. Không thể tạo mới hồ sơ thuộc kỳ này.`);
        return null;
      }

      const { data, error } = await recordService.createRecord(newRecordData);
      if (error) throw error;

      await fetchRecords();
      onRecordChanged?.();
      if (data) {
        addAuditLog?.('Tạo hồ sơ mới', `Tạo hồ sơ ${data.type || ''} cho khách hàng ${data.name || ''}`);
      }
      return data;
    } catch (error: any) {
      console.error('[useRecordsState] Error adding record:', error);
      throw error;
    }
  }, [addAuditLog, fetchRecords, getLockedKeys, onRecordChanged, policies, showAlert]);

  const bulkPutRecords = useCallback(async (recordsList: RecordType[]): Promise<boolean> => {
    try {
      const lockedKeysList = getLockedKeys(policies);
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
          const orig = records.find(r => r.id === item.id);
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
        showAlert?.('Dữ liệu đã bị khóa', `Tất cả ${rejectedLockedItems.length} hồ sơ trong danh sách thuộc kỳ tài chính đã BỊ KHÓA SỔ. Không được phép thay đổi thông tin tài chính.`);
        return false;
      }

      if (allowedItems.length > 0) {
        const { error } = await recordService.bulkPutRecords(allowedItems);
        if (error) throw error;
      }

      await fetchRecords();
      onRecordChanged?.();

      if (rejectedLockedItems.length > 0) {
        showAlert?.(
          'Dữ liệu đã bị khóa (Bỏ qua hồ sơ vi phạm)',
          `Đã nhập/cập nhật thành công ${allowedItems.length} hồ sơ hợp lệ.\n\nBỏ qua ${rejectedLockedItems.length} hồ sơ do vi phạm khóa sổ tài chính (kỳ đã khóa).`,
          'warning'
        );
      }

      return true;
    } catch (error: any) {
      console.error('[useRecordsState] Error bulk putting records:', error);
      throw error;
    }
  }, [fetchRecords, getLockedKeys, onRecordChanged, policies, records, showAlert]);

  const updateRecord = useCallback(async (id: number, updatedFields: Partial<RecordType>): Promise<boolean> => {
    try {
      const targetRecord = records.find(r => r.id === id);
      if (targetRecord) {
        const lockedKeysList = getLockedKeys(policies);
        if (isDateLocked(targetRecord.date, lockedKeysList)) {
          const lockViolation = checkFinancialLockViolation(targetRecord, updatedFields, lockedKeysList);
          if (lockViolation.isViolated) {
            showAlert?.(
              'Kỳ tài chính đã bị khóa',
              `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã BỊ KHÓA SỔ. Không được phép chỉnh sửa các thông tin tài chính (${lockViolation.violatedFields.join(', ')}). Chỉ được phép cập nhật thông tin liên lạc / ghi chú.`
            );
            return false;
          }
        } else if (updatedFields.date && isDateLocked(updatedFields.date, lockedKeysList)) {
          showAlert?.(
            'Kỳ tài chính đã bị khóa',
            `Không thể chuyển ngày giao dịch sang ngày "${updatedFields.date}" vì kỳ này đã BỊ KHÓA SỔ.`
          );
          return false;
        }
      }

      const { error } = await recordService.updateRecord(id, updatedFields);
      if (error) throw error;

      await fetchRecords();
      onRecordChanged?.();
      if (targetRecord) {
        addAuditLog?.('Cập nhật hồ sơ', `Cập nhật thông tin hồ sơ khách hàng ${targetRecord.name}`);
      }
      return true;
    } catch (error: any) {
      console.error('[useRecordsState] Error updating record:', error);
      showAlert?.('Lỗi cập nhật hồ sơ', error.message || 'Hệ thống từ chối cập nhật hồ sơ.');
      return false;
    }
  }, [addAuditLog, fetchRecords, getLockedKeys, onRecordChanged, policies, records, showAlert]);

  const deleteRecord = useCallback(async (id: number): Promise<boolean> => {
    try {
      const targetRecord = records.find(r => r.id === id);
      const isSub = (targetRecord as any)?.is_submitted_bhxh !== undefined ? (targetRecord as any)?.is_submitted_bhxh : (targetRecord as any)?.isSubmittedBHXH;
      if (isSub) {
        showAlert?.('Hồ sơ đã chuyển BHXH', `Hồ sơ "${targetRecord?.name}" ĐÃ ĐƯỢC CHUYỂN BHXH. Bạn không thể xóa hồ sơ này.`, 'warning');
        return false;
      }
      if (targetRecord && isDateLocked(targetRecord.date, getLockedKeys(policies))) {
        showAlert?.('Dữ liệu đã bị khóa', `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã BỊ KHÓA DỮ LIỆU. Không thể xóa.`, 'warning');
        return false;
      }

      const res = await recordService.deleteRecord(id);
      if (!res.success) {
        showAlert?.('Từ chối xóa giao dịch', res.message || 'Hệ thống từ chối xóa giao dịch này.', 'warning');
        return false;
      }

      const remainingRecords = records.filter(r => r.id !== id);
      setRecords(remainingRecords);
      await fetchRecords();
      onRecordChanged?.();
      if (targetRecord) {
        addAuditLog?.('Xóa hồ sơ', `Xóa hồ sơ khách hàng ${targetRecord.name}`);
        // Chữa lành và đồng bộ lại danh bạ khách hàng
        const custKey = targetRecord.customer_key || (targetRecord as any).customerKey;
        customerService.resyncCustomerFromRecords(
          {
            customerKey: custKey,
            cccd: targetRecord.cccd,
            bhxh: targetRecord.bhxh,
            phone: targetRecord.phone
          },
          remainingRecords
        ).catch(e => console.warn('[useRecordsState] resyncCustomerFromRecords failed:', e));
      }
      return true;
    } catch (error: any) {
      console.error('[useRecordsState] Error deleting record:', error);
      showAlert?.('Lỗi xóa hồ sơ', error.message || 'Hệ thống từ chối xóa giao dịch này.', 'error');
      return false;
    }
  }, [addAuditLog, fetchRecords, getLockedKeys, onRecordChanged, policies, records, showAlert]);

  const bulkDeleteRecords = useCallback(async (ids: number[]): Promise<boolean> => {
    try {
      const submittedList = records.filter(r => {
        const isSub = (r as any).is_submitted_bhxh !== undefined ? (r as any).is_submitted_bhxh : (r as any).isSubmittedBHXH;
        return ids.includes(r.id) && isSub;
      });
      if (submittedList.length > 0) {
        showAlert?.('Hồ sơ đã chuyển BHXH', `Có ${submittedList.length} hồ sơ trong danh sách ĐÃ ĐƯỢC CHUYỂN BHXH. Bạn không thể xóa các hồ sơ này. Vui lòng bỏ chọn trước khi xóa.`, 'warning');
        return false;
      }
      const lockedList = records.filter(r => ids.includes(r.id) && isDateLocked(r.date, getLockedKeys(policies)));
      if (lockedList.length > 0) {
        showAlert?.('Dữ liệu đã bị khóa', `Có ${lockedList.length} hồ sơ trong danh sách thuộc kỳ tài chính đã BỊ KHÓA DỮ LIỆU. Vui lòng bỏ chọn các hồ sơ bị khóa trước khi xóa.`, 'warning');
        return false;
      }

      const res = await recordService.bulkDeleteRecords(ids);
      if (!res.success) {
        showAlert?.('Từ chối xóa hàng loạt', res.message || 'Không có hồ sơ nào được xóa.', 'warning');
        return false;
      }

      const remainingRecords = records.filter(r => !ids.includes(r.id));
      setRecords(remainingRecords);
      await fetchRecords();
      onRecordChanged?.();

      const affectedKeys = new Set<string>();
      records.filter(r => ids.includes(r.id)).forEach(r => {
        const key = r.customer_key || (r as any).customerKey || r.cccd || r.bhxh;
        if (key) affectedKeys.add(key);
      });
      for (const k of affectedKeys) {
        customerService.resyncCustomerFromRecords(
          { customerKey: k, cccd: k, bhxh: k },
          remainingRecords
        ).catch(() => {});
      }
      return true;
    } catch (error: any) {
      console.error('[useRecordsState] Error bulk deleting records:', error);
      showAlert?.('Lỗi xóa hàng loạt', error.message || 'Không thể xóa các hồ sơ được chọn.', 'error');
      return false;
    }
  }, [fetchRecords, getLockedKeys, onRecordChanged, policies, records, showAlert]);

  const cancelRecordWithClawback = useCallback(async (recordId: number, reason: string, currentUserRole?: string): Promise<boolean> => {
    try {
      const role = currentUserRole || currentUser?.role;
      const isHoc = (currentUser?.name || '').toLowerCase().includes('phạm văn học') || (currentUser?.name || '').toLowerCase().includes('pham van hoc');
      const hasPerm = role === 'Admin' || role === 'admin' || role === 'Quản lý' || isHoc;
      if (!hasPerm) {
        showAlert?.('Từ chối quyền hạn', 'Chỉ Quản lý hoặc Admin mới có quyền hủy giao dịch đã thu tiền / điều chỉnh hoa hồng.');
        return false;
      }

      const targetRecord = records.find(r => r.id === recordId);
      if (!targetRecord) {
        showAlert?.('Không tìm thấy', 'Không tìm thấy hồ sơ giao dịch cần hủy.');
        return false;
      }

      const pStatus = (targetRecord as any).payment_status || (targetRecord as any).paymentStatus;
      if (pStatus === 'Đã hủy') {
        showAlert?.('Đã hủy trước đó', `Giao dịch "${targetRecord.name}" đã ở trạng thái Đã hủy.`);
        return false;
      }

      const isSub = (targetRecord as any).is_submitted_bhxh !== undefined ? (targetRecord as any).is_submitted_bhxh : (targetRecord as any).isSubmittedBHXH;
      const subBatch = (targetRecord as any).submission_batch || (targetRecord as any).submissionBatch;
      if (isSub) {
        showAlert?.('Hồ sơ đã chuyển BHXH', `Hồ sơ "${targetRecord.name}" ĐÃ ĐƯỢC CHUYỂN BHXH (${subBatch || 'Đã nộp'}). Vui lòng hủy đợt nộp BHXH trước khi hủy giao dịch.`);
        return false;
      }

      const lockedKeysList = getLockedKeys(policies);
      const isLocked = isDateLocked(targetRecord.date, lockedKeysList);

      if (isLocked) {
        showAlert?.(
          'Kỳ tài chính đã khóa sổ',
          `Hồ sơ "${targetRecord.name}" thuộc kỳ tài chính đã chốt khóa sổ (${targetRecord.date ? String(targetRecord.date).slice(0, 7) : ''}). Hệ thống không tự động tạo bút toán bù trừ khi hủy giao dịch. Vui lòng sử dụng chức năng "Lập Bút Toán Thoái Thu" trong mục Báo Cáo & Chốt Sổ với đầy đủ Số Quyết Định và Ngày Quyết Định để thoái thu hoàn trả theo đúng quy định kế toán.`,
          'warning'
        );
        return false;
      } else {
        const { error: updErr } = await recordService.cancelRecord(targetRecord.id, reason, targetRecord.notes);
        if (updErr) throw updErr;

        addAuditLog?.('Hủy giao dịch', `Đã hủy giao dịch #${targetRecord.id} của khách hàng ${targetRecord.name}. Lý do: ${reason || 'Không có'}`);
        await fetchRecords();
        onRecordChanged?.();

        const remainingRecords = records.map(r => r.id === targetRecord.id ? { ...r, payment_status: 'Đã hủy' as const } : r);
        const custKey = targetRecord.customer_key || (targetRecord as any).customerKey;
        customerService.resyncCustomerFromRecords(
          {
            customerKey: custKey,
            cccd: targetRecord.cccd,
            bhxh: targetRecord.bhxh,
            phone: targetRecord.phone
          },
          remainingRecords
        ).catch(() => {});

        showToast?.('Đã hủy giao dịch thành công!', 'success');
        return true;
      }
    } catch (error: any) {
      console.error('[useRecordsState] Error cancelling record with clawback:', error);
      showAlert?.('Lỗi khi hủy giao dịch', error.message || 'Có lỗi xảy ra', 'error');
      return false;
    }
  }, [addAuditLog, currentUser?.name, currentUser?.role, fetchRecords, getLockedKeys, onRecordChanged, policies, records, showAlert, showToast]);

  const fetchCustomerTransactions = useCallback(async (customerIdOrKey: string): Promise<RecordType[]> => {
    try {
      if (!customerIdOrKey) return [];
      const clean = customerIdOrKey.trim();
      const dbRecords = await recordService.fetchCustomerTransactions(clean);
      if (dbRecords && dbRecords.length > 0) return dbRecords;

      return records.filter(r => 
        (r as any).customer_id === clean || 
        (r as any).customerId === clean || 
        (r as any).customer_key === clean || 
        (r as any).customerKey === clean || 
        (r.cccd && r.cccd === clean) || 
        (r.bhxh && r.bhxh === clean)
      );
    } catch (err) {
      console.warn('[useRecordsState] fetchCustomerTransactions failed:', err);
      const clean = (customerIdOrKey || '').trim();
      return records.filter(r => 
        (r as any).customer_id === clean || 
        (r as any).customerId === clean || 
        (r as any).customer_key === clean || 
        (r as any).customerKey === clean || 
        (r.cccd && r.cccd === clean) || 
        (r.bhxh && r.bhxh === clean)
      );
    }
  }, [records]);

  return {
    records,
    setRecords,
    isLoadingRecords,
    fetchRecords,
    addRecord,
    bulkPutRecords,
    updateRecord,
    deleteRecord,
    bulkDeleteRecords,
    cancelRecordWithClawback,
    fetchCustomerTransactions,
    getLockedKeys
  };
}
