import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { customerService, recordService } from '../../services';
import { 
  formatDateVN, 
  parseDateISO, 
  parseMonthISO, 
  formatMonthVN, 
  getLocalYYYYMMDD, 
  formatMoney, 
  getHistoryForCustomer, 
  formatTitleCase, 
  groupRecordsByCustomer, 
  getOldBhxh10 
} from '../../utils/helpers';
import { 
  maskCCCD, 
  maskPhone, 
  maskBHXH, 
  maskName, 
  maskAddress 
} from '../../utils/security';
import { 
  FileDown, 
  FileUp, 
  Plus, 
  Edit, 
  Trash2, 
  Zap, 
  Phone, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  UserPlus, 
  Copy, 
  Eye, 
  EyeOff, 
  QrCode, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  HeartPulse, 
  UserCheck, 
  Layers, 
  History, 
  Contact, 
  LayoutList, 
  CheckCircle2, 
  Search, 
  X, 
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { isSafeColumnKey, protectWorksheetFormulas, validateExcelFile, validateImportRows } from '../../utils/excelSecurity';
import { parseExcelRows, ParsedExcelResult } from '../../utils/excelImportHelper';
import RegisterModal from '../modals/RegisterModal';
import ConfirmModal from '../modals/ConfirmModal';
import SearchResultModal from '../modals/SearchResultModal';
import { VietQRModal } from '../modals/VietQRModal';
import { exportD03TSStandardExcel, exportD05TSStandardExcel } from '../../utils/exportNationalStandardForms';
import { CustomerStatusBadge, CustomerParticipationBadge } from '../common/CustomerStatusBadge';
import { CustomerStatusModal } from '../modals/CustomerStatusModal';
import { CustomerParticipationModal } from '../modals/CustomerParticipationModal';
import { useRecordFilters } from '../../hooks/useRecordFilters';
import { CustomerFilterBar } from './crm/CustomerFilterBar';
import { VirtualizedRecordTable } from '../common/VirtualizedRecordTable';
import { hasPermission } from '../../utils/permissions';
import { CustomerDirectoryCard } from './crm/CustomerDirectoryCard';
import { CustomerTableView } from './crm/CustomerTableView';
import { AssignStaffModal } from './crm/AssignStaffModal';
import { ExcelImportConfirmModal } from './crm/ExcelImportConfirmModal';

export interface CRMViewProps {
  type?: 'BHXH' | 'BHYT' | 'ALL' | string;
}

export const CRMView: React.FC<CRMViewProps> = ({ type = 'ALL' }) => {
  const { 
    records, 
    fetchCustomerTransactions, 
    bulkDeleteRecords, 
    deleteCustomer,
    deleteRecord,
    bulkPutRecords, 
    updateCustomerStatus,
    showToast, 
    showAlert, 
    currentUser, 
    settings,
    addAuditLog, 
    crmFilter, 
    setCrmFilter, 
    staff,
    policies,
    refreshData
  } = useAppContext();

  // Kiểm tra quyền hạn phân quyền theo RBAC
  const canDeleteCustomer = hasPermission(currentUser, 'customers.delete', settings);
  const canEditCustomer = hasPermission(currentUser, 'customers.edit', settings);
  const canCreateCustomer = hasPermission(currentUser, 'customers.create', settings);
  const canExportCustomers = hasPermission(currentUser, 'customers.export', settings);
  const isAdminOrManager = Boolean(
    currentUser?.role === 'Admin' || 
    currentUser?.role === 'admin' || 
    currentUser?.role === 'Quản lý'
  );

  // Chế độ hiển thị: Danh bạ liên hệ (Directory) vs Bảng quản trị (Table)
  const [viewMode, setViewMode] = useState<'table' | 'directory'>('table');
  
  // Trạng thái bảo vệ PII (Nghị định 13/2023/NĐ-CP): Mặc định hiển thị rõ cho tài khoản đã đăng nhập
  const [isPIIMasked, setIsPIIMasked] = useState<boolean>(false);
  const [revealedRowIds, setRevealedRowIds] = useState<Set<number>>(new Set());

  // Lựa chọn phân loại loại hình nếu component gọi dạng ALL
  const [selectedType, setSelectedType] = useState<string>(type || 'ALL');

  useEffect(() => {
    if (type) setSelectedType(type);
  }, [type]);

  const [statusModalRecord, setStatusModalRecord] = useState<any | null>(null);
  const [participationRecord, setParticipationRecord] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [useVirtualization, setUseVirtualization] = useState(false);

  // Modal tra cứu quá trình lịch sử khách hàng
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalResults, setSearchModalResults] = useState<any[]>([]);
  const [searchModalCode, setSearchModalCode] = useState('');

  // VietQR Modal
  const [vietQrRecord, setVietQrRecord] = useState<any | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleViewHistory = async (customer: any) => {
    const code = (customer.bhxh || customer.cccd || customer.customer_key || '').trim();
    const customerIdentifier = customer.customerId || customer.id || customer.customer_key || customer.cccd || customer.bhxh;
    
    // Tìm trong records cục bộ trước để mở modal ngay lập tức
    const localHistory = getHistoryForCustomer(customer, records);
    setSearchModalResults(localHistory);
    setSearchModalCode(code || customer.name || '---');
    setSearchModalOpen(true);

    // Truy vấn dữ liệu toàn bộ giao dịch từ bảng records theo customerId / customerKey
    if (fetchCustomerTransactions && customerIdentifier) {
      try {
        const fullHistory = await fetchCustomerTransactions(String(customerIdentifier));
        if (fullHistory && fullHistory.length > 0) {
          setSearchModalResults(fullHistory);
        }
      } catch (err) {
        console.warn('Lỗi khi tải lịch sử giao dịch khách hàng:', err);
      }
    }
  };

  // 1. Gom nhóm khách hàng duy nhất (1 khách hàng = 1 hồ sơ mới nhất)
  const baseCustomerList = useMemo(() => {
    if (!records || records.length === 0) return [];
    return groupRecordsByCustomer(records, selectedType);
  }, [records, selectedType]);

  // Thống kê danh bạ nhanh
  const directoryStats = useMemo(() => {
    const total = baseCustomerList.length;
    const active = baseCustomerList.filter(c => (c.status || 'Đang tham gia') === 'Đang tham gia').length;
    const stopped = total - active;
    const bhxhCount = baseCustomerList.filter(c => c.type === 'BHXH').length;
    const bhytCount = baseCustomerList.filter(c => c.type === 'BHYT').length;
    return { total, active, stopped, bhxhCount, bhytCount };
  }, [baseCustomerList]);

  // 2. Tích hợp hook quản lý bộ lọc chuyên nghiệp với debounce
  const storageKey = `bhxh_crm_view_filter_${selectedType}`;
  const filterOptions = useMemo(() => ({ currentUser }), [currentUser?.id, currentUser?.role]);
  const {
    filterState,
    updateFilter,
    resetFilters,
    submissionBatches,
    quickPillCounts,
    filteredRecords: uniqueCustomersList
  } = useRecordFilters(baseCustomerList, storageKey, filterOptions);

  // Chế độ Server-Side Pagination & Search (Hiệu năng cao, mở rộng > 100k bản ghi)
  const [serverSideMode, setServerSideMode] = useState<boolean>(true);
  const [serverCustomers, setServerCustomers] = useState<any[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState<number>(0);
  const [isServerLoading, setIsServerLoading] = useState<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;
    const loadServerCustomers = async () => {
      setIsServerLoading(true);
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const res = await customerService.searchCustomersServer({
          type: selectedType,
          search: filterState.searchQuery,
          staffId: filterState.staffId === 'all' || filterState.staffId === 'ALL' ? undefined : filterState.staffId,
          status: filterState.customerStatus === 'ALL' ? undefined : filterState.customerStatus,
          fromDate: filterState.customStartDate,
          toDate: filterState.customEndDate,
          limit: itemsPerPage,
          offset: offset,
        });

        if (isSubscribed && !res.error && res.totalCount > 0) {
          setServerCustomers(res.data);
          setServerTotalCount(res.totalCount);
        } else if (isSubscribed && (res.error || res.totalCount === 0)) {
          setServerTotalCount(0);
        }
      } catch (err) {
        console.warn('Fallback to client BFS grouping:', err);
        if (isSubscribed) setServerTotalCount(0);
      } finally {
        if (isSubscribed) setIsServerLoading(false);
      }
    };

    if (serverSideMode) {
      loadServerCustomers();
    }
    return () => {
      isSubscribed = false;
    };
  }, [
    serverSideMode,
    selectedType,
    currentPage,
    itemsPerPage,
    filterState.searchQuery,
    filterState.staffId,
    filterState.customerStatus,
    filterState.customStartDate,
    filterState.customEndDate,
  ]);

  const useServerData = serverSideMode && serverTotalCount > 0;
  const filteredRecords = uniqueCustomersList;
  const totalCount = useServerData ? serverTotalCount : uniqueCustomersList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = useMemo(() => {
    if (useServerData && serverCustomers.length > 0) {
      return [...serverCustomers].sort((a, b) => {
        const dateA = new Date(a.latest_date || a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.latest_date || b.date || b.created_at || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
    }
    return uniqueCustomersList.slice(startIdx, startIdx + itemsPerPage);
  }, [useServerData, serverCustomers, uniqueCustomersList, startIdx, itemsPerPage]);

  // Reset trang nếu vượt quá
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Nhận diện kiểu định danh đang tìm kiếm
  const detectedSearchType = useMemo(() => {
    const q = (filterState.searchQuery || '').trim();
    if (!q) return null;
    const isDigitsOnly = /^\d+$/.test(q);
    if (isDigitsOnly) {
      if (q.length === 12) return { label: 'Định danh CCCD (12 số)', color: 'text-blue-700 bg-blue-50 border-blue-200' };
      if (q.length === 9) return { label: 'CMND (9 số)', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
      if (q.length === 10) {
        if (q.startsWith('0')) return { label: 'Số Điện Thoại (10 số)', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
        return { label: 'Mã số BHXH (10 số)', color: 'text-sky-700 bg-sky-50 border-sky-200' };
      }
      if (q.startsWith('0')) return { label: 'Số Điện Thoại', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    return { label: 'Họ và tên / Từ khóa', color: 'text-slate-700 bg-slate-100 border-slate-200' };
  }, [filterState.searchQuery]);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerType, setRegisterType] = useState<'BHXH' | 'BHYT'>('BHXH');
  const [registerRecord, setRegisterRecord] = useState<any | null>(null);
  const [isRenew, setIsRenew] = useState(false);
  const [importConfirmData, setImportConfirmData] = useState<ParsedExcelResult | null>(null);
  const [importConfirmFileName, setImportConfirmFileName] = useState<string>('');
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignStaffId, setAssignStaffId] = useState('');

  // Điều hướng filter từ bên ngoài
  useEffect(() => {
    const filterStatus = typeof crmFilter === 'object' && crmFilter !== null ? (crmFilter as any).status : crmFilter;
    if (filterStatus && filterStatus !== 'all' && filterStatus !== 'ALL') {
      if (filterStatus === 'expiring') {
        updateFilter({ quickPill: 'UPCOMING_RENEWAL' });
      } else if (filterStatus === 'unsubmitted') {
        updateFilter({ quickPill: 'UNSUBMITTED' });
      } else if (filterStatus === 'pending') {
        updateFilter({ quickPill: 'PENDING_PAYMENT' });
      }
      setCrmFilter('all');
      setCurrentPage(1);
    }
  }, [crmFilter, setCrmFilter, updateFilter]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const openRegisterModal = (regType: 'BHXH' | 'BHYT', record: any | null = null, renew: boolean = false) => {
    setRegisterType(regType);
    let fullRecord = record;
    if (record && records && records.length > 0) {
      const cleanCccd = (record.cccd || record.citizenId || '').replace(/\D/g, '');
      const cleanBhxh = (record.bhxh || record.bhxhCode || (record.type === 'BHXH' ? record.code : '') || '').replace(/\D/g, '');
      const activeRecords = records.filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');
      const matched = activeRecords.filter(r => {
        if (record.latest_record_id && r.id === record.latest_record_id) return true;
        const rCccd = (r.cccd || '').replace(/\D/g, '');
        const rBhxh = (r.bhxh || '').replace(/\D/g, '');
        const rOld = (r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
        return (cleanCccd && rCccd === cleanCccd) || (cleanBhxh && rBhxh === cleanBhxh) || (cleanBhxh && rOld === cleanBhxh);
      });
      if (matched.length > 0) {
        // 1. Bản ghi có kỳ hạn mới nhất để tính kỳ gia hạn tiếp theo
        const sortedByContract = [...matched].sort((a, b) => {
          const nextA = new Date(a.next_payment || (a as any).nextPayment || 0).getTime();
          const nextB = new Date(b.next_payment || (b as any).nextPayment || 0).getTime();
          if (nextB !== nextA) return nextB - nextA;
          const toMA = a.to_month || (a as any).toMonth || '';
          const toMB = b.to_month || (b as any).toMonth || '';
          if (toMB !== toMA) return toMB.localeCompare(toMA);
          const dateA = new Date(a.date || a.created_at || 0).getTime();
          const dateB = new Date(b.date || b.created_at || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        const newestByContract = sortedByContract[0];

        // 2. Bản ghi có thời điểm CẬP NHẬT GẦN NHẤT (ưu tiên thông tin nhân khẩu mới nhất)
        const sortedByUpdate = [...matched].sort((a, b) => {
          const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
          const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
          if (upB !== upA) return upB - upA;
          const dateA = new Date(a.date || a.created_at || 0).getTime();
          const dateB = new Date(b.date || b.created_at || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        const newestByUpdate = sortedByUpdate[0];

        if (newestByContract && newestByUpdate) {
          const targetRecordId = typeof record.id === 'number' && !isNaN(record.id)
            ? record.id
            : (Number(record.latest_record_id) || newestByContract.id || newestByUpdate.id);

          fullRecord = {
            ...newestByContract,
            ...newestByUpdate,
            ...record,
            id: targetRecordId,
            name: record.name || newestByUpdate.name || newestByContract.name,
            phone: record.phone || newestByUpdate.phone || newestByContract.phone,
            address: record.address || newestByUpdate.address || newestByContract.address,
            dob: record.dob || newestByUpdate.dob || newestByContract.dob,
            gender: record.gender || newestByUpdate.gender || newestByContract.gender,
            nation: record.nation || newestByUpdate.nation || newestByContract.nation,
            email: record.email || newestByUpdate.email || newestByContract.email,
            recvName: record.recvName || (record as any).recvname || record.recv_name || newestByUpdate.recv_name || (newestByUpdate as any).recvName || newestByContract.recv_name || (newestByContract as any).recvName,
            recvPhone: record.recvPhone || (record as any).recvphone || record.recv_phone || newestByUpdate.recv_phone || (newestByUpdate as any).recvPhone || newestByContract.recv_phone || (newestByContract as any).recvPhone,
            recvAddress: record.recvAddress || (record as any).recvaddress || record.recv_address || newestByUpdate.recv_address || (newestByUpdate as any).recvAddress || newestByContract.recv_address || (newestByContract as any).recvAddress,
            income: record.income ?? newestByContract.income,
            method: record.method || newestByContract.method,
            fromMonth: record.fromMonth || (record as any).frommonth || record.from_month || newestByContract.from_month || (newestByContract as any).fromMonth,
            toMonth: record.toMonth || (record as any).tomonth || record.to_month || newestByContract.to_month || (newestByContract as any).toMonth,
            nextPayment: record.nextPayment || (record as any).next_payment || newestByContract.next_payment || (newestByContract as any).nextPayment,
            months: record.months ?? newestByContract.months,
            wage: record.wage ?? newestByContract.wage,
            nnSupportPct: record.nnSupportPct ?? record.nn_support_pct ?? newestByContract.nn_support_pct ?? (newestByContract as any).nnSupportPct,
            dpSupportPct: record.dpSupportPct ?? record.dp_support_pct ?? newestByContract.dp_support_pct ?? (newestByContract as any).dpSupportPct,
            members: (record.members && record.members.length > 0) ? record.members : (newestByUpdate.members || newestByContract.members)
          };
        }
      }
    }
    setRegisterRecord(fullRecord);
    setIsRenew(renew);
    setIsRegisterModalOpen(true);
  };

  const confirmDelete = (id: number) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (deletingId) {
      const recordToDelete = filteredRecords.find(r => r.id === deletingId);
      if (recordToDelete) {
        const customerKey = (recordToDelete.customer_key || recordToDelete.customerKey || recordToDelete.cccd || recordToDelete.bhxh || recordToDelete.phone || '').trim();
        let success = false;
        if (customerKey) {
          success = await deleteCustomer(customerKey);
        }
        if (!success && recordToDelete.id) {
          success = await deleteRecord(recordToDelete.id);
        }

        if (success) {
          addAuditLog('Xóa hồ sơ khách hàng', `Đã xóa khách hàng ${recordToDelete.name} và lịch sử giao dịch liên quan`);
          showToast('Đã xóa hồ sơ khách hàng và các giao dịch liên quan!', 'success');
        }
      }
      setIsConfirmOpen(false);
    }
  };

  const confirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    if (isBulkDeleting) return;
    setIsBulkDeleting(true);
    try {
      const recordsToDelete = filteredRecords.filter(r => selectedIds.includes(r.id));
      let successCount = 0;
      
      for (const rec of recordsToDelete) {
        const customerKey = rec.customer_key || rec.customerKey;
        if (customerKey) {
          const ok = await deleteCustomer(customerKey);
          if (ok) successCount++;
        }
      }

      if (successCount === 0 && recordsToDelete.length > 0) {
        const allIdsToDelete = new Set<number>();
        for (const recordToDelete of recordsToDelete) {
          if (recordToDelete.id) allIdsToDelete.add(recordToDelete.id);
          (records || []).forEach(r => {
            if (r.id && (
              (recordToDelete.bhxh && r.bhxh === recordToDelete.bhxh) ||
              (recordToDelete.cccd && r.cccd === recordToDelete.cccd) ||
              (recordToDelete.phone && r.phone === recordToDelete.phone)
            )) {
              allIdsToDelete.add(r.id);
            }
          });
        }
        const idArray = Array.from(allIdsToDelete);
        const ok = await bulkDeleteRecords(idArray);
        if (ok) successCount = recordsToDelete.length;
      }

      if (successCount > 0) {
        if (addAuditLog) {
          addAuditLog('Xóa hàng loạt', `Đã xóa ${successCount} khách hàng`);
        }
        setSelectedIds([]);
        showToast(`Đã xóa ${successCount} khách hàng thành công!`, 'success');
      }
      setIsBulkDeleteConfirmOpen(false);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      showAlert("Lỗi xóa dữ liệu", err.message || "Không thể xóa hồ sơ.", "error");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const openAssignModal = (id?: number) => {
    if (id) {
      setSelectedIds([id]);
    } else if (selectedIds.length === 0) {
      return;
    }
    setAssignStaffId('');
    setIsAssignModalOpen(true);
  };

  const executeAssignStaff = async () => {
    if (isAssigning || selectedIds.length === 0) return;
    setIsAssigning(true);
    try {
      const selectedRecords = filteredRecords.filter(r => selectedIds.includes(r.id));
      const targetCustomerKeys = Array.from(
        new Set(
          selectedRecords
            .map(r => r.customer_key || r.customerKey || r.cccd || r.bhxh || r.phone)
            .filter(Boolean)
        )
      );

      const staffTarget = staff.find((s: any) => s.id === assignStaffId);
      const staffName = staffTarget ? staffTarget.name : 'Chưa phân công';

      const totalUpdated = await customerService.assignStaffToCustomers(targetCustomerKeys, assignStaffId);
      await recordService.assignStaffToRecords(selectedIds, assignStaffId);

      addAuditLog?.(
        'Phân công khách hàng',
        `Đã phân công ${totalUpdated} khách hàng cho nhân viên: ${staffName}`
      );
      showToast(`Đã cập nhật phân công cho ${totalUpdated} khách hàng!`, 'success');
      setIsAssignModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Lỗi khi phân công nhân viên:', err);
      showAlert?.('Lỗi phân công', err.message || 'Không thể cập nhật nhân viên phụ trách', 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleExportD03TS = async () => {
    try {
      const byhtRecords = filteredRecords.filter(r => r.type === 'BHYT');
      if (byhtRecords.length === 0) {
        showAlert('Trống dữ liệu', 'Không có hồ sơ BHYT nào trong danh sách đang lọc để xuất mẫu D03-TS.', 'warning');
        return;
      }
      await exportD03TSStandardExcel({ records: byhtRecords, staffList: staff, periodLabel: 'Danh sách khách hàng' });
      addAuditLog?.('Xuất Mẫu D03-TS', `Đã xuất ${byhtRecords.length} hồ sơ BHYT ra biểu mẫu D03-TS chuẩn BHXH VN`);
      showToast('Đã xuất thành công Mẫu D03-TS chuẩn BHXH VN!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xuất D03-TS', err.message || '', 'error');
    }
  };

  const handleExportD05TS = async () => {
    try {
      const bhxhRecords = filteredRecords.filter(r => r.type === 'BHXH');
      if (bhxhRecords.length === 0) {
        showAlert('Trống dữ liệu', 'Không có hồ sơ BHXH nào trong danh sách đang lọc để xuất mẫu D05-TS.', 'warning');
        return;
      }
      await exportD05TSStandardExcel({ records: bhxhRecords, staffList: staff, periodLabel: 'Danh sách khách hàng' });
      addAuditLog?.('Xuất Mẫu D05-TS', `Đã xuất ${bhxhRecords.length} hồ sơ BHXH ra biểu mẫu D05-TS chuẩn BHXH VN`);
      showToast('Đã xuất thành công Mẫu D05-TS chuẩn BHXH VN!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xuất D05-TS', err.message || '', 'error');
    }
  };

  const exportExcel = async () => {
    if (filteredRecords.length === 0) {
      showAlert("Trống dữ liệu", "Không có dữ liệu nào để xuất ra file Excel vào lúc này.", "warning");
      return;
    }
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const data = filteredRecords.map((r: any) => {
      let isBHXH = r.type === 'BHXH' ? 'BHXH TN' : 'BHYT HGĐ';
      const staffName = r.staffId === 'admin' ? 'Admin (Tự đăng ký)' : (staff.find((s: any) => s.id === r.staffId)?.name || 'Hệ thống');
      const oldBhxh = getOldBhxh10(r, records);
      
      return {
        "Ngày đăng ký": formatDateVN(r.date),
        "Loại hình": isBHXH,
        "Mã BHXH": r.bhxh || "",
        "Mã BHXH cũ (10 số)": oldBhxh,
        "Họ và Tên": r.name || "",
        "Ngày sinh": formatDateVN(r.dob),
        "Giới tính": r.gender || "",
        "CCCD": r.cccd || "",
        "Số điện thoại": r.phone || "",
        "Email": r.email || "",
        "Địa chỉ": r.address || "",
        "Số tháng": Number(r.months || 0),
        "Từ tháng": formatMonthVN(r.fromMonth),
        "Đến tháng": formatMonthVN(r.toMonth),
        "Tổng Tiền": Number(r.amount || 0),
        "Trạng thái thanh toán": r.paymentStatus || "",
        "Trạng thái tham gia": r.status || "Đang tham gia",
        "Nhân viên": staffName,
        "Ghi chú": r.notes || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    protectWorksheetFormulas(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KhachHang");
    
    const fileName = `Danh_sach_Khach_hang_${selectedType}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    addAuditLog?.('Xuất danh sách khách hàng ra Excel', `Đã xuất ${data.length} hồ sơ ra file ${fileName}`);
    showToast("Xuất dữ liệu thành công!");
  };

  const handleExecuteFullImport = async (parsedData: ParsedExcelResult) => {
    setIsImporting(true);
    try {
      // Chỉ gửi mảng bản ghi mới cần insert (KHÔNG gửi [...records, ...])
      const res = await bulkPutRecords(parsedData.records);
      if (res) {
        addAuditLog?.('Nhập giao dịch & khách hàng từ Excel', `Đã nạp ${parsedData.records.length} giao dịch từ file ${importConfirmFileName}`);
        showToast(`Đồng bộ thành công ${parsedData.records.length} giao dịch và cập nhật danh bạ!`, 'success');
        setIsImportConfirmOpen(false);
        setImportConfirmData(null);
        await refreshData?.();
      } else {
        showAlert('Lỗi lưu trữ', 'Không thể lưu danh sách giao dịch lên hệ thống.', 'error');
      }
    } catch (err: any) {
      console.error('Lỗi khi đồng bộ toàn diện từ Excel:', err);
      showAlert('Lỗi nhập Excel', err.message || 'Định dạng dữ liệu không tương thích', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExecuteDirectoryOnlyImport = async (parsedData: ParsedExcelResult) => {
    setIsImporting(true);
    try {
      // 1. Thử upsert trực tiếp vào bảng customers trên Supabase để không sinh giao dịch trong records
      const { error } = await customerService.upsertCustomerProfiles(parsedData.customerProfiles);
      if (error) {
        console.warn('Direct customers upsert failed, fallback to profile-only records:', error);
        // Fallback: nếu schema chưa hỗ trợ direct upsert, tạo record dạng 'Hồ sơ gốc' không có số tiền giao dịch
        const profileRecords = parsedData.records.map(r => ({
          ...r,
          actionType: 'Hồ sơ gốc',
          amount: 0,
          commission: 0,
          wage: 0
        }));
        await bulkPutRecords(profileRecords);
      }
      addAuditLog?.('Nhập danh bạ khách hàng từ Excel', `Đã cập nhật ${parsedData.customerProfiles.length} hồ sơ từ file ${importConfirmFileName}`);
      showToast(`Đã cập nhật ${parsedData.customerProfiles.length} khách hàng vào Danh bạ thành công!`, 'success');
      setIsImportConfirmOpen(false);
      setImportConfirmData(null);
      await refreshData?.();
    } catch (err: any) {
      console.error('Lỗi khi cập nhật danh bạ từ Excel:', err);
      showAlert('Lỗi nhập Danh bạ', err.message || 'Không thể lưu vào danh bạ khách hàng', 'error');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateExcelFile(file);
    if (fileError) {
      showAlert("File không hợp lệ", fileError, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false, dateNF: 'dd/mm/yyyy' });
        const rowsError = validateImportRows(json);
        if (rowsError) {
          showAlert("Dữ liệu không hợp lệ", rowsError, "error");
          return;
        }

        const parsedResult = parseExcelRows(json as any[], {
          defaultType: (selectedType === 'BHYT' ? 'BHYT' : 'BHXH') as 'BHXH' | 'BHYT',
          staffList: staff,
          policies,
          settings,
          currentUserId: currentUser?.id
        });

        if (parsedResult.records.length === 0) {
          showAlert("Không tìm thấy dữ liệu", "Không có dòng dữ liệu hợp lệ nào được tìm thấy trong file.", "info");
          return;
        }

        setImportConfirmFileName(file.name);

        if (parsedResult.hasTransactionData) {
          // File có dữ liệu giao dịch đóng tiền -> Hiển thị Modal để người dùng chọn
          setImportConfirmData(parsedResult);
          setIsImportConfirmOpen(true);
        } else {
          // File chỉ là danh sách khách hàng thông thường
          await handleExecuteDirectoryOnlyImport(parsedResult);
        }
      } catch (err: any) {
        console.error("Lỗi khi import file Excel:", err);
        showAlert("Lỗi nhập file Excel", err.message || "Định dạng file không hỗ trợ hoặc file bị lỗi cấu trúc.", "error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(paginatedCustomers.map(c => c.id).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string | number) => {
    const numId = Number(id);
    setSelectedIds(prev => 
      prev.includes(numId) ? prev.filter(item => item !== numId) : [...prev, numId]
    );
  };

  // Bật/tắt hiện dữ liệu nhạy cảm PII cho từng dòng
  const toggleRowPII = (id: number) => {
    setRevealedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyZaloMessage = (record: any) => {
    const amountVal = record.amount || 0;
    const dateStr = record.nextPayment ? formatDateVN(record.nextPayment) : (record.toMonth ? formatMonthVN(record.toMonth) : 'thời gian tới');
    const assignedStaff = staff.find((s: any) => s.id === (record.staff_id || record.staffId));
    const staffPhone = assignedStaff?.phone || currentUser?.phone || '0972709321';
    const typeLabel = record.type === 'BHYT' ? 'BHYT' : 'BHXH';

    const text = `Kính gửi Anh/Chị ${record.name || 'Khách hàng'}, Đại lý thu BHXH Sông Mã trân trọng thông báo: Hồ sơ ${typeLabel} của Anh/Chị sẽ hết hạn vào ngày ${dateStr}. Số tiền đóng tiếp theo là ${formatMoney(amountVal)}. Vui lòng liên hệ số ĐT ${staffPhone} để được hỗ trợ gia hạn kịp thời, đảm bảo quyền lợi bảo hiểm liên tục!`;

    navigator.clipboard.writeText(text).then(() => {
      showToast(`Đã sao chép tin nhắn Zalo cho khách hàng ${record.name || record.bhxh || ''}!`, 'success');
    }).catch(() => {
      showAlert('Lỗi', 'Không thể copy vào bộ nhớ tạm. Hãy thử lại.', 'error');
    });
  };

  // Helper hiển thị thông tin PII tuân thủ quy chuẩn
  const renderCustomerPII = (val: string | null | undefined, typeName: 'CCCD' | 'PHONE' | 'BHXH', recordId?: number) => {
    if (!val) return <span className="text-slate-400">---</span>;
    const isRowRevealed = recordId ? revealedRowIds.has(recordId) : false;
    const isFullyUnmasked = !isPIIMasked || isRowRevealed;

    let displayVal = val;
    if (!isFullyUnmasked) {
      if (typeName === 'CCCD') displayVal = maskCCCD(val, false);
      else if (typeName === 'PHONE') displayVal = maskPhone(val, false);
      else if (typeName === 'BHXH') displayVal = maskBHXH(val, false);
    }

    return (
      <span className="font-mono tabular-nums text-xs">
        {displayVal}
      </span>
    );
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Header: Tiêu đề, Thống kê danh bạ, và Các nút tác nghiệp */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {selectedType === 'ALL' ? 'Danh Bạ & Hồ Sơ Khách Hàng' : `Danh Bạ Khách Hàng ${selectedType}`}
            </h2>
            <span className="text-xs text-slate-500 font-normal">
              · {directoryStats.total} đối tượng
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Quản lý tập trung thông tin nhân khẩu, mã định danh và dữ liệu tham gia BHXH/BHYT tuân thủ Nghị định 13/2023/NĐ-CP
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Nút bật/tắt che PII */}
          <button
            type="button"
            onClick={() => setIsPIIMasked(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
              isPIIMasked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
            title="Tuân thủ quy định che dấu dữ liệu nhạy cảm PII (Nghị định 13/2023/NĐ-CP)"
          >
            {isPIIMasked ? <ShieldCheck size={15} /> : <ShieldAlert size={15} />}
            <span>{isPIIMasked ? 'PII: Đang che giấu' : 'PII: Đang hiện rõ'}</span>
          </button>

          {/* Chuyển đổi giao diện: Bảng vs Danh bạ */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem dạng bảng chi tiết"
            >
              <LayoutList size={14} />
              <span className="hidden md:inline">Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`p-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                viewMode === 'directory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Xem dạng danh bạ thẻ đối tượng"
            >
              <Contact size={14} />
              <span className="hidden md:inline">Danh bạ</span>
            </button>
          </div>

          {/* Phân công / Xóa hàng loạt */}
          {selectedIds.length > 0 && (
            <>
              {currentUser?.role !== 'Nhân viên' && (
                <button
                  type="button"
                  onClick={() => openAssignModal()}
                  className="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs"
                >
                  <UserPlus size={15} className="mr-1" />
                  <span>Phân công ({selectedIds.length})</span>
                </button>
              )}
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs"
              >
                <Trash2 size={15} className="mr-1" />
                <span>Xóa ({selectedIds.length})</span>
              </button>
            </>
          )}

          {/* Nhập/Xuất Excel */}
          {canCreateCustomer && (
            <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs">
              <FileUp size={15} className="mr-1 text-slate-500" />
              <span>Nhập Excel</span>
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={importExcel} />
            </label>
          )}
          {canExportCustomers && (
            <>
              <button
                type="button"
                onClick={exportExcel}
                className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs"
                title="Xuất dữ liệu Excel"
              >
                <FileDown size={15} className="mr-1 text-slate-500" />
                <span>Dữ Liệu Thô</span>
              </button>
              {(selectedType === 'BHYT' || selectedType === 'ALL') && (
                <button
                  type="button"
                  onClick={handleExportD03TS}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs"
                  title="Xuất mẫu D03-TS chuẩn BHXH VN"
                >
                  <FileDown size={15} className="mr-1 text-emerald-600" />
                  <span>Mẫu D03-TS</span>
                </button>
              )}
              {(selectedType === 'BHXH' || selectedType === 'ALL') && (
                <button
                  type="button"
                  onClick={handleExportD05TS}
                  className="bg-blue-50 text-[#004182] border border-blue-200 hover:bg-blue-100 px-3 py-2 rounded-xl font-semibold transition text-xs flex items-center cursor-pointer shadow-xs"
                  title="Xuất mẫu D05-TS chuẩn BHXH VN"
                >
                  <FileDown size={15} className="mr-1 text-[#004182]" />
                  <span>Mẫu D05-TS</span>
                </button>
              )}
            </>
          )}

          {/* Thêm mới hồ sơ */}
          {canCreateCustomer && (
            <button
              type="button"
              onClick={() => openRegisterModal(selectedType === 'BHYT' ? 'BHYT' : 'BHXH')}
              className="bg-[#004182] hover:bg-[#003166] text-white px-3.5 py-2 rounded-xl font-semibold transition shadow-xs flex items-center text-xs cursor-pointer active:scale-[0.98]"
            >
              <Plus size={15} className="mr-1" />
              <span>Thêm {selectedType === 'ALL' ? 'Hồ Sơ' : selectedType}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Thanh tìm kiếm định danh thông minh & Bộ lọc 2 tầng */}
      <CustomerFilterBar
        isPIIMasked={isPIIMasked}
        detectedSearchType={detectedSearchType}
        filterState={filterState}
        updateFilter={updateFilter}
        resetFilters={resetFilters}
        quickPillCounts={quickPillCounts}
        staff={staff}
        submissionBatches={submissionBatches}
        isAdminOrManager={isAdminOrManager}
        setCurrentPage={setCurrentPage}
        filteredCount={filteredRecords.length}
        directoryStats={directoryStats}
        useVirtualization={useVirtualization}
        setUseVirtualization={setUseVirtualization}
      />

      {/* 3. Nội dung hiển thị: Bảng quản lý vs Danh bạ thẻ đối tượng */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {viewMode === 'directory' ? (
          /* ================= VIEW 1: DANH BẠ THẺ ĐỐI TƯỢNG (DIRECTORY VIEW) ================= */
          <div className="p-4 bg-slate-50/50">
            {paginatedCustomers.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
                Không tìm thấy khách hàng nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {paginatedCustomers.map((c, idx) => {
                  const isRowRevealed = c.id ? revealedRowIds.has(c.id) : false;
                  const isFullyRevealed = !isPIIMasked || isRowRevealed;

                  return (
                    <CustomerDirectoryCard
                      key={c.id || `dir-${idx}`}
                      customer={c}
                      isSelected={c.id ? selectedIds.includes(c.id) : false}
                      isFullyRevealed={isFullyRevealed}
                      isPIIMasked={isPIIMasked}
                      canEdit={canEditCustomer}
                      canDelete={canDeleteCustomer}
                      onSelect={handleSelectRow}
                      onTogglePII={toggleRowPII}
                      onViewHistory={handleViewHistory}
                      onVietQrClick={setVietQrRecord}
                      onCopyZalo={copyZaloMessage}
                      onExtend={(cust) => openRegisterModal(cust.type as 'BHXH' | 'BHYT', cust, true)}
                      onEdit={(cust) => openRegisterModal(cust.type as 'BHXH' | 'BHYT', cust, false)}
                      onDelete={(cust) => confirmDelete(cust.id)}
                      onStatusClick={(cust) => setStatusModalRecord(cust)}
                      renderPII={renderCustomerPII}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : useVirtualization ? (
          /* ================= VIEW 2: ẢO HÓA DANH SÁCH LỚN ================= */
          <div className="p-3">
            <VirtualizedRecordTable
              records={filteredRecords}
              selectedIds={selectedIds}
              onSelectRow={handleSelectRow}
              onSelectAll={(selected) => {
                if (selected) {
                  setSelectedIds(filteredRecords.map(c => c.id).filter(Boolean));
                } else {
                  setSelectedIds([]);
                }
              }}
              onStatusClick={(record) => setStatusModalRecord(record)}
              onParticipationClick={(record) => setParticipationRecord(record)}
              onViewHistory={handleViewHistory}
              onVietQrClick={(record) => setVietQrRecord(record)}
              onAssignClick={(id) => openAssignModal(id)}
              onCopyZalo={copyZaloMessage}
              onExtendClick={(record) => openRegisterModal(record.type as 'BHXH' | 'BHYT', record, true)}
              onEditClick={(record) => openRegisterModal(record.type as 'BHXH' | 'BHYT', record, false)}
              onDeleteClick={(id) => confirmDelete(id)}
              currentUserRole={currentUser?.role}
            />
          </div>
        ) : (
          /* ================= VIEW 3: BẢNG QUẢN LÝ THÔNG TIN KHÁCH HÀNG (TABLE VIEW) ================= */
          <CustomerTableView
            customers={paginatedCustomers}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            renderCustomerPII={renderCustomerPII}
            toggleRowPII={toggleRowPII}
            revealedRowIds={revealedRowIds}
            isPIIMasked={isPIIMasked}
            isAdminOrManager={isAdminOrManager}
            currentUser={currentUser}
            canEditCustomer={canEditCustomer}
            canDeleteCustomer={canDeleteCustomer}
            onStatusClick={(r) => setStatusModalRecord(r)}
            onParticipationClick={(r) => setParticipationRecord(r)}
            onViewHistory={(r) => handleViewHistory(r)}
            onVietQrClick={(r) => setVietQrRecord(r)}
            onAssignClick={(id) => openAssignModal(id)}
            onCopyZalo={(r) => copyZaloMessage(r)}
            onExtendClick={(r) => openRegisterModal(r.type as 'BHXH' | 'BHYT', r, true)}
            onEditClick={(r) => openRegisterModal(r.type as 'BHXH' | 'BHYT', r, false)}
            onDeleteClick={(id) => confirmDelete(id)}
          />
        )}

        {/* 4. Phân trang chuẩn Design System */}
        {!useVirtualization && totalPages > 1 && (
          <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Hiển thị</span>
              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>trên tổng {totalCount} khách hàng</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang đầu"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 py-1 text-xs font-semibold text-slate-700">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Trang cuối"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODALS TÍCH HỢP ================= */}
      {isRegisterModalOpen && (
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          type={registerType}
          record={registerRecord}
          initialData={registerRecord}
          isRenew={isRenew}
        />
      )}

      {isConfirmOpen && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={executeDelete}
          title="Xác nhận xóa hồ sơ khách hàng"
          message="Bạn có chắc chắn muốn xóa hồ sơ khách hàng này? Lưu ý: Mọi lịch sử giao dịch và quá trình tham gia liên quan sẽ được đồng bộ xử lý an toàn."
        />
      )}

      {isBulkDeleteConfirmOpen && (
        <ConfirmModal
          isOpen={isBulkDeleteConfirmOpen}
          onClose={() => setIsBulkDeleteConfirmOpen(false)}
          onConfirm={executeBulkDelete}
          title="Xác nhận xóa hàng loạt"
          message={`Bạn có chắc chắn muốn xóa ${selectedIds.length} khách hàng đã chọn? Thao tác này không thể hoàn tác.`}
        />
      )}

      {/* Modal xác nhận phương thức Nhập Excel Thông Minh */}
      <ExcelImportConfirmModal
        isOpen={Boolean(isImportConfirmOpen && importConfirmData)}
        onClose={() => {
          setIsImportConfirmOpen(false);
          setImportConfirmData(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        fileName={importConfirmFileName}
        recordCount={importConfirmData?.records?.length || 0}
        onConfirmFull={() => importConfirmData && handleExecuteFullImport(importConfirmData)}
        onConfirmDirectoryOnly={() => importConfirmData && handleExecuteDirectoryOnlyImport(importConfirmData)}
        isImporting={isImporting}
      />

      {/* Modal phân công nhân viên phụ trách */}
      <AssignStaffModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        selectedCount={selectedIds.length}
        staff={staff}
        assignStaffId={assignStaffId}
        setAssignStaffId={setAssignStaffId}
        onConfirm={executeAssignStaff}
        isAssigning={isAssigning}
      />

      {/* Modal Lịch sử giao dịch */}
      {searchModalOpen && (
        <SearchResultModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          results={searchModalResults}
          searchCode={searchModalCode}
        />
      )}

      {/* Modal VietQR nộp tiền */}
      {vietQrRecord && (
        <VietQRModal
          isOpen={Boolean(vietQrRecord)}
          onClose={() => setVietQrRecord(null)}
          record={vietQrRecord}
        />
      )}

      {/* Modal Đổi trạng thái tham gia */}
      {statusModalRecord && (
        <CustomerStatusModal
          isOpen={Boolean(statusModalRecord)}
          onClose={() => setStatusModalRecord(null)}
          record={statusModalRecord}
          onConfirm={async (recId, newStatus, reason) => {
            if (updateCustomerStatus) {
              await updateCustomerStatus(recId, newStatus, reason);
            }
            setStatusModalRecord(null);
            showToast('Cập nhật trạng thái tham gia thành công!', 'success');
          }}
        />
      )}

      {/* Modal Chi tiết quá trình tham gia */}
      {participationRecord && (
        <CustomerParticipationModal
          isOpen={Boolean(participationRecord)}
          onClose={() => setParticipationRecord(null)}
          customer={participationRecord}
          onSaved={() => {
            setParticipationRecord(null);
          }}
        />
      )}
    </div>
  );
};

export default CRMView;
