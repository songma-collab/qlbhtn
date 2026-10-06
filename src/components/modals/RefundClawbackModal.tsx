import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import type { RecordType } from '../../context/types';
import { formatMoney, parseMonthISO, formatMonthVN } from '../../utils/helpers';
import {
  calculateClawbackRatio,
  getRefundHistoryForRecord,
  validateRefundClawback,
  buildClawbackRecordPayload
} from '../../utils/clawbackSettlement';
import {
  X,
  Search,
  AlertTriangle,
  FileText,
  Calendar,
  CheckCircle2,
  ShieldCheck
} from 'lucide-react';

interface RefundClawbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedRecord?: RecordType | null;
  onSuccess?: () => void;
}

export const RefundClawbackModal: React.FC<RefundClawbackModalProps> = ({
  isOpen,
  onClose,
  preselectedRecord,
  onSuccess
}) => {
  const { records, staff, policies, settings, currentUser, addRecord, updateRecord, addAuditLog, showToast, showAlert, refreshData } = useAppContext();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<RecordType | null>(null);

  // Form states
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundType, setRefundType] = useState<string>('TRUNG_THE');
  const [decisionNumber, setDecisionNumber] = useState('');
  const [decisionDate, setDecisionDate] = useState(new Date().toISOString().split('T')[0]);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0] ?? '');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [refundMethod, setRefundMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to extract ISO month YYYY-MM
  const getRecordMonthISO = (val?: string) => {
    if (!val) return '';
    const parsed = parseMonthISO(val);
    if (parsed) return parsed;
    if (val.includes('-') && val.length === 7) return val;
    if (val.includes('-') && val.length >= 10) return val.slice(0, 7);
    return '';
  };

  // Preselected record handling
  useEffect(() => {
    if (preselectedRecord) {
      setSelectedRecord(preselectedRecord);
      const history = getRefundHistoryForRecord(preselectedRecord.id, records);
      setRefundAmount(history.remainingRefundable);
      setBeneficiaryName(preselectedRecord.name || '');
      const recFrom = preselectedRecord.from_month || (preselectedRecord as any).fromMonth;
      const recTo = preselectedRecord.to_month || (preselectedRecord as any).toMonth;
      const initFrom = getRecordMonthISO(recFrom) || (preselectedRecord.date ? preselectedRecord.date.slice(0, 7) : '');
      const initTo = getRecordMonthISO(recTo) || initFrom;
      setFromMonth(initFrom);
      setToMonth(initTo);
    } else {
      setSelectedRecord(null);
      setRefundAmount(0);
      setSearchQuery('');
      setFromMonth('');
      setToMonth('');
    }
  }, [preselectedRecord, isOpen, records]);

  // Filter eligible records for search (only paid records that are not adjustments themselves)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || selectedRecord) return [];
    const q = searchQuery.toLowerCase().trim();
    return records
      .filter(r => {
        const pStatus = r.payment_status || (r as any).paymentStatus;
        const isAdj = r.is_adjustment || (r as any).isAdjustment;
        if (pStatus === 'Đã hủy' || pStatus === 'Đã thoái thu' || isAdj === true) return false;
        const nameMatch = (r.name || '').toLowerCase().includes(q);
        const cccdMatch = (r.cccd || '').includes(q);
        const phoneMatch = (r.phone || '').includes(q);
        const bhxhMatch = (r.bhxh || '').includes(q);
        const idMatch = String(r.id) === q;
        return nameMatch || cccdMatch || phoneMatch || bhxhMatch || idMatch;
      })
      .slice(0, 10);
  }, [records, searchQuery, selectedRecord]);

  // Refund history of currently selected record
  const selectedHistory = useMemo(() => {
    if (!selectedRecord) return null;
    return getRefundHistoryForRecord(selectedRecord.id, records);
  }, [selectedRecord, records]);

  // Real-time clawback breakdown based on snapshot invariant & original commission
  const clawbackBreakdown = useMemo(() => {
    if (!selectedRecord || !refundAmount || refundAmount <= 0) return null;
    return calculateClawbackRatio(selectedRecord, refundAmount, policies, settings);
  }, [selectedRecord, refundAmount, policies, settings]);

  // Staff info of the selected record
  const assignedStaff = useMemo(() => {
    if (!selectedRecord) return null;
    const sId = selectedRecord.staff_id || (selectedRecord as any).staffId;
    return staff.find(s => s.id === sId);
  }, [selectedRecord, staff]);

  // Number of months to refund based on fromMonth & toMonth
  const calculatedRefundMonths = useMemo(() => {
    if (!fromMonth || !toMonth) return selectedRecord?.months || 1;
    const [y1, m1] = fromMonth.split('-').map(Number);
    const [y2, m2] = toMonth.split('-').map(Number);
    if (!y1 || !m1 || !y2 || !m2) return 1;
    const total = (y2 - y1) * 12 + (m2 - m1) + 1;
    return Math.max(1, total);
  }, [fromMonth, toMonth, selectedRecord?.months]);

  // Select record handler
  const handleSelectRecord = (rec: RecordType) => {
    setSelectedRecord(rec);
    const history = getRefundHistoryForRecord(rec.id, records);
    setRefundAmount(history.remainingRefundable);
    setBeneficiaryName(rec.name || '');
    const recFrom = rec.from_month || (rec as any).fromMonth;
    const recTo = rec.to_month || (rec as any).toMonth;
    const initFrom = getRecordMonthISO(recFrom) || (rec.date ? rec.date.slice(0, 7) : '');
    const initTo = getRecordMonthISO(recTo) || initFrom;
    setFromMonth(initFrom);
    setToMonth(initTo);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) {
      showToast('Vui lòng chọn hồ sơ gốc cần thoái thu.', 'error');
      return;
    }

    // Run defense validations
    const validation = validateRefundClawback(
      selectedRecord,
      refundAmount,
      effectiveDate,
      records,
      policies,
      currentUser?.role
    );

    if (!validation.isValid) {
      showAlert('Không thể lập bút toán', validation.errorMessage || 'Dữ liệu không hợp lệ.');
      return;
    }

    if (!reason.trim()) {
      showToast('Vui lòng nhập lý do thoái thu hoàn trả.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Build payload adhering strictly to Invariant 3
      const clawbackPayload = buildClawbackRecordPayload({
        originalRecord: selectedRecord,
        refundAmount,
        refundType,
        decisionNumber: decisionNumber.trim() || undefined,
        decisionDate: decisionDate || undefined,
        refundMethod,
        effectiveDate,
        reason: reason.trim(),
        fromMonth: fromMonth || selectedRecord.from_month || (selectedRecord as any).fromMonth,
        toMonth: toMonth || selectedRecord.to_month || (selectedRecord as any).toMonth,
        months: calculatedRefundMonths,
        beneficiaryName: beneficiaryName.trim() || selectedRecord.name,
        beneficiaryAccount: beneficiaryAccount.trim() || undefined,
        beneficiaryBank: beneficiaryBank.trim() || undefined,
        policies,
        settings
      });

      const success = await addRecord(clawbackPayload as RecordType);
      if (success) {
        // Giảm trừ đúng tháng đã lựa chọn thoái trả để không còn tính đã đóng BHXH
        const origFrom = getRecordMonthISO(selectedRecord.from_month || (selectedRecord as any).fromMonth);
        const origTo = getRecordMonthISO(selectedRecord.to_month || (selectedRecord as any).toMonth);
        const isFullPeriod = (!origFrom || !origTo) || (fromMonth <= origFrom && toMonth >= origTo) || (refundAmount >= (selectedHistory?.remainingRefundable || 0));

        if (isFullPeriod) {
          // Toàn bộ kỳ đóng bị thoái thu: chuyển trạng thái thành 'Đã thoái thu'
          await updateRecord(selectedRecord.id, {
            payment_status: 'Đã thoái thu',
            notes: `${selectedRecord.notes || ''}\n[Đã thoái thu toàn bộ kỳ đóng ${fromMonth || ''} - ${toMonth || ''} theo QĐ ${decisionNumber || 'N/A'}]`.trim()
          });
        } else {
          // Thoái thu giảm trừ một phần tháng (VD giảm trừ các tháng cuối)
          if (toMonth && origTo && toMonth >= origTo && fromMonth > (origFrom || '')) {
            const [fy = 2026, fm = 1] = fromMonth.split('-').map(Number);
            const prevD = new Date(fy, fm - 2, 1);
            const newTo = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
            const newMonths = Math.max(1, (Number(selectedRecord.months) || 1) - calculatedRefundMonths);
            await updateRecord(selectedRecord.id, {
              to_month: newTo,
              months: newMonths,
              notes: `${selectedRecord.notes || ''}\n[Đã thoái thu giảm trừ từ tháng ${fromMonth} đến ${toMonth} theo QĐ ${decisionNumber || 'N/A'}]`.trim()
            });
          } else {
            await updateRecord(selectedRecord.id, {
              notes: `${selectedRecord.notes || ''}\n[Đã thoái thu giảm trừ kỳ ${fromMonth || ''} đến ${toMonth || ''} (${calculatedRefundMonths} tháng) theo QĐ ${decisionNumber || 'N/A'}]`.trim()
            });
          }
        }

        await addAuditLog(
          'Thoái Thu & Hoàn Trả',
          `Lập bút toán thoái thu ${formatMoney(refundAmount)} (kỳ ${fromMonth || ''} - ${toMonth || ''}) cho khách hàng ${selectedRecord.name} (Hồ sơ gốc #${selectedRecord.id}) - QĐ: ${decisionNumber || 'N/A'}, Thu hồi hoa hồng: ${formatMoney(clawbackBreakdown?.clawbackCommission || 0)} từ cán bộ ${assignedStaff?.name || selectedRecord.staff_id || (selectedRecord as any).staffId}`
        );

        showToast(`Đã lập bút toán thoái thu ${formatMoney(refundAmount)} và giảm trừ kỳ đóng thành công!`, 'success');
        if (refreshData) await refreshData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast('Có lỗi xảy ra khi lưu bút toán thoái thu.', 'error');
      }
    } catch (err: any) {
      console.error('Error creating refund clawback:', err);
      showAlert('Lỗi xử lý', err.message || 'Không thể tạo bút toán thoái thu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Lập Bút Toán Thoái Thu & Hoàn Trả</h3>
              <p className="text-xs text-slate-500">
                Ghi nhận điều chỉnh giảm doanh thu, thu hồi hoa hồng cán bộ thu theo quyết định BHXH
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* 1. Chọn hồ sơ gốc */}
          {!selectedRecord ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Tìm kiếm hồ sơ gốc cần thoái thu <span className="text-rose-600">*</span>
              </label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng, CCCD, Mã BHXH, SĐT hoặc Mã GD..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                />
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map(r => {
                    const history = getRefundHistoryForRecord(r.id, records);
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRecord(r)}
                        className="p-3 hover:bg-rose-50/50 cursor-pointer flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            {r.name}
                            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                              #{r.id}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded">
                              {r.type}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            CCCD: {r.cccd || 'N/A'} • Mã BHXH: {r.bhxh || 'Chưa có'} • Ngày thu: {r.date}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">{formatMoney(r.amount)}</div>
                          <div className="text-[11px] text-emerald-600 font-medium">
                            Còn có thể thoái: {formatMoney(history.remainingRefundable)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <p className="text-xs text-slate-400 mt-2 text-center py-3 bg-slate-50 rounded-xl">
                  Không tìm thấy hồ sơ gốc hợp lệ phù hợp với từ khóa "{searchQuery}"
                </p>
              )}
            </div>
          ) : (
            /* Selected Original Record Card */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="absolute top-3 right-3 text-xs text-rose-600 hover:text-rose-700 font-bold bg-white px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50"
              >
                Đổi hồ sơ khác
              </button>

              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" /> Hồ sơ gốc được chọn (Snapshot)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Khách hàng:</span>
                  <div className="font-bold text-slate-900">{selectedRecord.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">CCCD: {selectedRecord.cccd || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Nghiệp vụ / Ngày thu:</span>
                  <div className="font-bold text-slate-900">{selectedRecord.type} ({selectedRecord.months || 12} tháng)</div>
                  <div className="text-[11px] text-slate-500">Ngày thu: {selectedRecord.date}</div>
                </div>
                <div>
                  <span className="text-slate-500">Cán bộ thu:</span>
                  <div className="font-bold text-slate-900">{assignedStaff?.name || selectedRecord.staff_id || (selectedRecord as any).staffId}</div>
                  <div className="text-[11px] text-slate-500">HH gốc: {formatMoney(selectedRecord.commission || 0)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Số tiền gốc / Còn lại:</span>
                  <div className="font-bold text-slate-900">{formatMoney(selectedRecord.amount)}</div>
                  <div className="text-[11px] font-bold text-rose-600">
                    Còn thoái: {formatMoney(selectedHistory?.remainingRefundable || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Nhập thông tin Thoái thu & Hoàn trả */}
          {selectedRecord && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Số tiền thoái thu */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số tiền thoái thu hoàn trả (VNĐ) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1000}
                      max={selectedHistory?.remainingRefundable || 0}
                      value={refundAmount || ''}
                      onChange={e => setRefundAmount(Number(e.target.value))}
                      className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setRefundAmount(selectedHistory?.remainingRefundable || 0)}
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      Toàn bộ ({formatMoney(selectedHistory?.remainingRefundable || 0)})
                    </button>
                    {selectedHistory && selectedHistory.remainingRefundable > 100000 && (
                      <button
                        type="button"
                        onClick={() => setRefundAmount(Math.round(selectedHistory.remainingRefundable / 2))}
                        className="text-[11px] font-bold text-slate-500 hover:underline"
                      >
                        50% ({formatMoney(Math.round(selectedHistory.remainingRefundable / 2))})
                      </button>
                    )}
                  </div>
                </div>

                {/* Lý do thoái thu */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Loại hình thoái thu <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={refundType}
                    onChange={e => setRefundType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    <option value="TRUNG_THE">Trùng thẻ BHYT (Được NSNN đóng/cấp)</option>
                    <option value="CHUYEN_BAT_BUOC">Chuyển sang BHXH Bắt buộc (Đi làm)</option>
                    <option value="DIEU_CHINH_GIAM">Điều chỉnh giảm mức đóng / thời gian</option>
                    <option value="CHET">Người tham gia qua đời</option>
                    <option value="KHAC">Lý do nghiệp vụ khác</option>
                  </select>
                </div>
              </div>

              {/* Kỳ đóng giảm trừ thoái trả */}
              <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-700" />
                    Kỳ đóng giảm trừ thoái trả <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-amber-800 font-medium">
                    (Tháng được chọn sẽ giảm trừ khỏi quá trình đã đóng BHXH của khách hàng)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">Từ tháng:</span>
                    <input
                      type="month"
                      value={fromMonth}
                      onChange={e => setFromMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-slate-700 block mb-1">Đến tháng:</span>
                    <input
                      type="month"
                      value={toMonth}
                      onChange={e => setToMonth(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
                {fromMonth && toMonth && (
                  <div className="text-[11px] text-amber-900 font-medium flex items-center justify-between pt-1 border-t border-amber-200/60">
                    <span>Số tháng giảm trừ: <strong className="font-bold">{calculatedRefundMonths} tháng</strong></span>
                    <span>Kỳ thoái: <strong className="font-bold">{formatMonthVN(fromMonth)} - {formatMonthVN(toMonth)}</strong></span>
                  </div>
                )}
              </div>

              {/* Văn bản Quyết định & Ngày hiệu lực */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Số QĐ / Công văn BHXH
                  </label>
                  <input
                    type="text"
                    placeholder="VD: QĐ-142/BHXH-SM"
                    value={decisionNumber}
                    onChange={e => setDecisionNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày ban hành QĐ
                  </label>
                  <input
                    type="date"
                    value={decisionDate}
                    onChange={e => setDecisionDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ngày hạch toán kỳ mở <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={e => setEffectiveDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              </div>

              {/* Hình thức hoàn trả tiền & Thông tin thụ hưởng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Hình thức chi hoàn
                  </label>
                  <div className="flex gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="refundMethod"
                        value="TIEN_MAT"
                        checked={refundMethod === 'TIEN_MAT'}
                        onChange={() => setRefundMethod('TIEN_MAT')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      Tiền mặt tại đại lý
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                      <input
                        type="radio"
                        name="refundMethod"
                        value="CHUYEN_KHOAN"
                        checked={refundMethod === 'CHUYEN_KHOAN'}
                        onChange={() => setRefundMethod('CHUYEN_KHOAN')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      Chuyển khoản VietQR
                    </label>
                  </div>
                </div>

                {refundMethod === 'CHUYEN_KHOAN' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Tên người nhận (Mặc định họ tên KH)"
                      value={beneficiaryName}
                      onChange={e => setBeneficiaryName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Số tài khoản"
                        value={beneficiaryAccount}
                        onChange={e => setBeneficiaryAccount(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Ngân hàng (MB, VCB...)"
                        value={beneficiaryBank}
                        onChange={e => setBeneficiaryBank(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Lý do chi tiết */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nội dung / Lý do thoái thu chi tiết <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Ghi rõ lý do thoái thu, số công văn và căn cứ hoàn trả..."
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 outline-none"
                  required
                />
              </div>

              {/* Live Preview Box (Tóm tắt hạch toán âm) */}
              {clawbackBreakdown && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-4 text-xs">
                  <div className="font-bold text-rose-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> Tóm tắt đối trừ hạch toán kế toán (Invariant 3)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-600">Số tiền thoái thu (Dòng tiền âm):</span>
                      <div className="font-black text-rose-700 text-sm">-{formatMoney(refundAmount)}</div>
                    </div>
                    <div>
                      <span className="text-slate-600">Thu hồi hoa hồng cán bộ:</span>
                      <div className="font-black text-rose-700 text-sm">-{formatMoney(clawbackBreakdown.clawbackCommission)}</div>
                      <div className="text-[10px] text-slate-500">
                        (Tỷ lệ gốc: {(clawbackBreakdown.commissionRatio * 100).toFixed(2)}%)
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Cán bộ thu chịu trách nhiệm:</span>
                      <div className="font-bold text-slate-900">{assignedStaff?.name || selectedRecord.staff_id || (selectedRecord as any).staffId}</div>
                      <div className="text-[10px] text-slate-500">Mã: {assignedStaff?.staff_code || (assignedStaff as any)?.staffCode || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedRecord || refundAmount <= 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm flex items-center gap-2"
            >
              {isSubmitting ? (
                'Đang xử lý...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Xác Nhận Lập Bút Toán Thoái Thu
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

