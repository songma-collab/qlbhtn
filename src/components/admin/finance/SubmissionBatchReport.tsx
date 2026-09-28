import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { formatMoney } from '../../../utils/helpers';
import type { RecordType } from '../../../context/types';
import { 
  FileCheck, 
  Search, 
  FileDown, 
  Calendar, 
  DollarSign, 
  Layers, 
  Eye, 
  X, 
  Clock, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  type SubmissionPeriodMode,
  type BatchDetailData,
  getDefaultPeriodState,
  batchMatchesPeriod,
  calculateBatchKPIs,
  getPeriodDisplayLabel,
  stepMonth,
  groupRecordsIntoBatches
} from '../../../utils/submissionBatchFilters';

export type { BatchDetailData };

interface SubmissionBatchReportProps {
  typeFilter?: 'BHXH' | 'BHYT' | 'ALL';
}

export const SubmissionBatchReport: React.FC<SubmissionBatchReportProps> = ({ typeFilter = 'ALL' }) => {
  const { records, staff } = useAppContext();
  
  // Mặc định kỳ thời gian là Tháng hiện tại của lịch hệ thống
  const defaultState = useMemo(() => getDefaultPeriodState(), []);
  const [periodMode, setPeriodMode] = useState<SubmissionPeriodMode>(defaultState.periodMode);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultState.selectedMonth);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(defaultState.selectedQuarter);
  const [selectedYear, setSelectedYear] = useState<number>(defaultState.selectedYear);

  const [searchTxt, setSearchTxt] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUBMITTED' | 'UNSUBMITTED'>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<BatchDetailData | null>(null);
  const [modalSearchTxt, setModalSearchTxt] = useState('');

  const currentMonthStr = defaultState.selectedMonth;
  const currentYear = defaultState.selectedYear;

  // Danh sách các năm có phát sinh dữ liệu hoặc năm hiện tại
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentYear);
    records.forEach(r => {
      const d = r.submittedDate || r.date;
      if (d && d.length >= 4) {
        const y = parseInt(d.substring(0, 4), 10);
        if (!isNaN(y)) set.add(y);
      }
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [records, currentYear]);

  // Danh sách các tháng có phát sinh dữ liệu + các tháng trong năm được chọn / năm hiện tại
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(currentMonthStr);
    if (selectedMonth) set.add(selectedMonth);

    records.forEach(r => {
      const d = r.submittedDate || r.date;
      if (d && d.length >= 7) {
        set.add(d.substring(0, 7));
      }
    });

    // Bổ sung đầy đủ 12 tháng của năm hiện tại và năm đang duyệt để dễ chọn
    const [selY] = selectedMonth.split('-');
    const activeYears = new Set([currentYear, parseInt(selY, 10) || currentYear]);
    activeYears.forEach(y => {
      for (let m = 1; m <= 12; m++) {
        set.add(`${y}-${String(m).padStart(2, '0')}`);
      }
    });

    return Array.from(set).sort().reverse();
  }, [records, currentMonthStr, selectedMonth, currentYear]);

  // Gom nhóm danh sách hồ sơ thành các đợt nộp
  const batches = useMemo(() => {
    return groupRecordsIntoBatches(records, typeFilter);
  }, [records, typeFilter]);

  // Lọc các đợt theo kỳ được chọn (Tháng / Quý / Năm / Toàn thời gian)
  const periodBatches = useMemo(() => {
    return batches.filter(b => batchMatchesPeriod(b, periodMode, selectedMonth, selectedQuarter, selectedYear));
  }, [batches, periodMode, selectedMonth, selectedQuarter, selectedYear]);

  // Bộ lọc danh sách đợt nộp cho bảng (kết hợp kỳ + tìm kiếm + trạng thái nộp)
  const filteredBatches = useMemo(() => {
    return periodBatches.filter(b => {
      const matchSearch = !searchTxt.trim() ||
                          b.batchName.toLowerCase().includes(searchTxt.toLowerCase()) ||
                          b.submittedDate.includes(searchTxt);
      const matchStatus = statusFilter === 'ALL' ||
                          (statusFilter === 'SUBMITTED' && b.isSubmitted) ||
                          (statusFilter === 'UNSUBMITTED' && !b.isSubmitted);
      return matchSearch && matchStatus;
    });
  }, [periodBatches, searchTxt, statusFilter]);

  // Nhãn hiển thị kỳ báo cáo (VD: "Tháng 09/2026", "Quý 3/2026", "Năm 2026")
  const periodLabel = useMemo(() => {
    return getPeriodDisplayLabel(periodMode, selectedMonth, selectedQuarter, selectedYear);
  }, [periodMode, selectedMonth, selectedQuarter, selectedYear]);

  // KPI Summary đồng bộ chính xác theo kỳ đang chọn (Tháng / Quý / Năm / Toàn thời gian)
  const kpis = useMemo(() => {
    return calculateBatchKPIs(periodBatches);
  }, [periodBatches]);

  // Xuất file Excel Bảng tổng hợp các đợt nộp BHXH / BHYT
  const exportBatchesExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // Sheet 1: Bảng tổng hợp đợt nộp
      const summaryRows = filteredBatches.map((b, idx) => ({
        "STT": idx + 1,
        "Tên đợt chuyển": b.batchName,
        "Ngày chuyển nộp": b.submittedDate,
        "Trạng thái": b.isSubmitted ? "Đã chuyển cơ quan BHXH" : "Chưa chuyển (Tồn đọng)",
        "Số hồ sơ BHXH": b.bhxhCount,
        "Số hồ sơ BHYT": b.bhytCount,
        "Tổng số hồ sơ": b.totalRecords,
        "Tổng số tiền thực nộp (VNĐ)": b.totalAmount,
        "Số cán bộ thu tham gia": b.participatingStaffCount
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Tong_Hop_Dot_Nop");

      // Sheet 2: Danh sách chi tiết từng hồ sơ trong các đợt đã lọc
      const detailRows: any[] = [];
      filteredBatches.forEach(b => {
        b.records.forEach((r, rIdx) => {
          const staffObj = staff.find(s => s.id === r.staffId || s.username === r.staffId);
          detailRows.push({
            "Đợt chuyển": b.batchName,
            "Ngày chuyển": b.submittedDate,
            "STT": rIdx + 1,
            "Họ và tên người tham gia": r.name,
            "Số CCCD": r.cccd || '',
            "Số điện thoại": r.phone || '',
            "Mã số BHXH": r.bhxh || r.old_bhxh || r.oldBhxh || '',
            "Loại hình": r.type,
            "Phương thức/Thời hạn (tháng)": r.months,
            "Số tiền đóng (VNĐ)": r.amount,
            "Ngày thu tiền": r.date,
            "Cán bộ thu": staffObj ? staffObj.name : (r.staffId || 'N/A')
          });
        });
      });

      if (detailRows.length > 0) {
        const wsDetails = XLSX.utils.json_to_sheet(detailRows);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Chi_Tiet_Tung_Ho_So");
      }

      const safePeriodName = periodLabel.replace(/[\s/]+/g, '_');
      const safeType = typeFilter !== 'ALL' ? typeFilter : 'BHXH_BHYT';
      XLSX.writeFile(wb, `Thong_ke_dot_chuyen_${safeType}_${safePeriodName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Lỗi xuất Excel đợt nộp:", err);
    }
  };

  // Xuất riêng một đợt nộp được chọn
  const exportSingleBatchExcel = async (batch: BatchDetailData) => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      const detailRows = batch.records.map((r, idx) => {
        const staffObj = staff.find(s => s.id === r.staffId || s.username === r.staffId);
        return {
          "STT": idx + 1,
          "Họ và tên người tham gia": r.name,
          "Số CCCD / CMND": r.cccd || '',
          "Mã số BHXH": r.bhxh || r.old_bhxh || r.oldBhxh || '',
          "Số điện thoại": r.phone || '',
          "Địa chỉ": r.address || '',
          "Loại hình": r.type,
          "Số tháng đóng": r.months,
          "Số tiền thực đóng (VNĐ)": r.amount,
          "Ngày biên lai": r.date,
          "Cán bộ thu": staffObj ? staffObj.name : (r.staffId || 'N/A')
        };
      });

      const ws = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Ho_So");
      XLSX.writeFile(wb, `Bang_ke_${batch.batchName}_${batch.submittedDate.replace(/[\s/]+/g, '-')}.xlsx`);
    } catch (err) {
      console.error("Lỗi xuất Excel đợt lẻ:", err);
    }
  };

  // Lọc hồ sơ trong modal xem chi tiết đợt nộp
  const modalFilteredRecords = useMemo(() => {
    if (!selectedBatch) return [];
    return selectedBatch.records.filter(r => {
      return r.name.toLowerCase().includes(modalSearchTxt.toLowerCase()) ||
             (r.cccd && r.cccd.includes(modalSearchTxt)) ||
             (r.bhxh && r.bhxh.includes(modalSearchTxt)) ||
             (r.phone && r.phone.includes(modalSearchTxt));
    });
  }, [selectedBatch, modalSearchTxt]);

  return (
    <div className="space-y-6">
      {/* Header & Filter Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="text-[#004182]" size={24} />
            Thống Kê Đợt Chuyển Hồ Sơ & Tiền {typeFilter !== 'ALL' ? `(${typeFilter})` : 'Cho Cơ Quan BHXH'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Theo dõi tổng số đợt nộp kỳ <span className="font-bold text-[#004182]">{periodLabel}</span>, ngày bàn giao, tổng tiền và danh sách hồ sơ từng đợt đối soát.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Tìm kiếm */}
          <div className="relative flex-1 sm:w-48 min-w-[150px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={searchTxt}
              onChange={e => setSearchTxt(e.target.value)}
              placeholder="Tìm tên đợt, ngày..."
              className="w-full pl-8 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:border-[#0ea5e9] outline-none"
            />
          </div>

          {/* Chọn Chế Độ Kỳ (Tháng / Quý / Năm / Toàn thời gian) */}
          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1">
            <Calendar size={15} className="text-[#004182] ml-1.5 mr-1 shrink-0" />
            <select
              value={periodMode}
              onChange={e => setPeriodMode(e.target.value as SubmissionPeriodMode)}
              className="text-xs sm:text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer py-1 pr-1"
              title="Chọn chế độ thời gian"
            >
              <option value="MONTH">Theo Tháng</option>
              <option value="QUARTER">Theo Quý</option>
              <option value="YEAR">Theo Năm</option>
              <option value="ALL">Toàn thời gian</option>
            </select>
          </div>

          {/* Bộ chọn chi tiết tương ứng theo Chế Độ */}
          {periodMode === 'MONTH' && (
            <div className="flex items-center bg-white rounded-xl border border-gray-200 p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => stepMonth(prev, 'prev'))}
                title="Lùi 1 tháng"
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs sm:text-sm font-bold text-[#004182] bg-transparent outline-none cursor-pointer py-1 px-1"
              >
                {monthOptions.map(m => (
                  <option key={m} value={m}>
                    Tháng {m.slice(5, 7)}/{m.slice(0, 4)} {m === currentMonthStr ? '(Hiện tại)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSelectedMonth(prev => stepMonth(prev, 'next'))}
                title="Tiến 1 tháng"
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {periodMode === 'QUARTER' && (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedQuarter}
                onChange={e => setSelectedQuarter(Number(e.target.value))}
                className="p-2 text-xs sm:text-sm font-bold text-[#004182] rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9] cursor-pointer"
              >
                <option value={1}>Quý 1 (T1 - T3)</option>
                <option value={2}>Quý 2 (T4 - T6)</option>
                <option value={3}>Quý 3 (T7 - T9)</option>
                <option value={4}>Quý 4 (T10 - T12)</option>
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="p-2 text-xs sm:text-sm font-bold text-[#004182] rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9] cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>Năm {y} {y === currentYear ? '(Hiện tại)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          {periodMode === 'YEAR' && (
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="p-2 text-xs sm:text-sm font-bold text-[#004182] rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9] cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>Năm {y} {y === currentYear ? '(Hiện tại)' : ''}</option>
              ))}
            </select>
          )}

          {/* Trạng thái */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="p-2 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9] cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="SUBMITTED">Đã nộp cơ quan BHXH</option>
            <option value="UNSUBMITTED">Chưa nộp (Chờ nộp)</option>
          </select>

          {/* Xuất Báo Cáo */}
          <button
            onClick={exportBatchesExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 cursor-pointer"
            title={`Xuất Excel danh sách đợt nộp kỳ ${periodLabel}`}
          >
            <FileDown size={16} /> Xuất Báo Cáo
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#004182] flex items-center justify-center shrink-0 font-bold">
            <Layers size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng số đợt nộp</span>
            <h4 className="text-xl sm:text-2xl font-bold text-slate-900">{kpis.totalSubmittedBatches} đợt</h4>
            <span className="text-[11px] text-slate-400">Đã chốt ({periodLabel})</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-bold">
            <FileCheck size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Hồ sơ đã chuyển</span>
            <h4 className="text-xl sm:text-2xl font-bold text-emerald-700">{kpis.totalSubmittedRecords.toLocaleString()}</h4>
            <span className="text-[11px] text-slate-400">Người tham gia ({periodLabel})</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#004182] flex items-center justify-center shrink-0 font-bold">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Tổng tiền đã nộp</span>
            <h4 className="text-base sm:text-lg font-bold text-slate-900 truncate" title={formatMoney(kpis.totalSubmittedAmount)}>
              {formatMoney(kpis.totalSubmittedAmount)}
            </h4>
            <span className="text-[11px] text-slate-400">Nộp ngân sách ({periodLabel})</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 font-bold">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Chưa nộp (Tồn đọng)</span>
            <h4 className="text-xl sm:text-2xl font-bold text-amber-700">{kpis.pendingRecords} hồ sơ</h4>
            <span className="text-[11px] text-amber-600/80 font-medium">{formatMoney(kpis.pendingAmount)} ({periodLabel})</span>
          </div>
        </div>
      </div>

      {/* Bảng danh sách đợt nộp */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
          <h4 className="text-sm font-bold text-slate-800">
            Danh Sách Các Đợt Chuyển {typeFilter !== 'ALL' ? typeFilter : 'BHXH / BHYT'} ({periodLabel} - {filteredBatches.length} đợt)
          </h4>
          <span className="text-xs text-slate-500 italic">Nhấn "Xem Chi Tiết" để đối soát từng hồ sơ</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="p-3 sm:p-4 text-center">STT</th>
                <th className="p-3 sm:p-4">Tên / Mã Đợt Nộp</th>
                <th className="p-3 sm:p-4 text-center">Ngày Chuyển BHXH</th>
                <th className="p-3 sm:p-4 text-center">Tổng Hồ Sơ</th>
                <th className="p-3 sm:p-4 text-center">BHXH</th>
                <th className="p-3 sm:p-4 text-center">BHYT</th>
                <th className="p-3 sm:p-4 text-right">Tổng Tiền Nộp BHXH</th>
                <th className="p-3 sm:p-4 text-center">Cán Bộ Thu</th>
                <th className="p-3 sm:p-4 text-center">Trạng Thái</th>
                <th className="p-3 sm:p-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-400">
                    Không tìm thấy đợt nộp nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b, idx) => (
                  <tr key={b.batchKey} className="hover:bg-blue-50/40 transition">
                    <td className="p-3 sm:p-4 text-center font-mono text-gray-500">{idx + 1}</td>
                    <td className="p-3 sm:p-4 font-bold text-gray-800">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-[#0ea5e9]" />
                        <span className="font-mono text-[#004182] font-black">{b.batchName}</span>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 text-center font-mono text-gray-600">
                      {b.submittedDate !== 'Chưa nộp' ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} className="text-gray-400" /> {b.submittedDate}
                        </span>
                      ) : (
                        <span className="text-amber-600 italic">Chưa bàn giao</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-bold">
                      <span className="px-2.5 py-1 rounded-full text-xs bg-blue-100 text-[#004182]">
                        {b.totalRecords}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center font-semibold text-[#004182]">
                      {b.bhxhCount}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-semibold text-[#0ea5e9]">
                      {b.bhytCount}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-black text-amber-700">
                      {formatMoney(b.totalAmount)}
                    </td>
                    <td className="p-3 sm:p-4 text-center text-gray-600">
                      {b.participatingStaffCount} người
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                        b.isSubmitted 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {b.isSubmitted ? <FileCheck size={12} /> : <Clock size={12} />}
                        {b.isSubmitted ? 'Đã nộp BHXH' : 'Chờ bàn giao'}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedBatch(b)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#004182] font-bold text-xs rounded-xl flex items-center gap-1 transition cursor-pointer"
                          title="Xem danh sách chi tiết hồ sơ trong đợt"
                        >
                          <Eye size={13} /> Xem Chi Tiết
                        </button>
                        <button
                          onClick={() => exportSingleBatchExcel(b)}
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition cursor-pointer"
                          title="Xuất Excel đợt này"
                        >
                          <FileDown size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Drill-Down Xem Chi Tiết Một Đợt Nộp */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#004182] to-[#00264d] p-5 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Layers size={20} className="text-[#0ea5e9]" />
                  <h3 className="text-lg font-bold">Chi Tiết Đợt Chuyển BHXH: {selectedBatch.batchName}</h3>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  Ngày chuyển: <span className="font-bold text-white">{selectedBatch.submittedDate}</span> | 
                  Số lượng: <span className="font-bold text-white">{selectedBatch.totalRecords} hồ sơ</span> | 
                  Tổng tiền: <span className="font-bold text-amber-300">{formatMoney(selectedBatch.totalAmount)}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => exportSingleBatchExcel(selectedBatch)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <FileDown size={14} /> Tải Excel
                </button>
                <button
                  onClick={() => setSelectedBatch(null)}
                  className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filter Bar trong Modal */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={modalSearchTxt}
                  onChange={e => setModalSearchTxt(e.target.value)}
                  placeholder="Tìm tên người tham gia, CCCD, Mã BHXH..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:border-[#004182] outline-none text-slate-800"
                />
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                Hiển thị: {modalFilteredRecords.length} / {selectedBatch.totalRecords} hồ sơ
              </span>
            </div>

            {/* Table trong Modal */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-3 text-center">STT</th>
                    <th className="p-3">Họ và Tên</th>
                    <th className="p-3">CCCD / SĐT</th>
                    <th className="p-3">Mã Số BHXH</th>
                    <th className="p-3 text-center">Loại Hình</th>
                    <th className="p-3 text-center">Số Tháng</th>
                    <th className="p-3 text-right">Số Tiền (VNĐ)</th>
                    <th className="p-3">Cán Bộ Thu</th>
                    <th className="p-3 text-center">Ngày Lập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {modalFilteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400">
                        Không tìm thấy hồ sơ nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredRecords.map((r, rIdx) => {
                      const staffObj = staff.find(s => s.id === r.staffId || s.username === r.staffId);
                      return (
                        <tr key={r.id} className="hover:bg-blue-50/30 transition">
                          <td className="p-3 text-center text-gray-400 font-mono">{rIdx + 1}</td>
                          <td className="p-3 font-bold text-gray-800">{r.name}</td>
                          <td className="p-3">
                            <div className="font-mono text-gray-700">{r.cccd || 'N/A'}</div>
                            <div className="text-[11px] text-gray-400 font-mono">{r.phone || ''}</div>
                          </td>
                          <td className="p-3 font-mono font-semibold text-[#004182]">
                            {r.bhxh || r.old_bhxh || r.oldBhxh || 'N/A'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.type === 'BHXH' ? 'bg-blue-100 text-[#004182]' : 'bg-cyan-100 text-[#0ea5e9]'
                            }`}>
                              {r.type}
                            </span>
                          </td>
                          <td className="p-3 text-center font-bold text-gray-600">{r.months}T</td>
                          <td className="p-3 text-right font-bold text-amber-700">{formatMoney(r.amount)}</td>
                          <td className="p-3 text-gray-700">
                            {staffObj ? staffObj.name : (r.staffId || 'N/A')}
                          </td>
                          <td className="p-3 text-center font-mono text-gray-500">{r.date}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div className="text-xs text-gray-600">
                Tổng cộng: <span className="font-bold text-[#004182]">{selectedBatch.totalRecords} hồ sơ</span> — Tổng tiền: <span className="font-bold text-amber-700">{formatMoney(selectedBatch.totalAmount)}</span>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="px-5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmissionBatchReport;
