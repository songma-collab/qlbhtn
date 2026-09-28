import { z } from 'zod';

/**
 * ======================================================================
 * MODULE TIỆN ÍCH THỜI GIAN TẬP TRUNG (UNIFIED DATE & MONTH UTILITIES)
 * ======================================================================
 * Chuẩn hóa ngày tháng toàn ứng dụng theo Mô hình 3 Tầng (Three-Tier Standard):
 * 1. Tầng UI / Người dùng (Presentation):
 *    - Ngày cụ thể (dob, effectiveDate, nextPayment, submittedDate, decisionDate): DD/MM/YYYY
 *    - Kỳ đóng bảo hiểm (fromMonth, toMonth): MM/YYYY
 *    - Input Masking tự động chèn '/', validation chặn ngày không hợp lệ.
 * 2. Tầng Trao đổi Dữ liệu (Frontend State / Payload):
 *    - Ngày cụ thể: ISO Date YYYY-MM-DD
 *    - Kỳ đóng: YYYY-MM hoặc YYYY-MM-01
 *    - Thời điểm giao dịch: ISO 8601 UTC string
 * 3. Tầng Cơ sở dữ liệu (PostgreSQL / Supabase):
 *    - records: kiểu DATE cho dob, effective_date, target_date, next_payment, submitted_date, decision_date
 *    - Thêm from_month_date DATE, to_month_date DATE (luôn là ngày 01 của tháng)
 *    - Tự động đồng bộ 2 chiều với các trường TEXT (fromMonth, from_month, toMonth, to_month)
 * ======================================================================
 */

// ==========================================
// 1. KIỂM TRA LỊCH & NĂM NHUẬN (LEAP YEAR & DAYS IN MONTH)
// ==========================================

/**
 * Kiểm tra một năm có phải năm nhuận hay không
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

/**
 * Lấy số ngày tối đa trong một tháng của năm cụ thể (xử lý chính xác năm nhuận)
 */
export const getDaysInMonth = (month: number, year: number): number => {
  if (month < 1 || month > 12) return 0;
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
};

// ==========================================
// 2. PARSERS & STRING SPLITTING AN TOÀN MÚI GIỜ (TIMEZONE-SAFE)
// ==========================================

export interface ParsedVNDate {
  day: number;
  month: number;
  year: number;
  date: Date;
}

/**
 * Phân tích chuỗi ngày DD/MM/YYYY thành các thành phần, kiểm tra tính hợp lệ lịch
 */
export const parseVNDate = (val?: string | null): ParsedVNDate | null => {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;

  const [dStr, mStr, yStr] = s.split('/');
  const day = parseInt(dStr, 10);
  const month = parseInt(mStr, 10);
  const year = parseInt(yStr, 10);

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) return null;

  // Tạo đối tượng Date an toàn với giờ địa phương 12:00 để tránh lệch múi giờ
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return { day, month, year, date };
};

/**
 * Phân tích chuỗi tháng MM/YYYY thành { month, year }
 */
export const parseVNMonth = (
  val?: string | null
): { month: number; year: number } | null => {
  if (!val || typeof val !== 'string') return null;
  const s = val.trim();
  if (!/^\d{2}\/\d{4}$/.test(s)) return null;

  const [mStr, yStr] = s.split('/');
  const month = parseInt(mStr, 10);
  const year = parseInt(yStr, 10);

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  return { month, year };
};

/**
 * Phân tích chuỗi tháng/năm bất kỳ (dạng MM/YYYY, YYYY-MM, Date string) thành { month, year }
 */
