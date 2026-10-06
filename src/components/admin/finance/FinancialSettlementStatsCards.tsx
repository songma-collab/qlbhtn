import React from 'react';
import { Wallet, ShieldAlert, Building2, Users, TrendingUp, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';

export interface FinancialStatsProps {
  grossRevenue: number;
  bhxhRevenue: number;
  bhxhCount: number;
  bhytRevenue: number;
  bhytCount: number;
  totalRefund: number;
  clawbackCount: number;
  refundCommissionDeducted: number;
  netRevenue: number;
  netStaffCommission: number;
  grossStaffCommission: number;
  netCashflow: number;
  retainedMargin: number;
  totalRevenue: number;
}

interface FinancialSettlementStatsCardsProps {
  financialStats: FinancialStatsProps;
}

export const FinancialSettlementStatsCards: React.FC<FinancialSettlementStatsCardsProps> = ({
  financialStats
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* 1. Tổng Thu Phát Sinh (Gross) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng Thu Phát Sinh (Gross)</span>
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
            {formatMoney(financialStats.grossRevenue)}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
          <span>BHXH: <b className="text-slate-800">{formatMoney(financialStats.bhxhRevenue)}</b> ({financialStats.bhxhCount})</span>
          <span>BHYT: <b className="text-slate-800">{formatMoney(financialStats.bhytRevenue)}</b> ({financialStats.bhytCount})</span>
        </div>
      </div>

      {/* 2. Thoái Thu & Hoàn Trả (Clawback) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-rose-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Thoái Thu & Hoàn Trả</span>
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-rose-600 tracking-tight tabular-nums">
            {financialStats.totalRefund > 0 ? `-${formatMoney(financialStats.totalRefund)}` : '0 đ'}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
          <span>Thoái thu: <b className="text-rose-700">{financialStats.clawbackCount} bút toán</b></span>
          <span>Thu hồi HH: <b className="text-rose-700">{financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}</b></span>
        </div>
      </div>

      {/* 3. Doanh Thu Thuần Thực Nộp (Net) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-[#004182]/30 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-[#004182] uppercase tracking-wider">Doanh Thu Thuần Thực Nộp (Net)</span>
          <div className="w-8 h-8 rounded-lg bg-[#004182]/10 text-[#004182] flex items-center justify-center">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-[#004182] tracking-tight tabular-nums">
            {formatMoney(financialStats.netRevenue)}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 font-mono tabular-nums flex items-center justify-between">
          <span>Thực nộp Kho bạc/BHXH</span>
          <span className="font-bold text-[#004182]">
            {financialStats.grossRevenue > 0 ? `${((financialStats.netRevenue / financialStats.grossRevenue) * 100).toFixed(1)}%` : '100%'}
          </span>
        </div>
      </div>

      {/* 4. Hoa Hồng Thực Chi Cán Bộ (Net) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Hoa Hồng Thực Chi (Net)</span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-amber-700 tracking-tight tabular-nums">
            {formatMoney(financialStats.netStaffCommission)}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
          <span>Gộp: <b className="text-slate-800">{formatMoney(financialStats.grossStaffCommission)}</b></span>
          <span>Thu hồi: <b className="text-rose-600">{financialStats.refundCommissionDeducted > 0 ? `-${formatMoney(financialStats.refundCommissionDeducted)}` : '0 đ'}</b></span>
        </div>
      </div>

      {/* 5. Tồn Két Dòng Tiền Thuần */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Dòng Tiền Thực Két Quỹ</span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-emerald-700 tracking-tight tabular-nums">
            {formatMoney(financialStats.netCashflow)}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
          <span>(Thực thu trừ thoái thu)</span>
          <span className="font-bold text-emerald-600">Khớp 100% Sổ Quỹ</span>
        </div>
      </div>

      {/* 6. Thù Lao Giữ Lại Đại Lý */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wider">Lợi Nhuận Gộp Thù Lao</span>
          <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/60 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2.5">
          <span className="font-mono text-2xl font-bold text-teal-700 tracking-tight tabular-nums">
            {formatMoney(financialStats.retainedMargin)}
          </span>
        </div>
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
          <span>Tỷ suất thù lao TB:</span>
          <span className="font-bold text-teal-700">
            {financialStats.totalRevenue > 0 ? ((financialStats.retainedMargin / financialStats.totalRevenue) * 100).toFixed(2) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
};
