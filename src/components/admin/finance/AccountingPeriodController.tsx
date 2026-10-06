import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react';
import type { PeriodFilterValue } from '../../../utils/transactionFilters';

export interface AccountingPeriodControllerProps {
  value: PeriodFilterValue;
  onChange: (val: PeriodFilterValue) => void;
  className?: string;
}

export const AccountingPeriodController: React.FC<AccountingPeriodControllerProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Lấy năm và tháng hiện tại của hệ thống để làm mốc tham chiếu
  const { todayStr, currentMonthStr, systemYear, systemMonth } = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = now.getMonth() + 1;
    const dd = now.getDate();
    return {
      todayStr: `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`,
      currentMonthStr: `${yyyy}-${String(mm).padStart(2, '0')}`,
      systemYear: yyyy,
      systemMonth: mm
    };
  }, []);

  // Năm đang được duyệt trên bảng chọn nhanh 12 tháng (Month Picker Grid)
  const [gridYear, setGridYear] = useState<number>(() => {
    if (value.selectedMonth && value.selectedMonth.includes('-')) {
      const parsedYear = parseInt(value.selectedMonth.split('-')[0] ?? '', 10);
      if (!isNaN(parsedYear)) return parsedYear;
    }
    return new Date().getFullYear();
  });

  // Đồng bộ gridYear khi value.selectedMonth thay đổi từ bên ngoài (ví dụ khi bấm Reset)
  useEffect(() => {
    if (value.selectedMonth && value.selectedMonth.includes('-')) {
      const parsedYear = parseInt(value.selectedMonth.split('-')[0] ?? '', 10);
      if (!isNaN(parsedYear)) setGridYear(parsedYear);
    }
  }, [value.selectedMonth]);

  // Đóng bảng chọn nhanh khi nhấp chuột ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsMonthPickerOpen(false);
      }
    };
    if (isMonthPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMonthPickerOpen]);

  // Chuyển đổi nhãn hiển thị định dạng Tháng MM/YYYY
  const displayMonthLabel = useMemo(() => {
    const mStr = value.selectedMonth || currentMonthStr;
    const [y = '', m = ''] = mStr.split('-');
    return `Tháng ${String(m).padStart(2, '0')}/${y}`;
  }, [value.selectedMonth, currentMonthStr]);

  // 1. Logic điều hướng tháng (Lùi 1 tháng / Tiến 1 tháng)
  const handleStepMonth = (direction: 'prev' | 'next') => {
    const mStr = value.selectedMonth || currentMonthStr;
    const [yStr = '', mStrNum = ''] = mStr.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStrNum, 10);

    if (direction === 'prev') {
      if (m === 1) {
        m = 12;
        y -= 1;
      } else {
        m -= 1;
      }
    } else {
      if (m === 12) {
        m = 1;
        y += 1;
      } else {
        m += 1;
      }
    }

    const newSelected = `${y}-${String(m).padStart(2, '0')}`;
    setGridYear(y);
    onChange({
      ...value,
      mode: 'MONTH',
      selectedMonth: newSelected
    });
  };

  // Chọn nhanh một tháng trong bảng 12 tháng
  const handleSelectMonthInGrid = (monthNum: number) => {
    const newSelected = `${gridYear}-${String(monthNum).padStart(2, '0')}`;
    onChange({
      ...value,
      mode: 'MONTH',
      selectedMonth: newSelected
    });
    setIsMonthPickerOpen(false);
  };

  // 2. Logic phím tắt chọn nhanh khoảng ngày (Quick Tags)
  const handleQuickRange = (tag: 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH') => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = now.getMonth() + 1;

    let start = '';
    let end = todayStr;

    if (tag === 'TODAY') {
      start = todayStr;
      end = todayStr;
    } else if (tag === 'LAST_7_DAYS') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const py = past.getFullYear();
      const pm = String(past.getMonth() + 1).padStart(2, '0');
      const pd = String(past.getDate()).padStart(2, '0');
      start = `${py}-${pm}-${pd}`;
      end = todayStr;
    } else if (tag === 'THIS_MONTH') {
      start = `${yyyy}-${String(mm).padStart(2, '0')}-01`;
      const lastDay = new Date(yyyy, mm, 0).getDate();
      end = `${yyyy}-${String(mm).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    onChange({
      ...value,
      mode: 'RANGE',
      startDate: start,
      endDate: end
    });
  };

  // Kiểm tra phím tắt khoảng ngày nào đang được kích hoạt
  const activeQuickTag = useMemo(() => {
    if (value.mode !== 'RANGE' || !value.startDate || !value.endDate) return null;
    if (value.startDate === todayStr && value.endDate === todayStr) return 'TODAY';
    
    // Kiểm tra 7 ngày qua
    const past = new Date();
    past.setDate(past.getDate() - 6);
    const py = past.getFullYear();
    const pm = String(past.getMonth() + 1).padStart(2, '0');
    const pd = String(past.getDate()).padStart(2, '0');
    const last7Str = `${py}-${pm}-${pd}`;
    if (value.startDate === last7Str && value.endDate === todayStr) return 'LAST_7_DAYS';

    // Kiểm tra Tháng này
    const now = new Date();
    const startM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    if (value.startDate === startM && value.endDate === endM) return 'THIS_MONTH';

    return null;
  }, [value.mode, value.startDate, value.endDate, todayStr]);

  return (
    <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-3 w-full ${className}`}>
      {/* 1. CỤM PHÂN ĐOẠN CHỌN CHẾ ĐỘ (Segmented Tabs) */}
      <div 
        id="accounting-period-segmented-tabs"
        className="inline-flex items-center p-1 bg-gray-100/90 rounded-xl border border-gray-200/80 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start"
        role="tablist"
      >
        <button
          type="button"
          id="period-tab-month"
          role="tab"
          aria-selected={value.mode === 'MONTH'}
          onClick={() => onChange({ ...value, mode: 'MONTH' })}
          className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            value.mode === 'MONTH'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          Theo Tháng
        </button>

        <button
          type="button"
          id="period-tab-range"
          role="tab"
          aria-selected={value.mode === 'RANGE'}
          onClick={() => {
            const start = value.startDate || `${currentMonthStr}-01`;
            const end = value.endDate || todayStr;
            onChange({ ...value, mode: 'RANGE', startDate: start, endDate: end });
          }}
          className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            value.mode === 'RANGE'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          Khoảng Ngày
        </button>

        <button
          type="button"
          id="period-tab-all"
          role="tab"
          aria-selected={value.mode === 'ALL'}
          onClick={() => onChange({ ...value, mode: 'ALL' })}
          className={`flex-1 sm:flex-initial text-center px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
            value.mode === 'ALL'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          Tất Cả
        </button>
      </div>

      {/* 2. BỘ NHẬP LIỆU ĐỘNG TƯƠNG ỨNG THEO CHẾ ĐỘ (Dynamic Contextual Picker) */}
      <div className="flex-1 min-w-0 flex items-center flex-wrap gap-2 w-full sm:w-auto">
        {/* CHẾ ĐỘ A: THEO THÁNG */}
        {value.mode === 'MONTH' && (
          <div className="relative inline-flex items-center" ref={pickerRef}>
            <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              <button
                type="button"
                id="btn-period-prev-month"
                onClick={() => handleStepMonth('prev')}
                title="Lùi 1 tháng"
                className="p-1.5 text-slate-500 hover:text-[#004182] hover:bg-blue-50 transition border-r border-slate-200 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                type="button"
                id="btn-period-month-picker"
                onClick={() => setIsMonthPickerOpen(prev => !prev)}
                title="Nhấp để mở bảng chọn 12 tháng"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold text-[#004182] hover:bg-blue-50/70 transition cursor-pointer"
              >
                <Calendar size={14} className="text-[#004182] shrink-0" />
                <span>{displayMonthLabel}</span>
              </button>

              <button
                type="button"
                id="btn-period-next-month"
                onClick={() => handleStepMonth('next')}
                title="Tiến 1 tháng"
                className="p-1.5 text-slate-500 hover:text-[#004182] hover:bg-blue-50 transition border-l border-slate-200 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* BẢNG CHỌN NHANH 12 THÁNG (Month Picker Grid Popover) */}
            {isMonthPickerOpen && (
              <div 
                id="month-picker-grid-popover"
                className="absolute left-0 top-full mt-2 w-64 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Thanh chọn năm */}
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => setGridYear(y => y - 1)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                    title="Năm trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs sm:text-sm font-bold text-gray-800">
                    Năm {gridYear}
                  </span>
                  <button
                    type="button"
                    onClick={() => setGridYear(y => y + 1)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                    title="Năm sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                {/* Lưới 12 tháng */}
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(monthNum => {
                    const monthKey = `${gridYear}-${String(monthNum).padStart(2, '0')}`;
                    const isSelected = value.selectedMonth === monthKey;
                    const isCurrent = gridYear === systemYear && monthNum === systemMonth;

                    return (
                      <button
                        key={monthNum}
                        type="button"
                        onClick={() => handleSelectMonthInGrid(monthNum)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer relative ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isCurrent
                            ? 'bg-blue-50 text-[#004182] border border-blue-200 hover:bg-blue-100'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Th.{monthNum}
                        {isCurrent && !isSelected && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Nút tắt nhanh về tháng hiện tại */}
                <div className="mt-2.5 pt-2 border-t border-gray-100 flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        ...value,
                        mode: 'MONTH',
                        selectedMonth: currentMonthStr
                      });
                      setGridYear(systemYear);
                      setIsMonthPickerOpen(false);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                  >
                    Tháng này (Th.{systemMonth}/{systemYear})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMonthPickerOpen(false)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CHẾ ĐỘ B: KHOẢNG NGÀY */}
        {value.mode === 'RANGE' && (
          <div className="flex flex-wrap items-center gap-2">
            {/* 2 Ô nhập liệu Từ ngày - Đến ngày */}
            <div className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 shadow-xs">
              <label htmlFor="period-start-date" className="text-xs font-bold text-gray-500 shrink-0">Từ:</label>
              <input
                type="date"
                id="period-start-date"
                value={value.startDate || ''}
                onChange={e => onChange({ ...value, mode: 'RANGE', startDate: e.target.value })}
                className="text-xs font-semibold text-gray-800 bg-transparent outline-none cursor-pointer p-0.5"
                title="Từ ngày: DD/MM/YYYY"
              />
              <span className="text-gray-300 font-bold px-0.5">-</span>
              <label htmlFor="period-end-date" className="text-xs font-bold text-gray-500 shrink-0">Đến:</label>
              <input
                type="date"
                id="period-end-date"
                value={value.endDate || ''}
                onChange={e => onChange({ ...value, mode: 'RANGE', endDate: e.target.value })}
                className="text-xs font-semibold text-gray-800 bg-transparent outline-none cursor-pointer p-0.5"
                title="Đến ngày: DD/MM/YYYY"
              />
            </div>

            {/* CÁC CHIP CHỌN NHANH (Quick Tags) */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                id="quick-tag-today"
                onClick={() => handleQuickRange('TODAY')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border whitespace-nowrap ${
                  activeQuickTag === 'TODAY'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Hôm nay
              </button>

              <button
                type="button"
                id="quick-tag-7days"
                onClick={() => handleQuickRange('LAST_7_DAYS')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border whitespace-nowrap ${
                  activeQuickTag === 'LAST_7_DAYS'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                7 ngày qua
              </button>

              <button
                type="button"
                id="quick-tag-month"
                onClick={() => handleQuickRange('THIS_MONTH')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border whitespace-nowrap ${
                  activeQuickTag === 'THIS_MONTH'
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Tháng này
              </button>
            </div>
          </div>
        )}

        {/* CHẾ ĐỘ C: TẤT CẢ */}
        {value.mode === 'ALL' && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100/90 rounded-xl border border-gray-200/80 text-xs sm:text-sm text-gray-600 font-medium">
            <Clock size={14} className="text-gray-400 shrink-0" />
            <span>Toàn bộ thời gian (Không giới hạn)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountingPeriodController;
