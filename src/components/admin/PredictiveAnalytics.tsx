import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, formatDateVN, formatMonthVN, getLocalYYYYMMDD, getHistoryForCustomer, groupRecordsByCustomer } from '../../utils/helpers';
import { TrendingUp, Calendar, AlertTriangle, Zap, Phone, Copy, Search, Flame, BarChart3 } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import SearchResultModal from '../modals/SearchResultModal';
import RegisterModal from '../modals/RegisterModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const PredictiveAnalytics: React.FC = () => {
  const { records, staff, showToast, currentUser } = useAppContext();

  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Register Modal state for fast renewal
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [selectedCustomerForRegister, setSelectedCustomerForRegister] = useState<any>(null);
  const [registerType, setRegisterType] = useState<'BHXH' | 'BHYT'>('BHXH');

  // Search Result Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchModalResults, setSearchModalResults] = useState<any[]>([]);
  const [searchModalCode, setSearchModalCode] = useState('');

  const todayStr = getLocalYYYYMMDD();
  const today = new Date();

  // Compute 12-month projection data starting from current month
  const projectionMonths = useMemo(() => {
    const months = [];
    const curr = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      months.push(`${y}-${m}`);
      curr.setMonth(curr.getMonth() + 1);
    }
    return months;
  }, []);

  // Group records by customer to get the latest active status & nextPayment date for each customer
  const latestCustomerRecords = useMemo(() => {
    return groupRecordsByCustomer(records);
  }, [records]);

  // Compute monthly revenue forecasts based on latest active customer records
  const monthlyForecast = useMemo(() => {
    const bhxhForecast: { [month: string]: number } = {};
    const bhytForecast: { [month: string]: number } = {};
    const countForecast: { [month: string]: number } = {};

    projectionMonths.forEach(m => {
      bhxhForecast[m] = 0;
      bhytForecast[m] = 0;
      countForecast[m] = 0;
    });

    latestCustomerRecords.forEach(r => {
      const pStatus = r.payment_status || (r as any).paymentStatus;
      const nextPay = r.next_payment || (r as any).nextPayment;
      if (pStatus === 'Đã hủy' || !nextPay || r.status === 'Đã dừng đóng') return;

      const expMonth = nextPay.substring(0, 7);
      if (bhxhForecast[expMonth] !== undefined) {
        const amt = Number(r.amount) || 0;
        if (r.type === 'BHXH') {
          bhxhForecast[expMonth] = (bhxhForecast[expMonth] || 0) + amt;
        } else if (r.type === 'BHYT') {
          bhytForecast[expMonth] = (bhytForecast[expMonth] || 0) + amt;
        }
        countForecast[expMonth] = (countForecast[expMonth] || 0) + 1;
      }
    });

    return {
      labels: projectionMonths.map(m => `Tháng ${formatMonthVN(m)}`),
      bhxhData: projectionMonths.map(m => bhxhForecast[m] || 0),
      bhytData: projectionMonths.map(m => bhytForecast[m] || 0),
      countData: projectionMonths.map(m => countForecast[m] || 0),
    };
  }, [latestCustomerRecords, projectionMonths]);

  // Compute customer risk list with days remaining based on latest customer records (amount > 0 only)
  const expiringCustomers = useMemo(() => {
    const list: any[] = [];
    const todayTs = new Date(todayStr).getTime();

    latestCustomerRecords.forEach(r => {
      if (r.status === 'Đã dừng đóng') return;
      const amountVal = Number(r.amount) || 0;
      if (amountVal <= 0) return;

      const nextPay = r.next_payment || (r as any).nextPayment;
      if (!nextPay) return;
      const nextTs = new Date(nextPay).getTime();
      const diffDays = Math.ceil((nextTs - todayTs) / (1000 * 60 * 60 * 24));

      // Consider upcoming renewals within 60 days or already overdue up to 15 days
      if (diffDays >= -15 && diffDays <= 60) {
        let riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' | 'EXPIRED' = 'LOW';
        let riskLabel = '🟢 Thấp (>30 ngày)';
        let riskClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

        if (diffDays < 0) {
          riskLevel = 'EXPIRED';
          riskLabel = '🚨 Đã Quá Hạn';
          riskClass = 'bg-red-100 text-red-800 border-red-300 animate-pulse';
        } else if (diffDays <= 7) {
          riskLevel = 'HIGH';
          riskLabel = '🔴 Hỏa Tốc (≤7 ngày)';
          riskClass = 'bg-red-50 text-red-700 border-red-200';
        } else if (diffDays <= 15) {
          riskLevel = 'MEDIUM';
          riskLabel = '🟠 Ưu Tiên Cao (8-15 ngày)';
          riskClass = 'bg-orange-50 text-orange-700 border-orange-200';
        } else if (diffDays <= 30) {
          riskLevel = 'LOW';
          riskLabel = '🟡 Cần Nhắc (16-30 ngày)';
          riskClass = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        list.push({
          ...r,
          nextPayment: nextPay,
          diffDays,
          riskLevel,
          riskLabel,
          riskClass
        });
      }
    });

    // Sort by diffDays ascending (most urgent first)
    list.sort((a, b) => a.diffDays - b.diffDays);
    return list;
  }, [latestCustomerRecords, todayStr]);

  // Filtered customer list for table
  const filteredExpiringList = useMemo(() => {
    let list = expiringCustomers;

    if (selectedRiskFilter !== 'all') {
      list = list.filter(item => item.riskLevel === selectedRiskFilter);
    }

    if (selectedTypeFilter !== 'all') {
      list = list.filter(item => item.type === selectedTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.phone && item.phone.includes(q)) ||
        (item.cccd && item.cccd.includes(q)) ||
        (item.bhxh && item.bhxh.includes(q))
      );
    }

    return list;
  }, [expiringCustomers, selectedRiskFilter, selectedTypeFilter, searchQuery]);

  // Aggregate metrics
  const metrics = useMemo(() => {
    const next30DaysList = expiringCustomers.filter(c => c.diffDays >= 0 && c.diffDays <= 30);
    const next30DaysAmount = next30DaysList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const next12MonthsAmount = monthlyForecast.bhxhData.reduce((a, b) => a + b, 0) + monthlyForecast.bhytData.reduce((a, b) => a + b, 0);

    const urgentHighCount = expiringCustomers.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'EXPIRED').length;
    const mediumCount = expiringCustomers.filter(c => c.riskLevel === 'MEDIUM').length;

    return {
      next30DaysCount: next30DaysList.length,
      next30DaysAmount,
      next12MonthsAmount,
      urgentHighCount,
      mediumCount
    };
  }, [expiringCustomers, monthlyForecast]);

  // Zalo Message Helper
  const copyZaloMessage = (customer: any) => {
    const daysStr = customer.diffDays < 0 
      ? `đã quá hạn ${Math.abs(customer.diffDays)} ngày` 
      : `sẽ hết hạn vào ngày ${formatDateVN(customer.nextPayment)}`;
      
    const assignedStaff = staff.find(s => s.id === (customer.staff_id || customer.staffId));
    const staffPhone = assignedStaff?.phone || currentUser?.phone || '0972709321';
    const typeLabel = customer.type === 'BHYT' ? 'BHYT' : 'BHXH';

    const msg = `Kính gửi Anh/Chị ${customer.name}, Đại lý thu BHXH Sông Mã trân trọng thông báo: Hồ sơ ${typeLabel} của Anh/Chị ${daysStr}. Số tiền đóng tiếp theo là ${formatMoney(customer.amount)}. Vui lòng liên hệ số ĐT ${staffPhone} để được hỗ trợ gia hạn kịp thời, đảm bảo quyền lợi bảo hiểm liên tục!`;

    navigator.clipboard.writeText(msg);
    showToast(`Đã sao chép tin nhắn Zalo nhắc đóng phí cho khách hàng ${customer.name}!`, 'success');
  };

  const handleOpenRegister = (customer: any) => {
    let fullRecord = customer;
    if (customer && records && records.length > 0) {
      const cleanCccd = (customer.cccd || customer.citizenId || '').replace(/\D/g, '');
      const cleanBhxh = (customer.bhxh || customer.bhxhCode || '').replace(/\D/g, '');
      const activeRecords = records.filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');
      const matched = activeRecords.filter(r => {
        if (customer.id && (r.id === customer.id || r.id === Number(customer.id))) return true;
        const rCccd = (r.cccd || '').replace(/\D/g, '');
        const rBhxh = (r.bhxh || '').replace(/\D/g, '');
        const rOld = (r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
        return (cleanCccd && rCccd === cleanCccd) || (cleanBhxh && rBhxh === cleanBhxh) || (cleanBhxh && rOld === cleanBhxh);
      });
      if (matched.length > 0) {
        matched.sort((a, b) => {
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
        const newest = matched[0];
        if (newest) {
          fullRecord = {
            ...newest,
            ...customer,
            income: customer.income ?? newest.income,
            method: customer.method || newest.method,
            fromMonth: customer.fromMonth || (customer as any).frommonth || customer.from_month || newest.from_month || (newest as any).fromMonth,
            toMonth: customer.toMonth || (customer as any).tomonth || customer.to_month || newest.to_month || (newest as any).toMonth,
            nextPayment: customer.nextPayment || (customer as any).next_payment || newest.next_payment || (newest as any).nextPayment,
            months: customer.months ?? newest.months,
            wage: customer.wage ?? newest.wage,
            nnSupportPct: customer.nnSupportPct ?? customer.nn_support_pct ?? newest.nn_support_pct ?? (newest as any).nnSupportPct,
            dpSupportPct: customer.dpSupportPct ?? customer.dp_support_pct ?? newest.dp_support_pct ?? (newest as any).dpSupportPct
          };
        }
      }
    }
    setSelectedCustomerForRegister(fullRecord);
    setRegisterType(customer.type || fullRecord.type || 'BHXH');
    setRegisterModalOpen(true);
  };

  const handleViewHistory = (customer: any) => {
    const code = (customer.bhxh || customer.cccd || '').trim();
    const historyRecords = getHistoryForCustomer(customer, records);

    setSearchModalResults(historyRecords);
    setSearchModalCode(code || customer.name || '---');
    setSearchModalOpen(true);
  };

  // Chart options
  const chartDataConfig = {
    labels: monthlyForecast.labels,
    datasets: [
      {
        label: 'Dự báo Doanh thu BHXH (VNĐ)',
        data: monthlyForecast.bhxhData,
        backgroundColor: '#004182',
        borderRadius: 8,
      },
      {
        label: 'Dự báo Doanh thu BHYT (VNĐ)',
        data: monthlyForecast.bhytData,
        backgroundColor: '#0ea5e9',
        borderRadius: 8,
      }
    ]
  };

  const chartOptionsConfig = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { family: 'Inter', size: 12, weight: 600 }
        }
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `${context.dataset.label}: ${formatMoney(context.raw)}`;
          }
        }
      }
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        ticks: {
          callback: function (value: any) {
            return (value / 1000000).toLocaleString() + 'M';
          }
        }
      }
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#004182] border border-blue-200/70 shadow-2xs mb-1.5">
              <Zap size={13} className="text-amber-500 fill-amber-400" />
              <span>Thuật Toán Phân Tích & Dự Báo Dòng Tiền Đáo Hạn</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#004182] flex-shrink-0" />
              <span>Bản Đồ Nhiệt & Dự Báo Dòng Tiền Tái Tục</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Phân tích tự động 12 tháng tới dựa trên kỳ hết hạn đóng phí. Cảnh báo các mức độ rủi ro chậm đóng để chủ động chăm sóc giữ chân người tham gia.
            </p>
          </div>

          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 font-medium flex-shrink-0">
            <Calendar size={15} className="text-[#004182]" />
            <span>Chu kỳ phân tích: <strong className="text-slate-800">12 tháng tới</strong></span>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-50 text-[#004182]">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Đáo Hạn 30 Ngày Tới</p>
            <p className="text-xl font-black text-[#004182] mt-0.5">{formatMoney(metrics.next30DaysAmount)}</p>
            <p className="text-xs text-slate-500 mt-1 font-semibold">{metrics.next30DaysCount} hồ sơ cần thu tiền</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-sky-50 text-sky-600">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dòng Tiền 12 Tháng Tới</p>
            <p className="text-xl font-black text-sky-600 mt-0.5">{formatMoney(metrics.next12MonthsAmount)}</p>
            <p className="text-xs text-slate-500 mt-1">Dự báo tổng tiền thu kỳ vọng</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Khách Hàng Rủi Ro Cao</p>
            <p className="text-xl font-black text-red-600 mt-0.5">{metrics.urgentHighCount} Hồ sơ</p>
            <p className="text-xs text-red-600 font-bold mt-1">Hết hạn ≤ 7 ngày / Đã quá hạn</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-orange-50 text-orange-600">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ưu Tiên Chăm Sóc (8-15 Ngày)</p>
            <p className="text-xl font-black text-orange-600 mt-0.5">{metrics.mediumCount} Hồ sơ</p>
            <p className="text-xs text-orange-600 font-semibold mt-1">Cần nhắc đóng phí đợt tới</p>
          </div>
        </div>
      </div>

      {/* 12-Month Projection Chart */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#004182]" /> Biểu Đồ Dự Báo Dòng Tiền Thu Phí 12 Tháng Tới
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Thống kê tổng giá trị giao dịch dự kiến thu được theo từng tháng</p>
          </div>
        </div>
        <div className="h-80 w-full pt-4">
          <Bar data={chartDataConfig} options={chartOptionsConfig} />
        </div>
      </div>

      {/* Renewal Heatmap Matrix */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-md">
        <div className="mb-6">
          <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
            <Flame size={20} className="text-orange-500" /> Bản Đồ Nhiệt Phân Loại Mức Độ Ưu Tiên Chăm Sóc
          </h3>
          <p className="text-xs text-slate-500 mt-1">Nhấp chọn phân vùng nhiệt để lọc ngay danh sách khách hàng cần xử lý</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Zone 1: EXPIRED & HIGH */}
          <div
            onClick={() => setSelectedRiskFilter('HIGH')}
            className={`p-5 rounded-2xl border-2 transition cursor-pointer hover:shadow-lg ${selectedRiskFilter === 'HIGH' ? 'border-red-500 bg-red-50/80 shadow-md' : 'border-red-200 bg-red-50/30'}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-red-700 uppercase tracking-wider">🔴 HỎA TỐC (≤ 7 NÀY)</span>
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            </div>
            <p className="text-2xl font-black text-red-700">{expiringCustomers.filter(c => c.riskLevel === 'HIGH' || c.riskLevel === 'EXPIRED').length} HS</p>
            <p className="text-xs text-red-600 font-semibold mt-1">Cần gọi điện / gửi Zalo nhắc gấp</p>
          </div>

          {/* Zone 2: MEDIUM */}
          <div
            onClick={() => setSelectedRiskFilter('MEDIUM')}
            className={`p-5 rounded-2xl border-2 transition cursor-pointer hover:shadow-lg ${selectedRiskFilter === 'MEDIUM' ? 'border-orange-500 bg-orange-50/80 shadow-md' : 'border-orange-200 bg-orange-50/30'}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-orange-700 uppercase tracking-wider">🟠 ƯU TIÊN CAO (8-15 NÀY)</span>
              <span className="w-3 h-3 rounded-full bg-orange-500" />
            </div>
            <p className="text-2xl font-black text-orange-700">{expiringCustomers.filter(c => c.riskLevel === 'MEDIUM').length} HS</p>
            <p className="text-xs text-orange-600 font-semibold mt-1">Chuẩn bị nội dung gửi Zalo nhắc đóng</p>
          </div>

          {/* Zone 3: LOW */}
          <div
            onClick={() => setSelectedRiskFilter('LOW')}
            className={`p-5 rounded-2xl border-2 transition cursor-pointer hover:shadow-lg ${selectedRiskFilter === 'LOW' ? 'border-amber-500 bg-amber-50/80 shadow-md' : 'border-amber-200 bg-amber-50/30'}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-amber-700 uppercase tracking-wider">🟡 CẦN LƯU Ý (16-30 NÀY)</span>
              <span className="w-3 h-3 rounded-full bg-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-700">{expiringCustomers.filter(c => c.riskLevel === 'LOW').length} HS</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">Theo dõi tiến độ gia hạn định kỳ</p>
          </div>

          {/* Zone 4: ALL */}
          <div
            onClick={() => setSelectedRiskFilter('all')}
            className={`p-5 rounded-2xl border-2 transition cursor-pointer hover:shadow-lg ${selectedRiskFilter === 'all' ? 'border-[#004182] bg-blue-50/80 shadow-md' : 'border-slate-200 bg-slate-50/40'}`}
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider">🌐 TẤT CẢ HỒ SƠ</span>
              <span className="w-3 h-3 rounded-full bg-[#004182]" />
            </div>
            <p className="text-2xl font-black text-[#004182]">{expiringCustomers.length} HS</p>
            <p className="text-xs text-slate-500 font-semibold mt-1">Hiển thị toàn bộ danh sách nhắc đóng</p>
          </div>
        </div>
      </div>

      {/* ACTIONABLE CUSTOMER EXPIRING LIST */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" /> Danh Sách Khách Hàng Cần Chăm Sóc Gấp
            </h3>
            <p className="text-xs text-slate-500 mt-1">Xử lý ngay các hồ sơ sắp hết hạn để duy trì tỷ lệ tái tục cao</p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedTypeFilter || 'all'}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-[#004182] transition"
            >
              <option value="all">Tất cả loại hình</option>
              <option value="BHXH">BHXH Tự Nguyện</option>
              <option value="BHYT">BHYT Hộ Gia Đình</option>
            </select>

            <div className="relative">
              <input
                type="text"
                placeholder="Tìm tên, CCCD/ĐDCN, SĐT..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium rounded-xl pl-8 pr-3 py-2 outline-none focus:border-[#004182] w-48"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredExpiringList.map((c, idx) => (
            <div key={idx} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-extrabold text-slate-900">{c.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">SĐT: {c.phone} • Số ĐDCN/CCCD: {c.cccd || c.bhxh || '---'}</p>
                </div>
                <span className={`px-2 py-1 rounded text-[10px] font-bold border ${c.riskClass}`}>
                  {c.riskLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-400 block">Loại hình</span>
                  <span className={`font-bold ${c.type === 'BHXH' ? 'text-[#004182]' : 'text-[#0ea5e9]'}`}>{c.type}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Số tiền dự kiến</span>
                  <span className="font-bold text-[#004182]">{formatMoney(c.amount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Hạn đóng tiếp theo</span>
                  <span className="font-semibold text-slate-800">{formatDateVN(c.nextPayment)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Còn lại</span>
                  <span className={`font-black ${c.diffDays <= 7 ? 'text-red-600' : 'text-slate-700'}`}>
                    {c.diffDays < 0 ? `Đã quá ${Math.abs(c.diffDays)} ngày` : `${c.diffDays} ngày`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => handleViewHistory(c)}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#004182] font-bold text-xs hover:bg-blue-100 transition flex items-center gap-1"
                >
                  Lịch Sử
                </button>
                <button
                  onClick={() => copyZaloMessage(c)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1"
                >
                  <Copy size={14} /> Zalo
                </button>
                <button
                  onClick={() => handleOpenRegister(c)}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-extrabold text-xs hover:bg-amber-600 transition flex items-center gap-1 shadow-sm"
                >
                  <Zap size={14} /> Gia Hạn
                </button>
              </div>
            </div>
          ))}

          {filteredExpiringList.length === 0 && (
            <div className="p-8 text-center text-slate-400 font-medium">
              Không tìm thấy hồ sơ sắp hết hạn nào phù hợp với bộ lọc.
            </div>
          )}
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-xs border-b border-slate-200 tracking-wider">
              <tr>
                <th className="p-4">Khách Hàng</th>
                <th className="p-4">Số ĐDCN / CCCD</th>
                <th className="p-4">Loại Hình</th>
                <th className="p-4">Hạn Tiếp Theo</th>
                <th className="p-4">Thời Gian Còn Lại</th>
                <th className="p-4">Dự Kiến Thu (VNĐ)</th>
                <th className="p-4">Mức Độ Rủi Ro</th>
                <th className="p-4 text-center">Thao Tác Chăm Sóc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpiringList.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="p-4">
                    <div className="font-extrabold text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={12} /> {c.phone}</div>
                  </td>
                  <td className="p-4 font-semibold text-slate-700">{c.cccd || c.bhxh || '---'}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${c.type === 'BHXH' ? 'bg-blue-100 text-[#004182]' : 'bg-sky-100 text-[#0ea5e9]'}`}>
                      {c.type}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-700">{formatDateVN(c.nextPayment)}</td>
                  <td className="p-4">
                    <span className={`font-black text-xs ${c.diffDays <= 7 ? 'text-red-600' : 'text-slate-800'}`}>
                      {c.diffDays < 0 ? `Đã quá ${Math.abs(c.diffDays)} ngày` : `${c.diffDays} ngày nữa`}
                    </span>
                  </td>
                  <td className="p-4 font-extrabold text-[#004182]">{formatMoney(c.amount)}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${c.riskClass}`}>
                      {c.riskLabel}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewHistory(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-[#004182] font-bold text-xs hover:bg-blue-100 transition"
                        title="Xem lịch sử tra cứu quá trình"
                      >
                        Lịch Sử
                      </button>
                      <button
                        onClick={() => copyZaloMessage(c)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1"
                        title="Copy tin nhắn Zalo nhắc đóng"
                      >
                        <Copy size={13} /> Zalo
                      </button>
                      <button
                        onClick={() => handleOpenRegister(c)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-extrabold text-xs hover:bg-amber-600 transition flex items-center gap-1 shadow-sm"
                        title="Tạo đơn gia hạn nhanh"
                      >
                        <Zap size={13} /> Gia Hạn
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredExpiringList.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold">
                    Không tìm thấy hồ sơ sắp hết hạn nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER / RENEWAL MODAL */}
      {registerModalOpen && selectedCustomerForRegister && (
        <RegisterModal
          isOpen={registerModalOpen}
          onClose={() => setRegisterModalOpen(false)}
          type={registerType}
          record={selectedCustomerForRegister}
          isRenew={true}
        />
      )}

      {/* SEARCH HISTORY MODAL */}
      {searchModalOpen && (
        <SearchResultModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          results={searchModalResults}
          searchCode={searchModalCode}
        />
      )}
    </div>
  );
};

export default PredictiveAnalytics;
