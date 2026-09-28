import { calculateBHXH, getPolicyValueForDate } from './calculations';
import { CONSTANTS } from './constants';
import { formatMoney, parseMonthISO, getLocalYYYYMMDD, formatMonthVN } from './helpers';

interface ExportBHXHTableParams {
  povertyStandard: number;
  baseSalary: number;
  nnSupport?: number;
  dpSupport?: number;
  fromMonth?: string;
  investmentRate?: number;
  policies?: any[];
  currentIncome?: number;
}

export const exportBHXHTableToExcel = async ({
  povertyStandard,
  baseSalary,
  nnSupport = 20,
  dpSupport: _dpSupport = 0,
  fromMonth,
  investmentRate = CONSTANTS.INTEREST,
  policies,
  currentIncome
}: ExportBHXHTableParams) => {
  const XLSX = (await import('xlsx-js-style')).default;

  const effectiveMonth = fromMonth ? formatMonthVN(fromMonth) : `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
  const dateStr = effectiveMonth ? parseMonthISO(effectiveMonth) + '-01' : getLocalYYYYMMDD();
  
  // Lấy hệ số trượt giá CPI áp dụng (mặc định 1.23 theo quy chuẩn dự toán)
  const cpiFactor = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'pension_cpi', dateStr, 1.23))
    : 1.23;

  // 1. Tạo danh sách các mức thu nhập chuẩn y hệt bảng quy chuẩn thực tế
  const maxIncome = baseSalary * 20;
  const standardIncomes = [
    // Bước nhảy 100k từ 1.5M đến 3.0M
    1500000, 1600000, 1700000, 1800000, 1900000, 2000000,
    2100000, 2200000, 2300000, 2400000, 2500000, 2600000,
    2700000, 2800000, 2900000, 3000000,
    // Bước nhảy 200k từ 3.2M đến 7.0M
    3200000, 3400000, 3600000, 3800000, 4000000,
    4200000, 4400000, 4600000, 4800000, 5000000,
    5200000, 5400000, 5600000, 5800000, 6000000,
    6200000, 6400000, 6600000, 6800000, 7000000,
    // Bước nhảy 500k & các mốc lớn
    7500000, 8000000, 8500000, 9000000, 9500000, 10000000,
    12000000, 15000000, 20000000, 25000000, 30000000, 35000000, 40000000,
    maxIncome
  ];

  if (povertyStandard && !standardIncomes.includes(povertyStandard)) {
    standardIncomes.push(povertyStandard);
  }
  if (currentIncome && !standardIncomes.includes(currentIncome)) {
    standardIncomes.push(currentIncome);
  }

  // Lọc và sắp xếp tăng dần các mức thu nhập
  const sortedIncomes = Array.from(new Set(
    standardIncomes.filter(inc => inc >= povertyStandard && inc <= maxIncome)
  )).sort((a, b) => a - b);

  // 2. Định nghĩa các style Excel
  const titleStyle = {
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const subtitleStyle = {
    font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '475569' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const infoStyle = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const contactStyle = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FF0000' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // Header xanh dương đậm chuẩn ảnh `#004182`
  const mainHeaderStyle = {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  const subHeaderStyle = {
    font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } }
    }
  };

  const cellCenterStyle = {
    font: { name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    }
  };

  const cellNumberStyle = (isHighlight: boolean = false) => ({
    font: { name: 'Calibri', sz: 10, bold: isHighlight, color: { rgb: isHighlight ? '004182' : '000000' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left: { style: 'thin', color: { rgb: 'D9D9D9' } },
      right: { style: 'thin', color: { rgb: 'D9D9D9' } }
    },
    fill: isHighlight ? { fgColor: { rgb: 'F0F9FF' } } : undefined
  });

  // 3. Xây dựng dữ liệu Header
  const wsData: any[][] = [
    // Hàng 1 (Row 1): Tiêu đề chính
    [{ v: 'BẢNG TRA CỨU MỨC ĐÓNG & DỰ TOÁN LƯƠNG HƯU BHXH TỰ NGUYỆN', s: titleStyle }],
    // Hàng 2 (Row 2): Căn cứ
    [{ v: 'Căn cứ Luật BHXH số 41/2024/QH15 & Nghị định 159/2025/NĐ-CP của Chính phủ', s: subtitleStyle }],
    // Hàng 3 (Row 3): Tham số
    [{ 
      v: `Tham số: Chuẩn nghèo nông thôn: ${formatMoney(povertyStandard)} | Mức lương cơ sở: ${formatMoney(baseSalary)} | Tỷ lệ Nhà nước hỗ trợ: ${nnSupport}% | Kỳ tính: ${effectiveMonth}`, 
      s: infoStyle 
    }],
    // Hàng 4 (Row 4): Thông tin chi tiết & liên hệ
    [{ 
      v: 'Thông tin chi tiết tại: https://thamgiabhxh.online/          Liên hệ: bhxhtn1410@gmail.com          SĐT: 0983774078', 
      s: contactStyle 
    }],
    // Hàng 5 (Row 5): Tiêu đề nhóm cột (Cấp 1)
    [
      { v: 'STT', s: mainHeaderStyle },
      { v: 'Mức thu nhập lựa chọn (VNĐ)', s: mainHeaderStyle },
      { v: 'Mức Nhà nước hỗ trợ\n(VNĐ/tháng)', s: mainHeaderStyle },
      null,
      { v: 'Mức đóng 1 tháng (VNĐ)', s: mainHeaderStyle },
      null,
      { v: 'Mức đóng 3 tháng (VNĐ)', s: mainHeaderStyle },
      null,
      { v: 'Mức đóng 6 tháng (VNĐ)', s: mainHeaderStyle },
      null,
      { v: 'Mức đóng 12 tháng (VNĐ)', s: mainHeaderStyle },
      null,
      { v: 'Mức đóng 5 năm (60 tháng) (VNĐ)', s: mainHeaderStyle },
      null,
      { v: 'Lương hưu dự kiến 15 năm', s: mainHeaderStyle },
      null,
      { v: 'Lương hưu dự kiến 20 năm', s: mainHeaderStyle },
      null
    ],
    // Hàng 6 (Row 6): Tiêu đề cột chi tiết (Cấp 2)
    [
      null,
      null,
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'ĐTTS (30%)', s: subHeaderStyle },
      { v: 'Khác (20%)', s: subHeaderStyle },
      { v: 'Nam (40%)', s: subHeaderStyle },
      { v: 'Nữ (45%)', s: subHeaderStyle },
      { v: 'Nam (45%)', s: subHeaderStyle },
      { v: 'Nữ (55%)', s: subHeaderStyle }
    ]
  ];

  // 4. Tính toán dòng dữ liệu cho từng mức thu nhập
  sortedIncomes.forEach((inc, idx) => {
    // 1. Mức hỗ trợ Nhà nước
    // ĐTTS (30%): povertyStandard * 22% * 30% = 99.000
    const supp30 = Math.round(povertyStandard * CONSTANTS.BHXH_RATE * 0.30);
    // Khác (20%): povertyStandard * 22% * 20% = 66.000
    const supp20 = Math.round(povertyStandard * CONSTANTS.BHXH_RATE * 0.20);

    // 2. Mức đóng 1 tháng
    const pay1_30 = Math.round(inc * CONSTANTS.BHXH_RATE - supp30);
    const pay1_20 = Math.round(inc * CONSTANTS.BHXH_RATE - supp20);

    // 3. Mức đóng 3 tháng
    const pay3_30 = pay1_30 * 3;
    const pay3_20 = pay1_20 * 3;

    // 4. Mức đóng 6 tháng
    const pay6_30 = pay1_30 * 6;
    const pay6_20 = pay1_20 * 6;

    // 5. Mức đóng 12 tháng
    const pay12_30 = pay1_30 * 12;
    const pay12_20 = pay1_20 * 12;

    // 6. Mức đóng 5 năm (60 tháng) - có chiết khấu PV
    const res60_30 = calculateBHXH(inc, 30, 0, 'pre_60', 60, effectiveMonth, investmentRate, povertyStandard, policies);
    const res60_20 = calculateBHXH(inc, 20, 0, 'pre_60', 60, effectiveMonth, investmentRate, povertyStandard, policies);
    const pay60_30 = res60_30.amount;
    const pay60_20 = res60_20.amount;

    // 7. Lương hưu dự kiến CÓ NHÂN VỚI HỆ SỐ TRƯỢT GIÁ CPI (cpiFactor = 1.23)
    // 15 năm: Nam 40%, Nữ 45%
    // 20 năm: Nam 45%, Nữ 55%
    const pension15Male = Math.round(inc * 0.40 * cpiFactor);
    const pension15Female = Math.round(inc * 0.45 * cpiFactor);
    const pension20Male = Math.round(inc * 0.45 * cpiFactor);
    const pension20Female = Math.round(inc * 0.55 * cpiFactor);

    const isCurrent = currentIncome === inc;

    wsData.push([
      { v: idx + 1, s: cellCenterStyle },
      { v: inc, t: 'n', s: cellNumberStyle(isCurrent) },
      { v: supp30, t: 'n', s: cellNumberStyle(false) },
      { v: supp20, t: 'n', s: cellNumberStyle(false) },
      { v: pay1_30, t: 'n', s: cellNumberStyle(false) },
      { v: pay1_20, t: 'n', s: cellNumberStyle(isCurrent) },
      { v: pay3_30, t: 'n', s: cellNumberStyle(false) },
      { v: pay3_20, t: 'n', s: cellNumberStyle(false) },
      { v: pay6_30, t: 'n', s: cellNumberStyle(false) },
      { v: pay6_20, t: 'n', s: cellNumberStyle(false) },
      { v: pay12_30, t: 'n', s: cellNumberStyle(false) },
      { v: pay12_20, t: 'n', s: cellNumberStyle(false) },
      { v: pay60_30, t: 'n', s: cellNumberStyle(false) },
      { v: pay60_20, t: 'n', s: cellNumberStyle(false) },
      { v: pension15Male, t: 'n', s: cellNumberStyle(false) },
      { v: pension15Female, t: 'n', s: cellNumberStyle(false) },
      { v: pension20Male, t: 'n', s: cellNumberStyle(false) },
      { v: pension20Female, t: 'n', s: cellNumberStyle(false) }
    ]);
  });

  // Tạo Worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Cấu hình Merges chính xác 100% như ảnh
  ws['!merges'] = [
    // Header banner rows
    { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }, // A1:R1 (Tiêu đề chính)
    { s: { r: 1, c: 0 }, e: { r: 1, c: 17 } }, // A2:R2 (Căn cứ pháp lý)
    { s: { r: 2, c: 0 }, e: { r: 2, c: 17 } }, // A3:R3 (Tham số)
    { s: { r: 3, c: 0 }, e: { r: 3, c: 17 } }, // A4:R4 (Thông tin chi tiết & Liên hệ)
    // Table Header merges
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },   // A5:A6 (STT)
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },   // B5:B6 (Mức thu nhập lựa chọn)
    { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } },   // C5:D5 (Mức Nhà nước hỗ trợ)
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },   // E5:F5 (Mức đóng 1 tháng)
    { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } },   // G5:H5 (Mức đóng 3 tháng)
    { s: { r: 4, c: 8 }, e: { r: 4, c: 9 } },   // I5:J5 (Mức đóng 6 tháng)
    { s: { r: 4, c: 10 }, e: { r: 4, c: 11 } }, // K5:L5 (Mức đóng 12 tháng)
    { s: { r: 4, c: 12 }, e: { r: 4, c: 13 } }, // M5:N5 (Mức đóng 5 năm)
    { s: { r: 4, c: 14 }, e: { r: 4, c: 15 } }, // O5:P5 (Lương hưu dự kiến 15 năm)
    { s: { r: 4, c: 16 }, e: { r: 4, c: 17 } }, // Q5:R5 (Lương hưu dự kiến 20 năm)
  ];

  // Cấu hình độ rộng từng cột y hệt kích cỡ ảnh
  ws['!cols'] = [
    { wch: 6 },  // A: STT
    { wch: 18 }, // B: Mức thu nhập lựa chọn
    { wch: 13 }, // C: NN Hỗ trợ ĐTTS
    { wch: 13 }, // D: NN Hỗ trợ Khác
    { wch: 14 }, // E: Đóng 1T ĐTTS
    { wch: 14 }, // F: Đóng 1T Khác
    { wch: 14 }, // G: Đóng 3T ĐTTS
    { wch: 14 }, // H: Đóng 3T Khác
    { wch: 14 }, // I: Đóng 6T ĐTTS
    { wch: 14 }, // J: Đóng 6T Khác
    { wch: 15 }, // K: Đóng 12T ĐTTS
    { wch: 15 }, // L: Đóng 12T Khác
    { wch: 17 }, // M: Đóng 5 năm ĐTTS
    { wch: 17 }, // N: Đóng 5 năm Khác
    { wch: 15 }, // O: Lương hưu 15N Nam
    { wch: 15 }, // P: Lương hưu 15N Nữ
    { wch: 15 }, // Q: Lương hưu 20N Nam
    { wch: 15 }, // R: Lương hưu 20N Nữ
  ];

  // Đặt tên sheet chuẩn
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BangTraCuuBHXHTuNguyen');

  const fileName = `Bang_Tra_Cuu_Muc_Dong_BHXH_Tu_Nguyen_${Date.now()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportBHXHTableToPDF = async ({
  povertyStandard,
  baseSalary,
  nnSupport = 20,
  dpSupport: _dpSupport = 0,
  fromMonth,
  investmentRate = CONSTANTS.INTEREST,
  policies,
  currentIncome
}: ExportBHXHTableParams) => {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.vfs = pdfFonts?.pdfMake?.vfs || (pdfFonts as any).vfs || pdfFonts;

  const effectiveMonth = fromMonth || `${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`;
  const dateStr = effectiveMonth ? parseMonthISO(effectiveMonth) + '-01' : getLocalYYYYMMDD();
  
  const cpiFactor = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'pension_cpi', dateStr, 1.23))
    : 1.23;

  const maxIncome = baseSalary * 20;
  const standardIncomes = [
    1500000, 1600000, 1700000, 1800000, 1900000, 2000000,
    2100000, 2200000, 2300000, 2400000, 2500000, 2600000,
    2700000, 2800000, 2900000, 3000000,
    3200000, 3400000, 3600000, 3800000, 4000000,
    4200000, 4400000, 4600000, 4800000, 5000000,
    5200000, 5400000, 5600000, 5800000, 6000000,
    6200000, 6400000, 6600000, 6800000, 7000000,
    7500000, 8000000, 8500000, 9000000, 9500000, 10000000,
    12000000, 15000000, 20000000, 25000000, 30000000, 35000000, 40000000,
    maxIncome
  ];

  if (povertyStandard && !standardIncomes.includes(povertyStandard)) {
    standardIncomes.push(povertyStandard);
  }
  if (currentIncome && !standardIncomes.includes(currentIncome)) {
    standardIncomes.push(currentIncome);
  }

  const sortedIncomes = Array.from(new Set(
    standardIncomes.filter(inc => inc >= povertyStandard && inc <= maxIncome)
  )).sort((a, b) => a - b);

  const tableBody: any[][] = [
    // Header Row 1
    [
      { text: 'STT', rowSpan: 2, style: 'tableHeader', alignment: 'center' },
      { text: 'Mức thu nhập\nlựa chọn (VNĐ)', rowSpan: 2, style: 'tableHeader', alignment: 'center' },
      { text: 'Mức Nhà nước hỗ trợ\n(VNĐ/tháng)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Mức đóng 1 tháng\n(VNĐ)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Mức đóng 3 tháng\n(VNĐ)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Mức đóng 6 tháng\n(VNĐ)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Mức đóng 12 tháng\n(VNĐ)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Mức đóng 5 năm (60T)\n(VNĐ)', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Lương hưu dự kiến 15 năm', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {},
      { text: 'Lương hưu dự kiến 20 năm', colSpan: 2, style: 'tableHeader', alignment: 'center' },
      {}
    ],
    // Header Row 2
    [
      {},
      {},
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'ĐTTS (30%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Khác (20%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Nam (40%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Nữ (45%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Nam (45%)', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Nữ (55%)', style: 'tableSubHeader', alignment: 'center' }
    ]
  ];

  const fmt = (num: number) => num.toLocaleString('vi-VN');

  sortedIncomes.forEach((inc, idx) => {
    const supp30 = Math.round(povertyStandard * CONSTANTS.BHXH_RATE * 0.30);
    const supp20 = Math.round(povertyStandard * CONSTANTS.BHXH_RATE * 0.20);
    const pay1_30 = Math.round(inc * CONSTANTS.BHXH_RATE - supp30);
    const pay1_20 = Math.round(inc * CONSTANTS.BHXH_RATE - supp20);
    const pay3_30 = pay1_30 * 3;
    const pay3_20 = pay1_20 * 3;
    const pay6_30 = pay1_30 * 6;
    const pay6_20 = pay1_20 * 6;
    const pay12_30 = pay1_30 * 12;
    const pay12_20 = pay1_20 * 12;
    const res60_30 = calculateBHXH(inc, 30, 0, 'pre_60', 60, effectiveMonth, investmentRate, povertyStandard, policies);
    const res60_20 = calculateBHXH(inc, 20, 0, 'pre_60', 60, effectiveMonth, investmentRate, povertyStandard, policies);
    const pension15Male = Math.round(inc * 0.40 * cpiFactor);
    const pension15Female = Math.round(inc * 0.45 * cpiFactor);
    const pension20Male = Math.round(inc * 0.45 * cpiFactor);
    const pension20Female = Math.round(inc * 0.55 * cpiFactor);

    const isCurrent = currentIncome === inc;
    const rowFillColor = isCurrent ? '#EFF6FF' : (idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF');

    tableBody.push([
      { text: (idx + 1).toString(), alignment: 'center', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(inc), alignment: 'right', bold: isCurrent, fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(supp30), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(supp20), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay1_30), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay1_20), alignment: 'right', bold: isCurrent, fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay3_30), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay3_20), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay6_30), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay6_20), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay12_30), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pay12_20), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(res60_30.amount), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(res60_20.amount), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pension15Male), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pension15Female), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pension20Male), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 },
      { text: fmt(pension20Female), alignment: 'right', fillColor: rowFillColor, fontSize: 6.5 }
    ]);
  });

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [20, 20, 20, 20],
    content: [
      { text: 'BẢNG TRA CỨU MỨC ĐÓNG & DỰ TOÁN LƯƠNG HƯU BHXH TỰ NGUYỆN', style: 'docTitle' },
      { text: 'Căn cứ Luật BHXH số 41/2024/QH15 & Nghị định 159/2025/NĐ-CP của Chính phủ', style: 'docSubtitle' },
      { 
        text: `Tham số: Chuẩn nghèo nông thôn: ${formatMoney(povertyStandard)} | Mức lương cơ sở: ${formatMoney(baseSalary)} | Tỷ lệ Nhà nước hỗ trợ: ${nnSupport}% | Kỳ tính: ${effectiveMonth}`,
        style: 'docInfo'
      },
      {
        text: 'Thông tin chi tiết tại: https://thamgiabhxh.online/          Liên hệ: bhxhtn1410@gmail.com          SĐT: 0983774078',
        style: 'docContact'
      },
      {
        table: {
          headerRows: 2,
          widths: [16, 46, 36, 36, 38, 38, 38, 38, 40, 40, 42, 42, 50, 50, 42, 42, 42, 44],
          body: tableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 2 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#CBD5E1',
          vLineColor: () => '#CBD5E1',
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 2,
          paddingBottom: () => 2
        }
      },
      {
        text: '\n* Ghi chú: Mức lương hưu dự kiến đã bao gồm hệ số điều chỉnh trượt giá CPI theo quy chuẩn dự toán. Người tham gia được cấp thẻ BHYT miễn phí 95% khi hưởng lương hưu.',
        style: 'docNote'
      }
    ],
    styles: {
      docTitle: { fontSize: 13, bold: true, color: '#004182', alignment: 'center', margin: [0, 0, 0, 2] },
      docSubtitle: { fontSize: 8.5, italics: true, color: '#475569', alignment: 'center', margin: [0, 0, 0, 2] },
      docInfo: { fontSize: 8.5, bold: true, color: '#000000', alignment: 'center', margin: [0, 0, 0, 2] },
      docContact: { fontSize: 8.5, bold: true, color: '#FF0000', alignment: 'center', margin: [0, 0, 0, 6] },
      tableHeader: { fontSize: 7, bold: true, color: '#FFFFFF', fillColor: '#004182', margin: [0, 2, 0, 2] },
      tableSubHeader: { fontSize: 6.5, bold: true, color: '#FFFFFF', fillColor: '#004182', margin: [0, 1, 0, 1] },
      docNote: { fontSize: 7, italics: true, color: '#475569', margin: [0, 4, 0, 0] }
    }
  };

  const fileName = `Bang_Tra_Cuu_Muc_Dong_BHXH_Tu_Nguyen_${Date.now()}.pdf`;
  pdfMake.createPdf(docDefinition).download(fileName);
};
