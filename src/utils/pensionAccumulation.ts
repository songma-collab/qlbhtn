/**
 * Module tính toán tích lũy lương hưu và điểm hòa vốn theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP
 */

export interface AccumulationYearData {
  year: number;
  personalMonthly: number;
  supportMonthly: number;
  grossMonthly: number;
  cumulativePersonal: number;
  cumulativeSupport: number;
  totalAccumulated: number;
  pensionRate: number; // e.g. 0.45 = 45%
  pensionRatePct: number; // e.g. 45
  cpiFactor: number;
  adjustedIncome: number;
  monthlyPension: number;
  isEligibleForPension: boolean;
}

export interface BreakEvenYearData {
  retirementYear: number;
  totalContributed: number;
  annualPension: number;
  annualBHYT: number;
  cumulativePensionOnly: number;
  cumulativeBenefitWithBHYT: number;
  netSurplus: number;
  isBreakeven: boolean;
}

export interface BreakEvenAnalysis {
  breakEvenYears: number; // Số năm cần để hòa vốn (số thực, VD: 2.7)
  breakEvenMonthsTotal: number; // Số tháng cần để hòa vốn
  totalContributed: number;
  grossMonthly: number;
  supportMonthly: number;
  personalMonthlyWithSupport: number;
  supportedYears: number;
  unsupportedYears: number;
  supportedContributionTotal: number;
  unsupportedContributionTotal: number;
  monthlyPension: number;
  annualBHYTValue: number;
  annualBenefitTotal: number;
  timeline: BreakEvenYearData[];
}

/**
 * Tỷ lệ hưởng lương hưu theo Luật BHXH 2024 (Áp dụng từ ngày 01/07/2025):
 * - Thời gian đóng tối thiểu để hưởng lương hưu: 15 năm (thay vì 20 năm).
 * - Nữ:
 *   + Đủ 15 năm đóng: tính bằng 45%.
 *   + Mỗi năm đóng thêm được tính thêm 2%, tối đa 75% (đạt mốc tối đa khi đóng đủ 30 năm).
 * - Nam:
 *   + Đủ 15 năm đóng: tính bằng 40%.
 *   + Từ năm thứ 16 đến năm thứ 20: mỗi năm tính thêm 1% (20 năm = 45%).
 *   + Từ năm thứ 21 trở đi: mỗi năm tính thêm 2%, tối đa 75% (đạt mốc tối đa khi đóng đủ 35 năm).
 * - Nếu thời gian đóng < 15 năm: chưa đủ điều kiện hưởng lương hưu hàng tháng (tỷ lệ = 0%).
 */
export const calculatePensionRate2024 = (years: number, gender: 'male' | 'female'): number => {
  if (years < 15) return 0;

  if (gender === 'female') {
    const rate = 0.45 + (years - 15) * 0.02;
    return Math.min(0.75, Math.max(0.45, Number(rate.toFixed(4))));
  } else {
    let rate = 0.40;
    if (years <= 20) {
      rate = 0.40 + (years - 15) * 0.01;
    } else {
      rate = 0.45 + (years - 20) * 0.02;
    }
    return Math.min(0.75, Math.max(0.40, Number(rate.toFixed(4))));
  }
};

/**
 * Tính hệ số trượt giá CPI bình quân theo số năm đóng
 */
