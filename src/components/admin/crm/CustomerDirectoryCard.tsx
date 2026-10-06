import React from 'react';
import { Phone, Eye, EyeOff, History, QrCode, Copy, RefreshCw, Edit, Trash2 } from 'lucide-react';
import { CustomerParticipationBadge, CustomerStatusBadge } from '../../common/CustomerStatusBadge';
import { formatDateVN, formatMonthVN, calculateNextPaymentFromToMonth } from '../../../utils/helpers';

export interface CustomerDirectoryCardProps {
  customer: any;
  isSelected: boolean;
  isFullyRevealed: boolean;
  isPIIMasked?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSelect: (id: number | string) => void;
  onTogglePII: (id: number) => void;
  onViewHistory: (customer: any) => void;
  onVietQrClick: (customer: any) => void;
  onCopyZalo: (customer: any) => void;
  onExtend: (customer: any) => void;
  onEdit: (customer: any) => void;
  onDelete: (customer: any) => void;
  onStatusClick: (customer: any) => void;
  renderPII: (val: string, type: 'CCCD' | 'PHONE' | 'BHXH', id?: number) => React.ReactNode;
}

export const CustomerDirectoryCard: React.FC<CustomerDirectoryCardProps> = ({
  customer: c,
  isSelected,
  isFullyRevealed,
  isPIIMasked = false,
  canEdit,
  canDelete,
  onSelect,
  onTogglePII,
  onViewHistory,
  onVietQrClick,
  onCopyZalo,
  onExtend,
  onEdit,
  onDelete,
  onStatusClick,
  renderPII
}) => {
  const rawCccd = c.cccd || '';
  const rawPhone = c.phone || '';
  const rawBhxh = c.bhxh || '';

  const fromM = c.from_month || c.fromMonth || '';
  const toM = c.to_month || c.toMonth || '';
  const fromMStr = fromM ? formatMonthVN(fromM) : '';
  const toMStr = toM ? formatMonthVN(toM) : '';
  const periodStr = (fromMStr && toMStr) ? `${fromMStr} - ${toMStr}` : (fromMStr || toMStr || '---');

  let nextPay = c.next_payment || c.nextPayment || null;
  if (!nextPay && (toM || fromM)) {
    nextPay = calculateNextPaymentFromToMonth(toM || fromM, Number(c.months) || 1);
  }
  const payStatus = c.payment_status || c.paymentStatus || 'Chờ thu tiền';

  return (
    <div 
      className={`bg-white rounded-xl p-4 border transition-all duration-150 shadow-xs hover:border-slate-300 hover:shadow-sm flex flex-col justify-between ${
        isSelected ? 'border-blue-400 bg-blue-50/20' : 'border-slate-200'
      }`}
    >
      <div>
        {/* Header card: Tên & Badge loại hình */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => c.id && onSelect(c.id)}
              className="w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] cursor-pointer shrink-0"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm truncate" title={c.name}>
                {c.name}
              </h3>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone size={11} className="text-slate-400 shrink-0" />
                {renderPII(rawPhone, 'PHONE', c.id)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
              c.type === 'BHXH' ? 'bg-blue-50 text-[#004182] border border-blue-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
            }`}>
              {c.type}
            </span>
            {isPIIMasked && c.id && (
              <button
                type="button"
                onClick={() => onTogglePII(c.id)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title={isFullyRevealed ? "Ẩn PII của khách hàng này" : "Hiện PII của khách hàng này"}
              >
                {isFullyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Thông tin định danh chi tiết */}
        <div className="space-y-1.5 py-2 border-t border-b border-slate-100 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-slate-400 text-[11px]">Định danh CCCD:</span>
            <span className="font-mono text-slate-800 font-medium">
              {renderPII(rawCccd, 'CCCD', c.id)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-slate-400 text-[11px]">Mã số BHXH:</span>
            <span className="font-mono text-slate-800 font-medium">
              {renderPII(rawBhxh, 'BHXH', c.id)}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-slate-400 text-[11px]">Kỳ đóng:</span>
            <span className="font-mono text-slate-800 font-medium">
              {periodStr}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-600">
            <span className="text-slate-400 text-[11px]">Hạn nộp tiếp theo:</span>
            <span className="text-slate-700 font-medium font-mono tabular-nums">
              {nextPay ? formatDateVN(nextPay) : '---'}
            </span>
          </div>
        </div>

        {/* Trạng thái tham gia & thanh toán */}
        <div className="flex items-center justify-between mt-2.5">
          <CustomerParticipationBadge
            status={c.status || 'Đang tham gia'}
            interactive={Boolean(c.id)}
            onClick={() => onStatusClick(c)}
          />
          <CustomerStatusBadge 
            payment_status={payStatus} 
            paymentStatus={payStatus} 
            next_payment={nextPay} 
            nextPayment={nextPay} 
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 text-slate-500">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onViewHistory(c)}
            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition cursor-pointer"
            title="Xem lịch sử đóng phí"
          >
            <History size={15} />
          </button>
          <button
            type="button"
            onClick={() => onVietQrClick(c)}
            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition cursor-pointer"
            title="Mã VietQR nộp tiền"
          >
            <QrCode size={15} />
          </button>
          <button
            type="button"
            onClick={() => onCopyZalo(c)}
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
            title="Sao chép tin nhắn Zalo đôn đốc"
          >
            <Copy size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onExtend(c)}
            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition cursor-pointer"
            title="Gia hạn hồ sơ"
          >
            <RefreshCw size={15} />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onEdit(c)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title="Chỉnh sửa hồ sơ"
            >
              <Edit size={15} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(c)}
              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition cursor-pointer"
              title="Xóa khách hàng"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
