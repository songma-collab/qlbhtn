import React from 'react';
import { 
  Landmark, 
  ChevronUp, 
  ChevronDown, 
  ArrowDownRight, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Wallet,
  Coins,
  ShieldCheck,
  Info,
  Building2,
  Users
} from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';

export interface CashflowSummaryData {
  countPaid: number;
  countPending: number;
  countCancelled: number;
  countSubmitted: number;
  countSubmittedBatches?: number;
  countSubmittedRecords?: number;
  countUnsubmitted: number;
  totalCollected: number;
  totalPending: number;
  totalCancelled: number;
  submittedToAgency: number;
  unsubmittedToAgency: number;
  totalCommissionPaid: number;
  totalCommissionFromBHXH?: number;
  totalClawback: number;
  netAgencyFunds: number;
  totalTransactions?: number;
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
  const commFromBHXH = cashflowSummary.totalCommissionFromBHXH ?? cashflowSummary.totalCommissionPaid;
  const isHoldingZero = cashflowSummary.unsubmittedToAgency === 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header gập / mở */}
      <div 
        onClick={() => setShowCashflowStatement(prev => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowCashflowStatement(prev => !prev); }}
        className={`p-4 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-slate-100/70 transition ${
          showCashflowStatement ? 'border-b border-slate-200' : ''
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Landmark size={18} className="text-[#004182] shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2 flex-wrap">
              <span>Bảng Thống Kê Dòng Tiền & Cân Đối Tài Chính ({currentPeriodLabel})</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Tách bạch dòng tiền thu - nộp hộ BHXH và dòng kinh phí hoa hồng do cơ quan BHXH chi trả
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs self-end sm:self-auto">
          {/* Badge tồn quỹ thu hộ */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono text-xs font-bold shadow-2xs">
            <span className="text-slate-500 font-sans font-medium text-[11px]">Tồn quỹ thu hộ BHXH:</span>
            <span className={isHoldingZero ? 'text-emerald-700' : 'text-amber-700'}>
              {formatMoney(cashflowSummary.unsubmittedToAgency)}
            </span>
            {isHoldingZero ? (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 text-emerald-800 font-sans font-semibold">
                Đã nộp đủ 100%
              </span>
            ) : (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 text-amber-800 font-sans font-semibold">
                Chờ nộp BHXH
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 pl-1">
            <span className="text-[11px] font-medium hidden sm:inline text-slate-500">
              {showCashflowStatement ? 'Thu gọn' : 'Xem chi tiết'}
            </span>
            <div className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800">
              {showCashflowStatement ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </div>
          </div>
        </div>
      </div>

      {showCashflowStatement && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* ========================================================================= */}
          {/* CỤM 1: QUẢN LÝ QUỸ THU HỘ - NỘP HỘ TIỀN BẢO HIỂM CỦA NGƯỜI DÂN (3 CỘT)    */}
          {/* ========================================================================= */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#004182] flex items-center gap-1.5">
                <Building2 size={13} className="text-[#004182]" />
                I. Quỹ Thu Hộ - Nộp Hộ Cơ Quan BHXH (Tiền người tham gia đóng)
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                Đại lý nộp đủ 100% vào tài khoản chuyên thu BHXH
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Cột 1: Dòng tiền thu hộ (Inflow) */}
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ArrowDownRight size={15} className="text-emerald-600" />
                      1. TIỀN THU HỘ (KHÁCH HÀNG)
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

              {/* Cột 2: Dòng tiền nộp BHXH (Outflow nộp hộ) */}
              <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <ArrowUpRight size={15} className="text-blue-600" />
                      2. TIỀN NỘP CƠ QUAN BHXH
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {cashflowSummary.countSubmittedBatches ?? cashflowSummary.countSubmitted} đợt nộp
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Đã nộp cơ quan BHXH:</span>
                      <span className="font-mono tabular-nums text-right font-bold text-slate-800">
                        -{formatMoney(cashflowSummary.submittedToAgency)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Đợt nộp hoàn thành:</span>
                      <span className="font-mono tabular-nums text-right font-semibold">
                        {cashflowSummary.countSubmittedBatches ?? cashflowSummary.countSubmitted} đợt
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Hồ sơ đã nộp thành công:</span>
                      <span className="font-mono tabular-nums text-right font-semibold">
                        {cashflowSummary.countSubmittedRecords ?? (cashflowSummary.countPaid - cashflowSummary.countUnsubmitted)} hồ sơ
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-700">Tổng Đã Nộp BHXH:</span>
                  <span className="font-mono tabular-nums text-right text-base font-black text-slate-800">
                    -{formatMoney(cashflowSummary.submittedToAgency)}
                  </span>
                </div>
              </div>

              {/* Cột 3: Cân đối quỹ thu hộ BHXH */}
              <div className={`rounded-xl p-4 border flex flex-col justify-between ${
                isHoldingZero ? 'bg-emerald-50/40 border-emerald-200' : 'bg-blue-50/40 border-blue-200'
              }`}>
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold text-[#004182] flex items-center gap-1.5">
                      <Wallet size={15} className="text-[#004182]" />
                      3. CÂN ĐỐI TỒN QUỸ THU HỘ
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-[#004182]">
                      Đối soát
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Tiền giữ hộ chưa nộp BHXH:</span>
                      <span className={`font-mono tabular-nums text-right font-bold ${
                        isHoldingZero ? 'text-emerald-700' : 'text-amber-700'
                      }`}>
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
                          ? `${Math.round(((cashflowSummary.countSubmittedRecords ?? (cashflowSummary.countPaid - cashflowSummary.countUnsubmitted)) / cashflowSummary.countPaid) * 100)}%` 
                          : '0%'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-xs font-bold text-[#004182]">Tồn Quỹ Thu Hộ BHXH:</span>
                  <div className="text-right">
                    <span className={`font-mono tabular-nums text-base font-black ${
                      isHoldingZero ? 'text-emerald-700' : 'text-[#004182]'
                    }`}>
                      {formatMoney(cashflowSummary.unsubmittedToAgency)}
                    </span>
                    {isHoldingZero && (
                      <span className="block text-[10px] text-emerald-600 font-semibold">
                        Cân bằng tuyệt đối (0 đ)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CỤM 2: THEO DÕI HOA HỒNG CHI TRẢ NHÂN VIÊN DO BHXH CẤP (TÁCH BIỆT RÕ RÀNG)*/}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/60 rounded-xl p-4 border border-amber-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2.5 mb-3 border-b border-amber-200/80">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-[#b45309] shrink-0" />
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-[#92400e]">
                    II. Theo Dõi Kinh Phí Hoa Hồng / Thù Lao Thu Do Cơ Quan BHXH Chi Trả
                  </h4>
                  <p className="text-[11px] text-amber-800/80">
                    Khoản tiền do Cơ quan BHXH trích chuyển về đại lý hàng tháng để chi trả cho nhân viên thu • Không trích từ kinh phí của đại lý
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-[#92400e] border border-amber-300">
                Nguồn kinh phí BHXH
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Thẻ A: Hoa hồng BHXH trích về */}
              <div className="bg-white/85 p-3 rounded-xl border border-amber-200/90 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="font-medium flex items-center gap-1">
                    <ArrowDownRight size={13} className="text-emerald-600" />
                    BHXH trích về đại lý (Dự thu):
                  </span>
                  <span className="text-[10px] text-slate-400">Từ BHXH</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm sm:text-base font-black font-mono tabular-nums text-emerald-700">
                    +{formatMoney(commFromBHXH)}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Kinh phí BHXH
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  BHXH đối soát và chuyển về tài khoản đại lý
                </p>
              </div>

              {/* Thẻ B: Đại lý chi trả nhân viên */}
              <div className="bg-white/85 p-3 rounded-xl border border-amber-200/90 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="font-medium flex items-center gap-1">
                    <ArrowUpRight size={13} className="text-[#b45309]" />
                    Đại lý chi trả nhân viên thu:
                  </span>
                  <span className="text-[10px] text-slate-400">Cho nhân viên</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm sm:text-base font-black font-mono tabular-nums text-[#b45309]">
                    -{formatMoney(cashflowSummary.totalCommissionPaid)}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                    Chi nhân viên
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Đại lý chuyển tiếp nguyên vẹn cho nhân viên
                </p>
              </div>

              {/* Thẻ C: Tác động vốn đại lý */}
              <div className="bg-white/85 p-3 rounded-xl border border-amber-200/90 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-600 mb-1">
                  <span className="font-medium flex items-center gap-1">
                    <ShieldCheck size={13} className="text-emerald-600" />
                    Tác động kinh phí đại lý:
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold">Hòa vốn</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-sm sm:text-base font-black font-mono tabular-nums text-emerald-700">
                    0 đ
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                    Không âm quỹ
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Đại lý chỉ trung chuyển chi trả, không bỏ vốn
                </p>
              </div>
            </div>

            {/* Dòng thoái thu hoa hồng nếu có */}
            {cashflowSummary.totalClawback > 0 && (
              <div className="mt-2.5 pt-2 border-t border-amber-200/80 flex justify-between items-center text-xs text-rose-700">
                <span className="flex items-center gap-1 font-medium">
                  <Info size={13} /> Thu hồi hoa hồng / Clawback do hồ sơ thoái nộp:
                </span>
                <span className="font-mono tabular-nums font-bold">
                  -{formatMoney(cashflowSummary.totalClawback)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceCashflowStatement;
