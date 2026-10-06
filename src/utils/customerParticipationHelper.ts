import { PeriodItem } from './ocrHelper';
import { CustomerType, RecordType } from '../context/types';
import { parseMonthAndYear, normalizePeriod } from './dateStandardHelper';

export { parseMonthAndYear };

/**
 * Kiểm tra xem một record có thuộc về khách hàng hay không
 */
export const doesRecordMatchCustomer = (r: RecordType, customer: CustomerType): boolean => {
  if (!r || !customer) return false;

  const cCccd = (customer.cccd || '').trim().toLowerCase();
  const cBhxh = (customer.bhxh || customer.old_bhxh || (customer as any).oldBhxh || '').trim().toLowerCase();
  const cId = customer.id ? String(customer.id) : '';
  const cKey = (customer.customer_key || '').trim().toLowerCase();

  const rCccd = (r.cccd || (r as any).citizenId || '').trim().toLowerCase();
  const rBhxh = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').trim().toLowerCase();
  const rCustId = r.customer_id ? String(r.customer_id) : ((r as any).customerId ? String((r as any).customerId) : '');
  const rCustKey = (r.customer_key || (r as any).customerKey || '').trim().toLowerCase();

  if (cCccd && rCccd && cCccd === rCccd) return true;
  if (cBhxh && rBhxh && cBhxh === rBhxh) return true;
  if (cId && rCustId && cId === rCustId) return true;
  if (cKey && rCustKey && cKey === rCustKey) return true;

  // Khớp theo tên + số điện thoại nếu cả hai đều có
  const cName = (customer.name || '').trim().toLowerCase();
  const rName = (r.name || '').trim().toLowerCase();
  const cPhone = (customer.phone || '').trim().replace(/\D/g, '');
  const rPhone = (r.phone || '').trim().replace(/\D/g, '');
  if (cName && rName && cName === rName && cPhone && rPhone && cPhone === rPhone) {
    return true;
  }

  return false;
};

/**
 * Trích xuất danh sách các giai đoạn đóng BHXH tự nguyện tại đại lý này từ bảng records
 */
export const extractAgencyPeriods = (customer: CustomerType, records: RecordType[]): PeriodItem[] => {
  if (!customer || !records || !Array.isArray(records)) return [];

  const agencyPeriods: PeriodItem[] = [];

  // Lọc các bản ghi BHXH hợp lệ của khách hàng tại đại lý
  const matchingRecords = records.filter(r => {
    if (!r || r.type !== 'BHXH') return false;
    if ((r.payment_status || (r as any).paymentStatus) === 'Đã hủy' || (r as any).status === 'Đã hủy') return false;
    if (r.is_adjustment || (r as any).isAdjustment) return false;
    return doesRecordMatchCustomer(r, customer);
  });

  // Duyệt từng record và chuyển thành PeriodItem
  for (const r of matchingRecords) {
    const durationMonths = Number(r.months) || 1;
    if (durationMonths <= 0) continue;

    // 1. Phân tích tháng/năm bắt đầu
    const { month: sm, year: sy } = parseMonthAndYear(
      r.from_month || (r as any).fromMonth,
      r.date || r.effective_date || (r as any).effectiveDate
    );

    // 2. Phân tích tháng/năm kết thúc
    let em = sm;
    let ey = sy;

    const toMonthStr = r.to_month || (r as any).toMonth;
    if (toMonthStr && typeof toMonthStr === 'string' && toMonthStr.trim()) {
      const parsedTo = parseMonthAndYear(toMonthStr);
      em = parsedTo.month;
      ey = parsedTo.year;
    } else {
      // Tính tự động từ số tháng
      const startTotal = sy * 12 + sm - 1;
      const endTotal = startTotal + (durationMonths - 1);
      ey = Math.floor(endTotal / 12);
      em = (endTotal % 12) + 1;
    }

    // 3. Mức lương / thu nhập đóng
    let salaryNum = 1500000;
    const basePrem = r.base_premium !== undefined ? r.base_premium : (r as any).basePremium;
    if (r.wage && Number(r.wage) > 0) {
      salaryNum = Number(r.wage);
    } else if (r.income && Number(r.income) > 0) {
      salaryNum = Number(r.income);
    } else if (basePrem && Number(basePrem) > 0) {
      salaryNum = Math.round(Number(basePrem) / 0.22);
    } else if (r.amount && Number(r.amount) > 0) {
      salaryNum = Math.round(Number(r.amount) / 0.22);
    }

    const formattedSalary = new Intl.NumberFormat('vi-VN').format(salaryNum);

    agencyPeriods.push(normalizePeriod({
      id: r.id ? Number(r.id) : (Date.now() + Math.random()),
      type: 'tunguyen',
      sm,
      sy,
      em,
      ey,
      salary: formattedSalary,
      workplace: 'Đại lý thu BHXH Sông Mã',
      position: 'Người tham gia BHXH tự nguyện'
    }));
  }

  return agencyPeriods;
};

