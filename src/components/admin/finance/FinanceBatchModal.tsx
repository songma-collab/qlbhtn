import React, { useMemo, useEffect } from 'react';
import { Send, X, CheckSquare, XSquare, FileSpreadsheet, Lock, Calendar, Hash } from 'lucide-react';
import { dateISOToVN, getLocalYYYYMMDD, formatMoney } from '../../../utils/helpers';
import { generateBatchCode, getNextBatchSequence } from '../../../utils/batchSubmission';

interface FinanceBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  batchModalTargetIds: number[];
  batchNameInput: string;
  setBatchNameInput: (val: string) => void;
  batchDateInput: string;
  setBatchDateInput: (val: string) => void;
  handleConfirmBatchSubmission: () => void;
  handleCancelBatchSubmission: () => void;
  allRecords?: any[];
  onExportBatchExcel?: (batchCode: string, targetIds?: number[]) => void;
  type?: 'BHXH' | 'BHYT';
}

export const FinanceBatchModal: React.FC<FinanceBatchModalProps> = ({
  isOpen,
  onClose,
  batchModalTargetIds,
  batchNameInput,
  setBatchNameInput,
  batchDateInput,
  setBatchDateInput,
  handleConfirmBatchSubmission,
  handleCancelBatchSubmission,
  allRecords = [],
  onExportBatchExcel,
  type = 'BHXH'
}) => {
  if (!isOpen) return null;

  // Thống kê nhanh danh sách hồ sơ được chọn
  const selectedRecords = useMemo(() => {
    return allRecords.filter(r => batchModalTargetIds.includes(r.id));
  }, [allRecords, batchModalTargetIds]);

  const totalAmount = useMemo(() => {
    return selectedRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [selectedRecords]);

  const todayStr = getLocalYYYYMMDD();
  const dateForBatch = batchDateInput || todayStr;

  // Danh sách các đợt nộp đã tồn tại
  const existingBatches = useMemo(() => {
    return allRecords.map(r => r.submission_batch || r.submissionBatch || '');
  }, [allRecords]);

  // Số thứ tự kế tiếp cho ngày nộp này
  const nextSeq = useMemo(() => {
    return getNextBatchSequence(existingBatches, dateForBatch);
  }, [existingBatches, dateForBatch]);

  // Sinh mã đợt nộp chuẩn: Đợt_YYYYMMDD_XX
  const handleGenerateStandardCode = (seq?: number) => {
    const seqToUse = seq !== undefined ? seq : nextSeq;
    const code = generateBatchCode(dateForBatch, seqToUse);
    setBatchNameInput(code);
  };

  // Tạo danh sách các đợt chuẩn cho ngày được chọn:
  // Đợt đầu (01) và các đợt kế tiếp (02, 03... đến max(nextSeq + 1, 3))
  const standardPresets = useMemo(() => {
    const maxNumber = Math.max(3, nextSeq + 1);
    const presets: string[] = [];
    for (let i = 1; i <= maxNumber; i++) {
      presets.push(generateBatchCode(dateForBatch, i));
    }
    return presets;
  }, [dateForBatch, nextSeq]);

  // Tự động gán mã đợt chuẩn nếu input chưa có mã khi mở modal
  useEffect(() => {
    if (isOpen && !batchNameInput) {
      handleGenerateStandardCode(nextSeq);
    }
  }, [isOpen]);

  // Xử lý khi thay đổi ngày nộp hồ sơ
  const handleDateChange = (newDate: string) => {
    setBatchDateInput(newDate);
    const newNextSeq = getNextBatchSequence(existingBatches, newDate);
    // Nếu mã hiện tại đang rỗng hoặc đang theo dạng chuẩn Đợt_YYYYMMDD_XX, tự động chuyển sang mã ngày mới
    const isStandardCode = /^(?:Đợt|BATCH)_\d{8}_\d+$/i.test(batchNameInput.trim());
    if (!batchNameInput || isStandardCode) {
      setBatchNameInput(generateBatchCode(newDate, newNextSeq));
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shadow-xs shrink-0">
              <Send size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Quản Lý Đợt Nộp BHXH / BHYT</h3>
              <p className="text-xs text-slate-500 font-medium">
                Đang chọn <span className="font-bold text-emerald-700">{batchModalTargetIds.length}</span> hồ sơ • Tổng tiền: <span className="font-bold text-rose-600">{formatMoney(totalAmount)}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cảnh báo khóa hồ sơ */}
        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-xs flex items-start gap-2">
          <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Quy tắc bảo mật đợt nộp:</span> Sau khi xác nhận gắn vào đợt nộp, toàn bộ hồ sơ sẽ được khóa chuyển đổi (<code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-bold">isSubmittedBHXH = true</code>) để ngăn chặn việc chỉnh sửa/xóa dữ liệu tài chính trái phép.
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Ngày chuyển đợt */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Calendar size={14} className="text-slate-500" />
              Ngày nộp / chuyển hồ sơ sang BHXH:
            </label>
            <input
              type="date"
              value={batchDateInput}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none shadow-xs"
            />
          </div>

          {/* Tên / Mã đợt nộp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Hash size={14} className="text-slate-500" />
                Mã đợt nộp (Chuẩn Đợt_YYYYMMDD_XX):
              </label>
              <button
                type="button"
                onClick={() => handleGenerateStandardCode(nextSeq)}
                className="text-emerald-700 hover:text-emerald-800 font-bold text-[11px] underline cursor-pointer"
                title="Tự động sinh mã đợt kế tiếp chưa dùng trong ngày"
              >
                + Tự sinh mã kế tiếp
              </button>
            </div>

            {/* Presets chuẩn Đợt_YYYYMMDD_XX */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
              {standardPresets.map(preset => {
                const isSelected = batchNameInput === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setBatchNameInput(preset)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-mono font-bold border transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={batchNameInput}
              onChange={e => setBatchNameInput(e.target.value)}
              placeholder={`Ví dụ: ${generateBatchCode(dateForBatch, 1)}...`}
              className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 outline-none shadow-xs"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              * Mã hiển thị: <span className="font-bold text-emerald-800">{batchNameInput || 'Đợt_...'} ({dateISOToVN(dateForBatch)})</span>
            </p>
          </div>
        </div>

        {/* Nút xuất khẩu biểu mẫu theo đợt nếu đợt đã có mã */}
        {onExportBatchExcel && batchNameInput && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => onExportBatchExcel(batchNameInput, batchModalTargetIds)}
              className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              Xuất {type === 'BHYT' ? 'Mẫu D03-TS' : 'Mẫu D05-TS'} Chuẩn Cho Đợt Này
            </button>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleConfirmBatchSubmission}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer border-none"
          >
            <CheckSquare size={16} /> Xác nhận &amp; Khóa đợt nộp
          </button>

          {selectedRecords.some(r => r.isSubmittedBHXH) && (
            <button
              type="button"
              onClick={handleCancelBatchSubmission}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold py-3 px-3 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              title="Mở khóa và hủy đợt nộp"
            >
              <XSquare size={16} /> Mở khóa đợt nộp
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer border-none"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinanceBatchModal;
