import { CONSTANTS } from './constants';
import type { Policy, RecordType, SettingsType } from '../context/types';
import { getLocalYYYYMMDD } from './helpers';
import { normalizePeriod, parseMonthAndYear, calculateToMonthVN } from './dateStandardHelper';
import { calculatePeriodSupportedMonths } from './customerParticipationHelper';

export const getCommissionRateForRecord = (
  r: Partial<RecordType> | null | undefined,
  policies: Policy[] | undefined,
  settings: Partial<SettingsType> | null | undefined
): number => {
  const dateStr = r?.date || r?.created_at || getLocalYYYYMMDD();
  const defaultObj = {
    commBHXHNew: settings?.commBHXHNew || 5,
    commBHXHRenew: settings?.commBHXHRenew || 3,
    commBHYTNew: settings?.commBHYTNew || 5,
    commBHYTRenew: settings?.commBHYTRenew || 3
  };

  const commObjRaw = getPolicyValueForDate(policies, 'commission', dateStr, defaultObj);
  let commObj = defaultObj;
  if (commObjRaw) {
    if (typeof commObjRaw === 'object') commObj = commObjRaw;
    else if (typeof commObjRaw === 'string') {
      try { commObj = JSON.parse(commObjRaw); } catch { commObj = defaultObj; }
    }
  }

  const actionStr = String(r?.action_type || (r as any)?.actionType || '').toLowerCase();
  const isRenew = actionStr.includes('gia hạn') || actionStr.includes('renew') || actionStr.includes('đóng tiếp') || actionStr.includes('tái tục');

  if (r?.type === 'BHXH') {
    return isRenew ? ((Number(commObj.commBHXHRenew) || 3) / 100) : ((Number(commObj.commBHXHNew) || 5) / 100);
  } else {
    return isRenew ? ((Number(commObj.commBHYTRenew) || 3) / 100) : ((Number(commObj.commBHYTNew) || 5) / 100);
  }
};