/**
 * Xây dựng danh sách toàn bộ quá trình tham gia (gộp cả Quá trình trước đây + Phát sinh tại đại lý)
 * Sắp xếp tăng dần theo thời gian
 */
export const buildCompleteParticipationPeriods = (
  customer: CustomerType,
  records: RecordType[]
): PeriodItem[] => {
  if (!customer) return [];

  const completeList: PeriodItem[] = [];

  // 1. Quá trình trước đây đã nhập trong prior_periods
  if (customer.prior_periods && Array.isArray(customer.prior_periods)) {
    for (const p of customer.prior_periods) {
      if (!p) continue;
      let salStr = '';
      if (p.salary !== undefined && p.salary !== null && p.salary !== '') {
        if (typeof p.salary === 'number') {
          salStr = new Intl.NumberFormat('vi-VN').format(p.salary);
        } else {
          const rawNum = Number(String(p.salary).replace(/\D/g, ''));
          salStr = rawNum > 0 ? new Intl.NumberFormat('vi-VN').format(rawNum) : String(p.salary).trim();
        }
      }

      // Nếu chưa nhập mức lương, mặc định mức sàn hợp lệ để phân hệ BHXH 1 lần tính ra kết quả ngay
      if (!salStr || salStr === '0') {
        const defaultSal = (p.type === 'batbuoc' || p.type === 'nhanuoc') ? 2340000 : 1500000;
        salStr = new Intl.NumberFormat('vi-VN').format(defaultSal);
      }

      completeList.push(normalizePeriod({
        id: p.id ? Number(p.id) : (Date.now() + Math.random()),
        type: p.type || 'batbuoc',
        from_month: p.from_month || (p as any).fromMonth,
        to_month: p.to_month || (p as any).toMonth,
        months: p.months,
        sm: Number(p.sm) || 1,
        sy: Number(p.sy) || 2020,
        em: Number(p.em) || 12,
        ey: Number(p.ey) || 2020,
        salary: salStr,
        workplace: p.workplace || '',
        position: p.position || ''
      }) as unknown as PeriodItem);
    }
  }

  // 2. Quá trình phát sinh tại đại lý này
  const agencyPeriods = extractAgencyPeriods(customer, records);
  completeList.push(...agencyPeriods);

  // 3. Sắp xếp tăng dần theo thời gian (năm bắt đầu -> tháng bắt đầu)
  completeList.sort((a, b) => {
    const aVal = (Number(a.sy) || 0) * 12 + (Number(a.sm) || 0);
    const bVal = (Number(b.sy) || 0) * 12 + (Number(b.sm) || 0);
    return aVal - bVal;
  });

  return completeList;
};

/**
 * Xuất dữ liệu quá trình tham gia sang phân hệ Tính BHXH 1 Lần và tự động tính kết quả
 */
