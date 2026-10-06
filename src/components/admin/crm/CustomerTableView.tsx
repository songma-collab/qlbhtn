import React from 'react';
import { 
  Phone, Eye, EyeOff, UserCheck, History, QrCode, 
  UserPlus, Copy, Zap, Edit, Trash2 
} from 'lucide-react';
import { formatDateVN, formatMonthVN, calculateNextPaymentFromToMonth } from '../../../utils/helpers';
import { CustomerStatusBadge, CustomerParticipationBadge } from '../../common/CustomerStatusBadge';

interface CustomerTableViewProps {
  customers: any[];
  selectedIds: (number | string)[];
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectRow: (id: number | string) => void;
  renderCustomerPII: (val: string | null | undefined, type: 'CCCD' | 'PHONE' | 'BHXH', id?: any) => React.ReactNode;
  toggleRowPII: (id: any) => void;
  revealedRowIds: Set<any>;
  isPIIMasked: boolean;
  isAdminOrManager: boolean;
  currentUser: any;
  canEditCustomer: boolean;
  canDeleteCustomer: boolean;
  onStatusClick: (r: any) => void;
  onParticipationClick: (r: any) => void;
  onViewHistory: (r: any) => void;
  onVietQrClick: (r: any) => void;
  onAssignClick: (id: any) => void;
  onCopyZalo: (r: any) => void;
  onExtendClick: (r: any) => void;
  onEditClick: (r: any) => void;
  onDeleteClick: (id: any) => void;
}

