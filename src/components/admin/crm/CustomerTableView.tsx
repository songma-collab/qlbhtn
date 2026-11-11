import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, Eye, EyeOff, UserCheck, History, QrCode, 
  UserPlus, Copy, Zap, Edit, Trash2, MoreHorizontal 
} from 'lucide-react';
import { formatDateVN, formatMonthVN, calculateNextPaymentFromToMonth } from '../../../utils/helpers';
import { CustomerStatusBadge, CustomerParticipationBadge } from '../../common/CustomerStatusBadge';

interface CustomerTableViewProps {
  customers: any[];
  selectedIds: (number | string)[];
  staffList?: any[];
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
  staffList = [],
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
  const safeStaffList = Array.isArray(staffList) ? staffList : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
  const safeCustomers = Array.isArray(customers) ? customers.filter(Boolean) : [];

  // Trạng thái mở menu thao tác phụ cho từng dòng
  const [activeActionMenuId, setActiveActionMenuId] = useState<any>(null);

  // Lắng nghe sự kiện click bên ngoài để tự động đóng dropdown menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveActionMenuId(null);
      }
    };

    if (activeActionMenuId) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeActionMenuId]);

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-300 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  checked={
                    safeCustomers.length > 0 && 
                    safeCustomers.every(c => {
                      const cid = c?.id || c?.customer_key || (c as any)?.customerKey || c?.cccd || c?.bhxh;
                      return cid && safeSelectedIds.some(sid => String(sid) === String(cid) || (c?.id && String(sid) === String(c.id)));
                    })
                  }
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
              <th className="p-4 text-center font-bold whitespace-nowrap">THAO TÁC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {safeCustomers.map((r, index) => {
              if (!r) return null;
              const rawCccd = r.cccd || '';
              const rawBhxh = r.bhxh || '';
              const rawPhone = r.phone || '';
              const oldBhxh = r.old_bhxh || r.oldBhxh;
              const hasOldBhxh = Boolean(oldBhxh && oldBhxh !== rawCccd);
              const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
              const isFullyRevealed = !isPIIMasked || isRowRevealed;

              const assignedStaff = safeStaffList.find(s => s && s.id === (r.staff_id || r.staffId));

              const rowId = r.id || r.customer_key || (r as any).customerKey || r.cccd || r.bhxh;
              const isRowSelected = rowId ? safeSelectedIds.some(sid => String(sid) === String(rowId) || (r.id && String(sid) === String(r.id))) : false;

              const fromM = r.from_month || r.fromMonth || '';
              const toM = r.to_month || r.toMonth || '';
              const fromMStr = fromM ? formatMonthVN(fromM) : '';
              const toMStr = toM ? formatMonthVN(toM) : '';
              const periodStr = (fromMStr && toMStr) ? `${fromMStr} - ${toMStr}` : (fromMStr || toMStr || '---');

              let nextPay = (toM || fromM)
                ? calculateNextPaymentFromToMonth(toM || fromM, r.months || (r as any).method || 1, r.type)
                : (r.next_payment || r.nextPayment || null);
              const payStatus = r.payment_status || r.paymentStatus || 'Chờ thu tiền';

              return (
                <tr 
                  key={rowId || `row-${index}`} 
                  className={`hover:bg-slate-50/80 transition border-b border-slate-100 ${
                    isRowSelected ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <td className="p-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={isRowSelected}
                      onChange={() => rowId && onSelectRow(rowId)}
                      disabled={!rowId}
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
                    {assignedStaff && (
                      <div className="mt-1 text-[11px] text-purple-700 bg-purple-50/80 border border-purple-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1 font-medium" title={`Cán bộ phụ trách: ${assignedStaff.name}`}>
                        <UserCheck size={11} className="shrink-0 text-purple-600" />
                        <span>NV: {assignedStaff.name}</span>
                      </div>
                    )}
                    {r.notes && (
                      <div className="mt-1 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md inline-block max-w-[260px] truncate" title={r.notes}>
                        <span className="font-semibold text-slate-500">Ghi chú:</span> {r.notes}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-900 font-semibold text-[13px]">
                      <span>{renderCustomerPII(rawCccd, 'CCCD', r.id)}</span>
                      {isPIIMasked && r.id && (
                        <button
                          type="button"
                          onClick={() => toggleRowPII(r.id)}
                          className="text-slate-500 hover:text-slate-700 p-0.5 transition cursor-pointer"
                          title={isRowRevealed ? "Ẩn dữ liệu định danh (CCCD, SĐT)" : "Hiện dữ liệu định danh (CCCD, SĐT)"}
                        >
                          {isRowRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                    {hasOldBhxh && (
                      <div className="text-[12px] text-slate-600 font-mono mt-0.5 flex items-center gap-1" title="Mã số BHXH 10 số cũ (trước đồng bộ CCCD)">
                        <span className="text-slate-500 font-medium">Mã cũ:</span>
                        <span>{renderCustomerPII(oldBhxh, 'BHXH', r.id)}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <Phone size={13.5} className="text-[#004182] shrink-0" />
                      <span className="font-mono tabular-nums text-slate-900 font-semibold text-[13px]">
                        {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                      </span>
                      {isPIIMasked && r.id && (
                        <button
                          type="button"
                          onClick={() => toggleRowPII(r.id)}
                          className="text-slate-500 hover:text-slate-700 p-0.5 transition cursor-pointer"
                          title={isRowRevealed ? "Ẩn dữ liệu định danh (CCCD, SĐT)" : "Hiện dữ liệu định danh (CCCD, SĐT)"}
                        >
                          {isRowRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="font-mono tabular-nums text-slate-900 font-semibold text-[13px]">
                      {periodStr}
                    </span>
                  </td>
                  <td className="p-4 text-slate-800 text-[13px] font-semibold">
                    {nextPay ? (
                      <span 
                        className="font-mono tabular-nums font-bold cursor-help border-b border-dashed border-slate-500 text-[13px]"
                        title="Hạn chót luật định theo Khoản 3 Điều 36 Luật BHXH 2024"
                      >
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
                    {(() => {
                      const isActionMenuOpen = Boolean(rowId && activeActionMenuId === rowId);
                      const isNearBottom = index >= safeCustomers.length - 2 && safeCustomers.length >= 3;

                      return (
                        <div className="flex items-center justify-center gap-1.5 relative action-menu-container">
                          {/* 1. Nút Hành Động Chính 1: Gia Hạn / Phát Sinh (⚡) */}
                          <button 
                            type="button"
                            onClick={() => r.id && onExtendClick(r)} 
                            disabled={!r.id} 
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 hover:border-amber-300 border border-amber-200/80 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-2xs" 
                            title="Gia hạn hồ sơ / Phát sinh kỳ đóng mới"
                          >
                            <Zap size={14} className="text-amber-600 fill-amber-500" />
                            <span>Gia hạn</span>
                          </button>

                          {/* 2. Nút Hành Động Chính 2: Tra Cứu Quá Trình (👁️) */}
                          <button 
                            type="button"
                            onClick={() => onViewHistory(r)} 
                            disabled={!r.id} 
                            className="p-1.5 rounded-lg text-[#004182] bg-blue-50 hover:bg-blue-100 hover:border-blue-300 border border-blue-200/80 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-2xs" 
                            title="Xem kết quả tra cứu quá trình tham gia BHXH"
                          >
                            <Eye size={16} />
                          </button>

                          {/* 3. Menu Thao Tác Bổ Trợ [...] */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(isActionMenuOpen ? null : rowId);
                              }}
                              className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 border ${
                                isActionMenuOpen 
                                  ? 'bg-slate-200 text-slate-900 border-slate-300 shadow-inner' 
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 shadow-2xs'
                              }`}
                              title="Thao tác bổ trợ (VietQR, Zalo, Phân công, Sửa, Xóa...)"
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            {isActionMenuOpen && (
                              <div 
                                className={`absolute right-0 ${
                                  isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                                } w-56 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-left animate-tab-fade text-xs`}
                                role="menu"
                              >
                                <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Thao tác bổ trợ
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); onVietQrClick(r); }}
                                  disabled={!r.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition text-left cursor-pointer"
                                >
                                  <QrCode size={15} className="text-sky-600 shrink-0" />
                                  <span>Tạo mã VietQR nộp tiền</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); onCopyZalo(r); }}
                                  disabled={!r.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition text-left cursor-pointer"
                                >
                                  <Copy size={15} className="text-emerald-600 shrink-0" />
                                  <span>Sao chép tin nhắn Zalo</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); onParticipationClick(r); }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition text-left cursor-pointer"
                                >
                                  <History size={15} className="text-indigo-600 shrink-0" />
                                  <span>Hồ sơ tham gia trước đây</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); onStatusClick(r); }}
                                  disabled={!r.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition text-left cursor-pointer"
                                >
                                  <UserCheck size={15} className="text-amber-600 shrink-0" />
                                  <span>Đổi trạng thái tham gia</span>
                                </button>

                                {currentUser?.role !== 'Nhân viên' && (
                                  <button
                                    type="button"
                                    onClick={() => { setActiveActionMenuId(null); r.id && onAssignClick(r.id); }}
                                    disabled={!r.id}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition text-left cursor-pointer"
                                  >
                                    <UserPlus size={15} className="text-purple-600 shrink-0" />
                                    <span>Phân công cán bộ quản lý</span>
                                  </button>
                                )}

                                {canEditCustomer && (
                                  <button
                                    type="button"
                                    onClick={() => { setActiveActionMenuId(null); r.id && onEditClick(r); }}
                                    disabled={!r.id}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 hover:text-[#004182] transition text-left cursor-pointer"
                                  >
                                    <Edit size={15} className="text-[#004182] shrink-0" />
                                    <span>Chỉnh sửa thông tin</span>
                                  </button>
                                )}

                                {canDeleteCustomer && (
                                  <div className="pt-1 mt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => { setActiveActionMenuId(null); r.id && onDeleteClick(r.id); }}
                                      disabled={!r.id}
                                      className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer font-medium"
                                    >
                                      <Trash2 size={15} className="text-rose-500 shrink-0" />
                                      <span>Xóa khách hàng</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
            {safeCustomers.length === 0 && (
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
        {safeCustomers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Không tìm thấy hồ sơ nào phù hợp.
          </div>
        ) : (
          safeCustomers.map((r, index) => {
            if (!r) return null;
            const rawCccd = r.cccd || '';
            const rawBhxh = r.bhxh || '';
            const rawPhone = r.phone || '';
            const oldBhxh = r.old_bhxh || r.oldBhxh;
            const hasOldBhxh = Boolean(oldBhxh && oldBhxh !== rawCccd);
            const isRowRevealed = r.id ? revealedRowIds.has(r.id) : false;
            const isFullyRevealed = !isPIIMasked || isRowRevealed;

            const rowId = r.id || r.customer_key || (r as any).customerKey || r.cccd || r.bhxh;
            const isRowSelected = rowId ? safeSelectedIds.some(sid => String(sid) === String(rowId) || (r.id && String(sid) === String(r.id))) : false;

            const fromM = r.from_month || r.fromMonth || '';
            const toM = r.to_month || r.toMonth || '';
            const fromMStr = fromM ? formatMonthVN(fromM) : '';
            const toMStr = toM ? formatMonthVN(toM) : '';
            const periodStr = (fromMStr && toMStr) ? `${fromMStr} - ${toMStr}` : (fromMStr || toMStr || '---');

            let nextPay = (toM || fromM)
              ? calculateNextPaymentFromToMonth(toM || fromM, r.months || (r as any).method || 1, r.type)
              : (r.next_payment || r.nextPayment || null);
            const payStatus = r.payment_status || r.paymentStatus || 'Chờ thu tiền';

            const assignedStaff = safeStaffList.find(s => s && s.id === (r.staff_id || r.staffId));

            return (
              <div 
                key={rowId || `mob-${index}`} 
                className={`p-4 ${isRowSelected ? 'bg-blue-50/40' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2.5">
                  <div className="flex items-start gap-2.5">
                    <input 
                      type="checkbox" 
                      checked={isRowSelected}
                      onChange={() => rowId && onSelectRow(rowId)}
                      disabled={!rowId}
                      className="mt-1 w-4 h-4 text-[#004182] rounded border-slate-300 focus:ring-[#004182] disabled:opacity-50 cursor-pointer"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{r.name}</h4>
                      {assignedStaff && (
                        <div className="mt-0.5 text-[10px] text-purple-700 bg-purple-50/80 border border-purple-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-medium">
                          <UserCheck size={10} className="shrink-0 text-purple-600" />
                          <span>NV: {assignedStaff.name}</span>
                        </div>
                      )}
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
                    {isPIIMasked && r.id && (
                      <button
                        type="button"
                        onClick={() => toggleRowPII(r.id)}
                        className="p-1 rounded text-slate-400 hover:text-slate-600"
                        title={isRowRevealed ? "Ẩn PII của khách hàng này" : "Hiện PII của khách hàng này"}
                      >
                        {isRowRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Định danh CCCD</span>
                    <span className="font-mono font-medium text-slate-800">
                      {renderCustomerPII(rawCccd, 'CCCD', r.id)}
                    </span>
                    {hasOldBhxh && (
                      <span className="text-[10px] text-slate-600 block font-mono">
                        Mã cũ: {renderCustomerPII(oldBhxh, 'BHXH', r.id)}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Số điện thoại</span>
                    <span className="font-mono font-medium text-slate-800">
                      {renderCustomerPII(rawPhone, 'PHONE', r.id)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Kỳ đóng</span>
                    <span className="font-mono font-medium text-slate-800">
                      {periodStr}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold block">Hạn đóng tiếp</span>
                    <span 
                      className="text-slate-800 font-bold font-mono tabular-nums cursor-help border-b border-dashed border-slate-400"
                      title="Hạn chót luật định theo Khoản 3 Điều 36 Luật BHXH 2024"
                    >
                      {nextPay ? formatDateVN(nextPay) : '---'}
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] text-slate-500 font-semibold block">Trạng thái đóng</span>
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
                  {(() => {
                    const mobMenuId = `mob-${rowId}`;
                    const isMobMenuOpen = Boolean(rowId && activeActionMenuId === mobMenuId);

                    return (
                      <div className="flex items-center gap-1.5 relative action-menu-container">
                        {/* 1. Nút Gia hạn nổi bật */}
                        <button 
                          type="button"
                          onClick={() => r.id && onExtendClick(r)} 
                          disabled={!r.id} 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 active:scale-95 transition shadow-2xs"
                          title="Gia hạn hồ sơ"
                        >
                          <Zap size={13} className="text-amber-600 fill-amber-500" />
                          <span>Gia hạn</span>
                        </button>

                        {/* 2. Nút Tra cứu */}
                        <button 
                          type="button"
                          onClick={() => onViewHistory(r)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-[#004182] bg-blue-50 hover:bg-blue-100 border border-blue-200 active:scale-95 transition shadow-2xs"
                          title="Xem lịch sử tra cứu"
                        >
                          <Eye size={15} />
                        </button>

                        {/* 3. Nút Menu thao tác khác [...] */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveActionMenuId(isMobMenuOpen ? null : mobMenuId);
                            }}
                            className={`p-1.5 rounded-lg transition active:scale-95 border ${
                              isMobMenuOpen
                                ? 'bg-slate-200 text-slate-900 border-slate-300'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200 shadow-2xs'
                            }`}
                            title="Thao tác khác"
                          >
                            <MoreHorizontal size={15} />
                          </button>

                          {isMobMenuOpen && (
                            <div 
                              className="absolute right-0 bottom-full mb-1.5 w-52 bg-white rounded-xl shadow-xl border border-slate-200/90 py-1.5 z-50 text-left animate-tab-fade text-xs"
                              role="menu"
                            >
                              <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                Thao tác bổ trợ
                              </div>

                              <button
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); onVietQrClick(r); }}
                                disabled={!r.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-sky-50 transition text-left cursor-pointer"
                              >
                                <QrCode size={14} className="text-sky-600 shrink-0" />
                                <span>Mã VietQR nộp tiền</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); onCopyZalo(r); }}
                                disabled={!r.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 transition text-left cursor-pointer"
                              >
                                <Copy size={14} className="text-emerald-600 shrink-0" />
                                <span>Sao chép tin Zalo</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); onParticipationClick(r); }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-indigo-50 transition text-left cursor-pointer"
                              >
                                <History size={14} className="text-indigo-600 shrink-0" />
                                <span>Hồ sơ tham gia trước đây</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => { setActiveActionMenuId(null); onStatusClick(r); }}
                                disabled={!r.id}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-amber-50 transition text-left cursor-pointer"
                              >
                                <UserCheck size={14} className="text-amber-600 shrink-0" />
                                <span>Đổi trạng thái tham gia</span>
                              </button>

                              {currentUser?.role !== 'Nhân viên' && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); r.id && onAssignClick(r.id); }}
                                  disabled={!r.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-purple-50 transition text-left cursor-pointer"
                                >
                                  <UserPlus size={14} className="text-purple-600 shrink-0" />
                                  <span>Phân công cán bộ</span>
                                </button>
                              )}

                              {canEditCustomer && (
                                <button
                                  type="button"
                                  onClick={() => { setActiveActionMenuId(null); r.id && onEditClick(r); }}
                                  disabled={!r.id}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-blue-50 transition text-left cursor-pointer"
                                >
                                  <Edit size={14} className="text-[#004182] shrink-0" />
                                  <span>Chỉnh sửa thông tin</span>
                                </button>
                              )}

                              {canDeleteCustomer && (
                                <div className="pt-1 mt-1 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => { setActiveActionMenuId(null); r.id && onDeleteClick(r.id); }}
                                    disabled={!r.id}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 transition text-left cursor-pointer font-medium"
                                  >
                                    <Trash2 size={14} className="text-rose-500 shrink-0" />
                                    <span>Xóa khách hàng</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
