import React from 'react';
import { Wallet, Coins, Hourglass, Filter, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';

interface FinanceStatsCardsProps {
  stats: {
    totalRev: number;
    totalPending: number;
    totalComm: number;
  };
  kpiQuickFilter?: 'ALL' | 'PAID' | 'PENDING';
  onToggleKpiFilter?: (filter: 'PAID' | 'PENDING') => void;
  periodLabel?: string;
  // Backwards compatibility props
  periodFilter?: string;
  monthVal?: string;
  quarterVal?: string;
  quarterYear?: string;
  yearVal?: string;
  customFrom?: string;
  customTo?: string;
  getCurrentMonthVal?: () => string;
  submittedFilter?: string;
}

export const FinanceStatsCards: React.FC<FinanceStatsCardsProps> = ({
  stats,
  kpiQuickFilter = 'ALL',
  onToggleKpiFilter,
  periodLabel: propPeriodLabel,
  periodFilter,
  monthVal,
  quarterVal,
  quarterYear,
  yearVal,
  customFrom,
  customTo,
  getCurrentMonthVal,
  submittedFilter
}) => {
  let displayPeriodLabel = propPeriodLabel;

  if (!displayPeriodLabel) {
    displayPeriodLabel = periodFilter === 'month' 
      ? `Tháng ${monthVal || (getCurrentMonthVal ? getCurrentMonthVal() : '')}` 
      : periodFilter === 'quarter' 
        ? `Quý ${quarterVal}/${quarterYear}` 
        : periodFilter === 'year' 
          ? `Năm ${yearVal}` 
          : periodFilter === 'custom' 
            ? `${customFrom || '...'} - ${customTo || '...'}` 
            : 'Tất cả';

    if (submittedFilter && submittedFilter !== 'all') {
      if (submittedFilter.startsWith('batch_')) {
        const batchName = submittedFilter.replace('batch_', '');
        displayPeriodLabel = batchName;
      } else if (submittedFilter === 'submitted') {
        displayPeriodLabel = `${displayPeriodLabel} • Đã chuyển`;
      } else if (submittedFilter === 'unsubmitted') {
        displayPeriodLabel = `${displayPeriodLabel} • Chưa chuyển`;
      }
    }
  }

  const isPaidActive = kpiQuickFilter === 'PAID';
  const isPendingActive = kpiQuickFilter === 'PENDING';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-4 sm:mb-6">
      {/* Thẻ 1: Tổng Doanh Thu Đã Thu - 1-chạm kích hoạt lọc Đã thu tiền */}
      <div 
        onClick={() => onToggleKpiFilter && onToggleKpiFilter('PAID')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleKpiFilter && onToggleKpiFilter('PAID');
          }
        }}
        title={isPaidActive ? "Click để hiển thị lại tất cả giao dịch" : "Click 1-chạm để chỉ lọc các giao dịch ĐÃ THU TIỀN"}
        className={`relative p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
          isPaidActive
            ? 'bg-blue-50/95 ring-2 ring-blue-500 shadow-xs border border-blue-200'
            : 'bg-gradient-to-br from-blue-50/60 to-white hover:bg-blue-50/80 shadow-xs border border-slate-200 hover:border-blue-300'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center truncate">
            <Wallet size={16} className="text-[#004182] mr-1.5 shrink-0" /> Tổng Doanh Thu Đã Thu
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-[#004182] bg-blue-100/80 px-2 py-0.5 rounded-full shrink-0">
            {displayPeriodLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#004182]">
            {formatMoney(stats.totalRev || 0)}
          </span>
          {isPaidActive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md animate-pulse">
              <CheckCircle2 size={12} /> Đang chọn lọc
            </span>
          ) : (
            <span className="text-[11px] font-medium text-blue-600/80 group-hover:text-blue-700 flex items-center gap-1">
              <Filter size={11} /> 1-chạm lọc
            </span>
          )}
        </div>
      </div>

      {/* Thẻ 2: Chờ Thanh Toán - 1-chạm kích hoạt lọc Chờ thanh toán */}
      <div 
        onClick={() => onToggleKpiFilter && onToggleKpiFilter('PENDING')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleKpiFilter && onToggleKpiFilter('PENDING');
          }
        }}
        title={isPendingActive ? "Click để hiển thị lại tất cả giao dịch" : "Click 1-chạm để chỉ lọc các hồ sơ CHỜ THANH TOÁN"}
        className={`relative p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
          isPendingActive
            ? 'bg-amber-50/95 ring-2 ring-amber-500 shadow-xs border border-amber-200'
            : 'bg-gradient-to-br from-amber-50/40 to-white hover:bg-amber-50/70 shadow-xs border border-slate-200 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center truncate">
            <Hourglass size={16} className="text-amber-500 mr-1.5 shrink-0" /> Chờ Thanh Toán
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full shrink-0">
            {displayPeriodLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-600">
            {formatMoney(stats.totalPending || 0)}
          </span>
          {isPendingActive ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md animate-pulse">
              <CheckCircle2 size={12} /> Đang chọn lọc
            </span>
          ) : (
            <span className="text-[11px] font-medium text-amber-600/80 flex items-center gap-1">
              <Filter size={11} /> 1-chạm lọc
            </span>
          )}
        </div>
      </div>

      {/* Thẻ 3: Tổng Hoa Hồng - Thể hiện hoa hồng theo danh sách hồ sơ đang được lọc */}
      <div className="bg-gradient-to-br from-[#FDB913]/10 to-white p-4 sm:p-5 rounded-2xl shadow-xs border border-[#FDB913]/25 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center truncate">
            <Coins size={16} className="text-[#d97706] mr-1.5 shrink-0" /> Tổng Hoa Hồng
          </span>
          <span className="text-[10px] sm:text-xs font-bold text-[#b45309] bg-[#FDB913]/20 px-2 py-0.5 rounded-full shrink-0">
            {kpiQuickFilter === 'PENDING' ? 'Chờ thanh toán (0đ)' : displayPeriodLabel}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#b45309]">
            {formatMoney(stats.totalComm || 0)}
          </span>
          <span className="text-[11px] font-semibold text-slate-400">
            Theo hồ sơ đang lọc
          </span>
        </div>
      </div>
    </div>
  );
};

export default FinanceStatsCards;