export const transferCustomerTo1Lan = (
  customer: CustomerType,
  records: RecordType[],
  navigate: (path: string) => void,
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
): boolean => {
  if (!customer) return false;

  const completePeriods = buildCompleteParticipationPeriods(customer, records);

  if (completePeriods.length === 0) {
    if (showToast) {
      showToast('Khách hàng chưa có thời gian đóng BHXH nào (cả trước đây và tại đại lý).', 'warning');
    }
    return false;
  }

  const gender = (customer.gender || '').toLowerCase().includes('nữ') || (customer.gender || '').toLowerCase() === 'female'
    ? 'female'
    : 'male';

  const payload = {
    customerName: customer.name || '',
    customerCccd: customer.cccd || '',
    customerBhxh: customer.bhxh || customer.old_bhxh || (customer as any).oldBhxh || '',
    gender,
    periods: completePeriods,
    autoCalculate: true // Tự động tính toán kết quả ngay khi mở tab BHXH 1 lần
  };

  try {
    sessionStorage.setItem('TRANSFER_TO_BHXH1LAN', JSON.stringify(payload));
    if (showToast) {
      const custName = customer.name ? ` của khách hàng ${customer.name}` : '';
      showToast(`Đã đồng bộ ${completePeriods.length} giai đoạn đóng BHXH${custName} sang phân hệ Tính BHXH 1 lần!`, 'success');
    }
    navigate('/bhxh1lan');
    return true;
  } catch (err) {
    console.error('[transferCustomerTo1Lan] Lỗi lưu sessionStorage:', err);
    if (showToast) {
      showToast('Không thể lưu dữ liệu chuyển phân hệ BHXH 1 lần.', 'error');
    }
    return false;
  }
};

// ======================================================================
// QUY ĐỊNH PHÁP LÝ HỖ TRỢ TIỀN ĐÓNG BHXH TỰ NGUYỆN (NĐ 134/2015 & LUẬT BHXH 2024)
// ======================================================================
export const NSNN_SUPPORT_START_YEAR = 2018;
export const NSNN_SUPPORT_START_MONTH = 1; // 01/01/2018 là thời điểm bắt đầu chính sách NSNN hỗ trợ
export const NSNN_SUPPORT_MAX_MONTHS = 120; // Trần hỗ trợ tối đa 10 năm (120 tháng)

/**
 * Tính số tháng được NSNN hỗ trợ cho 1 giai đoạn tham gia BHXH cụ thể:
 * - Nếu là BHXH bắt buộc / nhà nước: 0 tháng được hỗ trợ
 * - Nếu là BHXH tự nguyện:
 *   + Chỉ tính các tháng từ tháng 01/2018 trở đi (Nghị định 134/2015/NĐ-CP & Luật BHXH 2024).
 *   + Các tháng trước 01/2018 (<= 12/2017): Người tham gia đóng 100%, chưa có chính sách hỗ trợ tiền đóng
 *     nên không tính vào trần 120 tháng được hỗ trợ của Nhà nước.
 */
export const calculatePeriodSupportedMonths = (rawP: any): {
  totalMonths: number;
  supportedMonths: number;
  unsupportedBefore2018Months: number;
} => {
  if (!rawP) return { totalMonths: 0, supportedMonths: 0, unsupportedBefore2018Months: 0 };
  const p = normalizePeriod(rawP);
  const count = Number(p.months) || 0;
  if (count <= 0) return { totalMonths: 0, supportedMonths: 0, unsupportedBefore2018Months: 0 };

  if (p.type !== 'tunguyen') {
    return { totalMonths: count, supportedMonths: 0, unsupportedBefore2018Months: 0 };
  }

  const sm = Number(p.sm) || 1;
  const sy = Number(p.sy) || 0;
  const em = Number(p.em) || 12;
  const ey = Number(p.ey) || 0;

  if (sy <= 0 || ey <= 0) {
    // Không có năm hợp lệ, an toàn coi như giai đoạn sau 2018
    return { totalMonths: count, supportedMonths: count, unsupportedBefore2018Months: 0 };
  }

  const startTotal = sy * 12 + sm;
  const endTotal = ey * 12 + em;
  const supportStartTotal = NSNN_SUPPORT_START_YEAR * 12 + NSNN_SUPPORT_START_MONTH; // 2018 * 12 + 1 = 24217

  if (endTotal < supportStartTotal) {
    // Toàn bộ giai đoạn kết thúc trước 01/2018
    return {
      totalMonths: count,
      supportedMonths: 0,
      unsupportedBefore2018Months: count
    };
  }

  if (startTotal >= supportStartTotal) {
    // Toàn bộ giai đoạn bắt đầu từ 01/2018 trở đi
    return {
      totalMonths: count,
      supportedMonths: count,
      unsupportedBefore2018Months: 0
    };
  }

  // Giai đoạn giao nhau: Bắt đầu trước 2018 và kết thúc từ 2018 trở đi
  const beforeCount = Math.max(0, supportStartTotal - startTotal);
  const afterCount = Math.max(0, endTotal - supportStartTotal + 1);

  return {
    totalMonths: count,
    supportedMonths: afterCount,
    unsupportedBefore2018Months: beforeCount
  };
};

