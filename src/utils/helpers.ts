import type { RecordType } from '../context/types';

export const formatMoney = (num: number) => {
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
};

export const formatTitleCase = (str: string): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (a) => a.toUpperCase());
};

// Re-export toàn bộ module thời gian từ Single Source of Truth (dateUtils.ts)
export {
  formatDateVN,
  formatDateVN as formatDate,
  formatDateVN as formatDateToVN,
  formatMonthVN,
  formatMonthVN as formatMonth,
  formatMonthVN as formatMonthToVN,
  formatDateInputMask as formatDateInput,
  formatDateInputMask,
  formatMonthInput,
  dateISOToVN,
  monthISOToVN,
  parseDateISO,
  parseMonthISO,
  parseToIsoDate,
  parseToIsoDate as formatDateToISO,
  parseToIsoMonthDate,
  parseToIsoMonthDate as formatMonthToISO,
  getLocalYYYYMMDD,
  formatDateTimeVN,
  addMonthsToPeriod,
  calculateToMonthVN,
  calculateMonthsBetween,
  calculateNextRenewalMonth,
  isValidVNDate,
  isValidVNMonth,
  toUIDate,
  toDbDate,
  toUIMonth,
  toDbMonth,
  toIsoMonth,
  toVnMonth,
  normalizePeriod
} from './dateUtils';

export const getInt = (v: any) => {
  return v ? parseInt(String(v).replace(/\D/g, ""), 10) || 0 : 0;
};

export const isDateLocked = (dateStr: string | undefined | null, lockedKeys: string[]): boolean => {
  if (!dateStr || !lockedKeys || !Array.isArray(lockedKeys) || lockedKeys.length === 0) return false;
  
  let y = '';
  let m = '';
  
  const s = String(dateStr).trim();
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length === 3) {
      m = parts[1] ?? ''; y = parts[2] ?? '';
    } else if (parts.length === 2) {
      m = parts[0] ?? ''; y = parts[1] ?? '';
    }
  } else if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length >= 3) {
      y = parts[0] ?? ''; m = parts[1] ?? '';
    } else if (parts.length === 2) {
      y = parts[0] ?? ''; m = parts[1] ?? '';
    }
  }

  if (!y || !m) {
    const dObj = new Date(s);
    if (!isNaN(dObj.getTime())) {
      y = String(dObj.getFullYear());
      m = String(dObj.getMonth() + 1).padStart(2, '0');
    }
  }

  if (!y || !m) return false;

  // Clean trailing timestamp info if present
  if (y.includes('T')) y = y.split('T')[0] ?? y;
  if (y.includes(' ')) y = y.split(' ')[0] ?? y;

  const yNum = parseInt(y, 10);
  const mNum = parseInt(m, 10);
  if (isNaN(yNum) || isNaN(mNum)) return false;

  const mFormatted = String(mNum).padStart(2, '0');
  const monthKey1 = `month_${mFormatted}/${yNum}`;
  const monthKey2 = `month_${mFormatted}_${yNum}`;
  const monthKey3 = `month:${yNum}-${mFormatted}`;
  const monthKey4 = `month:${mFormatted}/${yNum}`;
  
  const qNum = Math.ceil(mNum / 3);
  const quarterKey1 = `quarter_${qNum}_${yNum}`;
  const quarterKey2 = `quarter:${yNum}-${qNum}`;
  const quarterKey3 = `quarter_${qNum}/${yNum}`;
  
  const yearKey1 = `year_${yNum}`;
  const yearKey2 = `year:${yNum}`;

  return lockedKeys.includes(monthKey1) || lockedKeys.includes(monthKey2) || lockedKeys.includes(monthKey3) || lockedKeys.includes(monthKey4) ||
         lockedKeys.includes(quarterKey1) || lockedKeys.includes(quarterKey2) || lockedKeys.includes(quarterKey3) ||
         lockedKeys.includes(yearKey1) || lockedKeys.includes(yearKey2);
};

/**
 * Chuyển đổi mã khóa kỳ tài chính (currentPeriodKey) thành nhãn hiển thị tiếng Việt chuẩn hóa
 * Ví dụ:
 * - "month_09/2026", "month_09_2026", "month:2026-09" -> "Tháng 09/2026"
 * - "quarter_3_2026", "quarter:2026-3" -> "Quý 3/2026"
 * - "year_2026", "year:2026" -> "Năm 2026"
 */