export const CustomerTableView: React.FC<CustomerTableViewProps> = ({
  customers,
  selectedIds,
  onSelectAll,
  onSelectRow,
  renderCustomerPII,
  toggleRowPII,
  revealedRowIds,
  isPIIMasked,
  isAdminOrManager,
  currentUser,
  canEditCustomer,
  canDeleteCustomer,
  onStatusClick,
  onParticipationClick,
  onViewHistory,
  onVietQrClick,
  onAssignClick,
  onCopyZalo,
  onExtendClick,
  onEditClick,
  onDeleteClick,
}) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={customers.length > 0 && selectedIds.length === customers.length}
                  onChange={onSelectAll}
                  className="w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] cursor-pointer"
                />
              </th>
              <th className="p-4">Họ & Tên Khách Hàng</th>
              <th className="p-4">Số ĐDCN / CCCD</th>
              <th className="p-4">Số Điện Thoại</th>
              <th className="p-4">Kỳ đóng</th>
              <th className="p-4">Hạn đóng tiếp</th>
              <th className="p-4">Trạng Thái Đóng</th>
              <th className="p-4">Trạng Thái KH</th>
              <th className="p-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map((r, index) => {
              const rawCccd = r.cccd || '';
              const rawBhxh = r.bhxh || '';
              const rawPhone = r.phone || '';
              const oldBhxh = r.old_bhxh || r.oldBhxh;
              const hasOldBhxh = Boolean(oldBhxh && oldBhxh !== rawCccd);
              const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
              const isFullyRevealed = !isPIIMasked || isRowRevealed || isAdminOrManager;

              const fromM = r.from_month || r.fromMonth || '';
              const toM = r.to_month || r.toMonth || '';
              const fromMStr = fromM ? formatMonthVN(fromM) : '';
              const toMStr = toM ? formatMonthVN(toM) : '';
              const periodStr = (fromMStr && toMStr) ? `${fromMStr} - ${toMStr}` : (fromMStr || toMStr || '---');

              let nextPay = r.next_payment || r.nextPayment || null;
              if (!nextPay && (toM || fromM)) {
                nextPay = calculateNextPaymentFromToMonth(toM || fromM, Number(r.months) || 1);
              }
              const payStatus = r.payment_status || r.paymentStatus || 'Chờ thu tiền';

              return (
                <tr 
                  key={r.id || `row-${index}`} 
                  className={`hover:bg-slate-50/80 transition border-b border-slate-100 ${
                    r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <td className="p-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={r.id ? selectedIds.includes(r.id) : false}
                      onChange={() => r.id && onSelectRow(r.id)}
                      disabled={!r.id}
                      className="w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] disabled:opacity-50 cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                      <span>{r.name}</span>
                      {r.type && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          r.type === 'BHXH' ? 'bg-blue-50 text-[#004182] border border-blue-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}>
                          {r.type}
                        </span>
                      )}
                    </div>
                    {r.notes && (
                      <div className="mt-1 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md inline-block max-w-[260px] truncate" title={r.notes}>
                        <span className="font-semibold text-slate-400">Ghi chú:</span> {r.notes}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-mono tabular-nums text-slate-800 font-medium">
                      {renderCustomerPII(rawCccd, 'CCCD', r.id)}
                    </div>
                    {hasOldBhxh && (
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1" title="Mã số BHXH 10 số cũ (trước đồng bộ CCCD)">
                        <span className="text-slate-400">Mã cũ:</span>
                        <span>{renderCustomerPII(oldBhxh, 'BHXH', r.id)}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} className="text-[#004182] shrink-0" />
                      <span className="font-mono tabular-nums text-slate-800 font-medium text-xs">
                        {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                      </span>
                      {r.id && (
                        <button
                          type="button"
                          onClick={() => toggleRowPII(r.id)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 transition cursor-pointer"
                          title={isFullyRevealed ? "Ẩn số điện thoại" : "Hiện số điện thoại"}
                        >
                          {isFullyRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono tabular-nums text-slate-800 font-medium text-xs">
                      {periodStr}
                    </span>
                  </td>
                  <td className="p-4 text-slate-700 text-xs font-medium">
                    {nextPay ? (
                      <span className="font-mono tabular-nums">
                        {formatDateVN(nextPay)}
                      </span>
                    ) : '---'}
                  </td>
                  <td className="p-4">
                    <CustomerStatusBadge 
                      payment_status={payStatus} 
                      paymentStatus={payStatus} 
                      next_payment={nextPay} 
                      nextPayment={nextPay} 
                    />
                  </td>
                  <td className="p-4">
                    <CustomerParticipationBadge 
                      status={r.status || 'Đang tham gia'} 
                      interactive={Boolean(r.id)}
                      onClick={() => r.id && onStatusClick(r)} 
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1">
                      <button 
                        type="button"
                        onClick={() => r.id && onStatusClick(r)} 
                        disabled={!r.id} 
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Đổi trạng thái Đang tham gia / Dừng đóng"
                      >
                        <UserCheck size={15} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onParticipationClick(r)} 
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Hồ sơ tham gia trước đây"
                      >
                        <History size={15} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onViewHistory(r)} 
                        disabled={!r.id} 
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Xem kết quả tra cứu quá trình"
                      >
                        <Eye size={15} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => onVietQrClick(r)} 
                        disabled={!r.id} 
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Mã VietQR nộp tiền"
                      >
                        <QrCode size={15} />
                      </button>
                      {currentUser?.role !== 'Nhân viên' && (
                        <button 
                          type="button"
                          onClick={() => r.id && onAssignClick(r.id)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 disabled:opacity-50 transition cursor-pointer" 
                          title="Phân công nhân viên"
                        >
                          <UserPlus size={15} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={() => r.id && onCopyZalo(r)} 
                        disabled={!r.id} 
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Sao chép tin nhắn Zalo"
                      >
                        <Copy size={15} />
                      </button>
                      <button 
                        type="button"
                        onClick={() => r.id && onExtendClick(r)} 
                        disabled={!r.id} 
                        className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50 transition cursor-pointer" 
                        title="Gia hạn hồ sơ"
                      >
                        <Zap size={15} />
                      </button>
                      {canEditCustomer && (
                        <button 
                          type="button"
                          onClick={() => r.id && onEditClick(r)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-[#004182] hover:bg-blue-50 disabled:opacity-50 transition cursor-pointer" 
                          title="Sửa thông tin"
                        >
                          <Edit size={15} />
                        </button>
                      )}
                      {canDeleteCustomer && (
                        <button 
                          type="button"
                          onClick={() => r.id && onDeleteClick(r.id)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50 transition cursor-pointer" 
                          title="Xóa"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={9} className="p-12 text-center text-slate-500">
                  Không tìm thấy hồ sơ khách hàng nào phù hợp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden divide-y divide-slate-100">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Không tìm thấy hồ sơ nào phù hợp.
          </div>
        ) : (
          customers.map((r, index) => {
            const rawCccd = r.cccd || '';
            const rawBhxh = r.bhxh || '';
            const rawPhone = r.phone || '';
            const oldBhxh = r.old_bhxh || r.oldBhxh;
            const hasOldBhxh = Boolean(oldBhxh && oldBhxh !== rawCccd);
            const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
            const isFullyRevealed = !isPIIMasked || isRowRevealed || isAdminOrManager;

            const fromM = r.from_month || r.fromMonth || '';
            const toM = r.to_month || r.toMonth || '';
            const fromMStr = fromM ? formatMonthVN(fromM) : '';
            const toMStr = toM ? formatMonthVN(toM) : '';
            const periodStr = (fromMStr && toMStr) ? `${fromMStr} - ${toMStr}` : (fromMStr || toMStr || '---');

            let nextPay = r.next_payment || r.nextPayment || null;
            if (!nextPay && (toM || fromM)) {
              nextPay = calculateNextPaymentFromToMonth(toM || fromM, Number(r.months) || 1);
            }
            const payStatus = r.payment_status || r.paymentStatus || 'Chờ thu tiền';

            return (
              <div 
                key={r.id || `mob-${index}`} 
                className={`p-4 ${r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-start gap-2.5">
                    <input 
                      type="checkbox" 
                      checked={r.id ? selectedIds.includes(r.id) : false}
                      onChange={() => r.id && onSelectRow(r.id)}
                      className="mt-1 w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] cursor-pointer"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{r.name}</h4>
                      {r.notes ? (
                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={r.notes}>
                          {r.notes}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-slate-400" />
                          {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      r.type === 'BHXH' ? 'bg-blue-50 text-[#004182] border border-blue-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
                    }`}>
                      {r.type}
                    </span>
                    {r.id && (
                      <button
                        type="button"
                        onClick={() => toggleRowPII(r.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600"
                        title="Bật/Tắt che PII"
                      >
                        {isFullyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Định danh CCCD</span>
                    <span className="font-mono font-medium text-slate-800">
                      {renderCustomerPII(rawCccd, 'CCCD', r.id)}
                    </span>
                    {hasOldBhxh && (
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Mã cũ: {renderCustomerPII(oldBhxh, 'BHXH', r.id)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Số điện thoại</span>
                    <span className="font-mono font-medium text-slate-800">
                      {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kỳ đóng</span>
                    <span className="font-mono font-medium text-slate-800">
                      {periodStr}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Hạn đóng tiếp</span>
                    <span className="text-slate-700 font-medium font-mono tabular-nums">
                      {nextPay ? formatDateVN(nextPay) : '---'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-400 block">Trạng thái đóng</span>
                    <CustomerStatusBadge 
                      payment_status={payStatus} 
                      paymentStatus={payStatus} 
                      next_payment={nextPay} 
                      nextPayment={nextPay} 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-1 pt-1">
                  <CustomerParticipationBadge 
                    status={r.status || 'Đang tham gia'} 
                    interactive={Boolean(r.id)}
                    onClick={() => r.id && onStatusClick(r)} 
                  />
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => onViewHistory(r)} 
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                      title="Lịch sử"
                    >
                      <History size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => onVietQrClick(r)} 
                      className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                      title="VietQR"
                    >
                      <QrCode size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => onCopyZalo(r)} 
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                      title="Zalo"
                    >
                      <Copy size={15} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => onExtendClick(r)} 
                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                      title="Gia hạn"
                    >
                      <Zap size={15} />
                    </button>
                    {canEditCustomer && (
                      <button 
                        type="button"
                        onClick={() => onEditClick(r)} 
                        className="p-1.5 rounded-lg text-[#004182] hover:bg-blue-50"
                        title="Sửa"
                      >
                        <Edit size={15} />
                      </button>
                    )}
                    {canDeleteCustomer && (
                      <button 
                        type="button"
                        onClick={() => onDeleteClick(r.id)} 
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                        title="Xóa"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
