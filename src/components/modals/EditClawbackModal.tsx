import React, { useState, useEffect, useMemo } from 'react';
import type { RecordType } from '../../context/types';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, parseMonthISO, formatMonthVN } from '../../utils/helpers';
import { calculateClawbackRatio } from '../../utils/clawbackSettlement';
import {
  X,
  ShieldCheck,
  Calendar,
  User
} from 'lucide-react';

interface EditClawbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordType | null;
  onSuccess?: () => void;
}

export const EditClawbackModal: React.FC<EditClawbackModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess
}) => {
  const { records, policies, settings, updateRecord, addAuditLog, showToast, showAlert, refreshData } = useAppContext();

  // Form states
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundType, setRefundType] = useState<string>('TRUNG_THE');
  const [decisionNumber, setDecisionNumber] = useState('');
  const [decisionDate, setDecisionDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [refundMethod, setRefundMethod] = useState<'TIEN_MAT' | 'CHUYEN_KHOAN'>('TIEN_MAT');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryAccount, setBeneficiaryAccount] = useState('');
  const [beneficiaryBank, setBeneficiaryBank] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getRecordMonthISO = (val?: string) => {
    if (!val) return '';
    const parsed = parseMonthISO(val);
    if (parsed) return parsed;
    if (val.includes('-') && val.length === 7) return val;
    if (val.includes('-') && val.length >= 10) return val.slice(0, 7);
    return '';
  };

  useEffect(() => {
    if (record) {
      setRefundAmount(Math.abs(Number(record.amount) || 0));
      setRefundType(record.refund_type || (record as any).refundType || 'TRUNG_THE');
      setDecisionNumber(record.decision_number || (record as any).decisionNumber || '');
      setDecisionDate(record.decision_date || (record as any).decisionDate || (record.date ? record.date.slice(0, 10) : (new Date().toISOString().split('T')[0] ?? '')));
      setEffectiveDate(record.date ? record.date.slice(0, 10) : (new Date().toISOString().split('T')[0] ?? ''));
      
      const initFrom = getRecordMonthISO(record.from_month || (record as any).fromMonth) || (record.date ? record.date.slice(0, 7) : '');
      const initTo = getRecordMonthISO(record.to_month || (record as any).toMonth) || initFrom;
      setFromMonth(initFrom);
      setToMonth(initTo);

      setRefundMethod((record.refund_method as any) || (record as any).refundMethod || 'TIEN_MAT');
      setBeneficiaryName(record.refund_beneficiary_name || (record as any).refundBeneficiaryName || record.name || '');
      setBeneficiaryAccount(record.refund_beneficiary_account || (record as any).refundBeneficiaryAccount || '');
      setBeneficiaryBank(record.refund_beneficiary_bank || (record as any).refundBeneficiaryBank || '');
      setReason(record.adjustment_reason || (record as any).adjustmentReason || record.notes || '');
    }
  }, [record, isOpen]);

  const origRecord = useMemo(() => {
    const origId = record?.original_record_id || (record as any)?.originalRecordId;
    if (!origId) return null;
    return records.find(r => r.id === origId) || null;
  }, [record, records]);

  const calculatedRefundMonths = useMemo(() => {
    if (!fromMonth || !toMonth) return record?.months || 1;
    const [y1, m1] = fromMonth.split('-').map(Number);
    const [y2, m2] = toMonth.split('-').map(Number);
    if (!y1 || !m1 || !y2 || !m2) return 1;
    const total = (y2 - y1) * 12 + (m2 - m1) + 1;
    return Math.max(1, total);
  }, [fromMonth, toMonth, record?.months]);

  const clawbackBreakdown = useMemo(() => {
    if (!record || !refundAmount || refundAmount <= 0) return null;
    const targetOrig = origRecord || record;
    return calculateClawbackRatio(targetOrig, refundAmount, policies, settings);
  }, [record, origRecord, refundAmount, policies, settings]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast('Vui lòng nhập lý do thoái thu hoàn trả.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const clawCommission = clawbackBreakdown?.clawbackCommission ?? Math.abs(Number(record.commission) || 0);

      const updatedFields: Partial<RecordType> = {
        amount: -Math.abs(refundAmount),
        commission: -Math.abs(clawCommission),
        decision_number: decisionNumber.trim() || undefined,
        decision_date: decisionDate || undefined,
        date: effectiveDate,
        from_month: fromMonth || undefined,
        to_month: toMonth || undefined,
        months: calculatedRefundMonths,
        refund_type: refundType,
        refund_method: refundMethod,
        refund_beneficiary_name: beneficiaryName.trim() || undefined,
        refund_beneficiary_account: beneficiaryAccount.trim() || undefined,
        refund_beneficiary_bank: beneficiaryBank.trim() || undefined,
        notes: reason.trim(),
        adjustment_reason: reason.trim()
      };

      const ok = await updateRecord(record.id, updatedFields);
      if (ok) {
        await addAuditLog(
          'Chỉnh sửa bút toán thoái thu',
          `Cập nhật bút toán #${record.id} của khách hàng ${record.name} - Tiền thoái thu: ${formatMoney(refundAmount)}, Thu hồi hoa hồng: ${formatMoney(clawCommission)}`
        );
        showToast('Cập nhật bút toán thoái thu thành công!', 'success');
        if (refreshData) await refreshData();
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast('Có lỗi xảy ra khi cập nhật bút toán.', 'error');
      }
    } catch (err: any) {
      console.error('Error updating clawback record:', err);
      showAlert('Lỗi cập nhật', err.message || 'Không thể lưu thay đổi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Chỉnh Sửa Bút Toán Thoái Thu</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                  #{record.id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Điều chỉnh thông tin quyết định, số tiền, kỳ đóng giảm trừ và lý do thoái trả
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Thông tin khách hàng tóm tắt */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-slate-900">{record.name}</span>
              <span className="text-slate-500 font-mono">({record.cccd || record.bhxh || 'N/A'})</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
              {record.type}
            </span>
          </div>

          {/* Số tiền thoái thu & Loại hình */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Số tiền thoái thu (VNĐ) <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min={1000}
                value={refundAmount || ''}
                onChange={e => setRefundAmount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Loại hình thoái thu <span className="text-rose-600">*</span>
              </label>
              <select
                value={refundType}
                onChange={e => setRefundType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="TRUNG_THE">Trùng thẻ BHYT (Được NSNN đóng/cấp)</option>
                <option value="CHUYEN_BAT_BUOC">Chuyển sang BHXH Bắt buộc (Đi làm)</option>
                <option value="DIEU_CHINH_GIAM">Điều chỉnh giảm mức đóng / thời gian</option>
                <option value="CHET">Người tham gia qua đời</option>
                <option value="KHAC">Lý do nghiệp vụ khác</option>
              </select>
            </div>
          </div>

          {/* Kỳ đóng giảm trừ */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-700" />
                Kỳ đóng giảm trừ thoái trả <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-amber-800 font-medium">
                (Tháng này sẽ không còn tính đã đóng BHXH)
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

          {/* Quyết định & Ngày hạch toán */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số QĐ / Công văn</label>
              <input
                type="text"
                value={decisionNumber}
                onChange={e => setDecisionNumber(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="VD: QĐ-142/BHXH"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày ban hành QĐ</label>
              <input
                type="date"
                value={decisionDate}
                onChange={e => setDecisionDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày hạch toán</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={e => setEffectiveDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {/* Hình thức hoàn trả */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hình thức chi hoàn</label>
              <div className="flex gap-4 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editRefundMethod"
                    value="TIEN_MAT"
                    checked={refundMethod === 'TIEN_MAT'}
                    onChange={() => setRefundMethod('TIEN_MAT')}
                  />
                  Tiền mặt
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editRefundMethod"
                    value="CHUYEN_KHOAN"
                    checked={refundMethod === 'CHUYEN_KHOAN'}
                    onChange={() => setRefundMethod('CHUYEN_KHOAN')}
                  />
                  Chuyển khoản
                </label>
              </div>
            </div>
            {refundMethod === 'CHUYEN_KHOAN' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Chủ tài khoản"
                  value={beneficiaryName}
                  onChange={e => setBeneficiaryName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Số tài khoản"
                    value={beneficiaryAccount}
                    onChange={e => setBeneficiaryAccount(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Ngân hàng"
                    value={beneficiaryBank}
                    onChange={e => setBeneficiaryBank(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Lý do chi tiết */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nội dung / Lý do chi tiết <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {/* Tóm tắt tính toán */}
          {clawbackBreakdown && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-600 block">Số tiền thoái thu:</span>
                <strong className="text-rose-600 font-black text-sm">-{formatMoney(refundAmount)}</strong>
              </div>
              <div>
                <span className="text-slate-600 block">Thu hồi hoa hồng cán bộ:</span>
                <strong className="text-rose-700 font-black text-sm">-{formatMoney(clawbackBreakdown.clawbackCommission)}</strong>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || refundAmount <= 0}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu Thay Đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

