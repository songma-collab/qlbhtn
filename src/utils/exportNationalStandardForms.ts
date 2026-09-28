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

  const validRecords = records.filter(r => (r.type ? r.type === 'BHYT' : true) && r.paymentStatus !== 'Đã hủy');
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

  validRecords.forEach((r, idx) => {
    const staffName = staffList.find(s => s.id === r.staffId)?.name || r.staffId || 'Đại lý';
    const oldBhxh = getOldBhxh10(r, records);
    const amount = Number(r.amount) || 0;
    totalAmount += amount;

    // Phân tích thứ tự thành viên trong hộ gia đình nếu có
    const orderInHousehold = r.subType || (r.members && r.members.length > 1 ? `Hộ ${r.members.length} người` : 'Người thứ 1');
    const baseStandardRate = 2530000 * 0.045; // 4.5% mức lương cơ sở

    rows.push([
      { v: idx + 1, s: cellCenterStyle },
      { v: r.name || '', s: cellTextStyle },
      { v: oldBhxh || r.bhxh || '', s: cellCenterStyle },
      { v: r.cccd || '', s: cellCenterStyle },
      { v: formatDateVN(r.dob), s: cellCenterStyle },
      { v: r.gender || '', s: cellCenterStyle },
      { v: r.address || '', s: cellTextStyle },
      { v: r.notes?.includes('KCB:') ? r.notes.split('KCB:')[1].trim() : 'Theo tuyến quy định', s: cellTextStyle },
      { v: orderInHousehold, s: cellCenterStyle },
      { v: Math.round(baseStandardRate), s: cellNumberStyle },
      { v: r.supportPct ? `${r.supportPct}%` : '100%', s: cellCenterStyle },
      { v: amount, s: cellNumberStyle },
      { v: Number(r.months) || 12, s: cellCenterStyle },
      { v: formatMonthVN(r.fromMonth), s: cellCenterStyle },
      { v: formatMonthVN(r.toMonth), s: cellCenterStyle },
      { v: formatDateVN(r.date), s: cellCenterStyle },
      { v: r.id ? `BL-${r.id}` : '', s: cellCenterStyle },
      { v: r.submissionBatch || batchCode || 'Chưa gắn đợt', s: cellCenterStyle },
      { v: staffName, s: cellTextStyle },
      { v: r.notes || '', s: cellTextStyle }
    ]);
  });

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
 */