export const parseMonthAndYear = (
  monthStr?: string | null,
  fallbackDateStr?: string | null
): { month: number; year: number } => {
  const currentYear = new Date().getFullYear();
  if (monthStr && typeof monthStr === 'string') {
    let s = monthStr.trim();
    s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');

    // MM/YYYY (chuẩn UI form Đăng ký)
    if (/^\d{1,2}\/\d{4}$/.test(s)) {
      const parts = s.split('/');
      const m = parseInt(parts[0], 10);
      const y = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return { month: m, year: y };
      }
    }
    // YYYY-MM (chuẩn DB ISO)
    if (/^\d{4}-\d{1,2}$/.test(s)) {
      const parts = s.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return { month: m, year: y };
      }
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
      const parts = s.split('T')[0].split(' ')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return { month: m, year: y };
      }
    }
  }

  // Fallback sang fallbackDateStr nếu có
  if (fallbackDateStr) {
    let f = String(fallbackDateStr).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(f)) {
      const parts = f.split('T')[0].split(' ')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (m >= 1 && m <= 12) return { month: m, year: y };
    }
    const d = new Date(fallbackDateStr);
    if (!isNaN(d.getTime())) {
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    }
  }

  return { month: 1, year: currentYear };
};

// ==========================================
// 3. PURE HELPER FUNCTIONS: FORMAT & PARSE CHUẨN 3 TẦNG
// ==========================================

/**
 * formatDateVN(val): Chuyển mọi dạng đầu vào hợp lệ thành DD/MM/YYYY.
 * TUYỆT ĐỐI AN TOÀN MÚI GIỜ: Sử dụng chuỗi split thay vì new Date("YYYY-MM-DD") để tránh bị trừ 1 ngày (Timezone bug).
 * Hỗ trợ: YYYY-MM-DD, ISO timestamp (2026-09-24T00:00:00Z), DD/MM/YYYY, D/M/YYYY, Date object.
 */
export const formatDateVN = (val?: string | Date | null): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}/${m}/${y}`;
  }

  let s = String(val).trim();
  if (!s) return '';

  // Khắc phục lỗi gõ nhầm năm 2026
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');

  // Đã là DD/MM/YYYY chuẩn
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s;
  }

  // Dạng D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${d}/${m}/${y}`;
  }

  // Dạng YYYY-MM-DD hoặc YYYY-MM-DDTHH:mm:ss.sssZ hoặc YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const cleanDate = s.split('T')[0].split(' ')[0];
    const parts = cleanDate.split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${d}/${m}/${y}`;
  }

  // Dạng YYYY-MM
  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const parts = s.split('-');
    return `01/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }

  // Thử parse qua Date an toàn
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  }

  return '';
};

/**
 * formatMonthVN(val): Chuyển YYYY-MM, YYYY-MM-DD hoặc MM/YYYY thành MM/YYYY.
 * Hỗ trợ: YYYY-MM, YYYY-MM-DD, MM/YYYY, M/YYYY, Date object.
 */
export const formatMonthVN = (val?: string | Date | null): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${m}/${y}`;
  }

  let s = String(val).trim();
  if (!s) return '';
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');

  // Đã là MM/YYYY
  if (/^\d{2}\/\d{4}$/.test(s)) {
    return s;
  }

  // Dạng M/YYYY
  if (/^\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    return `${parts[0].padStart(2, '0')}/${parts[1]}`;
  }

  // Dạng YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const parts = s.split('T')[0].split(' ')[0].split('-');
    return `${parts[1].padStart(2, '0')}/${parts[0]}`;
  }

  // Dạng YYYY-MM
  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const parts = s.split('-');
    return `${parts[1].padStart(2, '0')}/${parts[0]}`;
  }

  return s;
};

/**
 * parseToIsoDate(val): Chuyển DD/MM/YYYY thành YYYY-MM-DD chuẩn DB.
 * Hỗ trợ: DD/MM/YYYY, D/M/YYYY, YYYY-MM-DD, Date object.
 */
export const parseToIsoDate = (val?: string | Date | null): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  let s = String(val).trim();
  if (!s) return '';
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');

  // Đã là YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // YYYY-MM-DDTHH...
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const clean = s.split('T')[0].split(' ')[0];
    const parts = clean.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }

  // DD/MM/YYYY hoặc D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) {
    const parts = s.split('-');
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }

  return s;
};

/**
 * parseToIsoMonthDate(val): Chuyển MM/YYYY, YYYY-MM thành YYYY-MM-01.
 * Quy chuẩn ngày mùng 1 đầu tháng để lưu trữ an toàn vào cột kiểu DATE: from_month_date, to_month_date.
 */
export const parseToIsoMonthDate = (val?: string | Date | null): string => {
  if (!val) return '';
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  let s = String(val).trim();
  if (!s) return '';
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');

  // MM/YYYY hoặc M/YYYY
  if (/^\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    const numM = Number(parts[0]);
    if (numM < 1 || numM > 12) return '';
    const m = parts[0].padStart(2, '0');
    const y = parts[1];
    return `${y}-${m}-01`;
  }

  // YYYY-MM
  if (/^\d{4}-\d{1,2}$/.test(s)) {
    const parts = s.split('-');
    const numM = Number(parts[1]);
    if (numM < 1 || numM > 12) return '';
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    return `${y}-${m}-01`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) {
    const parts = s.split('T')[0].split(' ')[0].split('-');
    const numM = Number(parts[1]);
    if (numM < 1 || numM > 12) return '';
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    return `${y}-${m}-01`;
  }

  // DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    const numM = Number(parts[1]);
    if (numM < 1 || numM > 12) return '';
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-01`;
  }

  return '';
};

