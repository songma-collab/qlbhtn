import { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, getInt, getLocalYYYYMMDD } from '../../utils/helpers';
import { getPolicyValueForDate, calculatePensionEffortRating } from '../../utils/calculations';
import { Sparkles, Coins, TrendingUp } from 'lucide-react';
import PensionAccumulationChart from './PensionAccumulationChart';

const PensionAssistant = () => {
  const { setGlobalRegisterModal, showToast, policies, settings } = useAppContext();

  // Input states
  const [actualIncomeStr, setActualIncomeStr] = useState('10.000.000');
  const [desiredPensionStr, setDesiredPensionStr] = useState('3.000.000');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [nsnnRate, setNsnnRate] = useState<number>(20);
  const [localSupportPercent, setLocalSupportPercent] = useState<number>(0);

  // Parse numeric values
  const actualIncome = useMemo(() => getInt(actualIncomeStr), [actualIncomeStr]);
  const desiredPension = useMemo(() => getInt(desiredPensionStr), [desiredPensionStr]);

  // Active policies from context using getPolicyValueForDate
  const dateStr = getLocalYYYYMMDD();
  const povertyStandard = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || 1500000))
    : (settings?.povertyStandard || 1500000);

  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || 2340000))
    : (settings?.baseSalary || 2340000);
  const maxBHXHIncome = baseSalary * 20;

  // Active CPI index policy from system settings
  const cpiPolicy = policies?.find(p => p.parameter_type === 'cpi_index' && p.is_active);

  // Parse CPI Index JSON map from active policy
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

  // Helper to compute average CPI multiplier for N years based on active CPI policy table
  const getCpiFactorForYears = (years: number): number => {
    if (!cpiMap) {
      return 1.0 + (years * 0.015);
    }

    const currentYear = new Date().getFullYear();
    const startYear = currentYear - years + 1;
    let sum = 0;
    let count = 0;

    for (let y = startYear; y <= currentYear; y++) {
      const yearStr = String(y);
      if (cpiMap[yearStr] !== undefined) {
        sum += Number(cpiMap[yearStr]);
        count++;
      } else {
        const availableYears = Object.keys(cpiMap).map(Number);
        if (availableYears.length > 0) {
          const minYear = Math.min(...availableYears);
          if (y < minYear && cpiMap[String(minYear)]) {
            sum += Number(cpiMap[String(minYear)]);
            count++;
          } else {
            sum += 1.0;
            count++;
          }
        } else {
          sum += 1.0;
          count++;
        }
      }
    }

    if (count === 0) return 1.0 + (years * 0.015);
    const avgFactor = sum / count;
    return avgFactor > 0 ? avgFactor : (1.0 + (years * 0.015));
  };

  // NSNN support amount
  const nsnnSupport = useMemo(() => {
    return Math.round(povertyStandard * 0.22 * (nsnnRate / 100));
  }, [povertyStandard, nsnnRate]);

  // Local support amount
  const localSupport = useMemo(() => {
    return Math.round(povertyStandard * 0.22 * (localSupportPercent / 100));
  }, [povertyStandard, localSupportPercent]);

  // Roadmaps configuration adapted dynamically based on gender
  const roadmapsConfig = useMemo(() => {
    if (gender === 'female') {
      return [
        {
          years: 15,
          badge: '15 NĂM ĐÓNG',
          badgeBg: 'bg-purple-50 text-purple-700 border border-purple-200',
          title: 'Lộ trình tối thiểu (15 năm)',
          desc: 'Đóng tối thiểu để hưởng chế độ hưu trí sớm nhất.',
          rate: 0.45,
          isRecommended: false,
        },
        {
          years: 20,
          badge: '20 NĂM ĐÓNG',
          badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
          title: 'Lộ trình tiêu chuẩn (20 năm)',
          desc: 'Phương án cơ bản phổ biến, cân bằng thời gian đóng.',
          rate: 0.55,
          isRecommended: false,
        },
        {
          years: 25,
          badge: '25 NĂM ĐÓNG',
          badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200',
          title: 'Lộ trình phát triển (25 năm)',
          desc: 'Đóng trung hạn để nhận mức lương hưu trung bình khá.',
          rate: 0.65,
          isRecommended: true,
        },
        {
          years: 30,
          badge: '30 NĂM ĐÓNG',
          badgeBg: 'bg-amber-50 text-amber-700 border border-amber-200',
          title: 'Lộ trình tối đa (30 năm)',
          desc: 'Tích lũy tối đa để hưởng tỷ lệ lương hưu trần 75%.',
          rate: 0.75,
          isRecommended: false,
        },
      ];
    }

    return [
      {
        years: 15,
        badge: '15 NĂM ĐÓNG',
        badgeBg: 'bg-purple-50 text-purple-700 border border-purple-200',
        title: 'Lộ trình tối thiểu (15 năm)',
        desc: 'Đóng tối thiểu để hưởng chế độ hưu trí sớm nhất.',
        rate: 0.40,
        isRecommended: false,
      },
      {
        years: 20,
        badge: '20 NĂM ĐÓNG',
        badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        title: 'Lộ trình tiêu chuẩn (20 năm)',
        desc: 'Phương án cơ bản phổ biến, cân bằng thời gian đóng.',
        rate: 0.45,
        isRecommended: false,
      },
      {
        years: 25,
        badge: '25 NĂM ĐÓNG',
        badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200',
        title: 'Lộ trình phát triển (25 năm)',
        desc: 'Đóng trung hạn để nhận mức lương hưu trung bình khá.',
        rate: 0.55,
        isRecommended: true,
      },
      {
        years: 30,
        badge: '30 NĂM ĐÓNG',
        badgeBg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        title: 'Lộ trình tích lũy (30 năm)',
        desc: 'Mức lương hưu tiệm cận tối đa.',
        rate: 0.65,
        isRecommended: false,
      },
      {
        years: 35,
        badge: '35 NĂM ĐÓNG',
        badgeBg: 'bg-amber-50 text-amber-700 border border-amber-200',
        title: 'Lộ trình tối đa (35 năm)',
        desc: 'Tích lũy tối đa để hưởng tỷ lệ lương hưu trần 75%.',
        rate: 0.75,
        isRecommended: false,
      },
    ];
  }, [gender]);

  // Calculated Roadmaps with exact CPI Inflation adjustment factor from active JSON policy
  const calculatedRoadmaps = useMemo(() => {
    return roadmapsConfig.map(item => {
      const pensionRate = item.rate;
      
      // Calculate exact CPI factor from active cpi_index policy table
      const cpiFactor = getCpiFactorForYears(item.years);
      
      // Income formula with CPI inflation factor:
      // DesiredPension = ChosenBHXH * CPI_Factor * PensionRate
      // => ChosenBHXH = DesiredPension / (PensionRate * CPI_Factor)
      const rawIncome = desiredPension > 0 
        ? desiredPension / (pensionRate * cpiFactor) 
        : povertyStandard;
      
      // Round to nearest 50.000đ and clamp within bounds [povertyStandard, maxBHXHIncome]
      let chosenBHXH = Math.round(rawIncome / 50000) * 50000;
      if (chosenBHXH < povertyStandard) chosenBHXH = povertyStandard;
      if (chosenBHXH > maxBHXHIncome) chosenBHXH = maxBHXHIncome;

      const grossPremium = Math.round(chosenBHXH * 0.22);
      const actualPremium = Math.max(0, grossPremium - nsnnSupport - localSupport);
      const salaryRatio = actualIncome > 0 ? (actualPremium / actualIncome) * 100 : 0;

      const effortRating = calculatePensionEffortRating(
        actualPremium,
        actualIncome,
        item.years,
        salaryRatio,
        chosenBHXH,
        povertyStandard
      );

      return {
        ...item,
        cpiFactor,
        pensionRatePct: Math.round(pensionRate * 100),
        chosenBHXH,
        actualPremium,
        salaryRatioPct: salaryRatio.toFixed(1),
        ratingText: effortRating.ratingText,
        ratingBg: effortRating.ratingBg,
        ratioBadgeBg: effortRating.ratioBadgeBg,
        ratingDesc: effortRating.ratingDesc,
      };
    });
  }, [roadmapsConfig, desiredPension, actualIncome, nsnnSupport, localSupport, povertyStandard, maxBHXHIncome, cpiMap]);

  const handleQuickSelectIncome = (amount: number) => {
    setActualIncomeStr(formatMoney(amount).replace(' ₫', ''));
  };

  const handleQuickSelectPension = (amount: number) => {
    setDesiredPensionStr(formatMoney(amount).replace(' ₫', ''));
  };

  const handleApplyRoadmap = (roadmap: typeof calculatedRoadmaps[0]) => {
    showToast(`Đã chọn Lộ trình ${roadmap.years} năm với mức đóng BHXH: ${formatMoney(roadmap.chosenBHXH)}!`);
    setGlobalRegisterModal({
      isOpen: true,
      type: 'BHXH',
      initialData: {
        income: roadmap.chosenBHXH,
        nnSupport: nsnnRate,
        dpSupport: localSupportPercent || 0,
        method: '1'
      }
    });
  };

  return (
    <div className="w-full">
      {/* Header Title */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
          <Sparkles size={24} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Trợ Lý Hưu Trí: Dự Phóng & Gợi Ý Mức Đóng Tối Ưu
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Thuật toán phân tích lộ trình đóng để đạt mức hưởng mong muốn mà không gây áp lực tài chính
          </p>
        </div>
      </div>

      {/* Inputs Card */}
      <div className="bg-white rounded-2xl p-6 lg:p-8 shadow-xs border border-slate-200 mb-6">
        <h3 className="text-xs sm:text-sm font-bold text-slate-400 tracking-wider uppercase mb-5 flex items-center gap-2">
          <Coins size={16} className="text-[#004182]" /> Nhu cầu & Thông tin đóng
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 items-start mb-4">
          {/* 1. Thu nhập thực tế / tháng */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Thu nhập thực tế / tháng:
            </label>
            <div className="relative">
              <input
                type="text"
                value={actualIncomeStr}
                onChange={(e) => {
                  const val = getInt(e.target.value);
                  setActualIncomeStr(val ? formatMoney(val).replace(' ₫', '') : '');
                }}
                className="w-full p-2.5 pr-12 rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 text-sm outline-none focus:border-[#004182] focus:bg-white transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VND</span>
            </div>
            {/* Quick selectors */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[5000000, 10000000, 15000000, 20000000, 30000000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickSelectIncome(amt)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                    actualIncome === amt
                      ? 'bg-[#004182] text-white border-[#004182]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {amt / 1000000}Tr
                </button>
              ))}
            </div>
          </div>

          {/* 2. Lương hưu mong muốn */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lương hưu mong muốn:
            </label>
            <div className="relative">
              <input
                type="text"
                value={desiredPensionStr}
                onChange={(e) => {
                  const val = getInt(e.target.value);
                  setDesiredPensionStr(val ? formatMoney(val).replace(' ₫', '') : '');
                }}
                className="w-full p-2.5 pr-12 rounded-xl border border-slate-200 bg-slate-50/50 font-black text-slate-900 text-sm outline-none focus:border-[#004182] focus:bg-white transition"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">VND</span>
            </div>
            {/* Quick selectors */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[2000000, 3000000, 5000000, 7000000, 10000000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickSelectPension(amt)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                    desiredPension === amt
                      ? 'bg-[#004182] text-white border-[#004182]'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {amt / 1000000}Tr
                </button>
              ))}
            </div>
          </div>

          {/* 3. Giới tính */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Giới tính:
            </label>
            <div className="grid grid-cols-2 gap-2 h-[42px]">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`w-full rounded-xl font-bold text-sm transition flex items-center justify-center ${
                  gender === 'male'
                    ? 'bg-[#004182] text-white shadow'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Nam
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`w-full rounded-xl font-bold text-sm transition flex items-center justify-center ${
                  gender === 'female'
                    ? 'bg-[#004182] text-white shadow'
                    : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                Nữ
              </button>
            </div>
          </div>

          {/* 4. Nhà nước hỗ trợ (NSNN) */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Nhà nước hỗ trợ (NSNN):
            </label>
            <select
              value={nsnnRate ?? 20}
              onChange={(e) => setNsnnRate(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 font-bold text-gray-800 text-sm outline-none focus:border-[#004182] focus:bg-white transition cursor-pointer h-[42px]"
            >
              <option value={20}>Khác (20%)</option>
              <option value={50}>Hộ nghèo (50%)</option>
              <option value={40}>Hộ cận nghèo (40%)</option>
              <option value={30}>Dân tộc thiểu số (30%)</option>
              <option value={10}>Khác (10%)</option>
              <option value={0}>Không hỗ trợ (0%)</option>
            </select>
          </div>

          {/* 5. Địa phương hỗ trợ */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Địa phương hỗ trợ:
            </label>
            <select
              value={localSupportPercent ?? 0}
              onChange={(e) => setLocalSupportPercent(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl border border-gray-200 bg-gray-50/50 font-bold text-gray-800 text-sm outline-none focus:border-[#004182] focus:bg-white transition cursor-pointer h-[42px]"
            >
              <option value={0}>0%</option>
              <option value={10}>10%</option>
              <option value={20}>20%</option>
              <option value={30}>30%</option>
              <option value={40}>40%</option>
              <option value={50}>50%</option>
            </select>
          </div>
        </div>

        {/* CPI Policy Info Banner */}
        <div className="flex items-center gap-2 text-xs text-blue-800 bg-blue-50/80 p-3 rounded-2xl border border-blue-100">
          <TrendingUp size={16} className="text-[#004182] shrink-0" />
          <span>
            <strong>Hệ số Trượt giá CPI: Căn cứ</strong> <span className="font-bold text-[#004182]">{cpiPolicy?.name || 'Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026'}</span>
          </span>
        </div>
      </div>

      {/* Roadmaps Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${gender === 'female' ? 'lg:grid-cols-4' : 'lg:grid-cols-5'} gap-5 items-stretch`}>
        {calculatedRoadmaps.map((roadmap) => (
          <div
            key={roadmap.years}
            className={`relative rounded-3xl p-5 flex flex-col justify-between transition-all duration-200 bg-white ${
              roadmap.isRecommended
                ? 'border-2 border-[#004182] shadow-xl ring-4 ring-blue-50 scale-[1.02] z-10'
                : 'border border-gray-200/80 shadow-sm hover:shadow-md'
            }`}
          >
            {/* Top Recommended Tag */}
            {roadmap.isRecommended && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#004182] text-amber-300 font-extrabold text-[11px] px-3.5 py-1 rounded-full shadow-md flex items-center gap-1 uppercase tracking-wider">
                ★ KHUYÊN DÙNG
              </div>
            )}

            <div>
              {/* Badge & Title */}
              <div className="mb-4">
                <span className={`inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider mb-2 ${roadmap.badgeBg}`}>
                  {roadmap.badge}
                </span>
                <h4 className="font-extrabold text-gray-900 text-base leading-snug">
                  {roadmap.title}
                </h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed font-medium">
                  {roadmap.desc}
                </p>
              </div>

              {/* Price Box */}
              <div className="bg-gray-50/80 rounded-2xl p-3.5 mb-4 border border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  PHÍ ĐÓNG THỰC TẾ:
                </span>
                <div className="text-xl font-black text-gray-900 mb-2">
                  {formatMoney(roadmap.actualPremium)} <span className="text-xs font-semibold text-gray-500">/tháng</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
                  <span>Chiếm tỷ lệ lương:</span>
                  <span className={`font-black px-2 py-0.5 rounded-full border ${roadmap.ratioBadgeBg}`}>
                    {roadmap.salaryRatioPct}%
                  </span>
                </div>
              </div>

              {/* Details Box */}
              <div className="bg-gray-50/50 rounded-2xl p-3.5 mb-4 border border-gray-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-gray-600 font-medium">
                  <span className="text-gray-500">Mức đóng BHXH đã chọn:</span>
                </div>
                <div className="text-center font-extrabold text-gray-900 text-sm bg-white py-1.5 rounded-xl border border-dashed border-gray-300">
                  {formatMoney(roadmap.chosenBHXH)}
                </div>
                <div className="flex items-center justify-between text-gray-600 font-medium pt-1">
                  <span className="text-gray-500 flex items-center gap-1">
                    <TrendingUp size={12} className="text-blue-600" /> Hệ số trượt giá:
                  </span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    x{roadmap.cpiFactor.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600 font-medium pt-0.5">
                  <span>Tỷ lệ lương hưu:</span>
                  <span className="font-extrabold text-gray-900 text-sm">{roadmap.pensionRatePct}%</span>
                </div>
              </div>
            </div>

            <div>
              {/* Rating Badge */}
              <div className={`text-center py-2 px-3 rounded-2xl font-bold text-xs mb-3 flex flex-col items-center justify-center gap-1 border ${roadmap.ratingBg}`}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="opacity-80">💡 Lực đóng:</span>
                  <span className="font-extrabold">{roadmap.ratingText}</span>
                </div>
                {roadmap.ratingDesc && (
                  <span className="text-[10px] font-normal leading-tight opacity-90 text-center">
                    {roadmap.ratingDesc}
                  </span>
                )}
              </div>

              {/* Apply Button */}
              <button
                type="button"
                onClick={() => handleApplyRoadmap(roadmap)}
                className="w-full py-3 px-4 rounded-xl bg-[#004182] hover:bg-blue-900 text-white font-bold text-xs sm:text-sm transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                Áp dụng mức đóng này
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Biểu đồ Recharts: Dự báo tích lũy lương hưu & Điểm hòa vốn hưu trí */}
      <PensionAccumulationChart
        initialIncome={calculatedRoadmaps[0]?.chosenBHXH || povertyStandard}
        initialGender={gender}
        initialNsnnRate={nsnnRate}
        initialDpRate={localSupportPercent}
        className="mt-8"
      />
    </div>
  );
};

export default PensionAssistant;