/**
 * Tính toán tổng hợp số tháng tham gia và tiến trình hưởng hỗ trợ NSNN 120 tháng của khách hàng
 * dựa trên danh sách giai đoạn trước đây (priorPeriods) và giai đoạn tại đại lý (agencyPeriods)
 */
export const calculateCustomerParticipationSupport = (
  priorPeriods: any[] = [],
  agencyPeriods: any[] = [],
  fallbackPriorVoluntaryMonths: number = 0
) => {
  let compulsoryMonths = 0;
  let priorVoluntaryMonths = 0;
  let voluntarySupportedMonths = 0;
  let voluntaryUnsupportedBefore2018Months = 0;

  if (Array.isArray(priorPeriods) && priorPeriods.length > 0) {
    for (const rawP of priorPeriods) {
      if (!rawP) continue;
      const p = normalizePeriod(rawP);
      const count = Number(p.months) || 0;
      if (count <= 0) continue;

      if (p.type === 'tunguyen') {
        priorVoluntaryMonths += count;
        const res = calculatePeriodSupportedMonths(p);
        voluntarySupportedMonths += res.supportedMonths;
        voluntaryUnsupportedBefore2018Months += res.unsupportedBefore2018Months;
      } else {
        compulsoryMonths += count;
      }
    }
  } else {
    priorVoluntaryMonths = Math.max(0, fallbackPriorVoluntaryMonths);
    // Nếu chỉ có số tháng gộp mà chưa có chi tiết từng kỳ, mặc định là các tháng có hỗ trợ
    voluntarySupportedMonths = priorVoluntaryMonths;
  }

  let agencyVoluntaryMonths = 0;
  if (Array.isArray(agencyPeriods) && agencyPeriods.length > 0) {
    for (const rawA of agencyPeriods) {
      if (!rawA) continue;
      const a = normalizePeriod(rawA);
      const count = Number(a.months) || 0;
      if (count <= 0) continue;

      agencyVoluntaryMonths += count;
      const res = calculatePeriodSupportedMonths(a);
      voluntarySupportedMonths += res.supportedMonths;
      voluntaryUnsupportedBefore2018Months += res.unsupportedBefore2018Months;
    }
  }

  const totalVoluntary = priorVoluntaryMonths + agencyVoluntaryMonths;
  const totalAccumulated = compulsoryMonths + totalVoluntary;

  const supportedMonthsCapped = Math.min(NSNN_SUPPORT_MAX_MONTHS, voluntarySupportedMonths);
  const remainingSupportMonths = Math.max(0, NSNN_SUPPORT_MAX_MONTHS - voluntarySupportedMonths);
  const isSupportExpired = voluntarySupportedMonths >= NSNN_SUPPORT_MAX_MONTHS;

  return {
    compulsoryMonths,
    priorVoluntaryMonths,
    agencyVoluntaryMonths,
    totalVoluntary,
    totalAccumulated,
    voluntarySupportedMonths,
    voluntaryUnsupportedBefore2018Months,
    supportedMonthsCapped,
    remainingSupportMonths,
    isSupportExpired
  };
};
