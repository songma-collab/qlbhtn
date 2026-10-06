import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  getOldBhxh10,
  formatPeriodKeyToLabel 
} from '../../utils/helpers';
import { parseMonthAndYear, toDbDate } from '../../utils/dateStandardHelper';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { policyService } from '../../services/policyService';
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
import { FinanceCashflowStatement } from './finance/FinanceCashflowStatement';
import { FinanceTransactionsTable } from './finance/FinanceTransactionsTable';
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
    refreshData,
    refreshTrigger
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
      const label = formatPeriodKeyToLabel(key) || key;
      let sortVal = 0;
      const yrMatch = key.match(/20\d{2}/);
      const mMatch = key.match(/(?:month[:_]|thang[_\s]?)(\d{1,2})/i) || key.match(/[-/](\d{1,2})/);
      const yr = yrMatch && yrMatch[0] ? parseInt(yrMatch[0], 10) : 2026;
      const mo = mMatch && mMatch[1] ? parseInt(mMatch[1], 10) : 1;
      sortVal = yr * 100 + mo;
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
    let equivalentKeys: string[] = [];

    if (filterState.periodType === 'MONTH' && filterState.selectedMonth) {
      cKey = `month:${filterState.selectedMonth}`;
      const parts = filterState.selectedMonth.split('-');
      if (parts.length === 2) {
        const [yr, mo] = parts;
        equivalentKeys = [
          cKey,
          `month_${mo}/${yr}`,
          `month_${mo}_${yr}`,
          `month:${mo}/${yr}`,
          `month:${yr}-${mo}`
        ];
      }
    } else if (filterState.periodType === 'QUARTER') {
      const q = Math.floor(new Date().getMonth() / 3) + 1;
      const yr = new Date().getFullYear();
      cKey = `quarter:${yr}-${q}`;
      equivalentKeys = [
        cKey,
        `quarter_${q}_${yr}`,
        `quarter_${q}/${yr}`,
        `quarter:${yr}-${q}`
      ];
    } else if (filterState.periodType === 'YEAR') {
      const yr = new Date().getFullYear();
      cKey = `year:${yr}`;
      equivalentKeys = [
        cKey,
        `year_${yr}`
      ];
    }

    if (equivalentKeys.length > 0 && lockedKeys.some(k => equivalentKeys.includes(k))) {
      isLocked = true;
    } else if (cKey && lockedKeys.includes(cKey)) {
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

  // Chế độ Server-Side Pagination & Search cho Tài chính (Hiệu năng cao, mở rộng > 100k giao dịch)
  const [serverSideMode, setServerSideMode] = useState<boolean>(true);
  const [serverRecords, setServerRecords] = useState<RecordType[]>([]);
  const [serverTotalCount, setServerTotalCount] = useState<number>(0);
  const [isServerLoading, setIsServerLoading] = useState<boolean>(false);
  const [serverRefreshTrigger, setServerRefreshTrigger] = useState<number>(0);

  const refreshServerData = useCallback(() => {
    setServerRefreshTrigger(prev => prev + 1);
  }, []);

  // Dữ liệu nguồn linh hoạt (ưu tiên AppContext records, dự phòng serverRecords nếu records chưa tải xong)
  const sourceRecords = useMemo(() => {
    if (records && records.length > 0) return records;
    if (serverRecords && serverRecords.length > 0) return serverRecords;
    return [];
  }, [records, serverRecords]);

  // Lọc danh sách giao dịch
  const filteredRecords = useMemo(() => {
    return sourceRecords
      .filter((r: any) => {
        if (r.type !== currentType) return false;
        const staffId = r.staff_id || r.staffId;
        if (effectiveStaffId && staffId !== effectiveStaffId) return false;

        if (startDateRPC && endDateRPC) {
          if (!r.date) return false;
          const recordDateStr = r.date.slice(0, 10);
          if (recordDateStr < startDateRPC || recordDateStr > endDateRPC) return false;
        }

        const paymentStatus = r.payment_status || r.paymentStatus || 'Chờ thanh toán';
        if (filterState.kpiQuickFilter === 'PAID') {
          if (paymentStatus !== 'Đã thu tiền') return false;
        } else if (filterState.kpiQuickFilter === 'PENDING') {
          if (paymentStatus !== 'Chờ thanh toán') return false;
        }

        const isSubmittedBHXH = r.is_submitted_bhxh !== undefined ? r.is_submitted_bhxh : r.isSubmittedBHXH;
        const submissionBatch = r.submission_batch || r.submissionBatch;
        if (filterState.submissionStatus === 'UNSUBMITTED') {
          if (isSubmittedBHXH) return false;
        } else if (filterState.submissionStatus === 'SUBMITTED') {
          if (!isSubmittedBHXH) return false;
        } else if (filterState.submissionStatus && filterState.submissionStatus !== 'ALL') {
          if (submissionBatch !== filterState.submissionStatus) return false;
        }

        if (filterState.searchQuery && filterState.searchQuery.trim() !== '') {
          const q = filterState.searchQuery.toLowerCase().trim();
          const txnCode = `txn${r.id ? r.id.toString().slice(-6) : ''}`.toLowerCase();
          const nameMatch = (r.name || '').toLowerCase().includes(q);
          const cccdMatch = (r.cccd || '').toLowerCase().includes(q);
          const bhxhMatch = (r.bhxh || '').toLowerCase().includes(q);
          const phoneMatch = (r.phone || '').toLowerCase().includes(q);
          const receiptMatch = (r.receipt_number || r.receiptNumber || '').toLowerCase().includes(q);
          const batchMatch = (submissionBatch || '').toLowerCase().includes(q);
          const txnMatch = txnCode.includes(q);

          if (!nameMatch && !cccdMatch && !bhxhMatch && !phoneMatch && !receiptMatch && !batchMatch && !txnMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sourceRecords, currentType, effectiveStaffId, startDateRPC, endDateRPC, filterState]);

  // Thống kê KPI cơ bản
  const stats = useMemo(() => {
    return computeTransactionKPIs(
      sourceRecords, 
      filterState, 
      { 
        type: currentType, 
        currentUserId: effectiveStaffId || undefined, 
        currentUserRole: currentUser?.role 
      }, 
      policies, 
      settings
    );
  }, [sourceRecords, filterState, currentType, effectiveStaffId, currentUser?.role, policies, settings]);

  // BẢNG THỐNG KÊ DÒNG TIỀN VÀ CÂN ĐỐI TÀI CHÍNH TOÀN DIỆN (CASH FLOW STATEMENT)
  const cashflowSummary = useMemo(() => {
    const relevant = sourceRecords.filter((r: any) => {
      if (r.type !== currentType) return false;
      const staffId = r.staff_id || r.staffId;
      if (effectiveStaffId && staffId !== effectiveStaffId) return false;
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

      const isAdjustment = r.is_adjustment !== undefined ? r.is_adjustment : r.isAdjustment;
      const paymentStatus = r.payment_status || r.paymentStatus || 'Chờ thanh toán';
      const isSubmittedBHXH = r.is_submitted_bhxh !== undefined ? r.is_submitted_bhxh : r.isSubmittedBHXH;

      if (isAdjustment || amt < 0) {
        totalClawback += Math.abs(amt);
      }

      if (paymentStatus === 'Đã thu tiền') {
        totalCollected += amt;
        countPaid++;
        totalCommissionPaid += comm;

        if (isSubmittedBHXH) {
          submittedToAgency += amt;
          countSubmitted++;
        } else {
          unsubmittedToAgency += amt;
          countUnsubmitted++;
        }
      } else if (paymentStatus === 'Chờ thanh toán') {
        totalPending += amt;
        countPending++;
      } else if (paymentStatus === 'Đã hủy') {
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
  }, [sourceRecords, currentType, effectiveStaffId, startDateRPC, endDateRPC, policies, settings]);

  // Danh sách các đợt nộp hợp lệ
  const availableBatches = useMemo(() => {
    const map = new Map<string, { count: number; totalAmount: number; date?: string }>();
    sourceRecords
      .filter((r: any) => {
        if (r.type !== currentType) return false;
        const isSubmittedBHXH = r.is_submitted_bhxh !== undefined ? r.is_submitted_bhxh : r.isSubmittedBHXH;
        const submissionBatch = r.submission_batch || r.submissionBatch;
        if (!isSubmittedBHXH || !submissionBatch) return false;
        const actionType = r.action_type || r.actionType;
        if (actionType === 'Nhập từ Excel') return false;
        const paymentStatus = r.payment_status || r.paymentStatus || 'Chờ thanh toán';
        if (paymentStatus === 'Đã hủy') return false;
        const staffId = r.staff_id || r.staffId;
        if (effectiveStaffId && staffId !== effectiveStaffId) return false;
        if (startDateRPC && endDateRPC) {
          if (!r.date) return false;
          const dStr = r.date.slice(0, 10);
          if (dStr < startDateRPC || dStr > endDateRPC) return false;
        }
        return true;
      })
      .forEach((r: any) => {
        const batchKey = (r.submission_batch || r.submissionBatch || '').trim();
        const submittedDate = r.submitted_date || r.submittedDate;
        const existing = map.get(batchKey) || { count: 0, totalAmount: 0, date: submittedDate };
        existing.count += 1;
        existing.totalAmount += (Number(r.amount) || 0);
        if (!existing.date && submittedDate) existing.date = submittedDate;
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
  }, [sourceRecords, currentType, effectiveStaffId, startDateRPC, endDateRPC]);


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
    endDateRPC,
    serverRefreshTrigger,
    refreshTrigger
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
    const target = sourceRecords.find((r: any) => r.id === id);
    if (!target) return;

    if (isDateLocked(target.date, lockedKeys)) {
      showAlert('Dữ liệu đã khóa', 'Kỳ tài chính của hồ sơ này đã được chốt khóa bảo vệ.', 'warning');
      return;
    }

    if (newStatus === 'Đã hủy') {
      // Cập nhật lạc quan tại chỗ
      setServerRecords(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'Đã hủy', paymentStatus: 'Đã hủy' } : r));
      await cancelRecordWithClawback(
        id,
        'Hủy thu tiền theo yêu cầu thao tác tại Bảng Tài Chính',
        currentUser?.name || 'Kế toán viên'
      );
      refreshServerData();
      showToast('Đã hủy giao dịch và tạo nghiệp vụ thu hồi hoa hồng thành công!', 'success');
      return;
    }

    // 1. Cập nhật lạc quan (Optimistic update) ngay lập tức trên UI
    setServerRecords(prev => prev.map(r => r.id === id ? { ...r, payment_status: newStatus, paymentStatus: newStatus } : r));

    try {
      await updateRecord(id, { payment_status: newStatus });
      refreshServerData();
      addAuditLog?.(
        'Đổi trạng thái thanh toán',
        `Đổi trạng thái giao dịch TXN${id} của ${target.name} sang "${newStatus}"`
      );
      showToast(`Đã chuyển trạng thái sang "${newStatus}"!`, 'success');
    } catch (err: any) {
      // Rollback nếu thất bại
      const origStatus = target.payment_status || (target as any).paymentStatus || 'Chờ thanh toán';
      setServerRecords(prev => prev.map(r => r.id === id ? { ...r, payment_status: origStatus, paymentStatus: origStatus } : r));
      showAlert('Lỗi cập nhật', err.message || 'Không thể cập nhật trạng thái', 'error');
    }
  };

  // Đổi nhân viên thu
  const changeStaff = async (id: number, newStaffId: string) => {
    const target = sourceRecords.find((r: any) => r.id === id);
    if (!target) return;

    if (isDateLocked(target.date, lockedKeys)) {
      showAlert('Dữ liệu đã khóa', 'Kỳ tài chính của hồ sơ này đã được chốt khóa bảo vệ.', 'warning');
      return;
    }

    // Cập nhật lạc quan (Optimistic update) ngay lập tức tại chỗ
    setServerRecords(prev => prev.map(r => r.id === id ? { ...r, staff_id: newStaffId, staffId: newStaffId } : r));

    try {
      await updateRecord(id, { staff_id: newStaffId });
      refreshServerData();
      const staffName = staff.find((s: any) => s.id === newStaffId)?.name || 'Hệ thống';
      addAuditLog?.(
        'Đổi nhân viên phụ trách',
        `Chuyển hồ sơ TXN${id} của ${target.name} cho nhân viên ${staffName}`
      );
      showToast(`Đã chuyển nhân viên phụ trách sang ${staffName}!`, 'success');
    } catch (err: any) {
      const origStaff = target.staff_id || (target as any).staffId || '';
      setServerRecords(prev => prev.map(r => r.id === id ? { ...r, staff_id: origStaff, staffId: origStaff } : r));
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
      const rec = sourceRecords.find((r: any) => r.id === deletingId);
      setServerRecords(prev => prev.filter(r => r.id !== deletingId));
      await deleteRecord(deletingId);
      refreshServerData();
      addAuditLog?.(
        'Xóa giao dịch tài chính',
        `Đã xóa giao dịch TXN${deletingId} của ${rec?.name || 'Khách hàng'}`
      );
      showToast('Đã xóa giao dịch thành công!', 'success');
    } catch (err: any) {
      refreshServerData();
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
      setServerRecords(prev => prev.filter(r => !selectedIds.includes(r.id)));
      await bulkDeleteRecords(selectedIds);
      refreshServerData();
      addAuditLog?.(
        'Xóa hàng loạt giao dịch',
        `Đã xóa ${selectedIds.length} giao dịch tài chính đã chọn`
      );
      showToast(`Đã xóa ${selectedIds.length} giao dịch thành công!`, 'success');
      setSelectedIds([]);
    } catch (err: any) {
      refreshServerData();
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
    const subBatch = record.submission_batch || record.submissionBatch;
    const subDate = record.submitted_date || record.submittedDate;
    setBatchNameInput(subBatch || generateBatchCode(getLocalYYYYMMDD(), 1));
    setBatchDateInput(subDate || getLocalYYYYMMDD());
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

      // Cập nhật lạc quan tại chỗ cho serverRecords
      setServerRecords(prev => prev.map(r => {
        if (batchModalTargetIds.includes(r.id)) {
          return {
            ...r,
            is_submitted_bhxh: true,
            isSubmittedBHXH: true,
            submission_batch: batchName.trim(),
            submissionBatch: batchName.trim(),
            submitted_date: batchDate,
            submittedDate: batchDate
          };
        }
        return r;
      }));

      await Promise.all(
        updates.map(u => updateRecord(u.id, {
          is_submitted_bhxh: u.isSubmittedBHXH,
          submission_batch: u.submissionBatch,
          submitted_date: u.submittedDate
        }))
      );
      refreshServerData();

      addAuditLog?.(
        'Ghi nhận đợt chuyển BHXH',
        `Đã chuyển ${batchModalTargetIds.length} hồ sơ theo "${batchName}" vào ngày ${formatDateVN(batchDate)}`
      );
      showToast(`Đã ghi nhận chuyển ${batchModalTargetIds.length} hồ sơ theo ${batchName}!`, 'success');
      setIsBatchModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      refreshServerData();
      showAlert('Lỗi ghi nhận đợt chuyển', err.message || '', 'error');
    }
  };

  const handleUnmarkSubmission = async (targetIds: number[]) => {
    try {
      // Cập nhật lạc quan tại chỗ
      setServerRecords(prev => prev.map(r => {
        if (targetIds.includes(r.id)) {
          return {
            ...r,
            is_submitted_bhxh: false,
            isSubmittedBHXH: false,
            submission_batch: undefined,
            submissionBatch: undefined,
            submitted_date: undefined,
            submittedDate: undefined
          };
        }
        return r;
      }));

      await Promise.all(
        targetIds.map(id => updateRecord(id, {
          is_submitted_bhxh: false,
          submission_batch: undefined,
          submitted_date: undefined
        }))
      );
      refreshServerData();

      addAuditLog?.('Hủy chuyển nộp BHXH', `Hủy đánh dấu chuyển nộp cho ${targetIds.length} hồ sơ`);
      showToast(`Đã hủy trạng thái chuyển nộp cho ${targetIds.length} hồ sơ!`, 'success');
      setIsBatchModalOpen(false);
      setSelectedIds([]);
    } catch (err: any) {
      refreshServerData();
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
        await policyService.updatePolicy(activePolicy.id, {
          value: { lockedKeys: currentArr }
        });
      } else {
        await policyService.addPolicy({
          parameter_type: 'locked_periods',
          name: 'Khóa kỳ tài chính',
          is_active: true,
          value: { lockedKeys: currentArr },
          effective_date: new Date().toISOString().split('T')[0] || '2026-01-01',
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
    const rec = sourceRecords.find((r: any) => r.id === recId);
    if (!rec) return;
    executePrintReceipt(rec, staff);
    addAuditLog?.('In biên lai', `In biên lai thu tiền TXN${recId} của khách hàng ${rec.name}`);
  };

  const handleExportReceiptImage = async (recId: number) => {
    const rec = sourceRecords.find((r: any) => r.id === recId);
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
          {hasPermission(currentUser, 'customers.create', settings) && (
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
          <FinanceCashflowStatement
            currentPeriodLabel={currentPeriodLabel}
            cashflowSummary={cashflowSummary}
            showCashflowStatement={showCashflowStatement}
            setShowCashflowStatement={setShowCashflowStatement}
          />

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

            {/* 5. Bảng giao dịch tài chính */}
            <FinanceTransactionsTable
              paginatedRecords={paginatedRecords}
              totalCount={totalCount}
              selectedIds={selectedIds}
              handleSelectAll={handleSelectAll}
              handleSelectRow={handleSelectRow}
              changeStaff={changeStaff}
              changePaymentStatus={changePaymentStatus}
              handleOpenBatchModalSingle={handleOpenBatchModalSingle}
              handlePrintReceipt={handlePrintReceipt}
              handleExportReceiptImage={handleExportReceiptImage}
              confirmDelete={confirmDelete}
              setVietQrRecord={setVietQrRecord}
              setIsVietQrOpen={setIsVietQrOpen}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              setItemsPerPage={setItemsPerPage}
              lockedKeys={lockedKeys}
              policies={policies}
              settings={settings}
              staff={staff}
              currentUser={currentUser}
              canCollect={canCollect}
              canRefund={canRefund}
            />
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
