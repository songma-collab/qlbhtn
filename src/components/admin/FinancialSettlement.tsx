import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, formatMonthVN, formatPeriodKeyToLabel } from '../../utils/helpers';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { calculateClawbackRatio } from '../../utils/clawbackSettlement';
import type { RecordType } from '../../context/types';
import { supabase } from '../../lib/supabase';
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
import { RefundClawbackModal } from './finance/RefundClawbackModal';
import { ViewClawbackModal } from './finance/ViewClawbackModal';
import { EditClawbackModal } from './finance/EditClawbackModal';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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
  const lockedKeysList = useMemo(() => {
    const p = policies?.find(x => x.parameter_type === 'locked_periods' && x.is_active);
    if (!p) return [];
    if (Array.isArray(p.value)) return p.value;
    if (p.value && Array.isArray(p.value.lockedKeys)) return p.value.lockedKeys;
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
      recs = recs.filter(r => r.staffId === currentUser?.id);
    } else if (staffFilter !== 'all') {
      recs = recs.filter(r => r.staffId === staffFilter);
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

    const paid = inPeriod.filter(r => r.paymentStatus === 'Đã thu tiền' && r.isAdjustment !== true);
    const cancelled = inPeriod.filter(r => r.paymentStatus === 'Đã hủy');
    const clawback = inPeriod.filter(r => r.isAdjustment === true || r.paymentStatus === 'Đã thoái thu');

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
      if (comm === 0 && r.originalRecordId) {
        const orig = records.find(x => x.id === r.originalRecordId);
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

    const isRenew = (r: any) => String(r.actionType || '').toLowerCase().includes('gia hạn') || String(r.actionType || '').toLowerCase().includes('đóng tiếp');

    return staffToProcess.map(s => {
      const sPaid = paidRecords.filter(r => r.staffId === s.id);
      const sCancelled = cancelledRecords.filter(r => r.staffId === s.id);
      const sClawback = clawbackRecords.filter(r => r.staffId === s.id);

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
        if (comm === 0 && r.originalRecordId) {
          const orig = records.find(x => x.id === r.originalRecordId);
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
        const { error } = await supabase
          .from('policies')
          .update({
            value: newLockedKeys,
            is_active: true
          })
          .eq('id', existingPolicy.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('policies')
          .insert([{
            parameter_type: 'locked_periods',
            name: 'Khóa kỳ tài chính hệ thống',
            value: newLockedKeys,
            effective_date: new Date().toISOString().split('T')[0],
            is_active: true,
            description: 'Danh sách các mốc thời gian đã chốt sổ và khóa dữ liệu kế toán'
          }]);

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
        const { error } = await supabase
          .from('policies')
          .update({
            value: newLockedKeys,
            is_active: true
          })
          .eq('id', existingPolicy.id);

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
      if (deletingClawbackRecord.originalRecordId) {
        const orig = records.find(r => r.id === deletingClawbackRecord.originalRecordId);
        if (orig && orig.paymentStatus === 'Đã thoái thu') {
          await updateRecord(orig.id, {
            paymentStatus: 'Đã thu tiền',
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
        s.staffCode || s.id,
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
      const clawbackRows = clawbackRecords.map((r, idx) => [
        idx + 1,
        r.id,
        r.originalRecordId || 'N/A',
        r.date ? new Date(r.date).toLocaleDateString('vi-VN') : '',
        r.name,
        r.cccd || '',
        r.bhxh || '',
        r.type,
        r.decisionNumber || '',
        r.decisionDate ? new Date(r.decisionDate).toLocaleDateString('vi-VN') : '',
        r.adjustmentReason || r.notes || '',
        -Math.abs(Number(r.amount) || 0),
        -Math.abs(Number(r.commission) || 0),
        staff.find(s => s.id === r.staffId)?.name || r.staffId || 'N/A',
        r.refundMethod === 'CHUYEN_KHOAN' ? 'Chuyển khoản' : 'Tiền mặt'
      ]);
      const wsClawback = XLSX.utils.aoa_to_sheet([clawbackHeader, ...clawbackRows]);
      XLSX.utils.book_append_sheet(wb, wsClawback, 'Phu_Luc_Thoai_Thu');

      // Sheet 4: Danh sách giao dịch chi tiết
      const recordHeader = ['STT', 'Mã GD', 'Ngày Thu', 'Khách Hàng', 'CCCD/CMND', 'Mã BHXH', 'Loại', 'Hình Thức', 'Số Tiền (VNĐ)', 'Cán Bộ Thu', 'Trạng Thái', 'Là Bút Toán Thoái Thu'];
      const recordRows = periodRecords.map((r, idx) => [
        idx + 1,
        r.id,
        r.date ? new Date(r.date).toLocaleDateString('vi-VN') : '',
        r.name,
        r.cccd || '',
        r.bhxh || '',
        r.type,
        r.actionType || '',
        r.amount || 0,
        staff.find(s => s.id === r.staffId)?.name || r.staffId || 'N/A',
        r.paymentStatus,
        r.isAdjustment ? 'Có' : 'Không'
      ]);
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
                  <option key={s.id} value={s.id}>{s.name} ({s.staffCode || s.role})</option>
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

      {/* 4. Thẻ chỉ số tài chính (6 Cards theo chuẩn font-mono tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Tổng Thu Phát Sinh (Gross) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng Thu Phát Sinh (Gross)</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {formatMoney(financialStats.grossRevenue)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>BHXH: <b className="text-slate-800">{formatMoney(financialStats.bhxhRevenue)}</b> ({financialStats.bhxhCount})</span>
            <span>BHYT: <b className="text-slate-800">{formatMoney(financialStats.bhytRevenue)}</b> ({financialStats.bhytCount})</span>
          </div>
        </div>

        {/* 2. Thoái Thu & Hoàn Trả (Clawback) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Thoái Thu & Hoàn Trả</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-rose-600 tracking-tight tabular-nums">
              {financialStats.totalRefund > 0 ? `-${formatMoney(financialStats.totalRefund)}` : '0 đ'}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>Thoái thu: <b className="text-rose-700">{financialStats.clawbackCount} bút toán</b></span>
            <span>Thu hồi HH: <b className="text-rose-700">{financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}</b></span>
          </div>
        </div>

        {/* 3. Doanh Thu Thuần Thực Nộp (Net) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-[#004182]/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#004182] uppercase tracking-wider">Doanh Thu Thuần Thực Nộp (Net)</span>
            <div className="w-8 h-8 rounded-lg bg-[#004182]/10 text-[#004182] flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-[#004182] tracking-tight tabular-nums">
              {formatMoney(financialStats.netRevenue)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-mono tabular-nums flex items-center justify-between">
            <span>Thực nộp Kho bạc/BHXH</span>
            <span className="font-bold text-[#004182]">
              {financialStats.grossRevenue > 0 ? `${((financialStats.netRevenue / financialStats.grossRevenue) * 100).toFixed(1)}%` : '100%'}
            </span>
          </div>
        </div>

        {/* 4. Hoa Hồng Thực Chi Cán Bộ (Net) */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Hoa Hồng Thực Chi (Net)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-amber-700 tracking-tight tabular-nums">
              {formatMoney(financialStats.netStaffCommission)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>Gộp: <b className="text-slate-800">{formatMoney(financialStats.grossStaffCommission)}</b></span>
            <span>Thu hồi: <b className="text-rose-600">{financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}</b></span>
          </div>
        </div>

        {/* 5. Tồn Két Dòng Tiền Thuần */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Dòng Tiền Thực Két Quỹ</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-emerald-700 tracking-tight tabular-nums">
              {formatMoney(financialStats.netCashflow)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>(Thực thu trừ thoái thu)</span>
            <span className="font-bold text-emerald-600">Khớp 100% Sổ Quỹ</span>
          </div>
        </div>

        {/* 6. Thù Lao Giữ Lại Đại Lý */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Lợi Nhuận Gộp Thù Lao</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <span className="font-mono text-2xl font-bold text-teal-700 tracking-tight tabular-nums">
              {formatMoney(financialStats.retainedMargin)}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
            <span>Tỷ suất thù lao TB:</span>
            <span className="font-bold text-teal-700">
              {financialStats.totalRevenue > 0 ? ((financialStats.retainedMargin / financialStats.totalRevenue) * 100).toFixed(2) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* 5. Biểu đồ trực quan hóa dữ liệu */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Chart 1: Doanh thu theo loại hình & đối tượng */}
        <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#004182]" />
                  <span>Cơ Cấu Doanh Thu Tăng Mới vs Gia Hạn (VNĐ)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">So sánh doanh số thực thu theo loại hình BHXH và BHYT</p>
              </div>
            </div>
            <div className="h-64">
              <Bar
                data={{
                  labels: ['BHXH Tự Nguyện', 'BHYT Hộ Gia Đình'],
                  datasets: [
                    {
                      label: 'Tăng Mới / Đăng Ký Mới',
                      data: [financialStats.bhxhNewRevenue, financialStats.bhytNewRevenue],
                      backgroundColor: '#004182',
                      borderRadius: 6,
                    },
                    {
                      label: 'Gia Hạn / Đóng Tiếp',
                      data: [financialStats.bhxhRenewRevenue, financialStats.bhytRenewRevenue],
                      backgroundColor: '#10b981',
                      borderRadius: 6,
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'top' as const,
                      labels: {
                        boxWidth: 12,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        font: { size: 11, weight: 'bold' }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${formatMoney(Number(context.raw))}`
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: { display: false }
                    },
                    y: {
                      grid: { color: '#f1f5f9' },
                      ticks: {
                        callback: (value) => formatMoney(Number(value)),
                        font: { size: 11 }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Chart 2: Dòng tiền Vào - Ra */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-600" />
                  <span>Phân Bổ Dòng Tiền Thu Vào</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Tỷ lệ nộp BHXH, hoa hồng và thoái thu</p>
              </div>
            </div>
            <div className="h-52 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Nộp Cơ Quan BHXH', 'Hoa Hồng Cán Bộ', 'Thoái Thu Hoàn Tiền'],
                  datasets: [
                    {
                      data: [
                        financialStats.totalPayToBHXH,
                        financialStats.totalStaffCommission,
                        financialStats.totalRefund
                      ],
                      backgroundColor: ['#004182', '#f59e0b', '#ef4444'],
                      borderWidth: 0,
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom' as const,
                      labels: {
                        boxWidth: 10,
                        usePointStyle: true,
                        font: { size: 11 }
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: (context) => ` ${context.label}: ${formatMoney(Number(context.raw))}`
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-1.5 font-mono tabular-nums">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Nộp BHXH:</span>
              <b className="text-[#004182]">{formatMoney(financialStats.totalPayToBHXH)}</b>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-sans">Chi Trả Cán Bộ:</span>
              <b className="text-amber-600">{formatMoney(financialStats.totalStaffCommission)}</b>
            </div>
            {financialStats.totalRefund > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-sans">Thoái thu hoàn trả:</span>
                <b className="text-rose-600">-{formatMoney(financialStats.totalRefund)}</b>
              </div>
            )}
          </div>
        </div>
      </div>

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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/70">
            <div>
              <h3 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-[#004182]" />
                <span>Bảng Kê Quyết Toán Hoa Hồng Chi Tiết Theo Cán Bộ</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Phân tách chi tiết hoa hồng BHXH/BHYT mới và gia hạn theo từng nhân viên trong kỳ
              </p>
            </div>
            <div className="text-xs text-slate-600 font-medium">
              <span className="font-bold font-mono text-slate-900">{staffBreakdown.length}</span> cán bộ phát sinh doanh thu
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-center">STT</th>
                  <th className="py-3 px-4">Cán Bộ Thu</th>
                  <th className="py-3 px-4 text-center">Số Đơn</th>
                  <th className="py-3 px-4 text-right">Doanh Số Thực Thu</th>
                  <th className="py-3 px-4 text-right">HH BHXH Mới</th>
                  <th className="py-3 px-4 text-right">HH BHXH Tái Tục</th>
                  <th className="py-3 px-4 text-right">HH BHYT Mới</th>
                  <th className="py-3 px-4 text-right">HH BHYT Tái Tục</th>
                  <th className="py-3 px-4 text-right">Thu Hồi Thoái Thu</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-900">Thực Nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {staffBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                      Không có số liệu phát sinh trong kỳ được chọn
                    </td>
                  </tr>
                ) : (
                  staffBreakdown.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{s.staffCode || s.id}</div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          {s.paidCount}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatMoney(s.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhxhNewComm)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhxhRenewComm)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhytNewComm)}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhytRenewComm)}</td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600 tabular-nums">
                        {s.refundDeduction > 0 ? `-${formatMoney(s.refundDeduction)}` : '0 đ'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums text-sm">
                        {formatMoney(s.netCommission)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {staffBreakdown.length > 0 && (
                <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200 font-mono tabular-nums">
                  <tr>
                    <td colSpan={2} className="py-3.5 px-4 text-center uppercase tracking-wider font-sans text-xs">Tổng Cộng</td>
                    <td className="py-3.5 px-4 text-center font-mono">{financialStats.paidCount}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#004182]">{formatMoney(financialStats.totalRevenue)}</td>
                    <td className="py-3.5 px-4 text-right" colSpan={2}>{formatMoney(financialStats.bhxhStaffComm)}</td>
                    <td className="py-3.5 px-4 text-right" colSpan={2}>{formatMoney(financialStats.bhytStaffComm)}</td>
                    <td className="py-3.5 px-4 text-right text-rose-600">
                      {financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-800 text-[14px] font-bold">
                      {formatMoney(financialStats.netStaffCommission)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* 8. Bảng Kê Chi Tiết Bút Toán Thoái Thu & Hoàn Trả Table */}
      {settlementSubTab === 'clawback' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/70">
            <div>
              <h3 className="font-bold text-base text-rose-700 tracking-tight flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <span>Bảng Kê Chi Tiết Bút Toán Thoái Thu & Hoàn Trả (Clawback)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Các bút toán thoái thu âm và thu hồi hoa hồng cán bộ thu phát sinh trong kỳ hạch toán
              </p>
            </div>
            {isAdminOrManager && (
              <button
                type="button"
                onClick={() => setIsRefundModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Lập Bút Toán Mới</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center">STT</th>
                  <th className="py-3 px-3">Mã Bút Toán</th>
                  <th className="py-3 px-3">Ngày Hạch Toán</th>
                  <th className="py-3 px-3">Khách Hàng</th>
                  <th className="py-3 px-3">Nghiệp Vụ</th>
                  <th className="py-3 px-3">Kỳ Giảm Trừ</th>
                  <th className="py-3 px-3">Số QĐ / Công Văn</th>
                  <th className="py-3 px-3">Lý Do Thoái Thu</th>
                  <th className="py-3 px-3 text-right">Tiền Thoái Thu</th>
                  <th className="py-3 px-3 text-right">Thu Hồi Hoa Hồng</th>
                  <th className="py-3 px-3">Cán Bộ Thu</th>
                  <th className="py-3 px-3">Hình Thức</th>
                  <th className="py-3 px-3 text-center">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {clawbackRecords.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center text-slate-400 font-medium">
                      Không phát sinh bút toán thoái thu hoàn trả nào trong kỳ này
                    </td>
                  </tr>
                ) : (
                  clawbackRecords.map((r, index) => {
                    const assignedStaff = staff.find(s => s.id === r.staffId);
                    let clawCommission = Math.abs(Number(r.commission) || 0);
                    if (clawCommission === 0 && r.originalRecordId) {
                      const orig = records.find(x => x.id === r.originalRecordId);
                      if (orig) {
                        clawCommission = calculateClawbackRatio(orig, Math.abs(Number(r.amount) || 0), policies, settings).clawbackCommission;
                      }
                    }

                    return (
                      <tr key={r.id} className="hover:bg-rose-50/40 transition-colors">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            #{r.id}
                          </span>
                          {r.originalRecordId && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              Gốc: #{r.originalRecordId}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {r.date ? new Date(r.date).toLocaleDateString('vi-VN') : 'N/A'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{r.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">CCCD: {r.cccd || 'N/A'} · BHXH: {r.bhxh || 'N/A'}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                            {r.type}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {r.fromMonth ? (
                            <div className="font-mono font-semibold text-amber-900 text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                              {formatMonthVN(r.fromMonth)} {r.toMonth && r.toMonth !== r.fromMonth ? `- ${formatMonthVN(r.toMonth)}` : ''}
                            </div>
                          ) : (
                            <span className="text-slate-400">Theo đơn gốc</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 font-mono">{r.decisionNumber || 'Chưa có'}</div>
                          {r.decisionDate && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Ngày: {new Date(r.decisionDate).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={r.adjustmentReason || r.notes}>
                          {r.adjustmentReason || r.notes || 'Thoái thu hoàn trả'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 text-[13px] tabular-nums">
                          -{formatMoney(Math.abs(Number(r.amount) || 0))}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 text-[13px] tabular-nums">
                          -{formatMoney(clawCommission)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{assignedStaff?.name || r.staffId}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{assignedStaff?.staffCode || ''}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                            {r.refundMethod === 'CHUYEN_KHOAN' ? 'Chuyển khoản' : 'Tiền mặt'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingClawbackRecord(r)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết bút toán"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdminOrManager && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingClawbackRecord(r)}
                                  className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                  title="Chỉnh sửa bút toán"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingClawbackRecord(r)}
                                  className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa bút toán"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {clawbackRecords.length > 0 && (
                <tfoot className="bg-rose-50/70 font-bold text-rose-900 border-t-2 border-rose-200 font-mono tabular-nums">
                  <tr>
                    <td colSpan={8} className="py-3 px-4 text-center uppercase tracking-wider font-sans text-xs">
                      Tổng Cộng Thoái Thu Trong Kỳ
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700 text-[14px] font-bold">
                      -{formatMoney(financialStats.clawbackAmountTotal)}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-800 text-[14px] font-bold">
                      -{formatMoney(financialStats.clawbackCommissionTotal)}
                    </td>
                    <td colSpan={3} className="py-3 px-4 text-slate-500 text-[11px] font-sans">
                      {clawbackRecords.length} bút toán đã hạch toán
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Unlock Confirmation Modal */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
                <Unlock className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Mở Khóa Kỳ Tài Chính</h3>
                <p className="text-xs text-rose-600 font-semibold">{currentPeriodLabel}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn đang yêu cầu mở khóa kỳ tài chính đã chốt. Hành động này sẽ được ghi vết vào <b>Nhật ký kiểm toán (Audit Logs)</b> của hệ thống.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Lý Do Mở Khóa <span className="text-rose-500">*</span> (Tối thiểu 5 ký tự)
              </label>
              <textarea
                value={unlockReason}
                onChange={e => setUnlockReason(e.target.value)}
                placeholder="Nhập lý do điều chỉnh số liệu kế toán..."
                rows={3}
                className="w-full p-3 text-xs bg-slate-50/70 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#004182]/20 focus:border-[#004182] font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleUnlockPeriod}
                disabled={isLocking || unlockReason.trim().length < 5}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                {isLocking ? 'Đang xử lý...' : 'Xác Nhận Mở Khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

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