export const formatPeriodKeyToLabel = (key: string | undefined | null): string => {
  if (!key) return '';
  const s = String(key).trim();
  
  // Xử lý kỳ tháng: month_09/2026, month_09_2026, month:2026-09, month:09/2026
  if (s.startsWith('month_') || s.startsWith('month:')) {
    const raw = s.replace(/^(month_|month:)/, '');
    if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `Tháng ${parts[0].padStart(2, '0')}/${parts[1]}`;
      }
    } else if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        if (parts[0].length === 4) {
          return `Tháng ${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        return `Tháng ${parts[0].padStart(2, '0')}/${parts[1]}`;
      }
    } else if (raw.includes('_')) {
      const parts = raw.split('_');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `Tháng ${parts[0].padStart(2, '0')}/${parts[1]}`;
      }
    }
  }

  // Xử lý kỳ quý: quarter_3_2026, quarter:2026-3, quarter_3/2026
  if (s.startsWith('quarter_') || s.startsWith('quarter:')) {
    const raw = s.replace(/^(quarter_|quarter:)/, '');
    if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        if (parts[0].length === 4) {
          return `Quý ${parts[1]}/${parts[0]}`;
        }
        return `Quý ${parts[0]}/${parts[1]}`;
      }
    } else if (raw.includes('_')) {
      const parts = raw.split('_');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `Quý ${parts[0]}/${parts[1]}`;
      }
    } else if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return `Quý ${parts[0]}/${parts[1]}`;
      }
    }
  }

  // Xử lý kỳ năm: year_2026, year:2026
  if (s.startsWith('year_') || s.startsWith('year:')) {
    const yr = s.replace(/^(year_|year:)/, '');
    return `Năm ${yr}`;
  }

  return s;
};

export const FINANCIAL_FIELDS: (keyof RecordType)[] = [
  'amount',
  'months',
  'wage',
  'support_pct',
  'nn_support_pct',
  'nn_support_amount',
  'dp_support_pct',
  'dp_support_amount',
  'base_premium',
  'discount_amount',
  'penalty_amount',
  'commission',
  'income',
  'from_month',
  'to_month',
  'date',
  'effective_date',
  'target_date',
  'next_payment',
  'type',
  'sub_type',
  'method',
  'payment_status',
  'status',
  'members'
];


export const checkFinancialLockViolation = (
  originalRecord: RecordType,
  updates: Partial<RecordType>,
  lockedKeys: string[]
): { isViolated: boolean; violatedFields: string[] } => {
  if (!isDateLocked(originalRecord.date, lockedKeys)) {
    return { isViolated: false, violatedFields: [] };
  }
  const violatedFields: string[] = [];
  for (const field of FINANCIAL_FIELDS) {
    if (field in updates) {
      const origVal = (originalRecord as any)[field];
      const newVal = (updates as any)[field];
      if (typeof origVal === 'object' || typeof newVal === 'object') {
        if (JSON.stringify(origVal) !== JSON.stringify(newVal)) {
          violatedFields.push(field);
        }
      } else if (origVal !== newVal && !(origVal === undefined && newVal === '') && !(origVal === '' && newVal === undefined)) {
        violatedFields.push(field);
      }
    }
  }
  return { isViolated: violatedFields.length > 0, violatedFields };
};

export const getHistoryForCustomer = (customer: any, records: any[]) => {
  if (!customer) return [];
  const code = (customer.bhxh || customer.cccd || '').trim();
  const phone = (customer.phone || '').trim();
  const targetName = customer.name ? customer.name.split(' (+')[0].trim().toLowerCase() : '';

  let historyRecords = (records || []).filter(rec => {
    // 1. Loại bỏ bản ghi đã hủy hoặc đã thoái thu toàn phần
    const paymentStatus = rec.payment_status || rec.paymentStatus;
    if (paymentStatus === 'Đã hủy' || paymentStatus === 'Đã thoái thu') return false;
    // Nếu bản ghi có bút toán thoái thu hoàn trả toàn phần thì cũng không tính là đã đóng
    const isFullyClawedBack = (records || []).some(
      adj => (adj.is_adjustment ?? adj.isAdjustment) && 
             (adj.original_record_id ?? adj.originalRecordId) === rec.id && 
             Math.abs(Number(adj.amount) || 0) >= (Number(rec.amount) || 0)
    );
    if (isFullyClawedBack) return false;

    // 2. Loại bỏ các bản ghi khởi tạo ảo (phải có ĐỦ từ tháng & đến tháng OR số tiền đóng > 0)
    const fromMonth = rec.from_month || rec.fromMonth;
    const toMonth = rec.to_month || rec.toMonth;
    const hasFullPeriod = Boolean(fromMonth && toMonth);
    const hasAmount = Number(rec.amount) > 0;
    if (!hasFullPeriod && !hasAmount) return false;

    const recBhxh = (rec.bhxh || '').trim();
    const recCccd = (rec.cccd || '').trim();
    const recPhone = (rec.phone || '').trim();
    const recName = rec.name ? rec.name.split(' (+')[0].trim().toLowerCase() : '';

    // 3. Nếu khách hàng có Mã BHXH hoặc Số CCCD -> BẮT BUỘC chỉ khớp theo mã
    if (code) {
      return recBhxh === code || recCccd === code;
    }

    // 4. Nếu không có mã nhưng có SĐT -> Khớp theo SĐT
    if (phone && recPhone) {
      return recPhone === phone;
    }

    // 5. Nếu không có cả mã và SĐT -> Mới khớp theo Tên
    if (targetName && recName) {
      return recName === targetName;
    }

    return false;
  });

  if (historyRecords.length === 0) {
    historyRecords = [customer];
  }

  // Deduplicate records
  const seen = new Set();
  const uniqueRecords: any[] = [];
  
  historyRecords.forEach(rec => {
    const fromMonth = rec.from_month || rec.fromMonth;
    const toMonth = rec.to_month || rec.toMonth;
    const nextPayment = rec.next_payment || rec.nextPayment;
    const key = rec.id || `${rec.type}-${fromMonth}-${toMonth}-${rec.amount}-${nextPayment}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecords.push(rec);
    }
  });

  uniqueRecords.sort((a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());

  return uniqueRecords;
};

