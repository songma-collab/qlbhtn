import React from 'react';
import { Search, X, RotateCcw, Send, Clock, AlertTriangle, Layers } from 'lucide-react';
import { RecordFilterState } from '../../utils/recordFilters';

interface RecordFilterToolbarProps {
  filterState: RecordFilterState;
  onFilterChange: (updates: Partial<RecordFilterState>) => void;
  onReset: () => void;
  quickPillCounts: {
    ALL: number;
    UNSUBMITTED: number;
    UPCOMING_RENEWAL: number;
    PENDING_PAYMENT: number;
  };
  staffList: Array<{ id: string; name: string }>;
  submissionBatches: string[];
  isAdminOrManager: boolean;
  onPageReset?: () => void;
}

export const RecordFilterToolbar: React.FC<RecordFilterToolbarProps> = ({
  filterState,
  onFilterChange,
  onReset,
  quickPillCounts,
  staffList,
  submissionBatches,
  isAdminOrManager,
  onPageReset
}) => {
  const handlePillClick = (pill: RecordFilterState['quickPill']) => {
    onFilterChange({ quickPill: pill });
    if (onPageReset) onPageReset();
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ searchQuery: e.target.value });
    if (onPageReset) onPageReset();
  };

  const handleClearSearch = () => {
    onFilterChange({ searchQuery: '' });
    if (onPageReset) onPageReset();
  };

  return (
    <div id="record-filter-toolbar" className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col gap-3">
      {/* ================= TẦNG 1: THANH TÁC NGHIỆP NHANH (QUICK FILTER PILLS) ================= */}
      <div id="quick-filter-pills-bar" className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
        {/* Pill 1: Tất cả */}
        <button
          id="quick-pill-all"
          type="button"
          onClick={() => handlePillClick('ALL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
            filterState.quickPill === 'ALL'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
        >
          <Layers size={14} className={filterState.quickPill === 'ALL' ? 'text-white' : 'text-slate-500'} />
          <span>Tất cả</span>
          <span
            className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${
              filterState.quickPill === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {quickPillCounts.ALL}
          </span>
        </button>

        {/* Pill 2: Chưa nộp BHXH */}
        <button
          id="quick-pill-unsubmitted"
          type="button"
          onClick={() => handlePillClick('UNSUBMITTED')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
            filterState.quickPill === 'UNSUBMITTED'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Hồ sơ đã thu tiền nhưng chưa chuyển nộp cơ quan BHXH"
        >
          <Send size={14} className={filterState.quickPill === 'UNSUBMITTED' ? 'text-white' : 'text-blue-600'} />
          <span>Chưa nộp BHXH</span>
          <span
            className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${
              filterState.quickPill === 'UNSUBMITTED' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
            }`}
          >
            {quickPillCounts.UNSUBMITTED}
          </span>
        </button>

        {/* Pill 3: Đến hạn đôn đốc */}
        <button
          id="quick-pill-renewal"
          type="button"
          onClick={() => handlePillClick('UPCOMING_RENEWAL')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
            filterState.quickPill === 'UPCOMING_RENEWAL'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Hồ sơ đến hạn trong vòng 30 ngày tới (đã loại trừ khách hàng đã dừng đóng)"
        >
          <Clock size={14} className={filterState.quickPill === 'UPCOMING_RENEWAL' ? 'text-white' : 'text-amber-500'} />
          <span>Đến hạn đôn đốc</span>
          <span
            className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${
              filterState.quickPill === 'UPCOMING_RENEWAL' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
            }`}
          >
            {quickPillCounts.UPCOMING_RENEWAL}
          </span>
        </button>

        {/* Pill 4: Chờ thanh toán */}
        <button
          id="quick-pill-pending"
          type="button"
          onClick={() => handlePillClick('PENDING_PAYMENT')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer ${
            filterState.quickPill === 'PENDING_PAYMENT'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
          }`}
          title="Hồ sơ đang ở trạng thái Chờ thanh toán"
        >
          <AlertTriangle size={14} className={filterState.quickPill === 'PENDING_PAYMENT' ? 'text-white' : 'text-orange-500'} />
          <span>Chờ thanh toán</span>
          <span
            className={`px-1.5 py-0.5 rounded-lg text-[11px] font-bold ${
              filterState.quickPill === 'PENDING_PAYMENT' ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-700'
            }`}
          >
            {quickPillCounts.PENDING_PAYMENT}
          </span>
        </button>
      </div>

      {/* ================= TẦNG 2: HÀNG ĐIỀU KHIỂN ĐA CHIỀU CHI TIẾT (DETAILED FILTER BAR) ================= */}
      <div id="detailed-filter-bar" className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {/* 1. Ô Tìm kiếm tổng hợp (Search Input) với Debounce & Nút xóa nhanh */}
        <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            id="record-search-input"
            type="text"
            value={filterState.searchQuery}
            onChange={handleSearchChange}
            placeholder="Tìm tên, CCCD/ĐDCN, Mã BHXH, SĐT..."
            className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-white outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] text-xs sm:text-sm text-slate-800 transition-all placeholder:text-slate-400"
          />
          {filterState.searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100"
              title="Xóa tìm kiếm"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* 2. Trạng thái Khách hàng (Customer Status Dropdown) */}
        <select
          id="filter-customer-status"
          value={filterState.customerStatus}
          onChange={e => {
            onFilterChange({ customerStatus: e.target.value as RecordFilterState['customerStatus'] });
            if (onPageReset) onPageReset();
          }}
          className="h-10 flex-1 min-w-[150px] sm:min-w-[160px] px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] text-xs sm:text-sm transition-all"
        >
          <option value="ALL">Tất cả trạng thái KH</option>
          <option value="Đang tham gia">🟢 Đang tham gia</option>
          <option value="Đã dừng đóng">⏸️ Đã dừng đóng</option>
        </select>

        {/* 3. Trạng thái nộp BHXH (Submission Status Dropdown kèm đợt nộp động) */}
        <select
          id="filter-submission-status"
          value={filterState.submissionFilter}
          onChange={e => {
            onFilterChange({ submissionFilter: e.target.value });
            if (onPageReset) onPageReset();
          }}
          className="h-10 flex-1 min-w-[155px] sm:min-w-[170px] px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] text-xs sm:text-sm transition-all"
        >
          <option value="ALL">Tất cả nộp BHXH</option>
          <option value="UNSUBMITTED">⏳ Chưa chuyển BHXH</option>
          <option value="SUBMITTED">✅ Đã chuyển BHXH</option>
          {submissionBatches.length > 0 && (
            <optgroup label="Theo Đợt nộp cụ thể">
              {submissionBatches.map(batch => (
                <option key={batch} value={batch}>
                  📦 Đợt: {batch}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {/* 4. Kỳ kê khai / Thời gian (Time Period Dropdown) */}
        <select
          id="filter-period-type"
          value={filterState.periodType}
          onChange={e => {
            onFilterChange({ periodType: e.target.value as RecordFilterState['periodType'] });
            if (onPageReset) onPageReset();
          }}
          className="h-10 flex-1 min-w-[140px] sm:min-w-[150px] px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] text-xs sm:text-sm transition-all"
        >
          <option value="ALL">Toàn bộ thời gian</option>
          <option value="CURRENT_MONTH">Tháng hiện tại</option>
          <option value="PREV_MONTH">Tháng trước</option>
          <option value="CURRENT_QUARTER">Quý này</option>
          <option value="CUSTOM">Tùy chọn khoảng ngày</option>
        </select>

        {/* Khoảng ngày tùy chọn (khi chọn periodType === 'CUSTOM') */}
        {filterState.periodType === 'CUSTOM' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <input
              id="filter-custom-start-date"
              type="date"
              value={filterState.customStartDate || ''}
              onChange={e => {
                onFilterChange({ customStartDate: e.target.value });
                if (onPageReset) onPageReset();
              }}
              title="Từ ngày"
              className="h-10 px-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white outline-none focus:border-[#004182] text-slate-800"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              id="filter-custom-end-date"
              type="date"
              value={filterState.customEndDate || ''}
              onChange={e => {
                onFilterChange({ customEndDate: e.target.value });
                if (onPageReset) onPageReset();
              }}
              title="Đến ngày"
              className="h-10 px-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white outline-none focus:border-[#004182] text-slate-800"
            />
          </div>
        )}

        {/* 5. Cán bộ thu (Staff Dropdown - Chỉ hiển thị cho Admin / Quản lý) */}
        {isAdminOrManager && (
          <select
            id="filter-staff-id"
            value={filterState.staffId}
            onChange={e => {
              onFilterChange({ staffId: e.target.value });
              if (onPageReset) onPageReset();
            }}
            className="h-10 flex-1 min-w-[140px] sm:min-w-[150px] px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 outline-none focus:border-[#004182] focus:ring-1 focus:ring-[#004182] text-xs sm:text-sm transition-all"
          >
            <option value="ALL">Tất cả nhân viên</option>
            <option value="admin">Admin (Tự đăng ký)</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {/* 6. Nút Đặt lại bộ lọc (Reset Filters) */}
        <button
          id="btn-reset-filters"
          type="button"
          onClick={() => {
            onReset();
            if (onPageReset) onPageReset();
          }}
          className="h-10 w-10 text-slate-500 hover:text-[#004182] bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition shadow-xs flex items-center justify-center shrink-0 cursor-pointer"
          title="Đặt lại bộ lọc về mặc định"
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
};
