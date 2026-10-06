import React from 'react';
import { 
  Landmark, 
  ChevronUp, 
  ChevronDown, 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Wallet 
} from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';

export interface CashflowSummaryData {
  countPaid: number;
  countPending: number;
  countCancelled: number;
  countSubmitted: number;
  countUnsubmitted: number;
  totalCollected: number;
  totalPending: number;
  totalCancelled: number;
  submittedToAgency: number;
  unsubmittedToAgency: number;
  totalCommissionPaid: number;
  totalClawback: number;
  netAgencyFunds: number;
}

export interface FinanceCashflowStatementProps {
  currentPeriodLabel: string;
  cashflowSummary: CashflowSummaryData;
  showCashflowStatement: boolean;
  setShowCashflowStatement: React.Dispatch<React.SetStateAction<boolean>>;
}

export const FinanceCashflowStatement: React.FC<FinanceCashflowStatementProps> = ({
  currentPeriodLabel,
  cashflowSummary,
  showCashflowStatement,
  setShowCashflowStatement
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div 
        onClick={() => setShowCashflowStatement(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowCashflowStatement(prev => !prev); }}
        className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/70 transition"
      >
        <div className="flex items-center gap-2.5">
          <Landmark size={18} className="text-[#004182]" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Bảng Thống Kê Dòng Tiền & Cân Đối Tài Chính ({currentPeriodLabel})
            </h3>
            <p className="text-[11px] text-slate-500">
              Phân tích chi tiết dòng tiền vào, dòng tiền ra, chi phí hoa hồng và tồn quỹ đối soát cơ quan BHXH
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="font-mono tabular-nums text-[#004182] font-bold">
            Tồn quỹ: {formatMoney(cashflowSummary.netAgencyFunds)}
          </span>
          {showCashflowStatement ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {showCashflowStatement && (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Cột 1: Dòng tiền vào (Inflow) */}
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowDownRight size={15} className="text-emerald-600" />
                    1. DÒNG TIỀN VÀO (THU KHÁCH HÀNG)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {cashflowSummary.countPaid + cashflowSummary.countPending} GD
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-500" /> Thực thu từ khách hàng:
                    </span>
                    <span className="font-mono tabular-nums text-right font-bold text-emerald-700">
                      +{formatMoney(cashflowSummary.totalCollected)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Clock size={13} className="text-amber-500" /> Công nợ chờ thanh toán:
                    </span>
                    <span className="font-mono tabular-nums text-right font-semibold text-amber-700">
                      {formatMoney(cashflowSummary.totalPending)}
                    </span>
                  </div>
                  {cashflowSummary.countCancelled > 0 && (
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Hồ sơ đã hủy ({cashflowSummary.countCancelled}):</span>
                      <span className="font-mono tabular-nums text-right">
                        {formatMoney(cashflowSummary.totalCancelled)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-700">Tổng Thực Thu Được:</span>
                <span className="font-mono tabular-nums text-right text-base font-black text-emerald-700">
                  {formatMoney(cashflowSummary.totalCollected)}
                </span>
              </div>
            </div>

            {/* Cột 2: Dòng tiền ra & Nghiệp vụ (Outflow) */}
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ArrowUpRight size={15} className="text-blue-600" />
                    2. DÒNG TIỀN RA & QUYẾT TOÁN
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {cashflowSummary.countSubmitted} đợt nộp
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Đã nộp cơ quan BHXH:</span>
                    <span className="font-mono tabular-nums text-right font-bold text-slate-800">
                      -{formatMoney(cashflowSummary.submittedToAgency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Hoa hồng chi trả nhân viên:</span>
                    <span className="font-mono tabular-nums text-right font-semibold text-[#b45309]">
                      -{formatMoney(cashflowSummary.totalCommissionPaid)}
                    </span>
                  </div>
                  {cashflowSummary.totalClawback > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-rose-600">Thu hồi hoa hồng / Clawback:</span>
                      <span className="font-mono tabular-nums text-right font-bold text-rose-600">
                        -{formatMoney(cashflowSummary.totalClawback)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-700">Tổng Đã Chi / Chuyển:</span>
                <span className="font-mono tabular-nums text-right text-base font-black text-slate-800">
                  {formatMoney(cashflowSummary.submittedToAgency + cashflowSummary.totalCommissionPaid)}
                </span>
              </div>
            </div>

            {/* Cột 3: Tồn quỹ & Cân đối ròng (Net Balance) */}
            <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-blue-200">
                  <span className="text-xs font-bold text-[#004182] flex items-center gap-1.5">
                    <Wallet size={15} className="text-[#004182]" />
                    3. CÂN ĐỐI TỒN QUỸ RÒNG
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#004182]">
                    Đối soát
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Tiền giữ hộ chưa nộp BHXH:</span>
                    <span className="font-mono tabular-nums text-right font-bold text-blue-800">
                      {formatMoney(cashflowSummary.unsubmittedToAgency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Hồ sơ chờ nộp BHXH:</span>
                    <span className="font-mono tabular-nums text-right font-semibold text-slate-700">
                      {cashflowSummary.countUnsubmitted} hồ sơ
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Tỷ lệ hoàn thành nộp BHXH:</span>
                    <span className="font-mono tabular-nums text-right font-bold text-[#004182]">
                      {cashflowSummary.countPaid > 0 
                        ? `${Math.round((cashflowSummary.countSubmitted / cashflowSummary.countPaid) * 100)}%` 
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-blue-200 flex justify-between items-baseline">
                <span className="text-xs font-bold text-[#004182]">Tồn Quỹ Thực Tế:</span>
                <span className="font-mono tabular-nums text-right text-base font-black text-[#004182]">
                  {formatMoney(cashflowSummary.netAgencyFunds)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