export const getPolicyValueForDate = <T = any>(
  policies: Policy[] | undefined,
  type: 'base_salary' | 'poverty_standard' | 'pension_cpi' | 'investment_rate' | 'cpi_index' | 'commission' | 'homepage_config' | 'locked_periods' | (string & {}),
  dateStr: string,
  defaultValue: T
): T => {
  if (!policies || policies.length === 0) return defaultValue;

  // 1. Chuẩn hóa dateStr sang định dạng YYYY-MM-DD
  let normalizedDate = '';
  const s = String(dateStr || '').trim();
  if (s.match(/^\d{4}-\d{1,2}-\d{1,2}/)) {
    const raw = s.split('T')[0] ?? '';
    const parts = raw.split('-');
    const p0 = parts[0] ?? '2026';
    const p1 = (parts[1] ?? '01').padStart(2, '0');
    const p2 = (parts[2] ?? '01').padStart(2, '0');
    normalizedDate = `${p0}-${p1}-${p2}`;
  } else if (s.match(/^\d{4}-\d{1,2}$/)) {
    const [y = '2026', m = '01'] = s.split('-');
    normalizedDate = `${y}-${m.padStart(2, '0')}-01`;
  } else if (s.match(/^\d{1,2}\/\d{4}$/)) {
    const [m = '01', y = '2026'] = s.split('/');
    normalizedDate = `${y}-${m.padStart(2, '0')}-01`;
  } else if (s.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
    const [d = '01', m = '01', y = '2026'] = s.split('/');
    normalizedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  } else {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      normalizedDate = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
  }

  if (!normalizedDate) {
    normalizedDate = getLocalYYYYMMDD();
  }

  // 2. Tìm tất cả chính sách loại `type` có ngày bắt đầu áp dụng (effective_date) <= ngày của hồ sơ (normalizedDate)
  // Sắp xếp: ngày hiệu lực gần ngày giao dịch nhất (effective_date DESC), ưu tiên is_active, sau đó id DESC
  const matching = policies
    .filter(p => p.parameter_type === type && p.effective_date && p.effective_date <= normalizedDate)
    .sort((a, b) => {
      const dateCmp = b.effective_date.localeCompare(a.effective_date);
      if (dateCmp !== 0) return dateCmp;
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

  if (matching.length > 0 && matching[0]) {
    return matching[0].value;
  }

  // 3. Nếu ngày của hồ sơ trước mọi ngày hiệu lực đã tạo, tìm chính sách đang kích hoạt is_active = true
  const activePolicy = policies.find(p => p.parameter_type === type && p.is_active);
  if (activePolicy) return activePolicy.value;

  // 4. Nếu không có activePolicy, lấy chính sách có ngày hiệu lực sớm nhất
  const allOfType = policies.filter(p => p.parameter_type === type).sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  if (allOfType.length > 0 && allOfType[0]) return allOfType[0].value;

  return defaultValue;
};

/**
 * Định mức hỗ trợ từ NSNN theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP đối với BHXH tự nguyện:
 * - 50% cho hộ nghèo, người ở xã đảo, đặc khu.
 * - 40% cho hộ cận nghèo.
 * - 30% cho người dân tộc thiểu số.
 * - 20% cho đối tượng khác.
 */
export const NN_SUPPORT_RATES = {
  POOR_OR_ISLAND: 50,      // Hộ nghèo, người ở xã đảo, đặc khu: 50%
  NEAR_POOR: 40,           // Hộ cận nghèo: 40%
  ETHNIC_MINORITY: 30,     // Người dân tộc thiểu số: 30%
  OTHER: 20,               // Đối tượng khác: 20%
  OTHER_10: 10             // Khác: 10%
} as const;

export type NNSupportCategoryType =
  | 'poor'
  | 'island'
  | 'special_zone'
  | 'near_poor'
  | 'ethnic_minority'
  | 'other'
  | string;

/**
 * Xác định tỷ lệ hỗ trợ từ NSNN theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP.
 * Quy định rõ: Nếu 1 người thuộc nhiều nhóm đối tượng, áp dụng mức hỗ trợ cao nhất.
 */
export const getNNSupportRate = (categories: string | string[]): number => {
  if (!categories) return NN_SUPPORT_RATES.OTHER;

  const list = Array.isArray(categories) ? categories : [categories];
  let maxRate: number = NN_SUPPORT_RATES.OTHER;

  for (const raw of list) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) continue;

    // 50% cho hộ nghèo, người ở xã đảo, đặc khu
    if (
      s.includes('hộ nghèo') ||
      s.includes('nghèo') ||
      s.includes('poor') ||
      s.includes('xã đảo') ||
      s.includes('đảo') ||
      s.includes('island') ||
      s.includes('đặc khu') ||
      s.includes('special_zone')
    ) {
      if (!s.includes('cận nghèo') && !s.includes('near_poor') && !s.includes('can_ngheo')) {
        maxRate = Math.max(maxRate, NN_SUPPORT_RATES.POOR_OR_ISLAND);
        continue;
      }
    }

    // 40% cho hộ cận nghèo
    if (s.includes('cận nghèo') || s.includes('near_poor') || s.includes('can_ngheo')) {
      maxRate = Math.max(maxRate, NN_SUPPORT_RATES.NEAR_POOR);
      continue;
    }

    // 30% cho người dân tộc thiểu số
    if (
      s.includes('dân tộc thiểu số') ||
      s.includes('thiểu số') ||
      s.includes('thieu_so') ||
      s.includes('ethnic') ||
      s.includes('dân tộc')
    ) {
      maxRate = Math.max(maxRate, NN_SUPPORT_RATES.ETHNIC_MINORITY);
      continue;
    }

    // 20% cho đối tượng khác
    if (s.includes('khác') || s.includes('other') || s.includes('kinh')) {
      maxRate = Math.max(maxRate, NN_SUPPORT_RATES.OTHER);
    }
  }

  return maxRate;
};

/**
 * Kiểm tra tính hợp lệ của mức thu nhập tháng lựa chọn đóng BHXH tự nguyện
 * theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP:
 * - Không thấp hơn chuẩn hộ nghèo khu vực nông thôn (1.500.000đ).
 * - Không cao hơn 20 lần mức tham chiếu / mức lương cơ sở (20 x 2.340.000đ = 46.800.000đ hoặc 20 x 2.530.000đ = 50.600.000đ).
 */
