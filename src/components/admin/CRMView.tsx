import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
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
  Users, 
  AlertTriangle 
} from 'lucide-react';
import { isSafeColumnKey, protectWorksheetFormulas, validateExcelFile, validateImportRows } from '../../utils/excelSecurity';
import RegisterModal from '../modals/RegisterModal';
import ConfirmModal from '../modals/ConfirmModal';
import SearchResultModal from '../modals/SearchResultModal';
import { VietQRModal } from '../modals/VietQRModal';
import { exportD03TSStandardExcel, exportD05TSStandardExcel } from '../../utils/exportNationalStandardForms';
import { CustomerStatusBadge, CustomerParticipationBadge } from '../common/CustomerStatusBadge';
import { CustomerStatusModal } from '../modals/CustomerStatusModal';
import { CustomerParticipationModal } from '../modals/CustomerParticipationModal';
import { useRecordFilters } from '../../hooks/useRecordFilters';
import { RecordFilterToolbar } from './RecordFilterToolbar';
import { VirtualizedRecordTable } from '../common/VirtualizedRecordTable';
import { hasPermission } from '../../utils/permissions';
import { customerService } from '../../services/customerService';
import { CustomerDirectoryCard } from './crm/CustomerDirectoryCard';

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
    staff 
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
  
  // Trạng thái bảo vệ PII (Nghị định 13/2023/NĐ-CP): Mặc định bật bảo vệ che số CCCD/SĐT
  const [isPIIMasked, setIsPIIMasked] = useState<boolean>(true);
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
          staffId: filterState.staffId === 'all' ? undefined : filterState.staffId,
          status: filterState.status === 'all' ? undefined : filterState.status,
          fromDate: filterState.startDate,
          toDate: filterState.endDate,
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
    filterState.status,
    filterState.startDate,
    filterState.endDate,
  ]);

  const useServerData = serverSideMode && serverTotalCount > 0;
  const filteredRecords = uniqueCustomersList;
  const totalCount = useServerData ? serverTotalCount : uniqueCustomersList.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedCustomers = useMemo(() => {
    if (useServerData && serverCustomers.length > 0) {
      return serverCustomers;
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
    setRegisterRecord(record);
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

      let totalUpdated = 0;
      for (const cKey of targetCustomerKeys) {
        const { error } = await supabase
          .from('customers')
          .update({
            assigned_staff_id: assignStaffId || null,
            updated_at: new Date().toISOString()
          })
          .eq('customer_key', cKey);

        if (!error) totalUpdated++;
      }

      await supabase
        .from('records')
        .update({
          staff_id: assignStaffId || null,
          staffId: assignStaffId || null,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedIds);

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

        const getVal = (row: any, possibleKeys: string[]) => {
          const rowKeys = Object.keys(row);
          for (let k of rowKeys) {
            if (!isSafeColumnKey(k)) continue;
            const cleanKey = k.trim().toLowerCase();
            if (possibleKeys.some(pk => pk.toLowerCase() === cleanKey)) {
              return row[k];
            }
          }
          return "";
        };

        const parseMoney = (val: any) => {
          if (!val) return 0;
          return parseInt(String(val).replace(/\D/g, "")) || 0;
        };

        let addedCount = 0;
        const newRecords = [...records];

        json.forEach((row: any) => {
          let rowTypeStr = String(getVal(row, ["Loại hình", "Loại tham gia", "Loại", "Type"])).toUpperCase();
          let rType: 'BHXH' | 'BHYT' = selectedType === 'BHYT' ? 'BHYT' : 'BHXH';
          if (rowTypeStr.includes('BHYT')) rType = 'BHYT';
          else if (rowTypeStr.includes('BHXH')) rType = 'BHXH';

          let nameStr = String(getVal(row, ["Họ và Tên", "Họ tên", "Họ & tên", "Tên", "Name"])).trim();
          if (!nameStr || nameStr === 'undefined') return;

          let parsedDate = parseDateISO(getVal(row, ["Ngày đăng ký", "Ngày tạo", "Date"]));
          let recordDate = new Date().toISOString();
          if (parsedDate) {
            try {
              let d = new Date(parsedDate);
              if (!isNaN(d.getTime())) recordDate = d.toISOString();
            } catch(err){}
          }

          let newRec: any = {
            type: rType,
            name: formatTitleCase(nameStr),
            date: recordDate,
            actionType: 'Nhập từ Excel',
            paymentStatus: getVal(row, ["Trạng thái", "Trạng thái thanh toán"]) || 'Khách hàng cũ',
            status: 'Đang tham gia',
            nextPayment: getLocalYYYYMMDD(new Date(Date.now() + 365*24*60*60*1000))
          };

          const addIfValidString = (key: string, val: any) => {
            if (val !== undefined && val !== null && val !== "") {
              newRec[key] = String(val);
            }
          };

          addIfValidString('cccd', getVal(row, ["CCCD", "Số CCCD", "Số ĐDCN", "CMND"]));
          addIfValidString('bhxh', getVal(row, ["Mã BHXH", "Mã số BHXH", "Mã thẻ", "Mã BHYT"]));
          addIfValidString('phone', getVal(row, ["Số điện thoại", "SĐT", "Điện thoại", "Phone"]));
          addIfValidString('address', getVal(row, ["Địa chỉ", "Nơi cư trú", "Address"]));
          addIfValidString('notes', getVal(row, ["Ghi chú", "Notes"]));

          newRec.amount = parseMoney(getVal(row, ["Tổng Tiền", "Số tiền", "Amount"]));

          newRecords.push(newRec);
          addedCount++;
        });

        if (addedCount > 0) {
          await bulkPutRecords(newRecords);
          addAuditLog?.('Nhập khách hàng từ Excel', `Đã nhập thành công ${addedCount} hồ sơ mới từ file ${file.name}`);
          showToast(`Nhập thành công ${addedCount} hồ sơ khách hàng mới!`, 'success');
        } else {
          showAlert("Không tìm thấy dữ liệu", "Không có dữ liệu hợp lệ nào được thêm vào hệ thống.", "info");
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

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
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
    const isFullyUnmasked = !isPIIMasked || isRowRevealed || isAdminOrManager;

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
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Banner bảo mật PII nếu đang che */}
        {isPIIMasked && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Tuân thủ Nghị định 13/2023/NĐ-CP:</strong> Dữ liệu CCCD, SĐT và Mã BHXH đang được tự động che dấu.
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              {detectedSearchType && (
                <span className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${detectedSearchType.color}`}>
                  {detectedSearchType.label}
                </span>
              )}
              <span>Bấm biểu tượng mắt ở từng dòng để xem chi tiết khi cần.</span>
            </div>
          </div>
        )}

        <RecordFilterToolbar
          filterState={filterState}
          onFilterChange={updateFilter}
          onReset={resetFilters}
          quickPillCounts={quickPillCounts}
          staffList={staff}
          submissionBatches={submissionBatches}
          isAdminOrManager={isAdminOrManager}
          onPageReset={() => setCurrentPage(1)}
        />

        {/* Thanh trạng thái phụ: Số lượng kết quả & Chế độ Virtualization */}
        <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-50/70 border-t border-b border-slate-200 text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-3">
            <span>
              Tổng tìm thấy: <strong className="text-slate-900 font-semibold">{filteredRecords.length}</strong> khách hàng
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Đang tham gia: <strong className="text-emerald-700 font-semibold">{directoryStats.active}</strong></span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>Dừng đóng: <strong className="text-slate-600 font-semibold">{directoryStats.stopped}</strong></span>
          </div>

          <button
            type="button"
            onClick={() => setUseVirtualization(prev => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              useVirtualization 
                ? 'bg-[#004182] text-white border-[#004182]' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Tối ưu hóa cuộn mượt cho danh bạ lớn trên 3.000 khách hàng"
          >
            <Layers size={13} />
            <span>{useVirtualization ? 'Đang bật Ảo hóa (Virtual)' : 'Ảo hóa danh bạ lớn'}</span>
          </button>
        </div>

        {/* 3. Nội dung hiển thị: Bảng quản lý vs Danh bạ thẻ đối tượng */}
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
                  const isFullyRevealed = !isPIIMasked || isRowRevealed || isAdminOrManager;

                  return (
                    <CustomerDirectoryCard
                      key={c.id || `dir-${idx}`}
                      customer={c}
                      isSelected={c.id ? selectedIds.includes(c.id) : false}
                      isFullyRevealed={isFullyRevealed}
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
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        checked={paginatedCustomers.length > 0 && selectedIds.length === paginatedCustomers.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] cursor-pointer"
                      />
                    </th>
                    <th className="p-4">Họ & Tên Khách Hàng</th>
                    <th className="p-4">Số ĐDCN / CCCD</th>
                    <th className="p-4">Mã số BHXH</th>
                    <th className="p-4">Loại hình</th>
                    <th className="p-4">Hạn đóng tiếp</th>
                    <th className="p-4">Trạng Thái Đóng</th>
                    <th className="p-4">Trạng Thái KH</th>
                    <th className="p-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((r, index) => {
                    const rawCccd = r.cccd || '';
                    const rawBhxh = r.bhxh || '';
                    const rawPhone = r.phone || '';
                    const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
                    const isFullyRevealed = !isPIIMasked || isRowRevealed || isAdminOrManager;

                    return (
                      <tr 
                        key={r.id || `row-${index}`} 
                        className={`hover:bg-slate-50/80 transition border-b border-slate-100 ${
                          r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : ''
                        }`}
                      >
                        <td className="p-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={r.id ? selectedIds.includes(r.id) : false}
                            onChange={() => r.id && handleSelectRow(r.id)}
                            disabled={!r.id}
                            className="w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] disabled:opacity-50 cursor-pointer"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm">
                            {r.name}
                          </div>
                          <div className="text-xs text-slate-500 font-normal flex items-center gap-1.5 mt-0.5">
                            <Phone size={11} className="text-slate-400" />
                            {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                            {r.id && (
                              <button
                                type="button"
                                onClick={() => toggleRowPII(r.id)}
                                className="text-slate-400 hover:text-slate-600 p-0.5"
                                title={isFullyRevealed ? "Ẩn PII" : "Hiện PII"}
                              >
                                {isFullyRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            )}
                          </div>
                          {r.notes && (
                            <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md inline-block max-w-[260px] truncate" title={r.notes}>
                              <span className="font-semibold text-slate-400">Ghi chú:</span> {r.notes}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="font-mono tabular-nums text-slate-800 font-medium">
                            {renderCustomerPII(rawCccd, 'CCCD', r.id)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="font-mono tabular-nums text-slate-800 font-medium">
                            {renderCustomerPII(rawBhxh, 'BHXH', r.id)}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            r.type === 'BHXH' ? 'bg-blue-50 text-[#004182] border border-blue-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className="p-4 text-slate-600 text-xs font-medium">
                          {r.nextPayment ? formatDateVN(r.nextPayment) : '---'}
                        </td>
                        <td className="p-4">
                          <CustomerStatusBadge paymentStatus={r.paymentStatus} nextPayment={r.nextPayment} />
                        </td>
                        <td className="p-4">
                          <CustomerParticipationBadge 
                            status={r.status || 'Đang tham gia'} 
                            interactive={Boolean(r.id)}
                            onClick={() => r.id && setStatusModalRecord(r)} 
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              type="button"
                              onClick={() => r.id && setStatusModalRecord(r)} 
                              disabled={!r.id} 
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Đổi trạng thái Đang tham gia / Dừng đóng"
                            >
                              <UserCheck size={15} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setParticipationRecord(r)} 
                              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Hồ sơ tham gia trước đây"
                            >
                              <History size={15} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleViewHistory(r)} 
                              disabled={!r.id} 
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Xem kết quả tra cứu quá trình"
                            >
                              <Eye size={15} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => setVietQrRecord(r)} 
                              disabled={!r.id} 
                              className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Mã VietQR nộp tiền"
                            >
                              <QrCode size={15} />
                            </button>
                            {currentUser?.role !== 'Nhân viên' && (
                              <button 
                                type="button"
                                onClick={() => r.id && openAssignModal(r.id)} 
                                disabled={!r.id} 
                                className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition cursor-pointer" 
                                title="Phân công nhân viên"
                              >
                                <UserPlus size={15} />
                              </button>
                            )}
                            <button 
                              type="button"
                              onClick={() => r.id && copyZaloMessage(r)} 
                              disabled={!r.id} 
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Sao chép tin nhắn Zalo"
                            >
                              <Copy size={15} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => r.id && openRegisterModal(r.type as 'BHXH' | 'BHYT', r, true)} 
                              disabled={!r.id} 
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer" 
                              title="Gia hạn hồ sơ"
                            >
                              <Zap size={15} />
                            </button>
                            {canEditCustomer && (
                              <button 
                                type="button"
                                onClick={() => r.id && openRegisterModal(r.type as 'BHXH' | 'BHYT', r, false)} 
                                disabled={!r.id} 
                                className="p-1.5 rounded-lg text-[#004182] hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer" 
                                title="Sửa thông tin"
                              >
                                <Edit size={15} />
                              </button>
                            )}
                            {canDeleteCustomer && (
                              <button 
                                type="button"
                                onClick={() => r.id && confirmDelete(r.id)} 
                                disabled={!r.id} 
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer" 
                                title="Xóa"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedCustomers.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-500">
                        Không tìm thấy hồ sơ khách hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {paginatedCustomers.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  Không tìm thấy hồ sơ nào phù hợp.
                </div>
              ) : (
                paginatedCustomers.map((r, index) => {
                  const rawCccd = r.cccd || '';
                  const rawBhxh = r.bhxh || '';
                  const rawPhone = r.phone || '';
                  const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
                  const isFullyRevealed = !isPIIMasked || isRowRevealed || isAdminOrManager;

                  return (
                    <div 
                      key={r.id || `mob-${index}`} 
                      className={`p-4 ${r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : 'bg-white'}`}
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="flex items-start gap-2.5">
                          <input 
                            type="checkbox" 
                            checked={r.id ? selectedIds.includes(r.id) : false}
                            onChange={() => r.id && handleSelectRow(r.id)}
                            className="mt-1 w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] cursor-pointer"
                          />
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">{r.name}</h4>
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Phone size={11} className="text-slate-400" />
                              {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            r.type === 'BHXH' ? 'bg-blue-50 text-[#004182] border border-blue-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                          }`}>
                            {r.type}
                          </span>
                          {r.id && (
                            <button
                              type="button"
                              onClick={() => toggleRowPII(r.id)}
                              className="p-1 rounded text-slate-400 hover:text-slate-600"
                              title="Bật/Tắt che PII"
                            >
                              {isFullyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Định danh CCCD</span>
                          <span className="font-mono font-medium text-slate-800">
                            {renderCustomerPII(rawCccd, 'CCCD', r.id)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Mã số BHXH</span>
                          <span className="font-mono font-medium text-slate-800">
                            {renderCustomerPII(rawBhxh, 'BHXH', r.id)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Hạn đóng</span>
                          <span className="text-slate-700 font-medium">
                            {r.nextPayment ? formatDateVN(r.nextPayment) : '---'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Trạng thái</span>
                          <CustomerStatusBadge paymentStatus={r.paymentStatus} nextPayment={r.nextPayment} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-1 pt-1">
                        <CustomerParticipationBadge 
                          status={r.status || 'Đang tham gia'} 
                          interactive={Boolean(r.id)}
                          onClick={() => r.id && setStatusModalRecord(r)} 
                        />
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => handleViewHistory(r)} 
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Lịch sử"
                          >
                            <History size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setVietQrRecord(r)} 
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                            title="VietQR"
                          >
                            <QrCode size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => copyZaloMessage(r)} 
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="Zalo"
                          >
                            <Copy size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => openRegisterModal(r.type as 'BHXH' | 'BHYT', r, true)} 
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                            title="Gia hạn"
                          >
                            <Zap size={15} />
                          </button>
                          {canEditCustomer && (
                            <button 
                              type="button"
                              onClick={() => openRegisterModal(r.type as 'BHXH' | 'BHYT', r, false)} 
                              className="p-1.5 rounded-lg text-[#004182] hover:bg-blue-50"
                              title="Sửa"
                            >
                              <Edit size={15} />
                            </button>
                          )}
                          {canDeleteCustomer && (
                            <button 
                              type="button"
                              onClick={() => confirmDelete(r.id)} 
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                              title="Xóa"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
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

      {/* Modal phân công nhân viên phụ trách */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Phân Công Nhân Viên Phụ Trách ({selectedIds.length} khách hàng)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Chọn nhân viên phụ trách chăm sóc, đôn đốc gia hạn cho các khách hàng được chọn:
            </p>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nhân viên phụ trách:
              </label>
              <select
                value={assignStaffId}
                onChange={e => setAssignStaffId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#004182] bg-white cursor-pointer"
              >
                <option value="">-- Thu hồi phân công (Chưa giao ai) --</option>
                {staff.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.phone || 'Không có SĐT'})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeAssignStaff}
                disabled={isAssigning}
                className="px-4 py-2 bg-[#004182] hover:bg-[#003166] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isAssigning ? 'Đang lưu...' : 'Xác nhận phân công'}
              </button>
            </div>
          </div>
        </div>
      )}

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
