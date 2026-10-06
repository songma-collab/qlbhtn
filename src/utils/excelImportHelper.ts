/**
 * excelImportHelper.ts
 * Bộ tiện ích nhập khẩu (Import) dữ liệu Excel chuyên nghiệp cho BHXH / BHYT Sông Mã.
 * 
 * Tính năng chính:
 * 1. Khử toàn bộ lỗi lệch Unicode (NFC vs NFD), dấu tiếng Việt và khoảng trắng tiêu đề cột.
 * 2. Phân tích ngữ nghĩa thông minh (Semantic Header Matching) cho hơn 25 trường dữ liệu.
 * 3. Chuẩn hóa ngày tháng (DD/MM/YYYY, Excel serial, ISO) và kỳ đóng (MM/YYYY).
 * 4. Tự động tính hạn nộp tiếp theo (nextPayment) dựa trên kỳ đóng thực tế (thay vì gán cố định 1 năm).
 * 5. Tự động liên kết cán bộ thu (staffId) và tính toán hoa hồng chuẩn theo chính sách.
 * 6. Tách bạch rõ ràng giữa Giao dịch tài chính (Financial Records) và Danh bạ khách hàng (Customer Directory).
 */

import { RecordType, CustomerType } from '../context/types';
import { getCommissionRateForRecord } from './calculations';
import { getLocalYYYYMMDD, formatTitleCase } from './helpers';
import { parseMonthAndYear, toUIDate, toUIMonth } from './dateStandardHelper';
import { isSafeColumnKey } from './excelSecurity';

/**
 * Chuẩn hóa chuỗi tiêu đề cột:
 * - Chuyển sang NFD để tách dấu
 * - Loại bỏ toàn bộ dấu thanh tiếng Việt
 * - Chuyển thành chữ thường và chỉ giữ lại ký tự a-z, 0-9
 * Ví dụ: "Tổng Tiền" -> "tongtien", "Tổng Tiền" (NFD) -> "tongtien", "Từ tháng" -> "tuthang"
 */
export const normalizeHeaderKey = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Bảng ánh xạ các cột dữ liệu theo ngữ nghĩa nghiệp vụ BHXH / BHYT
 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['hovaten', 'hoten', 'ten', 'name', 'fullname', 'nguoithamgia', 'chuthe'],
  cccd: ['cccd', 'socccd', 'soddcn', 'cmnd', 'socmnd', 'socancuoc', 'citizenid'],
  bhxh: ['mabhxh', 'masobhxh', 'mathe', 'mathebhyt', 'sobhxh', 'code', 'bhxhcode'],
  oldBhxh: ['mabhxhcu', 'bhxhcu', 'macu', 'oldbhxh', 'socu'],
  dob: ['ngaysinh', 'namsinh', 'dob', 'birthdate', 'dateofbirth'],
  gender: ['gioitinh', 'gender', 'phai', 'sex'],
  nation: ['dantoc', 'nation', 'ethnicity', 'thieuso', 'kinh'],
  phone: ['sodienthoai', 'sdt', 'dienthoai', 'phone', 'telephone', 'mobile'],
  email: ['email', 'thudientu', 'mail'],
  address: ['diachi', 'noicutru', 'hokhau', 'diachicutru', 'address'],
  notes: ['ghichu', 'note', 'notes', 'mota', 'chuthich'],
  type: ['loaihinh', 'loaithamgia', 'loai', 'type', 'loaihopdong'],
  income: ['mucthunhap', 'thunhap', 'income', 'mucthunhapluachon', 'luong', 'wage', 'tienluong'],
  method: ['phuongthucdong', 'phuongthuc', 'cachdong', 'method', 'kythanhhinh'],
  months: ['sothang', 'months', 'duration', 'sothangdong', 'kydongthang'],
  fromMonth: ['tuthang', 'frommonth', 'kydong', 'tungay', 'thangbatdau', 'thangbd'],
  toMonth: ['denthang', 'tomonth', 'denngay', 'thangketthuc', 'thangkt'],
  wage: ['mucdong', 'mucdongquydinh', 'tiendong', 'basepremium', 'tongmucdong'],
  nnSupportAmount: ['ngansachnnhotro', 'hotronn', 'nnhotro', 'hotrongansach', 'support', 'nssupport'],
  dpSupportAmount: ['diaphuonghotro', 'hotrodp', 'dphotro', 'dpsupport'],
  amount: ['tongtien', 'sotienthu', 'sotiendong', 'thucthu', 'amount', 'total', 'sotien'],
  paymentStatus: ['trangthai', 'trangthaithanhtoan', 'paymentstatus', 'tinhtrang'],
  isSubmittedBHXH: ['chuyenbhxh', 'danopbhxh', 'trangthaichuyen', 'chuyenkhoanbhxh'],
  submissionBatch: ['dotchuyen', 'submissionbatch', 'dotnop', 'dot', 'madot'],
  submittedDate: ['ngaychuyen', 'submitteddate', 'ngaynop', 'ngaychuyenkhoan'],
  staff: ['nhanvien', 'nhanvienthu', 'canbothu', 'nguoithu', 'staff', 'staffname'],
  date: ['ngaydangky', 'ngaytao', 'ngaythu', 'date', 'ngaygd', 'ngay']
};

