import React, { useState, useMemo, useRef } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, getLocalYYYYMMDD } from '../../utils/helpers';
import { getPolicyValueForDate } from '../../utils/calculations';
import {
  generateAccumulationTimeline,
  generateBreakEvenAnalysis,
  calculatePensionRate2024,
  calculateVoluntaryBHXHRoadmap
} from '../../utils/pensionAccumulation';
import {
  exportChartToPNG,
  exportPensionProjectionToPDF
} from '../../utils/exportPensionProjection';
import {
  TrendingUp,
  Award,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Info,
  Calendar,
  Layers,
  HeartHandshake,
  Image,
  FileText,
  Loader2,
  FileDown
} from 'lucide-react';

interface PensionAccumulationChartProps {
  initialIncome?: number;
  initialGender?: 'male' | 'female';
  initialNsnnRate?: number;
  initialDpRate?: number;
  onApplyPlan?: (planData: {
    income: number;
    years: number;
    monthlyPension: number;
    gender: 'male' | 'female';
  }) => void;
  className?: string;
}

export const PensionAccumulationChart: React.FC<PensionAccumulationChartProps> = ({
  initialIncome,
  initialGender = 'male',
  initialNsnnRate = 20,
  initialDpRate = 0,
  onApplyPlan,
  className = ''
}) => {
  const { setGlobalRegisterModal, showToast, policies, settings } = useAppContext();

  // Active policy values
  const dateStr = getLocalYYYYMMDD();
  const povertyStandard = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || 1500000))
    : (settings?.povertyStandard || 1500000);

  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || 2340000))
    : (settings?.baseSalary || 2340000);

  // Parse CPI Index policy map
  const cpiPolicy = policies?.find(p => p.parameter_type === 'cpi_index' && p.is_active);
  const cpiMap = useMemo(() => {
    if (!cpiPolicy || !cpiPolicy.value) return null;
    if (typeof cpiPolicy.value === 'object') return cpiPolicy.value;
    if (typeof cpiPolicy.value === 'string') {
      try {
        return JSON.parse(cpiPolicy.value);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [cpiPolicy]);

  // States
  const [chartMode, setChartMode] = useState<'accumulation' | 'breakeven'>('accumulation');
  const [income, setIncome] = useState<number>(initialIncome || povertyStandard);
  const [gender, setGender] = useState<'male' | 'female'>(initialGender);
  const [nsnnRate, setNsnnRate] = useState<number>(initialNsnnRate);
  const [dpRate, setDpRate] = useState<number>(initialDpRate);
  const [roadmapYears, setRoadmapYears] = useState<number>(gender === 'female' ? 25 : 25);
  const [applyCpi, setApplyCpi] = useState<boolean>(true);

  // Reference for chart screenshot container
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isExportingPNG, setIsExportingPNG] = useState<boolean>(false);
  const [isExportingPDF, setIsExportingPDF] = useState<boolean>(false);

  // Sync initialIncome if provided or when povertyStandard changes
  React.useEffect(() => {
    if (initialIncome && initialIncome >= povertyStandard) {
      setIncome(initialIncome);
    }
  }, [initialIncome, povertyStandard]);

  // Timeline data for Mode 1: Accumulation (1 - 35 years)
  const accumulationData = useMemo(() => {
    return generateAccumulationTimeline({
      income,
      gender,
      povertyStandard,
      nsnnRate,
      dpRate,
      applyCpi,
      cpiMap,
      maxYears: 35
    });
  }, [income, gender, povertyStandard, nsnnRate, dpRate, applyCpi, cpiMap]);

  // Break-even data for Mode 2: Retirement Cash Flow (1 - 25 years of retirement)
  const breakEvenData = useMemo(() => {
    return generateBreakEvenAnalysis({
      roadmapYears,
      income,
      gender,
      povertyStandard,
      baseSalary,
      nsnnRate,
      dpRate,
      applyCpi,
      cpiMap,
      retirementHorizonYears: 25
    });
  }, [roadmapYears, income, gender, povertyStandard, baseSalary, nsnnRate, dpRate, applyCpi, cpiMap]);

  // Enhanced break-even timeline data for ComposedChart (Stacked Bars + Benchmark Line)
  const breakEvenChartData = useMemo(() => {
    if (!breakEvenData || !breakEvenData.timeline) return [];
    return breakEvenData.timeline.map(item => {
      const cumulativeBHYT = (item.annualBHYT || 0) * item.retirementYear;
      return {
        ...item,
        cumulativeBHYT,
        monthlyPension: breakEvenData.monthlyPension,
        totalContributed: breakEvenData.totalContributed
      };
    });
  }, [breakEvenData]);

  // Selected roadmap stats
  const currentPensionRate = useMemo(() => {
    return calculatePensionRate2024(roadmapYears, gender);
  }, [roadmapYears, gender]);

  const quickIncomeOptions = [
    { label: 'Chuẩn nghèo', value: povertyStandard },
    { label: '2,5 Triệu', value: 2500000 },
    { label: '3 Triệu', value: 3000000 },
    { label: '5 Triệu', value: 5000000 },
    { label: '8 Triệu', value: 8000000 },
    { label: '10 Triệu', value: 10000000 }
  ];

  const roadmapOptions = gender === 'female'
    ? [15, 20, 25, 30]
    : [15, 20, 25, 30, 35];

  // Action: Apply Plan
  const handleApplyCurrentPlan = () => {
    const monthlyPension = breakEvenData.monthlyPension;
    if (onApplyPlan) {
      onApplyPlan({
        income,
        years: roadmapYears,
        monthlyPension,
        gender
      });
    } else {
      showToast(`Đã chọn lộ trình ${roadmapYears} năm với mức thu nhập đóng ${formatMoney(income)}!`);
      const roadmap = calculateVoluntaryBHXHRoadmap({
        income,
        years: roadmapYears,
        povertyStandard,
        nsnnRate,
        dpRate
      });
      setGlobalRegisterModal({
        isOpen: true,
        type: 'BHXH',
        initialData: {
          income,
          years: roadmapYears,
          desiredPension: monthlyPension,
          nnSupport: nsnnRate,
          dpSupport: dpRate,
          roadmap,
          first10YearsMonthly: roadmap.first10YearsMonthly,
          after10YearsMonthly: roadmap.after10YearsMonthly,
          totalContributed: roadmap.totalContributed,
          notes: roadmap.note
        }
      });
    }
  };

  // Action: Export Chart to PNG (2x resolution)
  const handleExportPNG = async () => {
    if (!chartContainerRef.current) return;
    try {
      setIsExportingPNG(true);
      const modeStr = chartMode === 'accumulation' ? 'TichLuy' : 'HoaVon';
      const fileName = `Du_bao_luong_huu_${roadmapYears}nam_${income}_${modeStr}_${getLocalYYYYMMDD()}.png`;
      await exportChartToPNG(chartContainerRef.current, fileName);
      showToast('Đã xuất biểu đồ dự báo lương hưu sang ảnh PNG chất lượng cao (2x)!');
    } catch (error) {
      console.error('Lỗi khi xuất ảnh PNG:', error);
      showToast('Có lỗi xảy ra khi xuất hình ảnh PNG. Vui lòng thử lại!', 'error');
    } finally {
      setIsExportingPNG(false);
    }
  };

  // Action: Export Pension Projection to PDF (A4 standard)
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);
      await exportPensionProjectionToPDF({
        chartElement: chartContainerRef.current,
        roadmapYears,
        income,
        gender,
        povertyStandard,
        baseSalary,
        nsnnRate,
        dpRate,
        applyCpi,
        breakEvenData,
        agencyName: settings?.agencyName || 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ'
      });
      showToast('Đã xuất hồ sơ dự phòng hưu trí PDF khổ A4 tiêu chuẩn!');
    } catch (error) {
      console.error('Lỗi khi xuất hồ sơ PDF:', error);
      showToast('Có lỗi xảy ra khi xuất tệp PDF. Vui lòng thử lại!', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className={`w-full bg-white rounded-3xl border border-gray-100 shadow-md p-5 sm:p-8 space-y-6 ${className}`}>
      {/* Header & Mode Switcher & Export Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-5 border-b border-gray-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#004182] text-xs font-black mb-2 border border-blue-100">
            <Sparkles size={14} className="text-amber-500" />
            Biểu Đồ Dự Báo An Sinh Luật BHXH 2024
          </div>
          <h3 className="text-lg sm:text-2xl font-black text-[#004182] tracking-tight">
            Mô Phỏng Tích Lũy Lương Hưu & Điểm Hòa Vốn
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Phân tích chi tiết cơ cấu dòng tiền thực nộp, hỗ trợ ngân sách và thời gian hoàn vốn an sinh trọn đời.
          </p>
        </div>

        {/* Right Action Bar: Mode Switcher Tabs & Export Group */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto self-stretch lg:self-center">
          {/* Mode Switcher Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/90 shadow-2xs">
            <button
              type="button"
              onClick={() => setChartMode('accumulation')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                chartMode === 'accumulation'
                  ? 'bg-[#004182] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Layers size={15} />
              <span>Tích Lũy &amp; Lương Hưu</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode('breakeven')}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                chartMode === 'breakeven'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Award size={15} />
              <span>Điểm Hòa Vốn</span>
            </button>
          </div>

          {/* Export Action Group */}
          <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200/90 shadow-2xs gap-1">
            <button
              type="button"
              onClick={handleExportPNG}
              disabled={isExportingPNG}
              title="Xuất biểu đồ và số liệu phân tích thành ảnh PNG sắc nét (2x)"
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-blue-50/80 text-slate-700 hover:text-[#004182] border border-slate-200/70 hover:border-blue-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              {isExportingPNG ? (
                <Loader2 size={14} className="animate-spin text-blue-600" />
              ) : (
                <Image size={14} className="text-blue-600" />
              )}
              <span>{isExportingPNG ? 'Đang xuất PNG...' : 'Xuất Ảnh PNG'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              title="Xuất hồ sơ dự phòng hưu trí PDF khổ A4 tiêu chuẩn theo Luật BHXH 2024"
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-white hover:bg-rose-50/80 text-slate-700 hover:text-rose-700 border border-slate-200/70 hover:border-rose-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              {isExportingPDF ? (
                <Loader2 size={14} className="animate-spin text-rose-600" />
              ) : (
                <FileDown size={14} className="text-rose-600" />
              )}
              <span>{isExportingPDF ? 'Đang tạo PDF...' : 'Xuất Hồ Sơ PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div className="bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-gray-200/70 space-y-4">
        {/* Row 1: Quick Income selection */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <span>Mức thu nhập tháng lựa chọn đóng:</span>
              <span className="text-[#004182] font-black text-sm">{formatMoney(income)}</span>
            </label>
            <div className="text-[11px] text-gray-500">
              (Chuẩn nghèo: {formatMoney(povertyStandard)} - Tối đa: {formatMoney(baseSalary * 20)})
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickIncomeOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIncome(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  income === opt.value
                    ? 'bg-[#004182] text-white border-[#004182] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50/60 hover:border-blue-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Gender, Roadmaps, CPI & Support Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-gray-200/60">
          {/* Gender */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Giới tính</label>
            <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  gender === 'male' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Nam (15 năm = 40%)
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  gender === 'female' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Nữ (15 năm = 45%)
              </button>
            </div>
          </div>

          {/* Target Roadmap */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Lộ trình dự kiến</label>
            <div className="relative">
              <select
                value={roadmapYears}
                onChange={e => setRoadmapYears(Number(e.target.value))}
                className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-500 cursor-pointer h-[38px]"
              >
                {roadmapOptions.map(yrs => (
                  <option key={yrs} value={yrs}>
                    {yrs} năm đóng ({Math.round(calculatePensionRate2024(yrs, gender) * 100)}% lương hưu)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NSNN & Local Support */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Đối tượng hỗ trợ NSNN</label>
            <select
              value={nsnnRate}
              onChange={e => setNsnnRate(Number(e.target.value))}
              className="w-full bg-white border border-gray-200 rounded-xl py-2 px-3 text-xs font-bold text-gray-800 outline-none focus:border-blue-500 cursor-pointer h-[38px]"
            >
              <option value={20}>Đối tượng khác (20%)</option>
              <option value={50}>Hộ nghèo / Xã đảo (50%)</option>
              <option value={40}>Hộ cận nghèo (40%)</option>
              <option value={30}>Người dân tộc thiểu số (30%)</option>
              <option value={10}>Khác (10%)</option>
              <option value={0}>Không hỗ trợ (0%)</option>
            </select>
          </div>

          {/* CPI Inflation Adjustment Toggle */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">Hệ số trượt giá (CPI)</label>
            <button
              type="button"
              onClick={() => setApplyCpi(prev => !prev)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer h-[38px] ${
                applyCpi
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/60'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span>{applyCpi ? '✓ Đang tính CPI' : 'Sức mua gốc'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                applyCpi ? 'bg-emerald-200/80 text-emerald-900' : 'bg-gray-100 text-gray-500'
              }`}>
                {applyCpi ? 'Chính sách thực' : 'Không trượt giá'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Capture Container */}
      <div ref={chartContainerRef} className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        {/* Header summary watermark badge inside captured image */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
          <div>
            <div className="text-xs sm:text-sm font-black text-[#004182] uppercase tracking-wide">
              {chartMode === 'accumulation'
                ? 'Biểu Đồ Lũy Kế Đóng Phí & Dự Báo Lương Hưu (1 - 35 Năm)'
                : `Mô Phỏng Dòng Tiền & Điểm Hòa Vốn Hưu Trí - Lộ Trình ${roadmapYears} Năm`}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Mức thu nhập đóng: <strong className="text-gray-900">{formatMoney(income)}</strong> • Giới tính: <strong className="text-gray-900">{gender === 'female' ? 'Nữ' : 'Nam'}</strong> • NSNN hỗ trợ: <strong className="text-emerald-700">{nsnnRate}% chuẩn nghèo (10 năm đầu)</strong>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#004182] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
            <ShieldCheck size={14} className="text-[#004182]" />
            <span>Luật BHXH 2024 & NĐ 159/2025</span>
          </div>
        </div>

        {/* Chart Section */}
        {chartMode === 'accumulation' ? (
        <div className="space-y-4">
          {/* Key Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50/60 p-3.5 rounded-2xl border border-blue-100">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">Thực nộp (10 năm đầu)</span>
              <span className="text-base sm:text-lg font-black text-[#004182]">
                {formatMoney(accumulationData[0]?.personalMonthly || 0)}/th
              </span>
              <span className="text-[10px] text-gray-500 block mt-0.5">Từ năm 11: {formatMoney(accumulationData[10]?.personalMonthly || 0)}/th</span>
            </div>

            <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">NSNN hỗ trợ (tối đa 10 năm)</span>
              <span className="text-base sm:text-lg font-black text-emerald-700">
                +{formatMoney(accumulationData[0]?.supportMonthly || 0)}/th
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">{nsnnRate + dpRate}% chuẩn nghèo (120 tháng)</span>
            </div>

            <div className="bg-purple-50/60 p-3.5 rounded-2xl border border-purple-100">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">Mốc 15 năm ({gender === 'female' ? '45%' : '40%'})</span>
              <span className="text-base sm:text-lg font-black text-purple-700">
                {formatMoney(accumulationData[14]?.monthlyPension || 0)}/th
              </span>
              <span className="text-[10px] text-purple-600 block mt-0.5">Đủ điều kiện nhận hưu</span>
            </div>

            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-100">
              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">Mốc tối đa 75%</span>
              <span className="text-base sm:text-lg font-black text-amber-700">
                {formatMoney(accumulationData[gender === 'female' ? 29 : 34]?.monthlyPension || 0)}/th
              </span>
              <span className="text-[10px] text-amber-600 block mt-0.5">{gender === 'female' ? '30 năm đóng' : '35 năm đóng'}</span>
            </div>
          </div>

          {/* Recharts ComposedChart: Accumulation */}
          <div className="w-full h-[400px] sm:h-[440px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={accumulationData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="year"
                  unit=" năm"
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tickLine={false}
                  tick={{ fill: '#0369a1', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Tr`}
                  label={{ value: 'Tổng tiền tích lũy (VNĐ)', angle: -90, position: 'insideLeft', fill: '#0369a1', fontSize: 11, fontWeight: 'bold' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  tick={{ fill: '#dc2626', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Tr`}
                  label={{ value: 'Lương hưu tháng (VNĐ)', angle: 90, position: 'insideRight', fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const num = Number(value) || 0;
                    if (name === 'Lương hưu hàng tháng (nhận được)') {
                      return [num > 0 ? `${formatMoney(num)} / tháng` : 'Chưa đủ 15 năm', name];
                    }
                    return [formatMoney(num), name];
                  }}
                  labelFormatter={(year) => {
                    const y = Number(year) || 0;
                    const supportStatus = y <= 10 ? 'Đang được NSNN hỗ trợ' : 'Từ năm 11: Đóng 100% mức gốc';
                    return `Thời gian đóng: ${y} năm (${y * 12} tháng) - [${supportStatus}]`;
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px'
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="cumulativePersonal"
                  name="Cá nhân thực nộp lũy kế"
                  fill="#0ea5e9"
                  stackId="stack"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  yAxisId="left"
                  dataKey="cumulativeSupport"
                  name="Ngân sách Nhà nước/ĐP hỗ trợ"
                  fill="#10b981"
                  stackId="stack"
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="monthlyPension"
                  name="Lương hưu hàng tháng (nhận được)"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 2.5, fill: '#ef4444' }}
                  activeDot={{ r: 6 }}
                />
                <ReferenceLine
                  yAxisId="left"
                  x={15}
                  stroke="#7c3aed"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: 'Mốc 15 năm: Bắt đầu hưởng hưu',
                    position: 'top',
                    fill: '#7c3aed',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Break-even Highlight Summary Card */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-blue-50/50 p-5 rounded-2xl border border-emerald-200/80 shadow-xs">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black">
                  <ShieldCheck size={14} /> Điểm Hòa Vốn An Sinh: ~{breakEvenData.breakEvenYears} Năm ({breakEvenData.breakEvenMonthsTotal} tháng)
                </div>
                <h4 className="text-base sm:text-xl font-black text-gray-900">
                  Lộ Trình {roadmapYears} Năm: Thu Hồi 100% Vốn Thực Đóng Chỉ Sau ~{breakEvenData.breakEvenYears} Năm Hưu Trí!
                </h4>
                <p className="text-xs sm:text-sm text-gray-600">
                  Tổng vốn bạn thực nộp: <span className="font-bold text-[#004182]">{formatMoney(breakEvenData.totalContributed)}</span>.
                  Mỗi năm nghỉ hưu, bạn nhận <span className="font-bold text-emerald-700">{formatMoney(breakEvenData.annualBenefitTotal)}</span> (gồm lương hưu & thẻ BHYT 95%).
                </p>
                {breakEvenData.unsupportedYears > 0 ? (
                  <div className="text-[11px] text-gray-600 bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-start gap-1.5 mt-1">
                    <Info size={14} className="text-[#004182] shrink-0 mt-0.5" />
                    <span>
                      <strong>Quy định Luật BHXH 2024 & NĐ 159/2025:</strong> 10 năm đầu nộp <span className="font-bold text-[#004182]">{formatMoney(breakEvenData.personalMonthlyWithSupport)}/tháng</span> (được NSNN hỗ trợ); {breakEvenData.unsupportedYears} năm còn lại nộp đủ 100% gốc <span className="font-bold text-gray-800">{formatMoney(breakEvenData.grossMonthly)}/tháng</span> (do NSNN chỉ hỗ trợ tối đa 10 năm = 120 tháng).
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-600 bg-white/80 p-2 rounded-xl border border-emerald-100 flex items-start gap-1.5 mt-1">
                    <Info size={14} className="text-[#004182] shrink-0 mt-0.5" />
                    <span>
                      <strong>Quy định Luật BHXH 2024:</strong> Toàn bộ {roadmapYears} năm được NSNN hỗ trợ tiền đóng <span className="font-bold text-[#004182]">{formatMoney(breakEvenData.personalMonthlyWithSupport)}/tháng</span> (tối đa 10 năm).
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[11px] text-gray-500 font-bold block">Lương hưu tháng</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-700">
                    {formatMoney(breakEvenData.monthlyPension)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recharts ComposedChart: Break-Even Timeline (Dạng Cột Xếp Chồng Tương Tự Chart Tích Lũy) */}
          <div className="w-full h-[400px] sm:h-[440px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={breakEvenChartData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="retirementYear"
                  unit=" năm"
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  tickLine={false}
                  tick={{ fill: '#0369a1', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Tr`}
                  label={{ value: 'Giá trị tích lũy nhận được (VNĐ)', angle: -90, position: 'insideLeft', fill: '#0369a1', fontSize: 11, fontWeight: 'bold' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  tick={{ fill: '#dc2626', fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Tr`}
                  label={{ value: 'Lương hưu tháng (VNĐ)', angle: 90, position: 'insideRight', fill: '#dc2626', fontSize: 11, fontWeight: 'bold' }}
                />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    const num = Number(value) || 0;
                    if (name === 'Lương hưu hàng tháng (nhận được)') {
                      return [`${formatMoney(num)} / tháng`, name];
                    }
                    return [formatMoney(num), name];
                  }}
                  labelFormatter={(year) => {
                    const y = Number(year) || 0;
                    const isPassed = y >= breakEvenData.breakEvenYears;
                    const statusText = isPassed ? 'Đã thu hồi 100% vốn (Lãi an sinh ròng)' : 'Giai đoạn thu hồi vốn';
                    return `Năm thứ ${y} sau khi nghỉ hưu - [${statusText}]`;
                  }}
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.96)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px'
                  }}
                />
                <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />

                {/* Cột xanh dương: Tổng lương hưu tích lũy nhận được */}
                <Bar
                  yAxisId="left"
                  dataKey="cumulativePensionOnly"
                  name="Tổng lương hưu tích lũy nhận được"
                  fill="#0ea5e9"
                  stackId="benefitStack"
                  radius={[0, 0, 4, 4]}
                />

                {/* Cột xanh lá chồng lên: Quyền lợi thẻ BHYT 95% tích lũy */}
                <Bar
                  yAxisId="left"
                  dataKey="cumulativeBHYT"
                  name="Giá trị thẻ BHYT 95% tích lũy"
                  fill="#10b981"
                  stackId="benefitStack"
                  radius={[4, 4, 0, 0]}
                />

                {/* Đường nét đứt màu cam: Tổng vốn cá nhân thực nộp */}
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalContributed"
                  name="Tổng vốn cá nhân thực nộp (mốc hoàn vốn)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={false}
                />

                {/* Đường nét liền màu đỏ: Lương hưu hàng tháng */}
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="monthlyPension"
                  name="Lương hưu hàng tháng (nhận được)"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 2.5, fill: '#ef4444' }}
                  activeDot={{ r: 5 }}
                />

                {/* Vạch kẻ dọc đỏ nét đứt: Điểm hòa vốn */}
                <ReferenceLine
                  yAxisId="left"
                  x={Math.ceil(breakEvenData.breakEvenYears)}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `Điểm hòa vốn (~${breakEvenData.breakEvenYears} năm)`,
                    position: 'top',
                    fill: '#dc2626',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      </div>

      {/* Action Footer: Apply this plan & Quick Export */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-5 border-t border-gray-100 bg-gray-50/50 p-4 rounded-2xl">
        <div className="flex items-center gap-2.5 text-xs text-gray-600">
          <HeartHandshake size={20} className="text-[#004182] shrink-0" />
          <span>
            Lộ trình <strong className="text-gray-900">{roadmapYears} năm</strong> với mức thu nhập <strong className="text-[#004182]">{formatMoney(income)}</strong> mang lại mức lương hưu ước tính <strong className="text-emerald-700">{formatMoney(breakEvenData.monthlyPension)}/tháng</strong> trọn đời.
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleApplyCurrentPlan}
            className="w-full sm:w-auto bg-[#004182] hover:bg-[#003060] text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>Áp Dụng Mức Đóng Này</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PensionAccumulationChart;
