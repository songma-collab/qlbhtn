import React, { useState, useEffect } from 'react';
import { CONSTANTS } from '../../utils/constants';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, parseMonthISO, getLocalYYYYMMDD } from '../../utils/helpers';
import { formatMonthInputMask } from '../../utils/dateFormatter';
import { calculateBHXH, getPolicyValueForDate, calculateVoluntaryBHXHRoadmap } from '../../utils/calculations';
import { exportBHXHTableToExcel, exportBHXHTableToPDF } from '../../utils/exportBHXHTable';
import { Shield, Building2, MapPin, TrendingDown, TrendingUp, AlertTriangle, Receipt, FileSpreadsheet, FileText, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import ContributionMethodComparison from './ContributionMethodComparison';
import PensionAccumulationChart from './PensionAccumulationChart';

interface BHXHCalcProps {
  onRegister: (data?: any) => void;
}

const BHXHCalc: React.FC<BHXHCalcProps> = ({ onRegister }) => {
  const { settings, policies } = useAppContext();
  const [income, setIncome] = useState(1500000);
  const [fromMonth, setFromMonth] = useState('');

  // Get dynamic povertyStandard and baseSalary based on selected fromMonth
  const dateStr = fromMonth ? parseMonthISO(fromMonth) + '-01' : getLocalYYYYMMDD();
  const povertyStandard = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || CONSTANTS.POVERTY_LINE))
    : (settings?.povertyStandard || CONSTANTS.POVERTY_LINE);
  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || 2340000))
    : (settings?.baseSalary || 2340000);

  useEffect(() => {
    if (povertyStandard) {
      if (income === 1500000 || income < povertyStandard) {
        setIncome(povertyStandard);
      }
    }
  }, [povertyStandard]);

  const [nnSupport, setNnSupport] = useState(20);
  const [dpSupport, setDpSupport] = useState(0);
  const [method, setMethod] = useState('1');
  const [customMonths, setCustomMonths] = useState(1);
  const [toMonth, setToMonth] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isShowComparison, setIsShowComparison] = useState(false);
  const [isShowPensionChart, setIsShowPensionChart] = useState(false);

  const handleExportExcel = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      await exportBHXHTableToExcel({
        povertyStandard,
        baseSalary,
        nnSupport,
        dpSupport,
        fromMonth,
        investmentRate: settings?.investmentRate !== undefined ? (settings.investmentRate / 100) : CONSTANTS.INTEREST,
        policies,
        currentIncome: income
      });
    } catch (err: any) {
      console.error('Error exporting BHXH table:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (isExportingPDF) return;
    try {
      setIsExportingPDF(true);
      await exportBHXHTableToPDF({
        povertyStandard,
        baseSalary,
        nnSupport,
        dpSupport,
        fromMonth,
        investmentRate: settings?.investmentRate !== undefined ? (settings.investmentRate / 100) : CONSTANTS.INTEREST,
        policies,
        currentIncome: income
      });
    } catch (err: any) {
      console.error('Error exporting BHXH PDF table:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const [calcResult, setCalcResult] = useState({
    baseAmount: 0,
    nnSupportAmount: 0,
    dpSupportAmount: 0,
    interestAmount: 0,
    finalAmount: 0,
    mode: 'normal',
    diff: 0
  });

  const incomeOptions = [];
  const dynamicIncomeMax = baseSalary * 20;
  for (let i = povertyStandard; i <= dynamicIncomeMax; i += CONSTANTS.INCOME_STEP) {
    incomeOptions.push(i);
  }

  useEffect(() => {
    const now = new Date();
    setFromMonth(`${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`);
  }, []);

  useEffect(() => {
    updateCalc();
  }, [income, nnSupport, dpSupport, method, customMonths, fromMonth, settings?.investmentRate, povertyStandard, policies]);

  const handleCustomMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value) || 1;
    if (val > 60) val = 60;
    setCustomMonths(val);
  };

  const updateCalc = () => {
    const calcResult = calculateBHXH(
      income,
      nnSupport,
      dpSupport,
      method,
      customMonths,
      fromMonth,
      settings?.investmentRate !== undefined ? (settings.investmentRate / 100) : CONSTANTS.INTEREST,
      povertyStandard,
      policies
    );

    setToMonth(calcResult.toMonth);

    let mode = 'normal';
    if (method === 'post_custom') mode = 'penalty';
    else if (method.startsWith('pre_')) mode = 'discount';

    let diff = 0;
    if (mode === 'discount') diff = calcResult.discountAmount;
    else if (mode === 'penalty') diff = calcResult.penaltyAmount;

    setCalcResult({
      baseAmount: calcResult.basePremium,
      nnSupportAmount: calcResult.nnSupportAmount,
      dpSupportAmount: calcResult.dpSupportAmount,
      interestAmount: diff,
      finalAmount: calcResult.amount,
      mode,
      diff
    });
  };

  return (
    <div className="w-full space-y-8">
      <div className="w-full flex flex-col lg:flex-row gap-6 relative transition-all duration-300">
      {/* Calculator Inputs */}
      <div className="flex-grow bg-slate-50/70 border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-200 gap-2">
          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="text-[#004182] shrink-0" size={20} /> <span>Tham số tính toán</span>
          </h3>
          <span className="text-xs bg-blue-100 text-[#004182] font-extrabold px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-auto border border-blue-200/60">
            Chuẩn hộ nghèo: {formatMoney(povertyStandard)}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs sm:text-[13px] font-bold text-slate-600 mb-1.5 block">Mức thu nhập tháng lựa chọn</label>
            <div className="relative">
              <select 
                value={income} 
                onChange={(e) => setIncome(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition-all cursor-pointer appearance-none h-[46px]"
              >
                {incomeOptions.map(opt => (
                  <option key={opt} value={opt}>{formatMoney(opt)}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs sm:text-[13px] font-bold text-slate-600 mb-1.5 block">Hỗ trợ từ Nhà nước</label>
              <div className="relative">
                <select 
                  value={nnSupport} 
                  onChange={(e) => setNnSupport(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition-all cursor-pointer appearance-none h-[46px]"
                >
                  <option value="20">Khác (20%)</option>
                  <option value="50">Hộ nghèo (50%)</option>
                  <option value="40">Hộ cận nghèo (40%)</option>
                  <option value="30">Dân tộc thiểu số (30%)</option>
                  <option value="10">Khác (10%)</option>
                  <option value="0">Không hỗ trợ (0%)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs sm:text-[13px] font-bold text-slate-600 mb-1.5 block">Hỗ trợ từ Địa phương</label>
              <div className="relative">
                <select 
                  value={dpSupport} 
                  onChange={(e) => setDpSupport(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition-all cursor-pointer appearance-none h-[46px]"
                >
                  <option value="0">Không hỗ trợ (0%)</option>
                  <option value="5">Hỗ trợ 5%</option>
                  <option value="10">Hỗ trợ 10%</option>
                  <option value="20">Hỗ trợ 20%</option>
                  <option value="30">Hỗ trợ 30%</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>

          <div className={method === 'post_custom' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
            <div>
              <label className="text-xs sm:text-[13px] font-bold text-gray-600 mb-1.5 block">Phương thức đóng</label>
              <div className="relative">
                <select 
                  value={method} 
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all cursor-pointer appearance-none h-[46px]"
                >
                  <option value="1">Đóng hằng tháng</option>
                  <option value="3">Đóng 3 tháng</option>
                  <option value="6">Đóng 6 tháng</option>
                  <option value="12">Đóng 12 tháng</option>
                  <option disabled className="font-bold text-primary">--- ĐÓNG TRƯỚC VỀ SAU ---</option>
                  <option value="pre_24">Đóng trước 2 năm</option>
                  <option value="pre_36">Đóng trước 3 năm</option>
                  <option value="pre_48">Đóng trước 4 năm</option>
                  <option value="pre_60">Đóng trước 5 năm</option>
                  <option disabled className="font-bold text-primary">--- ĐÓNG BÙ THỜI GIAN THIẾU ---</option>
                  <option value="post_custom">Đóng bù 1 lần để nghỉ hưu</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {method === 'post_custom' && (
              <div className="transition-all duration-300">
                <label className="text-xs sm:text-[13px] font-bold text-gray-600 mb-1.5 block">Số tháng đóng bù</label>
                <div className="relative group">
                  <input 
                    type="number" 
                    inputMode="numeric" 
                    value={customMonths}
                    onChange={handleCustomMonthsChange}
                    className="w-full bg-white border border-gray-200 rounded-xl py-2.5 sm:py-3 px-4 pr-16 text-xs sm:text-sm font-bold text-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none h-[46px]" 
                    min="1" max="60" 
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">tháng</span>
                </div>
                <p className="text-red-500 text-xs mt-1.5 flex items-center gap-1 font-medium">
                  <AlertTriangle size={13} className="shrink-0 text-red-500" />
                  <span>Tối đa 60 tháng</span>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-xs sm:text-[13px] font-bold text-gray-600 mb-1.5 block">Kỳ bắt đầu</label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric" 
                  value={fromMonth}
                  onChange={(e) => setFromMonth(formatMonthInputMask(e.target.value))}
                  placeholder="MM/YYYY" 
                  maxLength={7} 
                  className="w-full bg-white border border-gray-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-gray-800 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all h-[46px]" 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <span className="material-symbols-outlined text-lg">calendar_today</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs sm:text-[13px] font-bold text-gray-600 mb-1.5 block">Kỳ kết thúc</label>
              <input 
                type="text" 
                value={toMonth}
                placeholder="MM/YYYY" 
                className="w-full bg-gray-100/70 border border-gray-200 rounded-xl py-2.5 sm:py-3 px-4 text-xs sm:text-sm font-bold text-gray-500 cursor-not-allowed outline-none h-[46px]" 
                readOnly 
              />
            </div>
          </div>

          {/* Nút Xuất File Excel & PDF Danh Sách Mức Đóng */}
          <div className="grid grid-cols-2 gap-4 pt-2.5 border-t border-gray-200/60 mt-1">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="w-full h-[46px] inline-flex items-center justify-center gap-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 border border-emerald-300 font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
              title="Xuất file Excel bảng tra cứu các mức thu nhập, hỗ trợ Nhà nước, các kỳ đóng 1, 3, 6, 12 tháng, 5 năm và dự toán lương hưu 15-20 năm"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <span className="truncate">Đang xuất Excel...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={17} className="text-emerald-600 shrink-0" />
                  <span className="truncate">Xuất file Excel</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              className="w-full h-[46px] inline-flex items-center justify-center gap-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-300 font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
              title="Xuất file PDF bảng tra cứu các mức thu nhập, hỗ trợ Nhà nước, các kỳ đóng 1, 3, 6, 12 tháng, 5 năm và dự toán lương hưu 15-20 năm"
            >
              {isExportingPDF ? (
                <>
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin shrink-0"></div>
                  <span className="truncate">Đang xuất PDF...</span>
                </>
              ) : (
                <>
                  <FileText size={17} className="text-red-600 shrink-0" />
                  <span className="truncate">Xuất file PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Display Card */}
      <div className="lg:w-[380px] shrink-0">
        <div className="bg-[#004182] h-full rounded-2xl sm:rounded-3xl text-white p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary-bright/10 blur-[100px] rounded-full"></div>
          
          <h3 className="text-xl font-black mb-5 border-b border-white/10 pb-4 relative z-10 flex items-center gap-2.5">
            <Receipt className="text-secondary-bright" size={20} /> Chi Tiết Thanh Toán
          </h3>

          <div className="space-y-3.5 flex-grow relative z-10 text-sm">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-blue-200/80">Mức thu nhập chọn:</span>
              <span className="font-bold text-white">{formatMoney(income)}</span>
            </div>
            
            <div className="flex justify-between items-center text-xs sm:text-sm pb-3.5 border-b border-white/10">
              <span className="text-blue-200/80">Tỷ lệ đóng (22%):</span>
              <span className="font-bold text-white">{formatMoney(calcResult.baseAmount)}</span>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center text-xs sm:text-sm text-secondary-bright">
                <span className="flex items-center gap-2">
                  <Building2 size={15} className="opacity-80" /> Nhà nước hỗ trợ:
                </span>
                <span className="font-bold">- {formatMoney(calcResult.nnSupportAmount)}</span>
              </div>
              
              <div className="flex justify-between items-center text-xs sm:text-sm text-secondary-bright">
                <span className="flex items-center gap-2">
                  <MapPin size={15} className="opacity-80" /> Địa phương hỗ trợ:
                </span>
                <span className="font-bold">- {formatMoney(calcResult.dpSupportAmount)}</span>
              </div>

              {calcResult.mode === 'discount' && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-secondary-bright">
                  <span className="flex items-center gap-2">
                    <TrendingDown size={15} className="opacity-80" /> Chiết khấu đóng trước:
                  </span>
                  <span className="font-bold">- {formatMoney(calcResult.interestAmount)}</span>
                </div>
              )}
              {calcResult.mode === 'penalty' && (
                <div className="flex justify-between items-center text-xs sm:text-sm text-rose-400">
                  <span className="flex items-center gap-2">
                    <TrendingUp size={15} className="opacity-80" /> Lãi đóng bù (FV):
                  </span>
                  <span className="font-bold">+ {formatMoney(calcResult.interestAmount)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto relative z-10 pt-4">
            <div className="mb-4">
              <span className="text-white/60 text-[11px] font-black uppercase tracking-wider block mb-1">TỔNG CẦN THANH TOÁN</span>
              <div className="flex items-end gap-2 text-right justify-end">
                <span className="font-black text-3xl sm:text-4xl text-secondary-bright tracking-tight">
                  {formatMoney(calcResult.finalAmount).replace(' đ', '')}
                </span>
                <span className="text-gray-300 font-bold mb-1 text-sm">VNĐ</span>
              </div>
            </div>
            
            <button 
              onClick={() => onRegister({ income, nnSupport, dpSupport, method, customMonths, fromMonth })}
              className="w-full bg-white text-[#004182] py-3.5 rounded-xl font-black text-base hover:bg-secondary-bright hover:text-primary-dark transition-all active:scale-[0.97] shadow-lg cursor-pointer flex items-center justify-center gap-2 border-none outline-none"
            >
              <Shield size={18} /> TIẾP TỤC ĐĂNG KÝ
            </button>
            
            <div className="mt-4 flex items-center justify-center text-white/50 text-xs font-medium gap-1.5">
              <Shield size={13} /> Giao dịch được bảo mật và mã hóa
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Mục 1: So Sánh Toàn Diện Các Phương Thức Đóng BHXH Tự Nguyện (Mặc định ẩn, click để hiện) */}
    <div className="w-full space-y-4">
      <div 
        onClick={() => setIsShowComparison(!isShowComparison)}
        className="w-full bg-white rounded-2xl border border-amber-200/80 hover:border-amber-400 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Zap size={22} className="fill-amber-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-gray-800 group-hover:text-amber-700 transition-colors">
                So Sánh Toàn Diện Các Phương Thức Đóng BHXH Tự Nguyện
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                Chiết khấu đóng trước 2 - 5 năm
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Đối chiếu số tiền thực nộp, mức NSNN hỗ trợ và số tiền tiết kiệm theo từng chu kỳ đóng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200/60 flex items-center gap-1.5">
            {isShowComparison ? 'Thu gọn' : 'Bấm để xem chi tiết'}
            {isShowComparison ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {isShowComparison && (
        <div className="animate-in fade-in duration-300">
          <ContributionMethodComparison
            income={income}
            nnSupport={nnSupport}
            dpSupport={dpSupport}
            povertyStandard={povertyStandard}
            fromMonth={fromMonth}
            investmentRate={settings?.investmentRate !== undefined ? (settings.investmentRate / 100) : CONSTANTS.INTEREST}
            policies={policies}
            selectedMethod={method}
            onSelectMethod={(selectedKey) => setMethod(selectedKey)}
            onRegisterWithMethod={(selectedKey) => onRegister({ income, nnSupport, dpSupport, method: selectedKey, customMonths, fromMonth })}
          />
        </div>
      )}
    </div>

    {/* Mục 2: Biểu Đồ Dự Báo An Sinh Luật BHXH 2024 (Mặc định ẩn, click để hiện) */}
    <div className="w-full space-y-4">
      <div 
        onClick={() => setIsShowPensionChart(!isShowPensionChart)}
        className="w-full bg-white rounded-2xl border border-blue-200/80 hover:border-blue-400 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-[#004182] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <TrendingUp size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-gray-800 group-hover:text-[#004182] transition-colors">
                Biểu Đồ Dự Báo An Sinh & Lộ Trình Hưu Trí Luật BHXH 2024
              </h3>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                Luật Mới (Tối thiểu 15 năm)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Mô phỏng dòng tiền tích lũy, điểm hòa vốn và ước tính lương hưu hàng tháng theo từng mốc năm đóng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <span className="text-xs font-bold text-[#004182] bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/60 flex items-center gap-1.5">
            {isShowPensionChart ? 'Thu gọn' : 'Bấm để xem biểu đồ'}
            {isShowPensionChart ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
      </div>

      {isShowPensionChart && (
        <div className="animate-in fade-in duration-300">
          <PensionAccumulationChart
            initialIncome={income}
            initialNsnnRate={nnSupport}
            initialDpRate={dpSupport}
            onApplyPlan={(plan) => {
              const roadmap = calculateVoluntaryBHXHRoadmap({
                income: plan.income,
                years: plan.years,
                povertyStandard,
                nsnnRate: nnSupport,
                dpRate: dpSupport
              });
              onRegister({
                income: plan.income,
                years: plan.years,
                monthlyPension: plan.monthlyPension,
                gender: plan.gender,
                nnSupport,
                dpSupport,
                method: '1',
                customMonths,
                fromMonth,
                roadmap,
                first10YearsMonthly: roadmap.first10YearsMonthly,
                after10YearsMonthly: roadmap.after10YearsMonthly,
                totalContributed: roadmap.totalContributed,
                notes: roadmap.note
              });
            }}
          />
        </div>
      )}
    </div>
  </div>
);
};

export default BHXHCalc;