export const isD05TSRenew = (r: any): boolean => {
  if (r.isRenew === true) return true;
  if (r.isRenew === false) return false;

  const actionStr = String(r.actionType || '').trim().toLowerCase();
  const subStr = String(r.subType || '').trim().toLowerCase();
  const noteStr = String(r.notes || '').trim().toLowerCase();
  const methodStr = String(r.method || '').trim().toLowerCase();

  // 1. Nhận diện các từ khóa Gia hạn / Đóng tiếp / Tái tục
  if (
    actionStr.includes('gia hạn') ||
    actionStr.includes('đóng tiếp') ||
    actionStr.includes('tái tục') ||
    actionStr.includes('renew') ||
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
    actionStr.includes('mới') ||
    subStr.includes('tăng mới') ||
    subStr.includes('đăng ký mới') ||
    subStr.includes('tham gia mới') ||
    subStr.includes('cấp mới') ||
    subStr.includes('mới') ||
    methodStr.includes('tăng mới') ||
    methodStr.includes('mới') ||
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
 * Ví dụ: "Đối tượng Khác, Dân tộc Thiểu_số, P.Thức Tăng_mới, SĐT 0961300522, Ngày sinh 30/03/1982, gmail bhxhtn1410@gmail.com, Ghi chú: Khách của chị Trang"
 */
export const buildD05TSNotes = (
  r: any,
  currentUser?: any,
  nnSupportPct: number = 20
): string => {
  // 1. Phân loại đối tượng chính thức theo QĐ 490: Hộ_nghèo, Hộ_cận_nghèo, Khác
  let doiTuong = 'Đối tượng Khác';
  if (r.supportType) {
    doiTuong = `Đối tượng ${String(r.supportType).trim().replace(/\s+/g, '_')}`;
  } else if (nnSupportPct === 50) {
    doiTuong = 'Đối tượng Hộ_nghèo';
  } else if (nnSupportPct === 40) {
    doiTuong = 'Đối tượng Hộ_cận_nghèo';
  } else {
    doiTuong = 'Đối tượng Khác';
  }

  // 2. Dân tộc: Thiểu_số, Kinh hoặc tên dân tộc cụ thể
  let danToc = 'Dân tộc Kinh';
  if (r.nation) {
    const n = String(r.nation).trim();
    if (n === 'Thiểu_số' || n.toLowerCase().includes('thiểu số') || n.toLowerCase().includes('dân tộc thiểu số')) {
      danToc = 'Dân tộc Thiểu_số';
    } else if (n === 'Kinh') {
      danToc = 'Dân tộc Kinh';
    } else {
      danToc = `Dân tộc ${n.replace(/\s+/g, '_')}`;
    }
  } else if (nnSupportPct === 30) {
    danToc = 'Dân tộc Thiểu_số';
  }

  // 3. Phương thức / Phân loại đóng: Tăng_mới cho đối tượng tăng mới, Đóng_tiếp cho đối tượng gia hạn
  const isRenew = isD05TSRenew(r);
  const pThuc = isRenew ? 'Đóng_tiếp' : 'Tăng_mới';
  const pThucStr = `P.Thức ${pThuc}`;

  // 4. Số điện thoại liên hệ
  const sdtStr = `SĐT ${r.phone || '0111111111'}`;

  // 5. Ngày tháng năm sinh (DD/MM/YYYY)
  const dobFormatted = r.dob ? formatDateVN(r.dob) : '';
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

  const validRecords = records.filter(r => (r.type ? r.type === 'BHXH' : true) && r.paymentStatus !== 'Đã hủy');
  if (validRecords.length === 0) {
    throw new Error('Không có bản ghi hợp lệ để xuất biểu mẫu D05-TS (hồ sơ phải thuộc loại BHXH và chưa bị hủy).');
  }

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

  const headerMetaNormalStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  const formCodeStyle = {
    font: { name: fontMain, sz: 11, bold: true },
    alignment: { horizontal: 'right', vertical: 'center' }
  };

  const formSubCodeStyle = {
    font: { name: fontMain, sz: 9, italic: true },
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

  // Header xanh đậm chuẩn BHXH đồng nhất trên tất cả 4 cấp độ header
  const tableHeaderStyle = {
    font: { name: fontMain, sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderThin
  };

  const colCodeStyle = {
    font: { name: fontMain, sz: 9, bold: true, italic: true, color: { rgb: '0F172A' } },
    fill: { fgColor: { rgb: 'E2E8F0' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const groupHeaderStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const groupHeaderCenterStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const subGroupHeaderStyle = {
    font: { name: fontMain, sz: 9, bold: true, italic: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin
  };

  const subGroupHeaderCenterStyle = {
    font: { name: fontMain, sz: 9, bold: true, italic: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const cellTextStyle = {
    font: { name: fontMain, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
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

  const totalBlueStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const totalBlueNumberStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  const grandTotalStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '991B1B' } },
    fill: { fgColor: { rgb: 'FEE2E2' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin
  };

  const grandTotalNumberStyle = {
    font: { name: fontMain, sz: 10, bold: true, color: { rgb: '991B1B' } },
    fill: { fgColor: { rgb: 'FEE2E2' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: borderThin,
    numFmt: '#,##0'
  };

  const rows: any[][] = [];

  // Row 0 (Excel 1): Đơn vị thu & Mẫu D05-TS
  const row0 = Array(20).fill(null);
  row0[0] = { v: `Tên đơn vị/Điểm thu: ${finalAgencyName}`, s: headerMetaStyle };
  row0[19] = { v: 'Mẫu D05-TS', s: formCodeStyle };
  rows.push(row0);

  // Row 1 (Excel 2): Mã đơn vị + MST & QĐ 490
  const taxCodeStr = currentUser?.taxCode || currentUser?.taxId ? `         MS thuế: ${currentUser.taxCode || currentUser.taxId}` : '';
  const row1 = Array(20).fill(null);
  row1[0] = { v: `Mã đơn vị/Điểm thu: ${finalAgencyCode}${taxCodeStr}`, s: headerMetaNormalStyle };
  row1[19] = { v: '(Ban hành kèm theo QĐ: 490/QĐ-BHXH ngày 28/03/2023 của BHXH Việt Nam)', s: formSubCodeStyle };
  rows.push(row1);

  // Row 2 (Excel 3): Địa chỉ
  const agencyAddr = currentUser?.address || 'Huyện Sông Mã, Tỉnh Sơn La';
  const row2 = Array(20).fill(null);
  row2[0] = { v: `Địa chỉ: ${agencyAddr}`, s: headerMetaNormalStyle };
  rows.push(row2);

  // Row 3 (Excel 4): SĐT và Email
  const agencyPhone = currentUser?.phone || '0912345678';
  const agencyEmail = currentUser?.email || 'bhxhtn1410@gmail.com';
  const row3 = Array(20).fill(null);
  row3[0] = { v: `Điện thoại: ${agencyPhone}    Email: ${agencyEmail}`, s: headerMetaNormalStyle };
  rows.push(row3);

  // Row 4 (Excel 5): Trống
  rows.push(Array(20).fill(null));

  // Row 5 (Excel 6): Tiêu đề
  const nowVN = new Date();
  const row5 = Array(20).fill(null);
  row5[0] = { v: 'DANH SÁCH NGƯỜI THAM GIA BẢO HIỂM XÃ HỘI TỰ NGUYỆN', s: titleStyle };
  rows.push(row5);

  // Row 6 (Excel 7): Đợt nộp & kỳ kê khai
  const displayBatch = batchCode || 'Tất cả';
  const displayPeriod = finalPeriodLabel || `Đợt_${nowVN.getFullYear()}${String(nowVN.getMonth() + 1).padStart(2, '0')}${String(nowVN.getDate()).padStart(2, '0')}_01`;
  const row6 = Array(20).fill(null);
  row6[0] = { v: `Đợt nộp: ${displayBatch} | Kỳ kê khai: ${displayPeriod}`, s: subTitleStyle };
  rows.push(row6);

  // Row 7 (Excel 8): Trống
  rows.push(Array(20).fill(null));

  // ================= BẢNG BIỂU D05-TS THEO QĐ 490 (20 CỘT: INDEX 0..19) =================
  // Row 8 (Excel 9): Header cấp 1
  rows.push([
    { v: 'STT', s: tableHeaderStyle },                                      // 0: A
    { v: 'Họ và tên', s: tableHeaderStyle },                                 // 1: B
    { v: 'Mã số BHXH', s: tableHeaderStyle },                                // 2: C
    { v: 'Số\nCCCD/CNTD/ĐD\nCN/hộ chiếu', s: tableHeaderStyle },            // 3: 1
    { v: 'Địa chỉ', s: tableHeaderStyle },                                   // 4: 2
    { v: 'Ngày biên lai', s: tableHeaderStyle },                             // 5: 3
    { v: 'Số biên lai', s: tableHeaderStyle },                               // 6: 4
    { v: 'Mức thu\nnhập tháng\nđóng BHXH', s: tableHeaderStyle },            // 7: 5
    { v: 'Phương thức\nđóng', s: tableHeaderStyle },                         // 8: 6
    { v: '', s: tableHeaderStyle },                                          // 9: 7
    { v: 'Số tiền đóng', s: tableHeaderStyle },                              // 10: 8
    { v: '', s: tableHeaderStyle },                                          // 11: 9
    { v: '', s: tableHeaderStyle },                                          // 12: 10
    { v: '', s: tableHeaderStyle },                                          // 13: 11
    { v: '', s: tableHeaderStyle },                                          // 14: 12
    { v: '', s: tableHeaderStyle },                                          // 15: 13
    { v: '', s: tableHeaderStyle },                                          // 16: 14
    { v: '', s: tableHeaderStyle },                                          // 17: 15
    { v: 'Mã số nhân viên\nthu', s: tableHeaderStyle },                      // 18: 16
    { v: 'Ghi chú', s: tableHeaderStyle }                                    // 19: 17
  ]);

  // Row 9 (Excel 10): Header cấp 2
  rows.push([
    { v: '', s: tableHeaderStyle },                                          // 0
    { v: '', s: tableHeaderStyle },                                          // 1
    { v: '', s: tableHeaderStyle },                                          // 2
    { v: '', s: tableHeaderStyle },                                          // 3
    { v: '', s: tableHeaderStyle },                                          // 4
    { v: '', s: tableHeaderStyle },                                          // 5
    { v: '', s: tableHeaderStyle },                                          // 6
    { v: '', s: tableHeaderStyle },                                          // 7
    { v: 'Số\ntháng\nđóng', s: tableHeaderStyle },                           // 8
    { v: 'Từ\ntháng/năm', s: tableHeaderStyle },                             // 9
    { v: 'Số tiền phải đóng\ntheo quy định', s: tableHeaderStyle },          // 10
    { v: 'Người tham gia\nđóng', s: tableHeaderStyle },                      // 11
    { v: 'Trong đó', s: tableHeaderStyle },                                  // 12..17
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },                                          // 18
    { v: '', s: tableHeaderStyle }                                           // 19
  ]);

  // Row 10 (Excel 11): Header cấp 3 (Nhóm hỗ trợ)
  rows.push([
    { v: '', s: tableHeaderStyle },                                          // 0..11
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: 'NSNN hỗ trợ theo quy\nđịnh', s: tableHeaderStyle },                // 12..13
    { v: '', s: tableHeaderStyle },
    { v: 'NSĐP hỗ trợ thêm', s: tableHeaderStyle },                          // 14..15
    { v: '', s: tableHeaderStyle },
    { v: 'Hỗ trợ khác', s: tableHeaderStyle },                               // 16..17
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },                                          // 18
    { v: '', s: tableHeaderStyle }                                           // 19
  ]);

  // Row 11 (Excel 12): Header cấp 4 (Tỷ lệ % / Số tiền)
  rows.push([
    { v: '', s: tableHeaderStyle },                                          // 0..11
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: '', s: tableHeaderStyle },
    { v: 'Tỷ lệ %\nđược hỗ\ntrợ', s: tableHeaderStyle },                     // 12 (10)
    { v: 'Số tiền', s: tableHeaderStyle },                                   // 13 (11)
    { v: 'Tỷ lệ %\nđược hỗ\ntrợ', s: tableHeaderStyle },                     // 14 (12)
    { v: 'Số tiền', s: tableHeaderStyle },                                   // 15 (13)
    { v: 'Tỷ lệ %\nđược hỗ\ntrợ', s: tableHeaderStyle },                     // 16 (14)
    { v: 'Số tiền', s: tableHeaderStyle },                                   // 17 (15)
    { v: '', s: tableHeaderStyle },                                          // 18 (16)
    { v: '', s: tableHeaderStyle }                                           // 19 (17)
  ]);

  // Row 12 (Excel 13): Ký hiệu cột chuẩn QĐ 490
  const subCols = [
    'A', 'B', 'C', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17'
  ];
  rows.push(subCols.map(c => ({ v: c, s: colCodeStyle })));

  // Row 13 (Excel 14): Phân nhóm I. Tăng
  rows.push([
    { v: 'I', s: groupHeaderCenterStyle },
    { v: 'Tăng', s: groupHeaderStyle },
    ...Array(18).fill({ v: '', s: groupHeaderStyle })
  ]);

  // Row 14 (Excel 15): Phân nhóm con I.1. Người tham gia
  rows.push([
    { v: 'I.1', s: subGroupHeaderCenterStyle },
    { v: 'Người tham gia', s: subGroupHeaderStyle },
    ...Array(18).fill({ v: '', s: subGroupHeaderStyle })
  ]);

  // Dữ liệu người tham gia
  let totalBasePremium = 0;
  let totalAmount = 0;
  let totalNNSupportPct = 0;
  let totalNNSupport = 0;
  let totalDPSupport = 0;
  let totalOtherSupport = 0;

  validRecords.forEach((r, idx) => {
    const staff = staffList.find(s => s.id === r.staffId || s.name === r.staffId);
    const staffCode = r.staffCode || staff?.staffCode || currentUser?.staffCode || (r.staffId && String(r.staffId).startsWith('NV') ? r.staffId : 'NV014184005160');
    const oldBhxh = getOldBhxh10(r, records);
    const amount = Number(r.amount) || 0;
    const months = Number(r.months) || 1;
    const income = Number(r.income) || (Number(r.wage) || 1500000);
    
    // Tỷ lệ hỗ trợ NSNN theo Luật BHXH 2024: 50% (nghèo), 40% (cận nghèo), 30% (DTTS), 20% (khác)
    const nnSupportPct = r.nnSupportPct != null ? Number(r.nnSupportPct) : (r.supportPct != null ? Number(r.supportPct) : 20);
    const povertyStandard = Number(r.povertyStandardSnapshot) || 1500000;
    const calcNNSupport = Math.round((povertyStandard * 0.22 * (nnSupportPct / 100)) * months);
    const recNNSupport = r.nnSupportAmount != null ? Number(r.nnSupportAmount) : calcNNSupport;
    
    const dpSupportPct = Number(r.dpSupportPct) || 0;
    const dpSupportAmount = Number(r.dpSupportAmount) || 0;
    const otherSupportPct = Number(r.otherSupportPct) || 0;
    const otherSupportAmount = Number(r.otherSupportAmount) || 0;

    const basePrem = Number(r.basePremium) || Math.round(income * 0.22 * months);

    totalBasePremium += basePrem;
    totalAmount += amount;
    totalNNSupportPct += nnSupportPct;
    totalNNSupport += recNNSupport;
    totalDPSupport += dpSupportAmount;
    totalOtherSupport += otherSupportAmount;

    // Số biên lai: nếu không có thì để rỗng ""
    const receiptNum = r.receiptNumber || r.receiptCode || '';
    const receiptDate = r.date ? formatDateVN(r.date) : formatDateVN(getLocalYYYYMMDD());

    // Tạo chuỗi Ghi chú đầy đủ giống hình ảnh thực tế
    const notesStr = buildD05TSNotes(r, currentUser, nnSupportPct);

    rows.push([
      { v: idx + 1, s: cellCenterStyle },                                              // A: STT
      { v: r.name || '', s: cellTextStyle },                                           // B: Họ và tên
      { v: oldBhxh || r.bhxh || '', s: cellCenterStyle },                              // C: Mã số BHXH
      { v: r.cccd || '', s: cellCenterStyle },                                         // 1: Số CCCD/CNTD/ĐDCN
      { v: r.address || '', s: cellTextStyle },                                        // 2: Địa chỉ
      { v: receiptDate, s: cellCenterStyle },                                          // 3: Ngày biên lai
      { v: receiptNum, s: cellCenterStyle },                                           // 4: Số biên lai
      { v: income, s: cellNumberStyle },                                               // 5: Mức thu nhập tháng
      { v: months, s: cellCenterStyle },                                               // 6: Số tháng đóng
      { v: formatMonthVN(r.fromMonth), s: cellCenterStyle },                           // 7: Từ tháng/năm
      { v: basePrem, s: cellNumberStyle },                                             // 8: Số tiền phải đóng quy định
      { v: amount, s: cellNumberStyle },                                               // 9: Người tham gia đóng
      { v: nnSupportPct, s: cellCenterStyle },                                         // 10: Tỷ lệ % NSNN hỗ trợ (giá trị số để cộng)
      { v: recNNSupport, s: cellNumberStyle },                                         // 11: Số tiền NSNN hỗ trợ
      { v: dpSupportPct > 0 ? dpSupportPct : '', s: cellCenterStyle },                 // 12: Tỷ lệ % NSĐP hỗ trợ
      { v: dpSupportAmount > 0 ? dpSupportAmount : '', s: cellNumberStyle },           // 13: Số tiền NSĐP hỗ trợ
      { v: otherSupportPct > 0 ? otherSupportPct : '', s: cellCenterStyle },           // 14: Tỷ lệ % Hỗ trợ khác
      { v: otherSupportAmount > 0 ? otherSupportAmount : '', s: cellNumberStyle },     // 15: Số tiền Hỗ trợ khác
      { v: staffCode, s: cellCenterStyle },                                            // 16: Mã số NV thu
      { v: notesStr, s: cellTextStyle }                                                // 17: Ghi chú đầy đủ
    ]);
  });

  // Hàng Cộng tăng: Col 0..9 merged, Col 10..19 các cột số
  rows.push([
    { v: 'Cộng tăng', s: totalBlueStyle },                                             // Col 0 (sẽ merge Col 0..9)
    ...Array(9).fill({ v: '', s: totalBlueStyle }),                                    // Col 1..9
    { v: totalBasePremium, s: totalBlueNumberStyle },                                  // Col 10: Cột 8
    { v: totalAmount, s: totalBlueNumberStyle },                                       // Col 11: Cột 9
    { v: totalNNSupportPct, s: totalBlueNumberStyle },                                 // Col 12: Cột 10 (Tổng tỷ lệ % NSNN)
    { v: totalNNSupport, s: totalBlueNumberStyle },                                    // Col 13: Cột 11 (Tổng tiền NSNN)
    { v: '', s: totalBlueStyle },                                                      // Col 14: Cột 12
    { v: totalDPSupport, s: totalBlueNumberStyle },                                    // Col 15: Cột 13 (Số tiền NSĐP)
    { v: '', s: totalBlueStyle },                                                      // Col 16: Cột 14
    { v: totalOtherSupport, s: totalBlueNumberStyle },                                 // Col 17: Cột 15 (Số tiền Khác)
    { v: '', s: totalBlueStyle },                                                      // Col 18: Cột 16
    { v: '', s: totalBlueStyle }                                                       // Col 19: Cột 17
  ]);

  // Phân nhóm II. Giảm
  rows.push([
    { v: 'II', s: groupHeaderCenterStyle },
    { v: 'Giảm', s: groupHeaderStyle },
    ...Array(18).fill({ v: '', s: groupHeaderStyle })
  ]);

  rows.push([
    { v: 'II.1', s: subGroupHeaderCenterStyle },
    { v: 'Người tham gia', s: subGroupHeaderStyle },
    ...Array(18).fill({ v: '', s: subGroupHeaderStyle })
  ]);

  // Hàng Cộng giảm
  rows.push([
    { v: 'Cộng giảm', s: totalBlueStyle },
    ...Array(9).fill({ v: '', s: totalBlueStyle }),
    { v: 0, s: totalBlueNumberStyle },
    { v: 0, s: totalBlueNumberStyle },
    { v: '', s: totalBlueStyle },
    { v: 0, s: totalBlueNumberStyle },
    { v: '', s: totalBlueStyle },
    { v: 0, s: totalBlueNumberStyle },
    { v: '', s: totalBlueStyle },
    { v: 0, s: totalBlueNumberStyle },
    { v: '', s: totalBlueStyle },
    { v: '', s: totalBlueStyle }
  ]);

  // Total Summary Row: TỔNG CỘNG
  rows.push([
    { v: `TỔNG CỘNG (${validRecords.length} người tham gia)`, s: grandTotalStyle },
    ...Array(9).fill({ v: '', s: grandTotalStyle }),
    { v: totalBasePremium, s: grandTotalNumberStyle },
    { v: totalAmount, s: grandTotalNumberStyle },
    { v: totalNNSupportPct, s: grandTotalNumberStyle },
    { v: totalNNSupport, s: grandTotalNumberStyle },
    { v: '', s: grandTotalStyle },
    { v: totalDPSupport, s: grandTotalNumberStyle },
    { v: '', s: grandTotalStyle },
    { v: totalOtherSupport, s: grandTotalNumberStyle },
    { v: '', s: grandTotalStyle },
    { v: '', s: grandTotalStyle }
  ]);

  // Ghi chú dưới bảng theo mẫu QĐ 490
  const soDeNghiCap = validRecords.filter(r => !isD05TSRenew(r)).length;
  rows.push(Array(20).fill(null));
  
  const rowSoDeNghiCap = Array(20).fill(null);
  rowSoDeNghiCap[0] = { v: `Tổng số sổ BHXH đề nghị cấp: ${soDeNghiCap > 0 ? soDeNghiCap : '0'} sổ.`, s: { font: { name: fontMain, sz: 10, bold: true, italic: true } } };
  rows.push(rowSoDeNghiCap);

  const rowGhiChu = Array(20).fill(null);
  rowGhiChu[0] = { v: '- Ghi chú: Cột 16 chỉ áp dụng đối với tổ chức dịch vụ thu BHXH tự nguyện BHYT.', s: { font: { name: fontMain, sz: 9, italic: true } } };
  rows.push(rowGhiChu);

  // Signatures
  rows.push(Array(20).fill(null));

  // Row Ngày tháng năm
  const rowNgayKyData = Array(20).fill(null);
  rowNgayKyData[18] = {
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
  rowKyData[18] = {
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
  rowKyChuData[18] = {
    v: '(Ký, ghi rõ họ tên, đóng dấu)',
    s: { font: { name: fontMain, sz: 9, italic: true }, alignment: { horizontal: 'center', vertical: 'center' } }
  };
  rows.push(rowKyChuData);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  const N = validRecords.length;
  const rowCongTang = 15 + N;
  const rowNhomII = rowCongTang + 1;
  const rowNhomII1 = rowCongTang + 2;
  const rowCongGiam = rowCongTang + 3;
  const rowTongCong = rowCongTang + 4;
  const rowDeNghiCap = rowCongTang + 6;
  const rowGhiChu16 = rowCongTang + 7;
  const rowNgayKy = rowCongTang + 9;
  const rowKy = rowCongTang + 10;
  const rowKyChu = rowCongTang + 11;

  ws['!merges'] = [
    // Header Meta
    { s: { r: 0, c: 0 }, e: { r: 0, c: 11 } },
    { s: { r: 0, c: 18 }, e: { r: 0, c: 19 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 11 } },
    { s: { r: 1, c: 14 }, e: { r: 1, c: 19 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 11 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 11 } },

    // Title
    { s: { r: 5, c: 0 }, e: { r: 5, c: 19 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 19 } },

    // Table Header merges
    { s: { r: 8, c: 0 }, e: { r: 11, c: 0 } },  // STT (Col 0)
    { s: { r: 8, c: 1 }, e: { r: 11, c: 1 } },  // Họ và tên (Col 1)
    { s: { r: 8, c: 2 }, e: { r: 11, c: 2 } },  // Mã số BHXH (Col 2)
    { s: { r: 8, c: 3 }, e: { r: 11, c: 3 } },  // Số CCCD (Col 3)
    { s: { r: 8, c: 4 }, e: { r: 11, c: 4 } },  // Địa chỉ (Col 4)
    { s: { r: 8, c: 5 }, e: { r: 11, c: 5 } },  // Ngày biên lai (Col 5)
    { s: { r: 8, c: 6 }, e: { r: 11, c: 6 } },  // Số biên lai (Col 6)
    { s: { r: 8, c: 7 }, e: { r: 11, c: 7 } },  // Mức thu nhập tháng (Col 7)

    // Phương thức đóng (Col 8..9)
    { s: { r: 8, c: 8 }, e: { r: 8, c: 9 } },   // Phương thức đóng (Row 8)
    { s: { r: 9, c: 8 }, e: { r: 11, c: 8 } },  // Số tháng đóng (Col 8)
    { s: { r: 9, c: 9 }, e: { r: 11, c: 9 } },  // Từ tháng/năm (Col 9)

    // Số tiền đóng (Col 10..17)
    { s: { r: 8, c: 10 }, e: { r: 8, c: 17 } }, // Số tiền đóng (Row 8)
    { s: { r: 9, c: 10 }, e: { r: 11, c: 10 } },// Số tiền phải đóng quy định (Col 10)
    { s: { r: 9, c: 11 }, e: { r: 11, c: 11 } },// Người tham gia đóng (Col 11)
    { s: { r: 9, c: 12 }, e: { r: 9, c: 17 } }, // Trong đó (Row 9, Col 12..17)
    { s: { r: 10, c: 12 }, e: { r: 10, c: 13 } },// NSNN hỗ trợ (Row 10, Col 12..13)
    { s: { r: 10, c: 14 }, e: { r: 10, c: 15 } },// NSĐP hỗ trợ thêm (Row 10, Col 14..15)
    { s: { r: 10, c: 16 }, e: { r: 10, c: 17 } },// Hỗ trợ khác (Row 10, Col 16..17)

    { s: { r: 8, c: 18 }, e: { r: 11, c: 18 } },// Mã số nhân viên thu (Col 18)
    { s: { r: 8, c: 19 }, e: { r: 11, c: 19 } },// Ghi chú (Col 19)

    // Groups & Totals merges (Từ cột A (c: 0) đến cột J (c: 9))
    { s: { r: 13, c: 1 }, e: { r: 13, c: 19 } },// Nhóm I: Tăng
    { s: { r: 14, c: 1 }, e: { r: 14, c: 19 } },// I.1: Người tham gia
    { s: { r: rowCongTang, c: 0 }, e: { r: rowCongTang, c: 9 } }, // Cộng tăng
    { s: { r: rowNhomII, c: 1 }, e: { r: rowNhomII, c: 19 } },   // Nhóm II: Giảm
    { s: { r: rowNhomII1, c: 1 }, e: { r: rowNhomII1, c: 19 } }, // II.1: Người tham gia
    { s: { r: rowCongGiam, c: 0 }, e: { r: rowCongGiam, c: 9 } },// Cộng giảm
    { s: { r: rowTongCong, c: 0 }, e: { r: rowTongCong, c: 9 } },// TỔNG CỘNG

    // Bottom notes & signatures
    { s: { r: rowDeNghiCap, c: 0 }, e: { r: rowDeNghiCap, c: 11 } },
    { s: { r: rowGhiChu16, c: 0 }, e: { r: rowGhiChu16, c: 11 } },
    { s: { r: rowNgayKy, c: 18 }, e: { r: rowNgayKy, c: 19 } },
    { s: { r: rowKy, c: 1 }, e: { r: rowKy, c: 3 } },
    { s: { r: rowKy, c: 7 }, e: { r: rowKy, c: 9 } },
    { s: { r: rowKy, c: 18 }, e: { r: rowKy, c: 19 } },
    { s: { r: rowKyChu, c: 1 }, e: { r: rowKyChu, c: 3 } },
    { s: { r: rowKyChu, c: 7 }, e: { r: rowKyChu, c: 9 } },
    { s: { r: rowKyChu, c: 18 }, e: { r: rowKyChu, c: 19 } }
  ];

  ws['!cols'] = [
    { wch: 5 },   // A: STT
    { wch: 22 },  // B: Họ và tên
    { wch: 15 },  // C: Mã số BHXH
    { wch: 18 },  // 1: CCCD
    { wch: 32 },  // 2: Địa chỉ
    { wch: 13 },  // 3: Ngày biên lai
    { wch: 13 },  // 4: Số biên lai
    { wch: 16 },  // 5: Mức thu nhập tháng đóng
    { wch: 10 },  // 6: Số tháng đóng
    { wch: 12 },  // 7: Từ tháng/năm
    { wch: 16 },  // 8: Số tiền phải đóng quy định
    { wch: 16 },  // 9: Người tham gia đóng
    { wch: 10 },  // 10: Tỷ lệ % NSNN hỗ trợ
    { wch: 14 },  // 11: Số tiền NSNN hỗ trợ
    { wch: 10 },  // 12: Tỷ lệ % NSĐP hỗ trợ
    { wch: 12 },  // 13: Số tiền NSĐP hỗ trợ
    { wch: 10 },  // 14: Tỷ lệ % Hỗ trợ khác
    { wch: 12 },  // 15: Số tiền Hỗ trợ khác
    { wch: 16 },  // 16: Mã số nhân viên thu
    { wch: 75 }   // 17: Ghi chú đầy đủ
  ];

  protectWorksheetFormulas(ws);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_D05_TS');

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