export const getInitials = (name: string): string => {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
    const firstChar = parts[0][0] ?? '';
    const lastChar = parts[parts.length - 1]?.[0] ?? '';
    return (firstChar + lastChar).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

/**
 * Trích xuất Mã số BHXH cũ (10 số) của khách hàng:
 * 1. Nếu bản ghi có trường oldBhxh hoặc bhxhCu hợp lệ gồm đúng 10 chữ số.
 * 2. Nếu r.bhxh có đúng 10 chữ số (chưa bị gộp với số CCCD 12 số).
 * 3. Nếu r.bhxh là 12 số (đã gộp với CCCD) hoặc rỗng, tra cứu trong toàn bộ lịch sử/cụm giao dịch
 *    của cùng khách hàng (theo CCCD hoặc SĐT + Tên) để tìm mã 10 số cũ trước đó.
 * 4. Nếu trong ghi chú (notes) có chứa chuỗi 10 chữ số độc lập.
 */
export const getOldBhxh10 = (record: any, allRecords?: any[]): string => {
  if (!record) return '';

  // 1. Kiểm tra trường trực tiếp
  const directOld = (record.oldBhxh || record.bhxhCu || record.old_bhxh || '').toString().trim().replace(/\D/g, '');
  if (directOld.length === 10) return directOld;

  // 2. Nếu chính r.bhxh là 10 chữ số
  const currentBhxh = (record.bhxh || '').toString().trim().replace(/\D/g, '');
  if (currentBhxh.length === 10) return currentBhxh;

  // 3. Tra cứu trong toàn bộ records của khách hàng này (Unification Cluster match)
  if (allRecords && allRecords.length > 0) {
    const cccd = (record.cccd || '').toString().trim();
    const phone = (record.phone || '').toString().trim();
    const name = (record.name || '').split(' (+')[0].trim().toLowerCase();

    for (const other of allRecords) {
      if (!other) continue;
      if (record.id !== undefined && other.id !== undefined && record.id === other.id) continue;

      const otherCccd = (other.cccd || '').toString().trim();
      const otherPhone = (other.phone || '').toString().trim();
      const otherName = (other.name || '').split(' (+')[0].trim().toLowerCase();

      const isSameCustomer = (cccd && otherCccd && cccd === otherCccd) ||
        (phone && otherPhone && phone === otherPhone && name && otherName && name === otherName);

      if (isSameCustomer) {
        const otherOld = (other.oldBhxh || other.bhxhCu || other.old_bhxh || '').toString().trim().replace(/\D/g, '');
        if (otherOld.length === 10) return otherOld;

        const otherBhxh = (other.bhxh || '').toString().trim().replace(/\D/g, '');
        if (otherBhxh.length === 10) return otherBhxh;
      }
    }
  }

  // 4. Tìm trong notes (ví dụ: "Mã BHXH cũ: 0141930150" hoặc "0141930150")
  const notes = (record.notes || '').toString();
  const noteMatch = notes.match(/\b(\d{10})\b/);
  if (noteMatch) {
    return noteMatch[1];
  }

  return '';
};

export interface CustomerSummaryRecord extends RecordType {
  totalHistoryCount: number;
}

/**
 * Nhóm tất cả các giao dịch/kỳ đóng của một khách hàng dựa trên CCCD, Mã BHXH, hoặc (SĐT + Tên).
 * Tìm và trả về hồ sơ MỚI NHẤT (nextPayment mới nhất / ngày lập mới nhất) cho mỗi khách hàng duy nhất.
 */
export const groupRecordsByCustomer = (allRecords: RecordType[] | any[], filterType?: string): CustomerSummaryRecord[] => {
  if (!allRecords || allRecords.length === 0) return [];

  const validRecords = allRecords.filter(r => {
    const pStatus = r.payment_status || (r as any).paymentStatus;
    if (pStatus === 'Đã hủy' || pStatus === 'Đã thoái thu') return false;
    const isAdj = r.is_adjustment !== undefined ? r.is_adjustment : (r as any).isAdjustment;
    if (isAdj) return false;
    const isFullyClawedBack = allRecords.some(
      adj => ((adj.is_adjustment ?? (adj as any).isAdjustment)) && ((adj.original_record_id ?? (adj as any).originalRecordId)) === r.id && Math.abs(Number(adj.amount) || 0) >= (Number(r.amount) || 0)
    );
    if (isFullyClawedBack) return false;
    if (filterType && filterType !== 'ALL' && r.type !== filterType) return false;
    return true;
  });

  const cccdToRecords = new Map<string, RecordType[]>();
  const bhxhToRecords = new Map<string, RecordType[]>();
  const phoneNameToRecords = new Map<string, RecordType[]>();

  validRecords.forEach(r => {
    const cccd = (r.cccd || '').trim();
    const bhxh = (r.bhxh || '').trim();
    const phone = (r.phone || '').trim();
    const name = (r.name || '').split(' (+')[0].trim().toLowerCase();
    const type = r.type || 'BHXH';

    if (cccd) {
      const key = `${type}_cccd_${cccd.toLowerCase()}`;
      if (!cccdToRecords.has(key)) cccdToRecords.set(key, []);
      cccdToRecords.get(key)!.push(r);
    }
    if (bhxh) {
      const key = `${type}_bhxh_${bhxh.toLowerCase()}`;
      if (!bhxhToRecords.has(key)) bhxhToRecords.set(key, []);
      bhxhToRecords.get(key)!.push(r);
    }
    if (phone && name) {
      const key = `${type}_phone_${phone}_name_${name}`;
      if (!phoneNameToRecords.has(key)) phoneNameToRecords.set(key, []);
      phoneNameToRecords.get(key)!.push(r);
    }
  });

  const visitedRecordIds = new Set<string | number>();
  const latestCustomers: any[] = [];

  validRecords.forEach(r => {
    const rId = r.id !== undefined && r.id !== null ? r.id : `${r.name}_${r.phone}_${r.nextPayment}`;
    if (visitedRecordIds.has(rId)) return;

    const customerRecords: any[] = [];
    const queue = [r];
    visitedRecordIds.add(rId);
    let head = 0;

    while (head < queue.length) {
      const current = queue[head++];
      customerRecords.push(current);

      const type = current.type || 'BHXH';
      const cccd = (current.cccd || '').trim();
      const bhxh = (current.bhxh || '').trim();
      const phone = (current.phone || '').trim();
      const name = (current.name || '').split(' (+')[0].trim().toLowerCase();

      const neighbors: any[] = [];
      if (cccd) {
        neighbors.push(...(cccdToRecords.get(`${type}_cccd_${cccd.toLowerCase()}`) || []));
      }
      if (bhxh) {
        neighbors.push(...(bhxhToRecords.get(`${type}_bhxh_${bhxh.toLowerCase()}`) || []));
      }
      if (phone && name) {
        neighbors.push(...(phoneNameToRecords.get(`${type}_phone_${phone}_name_${name}`) || []));
      }

      neighbors.forEach(n => {
        const nId = n.id !== undefined && n.id !== null ? n.id : `${n.name}_${n.phone}_${n.nextPayment}`;
        if (!visitedRecordIds.has(nId)) {
          visitedRecordIds.add(nId);
          queue.push(n);
        }
      });
    }

    // Sort customer records to find the newest active transaction (latest nextPayment)
    customerRecords.sort((a, b) => {
      const nextA = new Date(a.nextPayment || 0).getTime();
      const nextB = new Date(b.nextPayment || 0).getTime();
      if (nextB !== nextA) return nextB - nextA;
      const dateA = new Date(a.date || a.created_at || 0).getTime();
      const dateB = new Date(b.date || b.created_at || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    const latest = customerRecords[0];
    latestCustomers.push({
      ...latest,
      totalHistoryCount: customerRecords.length
    });
  });

  return latestCustomers;
};

