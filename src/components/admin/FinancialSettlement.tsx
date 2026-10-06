import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, formatMonthVN, formatPeriodKeyToLabel } from '../../utils/helpers';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { calculateClawbackRatio } from '../../utils/clawbackSettlement';
import type { RecordType } from '../../context/types';
import { policyService } from '../../services/policyService';
import {
  Wallet,
  Lock,
  Unlock,
  FileDown,
  Printer,
  TrendingUp,
  ShieldAlert,
  Building2,
  Users,
  CheckCircle2,
  PlusCircle,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  Filter,
  BarChart3,
  PieChart,
  ArrowUpRight,
  Sparkles,
  Calendar
} from 'lucide-react';
import { RefundClawbackModal } from '../modals/RefundClawbackModal';
import { ViewClawbackModal } from '../modals/ViewClawbackModal';
import { EditClawbackModal } from '../modals/EditClawbackModal';
import { FinancialPeriodUnlockModal } from '../modals/FinancialPeriodUnlockModal';
import { FinancialSettlementStatsCards } from './finance/FinancialSettlementStatsCards';
import { FinancialSettlementCharts } from './finance/FinancialSettlementCharts';
import { StaffCommissionBreakdownTable } from './finance/StaffCommissionBreakdownTable';
import { ClawbackRecordsTable } from './finance/ClawbackRecordsTable';

