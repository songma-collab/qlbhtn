import { getOldBhxh10, formatDateVN, formatMonthVN, getLocalYYYYMMDD } from './helpers';
import { protectWorksheetFormulas } from './excelSecurity';
import { logExportExcelAudit } from './security';
import type { RecordType } from '../context/types';

export interface ExportStandardParams {
  records: RecordType[] | any[];
  batchCode?: string;
  agencyName?: string;
  agencyCode?: string;
  unitName?: string;
  unitCode?: string;
  periodLabel?: string;
  periodText?: string;
  currentUser?: any;
  staffList?: any[];
}

/**
 * Nhường luồng cho Event Loop của trình duyệt (tránh đơ UI / Page Unresponsive khi xuất hàng ngàn dòng)
 */
export const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Xuất Mẫu D03-TS: Danh sách người chỉ tham gia Bảo hiểm y tế hộ gia đình
 * Chuẩn BHXH Việt Nam (theo QĐ 595/QĐ-BHXH & QĐ 505/QĐ-BHXH)
 */
export const exportD03TSStandardExcel = async ({
  records,
  batchCode,
  agencyName = 'ĐẠI LÝ THU BHXH SÔNG MÃ',
  agencyCode = 'VSS-SM-001',
  unitName,
  unitCode,
  periodLabel,
  periodText,
  currentUser,
  staffList = []
}: ExportStandardParams) => {
  const finalAgencyName = unitName || agencyName;
  const finalAgencyCode = unitCode || agencyCode;
  const finalPeriodLabel = periodText || periodLabel;
  const XLSX = (await import('xlsx-js-style')).default;

  const validRecords = records.filter(r => (r.type ? r.type === 'BHYT' : true) && (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');
  if (validRecords.length === 0) {
    throw new Error('Không có bản ghi hợp lệ để xuất biểu mẫu D03-TS (hồ sơ phải thuộc loại BHYT và chưa bị hủy).');
  }

  // Styles
  const fontMain = 'Times New Roman';
  const borderThin = {
    top: { style: 'thin', color: { rgb: '475569' } },
    bottom: { style: 'thin', color: { rgb: '475569' } },
    left: { style: 'thin', color: { rgb: '475569' } },
    right: { style: 'thin', color: { rgb: '475569' } }
  };

  const headerMetaStyle = {
    font: { name: fontMain, sz: 10, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  const formCodeStyle = {
    font: { name: fontMain, sz: 10, bold: true },
    alignment: { horizontal: 'right', vertical: 'center' }
  };

  const titleStyle = {
    font: { name: fontMain, sz: 14, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const subTitleStyle = {
    font: { name: fontMain, sz: 11, italic: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const tableHeaderStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderThin
  };

  const subColHeaderStyle = {
    font: { name: fontMain, sz: 9, bold: true, italic: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const cellTextStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const cellCenterStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const cellNumberStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  const totalRowStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '991B1B' } },
    fill: { fgColor: { rgb: 'FEE2E2' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  // Build Sheet Rows
  const rows: any[][] = [];

  // Row 0-2: Agency and Decision Header
  rows.push([
    { v: 'BẢO HIỂM XÃ HỘI VIỆT NAM', s: headerMetaStyle },
    null, null, null, null, null, null, null, null, null,
    { v: 'Mẫu D03-TS', s: formCodeStyle }
  ]);
  rows.push([
    { v: `${finalAgencyName} (Mã: ${finalAgencyCode})`, s: headerMetaStyle },
    null, null, null, null, null, null, null, null, null,
    { v: '(Ban hành kèm theo QĐ số 595/QĐ-BHXH & QĐ 505/QĐ-BHXH)', s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'right' } } }
  ]);
  rows.push([]);

  // Title
  const nowVN = new Date();
  const dateSub = finalPeriodLabel || `Ngày ${nowVN.getDate()} tháng ${nowVN.getMonth() + 1} năm ${nowVN.getFullYear()}`;
  rows.push([
    { v: 'DANH SÁCH NGƯỜI THAM GIA BẢO HIỂM Y TẾ HỘ GIA ĐÌNH', s: titleStyle }
  ]);
  rows.push([
    { v: `Đợt nộp: ${batchCode || 'Tất cả'} | Kỳ: ${dateSub}`, s: subTitleStyle }
  ]);
  rows.push([]);

  // Table Headers
  const colHeaders = [
    'STT',
    'Họ và tên người tham gia',
    'Mã số BHXH (10 số)',
    'Số CCCD/Định danh',
    'Ngày sinh',
    'Giới tính',
    'Địa chỉ cư trú',
    'Nơi đăng ký KCB ban đầu',
    'Thứ tự trong hộ',
    'Mức đóng chuẩn (VNĐ)',
    'Tỷ lệ đóng (%)',
    'Số tiền đóng (VNĐ)',
    'Số tháng',
    'Từ ngày',
    'Đến ngày',
    'Ngày biên lai',
    'Số biên lai',
    'Mã đợt nộp',
    'Nhân viên thu',
    'Ghi chú'
  ];

  rows.push(colHeaders.map(h => ({ v: h, s: tableHeaderStyle })));

  // Sub-col indicators (A, B, 1, 2, 3...)
  const subCols = [
    'A', 'B', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18'
  ];
  rows.push(subCols.map(c => ({ v: c, s: subColHeaderStyle })));

  let totalAmount = 0;

  for (let idx = 0; idx < validRecords.length; idx++) {
    if (idx > 0 && idx % 150 === 0) {
      await yieldToEventLoop();
    }
    const r = validRecords[idx];
    const staffName = staffList.find(s => s.id === r.staffId || s.id === r.staff_id)?.name || r.staffId || r.staff_id || 'Đại lý';
    const oldBhxh = getOldBhxh10(r, records);
    const cccd = String(r.cccd || r.citizen_id || (r as any).citizenId || '').trim();
    // Đồng bộ mã số BHXH theo số CCCD theo Đề án 06
    const bhxhCode = cccd || String(r.bhxh || oldBhxh || '').trim();
    const amount = Number(r.amount) || 0;
    totalAmount += amount;

    // Phân tích thứ tự thành viên trong hộ gia đình nếu có
    const orderInHousehold = r.sub_type || r.subType || (r.members && r.members.length > 1 ? `Hộ ${r.members.length} người` : 'Người thứ 1');
    const baseStandardRate = 2530000 * 0.045; // 4.5% mức lương cơ sở
    const supPct = r.support_pct != null ? r.support_pct : (r.supportPct != null ? r.supportPct : null);

    rows.push([
      { v: idx + 1, s: cellCenterStyle },
      { v: r.name || r.full_name || (r as any).fullName || '', s: cellTextStyle },
      { v: bhxhCode, s: cellCenterStyle, t: 's' },
      { v: cccd, s: cellCenterStyle, t: 's' },
      { v: formatDateVN(r.dob || r.birth_date), s: cellCenterStyle },
      { v: r.gender || '', s: cellCenterStyle },
      { v: r.address || '', s: cellTextStyle },
      { v: r.notes?.includes('KCB:') ? r.notes.split('KCB:')[1].trim() : 'Theo tuyến quy định', s: cellTextStyle },
      { v: orderInHousehold, s: cellCenterStyle },
      { v: Math.round(baseStandardRate), s: cellNumberStyle },
      { v: supPct != null ? `${supPct}%` : '100%', s: cellCenterStyle },
      { v: amount, s: cellNumberStyle },
      { v: Number(r.months) || 12, s: cellCenterStyle },
      { v: formatMonthVN(r.from_month || r.fromMonth || r.date), s: cellCenterStyle },
      { v: formatMonthVN(r.to_month || r.toMonth), s: cellCenterStyle },
      { v: formatDateVN(r.date), s: cellCenterStyle },
      { v: r.id ? `BL-${r.id}` : '', s: cellCenterStyle },
      { v: r.submission_batch || r.submissionBatch || batchCode || 'Chưa gắn đợt', s: cellCenterStyle },
      { v: staffName, s: cellTextStyle },
      { v: r.notes || '', s: cellTextStyle }
    ]);
  }

  // Total Summary Row
  rows.push([
    { v: 'TỔNG CỘNG', s: { ...totalRowStyle, alignment: { horizontal: 'center' } } },
    { v: `${validRecords.length} người tham gia`, s: { ...totalRowStyle, alignment: { horizontal: 'left' } } },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: totalAmount, s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle },
    { v: '', s: totalRowStyle }
  ]);

  // Signatures
  rows.push([]);
  rows.push([
    null,
    { v: 'NGƯỜI LẬP BIỂU', s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center' } } },
    null, null,
    { v: 'CÁN BỘ THU TIỀN', s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center' } } },
    null, null, null, null, null, null,
    { v: 'ĐẠI DIỆN ĐẠI LÝ THU', s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center' } } }
  ]);
  rows.push([
    null,
    { v: '(Ký, ghi rõ họ tên)', s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center' } } },
    null, null,
    { v: '(Ký, ghi rõ họ tên)', s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center' } } },
    null, null, null, null, null, null,
    { v: '(Ký tên, đóng dấu)', s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center' } } }
  ]);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merge headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 0, c: 10 }, e: { r: 0, c: 19 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 1, c: 10 }, e: { r: 1, c: 19 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 19 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 19 } }
  ];

  // Column Widths
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 24 }, // Họ tên
    { wch: 16 }, // Mã BHXH
    { wch: 16 }, // CCCD
    { wch: 12 }, // Ngày sinh
    { wch: 10 }, // Giới tính
    { wch: 32 }, // Địa chỉ
    { wch: 22 }, // KCB
    { wch: 16 }, // Thứ tự
    { wch: 16 }, // Chuẩn đóng
    { wch: 14 }, // Tỷ lệ
    { wch: 18 }, // Tiền đóng
    { wch: 10 }, // Số tháng
    { wch: 12 }, // Từ ngày
    { wch: 12 }, // Đến ngày
    { wch: 14 }, // Ngày BL
    { wch: 14 }, // Số BL
    { wch: 20 }, // Đợt nộp
    { wch: 20 }, // Nhân viên
    { wch: 24 }  // Ghi chú
  ];

  protectWorksheetFormulas(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_D03_TS');

  const fileName = `Mau_D03_TS_${batchCode || 'BHYT'}_${getLocalYYYYMMDD()}.xlsx`;
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'test') {
    XLSX.writeFile(wb, fileName);
  }

  // Ghi nhật ký kiểm toán xuất báo cáo danh bạ Excel D03-TS
  logExportExcelAudit('D03', validRecords.length, currentUser, batchCode ? `Đợt: ${batchCode}` : undefined);

  return { fileName, count: validRecords.length, totalAmount, workbook: wb, worksheet: ws };
};

/**
 * Lấy nhãn phân loại đối tượng được Nhà nước hỗ trợ theo Luật BHXH 2024
 */
export const getNNSupportCategoryLabel = (pct?: number | null): string => {
  const p = Number(pct);
  if (p === 50) return 'Hộ nghèo (50%)';
  if (p === 40) return 'Hộ cận nghèo (40%)';
  if (p === 30) return 'Dân tộc thiểu số (30%)';
  if (p === 20) return 'Khác (20%)';
  if (p === 10) return 'Khác (10%)';
  if (p === 0) return 'Không hỗ trợ (0%)';
  if (pct != null && !isNaN(p) && p > 0) return `Hỗ trợ ${p}%`;
  return 'Khác (20%)';
};

/**
 * Kiểm tra hồ sơ D05-TS là đối tượng Gia hạn (Đóng_tiếp) hay Tăng mới (Tăng_mới):
 * - Đối tượng tăng mới -> ghi chú: P.Thức Tăng_mới
 * - Đối tượng gia hạn -> ghi chú: P.Thức Đóng_tiếp
 * Hỗ trợ đầy đủ cả camelCase (UI/form) và snake_case (PostgreSQL/Supabase)
 */
export const isD05TSRenew = (r: any): boolean => {
  if (!r) return false;
  if (r.isRenew === true || r.is_renew === true) return true;
  if (r.isRenew === false || r.is_renew === false) return false;

  const actionStr = String(r.action_type || r.actionType || '').trim().toLowerCase();
  const statusStr = String(r.status || '').trim().toLowerCase();
  const subStr = String(r.sub_type || r.subType || '').trim().toLowerCase();
  const noteStr = String(r.notes || '').trim().toLowerCase();
  const methodStr = String(r.method || '').trim().toLowerCase();

  // 1. Nhận diện các từ khóa Gia hạn / Đóng tiếp / Tái tục
  if (
    actionStr.includes('gia hạn') ||
    actionStr.includes('đóng tiếp') ||
    actionStr.includes('tái tục') ||
    actionStr.includes('renew') ||
    statusStr.includes('gia hạn') ||
    statusStr.includes('đóng tiếp') ||
    statusStr.includes('tái tục') ||
    statusStr.includes('renew') ||
    subStr.includes('gia hạn') ||
    subStr.includes('đóng tiếp') ||
    subStr.includes('tái tục') ||
    subStr.includes('renew') ||
    methodStr.includes('đóng tiếp') ||
    methodStr.includes('gia hạn') ||
    methodStr.includes('tái tục') ||
    noteStr.includes('p.thức đóng_tiếp') ||
    noteStr.includes('đóng_tiếp') ||
    noteStr.includes('gia hạn') ||
    noteStr.includes('đóng tiếp') ||
    noteStr.includes('tái tục')
  ) {
    return true;
  }

  // 2. Nhận diện các từ khóa Tăng mới / Đăng ký mới
  if (
    actionStr.includes('tăng mới') ||
    actionStr.includes('đăng ký mới') ||
    actionStr.includes('tham gia mới') ||
    actionStr.includes('cấp mới') ||
    statusStr.includes('tăng mới') ||
    statusStr.includes('đăng ký mới') ||
    statusStr.includes('tham gia mới') ||
    statusStr.includes('mới') ||
    subStr.includes('tăng mới') ||
    subStr.includes('đăng ký mới') ||
    subStr.includes('tham gia mới') ||
    subStr.includes('cấp mới') ||
    methodStr.includes('tăng mới') ||
    noteStr.includes('p.thức tăng_mới') ||
    noteStr.includes('tăng_mới') ||
    noteStr.includes('tăng mới') ||
    noteStr.includes('đăng ký mới')
  ) {
    return false;
  }

  // Mặc định đối với BHXH tự nguyện: nếu không có dấu hiệu gia hạn thì là Tăng mới
  return false;
};

/**
 * Tạo chuỗi thông tin chi tiết cho cột 17 (Ghi chú) mẫu D05-TS chuẩn theo QĐ 490 và thực tế BHXH VN:
 * - Đối tượng tăng mới ghi: P.Thức Tăng_mới
 * - Đối tượng gia hạn ghi: P.Thức Đóng_tiếp
 * - Người kinh ghi: Dân tộc Kinh (20%)
 * - Người dân tộc thiểu số ghi: Dân tộc Thiểu_số (30%)
 * Ví dụ: "Đối tượng Khác, Dân tộc Thiểu_số, P.Thức Đóng_tiếp, SĐT 0961300522, Ngày sinh 30/03/1982, gmail bhxhtn1410@gmail.com"
 */
export const buildD05TSNotes = (
  r: any,
  currentUser?: any,
  nnSupportPct: number = 20
): string => {
  // 1. Phân loại đối tượng chính thức theo QĐ 490: Hộ_nghèo, Hộ_cận_nghèo, Khác
  let doiTuong = 'Đối tượng Khác';
  const supType = r.support_type || r.supportType;
  if (supType) {
    doiTuong = `Đối tượng ${String(supType).trim().replace(/\s+/g, '_')}`;
  } else if (nnSupportPct === 50) {
    doiTuong = 'Đối tượng Hộ_nghèo';
  } else if (nnSupportPct === 40) {
    doiTuong = 'Đối tượng Hộ_cận_nghèo';
  } else {
    doiTuong = 'Đối tượng Khác';
  }

  // 2. Dân tộc: Thiểu_số, Kinh hoặc tên dân tộc cụ thể
  let danToc = 'Dân tộc Kinh';
  const nationStr = String(r.nation || '').trim();
  const nationLower = nationStr.toLowerCase();
  if (
    nationStr === 'Thiểu_số' || 
    nationLower.includes('thiểu số') || 
    nationLower.includes('dân tộc thiểu số') || 
    nationLower.includes('thieu_so') ||
    (nationStr !== '' && nationLower !== 'kinh')
  ) {
    danToc = 'Dân tộc Thiểu_số';
  } else if (nationLower === 'kinh') {
    danToc = 'Dân tộc Kinh';
  } else if (nnSupportPct === 30) {
    danToc = 'Dân tộc Thiểu_số';
  }

  // 3. Phương thức / Phân loại đóng: Tăng_mới cho đối tượng tăng mới, Đóng_tiếp cho đối tượng gia hạn
  const isRenew = isD05TSRenew(r);
  const pThuc = isRenew ? 'Đóng_tiếp' : 'Tăng_mới';
  const pThucStr = `P.Thức ${pThuc}`;

  // 4. Số điện thoại liên hệ
  const phoneVal = r.phone || r.recv_phone || r.recvPhone || '0111111111';
  const sdtStr = `SĐT ${phoneVal}`;

  // 5. Ngày tháng năm sinh (DD/MM/YYYY)
  const dobVal = r.dob || r.birth_date || r.birthDate;
  const dobFormatted = dobVal ? formatDateVN(dobVal) : '';
  const ngaySinhStr = `Ngày sinh ${dobFormatted}`;

  // 6. Gmail / Email liên hệ
  const emailVal = r.email || currentUser?.email || 'bhxhtn1410@gmail.com';
  const gmailStr = `gmail ${emailVal}`;

  const parts = [doiTuong, danToc, pThucStr, sdtStr, ngaySinhStr, gmailStr];

  return parts.join(', ');
};

/**
 * Xuất Mẫu D05-TS: Danh sách người tham gia Bảo hiểm xã hội tự nguyện
 * Chuẩn BHXH Việt Nam (theo Quyết định số 490/QĐ-BHXH ngày 28/03/2023 của BHXH Việt Nam & Luật BHXH 2024)
 */
export const exportD05TSStandardExcel = async ({
  records,
  batchCode,
  agencyName = 'ĐẠI LÝ THU BHXH SÔNG MÃ',
  agencyCode = '8371584967',
  unitName,
  unitCode,
  periodLabel,
  periodText,
  currentUser,
  staffList = []
}: ExportStandardParams) => {
  const finalAgencyName = unitName || currentUser?.agencyName || agencyName;
  const finalAgencyCode = unitCode || currentUser?.agencyCode || agencyCode;
  const finalPeriodLabel = periodText || periodLabel;
  const XLSX = (await import('xlsx-js-style')).default;

  const validRecords = records.filter(r => (r.type ? r.type === 'BHXH' : true) && (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');
  if (validRecords.length === 0) {
    throw new Error('Không có bản ghi hợp lệ để xuất biểu mẫu D05-TS (hồ sơ phải thuộc loại BHXH và chưa bị hủy).');
  }

  const fontMain = 'Times New Roman';
  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  const headerMetaStyle = {
    font: { name: fontMain, sz: 10, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  const headerMetaNormalStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  const formCodeStyle = {
    font: { name: fontMain, sz: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const formSubCodeStyle = {
    font: { name: fontMain, sz: 9, italic: true },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const titleStyle = {
    font: { name: fontMain, sz: 13, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const subTitleStyle = {
    font: { name: fontMain, sz: 11, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // Header nền trắng chữ đen viền mảnh chuẩn biểu mẫu Excel BHXH
  const tableHeaderStyle = {
    font: { name: fontMain, sz: 9, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderThin
  };

  // Dòng ký hiệu cột (A, B, C, 1..17) in nghiêng, căn giữa, nền trắng viền mảnh
  const colCodeStyle = {
    font: { name: fontMain, sz: 9, italic: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const cellTextStyle = {
    font: { name: fontMain, sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: borderThin
  };

  const cellCenterStyle = {
    font: { name: fontMain, sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  // Cột C (Mã số BHXH) chữ ĐỎ nổi bật theo đúng hình ảnh thực tế
  const cellBhxhStyle = {
    font: { name: fontMain, sz: 9, bold: true, color: { rgb: 'FF0000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const cellNumberStyle = {
    font: { name: fontMain, sz: 9, color: { rgb: '000000' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  const totalStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const totalNumberStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  const rows: any[][] = [];
  const nowVN = new Date();

  // Helper format "Tháng M năm YYYY" cho tiêu đề
  const formatMonthYearVN = (period?: string) => {
    if (!period) {
      return `Tháng ${nowVN.getMonth() + 1} năm ${nowVN.getFullYear()}`;
    }
    const match = period.match(/(?:Tháng\s*)?0?(\d{1,2})[/-](\d{4})/i);
    if (match && match[1] && match[2]) {
      return `Tháng ${parseInt(match[1], 10)} năm ${match[2]}`;
    }
    return period;
  };

  // Row 0 (Excel Row 1): Đơn vị thu (Col A) & Mẫu D05-TS (Col J..N)
  const row0 = Array(20).fill(null);
  row0[0] = { v: `Tên đơn vị: ${finalAgencyName}`, s: headerMetaNormalStyle };
  row0[9] = { v: 'Mẫu D05-TS', s: formCodeStyle };
  rows.push(row0);

  // Row 1 (Excel Row 2): Mã đơn vị (MS thuế) (Col A) & QĐ 490 (Col J..N)
  const taxCodeStr = currentUser?.taxCode || currentUser?.taxId ? `${currentUser.taxCode || currentUser.taxId}` : (finalAgencyCode || '');
  const row1 = Array(20).fill(null);
  row1[0] = { v: `Mã đơn vị (MS thuế): ${taxCodeStr}`, s: headerMetaNormalStyle };
  row1[9] = { v: '(Ban hành kèm theo QĐ: 490/QĐ-BHXH ngày 28/03/2023 của BHXH Việt Nam)', s: formSubCodeStyle };
  rows.push(row1);

  // Row 2 (Excel Row 3): Địa chỉ điểm thu (Col A)
  const agencyAddr = currentUser?.address || 'Tổ dân phố 3, xã Sông Mã, tỉnh Sơn La';
  const row2 = Array(20).fill(null);
  row2[0] = { v: `Địa chỉ điểm thu: ${agencyAddr}`, s: headerMetaNormalStyle };
  rows.push(row2);

  // Row 3 (Excel Row 4): Điện thoại (Col A) & Tiêu đề chính (Col E..N)
  const agencyPhone = currentUser?.phone || '0972708321';
  const row3 = Array(20).fill(null);
  row3[0] = { v: `Điện thoại: ${agencyPhone}`, s: headerMetaNormalStyle };
  row3[4] = { v: 'DANH SÁCH NGƯỜI THAM GIA BẢO HIỂM XÃ HỘI TỰ NGUYỆN', s: titleStyle };
  rows.push(row3);

  // Row 4 (Excel Row 5): Tên NV / Đợt thu (Col A) & Tháng năm (Col E..N)
  const staffNameDisplay = currentUser?.displayName || currentUser?.name || 'Nguyễn Thị Ngọc';
  const row5LeftText = batchCode 
    ? `${staffNameDisplay} - ${batchCode}` 
    : (currentUser?.displayName ? `${currentUser.displayName} - ${finalAgencyName}` : `${staffNameDisplay} - Kv Sông MãD05ng09-09-26-8-4`);
  const row4 = Array(20).fill(null);
  row4[0] = { v: row5LeftText, s: headerMetaNormalStyle };
  row4[4] = { v: formatMonthYearVN(finalPeriodLabel), s: subTitleStyle };
  rows.push(row4);

  // Rows 5..8 (Excel Rows 6..9): Dòng trống phân cách trước bảng dữ liệu (để bảng bắt đầu từ Row 10 đúng như ảnh)
  rows.push(Array(20).fill(null));
  rows.push(Array(20).fill(null));
  rows.push(Array(20).fill(null));
  rows.push(Array(20).fill(null));

  // ================= BẢNG BIỂU D05-TS THEO QĐ 490 (20 CỘT: INDEX 0..19) =================
  // Row 9 (Excel Row 10): Header cấp 1
  const hRow1 = Array(20).fill(null).map(() => ({ v: '', s: tableHeaderStyle }));
  hRow1[0] = { v: 'ST\nT', s: tableHeaderStyle };                                    // 0: A
  hRow1[1] = { v: 'Họ và tên', s: tableHeaderStyle };                               // 1: B
  hRow1[2] = { v: 'Mã số BHXH', s: tableHeaderStyle };                              // 2: C
  hRow1[3] = { v: 'CCCD', s: tableHeaderStyle };                                    // 3: 1
  hRow1[4] = { v: 'Địa chỉ', s: tableHeaderStyle };                                 // 4: 2
  hRow1[5] = { v: 'Ngày biên\nlai', s: tableHeaderStyle };                          // 5: 3
  hRow1[6] = { v: 'Số biên\nlai', s: tableHeaderStyle };                            // 6: 4
  hRow1[7] = { v: 'Mức thu\nnhập\ntháng\nBHXH', s: tableHeaderStyle };              // 7: 5
  hRow1[8] = { v: 'Phương thức\nđóng', s: tableHeaderStyle };                       // 8..9: 6..7
  hRow1[10] = { v: 'Số tiền đóng', s: tableHeaderStyle };                           // 10..17: 8..15
  hRow1[18] = { v: 'Mã số nhân\nviên thu', s: tableHeaderStyle };                   // 18: 16
  hRow1[19] = { v: 'Ghi chú', s: tableHeaderStyle };                                // 19: 17
  rows.push(hRow1);

  // Row 10 (Excel Row 11): Header cấp 2
  const hRow2 = Array(20).fill(null).map(() => ({ v: '', s: tableHeaderStyle }));
  hRow2[8] = { v: 'Số\ntháng\nđóng', s: tableHeaderStyle };                         // 8
  hRow2[9] = { v: 'Từ\ntháng/nă\nm', s: tableHeaderStyle };                         // 9
  hRow2[10] = { v: 'Số tiền\nphải đóng\ntheo quy\nđịnh', s: tableHeaderStyle };     // 10
  hRow2[11] = { v: 'Người\ntham gia\nđóng', s: tableHeaderStyle };                  // 11
  hRow2[12] = { v: 'Trong đó', s: tableHeaderStyle };                               // 12..17
  rows.push(hRow2);

  // Row 11 (Excel Row 12): Header cấp 3
  const hRow3 = Array(20).fill(null).map(() => ({ v: '', s: tableHeaderStyle }));
  hRow3[12] = { v: 'NSNN hỗ trợ\ntheo quy định', s: tableHeaderStyle };             // 12..13
  hRow3[14] = { v: 'Hỗ trợ', s: tableHeaderStyle };                                 // 14..17
  rows.push(hRow3);

  // Row 12 (Excel Row 13): Header cấp 4
  const hRow4 = Array(20).fill(null).map(() => ({ v: '', s: tableHeaderStyle }));
  hRow4[14] = { v: 'NSĐP hỗ trợ\nthêm', s: tableHeaderStyle };                      // 14..15
  hRow4[16] = { v: 'Hỗ trợ\nkhác', s: tableHeaderStyle };                          // 16..17
  rows.push(hRow4);

  // Row 13 (Excel Row 14): Header cấp 5 (Tỷ lệ % / Số tiền)
  const hRow5 = Array(20).fill(null).map(() => ({ v: '', s: tableHeaderStyle }));
  hRow5[12] = { v: 'Tỷ lệ\n%', s: tableHeaderStyle };                               // 12
  hRow5[13] = { v: 'Số tiền', s: tableHeaderStyle };                                // 13
  hRow5[14] = { v: 'Tỷ lệ\n%', s: tableHeaderStyle };                               // 14
  hRow5[15] = { v: 'Số tiền', s: tableHeaderStyle };                                // 15
  hRow5[16] = { v: 'Tỷ lệ\n%', s: tableHeaderStyle };                               // 16
  hRow5[17] = { v: 'Số tiền', s: tableHeaderStyle };                                // 17
  rows.push(hRow5);

  // Row 14 (Excel Row 15): Dòng ký hiệu cột chuẩn QĐ 490 (A, B, C, 1..17)
  const subCols = [
    'A', 'B', 'C', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17'
  ];
  rows.push(subCols.map(c => ({ v: c, s: colCodeStyle })));

  // Dữ liệu người tham gia (Bắt đầu trực tiếp từ Excel Row 16, không phân nhóm I, II rườm rà)
  let totalBasePremium = 0;
  let totalAmount = 0;
  let totalNNSupportPct = 0;
  let totalNNSupport = 0;
  let totalDPSupport = 0;
  let totalOtherSupport = 0;

  for (let idx = 0; idx < validRecords.length; idx++) {
    if (idx > 0 && idx % 150 === 0) {
      await yieldToEventLoop();
    }
    const r = validRecords[idx];
    const staff = staffList.find(s => s.id === r.staffId || s.name === r.staffId || s.id === r.staff_id || s.name === r.staff_id);
    const staffCode = r.staffCode || r.staff_code || staff?.staffCode || staff?.staff_code || currentUser?.staffCode || currentUser?.staff_code || (r.staffId && String(r.staffId).startsWith('NV') ? r.staffId : (r.staff_id && String(r.staff_id).startsWith('NV') ? r.staff_id : 'NV014184005160'));
    const oldBhxh = getOldBhxh10(r, records);
    const months = Number(r.months) || 1;
    const income = Number(r.income) || (Number(r.wage) || 1500000);
    
    // Tỷ lệ hỗ trợ NSNN theo Luật BHXH 2024: 50% (nghèo), 40% (cận nghèo), 30% (DTTS), 20% (người Kinh/khác)
    const nationStr = String(r.nation || '').trim().toLowerCase();
    const isMinority = nationStr === 'thiểu_số' || 
                       nationStr === 'thieu_so' || 
                       nationStr.includes('thiểu số') || 
                       nationStr.includes('thieu_so') || 
                       nationStr.includes('dân tộc') || 
                       (nationStr !== '' && nationStr !== 'kinh');

    let nnSupportPct: number;
    const rawExplicitPct = r.nn_support_pct != null 
      ? Number(r.nn_support_pct) 
      : (r.nnSupportPct != null 
          ? Number(r.nnSupportPct) 
          : (r.support_pct != null 
              ? Number(r.support_pct) 
              : (r.supportPct != null ? Number(r.supportPct) : null)));

    if (rawExplicitPct != null) {
      if (rawExplicitPct === 50 || rawExplicitPct === 40) {
        nnSupportPct = rawExplicitPct; // Hộ nghèo (50%) hoặc Hộ cận nghèo (40%)
      } else if (isMinority) {
        // Dân tộc thiểu số luôn được hỗ trợ 30% theo Luật BHXH 2024
        nnSupportPct = Math.max(rawExplicitPct, 30);
      } else {
        nnSupportPct = rawExplicitPct;
      }
    } else {
      // Mặc định: Dân tộc thiểu số là 30%, người Kinh là 20%
      nnSupportPct = isMinority ? 30 : 20;
    }

    const povertyStandard = Number(r.povertyStandardSnapshot) || Number(r.poverty_standard_snapshot) || 1500000;
    const calcNNSupport = Math.round((povertyStandard * 0.22 * (nnSupportPct / 100)) * months);
    const recNNSupport = (r.nn_support_amount != null && rawExplicitPct === nnSupportPct)
      ? Number(r.nn_support_amount)
      : (r.nnSupportAmount != null && rawExplicitPct === nnSupportPct
          ? Number(r.nnSupportAmount)
          : calcNNSupport);
    
    const dpSupportPct = Number(r.dp_support_pct) || Number(r.dpSupportPct) || 0;
    const dpSupportAmount = Number(r.dp_support_amount) || Number(r.dpSupportAmount) || 0;
    const otherSupportPct = Number(r.other_support_pct) || Number(r.otherSupportPct) || 0;
    const otherSupportAmount = Number(r.other_support_amount) || Number(r.otherSupportAmount) || 0;

    const basePrem = Number(r.base_premium) || Number(r.basePremium) || Math.round(income * 0.22 * months);

    // Số tiền người tham gia đóng: bảo đảm cân đối Cột 8 = Cột 9 + Cột 11 + Cột 13 + Cột 15
    const rawAmount = Number(r.amount) || 0;
    const expectedParticipantAmount = Math.max(0, basePrem - recNNSupport - dpSupportAmount - otherSupportAmount);
    const amount = (rawAmount > 0 && Math.abs(rawAmount - expectedParticipantAmount) <= 100)
      ? rawAmount
      : (rawAmount > 0 ? rawAmount : expectedParticipantAmount);

    totalBasePremium += basePrem;
    totalAmount += amount;
    totalNNSupportPct += nnSupportPct;
    totalNNSupport += recNNSupport;
    totalDPSupport += dpSupportAmount;
    totalOtherSupport += otherSupportAmount;

    // Số biên lai: nếu không có thì để rỗng ""
    const receiptNum = r.receipt_number || r.receiptNumber || r.receipt_code || r.receiptCode || '';
    const receiptDate = r.receipt_date 
      ? formatDateVN(r.receipt_date) 
      : (r.receiptDate 
          ? formatDateVN(r.receiptDate) 
          : (receiptNum && r.date ? formatDateVN(r.date) : ''));

    // Từ tháng/năm: đọc đầy đủ from_month, fromMonth, from_month_date, date
    const fromMonthVal = r.from_month || r.fromMonth || r.from_month_date || r.fromMonthDate || r.date;
    const fromMonthFormatted = formatMonthVN(fromMonthVal);

    // Tạo chuỗi Ghi chú đầy đủ giống hình ảnh thực tế
    const notesStr = buildD05TSNotes(r, currentUser, nnSupportPct);

    // Đồng bộ mã số BHXH theo số CCCD theo Đề án 06
    const cccd = String(r.cccd || r.citizen_id || (r as any).citizenId || '').trim();
    const bhxhCode = cccd || String(r.bhxh || oldBhxh || '').trim();

    rows.push([
      { v: idx + 1, s: cellCenterStyle },                                              // A: STT
      { v: r.name || r.full_name || (r as any).fullName || '', s: cellTextStyle },    // B: Họ và tên
      { v: bhxhCode, s: cellBhxhStyle, t: 's' },                                       // C: Mã số BHXH (Đồng bộ theo số CCCD - Màu đỏ)
      { v: cccd, s: cellCenterStyle, t: 's' },                                         // 1: CCCD
      { v: r.address || '', s: cellTextStyle },                                        // 2: Địa chỉ
      { v: receiptDate, s: cellCenterStyle },                                          // 3: Ngày biên lai
      { v: receiptNum, s: cellCenterStyle },                                           // 4: Số biên lai
      { v: income, s: cellNumberStyle },                                               // 5: Mức thu nhập tháng BHXH
      { v: months, s: cellCenterStyle },                                               // 6: Số tháng đóng
      { v: fromMonthFormatted, s: cellCenterStyle },                                   // 7: Từ tháng/năm
      { v: basePrem, s: cellNumberStyle },                                             // 8: Số tiền phải đóng theo quy định
      { v: amount, s: cellNumberStyle },                                               // 9: Người tham gia đóng
      { v: nnSupportPct, s: cellCenterStyle },                                         // 10: Tỷ lệ % NSNN
      { v: recNNSupport, s: cellNumberStyle },                                         // 11: Số tiền NSNN
      { v: dpSupportPct > 0 ? dpSupportPct : '', s: cellCenterStyle },                 // 12: Tỷ lệ % NSĐP
      { v: dpSupportAmount > 0 ? dpSupportAmount : '', s: cellNumberStyle },           // 13: Số tiền NSĐP
      { v: otherSupportPct > 0 ? otherSupportPct : '', s: cellCenterStyle },           // 14: Tỷ lệ % Khác
      { v: otherSupportAmount > 0 ? otherSupportAmount : '', s: cellNumberStyle },     // 15: Số tiền Khác
      { v: staffCode, s: cellCenterStyle },                                            // 16: Mã số NV thu
      { v: notesStr, s: cellTextStyle }                                                // 17: Ghi chú
    ]);
  }

  // Hàng TỔNG CỘNG: Col 0..9 merged, Col 10..19 các cột số
  const rowTotal: Array<{ v: string | number; s: any }> = Array(20).fill(null).map(() => ({ v: '', s: totalStyle }));
  rowTotal[0] = { v: 'TỔNG CỘNG', s: totalStyle };
  rowTotal[10] = { v: totalBasePremium, s: totalNumberStyle };
  rowTotal[11] = { v: totalAmount, s: totalNumberStyle };
  rowTotal[13] = { v: totalNNSupport, s: totalNumberStyle };
  if (totalDPSupport > 0) {
    rowTotal[15] = { v: totalDPSupport, s: totalNumberStyle };
  }
  if (totalOtherSupport > 0) {
    rowTotal[17] = { v: totalOtherSupport, s: totalNumberStyle };
  }
  rows.push(rowTotal);

  // Ghi chú dưới bảng theo mẫu QĐ 490
  const soDeNghiCap = validRecords.filter(r => !isD05TSRenew(r)).length;
  rows.push(Array(20).fill(null));
  
  const rowSoDeNghiCap = Array(20).fill(null);
  rowSoDeNghiCap[0] = { v: `Tổng số sổ BHXH đề nghị cấp: ${soDeNghiCap > 0 ? soDeNghiCap : '0'} sổ.`, s: { font: { name: fontMain, sz: 10, bold: true, italic: true } } };
  rows.push(rowSoDeNghiCap);

  const rowGhiChu = Array(20).fill(null);
  rowGhiChu[0] = { v: '- Ghi chú: Cột 16 chỉ áp dụng đối với tổ chức dịch vụ thu BHXH tự nguyện BHYT.', s: { font: { name: fontMain, sz: 9, italic: true } } };
  rows.push(rowGhiChu);

  // Dòng trống trước phần chữ ký
  rows.push(Array(20).fill(null));

  // Row Ngày tháng năm
  const rowNgayKyData = Array(20).fill(null);
  rowNgayKyData[16] = {
    v: `Ngày ${nowVN.getDate()} tháng ${nowVN.getMonth() + 1} năm ${nowVN.getFullYear()}`,
    s: { font: { name: fontMain, sz: 10, italic: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rows.push(rowNgayKyData);

  // Row Chức danh ký
  const rowKyData = Array(20).fill(null);
  rowKyData[1] = {
    v: 'NGƯỜI LẬP BIỂU',
    s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rowKyData[7] = {
    v: 'CÁN BỘ THU TIỀN',
    s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rowKyData[16] = {
    v: 'TỔ CHỨC DỊCH VỤ THU',
    s: { font: { name: fontMain, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rows.push(rowKyData);

  // Row Ghi chú ký
  const rowKyChuData = Array(20).fill(null);
  rowKyChuData[1] = {
    v: '(Ký, ghi rõ họ tên)',
    s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rowKyChuData[7] = {
    v: '(Ký, ghi rõ họ tên)',
    s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rowKyChuData[16] = {
    v: '(Ký, ghi rõ họ tên, đóng dấu)',
    s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rows.push(rowKyChuData);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const N = validRecords.length;
  const rowTongCongIdx = 15 + N;
  const rowDeNghiCapIdx = rowTongCongIdx + 2;
  const rowGhiChu16Idx = rowTongCongIdx + 3;
  const rowNgayKyIdx = rowTongCongIdx + 5;
  const rowKyIdx = rowTongCongIdx + 6;
  const rowKyChuIdx = rowTongCongIdx + 7;

  ws['!merges'] = [
    // Header Meta Rows 1..5
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },    // Row 1: Tên đơn vị (A..I)
    { s: { r: 0, c: 9 }, e: { r: 0, c: 13 } },   // Row 1: Mẫu D05-TS (J..N)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },    // Row 2: Mã đơn vị (A..I)
    { s: { r: 1, c: 9 }, e: { r: 1, c: 13 } },   // Row 2: QĐ 490 (J..N)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },    // Row 3: Địa chỉ (A..I)
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },    // Row 4: SĐT (A..D)
    { s: { r: 3, c: 4 }, e: { r: 3, c: 13 } },   // Row 4: Tiêu đề danh sách (E..N)
    { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },    // Row 5: Tên NV / Đợt thu (A..D)
    { s: { r: 4, c: 4 }, e: { r: 4, c: 13 } },   // Row 5: Tháng năm (E..N)

    // Table Header Merges (Rows 10..14: r: 9..13)
    { s: { r: 9, c: 0 }, e: { r: 13, c: 0 } },   // STT (Col 0)
    { s: { r: 9, c: 1 }, e: { r: 13, c: 1 } },   // Họ và tên (Col 1)
    { s: { r: 9, c: 2 }, e: { r: 13, c: 2 } },   // Mã số BHXH (Col 2)
    { s: { r: 9, c: 3 }, e: { r: 13, c: 3 } },   // CCCD (Col 3)
    { s: { r: 9, c: 4 }, e: { r: 13, c: 4 } },   // Địa chỉ (Col 4)
    { s: { r: 9, c: 5 }, e: { r: 13, c: 5 } },   // Ngày biên lai (Col 5)
    { s: { r: 9, c: 6 }, e: { r: 13, c: 6 } },   // Số biên lai (Col 6)
    { s: { r: 9, c: 7 }, e: { r: 13, c: 7 } },   // Mức thu nhập tháng BHXH (Col 7)

    // Phương thức đóng (Col 8..9)
    { s: { r: 9, c: 8 }, e: { r: 9, c: 9 } },    // Phương thức đóng (Row 10: r: 9)
    { s: { r: 10, c: 8 }, e: { r: 13, c: 8 } },  // Số tháng đóng (Col 8)
    { s: { r: 10, c: 9 }, e: { r: 13, c: 9 } },  // Từ tháng/năm (Col 9)

    // Số tiền đóng (Col 10..17)
    { s: { r: 9, c: 10 }, e: { r: 9, c: 17 } },  // Số tiền đóng (Row 10: r: 9)
    { s: { r: 10, c: 10 }, e: { r: 13, c: 10 } },// Số tiền phải đóng quy định (Col 10)
    { s: { r: 10, c: 11 }, e: { r: 13, c: 11 } },// Người tham gia đóng (Col 11)
    { s: { r: 10, c: 12 }, e: { r: 10, c: 17 } },// Trong đó (Row 11: r: 10)
    { s: { r: 11, c: 12 }, e: { r: 12, c: 13 } },// NSNN hỗ trợ theo quy định (Row 12..13: r: 11..12, Col 12..13)
    { s: { r: 11, c: 14 }, e: { r: 11, c: 17 } },// Hỗ trợ (Row 12: r: 11, Col 14..17)
    { s: { r: 12, c: 14 }, e: { r: 12, c: 15 } },// NSĐP hỗ trợ thêm (Row 13: r: 12, Col 14..15)
    { s: { r: 12, c: 16 }, e: { r: 12, c: 17 } },// Hỗ trợ khác (Row 13: r: 12, Col 16..17)

    { s: { r: 9, c: 18 }, e: { r: 13, c: 18 } }, // Mã số nhân viên thu (Col 18)
    { s: { r: 9, c: 19 }, e: { r: 13, c: 19 } }, // Ghi chú (Col 19)

    // Hàng TỔNG CỘNG: Từ cột A (c: 0) đến cột J (c: 9)
    { s: { r: rowTongCongIdx, c: 0 }, e: { r: rowTongCongIdx, c: 9 } },

    // Bottom notes & signatures
    { s: { r: rowDeNghiCapIdx, c: 0 }, e: { r: rowDeNghiCapIdx, c: 11 } },
    { s: { r: rowGhiChu16Idx, c: 0 }, e: { r: rowGhiChu16Idx, c: 11 } },
    { s: { r: rowNgayKyIdx, c: 16 }, e: { r: rowNgayKyIdx, c: 19 } },
    { s: { r: rowKyIdx, c: 1 }, e: { r: rowKyIdx, c: 3 } },
    { s: { r: rowKyIdx, c: 7 }, e: { r: rowKyIdx, c: 9 } },
    { s: { r: rowKyIdx, c: 16 }, e: { r: rowKyIdx, c: 19 } },
    { s: { r: rowKyChuIdx, c: 1 }, e: { r: rowKyChuIdx, c: 3 } },
    { s: { r: rowKyChuIdx, c: 7 }, e: { r: rowKyChuIdx, c: 9 } },
    { s: { r: rowKyChuIdx, c: 16 }, e: { r: rowKyChuIdx, c: 19 } }
  ];

  // Chiều rộng cột căn chỉnh tối ưu cho khổ giấy A4 Ngang
  ws['!cols'] = [
    { wch: 4.5 }, // A: STT
    { wch: 19 },  // B: Họ và tên
    { wch: 13 },  // C: Mã số BHXH
    { wch: 14 },  // 1: CCCD
    { wch: 24 },  // 2: Địa chỉ
    { wch: 10 },  // 3: Ngày biên lai
    { wch: 10 },  // 4: Số biên lai
    { wch: 12 },  // 5: Mức thu nhập tháng BHXH
    { wch: 7 },   // 6: Số tháng đóng
    { wch: 9 },   // 7: Từ tháng/năm
    { wch: 12 },  // 8: Số tiền phải đóng theo quy định
    { wch: 12 },  // 9: Người tham gia đóng
    { wch: 6 },   // 10: Tỷ lệ % NSNN hỗ trợ
    { wch: 11 },  // 11: Số tiền NSNN hỗ trợ
    { wch: 6 },   // 12: Tỷ lệ % NSĐP hỗ trợ
    { wch: 10 },  // 13: Số tiền NSĐP hỗ trợ
    { wch: 6 },   // 14: Tỷ lệ % Hỗ trợ khác
    { wch: 10 },  // 15: Số tiền Hỗ trợ khác
    { wch: 15 },  // 16: Mã số nhân viên thu
    { wch: 45 }   // 17: Ghi chú đầy đủ
  ];

  // Cấu hình Page Setup vừa vặn khổ giấy A4 Ngang (Landscape)
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 9,         // A4 (210 x 297 mm)
    fitToWidth: 1,        // Ép toàn bộ cột vừa 1 trang A4 ngang
    fitToHeight: 0,       // Để chiều dọc cuộn tự nhiên theo số trang thực tế
    scale: 100
  };

  ws['!sheetPr'] = {
    pageSetUpPr: {
      fitToPage: true
    }
  };

  // Căn lề hẹp tối ưu diện tích in ấn bảng biểu nhiều cột
  ws['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.35,
    bottom: 0.35,
    header: 0.2,
    footer: 0.2
  };

  protectWorksheetFormulas(ws);

  const wb = XLSX.utils.book_new();
  // Sheet tab name chuẩn "D05" theo đúng mẫu ảnh thực tế
  XLSX.utils.book_append_sheet(wb, ws, 'D05');

  const fileName = `Mau_D05_TS_${batchCode || 'BHXH'}_${getLocalYYYYMMDD()}.xlsx`;
  if (typeof window !== 'undefined' || process.env.NODE_ENV !== 'test') {
    XLSX.writeFile(wb, fileName);
  }

  // Ghi nhật ký kiểm toán xuất báo cáo danh bạ Excel D05-TS
  logExportExcelAudit('D05', validRecords.length, currentUser, batchCode ? `Đợt: ${batchCode}` : undefined);

  return { fileName, count: validRecords.length, totalAmount, workbook: wb, worksheet: ws };
};

// Aliases for standard reports
export const exportD03Excel = exportD03TSStandardExcel;
export const exportD05Excel = exportD05TSStandardExcel;

