import React from 'react';
import { ShieldAlert, PlusCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { formatMoney, formatMonthVN } from '../../../utils/helpers';
import { calculateClawbackRatio } from '../../../utils/clawbackSettlement';
import type { RecordType, StaffType, Policy, SettingsType } from '../../../context/types';

interface ClawbackRecordsTableProps {
  clawbackRecords: RecordType[];
  staff: StaffType[];
  records: RecordType[];
  policies: Policy[];
  settings: SettingsType;
  isAdminOrManager: boolean;
  financialStats: {
    clawbackAmountTotal: number;
    clawbackCommissionTotal: number;
  };
  onOpenRefundModal: () => void;
  onViewRecord: (r: RecordType) => void;
  onEditRecord: (r: RecordType) => void;
  onDeleteRecord: (r: RecordType) => void;
}

export const ClawbackRecordsTable: React.FC<ClawbackRecordsTableProps> = ({
  clawbackRecords,
  staff,
  records,
  policies,
  settings,
  isAdminOrManager,
  financialStats,
  onOpenRefundModal,
  onViewRecord,
  onEditRecord,
  onDeleteRecord
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/70">
        <div>
          <h3 className="font-bold text-base text-rose-700 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <span>Bảng Kê Chi Tiết Bút Toán Thoái Thu & Hoàn Trả (Clawback)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Các bút toán thoái thu âm và thu hồi hoa hồng cán bộ thu phát sinh trong kỳ hạch toán
          </p>
        </div>
        {isAdminOrManager && (
          <button
            type="button"
            onClick={onOpenRefundModal}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Lập Bút Toán Mới</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-3 text-center">STT</th>
              <th className="py-3 px-3">Mã Bút Toán</th>
              <th className="py-3 px-3">Ngày Hạch Toán</th>
              <th className="py-3 px-3">Khách Hàng</th>
              <th className="py-3 px-3">Nghiệp Vụ</th>
              <th className="py-3 px-3">Kỳ Giảm Trừ</th>
              <th className="py-3 px-3">Số QĐ / Công Văn</th>
              <th className="py-3 px-3">Lý Do Thoái Thu</th>
              <th className="py-3 px-3 text-right">Tiền Thoái Thu</th>
              <th className="py-3 px-3 text-right">Thu Hồi Hoa Hồng</th>
              <th className="py-3 px-3">Cán Bộ Thu</th>
              <th className="py-3 px-3">Hình Thức</th>
              <th className="py-3 px-3 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {clawbackRecords.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-8 text-center text-slate-400 font-medium">
                  Không phát sinh bút toán thoái thu hoàn trả nào trong kỳ này
                </td>
              </tr>
            ) : (
              clawbackRecords.map((r, index) => {
                const rSId = r.staff_id || (r as any).staffId;
                const assignedStaff = staff.find(s => s.id === rSId);
                let clawCommission = Math.abs(Number(r.commission) || 0);
                const origId = r.original_record_id || (r as any).originalRecordId;
                if (clawCommission === 0 && origId) {
                  const orig = records.find(x => x.id === origId);
                  if (orig) {
                    clawCommission = calculateClawbackRatio(orig, Math.abs(Number(r.amount) || 0), policies, settings).clawbackCommission;
                  }
                }

                const recFrom = r.from_month || (r as any).fromMonth;
                const recTo = r.to_month || (r as any).toMonth;
                const decDate = r.decision_date || (r as any).decisionDate;

                return (
                  <tr key={r.id} className="hover:bg-rose-50/40 transition-colors">
                    <td className="py-3 px-3 text-center text-slate-400 font-mono">{index + 1}</td>
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        #{r.id}
                      </span>
                      {origId && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Gốc: #{origId}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {r.date ? new Date(r.date).toLocaleDateString('vi-VN') : 'N/A'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{r.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">CCCD: {r.cccd || 'N/A'} · BHXH: {r.bhxh || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                        {r.type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {recFrom ? (
                        <div className="font-mono font-semibold text-amber-900 text-[11px] bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-block">
                          {formatMonthVN(recFrom)} {recTo && recTo !== recFrom ? `- ${formatMonthVN(recTo)}` : ''}
                        </div>
                      ) : (
                        <span className="text-slate-400">Theo đơn gốc</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 font-mono">{r.decision_number || (r as any).decisionNumber || 'Chưa có'}</div>
                      {decDate && (
                        <div className="text-[10px] text-slate-500 font-mono">
                          Ngày: {new Date(decDate).toLocaleDateString('vi-VN')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 max-w-xs truncate" title={r.adjustment_reason || (r as any).adjustmentReason || r.notes}>
                      {r.adjustment_reason || (r as any).adjustmentReason || r.notes || 'Thoái thu hoàn trả'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 text-[13px] tabular-nums">
                      -{formatMoney(Math.abs(Number(r.amount) || 0))}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 text-[13px] tabular-nums">
                      -{formatMoney(clawCommission)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{assignedStaff?.name || rSId}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{assignedStaff?.staff_code || (assignedStaff as any)?.staffCode || ''}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                        {(r.refund_method || (r as any).refundMethod) === 'CHUYEN_KHOAN' ? 'Chuyển khoản' : 'Tiền mặt'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onViewRecord(r)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Xem chi tiết bút toán"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdminOrManager && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditRecord(r)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              title="Chỉnh sửa bút toán"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteRecord(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Xóa bút toán"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {clawbackRecords.length > 0 && (
            <tfoot className="bg-rose-50/70 font-bold text-rose-900 border-t-2 border-rose-200 font-mono tabular-nums">
              <tr>
                <td colSpan={8} className="py-3 px-4 text-center uppercase tracking-wider font-sans text-xs">
                  Tổng Cộng Thoái Thu Trong Kỳ
                </td>
                <td className="py-3 px-4 text-right text-rose-700 text-[14px] font-bold">
                  -{formatMoney(financialStats.clawbackAmountTotal)}
                </td>
                <td className="py-3 px-4 text-right text-rose-800 text-[14px] font-bold">
                  -{formatMoney(financialStats.clawbackCommissionTotal)}
                </td>
                <td colSpan={3} className="py-3 px-4 text-slate-500 text-[11px] font-sans">
                  {clawbackRecords.length} bút toán đã hạch toán
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
