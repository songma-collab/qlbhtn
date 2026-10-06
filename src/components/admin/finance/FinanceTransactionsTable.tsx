import React from 'react';
import { 
  RotateCcw, 
  RotateCw, 
  Plus, 
  Lock, 
  CheckSquare, 
  Square, 
  QrCode, 
  Printer, 
  Image, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight 
} from 'lucide-react';
import { formatMoney, formatMonthVN, dateISOToVN, isDateLocked } from '../../../utils/helpers';
import { getCommissionRateForRecord } from '../../../utils/calculations';

export interface FinanceTransactionsTableProps {
  paginatedRecords: any[];
  totalCount: number;
  selectedIds: number[];
  handleSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectRow: (id: number) => void;
  changeStaff: (id: number, staffId: string) => void;
  changePaymentStatus: (id: number, status: string) => void;
  handleOpenBatchModalSingle: (record: any) => void;
  handlePrintReceipt: (id: number) => void;
  handleExportReceiptImage: (id: number) => void;
  confirmDelete: (id: number) => void;
  setVietQrRecord: (record: any) => void;
  setIsVietQrOpen: (open: boolean) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;
  lockedKeys: string[];
  policies: any[];
  settings: any;
  staff: any[];
  currentUser: any;
  canCollect: boolean;
  canRefund: boolean;
}

