import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, RotateCcw, User, Send } from 'lucide-react';
import { dateISOToVN } from '../../../utils/helpers';
import type { TransactionFilterState } from '../../../utils/transactionFilters';
import { toPeriodFilterValue, fromPeriodFilterValue } from '../../../utils/transactionFilters';
import { AccountingPeriodController } from './AccountingPeriodController';

export interface FinanceFilterBarProps {
  filterState: TransactionFilterState;
  setFilterState: React.Dispatch<React.SetStateAction<TransactionFilterState>>;
  availableBatches: Array<{ batch: string; date?: string | undefined; count: number; totalAmount?: number | undefined }>;
  staff: any[];
  currentUser: any;
  onReset: () => void;
}

export const FinanceFilterBar: React.FC<FinanceFilterBarProps> = ({
  filterState,
  setFilterState,
  availableBatches,
  staff,
  currentUser,
  onReset
}) => {
  // 1. Debounce 300ms cho ô tìm kiếm
  const [localSearch, setLocalSearch] = useState(filterState.searchQuery || '');

  useEffect(() => {
    setLocalSearch(filterState.searchQuery || '');
  }, [filterState.searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localSearch !== filterState.searchQuery) {
        setFilterState(prev => ({ ...prev, searchQuery: localSearch }));
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, filterState.searchQuery, setFilterState]);

  const handleClearSearch = () => {
    setLocalSearch('');
    setFilterState(prev => ({ ...prev, searchQuery: '' }));
  };

  // 2. Tháng hiện tại làm mốc mặc định
  const currentMonthStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const isEmployeeOnly = currentUser?.role === 'Nhân viên';

  // Kiểm tra xem có đang có bộ lọc khác mặc định hay không để hiển thị chấm thông báo
  const isFiltered = useMemo(() => {
    return (
      (filterState.searchQuery && filterState.searchQuery.trim() !== '') ||
      (filterState.submissionStatus && filterState.submissionStatus !== 'ALL') ||
      (filterState.staffId && filterState.staffId !== 'ALL' && filterState.staffId !== 'all') ||
      filterState.periodType !== 'MONTH' ||
      filterState.selectedMonth !== currentMonthStr ||
      filterState.kpiQuickFilter !== 'ALL'
    );
  }, [filterState, currentMonthStr]);

  return (
    <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/80 rounded-t-2xl space-y-3">
      {/* HÀNG 1: TÌM KIẾM THÔNG MINH & TIÊU CHÍ PHÂN LOẠI NGHIỆP VỤ + NÚT ĐẶT LẠI */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
        {/* KHỐI 1: Ô Tìm kiếm thông minh */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Tìm tên, CCCD/ĐDCN, Mã BHXH, SĐT, Số biên lai..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] transition placeholder:text-slate-400"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Cụm bộ lọc phân loại & nút reset (trên mobile xếp ngang, trên tablet/desktop nối tiếp) */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
          {/* KHỐI 2: Dropdown "Trạng Thái Nộp BHXH" */}
          <div className="flex-1 sm:flex-initial sm:w-56 md:w-60 relative">
            <div className="relative">
              <select
                value={filterState.submissionStatus || 'ALL'}
                onChange={e => setFilterState(prev => ({ ...prev, submissionStatus: e.target.value }))}
                className={`w-full p-2 pl-8 pr-7 rounded-xl border text-xs sm:text-sm outline-none transition cursor-pointer appearance-none ${
                  filterState.submissionStatus && filterState.submissionStatus !== 'ALL'
                    ? 'border-[#004182] bg-blue-50/80 font-bold text-[#004182]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <option value="ALL">Tất cả chuyển BHXH</option>
                <option value="UNSUBMITTED">Chưa chuyển BHXH</option>
                <option value="SUBMITTED">Đã chuyển BHXH</option>
                {availableBatches && availableBatches.length > 0 && (
                  <optgroup label="--- Danh sách đợt nộp thực tế ---">
                    {availableBatches.map(b => (
                      <option key={b.batch} value={b.batch}>
                        {b.batch}{b.date ? ` (${dateISOToVN(b.date)})` : ''} - ({b.count} hồ sơ)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <Send size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* KHỐI 3: Dropdown "Cán Bộ Thu" (Tự động ẩn với vai trò Nhân viên) */}
          {!isEmployeeOnly && (
            <div className="flex-1 sm:flex-initial sm:w-44 md:w-48 relative">
              <div className="relative">
                <select
                  value={filterState.staffId || 'ALL'}
                  onChange={e => setFilterState(prev => ({ ...prev, staffId: e.target.value }))}
                  className={`w-full p-2 pl-8 pr-7 rounded-xl border text-xs sm:text-sm outline-none transition cursor-pointer appearance-none ${
                    filterState.staffId && filterState.staffId !== 'ALL' && filterState.staffId !== 'all'
                      ? 'border-[#004182] bg-blue-50/80 font-bold text-[#004182]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <option value="ALL">Tất cả cán bộ</option>
                  {staff && staff.map((s: any, idx: number) => (
                    <option key={s.id || `staff-${idx}`} value={s.id || ''}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <User size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* NÚT ĐẶT LẠI BỘ LỌC (RESET) */}
          <button
            type="button"
            onClick={onReset}
            title="Đặt lại toàn bộ bộ lọc và thẻ KPI về mặc định"
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer shrink-0 ${
              isFiltered
                ? 'text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100'
                : 'text-slate-600 hover:text-[#004182] bg-white hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <RotateCcw size={15} />
            <span className="inline">Đặt lại</span>
            {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
          </button>
        </div>
      </div>

      {/* HÀNG 2: BỘ ĐIỀU KHIỂN THỜI GIAN TÁC NGHIỆP (AccountingPeriodController) */}
      <div className="pt-2.5 border-t border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
        <div className="w-full">
          <AccountingPeriodController
            value={toPeriodFilterValue(filterState)}
            onChange={newVal => {
              setFilterState(prev => ({
                ...prev,
                ...fromPeriodFilterValue(newVal)
              }));
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FinanceFilterBar;