/**
 * addMonthsToPeriod(fromMonthVN, durationMonths):
 * Tự động cộng tháng xử lý chính xác rollover chuyển năm.
 * Ví dụ: từ tháng 11/2026 + 3 tháng = tháng 02/2027.
 * @returns chuỗi dạng MM/YYYY
 */
export const addMonthsToPeriod = (
  fromMonthVN: string,
  durationMonths: number
): string => {
  if (!fromMonthVN || typeof fromMonthVN !== 'string') return '';
  const { month, year } = parseMonthAndYear(fromMonthVN);
  
  // Tính tổng số tháng tuyệt đối từ mốc 0
  const totalMonths = year * 12 + (month - 1) + durationMonths;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;

  return `${String(targetMonth).padStart(2, '0')}/${targetYear}`;
};

/**
 * calculateToMonthVN(fromMonthVN, durationMonths):
 * Tính tháng kết thúc của kỳ đóng bảo hiểm (Period inclusive: tính cả tháng bắt đầu).
 * Ví dụ: Từ tháng 11/2026, đóng 3 tháng => Đến tháng 01/2027 (gồm tháng 11, 12, 1).
 * @returns chuỗi dạng MM/YYYY
 */
export const calculateToMonthVN = (
  fromMonthStr: string,
  durationMonths: number = 1
): string => {
  if (!fromMonthStr || durationMonths <= 0) return fromMonthStr || '';
  return addMonthsToPeriod(fromMonthStr, durationMonths - 1);
};

/**
 * calculateMonthsBetween(fromMonthStr, toMonthStr):
 * Tính số tháng chính xác giữa từ tháng và đến tháng (bao gồm cả tháng bắt đầu và kết thúc)
 * Ví dụ: "05/2016" đến "07/2017" => 15 tháng
 */
export const calculateMonthsBetween = (
  fromMonthStr?: string | null,
  toMonthStr?: string | null
): number => {
  if (!fromMonthStr || !toMonthStr) return 0;
  const start = parseMonthAndYear(fromMonthStr);
  const end = parseMonthAndYear(toMonthStr);

  const startTotal = start.year * 12 + start.month;
  const endTotal = end.year * 12 + end.month;
  if (endTotal < startTotal) return 0;

  return endTotal - startTotal + 1;
};

/**
 * calculateNextRenewalMonth:
 * Tính tháng bắt đầu gia hạn kế tiếp, đảm bảo an toàn 100% không bị NaN/NaN.
 * Kỳ gia hạn mới bắt đầu từ tháng liền kề sau toMonth cũ.
 */