export const validateBHXHIncome = (
  income: number,
  povertyStandard: number = CONSTANTS.POVERTY_LINE,
  baseSalary: number = CONSTANTS.BHYT_BASE
): { valid: boolean; error?: string; minIncome: number; maxIncome: number } => {
  const minIncome = povertyStandard;
  const maxIncome = baseSalary * 20;

  if (income < minIncome) {
    return {
      valid: false,
      error: `Mức thu nhập tháng lựa chọn không được thấp hơn chuẩn nghèo (${minIncome.toLocaleString('vi-VN')} đ)`,
      minIncome,
      maxIncome
    };
  }

  if (income > maxIncome) {
    return {
      valid: false,
      error: `Mức thu nhập tháng lựa chọn không được vượt quá 20 lần mức lương cơ sở (${maxIncome.toLocaleString('vi-VN')} đ)`,
      minIncome,
      maxIncome
    };
  }

  return { valid: true, minIncome, maxIncome };
};

export const calculateBHXH = (
  income: number,
  nnSupportPct?: number,
  dpSupportPct: number = 0,
  method: string = '1',
  customMonths: number = 1,
  fromMonth?: string,
  investmentRate: number = CONSTANTS.INTEREST,
  povertyStandard: number = CONSTANTS.POVERTY_LINE,
  policies?: Policy[],
  previousMonths: number = 0
) => {
  const effectiveNnSupportPct = (nnSupportPct !== undefined && nnSupportPct !== null && !isNaN(nnSupportPct))
    ? nnSupportPct
    : NN_SUPPORT_RATES.OTHER;
  const effectiveDpSupportPct = (dpSupportPct !== undefined && dpSupportPct !== null && !isNaN(dpSupportPct))
    ? dpSupportPct
    : 0;

  let months = 1, mode = 'normal';
  if (method === 'post_custom') {
    months = customMonths;
    mode = 'penalty';
  } else {
    months = method.startsWith('pre_') ? parseInt(method.split('_')[1] || '1', 10) : parseInt(method, 10);
    mode = method.startsWith('pre_') ? 'discount' : 'normal';
  }

  let toVal = '';
  if (fromMonth && months > 0) {
    toVal = calculateToMonthVN(fromMonth, months);
  }

  let totalBasePremium = 0;
  let totalNnSupport = 0;
  let totalDpSupport = 0;
  let totalDiscount = 0;
  let totalPenalty = 0;
  let totalAmount = 0;
  let supportedMonthsCount = 0;
  let unsupportedMonthsCount = 0;

  const { month: parsedStartM, year: parsedStartY } = parseMonthAndYear(fromMonth);
  const startM = parsedStartM || 1;
  const startY = parsedStartY || new Date().getFullYear();

  for (let i = 0; i < months; i++) {
    const curMonthDate = new Date(startY, startM - 1 + i, 1);
    const dateStr = `${curMonthDate.getFullYear()}-${String(curMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    let curPoverty = povertyStandard;
    let curBaseSalary = CONSTANTS.BHYT_BASE;
    let curInvestment = investmentRate;

    if (policies && policies.length > 0) {
      curPoverty = Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, povertyStandard));
      curBaseSalary = Number(getPolicyValueForDate(policies, 'base_salary', dateStr, CONSTANTS.BHYT_BASE));
      const rawInv = Number(getPolicyValueForDate(policies, 'investment_rate', dateStr, investmentRate * 100));
      curInvestment = rawInv / 100;
    }

    // Giới hạn thu nhập chọn đóng BHXH tự nguyện: từ chuẩn nghèo đến 20 lần mức lương cơ sở
    const curMaxIncome = curBaseSalary * 20;
    const curIncome = Math.min(Math.max(income, curPoverty), curMaxIncome);

    const baseM = curIncome * CONSTANTS.BHXH_RATE;

    // QUY ĐỊNH PHÁP LÝ (Khoản 1 Điều 36 Luật BHXH 2024 & NĐ 159/2025):
    // Thời gian hỗ trợ tối đa không quá 10 năm (120 tháng).
    // Tháng nào tích lũy <= 120 tháng được hỗ trợ; vượt quá 120 tháng hỗ trợ = 0 (đóng 100% gốc).
    const currentAccumulatedMonth = previousMonths + i + 1;
    const isEligibleForSupport = currentAccumulatedMonth <= 120;

    const suppM_NN = isEligibleForSupport
      ? (curPoverty * CONSTANTS.BHXH_RATE) * (effectiveNnSupportPct / 100)
      : 0;
    const suppM_DP = isEligibleForSupport
      ? (curPoverty * CONSTANTS.BHXH_RATE) * (effectiveDpSupportPct / 100)
      : 0;
    const suppM = suppM_NN + suppM_DP;

    if (isEligibleForSupport) {
      supportedMonthsCount++;
    } else {
      unsupportedMonthsCount++;
    }

    totalBasePremium += baseM;
    totalNnSupport += suppM_NN;
    totalDpSupport += suppM_DP;

    if (mode === 'discount') {
      const pv = baseM / Math.pow(1 + curInvestment, i);
      totalDiscount += (baseM - pv);
      let monthAmt = pv - suppM;
      if (monthAmt < 0) monthAmt = 0;
      totalAmount += monthAmt;
    } else if (mode === 'penalty') {
      const fv = baseM * Math.pow(1 + curInvestment, i + 1);
      totalPenalty += (fv - baseM);
      let monthAmt = fv - suppM;
      if (monthAmt < 0) monthAmt = 0;
      totalAmount += monthAmt;
    } else {
      let monthAmt = baseM - suppM;
      if (monthAmt < 0) monthAmt = 0;
      totalAmount += monthAmt;
    }
  }

  return {
    toMonth: toVal,
    basePremium: Math.round(totalBasePremium),
    nnSupportAmount: Math.round(totalNnSupport),
    dpSupportAmount: Math.round(totalDpSupport),
    amount: Math.round(totalAmount),
    discountAmount: Math.round(totalDiscount),
    penaltyAmount: Math.round(totalPenalty),
    supportedMonthsCount,
    unsupportedMonthsCount,
    previousMonths,
    totalAccumulatedMonths: previousMonths + months
  };
};

/**
 * Tính số tháng tham gia từ danh sách các giai đoạn đóng BHXH (Periods)
 * Phân biệt chính xác giữa BHXH Bắt buộc (Doanh nghiệp, Nhà nước) và BHXH Tự nguyện
 */
export const calculateMonthsFromPeriods = (
  periods: Array<{
    type?: string | undefined;
    fromMonth?: string | undefined;
    toMonth?: string | undefined;
    from_month?: string | undefined;
    to_month?: string | undefined;
    months?: number | undefined;
    sm?: number | undefined;
    sy?: number | undefined;
    em?: number | undefined;
    ey?: number | undefined;
    [key: string]: any;
  }> | null | undefined
): {
  compulsoryMonths: number;
  voluntaryMonths: number;
  totalMonths: number;
  voluntarySupportedMonths: number;
  voluntaryUnsupportedBefore2018Months: number;
} => {
  if (!periods || !Array.isArray(periods) || periods.length === 0) {
    return {
      compulsoryMonths: 0,
      voluntaryMonths: 0,
      totalMonths: 0,
      voluntarySupportedMonths: 0,
      voluntaryUnsupportedBefore2018Months: 0
    };
  }

  let compulsoryMonths = 0;
  let voluntaryMonths = 0;
  let voluntarySupportedMonths = 0;
  let voluntaryUnsupportedBefore2018Months = 0;

  for (const rawP of periods) {
    if (!rawP) continue;
    const p = normalizePeriod(rawP);
    const count = Number(p.months) || 0;
    if (count <= 0) continue;

    if (p.type === 'tunguyen') {
      voluntaryMonths += count;
      const supp = calculatePeriodSupportedMonths(p);
      voluntarySupportedMonths += supp.supportedMonths;
      voluntaryUnsupportedBefore2018Months += supp.unsupportedBefore2018Months;
    } else {
      // batbuoc, nhanuoc, hoặc mặc định bắt buộc
      compulsoryMonths += count;
    }
  }

  return {
    compulsoryMonths,
    voluntaryMonths,
    totalMonths: compulsoryMonths + voluntaryMonths,
    voluntarySupportedMonths,
    voluntaryUnsupportedBefore2018Months
  };
};

/**
 * Tính tổng số tháng tham gia BHXH tự nguyện đã tích lũy trước đó của khách hàng
 * Dựa trên danh sách các bản ghi (records) trong hệ thống
 * Và cộng dồn thêm thời gian BHXH tự nguyện đóng ở đại lý khác trước đây (prior_voluntary_months)
 */
export const getCustomerPreviousBHXHMonths = (
  records: any[],
  identifier: { cccd?: string; bhxh?: string } | string | null | undefined,
  excludeRecordId?: number | string | null,
  currentFromMonth?: string,
  extraPriorVoluntaryMonthsOrCustomers?: number | any[] | { prior_voluntary_months?: number; priorVoluntaryMonths?: number } | null
): number => {
  let searchCccd = '';
  let searchBhxh = '';

  if (typeof identifier === 'string') {
    const cleanId = identifier.trim();
    if (cleanId.length === 12) searchCccd = cleanId;
    else if (cleanId.length === 10) searchBhxh = cleanId;
    else searchCccd = cleanId;
  } else if (identifier) {
    searchCccd = (identifier.cccd || '').trim();
    searchBhxh = (identifier.bhxh || '').trim();
  }

  // 1. Tính toán số tháng tự nguyện đóng nơi khác trước đây (nếu có truyền vào)
  let priorVoluntaryExtra = 0;
  if (typeof extraPriorVoluntaryMonthsOrCustomers === 'number') {
    priorVoluntaryExtra = Math.max(0, extraPriorVoluntaryMonthsOrCustomers);
  } else if (Array.isArray(extraPriorVoluntaryMonthsOrCustomers)) {
    // Tìm khách hàng trong danh sách customers
    const foundCust = extraPriorVoluntaryMonthsOrCustomers.find(c => {
      if (!c) return false;
      const cCccd = (c.cccd || '').trim();
      const cBhxh = (c.bhxh || c.old_bhxh || c.oldBhxh || '').trim();
      return (searchCccd && (cCccd === searchCccd || cBhxh === searchCccd)) ||
             (searchBhxh && (cBhxh === searchBhxh || cCccd === searchBhxh));
    });
    if (foundCust) {
      if (foundCust.prior_periods && Array.isArray(foundCust.prior_periods) && foundCust.prior_periods.length > 0) {
        // Chỉ tính các tháng đóng tự nguyện từ 01/2018 trở đi (Nghị định 134/2015/NĐ-CP & Luật BHXH 2024)
        const stats = calculateMonthsFromPeriods(foundCust.prior_periods);
        priorVoluntaryExtra = stats.voluntarySupportedMonths;
      } else {
        priorVoluntaryExtra = Number(foundCust.prior_voluntary_months ?? foundCust.priorVoluntaryMonths ?? 0);
      }
    }
  } else if (extraPriorVoluntaryMonthsOrCustomers && typeof extraPriorVoluntaryMonthsOrCustomers === 'object') {
    const custObj = extraPriorVoluntaryMonthsOrCustomers as any;
    if (custObj.prior_periods && Array.isArray(custObj.prior_periods) && custObj.prior_periods.length > 0) {
      const stats = calculateMonthsFromPeriods(custObj.prior_periods);
      priorVoluntaryExtra = stats.voluntarySupportedMonths;
    } else {
      priorVoluntaryExtra = Number(
        extraPriorVoluntaryMonthsOrCustomers.prior_voluntary_months ??
        extraPriorVoluntaryMonthsOrCustomers.priorVoluntaryMonths ??
        0
      );
    }
  }

  if (!records || !Array.isArray(records) || records.length === 0 || !identifier) {
    return Math.max(0, priorVoluntaryExtra);
  }

  if (!searchCccd && !searchBhxh) {
    return Math.max(0, priorVoluntaryExtra);
  }

  let currentFromMonthISO = '';
  if (currentFromMonth) {
    const { month: cmM, year: cmY } = parseMonthAndYear(currentFromMonth);
    if (cmM && cmY) currentFromMonthISO = `${cmY}-${String(cmM).padStart(2, '0')}`;
  }

  let totalMonths = 0;

  for (const r of records) {
    if (!r) continue;
    if (r.type !== 'BHXH') continue;

    // Loại trừ bản ghi đang cập nhật nếu có
    if (excludeRecordId != null && String(r.id) === String(excludeRecordId)) continue;

    // Loại trừ các bản ghi đã hủy hoặc bút toán điều chỉnh âm
    if (r.paymentStatus === 'Đã hủy' || r.status === 'Đã hủy' || r.isAdjustment) continue;

    const recCccd = (r.cccd || r.citizenId || '').trim();
    const recBhxh = (r.bhxh || r.bhxhCode || r.old_bhxh || r.oldBhxh || r.bhxhCu || '').trim();

    const matchesCccd = Boolean(searchCccd && (recCccd === searchCccd || recBhxh === searchCccd));
    const matchesBhxh = Boolean(searchBhxh && (recBhxh === searchBhxh || recCccd === searchBhxh));

    if (!matchesCccd && !matchesBhxh) continue;

    // Nếu có currentFromMonthISO: chỉ tính các kỳ diễn ra trước kỳ hiện tại
    if (currentFromMonthISO && r.fromMonth) {
      const { month: rfM, year: rfY } = parseMonthAndYear(r.fromMonth);
      if (rfM && rfY) {
        const rFrom = `${rfY}-${String(rfM).padStart(2, '0')}`;
        if (rFrom >= currentFromMonthISO) continue;
      }
    }

    let mCount = Number(r.months) || 0;
    if (mCount <= 0 && r.fromMonth && r.toMonth) {
      const { month: m1, year: y1 } = parseMonthAndYear(r.fromMonth);
      const { month: m2, year: y2 } = parseMonthAndYear(r.toMonth);
      if (y1 && m1 && y2 && m2) {
        mCount = (y2 - y1) * 12 + (m2 - m1) + 1;
      }
    }

    if (mCount > 0) {
      // Chỉ tính các tháng từ 01/2018 trở đi vào số tháng đã hưởng hỗ trợ
      if (r.fromMonth || r.date || r.effectiveDate) {
        const { month: sm, year: sy } = parseMonthAndYear(
          r.fromMonth || r.from_month,
          r.date || r.effectiveDate
        );
        if (sy > 0 && sy < 2018) {
          const supp = calculatePeriodSupportedMonths({
            type: 'tunguyen',
            sm,
            sy,
            months: mCount
          });
          mCount = supp.supportedMonths;
        }
      }
      totalMonths += mCount;
    }
  }

  return totalMonths + Math.max(0, priorVoluntaryExtra);
};

export const calculateBHYT = (duration: number, memberCount: number, baseSalary: number = CONSTANTS.BHYT_BASE) => {
  const basePremium = baseSalary * CONSTANTS.BHYT_RATE * duration;
  let total = 0;
  const rates = [1, 0.7, 0.6, 0.5]; 
  const rateLabels = ['100%', '70%', '60%', '50%'];
  const breakdown = [];
  
  for (let i = 0; i < memberCount; i++) {
    let rate = i < 4 ? (rates[i] ?? 0.4) : 0.4;
    let label = i < 4 ? (rateLabels[i] ?? '40%') : '40%';
    let amount = Math.round(basePremium * rate);
    total += amount;
    breakdown.push({
      title: `Người thứ ${i + 1}`,
      label,
      amount
    });
  }
  return { amount: Math.round(total), breakdown };
};

export interface BHYTMemberInput {
  name?: string;
  cccd?: string;
  phone?: string;
  bhxh?: string;
  dob?: string;
  durationMonths: number;
}

export interface BHYTCoterminousResult {
  amount: number;
  breakdown: Array<{
    title: string;
    label: string;
    ratePct: number;
    durationMonths: number;
    monthlyPremium: number;
    amount: number;
    name?: string | undefined;
  }>;
}

/**
 * Tính mức đóng BHYT Hộ gia đình đồng bộ thời hạn kết thúc (Coterminous Expiration).
 * Cho phép mỗi thành viên có thời hạn đóng khác nhau (ví dụ: 1 đến 12 tháng)
 * nhưng vẫn áp dụng đúng biểu tỷ lệ giảm trừ theo thứ tự thành viên (100% - 70% - 60% - 50% - 40%)
 * theo Nghị định 146/2018/NĐ-CP.
 */
export const calculateBHYTCoterminous = (
  members: (BHYTMemberInput | { durationMonths?: number; name?: string })[],
  baseSalary: number = CONSTANTS.BHYT_BASE
): BHYTCoterminousResult => {
  const rates = [1.0, 0.7, 0.6, 0.5];
  const rateLabels = ['100%', '70%', '60%', '50%'];
  const baseMonthly = baseSalary * CONSTANTS.BHYT_RATE; // Mức đóng 1 tháng của người thứ nhất (4.5% lương cơ sở)

  let total = 0;
  const breakdown: BHYTCoterminousResult['breakdown'] = [];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    if (!m) continue;
    const duration = Number(m.durationMonths) || 12;
    const rate = i < 4 ? (rates[i] ?? 0.4) : 0.4;
    const label = i < 4 ? (rateLabels[i] ?? '40%') : '40%';
    const memberMonthly = baseMonthly * rate;
    const memberAmount = Math.round(memberMonthly * duration);

    total += memberAmount;
    breakdown.push({
      title: `Người thứ ${i + 1}${m.name ? ` (${m.name})` : ''}`,
      label,
      ratePct: rate * 100,
      durationMonths: duration,
      monthlyPremium: Math.round(memberMonthly),
      amount: memberAmount,
      name: m.name
    });
  }

  return {
    amount: total,
    breakdown
  };
};

export interface PensionEffortRating {
  ratingText: string;
  ratingBg: string;
  ratioBadgeBg: string;
  ratingDesc: string;
  effortLevel: 'very_light' | 'optimal' | 'balanced' | 'moderate' | 'high';
}

/**
 * Đánh giá "Lực đóng: Tối ưu tài chính" dựa trên tương quan giữa:
 * 1. Mức phí đóng thực tế (actualPremium)
 * 2. Mức thu nhập thực tế của người tham gia (actualIncome)
 * 3. Tỷ trọng số tiền đóng so với thu nhập (salaryRatio = actualPremium / actualIncome * 100)
 * 4. Số năm đóng và mức đóng sàn an sinh xã hội (chosenBHXH <= povertyStandard)
 */
export const calculatePensionEffortRating = (
  actualPremium: number,
  actualIncome: number,
  years: number,
  salaryRatio: number,
  chosenBHXH: number,
  povertyStandard: number = 1500000
): PensionEffortRating => {
  // 1. Nếu không nhập thu nhập thực tế (hoặc actualIncome <= 0)
  if (actualIncome <= 0) {
    if (actualPremium <= 350000) {
      return {
        ratingText: 'Tiết kiệm tối đa',
        ratingBg: 'bg-sky-50 text-sky-700 border-sky-200',
        ratioBadgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
        ratingDesc: 'Mức phí sàn an sinh xã hội, dễ tham gia duy trì lâu dài',
        effortLevel: 'very_light',
      };
    }
    if (actualPremium <= 700000) {
      return {
        ratingText: 'Tối ưu chi phí',
        ratingBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        ratioBadgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        ratingDesc: 'Mức đóng phổ thông hợp lý, hiệu quả tích lũy cao',
        effortLevel: 'optimal',
      };
    }
    if (actualPremium <= 1200000) {
      return {
        ratingText: 'Cân bằng tài chính',
        ratingBg: 'bg-teal-50 text-teal-700 border-teal-200',
        ratioBadgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
        ratingDesc: 'Mức phí khá, đòi hỏi thu nhập đều đặn',
        effortLevel: 'balanced',
      };
    }
    return {
      ratingText: 'Áp lực tài chính',
      ratingBg: 'bg-amber-50 text-amber-700 border-amber-200',
      ratioBadgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      ratingDesc: 'Mức đóng lớn, cần kế hoạch tài chính vững chắc',
      effortLevel: 'moderate',
    };
  }

  // 2. Mức đóng BHXH bằng chuẩn nghèo nông thôn (mức sàn luật định)
  if (chosenBHXH <= povertyStandard) {
    return {
      ratingText: 'Tiết kiệm tối đa',
      ratingBg: 'bg-sky-50 text-sky-700 border-sky-200',
      ratioBadgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      ratingDesc: `Mức sàn luật định (${salaryRatio.toFixed(1)}% thu nhập), tích lũy an toàn & nhẹ nhàng nhất`,
      effortLevel: 'very_light',
    };
  }

  // 3. Phân tích đa tầng theo Tỷ lệ % trích lương và Ngưỡng thu nhập thực tế
  const isLowIncome = actualIncome <= 6000000;
  const isHighIncome = actualIncome >= 20000000;

  // Mốc 1: Dưới 4.5% thu nhập -> Rất nhẹ nhàng
  if (salaryRatio < 4.5) {
    if (salaryRatio < 3.0) {
      return {
        ratingText: 'Tiết kiệm tối đa',
        ratingBg: 'bg-sky-50 text-sky-700 border-sky-200',
        ratioBadgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
        ratingDesc: `Chỉ chiếm ${salaryRatio.toFixed(1)}% thu nhập, duy trì cực kỳ dễ dàng`,
        effortLevel: 'very_light',
      };
    }
    return {
      ratingText: 'Rất nhẹ nhàng',
      ratingBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      ratioBadgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      ratingDesc: `Chiếm ${salaryRatio.toFixed(1)}% thu nhập, áp lực chi tiêu gần như không đáng kể`,
      effortLevel: 'very_light',
    };
  }

  // Mốc 2: 4.5% - 8.5% thu nhập (TỶ LỆ VÀNG HƯU TRÍ: TỐI ƯU TÀI CHÍNH)
  const optimalThreshold = isHighIncome ? 9.5 : (isLowIncome ? 7.5 : 8.5);
  if (salaryRatio <= optimalThreshold) {
    return {
      ratingText: 'Tối ưu tài chính',
      ratingBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ratioBadgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      ratingDesc: `Tỷ lệ vàng (${salaryRatio.toFixed(1)}% lương), cân bằng hoàn hảo giữa chi tiêu và tích lũy`,
      effortLevel: 'optimal',
    };
  }

  // Mốc 3: 8.5% - 12.0% thu nhập (CÂN BẰNG - VỪA SỨC)
  const balancedThreshold = isHighIncome ? 13.5 : (isLowIncome ? 11.0 : 12.0);
  if (salaryRatio <= balancedThreshold) {
    return {
      ratingText: 'Cân bằng - Vừa sức',
      ratingBg: 'bg-teal-50 text-teal-700 border-teal-200',
      ratioBadgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
      ratingDesc: `Chiếm ${salaryRatio.toFixed(1)}% thu nhập, mức trích phù hợp khi quản lý chi tiêu tốt`,
      effortLevel: 'balanced',
    };
  }

  // Mốc 4: 12.0% - 16.5% thu nhập (ÁP LỰC VỪA PHẢI / ĐÓNG NHANH)
  const moderateThreshold = isHighIncome ? 18.0 : (isLowIncome ? 15.0 : 16.5);
  if (salaryRatio <= moderateThreshold) {
    return {
      ratingText: years <= 20 ? 'Áp lực vừa - Hưởng sớm' : 'Áp lực vừa phải',
      ratingBg: 'bg-amber-50 text-amber-700 border-amber-200',
      ratioBadgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      ratingDesc: `Chiếm ${salaryRatio.toFixed(1)}% lương, đổi lại rút ngắn lộ trình để hưởng hưu sớm`,
      effortLevel: 'moderate',
    };
  }

  // Mốc 5: 16.5% - 22.0% thu nhập (ÁP LỰC KHÁ CAO)
  const highThreshold = isHighIncome ? 24.0 : 21.0;
  if (salaryRatio <= highThreshold) {
    return {
      ratingText: 'Áp lực khá cao',
      ratingBg: 'bg-orange-50 text-orange-700 border-orange-200',
      ratioBadgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
      ratingDesc: `Chiếm ${salaryRatio.toFixed(1)}% lương, cần đảm bảo nguồn thu nhập đều đặn`,
      effortLevel: 'high',
    };
  }

  // Mốc 6: Trên 22% thu nhập (ÁP LỰC CAO - NÊN CÂN NHẮC)
  return {
    ratingText: 'Áp lực cao - Cần cân nhắc',
    ratingBg: 'bg-rose-50 text-rose-700 border-rose-200',
    ratioBadgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    ratingDesc: `Chiếm tới ${salaryRatio.toFixed(1)}% thu nhập, nên chọn lộ trình dài hơn để hạ mức đóng`,
    effortLevel: 'high',
  };
};

export {
  calculateVoluntaryBHXHRoadmap,
  type VoluntaryBHXHRoadmapParams,
  type VoluntaryBHXHRoadmapResult
} from './pensionAccumulation';

