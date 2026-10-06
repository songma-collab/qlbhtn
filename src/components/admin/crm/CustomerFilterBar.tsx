import React from 'react';
import { ShieldCheck, Layers } from 'lucide-react';
import { RecordFilterToolbar } from '../RecordFilterToolbar';
import type { RecordFilterState } from '../../../utils/recordFilters';

export interface CustomerFilterBarProps {
  isPIIMasked: boolean;
  detectedSearchType: { label: string; color: string } | null;
  filterState: RecordFilterState;
  updateFilter: (updates: Partial<RecordFilterState>) => void;
  resetFilters: () => void;
  quickPillCounts: any;
  staff: any[];
  submissionBatches: string[];
  isAdminOrManager: boolean;
  setCurrentPage: (page: number) => void;
  filteredCount: number;
  directoryStats: { total: number; active: number; stopped: number };
  useVirtualization: boolean;
  setUseVirtualization: React.Dispatch<React.SetStateAction<boolean>>;
}

export const CustomerFilterBar: React.FC<CustomerFilterBarProps> = ({
  isPIIMasked,
  detectedSearchType,
  filterState,
  updateFilter,
  resetFilters,
  quickPillCounts,
  staff,
  submissionBatches,
  isAdminOrManager,
  setCurrentPage,
  filteredCount,
  directoryStats,
  useVirtualization,
  setUseVirtualization
}) => {
  return (
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

      {/* Toolbar bộ lọc 2 tầng */}
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
            Tổng tìm thấy: <strong className="text-slate-900 font-semibold">{filteredCount}</strong> khách hàng
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
    </div>
  );
};