export const FinanceTransactionsTable: React.FC<FinanceTransactionsTableProps> = ({
  paginatedRecords,
  totalCount,
  selectedIds,
  handleSelectAll,
  handleSelectRow,
  changeStaff,
  changePaymentStatus,
  handleOpenBatchModalSingle,
  handlePrintReceipt,
  handleExportReceiptImage,
  confirmDelete,
  setVietQrRecord,
  setIsVietQrOpen,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage,
  setItemsPerPage,
  lockedKeys,
  policies,
  settings,
  staff,
  currentUser,
  canCollect,
  canRefund
}) => {
  return (
    <div className="bg-white rounded-b-2xl overflow-hidden border-t border-slate-200">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4 w-12 text-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-slate-300 text-[#004182] focus:ring-[#004182] cursor-pointer"
                  checked={selectedIds.length === paginatedRecords.length && paginatedRecords.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="p-4">Mã GD & Thời Gian</th>
              <th className="p-4">Khách Hàng</th>
              <th className="p-4">Loại GD</th>
              <th className="p-4">Kỳ Đóng</th>
              <th className="p-4 text-right">Số Tiền Thu</th>
              <th className="p-4 text-right">Hoa Hồng</th>
              <th className="p-4">Nhân Viên Thu</th>
              <th className="p-4">Trạng Thái</th>
              <th className="p-4 text-center">Chuyển BHXH</th>
              <th className="p-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedRecords.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-12 text-center text-slate-500">
                  Không tìm thấy giao dịch nào phù hợp với điều kiện lọc.
                </td>
              </tr>
            ) : (
              paginatedRecords.map((r: any, index: number) => {
                const recLocked = isDateLocked(r.date, lockedKeys);
                const isAdj = r.is_adjustment ?? r.isAdjustment;
                const actType = r.action_type || r.actionType;
                const pStatus = r.payment_status || r.paymentStatus || 'Chờ thanh toán';
                const sId = r.staff_id || r.staffId;
                const isSub = r.is_submitted_bhxh ?? r.isSubmittedBHXH;
                const subBatch = r.submission_batch || r.submissionBatch;
                const subDate = r.submitted_date || r.submittedDate;
                const fromM = r.from_month || r.fromMonth;
                const toM = r.to_month || r.toMonth;

                const actionTag = isAdj
                  ? <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><RotateCcw size={10} className="mr-1" /> Bù trừ âm</span>
                  : actType === 'Gia hạn' 
                    ? <span className="bg-[#FDB913]/20 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><RotateCw size={10} className="mr-1" /> Gia hạn</span>
                    : <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase flex items-center w-fit"><Plus size={10} className="mr-1" /> Mới</span>;

                const statusColors: any = {
                  'Đã thu tiền': 'text-emerald-700 bg-emerald-50 border-emerald-200',
                  'Chờ thanh toán': 'text-amber-700 bg-amber-50 border-amber-200',
                  'Đã hủy': 'text-rose-700 bg-rose-50 border-rose-200'
                };
                const colorClass = statusColors[pStatus] || statusColors['Đã thu tiền'];
                const periodStr = (fromM && toM) ? `${formatMonthVN(fromM)} - ${formatMonthVN(toM)}` : '---';

                const rate = getCommissionRateForRecord(r, policies, settings);
                const commAmount = Number(r.amount) * rate;

                return (
                  <tr 
                    key={r.id || `rec-${index}`} 
                    className={`hover:bg-slate-50/80 transition border-b border-slate-100 ${
                      recLocked ? 'bg-amber-50/20' : (r.id && selectedIds.includes(r.id) ? 'bg-blue-50/40' : '')
                    }`}
                  >
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-slate-300 text-[#004182] focus:ring-[#004182] disabled:opacity-50 cursor-pointer"
                        checked={r.id ? selectedIds.includes(r.id) : false}
                        onChange={() => r.id && handleSelectRow(r.id)}
                        disabled={!r.id || recLocked}
                        title={recLocked ? "Dữ liệu kỳ này đã bị khóa" : ""}
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-slate-600">
                          TXN{r.id ? r.id.toString().slice(-6) : 'NEW'}
                        </span>
                        {recLocked && (
                          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-0.5">
                            <Lock size={10} /> Đã khóa
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-400 block mt-0.5">
                        {new Date(r.date).toLocaleString('vi-VN', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit', year:'numeric'})}
                      </span>
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{r.bhxh || r.cccd || r.phone}</p>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`font-bold text-xs ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-sky-700'}`}>
                          {r.type}
                        </span>
                        {actionTag}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono tabular-nums text-slate-600 font-medium">
                      {periodStr}
                    </td>
                    {/* SỐ TIỀN THU: font-mono tabular-nums text-right */}
                    <td className={`p-4 font-mono tabular-nums text-right font-bold text-sm ${
                      r.amount < 0 ? 'text-rose-600' : 'text-[#004182]'
                    }`}>
                      {formatMoney(r.amount)}
                    </td>
                    {/* HOA HỒNG: font-mono tabular-nums text-right */}
                    <td className={`p-4 font-mono tabular-nums text-right font-bold text-sm ${
                      commAmount < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {commAmount > 0 ? '+' : ''}{formatMoney(commAmount)}
                    </td>
                    <td className="p-4">
                      {currentUser?.role === 'Nhân viên' ? (
                        <span className="text-xs font-medium text-slate-700">
                          {staff.find((s: any) => s.id === sId)?.name || '-- Trống --'}
                        </span>
                      ) : (
                        <select 
                          value={sId || ''} 
                          onChange={e => r.id && changeStaff(r.id, e.target.value)} 
                          disabled={!r.id || recLocked} 
                          className="text-xs font-medium rounded-lg px-2 py-1 border border-slate-200 outline-none cursor-pointer bg-white text-slate-700 max-w-[120px] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">-- Trống --</option>
                          {staff.map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="p-4">
                      <select 
                        value={pStatus} 
                        onChange={e => r.id && changePaymentStatus(r.id, e.target.value)} 
                        disabled={!r.id || recLocked || (!canCollect && !canRefund && currentUser?.role !== 'Admin')} 
                        className={`text-xs font-bold rounded-lg px-2 py-1 border outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
                      >
                        <option value="Đã thu tiền">Đã thu tiền</option>
                        <option value="Chờ thanh toán">Chờ thanh toán</option>
                        <option value="Đã hủy">Đã hủy</option>
                      </select>
                    </td>
                    <td className="p-4 text-center">
                      {isSub ? (
                        <div className="inline-flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => r.id && handleOpenBatchModalSingle(r)}
                            disabled={!r.id || recLocked}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 shadow-xs transition cursor-pointer disabled:opacity-50"
                            title="Xem/sửa đợt nộp"
                          >
                            <CheckSquare size={13} className="text-emerald-600" />
                            <span>Đã chuyển</span>
                          </button>
                          {(subBatch || subDate) && (
                            <span className="text-[11px] font-mono font-bold text-emerald-800 mt-1 whitespace-nowrap bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-200">
                              {subBatch || 'Đợt chuyển'}{subDate ? ` (${dateISOToVN(subDate)})` : ''}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => r.id && handleOpenBatchModalSingle(r)}
                          disabled={!r.id || recLocked}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-500 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition cursor-pointer disabled:opacity-50"
                          title="Bấm để ghi nhận chuyển nộp BHXH"
                        >
                          <Square size={13} className="text-slate-400" />
                          <span>Chưa chuyển</span>
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          type="button"
                          onClick={() => { setVietQrRecord(r); setIsVietQrOpen(true); }}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition cursor-pointer" 
                          title="Mã VietQR nộp tiền (NAPAS 247)"
                        >
                          <QrCode size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => r.id && handlePrintReceipt(r.id)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition cursor-pointer" 
                          title="In biên lai thu tiền"
                        >
                          <Printer size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => r.id && handleExportReceiptImage(r.id)} 
                          disabled={!r.id} 
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition cursor-pointer" 
                          title="Xuất file ảnh biên lai"
                        >
                          <Image size={15} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => r.id && confirmDelete(r.id)} 
                          disabled={!r.id || recLocked || Boolean(isSub)} 
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-40 transition cursor-pointer" 
                          title={isSub ? "Không thể xóa hồ sơ đã chuyển cơ quan BHXH" : "Xóa"}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* HÀNG TỔNG KẾT DƯỚI BẢNG VỚI FONT-MONO CĂN PHẢI */}
          {paginatedRecords.length > 0 && (
            <tfoot className="bg-slate-50/95 font-bold border-t border-slate-200 text-xs">
              <tr>
                <td colSpan={5} className="p-4 text-slate-700">
                  Tổng cộng trang hiện tại ({paginatedRecords.length} / {totalCount} giao dịch):
                </td>
                <td className="p-4 font-mono tabular-nums text-right text-sm text-[#004182]">
                  {formatMoney(paginatedRecords.reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0))}
                </td>
                <td className="p-4 font-mono tabular-nums text-right text-sm text-emerald-700">
                  {formatMoney(paginatedRecords.reduce((acc: number, r: any) => {
                    const rate = getCommissionRateForRecord(r, policies, settings);
                    return acc + (Number(r.amount) * rate);
                  }, 0))}
                </td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Phân trang */}
      {totalPages > 1 && (
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Hiển thị</span>
            <select
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>trên tổng {totalCount} giao dịch</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang đầu"
            >
              <ChevronsLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg">
              Trang {currentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              title="Trang cuối"
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
