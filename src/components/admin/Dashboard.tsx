import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, getLocalYYYYMMDD, groupRecordsByCustomer } from '../../utils/helpers';
import { getCommissionRateForRecord } from '../../utils/calculations';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  Users,
  TrendingUp,
  Star,
  AlertTriangle,
  Trophy,
  ChevronRight,
  Calendar,
  RotateCcw,
  Shield,
  HeartPulse,
  PlusCircle,
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter,
  ArrowUpRight,
  FileText
} from 'lucide-react';
import type { RecordType } from '../../context/types';

// Palette màu nhận diện chuẩn ngành BHXH Việt Nam
const COLORS = {
  primaryNavy: '#004182',
  skyBlue: '#0ea5e9',
  emeraldGreen: '#10b981',
  amberWarning: '#f59e0b',
  roseError: '#ef4444',
  purpleAccent: '#8b5cf6',
  slateMuted: '#64748b'
};

const STATUS_COLORS: { [key: string]: string } = {
  'Đã hoàn thành / Đã duyệt': COLORS.emeraldGreen,
  'Đang xử lý / Chờ duyệt': COLORS.skyBlue,
  'Chờ nộp BHXH': COLORS.amberWarning,
  'Chờ thanh toán': COLORS.purpleAccent,
  'Đã hủy': COLORS.roseError
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  isCurrency?: boolean;
}

const CustomBarTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, isCurrency }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md z-50">
        <p className="font-bold text-slate-200 border-b border-slate-700 pb-1 mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-extrabold text-white">
                {isCurrency ? formatMoney(entry.value || 0) : `${entry.value} hồ sơ`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomPieTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md z-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill }} />
          <span className="font-bold">{data.name}</span>
        </div>
        <div className="text-slate-300 flex items-center justify-between gap-4">
          <span>Số lượng:</span>
          <span className="font-black text-white">{data.value} hồ sơ ({data.payload.percent}%)</span>
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const {
    records,
    settings,
    policies,
    currentUser,
    setAdminTab,
    isAuthReady,
    refreshTrigger,
    refreshData,
    showToast,
    updateRecord,
    setGlobalRegisterModal
  } = useAppContext() as any;

  // State lọc thời gian
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [barChartMetric, setBarChartMetric] = useState<'count' | 'revenue'>('count');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [debugError, setDebugError] = useState<string | null>(null);

  // Tính toán số liệu thống kê chuẩn xác
  const stats = useMemo(() => {
    if (!currentUser) {
      return {
        totalRecords: 0,
        activeCustomersCount: 0,
        stoppedCustomersCount: 0,
        totalRev: 0,
        totalComm: 0,
        expiringRecordsCount: 0,
        bhxhCount: 0,
        bhytCount: 0,
        monthNewCount: 0,
        monthRenewCount: 0,
        monthTotalRecords: 0,
        monthCompletionRate: 0,
        newVsRenewMonthly: [] as any[],
        statusDistribution: [] as any[],
        dailyIntakeTrend: [] as any[],
        typeMixData: [] as any[],
        recentRecordsInMonth: [] as RecordType[]
      };
    }

    const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'admin' || currentUser.role === 'Quản lý';

    // 1. Phân loại records theo quyền hạn: Admin xem toàn bộ, Nhân viên xem đúng hồ sơ của mình
    const staffRecords = (records || []).filter((r: RecordType) => {
      if (isAdmin) return true;
      const sId = r.staff_id || (r as any).staffId;
      return !sId || sId === currentUser?.id;
    });

    // 2. Gom cụm khách hàng duy nhất (Unification Cluster) để tính Tổng Khách Hàng thực tế
    const uniqueCustomers = groupRecordsByCustomer(staffRecords);
    const totalUniqueCustomers = uniqueCustomers.length;
    const activeUniqueCustomers = uniqueCustomers.filter((c: any) => (c.status || 'Đang tham gia') !== 'Đã dừng đóng');
    const stoppedUniqueCustomers = uniqueCustomers.filter((c: any) => c.status === 'Đã dừng đóng');
    const bhxhUniqueCount = uniqueCustomers.filter((c: any) => c.type === 'BHXH').length;
    const bhytUniqueCount = uniqueCustomers.filter((c: any) => c.type === 'BHYT').length;

    const todayStr = getLocalYYYYMMDD();
    const todayTs = new Date(todayStr).getTime();
    const currentYear = todayStr.slice(0, 4);

    // 3. Tính số lượng Hồ Sơ Sắp Hết Hạn (< 30 ngày)
    const expiringRecordsCount = activeUniqueCustomers.filter((c: any) => {
      const nextPay = c.next_payment || c.nextPayment;
      const payStatus = c.payment_status || c.paymentStatus;
      if (!nextPay || payStatus === 'Đã hủy') return false;
      const amt = Number(c.amount) || 0;
      if (amt <= 0) return false;
      const nextTs = new Date(nextPay).getTime();
      const diffDays = Math.ceil((nextTs - todayTs) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).length;

    // 4. Xác định khoảng thời gian lọc (selectedPeriod)
    const now = new Date();
    let periodStartDate = '';
    let periodEndDate = '';

    if (selectedPeriod === 'today') {
      periodStartDate = todayStr;
      periodEndDate = todayStr;
    } else if (selectedPeriod === 'month') {
      periodStartDate = `${selectedMonth}-01`;
      const [y = 2026, m = 1] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      periodEndDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
    } else if (selectedPeriod === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const qStartMonth = String(currentQuarter * 3 + 1).padStart(2, '0');
      const qEndMonthNum = currentQuarter * 3 + 3;
      const lastDayOfQ = new Date(now.getFullYear(), qEndMonthNum, 0).getDate();
      periodStartDate = `${now.getFullYear()}-${qStartMonth}-01`;
      periodEndDate = `${now.getFullYear()}-${String(qEndMonthNum).padStart(2, '0')}-${String(lastDayOfQ).padStart(2, '0')}`;
    } else if (selectedPeriod === 'year') {
      periodStartDate = `${currentYear}-01-01`;
      periodEndDate = `${currentYear}-12-31`;
    }

    const periodPaidRecords = staffRecords.filter((r: RecordType) => {
      const pStatus = r.payment_status || (r as any).paymentStatus;
      const aType = r.action_type || (r as any).actionType;
      const isAdj = r.is_adjustment || (r as any).isAdjustment;
      if (pStatus !== 'Đã thu tiền') return false;
      if (aType === 'Nhập từ Excel') return false;
      if (isAdj) return false;
      if (selectedPeriod === 'all') return true;

      const rDate = (r.date || r.created_at || '').slice(0, 10);
      if (!rDate) return false;
      return rDate >= periodStartDate && rDate <= periodEndDate;
    });

    const calcRev = periodPaidRecords.reduce((sum: number, r: RecordType) => sum + (Number(r.amount) || 0), 0);
    const calcComm = periodPaidRecords.reduce((sum: number, r: RecordType) => {
      const amt = Number(r.amount) || 0;
      const rate = getCommissionRateForRecord(r, policies, settings);
      return sum + Math.round(amt * rate);
    }, 0);

    // ==========================================
    // THỐNG KÊ CHI TIẾT TRONG THÁNG (SELECTED MONTH)
    // ==========================================
    const isRenew = (r: RecordType) => {
      const act = String(r.action_type || (r as any).actionType || '').toLowerCase();
      return act.includes('gia hạn') || act.includes('tái tục') || act.includes('đóng tiếp');
    };

    const monthAllRecords = staffRecords.filter((r: RecordType) => {
      const aType = r.action_type || (r as any).actionType;
      const isAdj = r.is_adjustment || (r as any).isAdjustment;
      if (aType === 'Nhập từ Excel') return false;
      if (isAdj) return false;
      const rDate = (r.date || r.created_at || '').slice(0, 10);
      return rDate.startsWith(selectedMonth);
    });

    // Phân loại Đăng ký mới vs Gia hạn trong tháng
    const monthNewRecords = monthAllRecords.filter((r: RecordType) => !isRenew(r));
    const monthRenewRecords = monthAllRecords.filter((r: RecordType) => isRenew(r));

    const monthNewCount = monthNewRecords.length;
    const monthRenewCount = monthRenewRecords.length;
    const monthTotalRecords = monthAllRecords.length;

    // Phân bổ trạng thái xử lý trong tháng
    let countCompleted = 0;
    let countProcessing = 0;
    let countPendingSubmit = 0;
    let countPendingPayment = 0;
    let countCancelled = 0;

    monthAllRecords.forEach((r: RecordType) => {
      const pStatus = r.payment_status || (r as any).paymentStatus;
      const isSub = r.is_submitted_bhxh !== undefined ? r.is_submitted_bhxh : (r as any).isSubmittedBHXH;
      const subBatch = r.submission_batch || (r as any).submissionBatch;
      if (pStatus === 'Đã hủy' || r.status === 'Đã hủy') {
        countCancelled++;
      } else if (pStatus === 'Chờ thanh toán' || pStatus === 'Chưa thu tiền') {
        countPendingPayment++;
      } else if (r.status === 'Đã hoàn thành' || r.status === 'Đã duyệt' || isSub) {
        countCompleted++;
      } else if (r.status === 'Chờ nộp' || (!isSub && subBatch)) {
        countPendingSubmit++;
      } else {
        countProcessing++;
      }
    });

    const monthCompletionRate = monthTotalRecords > 0
      ? Math.round((countCompleted / monthTotalRecords) * 100)
      : 0;

    const statusDistributionRaw = [
      { name: 'Đã hoàn thành / Đã duyệt', value: countCompleted, fill: STATUS_COLORS['Đã hoàn thành / Đã duyệt'] },
      { name: 'Đang xử lý / Chờ duyệt', value: countProcessing, fill: STATUS_COLORS['Đang xử lý / Chờ duyệt'] },
      { name: 'Chờ nộp BHXH', value: countPendingSubmit, fill: STATUS_COLORS['Chờ nộp BHXH'] },
      { name: 'Chờ thanh toán', value: countPendingPayment, fill: STATUS_COLORS['Chờ thanh toán'] },
      { name: 'Đã hủy', value: countCancelled, fill: STATUS_COLORS['Đã hủy'] }
    ];

    const statusDistribution = statusDistributionRaw
      .filter(item => item.value > 0)
      .map(item => ({
        ...item,
        percent: monthTotalRecords > 0 ? Math.round((item.value / monthTotalRecords) * 100) : 0
      }));

    // ==========================================
    // BIỂU ĐỒ SO SÁNH HỒ SƠ MỚI VS GIA HẠN 6 THÁNG GẦN NHẤT
    // ==========================================
    const last6MonthsList: { key: string; label: string }[] = [];
    const currD = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currD.getFullYear(), currD.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      last6MonthsList.push({ key: `${y}-${m}`, label: `T${m}/${y}` });
    }

    const newVsRenewMonthly = last6MonthsList.map(item => {
      const mRecords = staffRecords.filter((r: RecordType) => {
        const aType = r.action_type || (r as any).actionType;
        const isAdj = r.is_adjustment || (r as any).isAdjustment;
        if (aType === 'Nhập từ Excel') return false;
        if (isAdj) return false;
        const rDate = (r.date || r.created_at || '').slice(0, 10);
        return rDate.startsWith(item.key);
      });

      const newRecs = mRecords.filter((r: RecordType) => !isRenew(r));
      const renewRecs = mRecords.filter((r: RecordType) => isRenew(r));

      const newPaidRecs = newRecs.filter((r: RecordType) => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền');
      const renewPaidRecs = renewRecs.filter((r: RecordType) => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền');

      const newRev = newPaidRecs.reduce((sum: number, r: RecordType) => sum + (Number(r.amount) || 0), 0);
      const renewRev = renewPaidRecs.reduce((sum: number, r: RecordType) => sum + (Number(r.amount) || 0), 0);

      return {
        month: item.label,
        key: item.key,
        newCount: newRecs.length,
        renewCount: renewRecs.length,
        totalCount: mRecords.length,
        newRev,
        renewRev,
        totalRev: newRev + renewRev
      };
    });

    // ==========================================
    // BIỂU ĐỒ DÒNG TIẾP NHẬN HÀNG NGÀY TRONG THÁNG (DAILY INTAKE)
    // ==========================================
    const [selY = 2026, selM = 1] = selectedMonth.split('-').map(Number);
    const daysInSelMonth = new Date(selY, selM, 0).getDate();
    const dailyIntakeTrend: any[] = [];

    for (let day = 1; day <= daysInSelMonth; day++) {
      const dayStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayRecords = monthAllRecords.filter((r: RecordType) => (r.date || r.created_at || '').startsWith(dayStr));

      const dayNew = dayRecords.filter((r: RecordType) => !isRenew(r)).length;
      const dayRenew = dayRecords.filter((r: RecordType) => isRenew(r)).length;
      const dayCompleted = dayRecords.filter((r: RecordType) => r.status === 'Đã hoàn thành' || r.status === 'Đã duyệt').length;

      dailyIntakeTrend.push({
        day: `N${day}`,
        fullDate: dayStr,
        'Hồ sơ mới': dayNew,
        'Hồ sơ gia hạn': dayRenew,
        'Đã hoàn thành': dayCompleted,
        total: dayRecords.length
      });
    }

    // ==========================================
    // CƠ CẤU BHXH VS BHYT
    // ==========================================
    const bhxhMonthRecords = monthAllRecords.filter((r: RecordType) => r.type === 'BHXH');
    const bhytMonthRecords = monthAllRecords.filter((r: RecordType) => r.type === 'BHYT');

    const typeMixData = [
      {
        name: 'BHXH Tự Nguyện',
        count: bhxhMonthRecords.length,
        revenue: bhxhMonthRecords
          .filter((r: RecordType) => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
          .reduce((sum: number, r: RecordType) => sum + (Number(r.amount) || 0), 0),
        fill: COLORS.primaryNavy
      },
      {
        name: 'BHYT Hộ Gia Đình',
        count: bhytMonthRecords.length,
        revenue: bhytMonthRecords
          .filter((r: RecordType) => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
          .reduce((sum: number, r: RecordType) => sum + (Number(r.amount) || 0), 0),
        fill: COLORS.skyBlue
      }
    ];

    // Hồ sơ gần đây trong tháng (tối đa 6 hồ sơ)
    const recentRecordsInMonth = [...monthAllRecords]
      .sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime())
      .slice(0, 6);

    return {
      totalRecords: totalUniqueCustomers,
      activeCustomersCount: activeUniqueCustomers.length,
      stoppedCustomersCount: stoppedUniqueCustomers.length,
      totalRev: calcRev,
      totalComm: calcComm,
      expiringRecordsCount,
      bhxhCount: bhxhUniqueCount,
      bhytCount: bhytUniqueCount,
      monthNewCount,
      monthRenewCount,
      monthTotalRecords,
      monthCompletionRate,
      newVsRenewMonthly,
      statusDistribution,
      dailyIntakeTrend,
      typeMixData,
      recentRecordsInMonth
    };
  }, [records, currentUser, settings, policies, selectedPeriod, selectedMonth]);

  useEffect(() => {
    if (isAuthReady) {
      setIsLoading(false);
    }
  }, [isAuthReady, records]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshData) await refreshData();
      showToast('Đã làm mới và đồng bộ dữ liệu thời gian thực!', {
        type: 'info',
        title: 'Đồng bộ hệ thống',
        badge: 'THỜI GIAN THỰC',
        duration: 3000
      });
    } catch (e: any) {
      setDebugError(e.message || 'Lỗi khi làm mới');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#004182]"></div>
        <span className="text-sm font-semibold text-slate-600">Đang khởi tạo trung tâm điều hành & biểu đồ Recharts...</span>
      </div>
    );
  }

  const periodLabel = selectedPeriod === 'today' ? 'Hôm Nay' :
    selectedPeriod === 'month' ? `Tháng ${selectedMonth.slice(5)}/${selectedMonth.slice(0, 4)}` :
    selectedPeriod === 'quarter' ? 'Quý Này' :
    selectedPeriod === 'year' ? 'Năm Nay' : 'Toàn Thời Gian';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header & Điều Khiển Thời Gian Thực */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-3xl shadow-xs border border-slate-100">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>Thời Gian Thực</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">|</span>
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <Calendar size={13} className="text-[#004182]" />
              Kỳ báo cáo: <strong className="text-slate-800">{periodLabel}</strong>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Trung Tâm Điều Hành & Thống Kê Tổng Quan
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Giám sát thời gian thực số lượng hồ sơ mới, hồ sơ gia hạn và trạng thái xử lý trong tháng
          </p>
        </div>

        {/* Toolbar: Chọn kỳ, Chọn tháng & Thao tác nhanh */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bộ chọn tháng cụ thể */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-xs font-semibold text-slate-600 mr-2 flex items-center gap-1">
              <Filter size={13} className="text-[#004182]" /> Tháng:
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedPeriod('month');
              }}
              className="bg-transparent text-xs font-bold text-[#004182] focus:outline-hidden cursor-pointer"
            />
          </div>

          {/* Quick period buttons */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSelectedPeriod('month')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedPeriod === 'month' ? 'bg-[#004182] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('quarter')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedPeriod === 'quarter' ? 'bg-[#004182] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Quý
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('year')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedPeriod === 'year' ? 'bg-[#004182] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Năm
            </button>
            <button
              type="button"
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                selectedPeriod === 'all' ? 'bg-[#004182] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Nút làm mới */}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 active:scale-95 text-xs font-semibold transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Đồng bộ dữ liệu thời gian thực"
          >
            <RotateCcw size={14} className={isRefreshing ? 'animate-spin text-[#004182]' : 'text-slate-500'} />
            <span className="hidden sm:inline">Đồng bộ</span>
          </button>
        </div>
      </div>

      {debugError && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-xs">
          <strong>Thông báo kỹ thuật:</strong> {debugError}
        </div>
      )}

      {/* 2. Dải Thống Kê Tổng Quan Khách Hàng, Doanh Thu & Hồ Sơ Sắp Hết Hạn */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => setAdminTab('crm-bhxh')}
          className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between cursor-pointer hover:border-[#004182]/40 transition"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#004182] flex items-center justify-center font-bold">
              <Users size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Tổng Người Tham Gia</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{stats.totalRecords}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                <strong className="text-emerald-600">{stats.activeCustomersCount}</strong> đang đóng • <strong className="text-amber-600">{stats.stoppedCustomersCount}</strong> dừng đóng
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-400" />
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Doanh Thu Thu Nộp ({periodLabel})</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatMoney(stats.totalRev)}</p>
              <p className="text-[11px] text-slate-500 font-medium">Thực thu tiền mặt & chuyển khoản</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Star size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Hoa Hồng Đại Lý ({periodLabel})</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-900">{formatMoney(stats.totalComm)}</p>
              <p className="text-[11px] text-slate-500 font-medium">Theo biểu tỷ lệ thù lao quy định</p>
            </div>
          </div>
        </div>

        <div 
          onClick={() => setAdminTab('crm-dispatch')}
          className="bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between cursor-pointer hover:border-rose-300 transition"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertTriangle size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Hồ Sơ Sắp Hết Hạn</p>
              <p className="text-xl sm:text-2xl font-bold text-rose-600">{stats.expiringRecordsCount}</p>
              <p className="text-[11px] text-slate-500 font-medium">
                <span className="text-rose-600 font-semibold">&lt; 30 ngày</span> • Đôn đốc tái tục
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-400" />
        </div>
      </div>

      {/* 4. Banner Thi Đua & Thao Tác Thử Nghiệm Real-time Toast */}
      <div className="bg-gradient-to-r from-[#004182] via-[#005ba3] to-blue-700 text-white rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
            <Trophy size={26} className="text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="font-bold text-base sm:text-lg">Bảng Thi Đua Doanh Số & Hệ Thống Giám Sát Real-time</h4>
              <span className="text-[10px] bg-amber-400 text-slate-900 font-bold px-2 py-0.5 rounded-full uppercase">Khen thưởng</span>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 font-normal">
              Theo dõi vinh danh Top 3 cán bộ thu xuất sắc và nhận thông báo ngay khi có hồ sơ đăng ký hoặc duyệt thành công.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start md:self-auto">
          <button
            type="button"
            onClick={() => setAdminTab('leaderboard')}
            className="px-4 py-2 rounded-xl bg-white text-[#004182] hover:bg-blue-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
          >
            <span>Bảng Vàng KPI</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* 5. CÁC BIỂU ĐỒ RECHARTS TRỌNG TÂM: HỒ SƠ MỚI, GIA HẠN VÀ TRẠNG THÁI XỬ LÝ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BIỂU ĐỒ 1: SO SÁNH SỐ LƯỢNG HỒ SƠ MỚI VS HỒ SƠ GIA HẠN (RECHARTS BAR CHART) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#004182]" />
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  Phân Tích Hồ Sơ Mới & Hồ Sơ Gia Hạn (6 Tháng Gần Nhất)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                So sánh số lượng người tham gia đăng ký mới và tái tục thẻ định kỳ qua từng kỳ
              </p>
            </div>

            {/* Toggle đơn vị: Số lượng vs Doanh thu */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setBarChartMetric('count')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  barChartMetric === 'count' ? 'bg-white text-[#004182] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Số lượng (Hồ sơ)
              </button>
              <button
                type="button"
                onClick={() => setBarChartMetric('revenue')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                  barChartMetric === 'revenue' ? 'bg-white text-[#004182] shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Doanh thu (VNĐ)
              </button>
            </div>
          </div>

          {/* Container Recharts BarChart */}
          <div className="w-full h-72 sm:h-80 min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.newVsRenewMonthly}
                margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickFormatter={(val) => {
                    if (barChartMetric === 'revenue') {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(0)}Tr`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    }
                    return val;
                  }}
                />
                <RechartsTooltip
                  content={<CustomBarTooltip isCurrency={barChartMetric === 'revenue'} />}
                />
                <RechartsLegend
                  wrapperStyle={{ paddingTop: 16 }}
                  formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>}
                />
                <Bar
                  dataKey={barChartMetric === 'count' ? 'newCount' : 'newRev'}
                  name="Đăng ký mới"
                  fill={COLORS.primaryNavy}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
                <Bar
                  dataKey={barChartMetric === 'count' ? 'renewCount' : 'renewRev'}
                  name="Gia hạn / Tái tục"
                  fill={COLORS.emeraldGreen}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tháng này: Mới</span>
              <strong className="text-[#004182] text-sm">{stats.monthNewCount} hồ sơ</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tháng này: Gia hạn</span>
              <strong className="text-emerald-700 text-sm">{stats.monthRenewCount} hồ sơ</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tổng tiếp nhận</span>
              <strong className="text-slate-800 text-sm">{stats.monthTotalRecords} hồ sơ</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Tỷ lệ hoàn thành</span>
              <strong className="text-amber-600 text-sm">{stats.monthCompletionRate}%</strong>
            </div>
          </div>
        </div>

        {/* BIỂU ĐỒ 2: CƠ CẤU TRẠNG THÁI XỬ LÝ TRONG THÁNG (RECHARTS DONUT PIECHART) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h3 className="text-base sm:text-lg font-bold text-slate-800">
                  Trạng Thái Xử Lý ({selectedMonth.slice(5)}/{selectedMonth.slice(0, 4)})
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-500">Phân loại tiến độ duyệt và nộp cơ quan BHXH</p>
          </div>

          {/* Container Recharts Donut PieChart */}
          <div className="w-full h-64 relative flex items-center justify-center my-2">
            {stats.statusDistribution.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip content={<CustomPieTooltip />} />
                    <Pie
                      data={stats.statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={3}
                      cornerRadius={6}
                    >
                      {stats.statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Metric tổng ở tâm Donut Chart */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-800">{stats.monthTotalRecords}</span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hồ sơ tháng</span>
                </div>
              </>
            ) : (
              <div className="text-center text-slate-400 text-xs">
                <FileText size={32} className="mx-auto text-slate-300 mb-1" />
                Chưa phát sinh hồ sơ trong tháng {selectedMonth}
              </div>
            )}
          </div>

          {/* Danh mục chú thích tương tác (Legend) */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {stats.statusDistribution.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                  <span className="font-semibold text-slate-700 truncate max-w-[150px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900">{item.value}</span>
                  <span className="text-[10px] text-slate-400 font-bold w-9 text-right">({item.percent}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. BIỂU ĐỒ BỔ TRỢ: DÒNG CHẢY HÀNG NGÀY TRONG THÁNG & CƠ CẤU SẢN PHẨM */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BIỂU ĐỒ 3: DÒNG CHẢY TIẾP NHẬN HÀNG NGÀY (RECHARTS AREA CHART) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h3 className="text-base font-bold text-slate-800">
                  Dòng Chảy Tiếp Nhận Hồ Sơ Hàng Ngày (Tháng {selectedMonth.slice(5)})
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhịp điệu xử lý hồ sơ mới và tái tục qua từng ngày trong tháng
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              30 ngày
            </span>
          </div>

          <div className="w-full h-64 min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.dailyIntakeTrend}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradientNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primaryNavy} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.primaryNavy} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientRenew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.emeraldGreen} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.emeraldGreen} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="day"
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  interval={3}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  allowDecimals={false}
                />
                <RechartsTooltip content={<CustomBarTooltip />} />
                <RechartsLegend
                  wrapperStyle={{ paddingTop: 10 }}
                  formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>}
                />
                <Area
                  type="monotone"
                  dataKey="Hồ sơ mới"
                  stroke={COLORS.primaryNavy}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradientNew)"
                />
                <Area
                  type="monotone"
                  dataKey="Hồ sơ gia hạn"
                  stroke={COLORS.emeraldGreen}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#gradientRenew)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* BIỂU ĐỒ 4: CƠ CẤU BHXH VS BHYT (RECHARTS BAR MIX) */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <h3 className="text-base font-bold text-slate-800">Cơ Cấu Sản Phẩm Thu Nộp</h3>
            </div>
            <p className="text-xs text-slate-500">BHXH Tự Nguyện vs BHYT Hộ Gia Đình trong tháng</p>
          </div>

          <div className="my-4 space-y-4">
            {stats.typeMixData.map((item: any, idx: number) => {
              const totalCnt = (stats.typeMixData[0]?.count || 0) + (stats.typeMixData[1]?.count || 0);
              const pct = totalCnt > 0 ? Math.round((item.count / totalCnt) * 100) : 0;
              return (
                <div key={idx} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${item.name.includes('BHXH') ? 'bg-[#004182]' : 'bg-[#0ea5e9]'}`}>
                        {item.name.includes('BHXH') ? <Shield size={16} /> : <HeartPulse size={16} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{item.name}</h4>
                        <span className="text-[11px] text-slate-500 font-semibold">{formatMoney(item.revenue)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-slate-800">{item.count}</span>
                      <span className="text-[10px] text-slate-400 block font-semibold">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.name.includes('BHXH') ? COLORS.primaryNavy : COLORS.skyBlue
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">Đăng ký mới nhanh:</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setGlobalRegisterModal({ isOpen: true, type: 'BHXH' })}
                className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#004182] hover:bg-blue-100 font-extrabold text-[11px] transition cursor-pointer"
              >
                + BHXH
              </button>
              <button
                type="button"
                onClick={() => setGlobalRegisterModal({ isOpen: true, type: 'BHYT' })}
                className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-extrabold text-[11px] transition cursor-pointer"
              >
                + BHYT
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