/**
 * Trích xuất giá trị từ dòng Excel dựa trên danh sách alias ngữ nghĩa
 */
export const extractField = (row: Record<string, any>, fieldKey: string): any => {
  const aliases = FIELD_ALIASES[fieldKey];
  if (!aliases) return undefined;

  const rowKeys = Object.keys(row);
  for (const k of rowKeys) {
    if (!isSafeColumnKey(k)) continue;
    const normalizedKey = normalizeHeaderKey(k);
    if (aliases.some(alias => normalizedKey === alias || normalizedKey.includes(alias))) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return val;
      }
    }
  }
  return undefined;
};

/**
 * Phân tích số tiền an toàn (hỗ trợ định dạng chuỗi "231.000", "231,000 đ", số nguyên)
 */
export const parseMoneySafe = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : Math.round(val);
  const cleanStr = String(val).replace(/[^\d-]/g, '');
  const parsed = parseInt(cleanStr, 10);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Phân tích tháng dạng MM/YYYY hoặc YYYY-MM
 */
export const parseMonthSafe = (val: any): string => {
  if (!val) return '';
  const s = String(val).trim();
  
  // Dạng MM/YYYY hoặc M/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m1 && m1[1] && m1[2]) {
    const m = m1[1].padStart(2, '0');
    const y = m1[2];
    return `${m}/${y}`;
  }

  // Dạng YYYY-MM hoặc YYYY/MM
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})$/);
  if (m2 && m2[1] && m2[2]) {
    const y = m2[1];
    const m = m2[2].padStart(2, '0');
    return `${m}/${y}`;
  }

  // Dạng số nguyên Excel serial
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return `${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCFullYear()}`;
  }

  return s;
};

/**
 * Phân tích ngày tháng an toàn sang ISO YYYY-MM-DD
 */
export const parseDateSafe = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return getLocalYYYYMMDD(d);
  }
  const s = String(val).trim();
  // Dạng DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m && m[1] && m[2] && m[3]) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  // Thử Date parse
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return getLocalYYYYMMDD(d);
  }
  return '';
};

/**
 * Tính toán ngày gia hạn tiếp theo (nextPayment) từ kỳ đóng đến tháng
 * Nếu đến tháng 09/2026 -> Hạn đóng tiếp là 15/10/2026
 */
export const calculateNextPaymentFromToMonth = (toMonthStr?: string, fallbackMonths = 1): string => {
  if (toMonthStr) {
    const { month, year } = parseMonthAndYear(toMonthStr);
    if (month && year) {
      // Tháng kế tiếp sau khi hết hạn đóng
      const nextDate = new Date(year, month, 15);
      return getLocalYYYYMMDD(nextDate);
    }
  }
  // Fallback: tính từ hiện tại cộng thêm số tháng
  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + fallbackMonths);
  return getLocalYYYYMMDD(fallback);
};

