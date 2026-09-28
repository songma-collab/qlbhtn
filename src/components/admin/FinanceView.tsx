import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext, handleSchemaCacheMissingColumn } from '../../context/AppContext';
import { 
  formatMoney, 
  formatDateVN, 
  formatMonthVN, 
  parseDateISO, 
  parseMonthISO, 
  getLocalYYYYMMDD, 
  isDateLocked, 
  formatTitleCase, 
  dateISOToVN, 
  getOldBhxh10 
} from '../../utils/helpers';
import { parseMonthAndYear, toDbDate } from '../../utils/dateStandardHelper';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { supabase } from '../../lib/supabase';
import { 
  FileDown, 
  FileUp, 
  Printer, 
  RotateCw, 
  RotateCcw, 
  Plus, 
  Image, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Lock, 
  Unlock, 
  CheckSquare, 
  XSquare, 
  Square, 
  QrCode, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Coins, 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Landmark, 
  Layers, 
  FileSpreadsheet, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';
import { VietQRModal } from '../modals/VietQRModal';
import { exportD03TSStandardExcel, exportD05TSStandardExcel } from '../../utils/exportNationalStandardForms';
import { generateBatchCode, getNextBatchSequence } from '../../utils/batchSubmission';
import { isSafeColumnKey, protectWorksheetFormulas, validateExcelFile, validateImportRows } from '../../utils/excelSecurity';
import { parseExcelRows } from '../../utils/excelImportHelper';
import {
  TransactionFilterState,
  getDefaultTransactionFilterState,
  getTransactionDateRange,
  computeTransactionKPIs
} from '../../utils/transactionFilters';
import { FinanceStatsCards } from './finance/FinanceStatsCards';
import { FinanceFilterBar } from './finance/FinanceFilterBar';
import { FinanceBatchModal } from './finance/FinanceBatchModal';
import { FinanceLockModal } from './finance/FinanceLockModal';
import { printReceipt as executePrintReceipt, exportReceiptAsImage } from './finance/receiptService';
import { SubmissionBatchReport } from './finance/SubmissionBatchReport';
import { hasPermission } from '../../utils/permissions';
import { recordService } from '../../services/recordService';
import type { RecordType } from '../../context/types';

export interface FinanceViewProps {
  type?: 'BHXH' | 'BHYT' | string;
}

export const FinanceView: React.FC<FinanceViewProps> = ({ type = 'BHXH' }) => {
  const currentType = (type === 'BHYT' ? 'BHYT' : 'BHXH') as 'BHXH' | 'BHYT';

  const { 
    records, 
    updateRecord, 
    deleteRecord, 
    bulkDeleteRecords, 
    bulkPutRecords, 
    cancelRecordWithClawback, 
    settings, 
    showToast, 
    showAlert, 
    showPrompt, 
    staff, 
    currentUser, 
    addAuditLog, 
    policies, 
    refreshData 
  } = useAppContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Quyền hạn phân quyền cho phân hệ Tài chính
  const canCollect = hasPermission(currentUser, 'finance.collect', settings);
  const canRefund = hasPermission(currentUser, 'finance.refund', settings);
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'Quản lý';

  const [activeFinanceTab, setActiveFinanceTab] = useState<'transactions' | 'batches'>('transactions');
  const [showCashflowStatement, setShowCashflowStatement] = useState<boolean>(true);

  // Trạng thái bộ lọc hợp nhất được đồng bộ hóa với sessionStorage
  const [filterState, setFilterState] = useState<TransactionFilterState>(() => {
    const def = getDefaultTransactionFilterState();
    try {
      const saved = sessionStorage.getItem(`finance_view_filter_${currentType.toLowerCase()}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...def, ...parsed };
      }
    } catch (e) {
      console.error("Lỗi đọc bộ lọc từ sessionStorage:", e);
    }
    return def;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(`finance_view_filter_${currentType.toLowerCase()}`, JSON.stringify(filterState));
    } catch (e) {
      console.error("Lỗi lưu bộ lọc vào sessionStorage:", e);
    }
  }, [filterState, currentType]);

  const handleResetFilters = () => {
    const def = getDefaultTransactionFilterState();
    setFilterState(def);
    try {
      sessionStorage.removeItem(`finance_view_filter_${currentType.toLowerCase()}`);
    } catch (e) {}
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const handleToggleKpiFilter = (clicked: 'PAID' | 'PENDING') => {
    setFilterState(prev => ({
      ...prev,
      kpiQuickFilter: prev.kpiQuickFilter === clicked ? 'ALL' : clicked
    }));
    setCurrentPage(1);
    setSelectedIds([]);
  };

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [targetUnlockKey, setTargetUnlockKey] = useState<string>('');
  const [lockActionType, setLockActionType] = useState<'lock' | 'unlock'>('lock');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // States for Chuyển hồ sơ BHXH theo đợt & ngày
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchModalTargetIds, setBatchModalTargetIds] = useState<number[]>([]);
  const [batchNameInput, setBatchNameInput] = useState('Đợt 1');
  const [batchDateInput, setBatchDateInput] = useState(() => getLocalYYYYMMDD());

  // VietQR Modal state
  const [vietQrRecord, setVietQrRecord] = useState<any | null>(null);
  const [isVietQrOpen, setIsVietQrOpen] = useState(false);

  // Xử lý chính sách khóa sổ kỳ dữ liệu
  const lockedPolicy = policies?.find((p: any) => p.parameter_type === 'locked_periods' && p.is_active);
  const lockedKeys: string[] = useMemo(() => {
    if (!lockedPolicy) return [];
    if (Array.isArray(lockedPolicy.value)) return lockedPolicy.value;
    if (lockedPolicy.value && Array.isArray(lockedPolicy.value.lockedKeys)) return lockedPolicy.value.lockedKeys;
    return [];
  }, [lockedPolicy]);

  const formattedLockedList = useMemo(() => {
    if (!lockedKeys || lockedKeys.length === 0) return [];
    const list = lockedKeys.map(key => {
      let label = key;
      let sortVal = 0;
      if (key.startsWith('month:')) {
        const parts = key.replace('month:', '').split('-');
        if (parts.length === 2) {
          label = `Tháng ${parts[1]}/${parts[0]}`;
          sortVal = parseInt(parts[0]) * 100 + parseInt(parts[1]);
        }
      } else if (key.startsWith('quarter:')) {
        const parts = key.replace('quarter:', '').split('-');
        if (parts.length === 2) {
          label = `Quý ${parts[1]}/${parts[0]}`;
          sortVal = parseInt(parts[0]) * 100 + parseInt(parts[1]) * 25;
        }
      } else if (key.startsWith('year:')) {
        const yr = key.replace('year:', '');
        label = `Năm ${yr}`;
        sortVal = parseInt(yr) * 100;
      }
      return { key, label, sortVal };
    });
    return list.sort((a, b) => b.sortVal - a.sortVal);
  }, [lockedKeys]);

  const dateRange = useMemo(() => {
    return getTransactionDateRange(filterState);
  }, [filterState]);

  const { startDateRPC, endDateRPC, currentKey, isCurrentPeriodLocked, currentPeriodLabel } = useMemo(() => {
    let sDate = dateRange.startDate;
    let eDate = dateRange.endDate;
    let cKey = '';
    let isLocked = false;
    let periodLbl = dateRange.periodLabel;

    if (filterState.periodType === 'MONTH' && filterState.selectedMonth) {
      cKey = `month:${filterState.selectedMonth}`;
    } else if (filterState.periodType === 'QUARTER') {
      const q = Math.floor(new Date().getMonth() / 3) + 1;
      const yr = new Date().getFullYear();
      cKey = `quarter:${yr}-${q}`;
    } else if (filterState.periodType === 'YEAR') {
      const yr = new Date().getFullYear();
      cKey = `year:${yr}`;
    }

    if (cKey && lockedKeys.includes(cKey)) {
      isLocked = true;
    }

    return {
      startDateRPC: sDate,
      endDateRPC: eDate,
      currentKey: cKey,
      isCurrentPeriodLocked: isLocked,
      currentPeriodLabel: periodLbl
    };
  }, [filterState, dateRange, lockedKeys]);

  const effectiveStaffId = useMemo(() => {
    if (currentUser?.role === 'Nhân viên') {
      return currentUser.id;
    }
    if (filterState.staffId && filterState.staffId !== 'ALL' && filterState.staffId !== 'all') {
      return filterState.staffId;
    }
    return null;
  }, [currentUser, filterState.staffId]);

  // Lọc danh sách giao dịch
  const filteredRecords = useMemo(() => {
    return records
      .filter((r: any) => {
        if (r.type !== currentType) return false;
        if (effectiveStaffId && r.staffId !== effectiveStaffId) return false;

        if (startDateRPC && endDateRPC) {
          if (!r.date) return false;
          const recordDateStr = r.date.slice(0, 10);
          if (recordDateStr < startDateRPC || recordDateStr > endDateRPC) return false;
        }

        if (filterState.kpiQuickFilter === 'PAID') {
          if (r.paymentStatus !== 'Đã thu tiền') return false;
        } else if (filterState.kpiQuickFilter === 'PENDING') {
          if (r.paymentStatus !== 'Chờ thanh toán') return false;
        }

        if (filterState.submissionStatus === 'UNSUBMITTED') {
          if (r.isSubmittedBHXH) return false;
        } else if (filterState.submissionStatus === 'SUBMITTED') {
          if (!r.isSubmittedBHXH) return false;
        } else if (filterState.submissionStatus && filterState.submissionStatus !== 'ALL') {
          if (r.submissionBatch !== filterState.submissionStatus) return false;
        }

        if (filterState.searchQuery && filterState.searchQuery.trim() !== '') {
          const q = filterState.searchQuery.toLowerCase().trim();
          const txnCode = `txn${r.id ? r.id.toString().slice(-6) : ''}`.toLowerCase();
          const nameMatch = (r.name || '').toLowerCase().includes(q);
          const cccdMatch = (r.cccd || '').toLowerCase().includes(q);
          const bhxhMatch = (r.bhxh || '').toLowerCase().includes(q);
          const phoneMatch = (r.phone || '').toLowerCase().includes(q);
          const receiptMatch = (r.receiptNumber || '').toLowerCase().includes(q);
          const batchMatch = (r.submissionBatch || '').toLowerCase().includes(q);
          const txnMatch = txnCode.includes(q);

          if (!nameMatch && !cccdMatch && !bhxhMatch && !phoneMatch && !receiptMatch && !batchMatch && !txnMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [records, currentType, effectiveStaffId, startDateRPC, endDateRPC, filterState]);

  // Thống kê KPI cơ bản
  const stats = useMemo(() => {
    return computeTransactionKPIs(
      records, 
      filterState, 
      { 
        type: currentType, 
        currentUserId: effectiveStaffId || undefined, 
        currentUserRole: currentUser?.role 
      }, 
      policies, 
      settings
    );
  }, [records, filterState, currentType, effectiveStaffId, currentUser?.role, policies, settings]);

  // BẢNG THỐNG KÊ DÒNG TIỀN VÀ CÂN ĐỐI TÀI CHÍNH TOÀN DIỆN (CASH FLOW STATEMENT)
  const cashflowSummary = useMemo(() => {
    const relevant = records.filter((r: any) => {
      if (r.type !== currentType) return false;
      if (effectiveStaffId && r.staffId !== effectiveStaffId) return false;
      if (startDateRPC && endDateRPC) {
        if (!r.date) return false;
        const dStr = r.date.slice(0, 10);
        if (dStr < startDateRPC || dStr > endDateRPC) return false;
      }
      return true;
    });

    let totalCollected = 0; // Thực thu
    let totalPending = 0;   // Chờ thanh toán
    let totalCancelled = 0; // Đã hủy
    let countPaid = 0;
    let countPending = 0;
    let countCancelled = 0;

    let submittedToAgency = 0;     // Đã chuyển nộp cơ quan BHXH
    let unsubmittedToAgency = 0;   // Đã thu tiền nhưng chưa nộp BHXH
    let countSubmitted = 0;
    let countUnsubmitted = 0;

    let totalCommissionPaid = 0;   // Hoa hồng phát sinh cho giao dịch đã thu
    let totalClawback = 0;         // Bù trừ âm / thu hồi

    relevant.forEach((r: any) => {
      const amt = Number(r.amount) || 0;
      const rate = getCommissionRateForRecord(r, policies, settings);
      const comm = amt * rate;

      if (r.isAdjustment || amt < 0) {
        totalClawback += Math.abs(amt);
      }

      if (r.paymentStatus === 'Đã thu tiền') {
        totalCollected += amt;
        countPaid++;
        totalCommissionPaid += comm;

        if (r.isSubmittedBHXH) {
          submittedToAgency += amt;
          countSubmitted++;
        } else {
          unsubmittedToAgency += amt;
          countUnsubmitted++;
        }
      } else if (r.paymentStatus === 'Chờ thanh toán') {
        totalPending += amt;
        countPending++;
      } else if (r.paymentStatus === 'Đã hủy') {
        totalCancelled += amt;
        countCancelled++;
      }
    });

    // Tồn quỹ tiền mặt/tài khoản đại lý thực tế = Thực thu - Tiền đã nộp cơ quan BHXH - Hoa hồng chi trả
    const netAgencyFunds = totalCollected - submittedToAgency - totalCommissionPaid;

    return {
      totalCollected,
      totalPending,
      totalCancelled,
      countPaid,
      countPending,
      countCancelled,
      submittedToAgency,
      unsubmittedToAgency,
      countSubmitted,
      countUnsubmitted,
      totalCommissionPaid,
      totalClawback,
      netAgencyFunds,
      totalTransactions: relevant.length
    };
  }, [records, currentType, effectiveStaffId, startDateRPC, endDateRPC, policies, settings]);

  // Danh sách các đợt nộp hợp lệ
  const availableBatches = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; date?: string }>();
    records
      .filter((r: any) => {
        if (r.type !== currentType) return false;
        if (!r.isSubmittedBHXH || !r.submissionBatch) return false;
        if (r.actionType === 'Nhập từ Excel') return false;
        if (r.paymentStatus === 'Đã hủy') return false;
        if (effectiveStaffId && r.staffId !== effectiveStaffId) return false;
        if (startDateRPC && endDateRPC) {
          if (!r.date) return false;
          const dStr = r.date.slice(0, 10);
          if (dStr < startDateRPC || dStr > endDateRPC) return false;
        }
        return true;
      })
      .forEach((r: any) => {
        const batchKey = r.submissionBatch.trim();
        const existing = map.get(batchKey) || { count: 0, totalAmount: 0, date: r.submittedDate };
        existing.count += 1;
        existing.totalAmount += (Number(r.amount) || 0);
        if (!existing.date && r.submittedDate) existing.date = r.submittedDate;
        map.set(batchKey, existing);
      });

    return Array.from(map.entries())
      .map(([batch, info]) => ({
        batch,
        date: info.date,
        count: info.count,
        totalAmount: info.totalAmount
      }))
      .sort((a, b) => b.batch.localeCompare(a.batch, undefined, { numeric: true }));
  }, [records, currentType, effectiveStaffId, startDateRPC, endDateRPC]);

  // Chế độ Server-Side Pagination & Search cho Tài chính (Hiệu năng cao, mở rộng > 100k giao dịch)
  const [serverSideMode, setServerSideMode] = useState<boolean>(true);
  const [serverRecords, setServerRecords] = useState<RecordType[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState<number>(0);
  const [isServerLoading, setIsServerLoading] = useState<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;
    const loadServerFinance = async () => {
      setIsServerLoading(true);
      try {
        const offset = (currentPage - 1) * itemsPerPage;
        const res = await recordService.searchRecordsServer({
          type: currentType,
          search: filterState.searchQuery,
          staffId: effectiveStaffId || 'all',
          paymentStatus: filterState.kpiQuickFilter === 'PAID' ? 'Đã thu tiền' : (filterState.kpiQuickFilter === 'PENDING' ? 'Chờ thanh toán' : 'all'),
          batchCode: filterState.submissionStatus !== 'ALL' && filterState.submissionStatus !== 'SUBMITTED' && filterState.submissionStatus !== 'UNSUBMITTED' ? filterState.submissionStatus : 'all',
          fromDate: startDateRPC || undefined,
          toDate: endDateRPC || undefined,
          limit: itemsPerPage,
          offset: offset,
        });

        if (isSubscribed && !res.error && res.totalCount > 0) {
          setServerRecords(res.data);
          setServerTotalCount(res.totalCount);
        } else if (isSubscribed && (res.error || res.totalCount === 0)) {
          setServerTotalCount(0);
        }
      } catch (err) {
        console.warn('Fallback to client record filtering:', err);
        if (isSubscribed) setServerTotalCount(0);
      } finally {
        if (isSubscribed) setIsServerLoading(false);
      }
    };

    if (serverSideMode) {
      loadServerFinance();
    }
    return () => {
      isSubscribed = false;
    };
  }, [
    serverSideMode,
    currentType,
    currentPage,
    itemsPerPage,
    filterState.searchQuery,
    effectiveStaffId,
    filterState.kpiQuickFilter,
    filterState.submissionStatus,
    startDateRPC,
    endDateRPC
  ]);

  // Phân trang
  const useServerData = serverSideMode && serverTotalCount > 0;
  const totalCount = useServerData ? serverTotalCount : filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = useMemo(() => {
    if (useServerData && serverRecords.length > 0) {
      return serverRecords;
    }
    return filteredRecords.slice(startIdx, startIdx + itemsPerPage);
  }, [useServerData, serverRecords, filteredRecords, startIdx, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Thao tác chọn dòng
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const unlockableIds = paginatedRecords
        .filter((r: any) => !isDateLocked(r.date, lockedKeys))
        .map((r: any) => r.id);
      setSelectedIds(unlockableIds);
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Cập nhật trạng thái thanh toán
  const changePaymentStatus = async (id: number, newStatus: string) => {
    const target = records.find((r: any) => r.id === id);
    if (!target) return;

    if (isDateLocked(target.date, lockedKeys)) {
      showAlert('Dữ liệu đã khóa', 'Kỳ tài chính của hồ sơ này đã được chốt khóa bảo vệ.', 'warning');
      return;
    }

    if (newStatus === 'Đã hủy') {
      await cancelRecordWithClawback(
        id,
        'Hủy thu tiền theo yêu cầu thao tác tại Bảng Tài Chính',
        currentUser?.name || 'Kế toán viên'
      );
      showToast('Đã hủy giao dịch và tạo nghiệp vụ thu hồi hoa hồng thành công!', 'success');
      return;
    }

    try {
      await updateRecord(id, { paymentStatus: newStatus });
      addAuditLog?.(
        'Đổi trạng thái thanh toán',
        `Đổi trạng thái giao dịch TXN${id} của ${target.name} sang "${newStatus}"`
      );
      showToast(`Đã chuyển trạng thái sang "${newStatus}"!`, 'success');
    } catch (err: any) {
      showAlert('Lỗi cập nhật', err.message || 'Không thể cập nhật trạng thái', 'error');
    }
  };

  // Đổi nhân viên thu
  const changeStaff = async (id: number, newStaffId: string) => {
    const target = records.find((r: any) => r.id === id);
    if (!target) return;

    if (isDateLocked(target.date, lockedKeys)) {
      showAlert('Dữ liệu đã khóa', 'Kỳ tài chính của hồ sơ này đã được chốt khóa bảo vệ.', 'warning');
      return;
    }

    try {
      await updateRecord(id, { staffId: newStaffId, staff_id: newStaffId });
      const staffName = staff.find((s: any) => s.id === newStaffId)?.name || 'Hệ thống';
      addAuditLog?.(
        'Đổi nhân viên phụ trách',
        `Chuyển hồ sơ TXN${id} của ${target.name} cho nhân viên ${staffName}`
      );
      showToast(`Đã chuyển nhân viên phụ trách sang ${staffName}!`, 'success');
    } catch (err: any) {
      showAlert('Lỗi cập nhật', err.message || 'Không thể đổi nhân viên', 'error');
    }
  };

  // Xóa giao dịch đơn lẻ
  const confirmDelete = (id: number) => {
    setDeletingId(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!deletingId) return;
    try {
      const rec = records.find((r: any) => r.id === deletingId);
      await deleteRecord(deletingId);
      addAuditLog?.(
        'Xóa giao dịch tài chính',
        `Đã xóa giao dịch TXN${deletingId} của ${rec?.name || 'Khách hàng'}`
      );
      showToast('Đã xóa giao dịch thành công!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xóa giao dịch', err.message || 'Không thể xóa giao dịch', 'error');
    } finally {
      setIsConfirmOpen(false);
      setDeletingId(null);
    }
  };

  // Xóa hàng loạt
  const confirmBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkDeleteRecords(selectedIds);
      addAuditLog?.(
        'Xóa hàng loạt giao dịch',
        `Đã xóa ${selectedIds.length} giao dịch tài chính đã chọn`
      );
      showToast(`Đã xóa ${selectedIds.length} giao dịch thành công!`, 'success');
      setSelectedIds([]);
    } catch (err: any) {
      showAlert('Lỗi xóa giao dịch', err.message || 'Không thể xóa danh sách giao dịch', 'error');
    } finally {
      setIsBulkDeleteConfirmOpen(false);
    }
  };

  // Chuyển hồ sơ theo đợt
  const handleOpenBatchModal = () => {
    if (selectedIds.length === 0) {
      showAlert('Chưa chọn hồ sơ', 'Vui lòng tích chọn ít nhất 1 hồ sơ để ghi nhận đợt chuyển BHXH.', 'warning');
      return;
    }
    const defaultBatch = generateBatchCode(getLocalYYYYMMDD(), 1);
    setBatchNameInput(defaultBatch);
    setBatchDateInput(getLocalYYYYMMDD());
    setBatchModalTargetIds(selectedIds);
    setIsBatchModalOpen(true);
  };

  const handleOpenBatchModalSingle = (record: any) => {
    setBatchNameInput(record.submissionBatch || generateBatchCode(getLocalYYYYMMDD(), 1));
    setBatchDateInput(record.submittedDate || getLocalYYYYMMDD());
    setBatchModalTargetIds([record.id]);
    setIsBatchModalOpen(true);
  };

  const handleSaveBatchSubmission = async (batchName: string, batchDate: string) => {
    if (!batchName.trim()) {
      showAlert('Thiếu tên đợt', 'Vui lòng nhập tên đợt chuyển (ví dụ: Đợt 1, Đợt 2)', 'warning');
      return;
    }

    try {
      const updates = batchModalTargetIds.map(id => ({
        id,
        isSubmittedBHXH: true,
        submissionBatch: batchName.trim(),
        submittedDate: batchDate
      }));

      await Promise.all(
        updates.map(u => updateRecord(u.id, {
          isSubmittedBHXH: u.isSubmittedBHXH,
          submissionBatch: u.submissionBatch,
          submittedDate: u.submittedDate
        }))
      );

      addAuditLog?.(
        'Ghi nhận đợt chuyển BHXH',
        `Đã chuyển ${batchModalTargetIds.length} hồ sơ theo "${batchName}" vào ngày ${formatDateVN(batchDate)}`
      );
      showToast(`Đã ghi nhận chuyển ${batchModalTargetIds.length} hồ sơ theo ${batchName}!`, 'success');
      setIsBatchModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      showAlert('Lỗi ghi nhận đợt chuyển', err.message || '', 'error');
    }
  };

  const handleUnmarkSubmission = async (targetIds: number[]) => {
    try {
      await Promise.all(
        targetIds.map(id => updateRecord(id, {
          isSubmittedBHXH: false,
          submissionBatch: null,
          submittedDate: null
        }))
      );
      addAuditLog?.('Hủy chuyển nộp BHXH', `Hủy đánh dấu chuyển nộp cho ${targetIds.length} hồ sơ`);
      showToast(`Đã hủy trạng thái chuyển nộp cho ${targetIds.length} hồ sơ!`, 'success');
      setIsBatchModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      showAlert('Lỗi hủy chuyển nộp', err.message || '', 'error');
    }
  };

  // Khóa / Mở khóa dữ liệu
  const handleInitiateLock = () => {
    if (!currentKey) return;
    setLockActionType('lock');
    setIsLockConfirmOpen(true);
  };

  const handleInitiateUnlock = (keyToUnlock: string) => {
    if (!keyToUnlock) return;
    setTargetUnlockKey(keyToUnlock);
    setLockActionType('unlock');
    setIsLockConfirmOpen(true);
  };

  const handleConfirmLockAction = async () => {
    try {
      const activePolicy = policies?.find((p: any) => p.parameter_type === 'locked_periods');
      let currentArr = [...lockedKeys];

      if (lockActionType === 'lock') {
        if (!currentArr.includes(currentKey)) {
          currentArr.push(currentKey);
        }
      } else {
        const keyToRemove = targetUnlockKey || currentKey;
        currentArr = currentArr.filter(k => k !== keyToRemove);
      }

      if (activePolicy) {
        await supabase
          .from('system_policies')
          .update({
            value: { lockedKeys: currentArr },
            updated_at: new Date().toISOString()
          })
          .eq('id', activePolicy.id);
      } else {
        await supabase
          .from('system_policies')
          .insert({
            parameter_type: 'locked_periods',
            is_active: true,
            value: { lockedKeys: currentArr },
            description: 'Danh sách các kỳ tài chính đã chốt khóa'
          });
      }

      await refreshData();
      const actionText = lockActionType === 'lock' ? 'Khóa thành công' : 'Mở khóa thành công';
      showToast(`${actionText} kỳ dữ liệu tài chính!`, 'success');
    } catch (err: any) {
      showAlert('Lỗi cập nhật chính sách khóa sổ', err.message || '', 'error');
    } finally {
      setIsLockConfirmOpen(false);
    }
  };

  // In / Xuất biên lai
  const handlePrintReceipt = (recId: number) => {
    const rec = records.find((r: any) => r.id === recId);
    if (!rec) return;
    executePrintReceipt(rec, staff);
    addAuditLog?.('In biên lai', `In biên lai thu tiền TXN${recId} của khách hàng ${rec.name}`);
  };

  const handleExportReceiptImage = async (recId: number) => {
    const rec = records.find((r: any) => r.id === recId);
    if (!rec) return;
    try {
      await exportReceiptAsImage(rec, staff, showToast, showAlert);
      addAuditLog?.('Xuất ảnh biên lai', `Xuất ảnh biên lai TXN${recId} của khách hàng ${rec.name}`);
      showToast('Đã tạo và tải ảnh biên lai thành công!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xuất ảnh', err.message || 'Không thể tạo file ảnh biên lai', 'error');
    }
  };

  const [isFinanceImporting, setIsFinanceImporting] = useState(false);

  // Nhập file Excel giao dịch vào Sổ quỹ
  const importFinanceExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setIsFinanceImporting(true);
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
          defaultType: currentType,
          staffList: staff,
          policies,
          settings,
          currentUserId: currentUser?.id
        });

        if (parsedResult.records.length === 0) {
          showAlert("Không tìm thấy dữ liệu", "Không có dòng dữ liệu giao dịch hợp lệ nào trong file.", "info");
          return;
        }

        const res = await bulkPutRecords(parsedResult.records);
        if (res) {
          addAuditLog?.('Nhập Excel Giao dịch Tài chính', `Đã nạp thành công ${parsedResult.records.length} giao dịch ${currentType} từ file ${file.name}`);
          showToast(`Nhập thành công ${parsedResult.records.length} giao dịch vào Sổ quỹ!`, 'success');
          await refreshData?.();
        } else {
          showAlert("Lỗi lưu trữ", "Không thể lưu danh sách giao dịch lên máy chủ.", "error");
        }
      } catch (err: any) {
        console.error("Lỗi khi import file Excel tài chính:", err);
        showAlert("Lỗi nhập file Excel", err.message || "Định dạng file không hợp lệ.", "error");
      } finally {
        setIsFinanceImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Xuất file Excel
  const exportFinanceExcel = async () => {
    if (filteredRecords.length === 0) {
      showAlert('Trống dữ liệu', 'Không có giao dịch nào phù hợp với bộ lọc hiện tại để xuất Excel.', 'warning');
      return;
    }
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const rows = filteredRecords.map((r: any) => {
      const rate = getCommissionRateForRecord(r, policies, settings);
      const commAmount = Number(r.amount) * rate;
      const staffName = r.staffId === 'admin' ? 'Admin (Tự thu)' : (staff.find((s: any) => s.id === r.staffId)?.name || 'Hệ thống');

      return {
        "Mã GD": `TXN${r.id ? r.id.toString().slice(-6) : 'NEW'}`,
        "Thời Gian Thu": formatDateVN(r.date),
        "Họ và Tên": r.name || "",
        "Mã ĐDCN / CCCD": r.cccd || "",
        "Mã số BHXH": r.bhxh || "",
        "Loại Hình": r.type,
        "Hình Thức": r.actionType || (r.isAdjustment ? "Bù trừ âm" : "Mới"),
        "Kỳ Đóng": (r.fromMonth && r.toMonth) ? `${formatMonthVN(r.fromMonth)} - ${formatMonthVN(r.toMonth)}` : "",
        "Số Tiền Thu (VNĐ)": Number(r.amount || 0),
        "Tỷ Lệ Hoa Hồng": `${(rate * 100).toFixed(1)}%`,
        "Hoa Hồng (VNĐ)": commAmount,
        "Trạng Thái Thanh Toán": r.paymentStatus || "",
        "Chuyển BHXH": r.isSubmittedBHXH ? "Đã chuyển" : "Chưa chuyển",
        "Đợt Chuyển BHXH": r.submissionBatch || "",
        "Ngày Chuyển BHXH": r.submittedDate ? formatDateVN(r.submittedDate) : "",
        "Nhân Viên Thu": staffName,
        "Ghi Chú": r.notes || ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    protectWorksheetFormulas(ws);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SoGiaoDich");

    const fileName = `So_Giao_Dich_${currentType}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fileName);
    addAuditLog?.('Xuất Excel Tài Chính', `Đã xuất ${rows.length} giao dịch ${currentType} ra file ${fileName}`);
    showToast("Xuất dữ liệu giao dịch thành công!");
  };

  const handleExportD03TS = async () => {
    try {
      const recordsToExport = filteredRecords.filter((r: any) => r.type === 'BHYT');
      if (recordsToExport.length === 0) {
        showAlert('Trống dữ liệu', 'Không có hồ sơ BHYT nào để xuất Mẫu D03-TS.', 'warning');
        return;
      }
      await exportD03TSStandardExcel({ records: recordsToExport, staffList: staff, periodLabel: dateRange.periodLabel });
      addAuditLog?.('Xuất Mẫu D03-TS', `Xuất ${recordsToExport.length} hồ sơ ra biểu mẫu D03-TS`);
      showToast('Xuất Mẫu D03-TS chuẩn BHXH VN thành công!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xuất D03-TS', err.message || '', 'error');
    }
  };

  const handleExportD05TS = async () => {
    try {
      const recordsToExport = filteredRecords.filter((r: any) => r.type === 'BHXH');
      if (recordsToExport.length === 0) {
        showAlert('Trống dữ liệu', 'Không có hồ sơ BHXH nào để xuất Mẫu D05-TS.', 'warning');
        return;
      }
      await exportD05TSStandardExcel({ records: recordsToExport, staffList: staff, periodLabel: dateRange.periodLabel });
      addAuditLog?.('Xuất Mẫu D05-TS', `Xuất ${recordsToExport.length} hồ sơ ra biểu mẫu D05-TS`);
      showToast('Xuất Mẫu D05-TS chuẩn BHXH VN thành công!', 'success');
    } catch (err: any) {
      showAlert('Lỗi xuất D05-TS', err.message || '', 'error');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 1. Thanh tiêu đề & Tác vụ chính */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Quản Lý Tài Chính & Sổ Quỹ {currentType}
            </h2>
            <span className="text-xs text-slate-500 font-normal">
              · {dateRange.periodLabel}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi dòng tiền, thu chi đại lý, công nợ khách hàng và đối soát chuyển nộp cơ quan BHXH
          </p>
        </div>

        {/* Nút tác nghiệp */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Chuyển tab Giao dịch vs Báo cáo đợt nộp */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveFinanceTab('transactions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFinanceTab === 'transactions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={14} />
              <span>Sổ Giao Dịch & Dòng Tiền</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFinanceTab('batches')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeFinanceTab === 'batches' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>Đợt Chuyển BHXH</span>
            </button>
          </div>

          {/* Ghi nhận đợt chuyển BHXH */}
          {selectedIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleOpenBatchModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
                title="Ghi nhận đợt chuyển nộp cho cơ quan BHXH"
              >
                <CheckSquare size={15} className="mr-1" />
                <span>Chuyển BHXH ({selectedIds.length})</span>
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
              >
                <Trash2 size={15} className="mr-1" />
                <span>Xóa ({selectedIds.length})</span>
              </button>
            </>
          )}

          {/* Khóa kỳ dữ liệu */}
          {isAdmin && (
            isCurrentPeriodLocked ? (
              <button
                type="button"
                onClick={() => handleInitiateUnlock(currentKey)}
                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
                title="Mở khóa kỳ dữ liệu tài chính này"
              >
                <Unlock size={15} className="mr-1 text-amber-700" />
                <span>Mở Khóa Kỳ</span>
              </button>
            ) : (
              Boolean(currentKey) && (
                <button
                  type="button"
                  onClick={handleInitiateLock}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
                  title="Chốt và khóa dữ liệu kỳ tài chính hiện tại"
                >
                  <Lock size={15} className="mr-1" />
                  <span>Khóa Kỳ ({currentPeriodLabel})</span>
                </button>
              )
            )
          )}

          {/* Nhập Excel Giao dịch */}
          {hasPermission(currentUser, 'records.create', settings) && (
            <label className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer">
              <FileUp size={15} className="mr-1 text-slate-500" />
              <span>{isFinanceImporting ? 'Đang nạp...' : 'Nhập Excel'}</span>
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={importFinanceExcel} disabled={isFinanceImporting} />
            </label>
          )}

          {/* Xuất Excel */}
          <button
            type="button"
            onClick={exportFinanceExcel}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
            title="Xuất danh sách sổ quỹ ra Excel"
          >
            <FileDown size={15} className="mr-1 text-slate-500" />
            <span>Xuất Excel</span>
          </button>

          {currentType === 'BHXH' ? (
            <button
              type="button"
              onClick={handleExportD05TS}
              className="bg-blue-50 text-[#004182] border border-blue-200 hover:bg-blue-100 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
              title="Xuất biểu mẫu D05-TS chuẩn BHXH"
            >
              <FileDown size={15} className="mr-1 text-[#004182]" />
              <span>Mẫu D05-TS</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportD03TS}
              className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-3 py-2 rounded-xl text-xs font-semibold transition shadow-xs flex items-center cursor-pointer"
              title="Xuất biểu mẫu D03-TS chuẩn BHYT"
            >
              <FileDown size={15} className="mr-1 text-emerald-600" />
              <span>Mẫu D03-TS</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner cảnh báo khi kỳ bị khóa */}
      {isCurrentPeriodLocked && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                Dữ Liệu {currentPeriodLabel} ĐÃ BỊ KHÓA BẢO VỆ
              </h4>
              <p className="text-xs text-amber-800 font-normal">
                Kỳ tài chính này đã được kế toán trưởng khóa sổ. Mọi hành động sửa hoặc xóa đã bị hạn chế để đảm bảo tính toàn vẹn số liệu.
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleInitiateUnlock(currentKey)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
            >
              <Unlock size={14} /> Mở Khóa Dữ Liệu
            </button>
          )}
        </div>
      )}

      {/* Nếu đang ở tab Báo cáo đợt nộp */}
      {activeFinanceTab === 'batches' ? (
        <SubmissionBatchReport typeFilter={currentType} />
      ) : (
        <>
          {/* 2. Thẻ KPI tài chính nhanh với font-mono căn chỉnh thẳng hàng */}
          <FinanceStatsCards
            stats={stats}
            kpiQuickFilter={filterState.kpiQuickFilter}
            onToggleKpiFilter={handleToggleKpiFilter}
            periodLabel={dateRange.periodLabel}
          />

          {/* 3. BẢNG THỐNG KÊ DÒNG TIỀN & CÂN ĐỐI TÀI CHÍNH TOÀN DIỆN (CASH FLOW STATEMENT) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div 
              onClick={() => setShowCashflowStatement(prev => !prev)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowCashflowStatement(prev => !prev); }}
              className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/70 transition"
            >
              <div className="flex items-center gap-2.5">
                <Landmark size={18} className="text-[#004182]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Bảng Thống Kê Dòng Tiền & Cân Đối Tài Chính ({currentPeriodLabel})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Phân tích chi tiết dòng tiền vào, dòng tiền ra, chi phí hoa hồng và tồn quỹ đối soát cơ quan BHXH
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="font-mono tabular-nums text-[#004182] font-bold">
                  Tồn quỹ: {formatMoney(cashflowSummary.netAgencyFunds)}
                </span>
                {showCashflowStatement ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {showCashflowStatement && (
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Cột 1: Dòng tiền vào (Inflow) */}
                  <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ArrowDownRight size={15} className="text-emerald-600" />
                          1. DÒNG TIỀN VÀO (THU KHÁCH HÀNG)
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {cashflowSummary.countPaid + cashflowSummary.countPending} GD
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 flex items-center gap-1">
                            <CheckCircle2 size={13} className="text-emerald-500" /> Thực thu từ khách hàng:
                          </span>
                          <span className="font-mono tabular-nums text-right font-bold text-emerald-700">
                            +{formatMoney(cashflowSummary.totalCollected)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Clock size={13} className="text-amber-500" /> Công nợ chờ thanh toán:
                          </span>
                          <span className="font-mono tabular-nums text-right font-semibold text-amber-700">
                            {formatMoney(cashflowSummary.totalPending)}
                          </span>
                        </div>
                        {cashflowSummary.countCancelled > 0 && (
                          <div className="flex justify-between items-center text-slate-400">
                            <span>Hồ sơ đã hủy ({cashflowSummary.countCancelled}):</span>
                            <span className="font-mono tabular-nums text-right">
                              {formatMoney(cashflowSummary.totalCancelled)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-700">Tổng Thực Thu Được:</span>
                      <span className="font-mono tabular-nums text-right text-base font-black text-emerald-700">
                        {formatMoney(cashflowSummary.totalCollected)}
                      </span>
                    </div>
                  </div>

                  {/* Cột 2: Dòng tiền ra & Nghiệp vụ (Outflow) */}
                  <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ArrowUpRight size={15} className="text-blue-600" />
                          2. DÒNG TIỀN RA & QUYẾT TOÁN
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {cashflowSummary.countSubmitted} đợt nộp
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Đã nộp cơ quan BHXH:</span>
                          <span className="font-mono tabular-nums text-right font-bold text-slate-800">
                            -{formatMoney(cashflowSummary.submittedToAgency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Hoa hồng chi trả nhân viên:</span>
                          <span className="font-mono tabular-nums text-right font-semibold text-[#b45309]">
                            -{formatMoney(cashflowSummary.totalCommissionPaid)}
                          </span>
                        </div>
                        {cashflowSummary.totalClawback > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-rose-600">Thu hồi hoa hồng / Clawback:</span>
                            <span className="font-mono tabular-nums text-right font-bold text-rose-600">
                              -{formatMoney(cashflowSummary.totalClawback)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-slate-700">Tổng Đã Chi / Chuyển:</span>
                      <span className="font-mono tabular-nums text-right text-base font-black text-slate-800">
                        {formatMoney(cashflowSummary.submittedToAgency + cashflowSummary.totalCommissionPaid)}
                      </span>
                    </div>
                  </div>

                  {/* Cột 3: Tồn quỹ & Cân đối ròng (Net Balance) */}
                  <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200">
                        <span className="text-xs font-bold text-[#004182] flex items-center gap-1.5">
                          <Wallet size={15} className="text-[#004182]" />
                          3. CÂN ĐỐI TỒN QUỸ RÒNG
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#004182]">
                          Đối soát
                        </span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Tiền giữ hộ chưa nộp BHXH:</span>
                          <span className="font-mono tabular-nums text-right font-bold text-blue-800">
                            {formatMoney(cashflowSummary.unsubmittedToAgency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Hồ sơ chờ nộp BHXH:</span>
                          <span className="font-mono tabular-nums text-right font-semibold text-slate-700">
                            {cashflowSummary.countUnsubmitted} hồ sơ
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Tỷ lệ hoàn thành nộp BHXH:</span>
                          <span className="font-mono tabular-nums text-right font-bold text-[#004182]">
                            {cashflowSummary.countPaid > 0 
                              ? `${Math.round((cashflowSummary.countSubmitted / cashflowSummary.countPaid) * 100)}%` 
                              : '0%'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-blue-200 flex justify-between items-baseline">
                      <span className="text-xs font-bold text-[#004182]">Tồn Quỹ Thực Tế:</span>
                      <span className="font-mono tabular-nums text-right text-base font-black text-[#004182]">
                        {formatMoney(cashflowSummary.netAgencyFunds)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Thanh lọc giao dịch thông minh & Bộ lọc kế toán */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <FinanceFilterBar
              filterState={filterState}
              setFilterState={setFilterState}
              availableBatches={availableBatches}
              staff={staff}
              currentUser={currentUser}
              onReset={handleResetFilters}
            />

            {/* 5. Bảng giao dịch tài chính với font-mono căn chỉnh thẳng hàng */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-4 w-12 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-[#004182] focus:ring-[#004182] cursor-pointer"
                        checked={selectedIds.length === paginatedRecords.length && paginatedRecords.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th className="p-4">Mã GD & Thời Gian</th>
                    <th className="p-4">Khách Hàng</th>
                    <th className="p-4">Loại GD</th>
                    <th className="p-4">Kỳ Đóng</th>
                    <th className="p-4 text-right">Số Tiền Thu</th>
                    <th className="p-4 text-right">Hoa Hồng</th>
                    <th className="p-4">Nhân Viên Thu</th>
                    <th className="p-4">Trạng Thái</th>
                    <th className="p-4 text-center">Chuyển BHXH</th>
                    <th className="p-4 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-500">
                        Không tìm thấy giao dịch nào phù hợp với điều kiện lọc.
                      </td>
                    </tr>
                  ) : (
                    paginatedRecords.map((r: any, index: number) => {
                      const recLocked = isDateLocked(r.date, lockedKeys);
                      const actionTag = r.isAdjustment
                        ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><RotateCcw size={10} className="mr-1" /> Bù trừ âm</span>
                        : r.actionType === 'Gia hạn' 
                          ? <span className="bg-[#FDB913]/20 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><RotateCw size={10} className="mr-1" /> Gia hạn</span>
                          : <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><Plus size={10} className="mr-1" /> Mới</span>;

                      const statusColors: any = {
                        'Đã thu tiền': 'text-emerald-700 bg-emerald-50 border-emerald-200',
                        'Chờ thanh toán': 'text-amber-700 bg-amber-50 border-amber-200',
                        'Đã hủy': 'text-rose-700 bg-rose-50 border-rose-200'
                      };
                      const colorClass = statusColors[r.paymentStatus] || statusColors['Đã thu tiền'];
                      const periodStr = (r.fromMonth && r.toMonth) ? `${formatMonthVN(r.fromMonth)} - ${formatMonthVN(r.toMonth)}` : '---';

                      const rate = getCommissionRateForRecord(r, policies, settings);
                      const commAmount = Number(r.amount) * rate;

                      return (
                        <tr 
                          key={r.id || `rec-${index}`} 
                          className={`hover:bg-slate-50/80 transition border-b border-slate-100 ${
                            recLocked ? 'bg-amber-50/20' : (r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : '')
                          }`}
                        >
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-[#004182] focus:ring-[#004182] disabled:opacity-50 cursor-pointer"
                              checked={r.id ? selectedIds.includes(r.id) : false}
                              onChange={() => r.id && handleSelectRow(r.id)}
                              disabled={!r.id || recLocked}
                              title={recLocked ? "Dữ liệu kỳ này đã bị khóa" : ""}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-bold text-slate-600">
                                TXN{r.id ? r.id.toString().slice(-6) : 'NEW'}
                              </span>
                              {recLocked && (
                                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5">
                                  <Lock size={10} /> Đã khóa
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono tabular-nums text-slate-400 block mt-0.5">
                              {new Date(r.date).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                            <p className="text-[11px] font-mono text-slate-500">{r.bhxh || r.cccd || r.phone}</p>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-1">
                              <span className={`font-bold text-xs ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-sky-700'}`}>
                                {r.type}
                              </span>
                              {actionTag}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono tabular-nums text-slate-600 font-medium">
                            {periodStr}
                          </td>
                          {/* SỐ TIỀN THU: font-mono tabular-nums text-right */}
                          <td className={`p-4 font-mono tabular-nums text-right font-bold text-sm ${
                            r.amount < 0 ? 'text-rose-600' : 'text-[#004182]'
                          }`}>
                            {formatMoney(r.amount)}
                          </td>
                          {/* HOA HỒNG: font-mono tabular-nums text-right */}
                          <td className={`p-4 font-mono tabular-nums text-right font-bold text-sm ${
                            commAmount < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}>
                            {commAmount > 0 ? '+' : ''}{formatMoney(commAmount)}
                          </td>
                          <td className="p-4">
                            {currentUser?.role === 'Nhân viên' ? (
                              <span className="text-xs font-medium text-slate-700">
                                {staff.find((s: any) => s.id === r.staffId)?.name || '-- Trống --'}
                              </span>
                            ) : (
                              <select 
                                value={r.staffId || ''} 
                                onChange={e => r.id && changeStaff(r.id, e.target.value)} 
                                disabled={!r.id || recLocked} 
                                className="text-xs font-medium rounded-lg px-2 py-1 border border-slate-200 outline-none cursor-pointer bg-white text-slate-700 max-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <option value="">-- Trống --</option>
                                {staff.map((s: any) => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="p-4">
                            <select 
                              value={r.paymentStatus || 'Chờ thanh toán'} 
                              onChange={e => r.id && changePaymentStatus(r.id, e.target.value)} 
                              disabled={!r.id || recLocked || (!canCollect && !canRefund && currentUser?.role !== 'Admin')} 
                              className={`text-xs font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
                            >
                              <option value="Đã thu tiền">Đã thu tiền</option>
                              <option value="Chờ thanh toán">Chờ thanh toán</option>
                              <option value="Đã hủy">Đã hủy</option>
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            {r.isSubmittedBHXH ? (
                              <div className="inline-flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => r.id && handleOpenBatchModalSingle(r)}
                                  disabled={!r.id || recLocked}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-xs transition cursor-pointer disabled:opacity-50"
                                  title="Xem/sửa đợt nộp"
                                >
                                  <CheckSquare size={13} className="text-emerald-600" />
                                  <span>Đã chuyển</span>
                                </button>
                                {(r.submissionBatch || r.submittedDate) && (
                                  <span className="text-[11px] font-mono font-bold text-emerald-800 mt-1 whitespace-nowrap bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200">
                                    {r.submissionBatch || 'Đợt chuyển'}{r.submittedDate ? ` (${dateISOToVN(r.submittedDate)})` : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => r.id && handleOpenBatchModalSingle(r)}
                                disabled={!r.id || recLocked}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer disabled:opacity-50"
                                title="Bấm để ghi nhận chuyển nộp BHXH"
                              >
                                <Square size={13} className="text-slate-400" />
                                <span>Chưa chuyển</span>
                              </button>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                type="button"
                                onClick={() => { setVietQrRecord(r); setIsVietQrOpen(true); }}
                                className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition cursor-pointer" 
                                title="Mã VietQR nộp tiền (NAPAS 247)"
                              >
                                <QrCode size={15} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => r.id && handlePrintReceipt(r.id)} 
                                disabled={!r.id} 
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer" 
                                title="In biên lai thu tiền"
                              >
                                <Printer size={15} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => r.id && handleExportReceiptImage(r.id)} 
                                disabled={!r.id} 
                                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition cursor-pointer" 
                                title="Xuất file ảnh biên lai"
                              >
                                <Image size={15} />
                              </button>
                              <button 
                                type="button"
                                onClick={() => r.id && confirmDelete(r.id)} 
                                disabled={!r.id || recLocked || Boolean(r.isSubmittedBHXH)} 
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40 transition cursor-pointer" 
                                title={r.isSubmittedBHXH ? "Không thể xóa hồ sơ đã chuyển cơ quan BHXH" : "Xóa"}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* HÀNG TỔNG KẾT DƯỚI BẢNG VỚI FONT-MONO CĂN PHẢI */}
                {paginatedRecords.length > 0 && (
                  <tfoot className="bg-slate-50/95 font-bold border-t border-slate-200 text-xs">
                    <tr>
                      <td colSpan={5} className="p-4 text-slate-700">
                        Tổng cộng trang hiện tại ({paginatedRecords.length} / {totalCount} giao dịch):
                      </td>
                      <td className="p-4 font-mono tabular-nums text-right text-sm text-[#004182]">
                        {formatMoney(paginatedRecords.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0))}
                      </td>
                      <td className="p-4 font-mono tabular-nums text-right text-sm text-emerald-700">
                        {formatMoney(paginatedRecords.reduce((acc: number, r: any) => {
                          const rate = getCommissionRateForRecord(r, policies, settings);
                          return acc + (Number(r.amount) * rate);
                        }, 0))}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Phân trang */}
            {totalPages > 1 && (
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
                  <span>trên tổng {totalCount} giao dịch</span>
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
        </>
      )}

      {/* ================= MODALS TÍCH HỢP ================= */}
      {isConfirmOpen && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={executeDelete}
          title="Xác nhận xóa giao dịch tài chính"
          message="Bạn có chắc chắn muốn xóa giao dịch này khỏi hệ thống? Thao tác này sẽ cập nhật lại dòng tiền và sổ kế toán."
        />
      )}

      {isBulkDeleteConfirmOpen && (
        <ConfirmModal
          isOpen={isBulkDeleteConfirmOpen}
          onClose={() => setIsBulkDeleteConfirmOpen(false)}
          onConfirm={executeBulkDelete}
          title="Xác nhận xóa hàng loạt giao dịch"
          message={`Bạn có chắc chắn muốn xóa ${selectedIds.length} giao dịch tài chính đã chọn?`}
        />
      )}

      {isBatchModalOpen && (
        <FinanceBatchModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          batchModalTargetIds={batchModalTargetIds}
          batchNameInput={batchNameInput}
          setBatchNameInput={setBatchNameInput}
          batchDateInput={batchDateInput}
          setBatchDateInput={setBatchDateInput}
          handleConfirmBatchSubmission={() => handleSaveBatchSubmission(batchNameInput, batchDateInput)}
          handleCancelBatchSubmission={() => handleUnmarkSubmission(batchModalTargetIds)}
          allRecords={records}
          type={currentType}
        />
      )}

      {isLockConfirmOpen && (
        <FinanceLockModal
          isOpen={isLockConfirmOpen}
          onClose={() => setIsLockConfirmOpen(false)}
          lockActionType={lockActionType}
          currentPeriodLabel={currentPeriodLabel}
          targetUnlockKey={targetUnlockKey || currentKey}
          formattedLockedList={formattedLockedList}
          executeLockCurrent={handleConfirmLockAction}
          executeUnlockKeys={() => handleConfirmLockAction()}
        />
      )}

      {vietQrRecord && (
        <VietQRModal
          isOpen={isVietQrOpen}
          onClose={() => {
            setIsVietQrOpen(false);
            setVietQrRecord(null);
          }}
          record={vietQrRecord}
        />
      )}
    </div>
  );
};

export default FinanceView;
