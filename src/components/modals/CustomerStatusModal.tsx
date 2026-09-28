import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, PauseCircle, ShieldAlert } from 'lucide-react';
import type { RecordType } from '../../context/types';
import { STOP_CONTRIBUTION_REASONS, type CustomerStatus } from '../../utils/customerStatus';

interface CustomerStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordType | null;
  onConfirm: (recordId: number, newStatus: CustomerStatus, reason: string) => Promise<boolean | void>;
}

export const CustomerStatusModal: React.FC<CustomerStatusModalProps> = ({
  isOpen,
  onClose,
  record,
  onConfirm
}) => {
  if (!isOpen || !record) return null;

  const currentStatus = (record.status || 'Đang tham gia') as CustomerStatus;
  const [newStatus, setNewStatus] = useState<CustomerStatus>(
    currentStatus === 'Đã dừng đóng' ? 'Đang tham gia' : 'Đã dừng đóng'
  );
  const [selectedReason, setSelectedReason] = useState<string>(STOP_CONTRIBUTION_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const finalReason = selectedReason === 'Lý do khác' ? customReason.trim() : selectedReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newStatus === 'Đã dừng đóng' && !finalReason) {
      setErrorMsg('Vui lòng nhập hoặc chọn lý do khách hàng dừng đóng.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const reasonToLog = newStatus === 'Đã dừng đóng' 
        ? finalReason 
        : (customReason.trim() || 'Khách hàng quay lại đóng tiếp');
      await onConfirm(record.id, newStatus, reasonToLog);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi cập nhật trạng thái.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-100 overflow-hidden transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#004182]/10 text-[#004182] flex items-center justify-center font-bold">
              {newStatus === 'Đã dừng đóng' ? <PauseCircle size={20} className="text-amber-600" /> : <CheckCircle2 size={20} className="text-emerald-600" />}
            </div>
            <div>
              <h3 className="font-extrabold text-[#004182] text-base leading-tight">
                Chuyển Trạng Thái Khách Hàng
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Cập nhật tình trạng duy trì tham gia BHXH/BHYT
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Customer Info Card */}
        <div className="p-4 sm:p-5 pb-0">
          <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Khách hàng:</span>
              <span className="font-bold text-gray-900 text-sm">{record.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Số CCCD / Mã BHXH:</span>
              <span className="font-semibold text-gray-800">{record.cccd || record.bhxh || '---'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Trạng thái hiện tại:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                currentStatus === 'Đã dừng đóng' 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {currentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Chọn Trạng Thái Mới
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setNewStatus('Đang tham gia')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  newStatus === 'Đang tham gia'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <CheckCircle2 size={16} className={newStatus === 'Đang tham gia' ? 'text-emerald-600' : 'text-gray-400'} />
                <span>Đang tham gia</span>
              </button>

              <button
                type="button"
                onClick={() => setNewStatus('Đã dừng đóng')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  newStatus === 'Đã dừng đóng'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                }`}
              >
                <PauseCircle size={16} className={newStatus === 'Đã dừng đóng' ? 'text-amber-600' : 'text-gray-400'} />
                <span>Đã dừng đóng</span>
              </button>
            </div>
          </div>

          {newStatus === 'Đã dừng đóng' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Lý do dừng đóng <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                >
                  {STOP_CONTRIBUTION_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {(selectedReason === 'Lý do khác' || selectedReason === 'Không có nhu cầu tiếp tục tham gia') && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ghi chú chi tiết lý do
                  </label>
                  <textarea
                    rows={2}
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Nhập chi tiết hoàn cảnh hoặc lý do khách hàng dừng đóng..."
                    className="w-full p-2.5 rounded-xl border border-gray-200 bg-white text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                  />
                </div>
              )}

              <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-2">
                <ShieldAlert size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  <strong>Hệ quả nghiệp vụ:</strong> Người này sẽ được loại trừ khỏi danh sách đôn đốc tái tục, không nhận cảnh báo hạn nộp và không tính vào KPI nhắc nợ. Khi người này quay lại đóng tiếp, hệ thống sẽ tự động kích hoạt lại.
                </span>
              </div>
            </div>
          )}

          {newStatus === 'Đang tham gia' && currentStatus === 'Đã dừng đóng' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ghi chú tái kích hoạt (Tùy chọn)
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ví dụ: Khách hàng quay lại tham gia tiếp..."
                className="w-full p-2.5 rounded-xl border border-gray-200 bg-white text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5 ${
                newStatus === 'Đã dừng đóng'
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Xác nhận cập nhật</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
