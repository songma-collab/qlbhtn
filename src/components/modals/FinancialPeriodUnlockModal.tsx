import React from 'react';
import { Unlock } from 'lucide-react';

interface FinancialPeriodUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeriodLabel: string;
  unlockReason: string;
  setUnlockReason: (reason: string) => void;
  onConfirm: () => void;
  isLocking?: boolean;
}

export const FinancialPeriodUnlockModal: React.FC<FinancialPeriodUnlockModalProps> = ({
  isOpen,
  onClose,
  currentPeriodLabel,
  unlockReason,
  setUnlockReason,
  onConfirm,
  isLocking = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3 text-rose-600 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200/60 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Mở Khóa Kỳ Tài Chính</h3>
            <p className="text-xs text-rose-600 font-semibold">{currentPeriodLabel}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Bạn đang yêu cầu mở khóa kỳ tài chính đã chốt. Hành động này sẽ được ghi vết vào <b>Nhật ký kiểm toán (Audit Logs)</b> của hệ thống.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Lý Do Mở Khóa <span className="text-rose-500">*</span> (Tối thiểu 5 ký tự)
          </label>
          <textarea
            value={unlockReason}
            onChange={e => setUnlockReason(e.target.value)}
            placeholder="Nhập lý do điều chỉnh số liệu kế toán..."
            rows={3}
            className="w-full p-3 text-xs bg-slate-50/70 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#004182]/20 focus:border-[#004182] font-medium"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLocking || unlockReason.trim().length < 5}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {isLocking ? 'Đang xử lý...' : 'Xác Nhận Mở Khóa'}
          </button>
        </div>
      </div>
    </div>
  );
};