export const generateCustomerKeyJs = (type: string, bhxh?: string, cccd?: string, name?: string, phone?: string): string => {
  const cleanCccd = String(cccd || '').replace(/\D/g, '');
  const cleanBhxh = String(bhxh || '').replace(/\D/g, '');
  const cleanPhone = String(phone || '').replace(/\D/g, '');
  const cleanName = String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleanCccd.length === 12 || cleanCccd.length === 9) {
    return `CUST_CCCD_${cleanCccd}`;
  }
  if (cleanBhxh.length === 10) {
    return `CUST_BHXH_${cleanBhxh}`;
  }
  if (cleanPhone && cleanName) {
    return `CUST_PHONE_${cleanPhone}_${cleanName}`;
  }
  return `CUST_NAME_${cleanName || 'unknown'}_${cleanPhone || 'none'}`;
};

export interface ParsedExcelResult {
  records: RecordType[];
  customerProfiles: Partial<CustomerType>[];
  hasTransactionData: boolean;
  totalRows: number;
}

/**
 * Hàm phân tích toàn diện bảng tính Excel thành các đối tượng chuẩn của hệ thống
 */
export const parseExcelRows = (
  rawRows: any[],
  options: {
    defaultType: 'BHXH' | 'BHYT';
    staffList: any[];
    policies: any[];
    settings: any;
    currentUserId?: string | undefined;
  }
): ParsedExcelResult => {
  const { defaultType, staffList, policies, settings, currentUserId } = options;
  const recordsToInsert: RecordType[] = [];
  const customerProfiles: Partial<CustomerType>[] = [];
  let detectedTransactionsCount = 0;

  rawRows.forEach((row, idx) => {
    // 1. Họ và tên người tham gia
    const rawName = extractField(row, 'name');
    if (!rawName) return;
    const name = formatTitleCase(String(rawName));

    // 2. Định danh CCCD và BHXH
    const rawCccd = extractField(row, 'cccd');
    const cccd = rawCccd ? String(rawCccd).replace(/\D/g, '').slice(0, 12) : '';
    const rawBhxh = extractField(row, 'bhxh');
    const bhxh = rawBhxh ? String(rawBhxh).trim() : '';
    const rawOldBhxh = extractField(row, 'oldBhxh');
    const oldBhxh = rawOldBhxh ? String(rawOldBhxh).trim() : '';

    // 3. Phân loại loại hình BHXH hay BHYT
    const rawType = String(extractField(row, 'type') || '').toUpperCase();
    let type: 'BHXH' | 'BHYT' = defaultType;
    if (rawType.includes('BHYT')) type = 'BHYT';
    else if (rawType.includes('BHXH')) type = 'BHXH';

    // 4. Thông tin nhân khẩu học
    const phone = String(extractField(row, 'phone') || '').replace(/\D/g, '').slice(0, 10);
    const email = String(extractField(row, 'email') || '').trim();
    const address = String(extractField(row, 'address') || '').trim();
    const dob = parseDateSafe(extractField(row, 'dob'));
    const rawGender = String(extractField(row, 'gender') || '').toLowerCase();
    const gender = (rawGender.includes('nu') || rawGender.includes('nữ') || rawGender === 'female') ? 'Nữ' : 'Nam';
    const rawNation = String(extractField(row, 'nation') || '').toLowerCase();
    const nation = (rawNation.includes('thieu') || rawNation.includes('thiểu') || rawNation.includes('hmong') || rawNation.includes('dao') || rawNation.includes('thai')) ? 'Thiểu_số' : 'Kinh';
    const notes = String(extractField(row, 'notes') || '').trim();

    // 5. Thông tin kỳ đóng và tài chính
    const rawFromMonth = extractField(row, 'fromMonth');
    const rawToMonth = extractField(row, 'toMonth');
    const fromMonth = parseMonthSafe(rawFromMonth);
    const toMonth = parseMonthSafe(rawToMonth);
    const months = parseInt(String(extractField(row, 'months') || 1), 10) || 1;

    const income = parseMoneySafe(extractField(row, 'income'));
    const wage = parseMoneySafe(extractField(row, 'wage'));
    const nnSupportAmount = parseMoneySafe(extractField(row, 'nnSupportAmount'));
    const dpSupportAmount = parseMoneySafe(extractField(row, 'dpSupportAmount'));
    const amount = parseMoneySafe(extractField(row, 'amount'));
    const method = String(extractField(row, 'method') || 'Đóng hằng tháng').trim();

    // Kiểm tra xem dòng này có dữ liệu giao dịch tài chính hay không
    const isTransactionRow = amount > 0 || income > 0 || Boolean(fromMonth || toMonth);
    if (isTransactionRow) detectedTransactionsCount++;

    // 6. Trạng thái thanh toán và chuyển BHXH
    const rawPaymentStatus = String(extractField(row, 'paymentStatus') || '').trim();
    const paymentStatus = rawPaymentStatus || 'Đã thu tiền';

    const rawSubmitted = String(extractField(row, 'isSubmittedBHXH') || '').toLowerCase();
    const isSubmittedBHXH = rawSubmitted.includes('da') || rawSubmitted.includes('đã') || rawSubmitted.includes('true') || rawSubmitted.includes('chuyen');
    const submissionBatch = String(extractField(row, 'submissionBatch') || '').trim();
    const submittedDate = parseDateSafe(extractField(row, 'submittedDate'));

    // 7. Nhân viên thu
    const rawStaffName = String(extractField(row, 'staff') || '').trim();
    let staffId = currentUserId || 'admin';
    if (rawStaffName) {
      const matchedStaff = staffList.find(s => 
        normalizeHeaderKey(s.name) === normalizeHeaderKey(rawStaffName) ||
        s.id === rawStaffName
      );
      if (matchedStaff) staffId = matchedStaff.id;
    }

    // 8. Ngày ghi nhận giao dịch
    const rawDate = extractField(row, 'date');
    const parsedRegDate = parseDateSafe(rawDate);
    const date = parsedRegDate ? new Date(parsedRegDate).toISOString() : new Date().toISOString();

    // 9. Tính hạn nộp tiếp theo chuẩn xác
    const nextPayment = calculateNextPaymentFromToMonth(toMonth || fromMonth, months);

    const custKey = generateCustomerKeyJs(type, bhxh, cccd, name, phone);

    // Tạo bản ghi giao dịch (Record)
    const newRecord: any = {
      id: Date.now() + idx,
      type,
      name,
      cccd,
      bhxh,
      oldBhxh,
      old_bhxh: oldBhxh,
      phone,
      email,
      address,
      dob,
      gender,
      nation,
      notes,
      date,
      actionType: 'Nhập từ Excel',
      paymentStatus,
      status: 'Đang tham gia',
      staffId,
      staff_id: staffId,
      customerKey: custKey,
      customer_key: custKey,
      income: income || (type === 'BHXH' ? 1500000 : 0),
      wage: wage || 0,
      basePremium: wage || 0,
      nnSupportAmount: nnSupportAmount || 0,
      dpSupportAmount: dpSupportAmount || 0,
      amount,
      method,
      months,
      fromMonth: fromMonth || undefined,
      toMonth: toMonth || undefined,
      from_month: fromMonth || undefined,
      to_month: toMonth || undefined,
      nextPayment,
      isSubmittedBHXH,
      submissionBatch: submissionBatch || undefined,
      submittedDate: submittedDate || undefined
    };

    // Tính hoa hồng nếu là giao dịch có tiền
    const rate = getCommissionRateForRecord(newRecord, policies, settings);
    newRecord.commission = Math.round(amount * rate);

    recordsToInsert.push(newRecord as RecordType);

    // Tạo hồ sơ khách hàng (Customer Profile)
    customerProfiles.push({
      customer_key: custKey,
      name,
      cccd,
      bhxh,
      old_bhxh: oldBhxh,
      phone,
      email,
      address,
      dob,
      gender,
      nation,
      type,
      status: 'Đang tham gia',
      payment_status: paymentStatus,
      next_payment: nextPayment,
      notes
    });
  });

  return {
    records: recordsToInsert,
    customerProfiles,
    hasTransactionData: detectedTransactionsCount > 0,
    totalRows: rawRows.length
  };
};
