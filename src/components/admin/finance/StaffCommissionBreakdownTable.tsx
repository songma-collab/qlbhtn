import React from 'react';
import { Users } from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';

export interface StaffBreakdownItem {
  id: string;
  name: string;
  staff_code?: string | undefined;
  staffCode?: string | undefined;
  paidCount: number;
  totalRevenue: number;
  bhxhNewComm: number;
  bhxhRenewComm: number;
  bhytNewComm: number;
  bhytRenewComm: number;
  refundDeduction: number;
  netCommission: number;
}

interface StaffCommissionBreakdownTableProps {
  staffBreakdown: StaffBreakdownItem[];
  financialStats: {
    paidCount: number;
    totalRevenue: number;
    bhxhStaffComm: number;
    bhytStaffComm: number;
    refundCommissionDeducted: number;
    netStaffCommission: number;
  };
}

export const StaffCommissionBreakdownTable: React.FC<StaffCommissionBreakdownTableProps> = ({
  staffBreakdown,
  financialStats
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/70">
        <div>
          <h3 className="font-bold text-base text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#004182]" />
            <span>Bảng Kê Quyết Toán Hoa Hồng Chi Tiết Theo Cán Bộ</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân tách chi tiết hoa hồng BHXH/BHYT mới và gia hạn theo từng nhân viên trong kỳ
          </p>
        </div>
        <div className="text-xs text-slate-600 font-medium">
          <span className="font-bold font-mono text-slate-900">{staffBreakdown.length}</span> cán bộ phát sinh doanh thu
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/90 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-4 text-center">STT</th>
              <th className="py-3 px-4">Cán Bộ Thu</th>
              <th className="py-3 px-4 text-center">Số Đơn</th>
              <th className="py-3 px-4 text-right">Doanh Số Thực Thu</th>
              <th className="py-3 px-4 text-right">HH BHXH Mới</th>
              <th className="py-3 px-4 text-right">HH BHXH Tái Tục</th>
              <th className="py-3 px-4 text-right">HH BHYT Mới</th>
              <th className="py-3 px-4 text-right">HH BHYT Tái Tục</th>
              <th className="py-3 px-4 text-right">Thu Hồi Thoái Thu</th>
              <th className="py-3 px-4 text-right font-bold text-slate-900">Thực Nhận</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {staffBreakdown.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400 font-medium">
                  Không có số liệu phát sinh trong kỳ được chọn
                </td>
              </tr>
            ) : (
              staffBreakdown.map((s, index) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-center text-slate-400 font-mono">{index + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.staff_code || s.staffCode || s.id}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {s.paidCount}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatMoney(s.totalRevenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhxhNewComm)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhxhRenewComm)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhytNewComm)}</td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">{formatMoney(s.bhytRenewComm)}</td>
                  <td className="py-3 px-4 text-right font-mono text-rose-600 tabular-nums">
                    {s.refundDeduction > 0 ? `-${formatMoney(s.refundDeduction)}` : '0 đ'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums text-sm">
                    {formatMoney(s.netCommission)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {staffBreakdown.length > 0 && (
            <tfoot className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200 font-mono tabular-nums">
              <tr>
                <td colSpan={2} className="py-3.5 px-4 text-center uppercase tracking-wider font-sans text-xs">Tổng Cộng</td>
                <td className="py-3.5 px-4 text-center font-mono">{financialStats.paidCount}</td>
                <td className="py-3.5 px-4 text-right font-bold text-[#004182]">{formatMoney(financialStats.totalRevenue)}</td>
                <td className="py-3.5 px-4 text-right" colSpan={2}>{formatMoney(financialStats.bhxhStaffComm)}</td>
                <td className="py-3.5 px-4 text-right" colSpan={2}>{formatMoney(financialStats.bhytStaffComm)}</td>
                <td className="py-3.5 px-4 text-right text-rose-600">
                  {financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}
                </td>
                <td className="py-3.5 px-4 text-right text-emerald-800 text-[14px] font-bold">
                  {formatMoney(financialStats.netStaffCommission)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