export const getCpiMultiplier = (
  years: number,
  cpiMap?: Record<string, number> | null
): number => {
  if (!cpiMap) {
    // Dự báo lạm phát/trượt giá bình quân danh nghĩa ~ 1.5%/năm
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
  const avg = sum / count;
  return avg > 0 ? avg : (1.0 + (years * 0.015));
};

/**
 * Tính toán số tiền cá nhân thực nộp và NSNN hỗ trợ lũy kế
 * QUY ĐỊNH PHÁP LÝ (Khoản 1 Điều 36 Luật BHXH 2024 & Điều 14 Nghị định 134/2015, Nghị định 159/2025):
 * - Thời gian hỗ trợ tiền đóng BHXH tự nguyện tối đa không quá 10 năm (120 tháng).
 * - Trong 10 năm đầu: Cá nhân nộp = Mức đóng gốc (22%) - Hỗ trợ (NSNN + ĐP).
 * - Từ năm thứ 11 trở đi (sau 120 tháng): Hết thời hạn hỗ trợ, cá nhân đóng 100% mức đóng gốc (22%).
 */
export const calculateTotalContribution = (
  years: number,
  grossMonthly: number,
  supportMonthly: number
): {
  totalContributed: number;
  supportedMonths: number;
  unsupportedMonths: number;
  supportedTotal: number;
  unsupportedTotal: number;
  cumulativeSupportTotal: number;
} => {
  const totalMonths = Math.round(years * 12);
  const supportedMonths = Math.min(totalMonths, 120);
  const unsupportedMonths = Math.max(0, totalMonths - 120);

  const personalMonthlyWithSupport = Math.max(0, grossMonthly - supportMonthly);
  const supportedTotal = supportedMonths * personalMonthlyWithSupport;
  const unsupportedTotal = unsupportedMonths * grossMonthly;
  const totalContributed = supportedTotal + unsupportedTotal;
  const cumulativeSupportTotal = supportedMonths * supportMonthly;

  return {
    totalContributed,
    supportedMonths,
    unsupportedMonths,
    supportedTotal,
    unsupportedTotal,
    cumulativeSupportTotal
  };
};

export interface GenerateTimelineParams {
  income: number;
  gender: 'male' | 'female';
  povertyStandard: number;
  nsnnRate: number; // 20 | 50 | 40 | 30 | 10 | 0 (%)
  dpRate: number; // 0 | 5 | 10 | 20... (%)
  applyCpi: boolean;
  cpiMap?: Record<string, number> | null;
  maxYears?: number; // mặc định 35
}

/**
 * Sinh chuỗi dữ liệu tích lũy đóng phí & lương hưu từ 1 đến 35 năm (Chế độ 1)
 */
export const generateAccumulationTimeline = (params: GenerateTimelineParams): AccumulationYearData[] => {
  const {
    income,
    gender,
    povertyStandard,
    nsnnRate,
    dpRate,
    applyCpi,
    cpiMap,
    maxYears = 35
  } = params;

  const grossMonthly = Math.round(income * 0.22);
  const supportMonthlyStandard = Math.round((povertyStandard * 0.22) * ((nsnnRate + dpRate) / 100));
  const personalMonthlyWithSupport = Math.max(0, grossMonthly - supportMonthlyStandard);

  const timeline: AccumulationYearData[] = [];

  for (let y = 1; y <= maxYears; y++) {
    const contributionInfo = calculateTotalContribution(y, grossMonthly, supportMonthlyStandard);
    const cumulativePersonal = contributionInfo.totalContributed;
    const cumulativeSupport = contributionInfo.cumulativeSupportTotal;
    const totalAccumulated = grossMonthly * y * 12;

    // Trong năm thứ y: nếu y <= 10 thì tháng đó được hỗ trợ; nếu y > 10 thì tháng đó đóng 100% gốc
    const currentSupportMonthly = y <= 10 ? supportMonthlyStandard : 0;
    const currentPersonalMonthly = y <= 10 ? personalMonthlyWithSupport : grossMonthly;

    const pensionRate = calculatePensionRate2024(y, gender);
    const pensionRatePct = Math.round(pensionRate * 100);

    const cpiFactor = applyCpi ? getCpiMultiplier(y, cpiMap) : 1.0;
    const adjustedIncome = Math.round(income * cpiFactor);

    const monthlyPension = y >= 15 ? Math.round(adjustedIncome * pensionRate) : 0;

    timeline.push({
      year: y,
      personalMonthly: currentPersonalMonthly,
      supportMonthly: currentSupportMonthly,
      grossMonthly,
      cumulativePersonal,
      cumulativeSupport,
      totalAccumulated,
      pensionRate,
      pensionRatePct,
      cpiFactor,
      adjustedIncome,
      monthlyPension,
      isEligibleForPension: y >= 15
    });
  }

  return timeline;
};

export interface GenerateBreakEvenParams {
  roadmapYears: number; // 15 | 20 | 25 | 30 | 35
  income: number;
  gender: 'male' | 'female';
  povertyStandard: number;
  baseSalary: number; // Dùng để tính giá trị thẻ BHYT (4.5% lương cơ sở)
  nsnnRate: number;
  dpRate: number;
  applyCpi: boolean;
  cpiMap?: Record<string, number> | null;
  retirementHorizonYears?: number; // 25 năm nghỉ hưu
}

/**
 * Phân tích dòng tiền hưu trí và điểm hòa vốn an sinh (Chế độ 2)
 */
export const generateBreakEvenAnalysis = (params: GenerateBreakEvenParams): BreakEvenAnalysis => {
  const {
    roadmapYears,
    income,
    gender,
    povertyStandard,
    baseSalary,
    nsnnRate,
    dpRate,
    applyCpi,
    cpiMap,
    retirementHorizonYears = 25
  } = params;

  // 1. Mức đóng gốc & hỗ trợ
  const grossMonthly = Math.round(income * 0.22);
  const supportMonthly = Math.round((povertyStandard * 0.22) * ((nsnnRate + dpRate) / 100));
  const personalMonthlyWithSupport = Math.max(0, grossMonthly - supportMonthly);

  // 2. Tổng vốn cá nhân thực nộp áp dụng trần hỗ trợ tối đa 10 năm (120 tháng) theo Luật BHXH
  const contributionInfo = calculateTotalContribution(roadmapYears, grossMonthly, supportMonthly);
  const totalContributed = contributionInfo.totalContributed;

  // 3. Mức lương hưu tháng nhận được khi nghỉ hưu
  const pensionRate = calculatePensionRate2024(roadmapYears, gender);
  const cpiFactor = applyCpi ? getCpiMultiplier(roadmapYears, cpiMap) : 1.0;
  const adjustedIncome = Math.round(income * cpiFactor);
  const monthlyPension = Math.round(adjustedIncome * pensionRate);

  // 4. Giá trị thẻ BHYT miễn phí hàng năm (Luật BHXH quy định người hưởng lương hưu được cấp thẻ BHYT miễn phí do quỹ BHXH chi trả, quyền lợi 95% chi phí KCB)
  // Mức đóng BHYT chuẩn = 4.5% lương cơ sở
  const annualBHYTValue = Math.round(baseSalary * 0.045 * 12);

  // 5. Tổng thu nhập hưu trí + quyền lợi BHYT mỗi năm
  const annualPension = monthlyPension * 12;
  const annualBenefitTotal = annualPension + annualBHYTValue;

  // 6. Tính thời gian hòa vốn chính xác
  let breakEvenYears = 0;
  if (annualBenefitTotal > 0) {
    breakEvenYears = Number((totalContributed / annualBenefitTotal).toFixed(1));
  }
  const breakEvenMonthsTotal = Math.ceil(breakEvenYears * 12);

  // 7. Dòng tiền từng năm nghỉ hưu từ năm 1 đến retirementHorizonYears
  const timeline: BreakEvenYearData[] = [];

  for (let k = 1; k <= retirementHorizonYears; k++) {
    const cumulativePensionOnly = annualPension * k;
    const cumulativeBenefitWithBHYT = annualBenefitTotal * k;
    const netSurplus = cumulativeBenefitWithBHYT - totalContributed;
    const isBreakeven = cumulativeBenefitWithBHYT >= totalContributed;

    timeline.push({
      retirementYear: k,
      totalContributed,
      annualPension,
      annualBHYT: annualBHYTValue,
      cumulativePensionOnly,
      cumulativeBenefitWithBHYT,
      netSurplus,
      isBreakeven
    });
  }

  return {
    breakEvenYears,
    breakEvenMonthsTotal,
    totalContributed,
    grossMonthly,
    supportMonthly,
    personalMonthlyWithSupport,
    supportedYears: Math.min(roadmapYears, 10),
    unsupportedYears: Math.max(0, roadmapYears - 10),
    supportedContributionTotal: contributionInfo.supportedTotal,
    unsupportedContributionTotal: contributionInfo.unsupportedTotal,
    monthlyPension,
    annualBHYTValue,
    annualBenefitTotal,
    timeline
  };
};

export interface VoluntaryBHXHRoadmapParams {
  income: number;
  years: number;
  povertyStandard: number;
  nsnnRate: number; // 50 | 40 | 30 | 20 | 10 (%)
  dpRate?: number; // Địa phương hỗ trợ thêm (%)
}

export interface VoluntaryBHXHRoadmapResult {
  income: number;
  years: number;
  povertyStandard: number;
  nsnnRate: number;
  dpRate: number;
  totalSupportRate: number;
  grossMonthly: number;
  monthlySupport: number;
  first10YearsMonthly: number;
  after10YearsMonthly: number;
  supportedYears: number;
  unsupportedYears: number;
  supportedMonths: number;
  unsupportedMonths: number;
  totalSupportedContribution: number;
  totalUnsupportedContribution: number;
  totalContributed: number;
  totalSupportAmount: number;
  totalGrossAmount: number;
  note: string;
}

/**
 * Hàm tính toán chuyên dụng calculateVoluntaryBHXHRoadmap:
 * Xử lý chính xác từng phân kỳ tiền túi thực nộp BHXH tự nguyện theo Luật BHXH 2024 & NĐ 159/2025:
 * - 10 năm đầu (tối đa 120 tháng): (Thu nhập × 22%) - (Chuẩn nghèo × 22% × Tỷ lệ hỗ trợ)
 * - Từ năm thứ 11 trở đi (từ tháng 121 trở đi): Thu nhập × 22% (đóng đủ 100% gốc)
 * - Tổng tiền túi: N <= 10: N * 12 * first10YearsMonthly
 *                 N > 10: (120 * first10YearsMonthly) + ((N - 10) * 12 * grossMonthly)
 */
export const calculateVoluntaryBHXHRoadmap = (
  params: VoluntaryBHXHRoadmapParams
): VoluntaryBHXHRoadmapResult => {
  const {
    income,
    years,
    povertyStandard,
    nsnnRate,
    dpRate = 0
  } = params;

  const grossMonthly = Math.round(income * 0.22);
  const totalSupportRate = nsnnRate + dpRate;
  const monthlySupport = Math.round((povertyStandard * 0.22) * (totalSupportRate / 100));
  const first10YearsMonthly = Math.max(0, grossMonthly - monthlySupport);
  const after10YearsMonthly = grossMonthly;

  const totalMonths = Math.round(years * 12);
  const supportedMonths = Math.min(totalMonths, 120);
  const unsupportedMonths = Math.max(0, totalMonths - 120);

  const supportedYears = Math.min(years, 10);
  const unsupportedYears = Math.max(0, years - 10);

  const totalSupportedContribution = supportedMonths * first10YearsMonthly;
  const totalUnsupportedContribution = unsupportedMonths * after10YearsMonthly;
  const totalContributed = totalSupportedContribution + totalUnsupportedContribution;
  const totalSupportAmount = supportedMonths * monthlySupport;
  const totalGrossAmount = totalMonths * grossMonthly;

  const note = years <= 10
    ? `Lộ trình ${years} năm (${totalMonths} tháng) toàn bộ được NSNN hỗ trợ ${totalSupportRate}%: nộp ${first10YearsMonthly.toLocaleString('vi-VN')} đ/tháng.`
    : `Lộ trình ${years} năm (${totalMonths} tháng): 10 năm đầu (120 tháng) nộp ${first10YearsMonthly.toLocaleString('vi-VN')} đ/tháng (được hỗ trợ ${totalSupportRate}%); ${unsupportedYears} năm sau (${unsupportedMonths} tháng) nộp 100% gốc ${after10YearsMonthly.toLocaleString('vi-VN')} đ/tháng theo Luật BHXH 2024. Tổng thực nộp: ${totalContributed.toLocaleString('vi-VN')} đ.`;

  return {
    income,
    years,
    povertyStandard,
    nsnnRate,
    dpRate,
    totalSupportRate,
    grossMonthly,
    monthlySupport,
    first10YearsMonthly,
    after10YearsMonthly,
    supportedYears,
    unsupportedYears,
    supportedMonths,
    unsupportedMonths,
    totalSupportedContribution,
    totalUnsupportedContribution,
    totalContributed,
    totalSupportAmount,
    totalGrossAmount,
    note
  };
};