export const calculateNextRenewalMonth = (
  lastToMonthStr?: string | null,
  fallbackNextPayment?: string | null
): string => {
  if (lastToMonthStr && typeof lastToMonthStr === 'string' && lastToMonthStr.trim()) {
    return addMonthsToPeriod(lastToMonthStr, 1);
  }
  if (fallbackNextPayment) {
    const { month, year } = parseMonthAndYear(null, fallbackNextPayment);
    return `${String(month).padStart(2, '0')}/${year}`;
  }
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
};

// ==========================================
// 4. INPUT MASK HELPERS (MẶT NẠ NHẬP LIỆU FORM)
// ==========================================

/**
 * formatDateInputMask: Tự động format DD/MM/YYYY khi người dùng gõ
 */
export const formatDateInputMask = (val: string): string => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '').slice(0, 8);
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}/${clean.slice(2, 4)}/${clean.slice(4)}`;
  }
  if (clean.length > 2) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
};

/**
 * formatMonthInputMask: Tự động format MM/YYYY khi người dùng gõ
 */
export const formatMonthInputMask = (val: string): string => {
  if (!val) return '';
  const clean = val.replace(/\D/g, '').slice(0, 6);
  if (clean.length > 2) {
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }
  return clean;
};

// ==========================================
// 5. PERIOD NORMALIZATION (ĐỒNG BỘ 2 CHIỀU ĐA NĂNG)
// ==========================================

export interface StandardPeriodFields {
  fromMonth?: string;
  toMonth?: string;
  from_month_date?: string;
  to_month_date?: string;
  months?: number;
  sm?: number;
  sy?: number;
  em?: number;
  ey?: number;
  [key: string]: any;
}

/**
 * normalizePeriod: Chuẩn hóa 1 giai đoạn tham gia (Period), đảm bảo tương thích 2 chiều hoàn hảo:
 * - Hỗ trợ cả `fromMonth` ("MM/YYYY") và `toMonth` ("MM/YYYY")
 * - Tự động đồng bộ sang `from_month_date` ("YYYY-MM-01") và `to_month_date` ("YYYY-MM-01")
 * - Tự động đồng bộ sang `sm`, `sy`, `em`, `ey` (số nguyên) cho thuật toán tính toán BHXH 1 lần
 * - Tự động tính số tháng `months`
 */
export const normalizePeriod = <T extends StandardPeriodFields>(p: T): T & {
  fromMonth: string;
  toMonth: string;
  from_month_date: string;
  to_month_date: string;
  months: number;
  sm: number;
  sy: number;
  em: number;
  ey: number;
} => {
  const currentYear = new Date().getFullYear();

  let sm = Number(p.sm);
  let sy = Number(p.sy);
  let em = Number(p.em);
  let ey = Number(p.ey);

  // 1. Phân tích từ fromMonth / from_month_date nếu có
  if (p.fromMonth && typeof p.fromMonth === 'string' && p.fromMonth.trim()) {
    const parsedStart = parseMonthAndYear(p.fromMonth);
    sm = parsedStart.month;
    sy = parsedStart.year;
  } else if (p.from_month_date && typeof p.from_month_date === 'string') {
    const parsedStart = parseMonthAndYear(p.from_month_date);
    sm = parsedStart.month;
    sy = parsedStart.year;
  }

  // 2. Phân tích từ toMonth / to_month_date nếu có
  if (p.toMonth && typeof p.toMonth === 'string' && p.toMonth.trim()) {
    const parsedEnd = parseMonthAndYear(p.toMonth);
    em = parsedEnd.month;
    ey = parsedEnd.year;
  } else if (p.to_month_date && typeof p.to_month_date === 'string') {
    const parsedEnd = parseMonthAndYear(p.to_month_date);
    em = parsedEnd.month;
    ey = parsedEnd.year;
  }

  // Fallbacks nếu thiếu
  if (!sm || sm < 1 || sm > 12) sm = 1;
  if (!sy || sy < 1900) sy = currentYear;
  if (!em || em < 1 || em > 12) em = 12;
  if (!ey || ey < 1900) ey = sy;

  // Tính số tháng
  let count = (ey - sy) * 12 + (em - sm) + 1;
  if (count <= 0) {
    count = Number(p.months) > 0 ? Number(p.months) : 1;
    const startTotal = sy * 12 + sm - 1;
    const endTotal = startTotal + (count - 1);
    ey = Math.floor(endTotal / 12);
    em = (endTotal % 12) + 1;
  }

  const fromMonthFormatted = `${String(sm).padStart(2, '0')}/${sy}`;
  const toMonthFormatted = `${String(em).padStart(2, '0')}/${ey}`;
  const fromMonthDate = `${sy}-${String(sm).padStart(2, '0')}-01`;
  const toMonthDate = `${ey}-${String(em).padStart(2, '0')}-01`;

  return {
    ...p,
    sm,
    sy,
    em,
    ey,
    fromMonth: fromMonthFormatted,
    toMonth: toMonthFormatted,
    from_month_date: fromMonthDate,
    to_month_date: toMonthDate,
    months: count
  };
};

// ==========================================
// 6. BÍ DANH TƯƠNG THÍCH NGƯỢC (BACKWARD COMPATIBILITY ALIASES)
// ==========================================
/**
 * parseMonthISO: Phân tích chuỗi tháng bất kỳ (MM/YYYY, YYYY-MM, YYYY/MM, DD/MM/YYYY, YYYY-MM-DD) sang YYYY-MM
 */
export const parseMonthISO = (vnMonthStr?: string | Date | null): string => {
  if (!vnMonthStr) return '';
  let s = String(vnMonthStr).trim();
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[-/]/);
  if (parts.length === 2) {
    let m = '';
    let y = '';
    if (parts[0].length === 4) {
      y = parts[0];
      m = parts[1].padStart(2, '0');
    } else {
      m = parts[0].padStart(2, '0');
      y = parts[1];
      if (y.length === 2) y = "20" + y;
    }
    return `${y}-${m}`;
  }
  if (parts.length === 3) {
    let m = '';
    let y = '';
    if (parts[0].length === 4) {
      y = parts[0];
      m = parts[1].padStart(2, '0');
    } else {
      m = parts[1].padStart(2, '0');
      y = parts[2];
      if (y.length === 2) y = "20" + y;
    }
    return `${y}-${m}`;
  }
  return '';
};

/**
 * formatMonthInput: Format chuỗi nhập tháng, hỗ trợ sửa năm 0264/264 và tự động chuyển YYYY-MM sang MM/YYYY
 */
export const formatMonthInput = (val: string): string => {
  if (!val) return '';
  let s = String(val).trim();
  s = s.replace(/\b0264\b/g, '2026').replace(/\b264\b/g, '2026');
  if (/^\d{4}-\d{2}$/.test(s)) {
    return monthISOToVN(s);
  }
  let clean = s.replace(/\D/g, '');
  if (clean.length > 2) {
    let m = clean.slice(0, 2);
    let y = clean.slice(2, 6);
    if (y === '0264' || y === '264') y = '2026';
    clean = m + '/' + y;
  }
  return clean;
};

export const toUIDate = formatDateVN;
export const toDbDate = parseToIsoDate;
export const toUIMonth = formatMonthVN;
export const toDbMonth = parseMonthISO;
export const toVnMonth = formatMonthVN;
export const toIsoMonth = parseMonthISO;
export const formatDateInput = formatDateInputMask;
export const formatDateToVN = formatDateVN;
export const formatDateToISO = parseToIsoDate;
export const formatMonthToVN = formatMonthVN;
export const formatMonthToISO = parseMonthISO;
export const dateISOToVN = formatDateVN;
export const monthISOToVN = formatMonthVN;
export const parseDateISO = parseToIsoDate;

/**
 * getLocalYYYYMMDD: Lấy ngày hiện tại hoặc từ Date theo chuẩn YYYY-MM-DD an toàn
 */
export const getLocalYYYYMMDD = (d?: Date): string => {
  const dateObj = d || new Date();
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
};

/**
 * formatDateTimeVN: Chuyển đổi ngày giờ sang chuẩn hiển thị VN
 */
export const formatDateTimeVN = (
  val?: string | Date | null,
  includeSeconds: boolean = false
): string => {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (includeSeconds) {
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

// ==========================================
// 7. VALIDATORS & ZOD SCHEMAS
// ==========================================

export const isValidVNDate = (val?: string | null): boolean => {
  return parseVNDate(val) !== null;
};

export const isValidISODate = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [yStr, mStr, dStr] = s.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return false;
  return d >= 1 && d <= getDaysInMonth(m, y);
};

export const isValidVNMonth = (val?: string | null): boolean => {
  return parseVNMonth(val) !== null;
};

export const isValidISOMonth = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const s = val.trim();
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const [yStr, mStr] = s.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12;
};

export const vnDateSchema = z
  .string()
  .min(1, 'Vui lòng nhập ngày')
  .trim()
  .refine(val => /^\d{2}\/\d{2}\/\d{4}$/.test(val), {
    message: 'Ngày phải đúng định dạng DD/MM/YYYY (ví dụ: 15/08/1990)'
  })
  .refine(val => parseVNDate(val) !== null, {
    message: 'Ngày tháng không hợp lệ theo lịch (kiểm tra số ngày trong tháng hoặc năm nhuận)'
  });

export const vnDobSchema = vnDateSchema
  .refine(val => {
    const parsed = parseVNDate(val);
    if (!parsed) return false;
    const now = new Date();
    return parsed.date.getTime() <= now.getTime();
  }, {
    message: 'Ngày sinh không được ở tương lai'
  })
  .refine(val => {
    const parsed = parseVNDate(val);
    if (!parsed) return false;
    return parsed.year >= 1900;
  }, {
    message: 'Năm sinh không hợp lệ (phải từ năm 1900 trở lại đây)'
  });

export const optionalVnDobSchema = z
  .string()
  .optional()
  .nullable()
  .transform(val => (val ? String(val).trim() : ''))
  .refine(val => {
    if (!val || val === '') return true;
    return vnDobSchema.safeParse(val).success;
  }, {
    message: 'Ngày sinh phải đúng định dạng DD/MM/YYYY, từ năm 1900 và không ở tương lai'
  });

export const optionalVnDateSchema = z
  .string()
  .optional()
  .nullable()
  .transform(val => (val ? String(val).trim() : ''))
  .refine(val => {
    if (!val || val === '') return true;
    return vnDateSchema.safeParse(val).success;
  }, {
    message: 'Ngày phải đúng định dạng DD/MM/YYYY và hợp lệ theo lịch'
  });

export const vnMonthSchema = z
  .string()
  .min(1, 'Vui lòng nhập tháng')
  .trim()
  .refine(val => /^\d{2}\/\d{4}$/.test(val), {
    message: 'Tháng phải đúng định dạng MM/YYYY (ví dụ: 01/2026)'
  })
  .refine(val => parseVNMonth(val) !== null, {
    message: 'Tháng không hợp lệ (tháng từ 01 đến 12, năm từ 1900 đến 2100)'
  });

export const optionalVnMonthSchema = z
  .string()
  .optional()
  .nullable()
  .transform(val => (val ? String(val).trim() : ''))
  .refine(val => {
    if (!val || val === '') return true;
    return vnMonthSchema.safeParse(val).success;
  }, {
    message: 'Tháng phải đúng định dạng MM/YYYY (ví dụ: 01/2026)'
  });

export const isoDateSchema = z
  .string()
  .trim()
  .refine(isValidISODate, {
    message: 'Ngày ISO phải đúng định dạng YYYY-MM-DD'
  });

export const isoMonthSchema = z
  .string()
  .trim()
  .refine(isValidISOMonth, {
    message: 'Tháng ISO phải đúng định dạng YYYY-MM'
  });

export const flexibleVnDateSchema = z
  .string()
  .trim()
  .refine(val => isValidVNDate(val) || isValidISODate(val), {
    message: 'Ngày phải theo định dạng DD/MM/YYYY hoặc YYYY-MM-DD hợp lệ'
  })
  .transform(val => formatDateVN(val));

export const flexibleVnMonthSchema = z
  .string()
  .trim()
  .refine(val => isValidVNMonth(val) || isValidISOMonth(val), {
    message: 'Tháng phải theo định dạng MM/YYYY hoặc YYYY-MM hợp lệ'
  })
  .transform(val => formatMonthVN(val));

export const bhxhFormDateSchema = z.object({
  dob: optionalVnDobSchema,
  fromMonth: vnMonthSchema,
  toMonth: optionalVnMonthSchema
}).refine(data => {
  if (data.fromMonth && data.toMonth && data.toMonth !== '') {
    const start = parseVNMonth(data.fromMonth);
    const end = parseVNMonth(data.toMonth);
    if (start && end) {
      return (end.year * 12 + end.month) >= (start.year * 12 + start.month);
    }
  }
  return true;
}, {
  message: 'Đến tháng không được nhỏ hơn Từ tháng',
  path: ['toMonth']
});

export const bhytMemberDateSchema = z.object({
  dob: optionalVnDobSchema
});

export const bhytFormDateSchema = z.object({
  members: z.array(bhytMemberDateSchema).min(1, 'Cần ít nhất một thành viên tham gia BHYT'),
  fromMonth: optionalVnMonthSchema,
  toMonth: optionalVnMonthSchema
});

export const renewalFormDateSchema = z.object({
  fromMonth: vnMonthSchema,
  toMonth: optionalVnMonthSchema,
  nextPayment: optionalVnDateSchema
}).refine(data => {
  if (data.fromMonth && data.toMonth && data.toMonth !== '') {
    const start = parseVNMonth(data.fromMonth);
    const end = parseVNMonth(data.toMonth);
    if (start && end) {
      return (end.year * 12 + end.month) >= (start.year * 12 + start.month);
    }
  }
  return true;
}, {
  message: 'Đến tháng gia hạn không được trước Từ tháng bắt đầu',
  path: ['toMonth']
});

export const participationPeriodDateSchema = z.object({
  fromMonth: vnMonthSchema,
  toMonth: vnMonthSchema
}).refine(data => {
  const start = parseVNMonth(data.fromMonth);
  const end = parseVNMonth(data.toMonth);
  if (start && end) {
    return (end.year * 12 + end.month) >= (start.year * 12 + start.month);
  }
  return false;
}, {
  message: 'Thời gian kết thúc không được nhỏ hơn thời gian bắt đầu giai đoạn',
  path: ['toMonth']
});

export const recordDatesValidationSchema = z.object({
  dob: optionalVnDobSchema,
  fromMonth: optionalVnMonthSchema,
  toMonth: optionalVnMonthSchema,
  nextPayment: optionalVnDateSchema,
  effectiveDate: optionalVnDateSchema,
  targetDate: optionalVnDateSchema,
  submittedDate: optionalVnDateSchema
});

export const validateDOBInput = (val: string): string => {
  if (!val || val.trim() === '') return '';
  const clean = val.trim();
  if (clean.length < 10) {
    return 'Ngày sinh phải đủ 10 ký tự (DD/MM/YYYY)';
  }
  const res = vnDobSchema.safeParse(clean);
  if (!res.success) {
    return res.error.issues[0]?.message || 'Ngày sinh không hợp lệ';
  }
  return '';
};

export const validateMonthInput = (val: string): string => {
  if (!val || val.trim() === '') return 'Vui lòng nhập tháng tham gia (MM/YYYY)';
  const clean = val.trim();
  if (clean.length < 7) {
    return 'Tháng phải đủ 7 ký tự (MM/YYYY)';
  }
  const res = vnMonthSchema.safeParse(clean);
  if (!res.success) {
    return res.error.issues[0]?.message || 'Tháng không hợp lệ';
  }
  return '';
};
