import React from 'react';
import type { RecordType } from '../../../context/types';
import { useAppContext } from '../../../context/AppContext';
import { formatMoney, formatMonthVN } from '../../../utils/helpers';
import { calculateClawbackRatio } from '../../../utils/clawbackSettlement';
import {
  X,
  ShieldAlert,
  DollarSign,
  FileText,
  User,
  CreditCard,
  Printer,
  Pencil
} from 'lucide-react';

interface ViewClawbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordType | null;
  onEdit?: (record: RecordType) => void;
}

export const ViewClawbackModal: React.FC<ViewClawbackModalProps> = ({
  isOpen,
  onClose,
  record,
  onEdit
}) => {
  const { staff, records, policies, settings, currentUser } = useAppContext();

  if (!isOpen || !record) return null;

  const assignedStaff = staff.find(s => s.id === record.staffId);
  const origRecord = record.originalRecordId ? records.find(r => r.id === record.originalRecordId) : null;

  // Commission fallback if not stored
  let commissionClawed = Math.abs(Number(record.commission) || 0);
  if (commissionClawed === 0 && origRecord) {
    commissionClawed = calculateClawbackRatio(
      origRecord,
      Math.abs(Number(record.amount) || 0),
      policies,
      settings
    ).clawbackCommission;
  }

  const isAdminOrManager = currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'Quản lý';

  const refundTypeLabels: Record<string, string> = {
    TRUNG_THE: 'Trùng thẻ BHYT (Được NSNN đóng/cấp)',
    CHUYEN_BAT_BUOC: 'Chuyển sang BHXH Bắt buộc (Đi làm)',
    DIEU_CHINH_GIAM: 'Điều chỉnh giảm mức đóng / thời gian',
    CHET: 'Người tham gia qua đời',
    KHAC: 'Lý do nghiệp vụ khác'
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Chi Tiết Bút Toán Thoái Thu & Hoàn Trả</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded">
                  #{record.id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Ghi nhận giảm trừ kỳ đóng và thu hồi hoa hồng cán bộ thu
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

        {/* Content Body */}
        <div className="mt-4 space-y-4 text-xs">
          {/* 1. Thông tin Khách hàng */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 text-[13px] mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-600" /> Thông Tin Người Tham Gia
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Họ và tên:</span>
                <strong className="text-slate-900 font-bold">{record.name}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Số CCCD / ĐDCN:</span>
                <span className="font-mono text-slate-800 font-semibold">{record.cccd || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Mã số BHXH:</span>
                <span className="font-mono text-slate-800 font-semibold">{record.bhxh || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Số điện thoại:</span>
                <span className="text-slate-800">{record.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Nghiệp vụ:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                  {record.type}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Hồ sơ gốc liên kết:</span>
                <span className="font-mono text-blue-700 font-bold">
                  {record.originalRecordId ? `#${record.originalRecordId}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* 2. Tài chính & Giảm trừ kỳ đóng */}
          <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 space-y-3">
            <div className="font-bold text-rose-900 text-[13px] flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-rose-700" /> Hạch Toán Thoái Thu & Thu Hồi
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-white rounded-lg border border-rose-100">
                <span className="text-slate-500 block text-[11px]">Tiền thoái thu hoàn trả:</span>
                <div className="font-black text-rose-600 text-base">
                  -{formatMoney(Math.abs(Number(record.amount) || 0))}
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-rose-100">
                <span className="text-slate-500 block text-[11px]">Thu hồi hoa hồng cán bộ:</span>
                <div className="font-black text-rose-700 text-base">
                  -{formatMoney(commissionClawed)}
                </div>
              </div>
              <div className="p-2.5 bg-white rounded-lg border border-rose-100">
                <span className="text-slate-500 block text-[11px]">Kỳ đóng giảm trừ:</span>
                <div className="font-bold text-slate-900 text-sm">
                  {record.fromMonth && record.toMonth
                    ? `${formatMonthVN(record.fromMonth)} - ${formatMonthVN(record.toMonth)}`
                    : (record.fromMonth ? formatMonthVN(record.fromMonth) : '---')}
                </div>
                <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                  (Không còn tính đã đóng BHXH)
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-slate-700 pt-1 border-t border-rose-100 text-[11px]">
              <div>
                <span className="text-slate-500 block">Ngày hạch toán:</span>
                <span className="font-mono font-bold text-slate-800">
                  {record.date ? new Date(record.date).toLocaleDateString('vi-VN') : 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Cán bộ thu chịu trách nhiệm:</span>
                <span className="font-bold text-slate-900">{assignedStaff?.name || record.staffId}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Mã cán bộ thu:</span>
                <span className="font-mono text-slate-700">{assignedStaff?.staffCode || record.staffId}</span>
              </div>
            </div>
          </div>

          {/* 3. Căn cứ Pháp lý & Lý do */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="font-bold text-slate-800 text-[13px] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-600" /> Căn Cứ Pháp Lý & Lý Do Thoái Thu
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block">Số QĐ / Công văn BHXH:</span>
                <strong className="text-slate-900 font-bold">{record.decisionNumber || 'Chưa có'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Ngày ban hành QĐ:</span>
                <span className="text-slate-800 font-mono">
                  {record.decisionDate ? new Date(record.decisionDate).toLocaleDateString('vi-VN') : 'N/A'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Loại hình thoái thu:</span>
                <span className="font-bold text-slate-800">
                  {record.refundType ? (refundTypeLabels[record.refundType] || record.refundType) : 'Theo quyết định BHXH'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Nội dung / Lý do chi tiết:</span>
                <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 mt-1 leading-relaxed">
                  {record.adjustmentReason || record.notes || 'Không có ghi chú thêm'}
                </p>
              </div>
            </div>
          </div>

          {/* 4. Hình thức hoàn trả */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="font-bold text-slate-800 text-[13px] mb-2 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-slate-600" /> Hình Thức Chi Hoàn
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500 block">Phương thức:</span>
                <span className="font-bold text-slate-900">
                  {record.refundMethod === 'CHUYEN_KHOAN' ? 'Chuyển khoản (VietQR)' : 'Tiền mặt tại điểm thu'}
                </span>
              </div>
              {record.refundMethod === 'CHUYEN_KHOAN' && (
                <>
                  <div>
                    <span className="text-slate-500 block">Người thụ hưởng:</span>
                    <strong className="text-slate-900">{record.refundBeneficiaryName || record.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Số tài khoản:</span>
                    <span className="font-mono text-slate-900 font-bold">{record.refundBeneficiaryAccount || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ngân hàng:</span>
                    <span className="text-slate-900 font-semibold">{record.refundBeneficiaryBank || 'N/A'}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <Printer className="w-4 h-4" /> In Bút Toán
          </button>
          <div className="flex items-center gap-2">
            {isAdminOrManager && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(record);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm"
              >
                <Pencil className="w-4 h-4" /> Sửa Bút Toán
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