const FinancialSettlement: React.FC = () => {
  const { staff, settings, currentUser, records, policies, showToast, showAlert, refreshData, addAuditLog, updateRecord, deleteRecord } = useAppContext();

  // Filters
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BHXH' | 'BHYT'>('ALL');

  // Khôi phục bộ lọc mặc định
  const handleResetFilters = () => {
    setPeriod('month');
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    setCustomStartDate('');
    setCustomEndDate('');
    setStaffFilter('all');
    setTypeFilter('ALL');
    showToast?.('Đã khôi phục bộ lọc kỳ báo cáo về mặc định', 'info');
  };

  // Modal unlock state
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  // Modal refund & sub-tab states
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [settlementSubTab, setSettlementSubTab] = useState<'summary' | 'clawback'>('summary');

  // Clawback view/edit/delete states
  const [viewingClawbackRecord, setViewingClawbackRecord] = useState<RecordType | null>(null);
  const [editingClawbackRecord, setEditingClawbackRecord] = useState<RecordType | null>(null);
  const [deletingClawbackRecord, setDeletingClawbackRecord] = useState<RecordType | null>(null);

  const isAdminOrManager = useMemo(() => {
    return currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'Quản lý';
  }, [currentUser]);

  // Current Lock Keys from Policy
  const lockedKeysList = useMemo<string[]>(() => {
    const p = policies?.find(x => x.parameter_type === 'locked_periods' && x.is_active);
    if (!p) return [];
    if (Array.isArray(p.value)) return p.value as string[];
    if (p.value && Array.isArray(p.value.lockedKeys)) return p.value.lockedKeys as string[];
    return [];
  }, [policies]);

  // Determine current active lock key based on selected period
  const currentPeriodKey = useMemo(() => {
    const mStr = String(selectedMonth).padStart(2, '0');
    if (period === 'month') {
      return `month_${mStr}/${selectedYear}`;
    } else if (period === 'last_month') {
      const targetMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const targetYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const lmStr = String(targetMonth).padStart(2, '0');
      return `month_${lmStr}/${targetYear}`;
    } else if (period === 'quarter') {
      const qNum = Math.ceil(selectedMonth / 3);
      return `quarter_${qNum}_${selectedYear}`;
    } else if (period === 'year') {
      return `year_${selectedYear}`;
    }
    return `month_${mStr}/${selectedYear}`;
  }, [period, selectedMonth, selectedYear]);

  // Danh sách các biến thể khóa tương đương để kiểm tra khóa đa chiều
  const currentEquivalentLockKeys = useMemo(() => {
    const mStr = String(selectedMonth).padStart(2, '0');
    const yStr = String(selectedYear);
    const qNum = Math.ceil(selectedMonth / 3);

    const keys = [currentPeriodKey];
    if (period === 'month') {
      keys.push(`month_${mStr}/${yStr}`, `month_${mStr}_${yStr}`, `month:${yStr}-${mStr}`, `month:${mStr}/${yStr}`);
    } else if (period === 'last_month') {
      const targetMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const targetYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const lmStr = String(targetMonth).padStart(2, '0');
      const lyStr = String(targetYear);
      keys.push(`month_${lmStr}/${lyStr}`, `month_${lmStr}_${lyStr}`, `month:${lyStr}-${lmStr}`, `month:${lmStr}/${lyStr}`);
    } else if (period === 'quarter') {
      keys.push(`quarter_${qNum}_${yStr}`, `quarter:${yStr}-${qNum}`, `quarter_${qNum}/${yStr}`);
    } else if (period === 'year') {
      keys.push(`year_${yStr}`, `year:${yStr}`);
    }
    return Array.from(new Set(keys));
  }, [currentPeriodKey, period, selectedMonth, selectedYear]);

  const isCurrentPeriodLocked = useMemo(() => {
    return lockedKeysList.some(k => currentEquivalentLockKeys.includes(k));
  }, [lockedKeysList, currentEquivalentLockKeys]);

  // Calculate Date Boundaries
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (period === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    } else if (period === 'last_month') {
      const targetMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const targetYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      start = new Date(targetYear, targetMonth - 1, 1, 0, 0, 0, 0);
      end = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
    } else if (period === 'quarter') {
      const qNum = Math.ceil(selectedMonth / 3);
      start = new Date(selectedYear, (qNum - 1) * 3, 1, 0, 0, 0, 0);
      end = new Date(selectedYear, qNum * 3, 0, 23, 59, 59, 999);
    } else if (period === 'year') {
      start = new Date(selectedYear, 0, 1, 0, 0, 0, 0);
      end = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
    } else if (period === 'custom' && customStartDate && customEndDate) {
      start = new Date(`${customStartDate}T00:00:00`);
      end = new Date(`${customEndDate}T23:59:59`);
    } else {
      start = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    }

    return { start, end };
  }, [period, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Nhãn hiển thị kỳ báo cáo chuẩn nghiệp vụ tiếng Việt (thay vì hiện mã kỹ thuật month_09/2026)
  const currentPeriodLabel = useMemo(() => {
    if (period === 'today') {
      return `Hôm nay (${new Date().toLocaleDateString('vi-VN')})`;
    }
    if (period === 'week') {
      return `Tuần này (${dateRange.start.toLocaleDateString('vi-VN')} – ${dateRange.end.toLocaleDateString('vi-VN')})`;
    }
    if (period === 'month') {
      const mStr = String(selectedMonth).padStart(2, '0');
      return `Tháng ${mStr}/${selectedYear}`;
    }
    if (period === 'last_month') {
      const targetMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
      const targetYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
      const mStr = String(targetMonth).padStart(2, '0');
      return `Tháng ${mStr}/${targetYear} (Tháng trước)`;
    }
    if (period === 'quarter') {
      const qNum = Math.ceil(selectedMonth / 3);
      return `Quý ${qNum}/${selectedYear}`;
    }
    if (period === 'year') {
      return `Năm ${selectedYear}`;
    }
    if (period === 'custom') {
      if (customStartDate && customEndDate) {
        return `${new Date(customStartDate).toLocaleDateString('vi-VN')} – ${new Date(customEndDate).toLocaleDateString('vi-VN')}`;
      }
      return 'Khoảng ngày tùy chọn';
    }
    return formatPeriodKeyToLabel(currentPeriodKey);
  }, [period, selectedMonth, selectedYear, dateRange, customStartDate, customEndDate, currentPeriodKey]);

  // Filtered Records
  const { periodRecords, paidRecords, cancelledRecords, clawbackRecords } = useMemo(() => {
    let recs = records || [];

    // Filter by staff if not Admin or if specific staff chosen
    if (!isAdminOrManager) {
      recs = recs.filter(r => (r.staff_id || (r as any).staffId) === currentUser?.id);
    } else if (staffFilter !== 'all') {
      recs = recs.filter(r => (r.staff_id || (r as any).staffId) === staffFilter);
    }

    // Filter by type
    if (typeFilter !== 'ALL') {
      recs = recs.filter(r => r.type === typeFilter);
    }

    // Filter by date
    const inPeriod = recs.filter(r => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d >= dateRange.start && d <= dateRange.end;
    });

    const paid = inPeriod.filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền' && (r.is_adjustment !== true && (r as any).isAdjustment !== true));
    const cancelled = inPeriod.filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã hủy');
    const clawback = inPeriod.filter(r => (r.is_adjustment === true || (r as any).isAdjustment === true) || (r.payment_status || (r as any).paymentStatus) === 'Đã thoái thu');

    return { 
      periodRecords: inPeriod, 
      paidRecords: paid, 
      cancelledRecords: cancelled,
      clawbackRecords: clawback
    };
  }, [records, isAdminOrManager, currentUser, staffFilter, typeFilter, dateRange]);

  // Financial Calculations
  const financialStats = useMemo(() => {
    let grossRevenue = 0; // Tổng thực thu phát sinh từ khách (Gross)
    let bhxhRevenue = 0;
    let bhytRevenue = 0;

    let bhxhNewRevenue = 0;
    let bhxhRenewRevenue = 0;
    let bhytNewRevenue = 0;
    let bhytRenewRevenue = 0;

    let grossStaffCommission = 0; // Hoa hồng gộp chi trả cho cán bộ thu
    let bhxhStaffComm = 0;
    let bhytStaffComm = 0;

    const isRenew = (r: any) => String(r.actionType || '').toLowerCase().includes('gia hạn') || String(r.actionType || '').toLowerCase().includes('đóng tiếp');

    paidRecords.forEach(r => {
      const amt = Number(r.amount) || 0;
      grossRevenue += amt;

      const rate = getCommissionRateForRecord(r, policies, settings);
      const comm = amt * rate;
      grossStaffCommission += comm;

      if (r.type === 'BHXH') {
        bhxhRevenue += amt;
        bhxhStaffComm += comm;
        if (isRenew(r)) {
          bhxhRenewRevenue += amt;
        } else {
          bhxhNewRevenue += amt;
        }
      } else {
        bhytRevenue += amt;
        bhytStaffComm += comm;
        if (isRenew(r)) {
          bhytRenewRevenue += amt;
        } else {
          bhytNewRevenue += amt;
        }
      }
    });

    // Helper to calculate exact or fallback clawback commission
    const getClawbackCommission = (r: RecordType) => {
      let comm = Math.abs(Number(r.commission) || 0);
      const origId = r.original_record_id || (r as any).originalRecordId;
      if (comm === 0 && origId) {
        const orig = records.find(x => x.id === origId);
        if (orig) {
          comm = calculateClawbackRatio(orig, Math.abs(Number(r.amount) || 0), policies, settings).clawbackCommission;
        }
      }
      return comm;
    };

    // 1. Thoái thu từ các bút toán Invariant 3 (Clawback & Refund - Single Source of Truth)
    // Tính toán 100% dựa trên các bút toán thoái thu thực tế do nhân viên lập
    const clawbackAmountTotal = clawbackRecords.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0);
    const clawbackCommissionTotal = clawbackRecords.reduce((sum, r) => sum + getClawbackCommission(r), 0);

    // 2. Giao dịch bị hủy: Phân lập hoàn toàn, chỉ mang tính chất hủy bỏ giao dịch chưa thực hiện, không đưa vào chỉ tiêu Thoái thu & Hoàn trả
    const cancelledTotal = cancelledRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    // Tổng thoái thu & Tổng hoa hồng thu hồi: 100% từ bút toán thoái thu thực tế
    const totalRefund = clawbackAmountTotal;
    const refundCommissionDeducted = clawbackCommissionTotal;

    // Doanh thu thuần và hoa hồng thực chi sau thoái thu
    const netRevenue = Math.max(0, grossRevenue - totalRefund);
    const netStaffCommission = Math.max(0, grossStaffCommission - refundCommissionDeducted);

    // Nộp Cơ quan BHXH (Gốc): Bằng doanh thu phát sinh
    const totalPayToBHXH = grossRevenue;
    const retainedMargin = grossStaffCommission;
    const netCashflow = netRevenue;

    return {
      totalRevenue: grossRevenue,
      grossRevenue,
      netRevenue,
      bhxhRevenue,
      bhytRevenue,
      bhxhNewRevenue,
      bhxhRenewRevenue,
      bhytNewRevenue,
      bhytRenewRevenue,
      totalStaffCommission: grossStaffCommission,
      grossStaffCommission,
      netStaffCommission,
      bhxhStaffComm,
      bhytStaffComm,
      totalRefund,
      clawbackAmountTotal,
      clawbackCommissionTotal,
      refundCommissionDeducted,
      totalPayToBHXH,
      retainedMargin,
      netCashflow,
      paidCount: paidRecords.length,
      cancelledCount: cancelledRecords.length,
      cancelledTotal,
      clawbackCount: clawbackRecords.length,
      bhxhCount: paidRecords.filter(r => r.type === 'BHXH').length,
      bhytCount: paidRecords.filter(r => r.type === 'BHYT').length,
    };
  }, [paidRecords, cancelledRecords, clawbackRecords, policies, settings]);

  // Staff Breakdown
  const staffBreakdown = useMemo(() => {
    const staffToProcess = !isAdminOrManager 
      ? staff.filter(s => s.id === currentUser?.id)
      : (staffFilter === 'all' ? staff : staff.filter(s => s.id === staffFilter));

    const isRenew = (r: any) => String(r.action_type || r.actionType || '').toLowerCase().includes('gia hạn') || String(r.action_type || r.actionType || '').toLowerCase().includes('đóng tiếp');

    return staffToProcess.map(s => {
      const sPaid = paidRecords.filter(r => (r.staff_id || (r as any).staffId) === s.id);
      const sCancelled = cancelledRecords.filter(r => (r.staff_id || (r as any).staffId) === s.id);
      const sClawback = clawbackRecords.filter(r => (r.staff_id || (r as any).staffId) === s.id);

      const sRevenue = sPaid.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const sBhxhCount = sPaid.filter(r => r.type === 'BHXH').length;
      const sBhytCount = sPaid.filter(r => r.type === 'BHYT').length;

      let sBhxhNewComm = 0;
      let sBhxhRenewComm = 0;
      let sBhytNewComm = 0;
      let sBhytRenewComm = 0;

      sPaid.forEach(r => {
        const amt = Number(r.amount) || 0;
        const rate = getCommissionRateForRecord(r, policies, settings);
        const comm = amt * rate;
        if (r.type === 'BHXH') {
          if (isRenew(r)) sBhxhRenewComm += comm;
          else sBhxhNewComm += comm;
        } else {
          if (isRenew(r)) sBhytRenewComm += comm;
          else sBhytNewComm += comm;
        }
      });

      const sGrossComm = sBhxhNewComm + sBhxhRenewComm + sBhytNewComm + sBhytRenewComm;
      const sClawbackComm = sClawback.reduce((sum, r) => {
        let comm = Math.abs(Number(r.commission) || 0);
        const origId = r.original_record_id || (r as any).originalRecordId;
        if (comm === 0 && origId) {
          const orig = records.find(x => x.id === origId);
          if (orig) {
            comm = calculateClawbackRatio(orig, Math.abs(Number(r.amount) || 0), policies, settings).clawbackCommission;
          }
        }
        return sum + comm;
      }, 0);
      // Thu hồi hoa hồng 100% dựa trên các bút toán thoái thu thực tế do nhân viên lập (không trừ hoa hồng của đơn bị hủy)
      const sRefundDeduction = sClawbackComm;
      const sNetComm = Math.max(0, sGrossComm - sRefundDeduction);
      const sClawbackAmount = sClawback.reduce((sum, r) => sum + Math.abs(Number(r.amount) || 0), 0);

      return {
        ...s,
        totalRevenue: sRevenue,
        bhxhCount: sBhxhCount,
        bhytCount: sBhytCount,
        bhxhNewComm: sBhxhNewComm,
        bhxhRenewComm: sBhxhRenewComm,
        bhytNewComm: sBhytNewComm,
        bhytRenewComm: sBhytRenewComm,
        grossCommission: sGrossComm,
        refundDeduction: sRefundDeduction,
        clawbackCount: sClawback.length,
        clawbackAmount: sClawbackAmount,
        netCommission: sNetComm,
        paidCount: sPaid.length,
      };
    }).filter(s => s.paidCount > 0 || s.clawbackCount > 0 || staffFilter !== 'all');
  }, [staff, isAdminOrManager, currentUser, staffFilter, paidRecords, cancelledRecords, clawbackRecords, policies, settings]);

  // Handle Lock Period (Chốt Sổ)
  const handleLockPeriod = async () => {
    if (!isAdminOrManager) {
      showToast('Chỉ Quản trị viên hoặc Quản lý mới có quyền chốt sổ kỳ tài chính!', 'error');
      return;
    }

    if (isCurrentPeriodLocked) {
      showToast('Kỳ tài chính này đã được khóa trước đó!', 'info');
      return;
    }

    setIsLocking(true);
    try {
      const newLockedKeys = Array.from(new Set([...lockedKeysList, currentPeriodKey]));
      const existingPolicy = policies?.find(p => p.parameter_type === 'locked_periods');

      if (existingPolicy) {
        const { error } = await policyService.updatePolicy(existingPolicy.id, {
          value: newLockedKeys,
          is_active: true
        });

        if (error) throw error;
      } else {
        const { error } = await policyService.addPolicy({
          parameter_type: 'locked_periods',
          name: 'Khóa kỳ tài chính hệ thống',
          value: newLockedKeys,
          effective_date: new Date().toISOString().split('T')[0] || '2026-01-01',
          is_active: true,
          description: 'Danh sách các mốc thời gian đã chốt sổ và khóa dữ liệu kế toán'
        });

        if (error) throw error;
      }

      await addAuditLog('Lock Financial Period', `Đã chốt sổ kỳ ${currentPeriodLabel}`);

      showToast(`Đã chốt sổ & kích hoạt khóa dữ liệu kỳ ${currentPeriodLabel} thành công!`, 'success');
      await refreshData();
    } catch (err: any) {
      console.error('Error locking period:', err);
      showToast('Lỗi khi chốt sổ kỳ tài chính: ' + (err.message || 'Lỗi không xác định'), 'error');
    } finally {
      setIsLocking(false);
    }
  };

  // Handle Unlock Period (Mở Khóa Kỳ)
  const handleUnlockPeriod = async () => {
    if (!isAdminOrManager) {
      showToast('Chỉ Quản trị viên hoặc Quản lý mới có quyền mở khóa sổ!', 'error');
      return;
    }

    const trimmedReason = unlockReason.trim();
    if (trimmedReason.length < 5) {
      showToast('Vui lòng nhập lý do mở khóa tối thiểu 5 ký tự!', 'error');
      return;
    }

    setIsLocking(true);
    try {
      const newLockedKeys = lockedKeysList.filter(k => !currentEquivalentLockKeys.includes(k));
      const existingPolicy = policies?.find(p => p.parameter_type === 'locked_periods');

      if (existingPolicy) {
        const { error } = await policyService.updatePolicy(existingPolicy.id, {
          value: newLockedKeys,
          is_active: true
        });

        if (error) throw error;
      }

      await addAuditLog('Unlock Financial Period', `Đã mở khóa kỳ ${currentPeriodLabel}: ${trimmedReason}`);

      showToast(`Đã mở khóa kỳ tài chính ${currentPeriodLabel} thành công!`, 'success');
      setIsUnlockModalOpen(false);
      setUnlockReason('');
      await refreshData();
    } catch (err: any) {
      console.error('Error unlocking period:', err);
      showToast('Lỗi khi mở khóa kỳ: ' + (err.message || 'Lỗi không xác định'), 'error');
    } finally {
      setIsLocking(false);
    }
  };

  // Handle Delete Clawback Record
  const handleDeleteClawback = async () => {
    if (!deletingClawbackRecord) return;
    try {
      // Revert original record if it was marked as 'Đã thoái thu'
      const origId = deletingClawbackRecord.original_record_id || (deletingClawbackRecord as any).originalRecordId;
      if (origId) {
        const orig = records.find(r => r.id === origId);
        const origStatus = orig?.payment_status || (orig as any)?.paymentStatus;
        if (orig && origStatus === 'Đã thoái thu') {
          await updateRecord(orig.id, {
            payment_status: 'Đã thu tiền',
            notes: `${orig.notes || ''}\n[Khôi phục sau khi xóa bút toán thoái thu #${deletingClawbackRecord.id}]`.trim()
          });
        }
      }
      const ok = await deleteRecord(deletingClawbackRecord.id);
      if (ok) {
        await addAuditLog(
          'Xóa bút toán thoái thu',
          `Xóa bút toán #${deletingClawbackRecord.id} của khách hàng ${deletingClawbackRecord.name} (Số tiền: -${formatMoney(Math.abs(Number(deletingClawbackRecord.amount) || 0))})`
        );
        showToast('Đã xóa bút toán thoái thu thành công!', 'success');
        if (refreshData) await refreshData();
      } else {
        showToast('Không thể xóa bút toán thoái thu.', 'error');
      }
    } catch (err: any) {
      console.error('Error deleting clawback record:', err);
      showAlert('Lỗi xóa bút toán', err.message || 'Không thể xóa bút toán thoái thu.');
    } finally {
      setDeletingClawbackRecord(null);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp tài chính
      const summaryData = [
        ['BÁO CÁO TÀI CHÍNH & QUYẾT TOÁN CHỐT SỔ ĐẠI LÝ BHXH'],
        [`Kỳ báo cáo: ${currentPeriodLabel} (${dateRange.start.toLocaleDateString('vi-VN')} – ${dateRange.end.toLocaleDateString('vi-VN')})`],
        [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`],
        [`Người lập: ${currentUser?.name || 'Admin'}`],
        [''],
        ['CHỈ TIÊU TÀI CHÍNH', 'SỐ LƯỢNG HỒ SƠ', 'GIÁ TRỊ (VNĐ)'],
        ['1. Tổng thu phát sinh từ khách hàng (Gross)', financialStats.paidCount, financialStats.grossRevenue],
        ['   - Thu BHXH tự nguyện', financialStats.bhxhCount, financialStats.bhxhRevenue],
        ['     + Tăng mới BHXH', '', financialStats.bhxhNewRevenue],
        ['     + Gia hạn BHXH', '', financialStats.bhxhRenewRevenue],
        ['   - Thu BHYT hộ gia đình', financialStats.bhytCount, financialStats.bhytRevenue],
        ['     + Tăng mới BHYT', '', financialStats.bhytNewRevenue],
        ['     + Gia hạn BHYT', '', financialStats.bhytRenewRevenue],
        ['2. Thoái thu & Hoàn trả (Bút toán thực tế)', financialStats.clawbackCount, -financialStats.totalRefund],
        ['   - Bút toán thoái thu hoàn trả (Clawback)', financialStats.clawbackCount, -financialStats.clawbackAmountTotal],
        ['3. Doanh thu thuần thực nộp BHXH (Net = Gross - Thoái thu)', '', financialStats.netRevenue],
        ['4. Tổng hoa hồng phát sinh gộp', '', financialStats.grossStaffCommission],
        ['   - Hoa hồng BHXH', '', financialStats.bhxhStaffComm],
        ['   - Hoa hồng BHYT', '', financialStats.bhytStaffComm],
        ['5. Thu hồi hoa hồng thoái thu (Từ bút toán thực tế)', '', -financialStats.refundCommissionDeducted],
        ['6. Hoa hồng thực chi cán bộ thu (Net)', '', financialStats.netStaffCommission],
        ['7. Tồn két / Dòng tiền ròng thực tế', '', financialStats.netCashflow],
        ['8. Trạng thái kỳ', '', isCurrentPeriodLocked ? 'ĐÃ KHÓA SỔ' : 'ĐANG MỞ'],
        ['Ghi chú: Hồ sơ bị hủy (chưa thực hiện - không tính vào thoái thu)', financialStats.cancelledCount, financialStats.cancelledTotal]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Tong_Hop_Tai_Chinh');

      // Sheet 2: Bảng kê hoa hồng cán bộ
      const staffHeader = ['STT', 'Mã NV', 'Tên Cán Bộ', 'Số Đơn Thu', 'Doanh Số (VNĐ)', 'HH BHXH Mới', 'HH BHXH Gia Hạn', 'HH BHYT Mới', 'HH BHYT Gia Hạn', 'Thu Hồi Thoái Thu', 'Thực Nhận (VNĐ)'];
      const staffRows = staffBreakdown.map((s, idx) => [
        idx + 1,
        (s as any).staff_code || (s as any).staffCode || s.id,
        s.name,
        s.paidCount,
        s.totalRevenue,
        s.bhxhNewComm,
        s.bhxhRenewComm,
        s.bhytNewComm,
        s.bhytRenewComm,
        s.refundDeduction,
        s.netCommission
      ]);
      const wsStaff = XLSX.utils.aoa_to_sheet([staffHeader, ...staffRows]);
      XLSX.utils.book_append_sheet(wb, wsStaff, 'Bang_Ke_Hoa_Hong_Can_Bo');

      // Sheet 3: Phụ lục thoái thu hoàn trả (Clawback Appendix)
      const clawbackHeader = ['STT', 'Mã Bút Toán', 'Mã Đơn Gốc', 'Ngày Hạch Toán', 'Khách Hàng', 'CCCD/CMND', 'Mã BHXH', 'Nghiệp Vụ', 'Số QĐ Thoái Thu', 'Ngày QĐ', 'Lý Do Thoái Thu', 'Số Tiền Thoái Thu (VNĐ)', 'Thu Hồi Hoa Hồng (VNĐ)', 'Cán Bộ Thu', 'Hình Thức'];
      const clawbackRows = clawbackRecords.map((r, idx) => {
        const rSId = r.staff_id || (r as any).staffId;
        const decD = r.decision_date || (r as any).decisionDate;
        return [
          idx + 1,
          r.id,
          r.original_record_id || (r as any).originalRecordId || 'N/A',
          r.date ? new Date(r.date).toLocaleDateString('vi-VN') : '',
          r.name,
          r.cccd || '',
          r.bhxh || '',
          r.type,
          r.decision_number || (r as any).decisionNumber || '',
          decD ? new Date(decD).toLocaleDateString('vi-VN') : '',
          r.adjustment_reason || (r as any).adjustmentReason || r.notes || '',
          -Math.abs(Number(r.amount) || 0),
          -Math.abs(Number(r.commission) || 0),
          staff.find(s => s.id === rSId)?.name || rSId || 'N/A',
          (r.refund_method || (r as any).refundMethod) === 'CHUYEN_KHOAN' ? 'Chuyển khoản' : 'Tiền mặt'
        ];
      });
      const wsClawback = XLSX.utils.aoa_to_sheet([clawbackHeader, ...clawbackRows]);
      XLSX.utils.book_append_sheet(wb, wsClawback, 'Phu_Luc_Thoai_Thu');

      // Sheet 4: Danh sách giao dịch chi tiết
      const recordHeader = ['STT', 'Mã GD', 'Ngày Thu', 'Khách Hàng', 'CCCD/CMND', 'Mã BHXH', 'Loại', 'Hình Thức', 'Số Tiền (VNĐ)', 'Cán Bộ Thu', 'Trạng Thái', 'Là Bút Toán Thoái Thu'];
      const recordRows = periodRecords.map((r, idx) => {
        const rSId = r.staff_id || (r as any).staffId;
        return [
          idx + 1,
          r.id,
          r.date ? new Date(r.date).toLocaleDateString('vi-VN') : '',
          r.name,
          r.cccd || '',
          r.bhxh || '',
          r.type,
          r.action_type || (r as any).actionType || '',
          r.amount || 0,
          staff.find(s => s.id === rSId)?.name || rSId || 'N/A',
          r.payment_status || (r as any).paymentStatus,
          (r.is_adjustment || (r as any).isAdjustment) ? 'Có' : 'Không'
        ];
      });
      const wsRecords = XLSX.utils.aoa_to_sheet([recordHeader, ...recordRows]);
      XLSX.utils.book_append_sheet(wb, wsRecords, 'Danh_Sach_Giao_Dich');

      const safePeriodFileName = currentPeriodLabel
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[\s/–—-]+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '');
      XLSX.writeFile(wb, `Bao_Cao_Tai_Chinh_${safePeriodFileName}.xlsx`);
      showToast('Đã xuất file Excel Báo Cáo Tài Chính thành công!', 'success');
    } catch (err) {
      console.error('Error exporting Excel:', err);
      showToast('Lỗi khi xuất file Excel', 'error');
    }
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Thanh tiêu đề & Tác vụ chính */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Báo Cáo & Chốt Sổ Kỳ Tài Chính
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-[#004182] border border-blue-200/80 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-[#004182]" />
              <span>Kỳ: <strong>{currentPeriodLabel}</strong></span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Phân tích doanh thu, hoa hồng, thoái thu hoàn tiền, cân đối dòng tiền két quỹ và kiểm soát khóa sổ
          </p>
        </div>

        {/* Nút tác nghiệp theo chuẩn Enterprise Design System */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          {isAdminOrManager && (
            <button
              type="button"
              onClick={() => setIsRefundModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors active:scale-98 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Lập Bút Toán Thoái Thu</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs shadow-xs transition-colors hover:border-slate-300 active:scale-98 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Xuất Excel Quyết Toán</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs shadow-xs transition-colors hover:border-slate-300 active:scale-98 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>In Phiếu Quyết Toán</span>
          </button>
        </div>
      </div>

      {/* 2. Thanh lọc kỳ báo cáo & Tham số */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Bộ Lọc Tham Số Báo Cáo</span>
            <span className="text-slate-400 font-normal">·</span>
            <span className="text-slate-500 font-normal text-[11px] font-mono">
              {dateRange.start.toLocaleDateString('vi-VN')} – {dateRange.end.toLocaleDateString('vi-VN')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
            title="Khôi phục bộ lọc mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại bộ lọc</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Period Mode */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Kỳ Xem Báo Cáo
            </label>
            <select
              value={period || 'today'}
              onChange={(e: any) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
            >
              <option value="today">Hôm Nay</option>
              <option value="week">Tuần Này</option>
              <option value="month">Theo Tháng</option>
              <option value="last_month">Tháng Trước</option>
              <option value="quarter">Theo Quý</option>
              <option value="year">Cả Năm</option>
              <option value="custom">Khoảng Ngày Tùy Chọn</option>
            </select>
          </div>

          {/* Month Select */}
          {(period === 'month' || period === 'quarter') && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                {period === 'quarter' ? 'Chọn Tháng Trong Quý' : 'Tháng'}
              </label>
              <select
                value={selectedMonth || (new Date().getMonth() + 1)}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
          )}

          {/* Year Select */}
          {period !== 'today' && period !== 'week' && period !== 'custom' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Năm
              </label>
              <select
                value={selectedYear || new Date().getFullYear()}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Range */}
          {period === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Từ Ngày</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={e => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Đến Ngày</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={e => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
                />
              </div>
            </>
          )}

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Loại Hình</label>
            <select
              value={typeFilter || 'ALL'}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">Tất cả (BHXH + BHYT)</option>
              <option value="BHXH">BHXH Tự Nguyện</option>
              <option value="BHYT">BHYT Hộ Gia Đình</option>
            </select>
          </div>

          {/* Staff Filter (Admin only) */}
          {isAdminOrManager && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Cán Bộ Thu</label>
              <select
                value={staffFilter || 'all'}
                onChange={e => setStaffFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50/70 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 outline-none transition-all cursor-pointer"
              >
                <option value="all">Tất cả cán bộ</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.staff_code || (s as any).staffCode || s.role})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. Khung kiểm soát trạng thái kỳ (Lock Control Banner) */}
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
        isCurrentPeriodLocked 
          ? 'bg-rose-50/50 border-rose-200 text-rose-900 border-l-4 border-l-rose-500 shadow-xs' 
          : 'bg-emerald-50/40 border-emerald-200 text-emerald-900 border-l-4 border-l-emerald-500 shadow-xs'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs ${
              isCurrentPeriodLocked ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isCurrentPeriodLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm tracking-wide text-slate-900">
                  Trạng Thái Kỳ: <span className="font-semibold text-slate-800">{currentPeriodLabel}</span>
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                  isCurrentPeriodLocked 
                    ? 'bg-rose-100 text-rose-800 border border-rose-200/80' 
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isCurrentPeriodLocked ? 'bg-rose-600' : 'bg-emerald-600 animate-pulse'}`} />
                  {isCurrentPeriodLocked ? 'ĐÃ KHÓA SỔ' : 'ĐANG MỞ DỮ LIỆU'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {isCurrentPeriodLocked 
                  ? 'Kỳ kế toán này đã được chốt số liệu. Mọi hành vi Thêm / Sửa / Xóa dữ liệu đều bị Trigger PostgreSQL chặn cứng để bảo toàn tài chính.'
                  : 'Kỳ kế toán đang mở. Cán bộ thu có thể tạo đơn và chỉnh sửa trạng thái giao dịch bình thường.'}
              </p>
            </div>
          </div>

          {isAdminOrManager && (
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              {isCurrentPeriodLocked ? (
                <button
                  type="button"
                  onClick={() => setIsUnlockModalOpen(true)}
                  disabled={isLocking}
                  className="w-full md:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Mở Khóa Kỳ (Admin Override)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLockPeriod}
                  disabled={isLocking}
                  className="w-full md:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>Chốt Sổ & Khóa Kỳ Này</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Thẻ chỉ số tài chính */}
      <FinancialSettlementStatsCards financialStats={financialStats} />

      {/* 5. Biểu đồ trực quan hóa dữ liệu */}
      <FinancialSettlementCharts financialStats={financialStats} />

      {/* 6. Thanh chuyển tiếp danh mục chi tiết (Sub-tab Segmented Control) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
        <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setSettlementSubTab('summary')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              settlementSubTab === 'summary'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-slate-500" />
            <span>Quyết Toán Hoa Hồng Cán Bộ</span>
            <span className="text-[11px] font-mono text-slate-600 bg-slate-200/70 px-1.5 py-0.2 rounded">
              {staffBreakdown.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSettlementSubTab('clawback')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              settlementSubTab === 'clawback'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Bút Toán Thoái Thu & Hoàn Trả</span>
            <span className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
              clawbackRecords.length > 0 ? 'bg-rose-100 text-rose-700 font-semibold' : 'text-slate-600 bg-slate-200/70'
            }`}>
              {clawbackRecords.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Hiển thị dữ liệu kỳ: <span className="font-semibold text-slate-800">{currentPeriodLabel}</span>
        </div>
      </div>

      {/* 7. Bảng Kê Quyết Toán Hoa Hồng Chi Tiết Theo Cán Bộ */}
      {settlementSubTab === 'summary' && (
        <StaffCommissionBreakdownTable
          staffBreakdown={staffBreakdown}
          financialStats={financialStats}
        />
      )}

      {/* 8. Bảng Kê Chi Tiết Bút Toán Thoái Thu & Hoàn Trả Table */}
      {settlementSubTab === 'clawback' && (
        <ClawbackRecordsTable
          clawbackRecords={clawbackRecords}
          staff={staff}
          records={records}
          policies={policies}
          settings={settings}
          isAdminOrManager={isAdminOrManager}
          financialStats={financialStats}
          onOpenRefundModal={() => setIsRefundModalOpen(true)}
          onViewRecord={(r) => setViewingClawbackRecord(r)}
          onEditRecord={(r) => setEditingClawbackRecord(r)}
          onDeleteRecord={(r) => setDeletingClawbackRecord(r)}
        />
      )}

      {/* Unlock Confirmation Modal */}
      <FinancialPeriodUnlockModal
        isOpen={isUnlockModalOpen}
        onClose={() => setIsUnlockModalOpen(false)}
        currentPeriodLabel={currentPeriodLabel}
        unlockReason={unlockReason}
        setUnlockReason={setUnlockReason}
        onConfirm={handleUnlockPeriod}
        isLocking={isLocking}
      />

      {/* Refund Clawback Creation Modal */}
      <RefundClawbackModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
      />

      {/* View Clawback Modal */}
      <ViewClawbackModal
        isOpen={!!viewingClawbackRecord}
        onClose={() => setViewingClawbackRecord(null)}
        record={viewingClawbackRecord}
        onEdit={(rec) => setEditingClawbackRecord(rec)}
      />

      {/* Edit Clawback Modal */}
      <EditClawbackModal
        isOpen={!!editingClawbackRecord}
        onClose={() => setEditingClawbackRecord(null)}
        record={editingClawbackRecord}
        onSuccess={() => {
          if (refreshData) refreshData();
        }}
      />

      {/* Delete Confirmation Modal */}
      {deletingClawbackRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Xác Nhận Xóa Bút Toán Thoái Thu</h3>
                <p className="text-xs text-rose-600 font-mono font-semibold">Mã bút toán: #{deletingClawbackRecord.id}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa bút toán thoái thu của khách hàng <b>{deletingClawbackRecord.name}</b> với số tiền <b className="font-mono">{formatMoney(Math.abs(Number(deletingClawbackRecord.amount) || 0))}</b>?
              Hồ sơ gốc liên quan sẽ được tự động hoàn nguyên kỳ đóng BHXH.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingClawbackRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleDeleteClawback}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
              >
                Xác Nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialSettlement;
