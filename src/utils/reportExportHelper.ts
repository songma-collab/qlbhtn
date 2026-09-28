/**
 * Tiện ích xuất Báo cáo Thống kê thu BHXH/BHYT chuẩn văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP)
 * Hỗ trợ xuất Excel định dạng chuẩn với xlsx-js-style và xuất PDF với pdfmake
 */

import { formatMoney } from './helpers';

export interface ReportSummaryItem {
  id?: string;
  name: string;
  staffCode?: string;
  bhxhCount: number;
  bhxhRevenue: number;
  bhxhCommission: number;
  bhytCount: number;
  bhytRevenue: number;
  bhytCommission: number;
  revenue: number;
  commission: number;
}

export interface ReportExportParams {
  periodText: string;
  agencyName?: string;
  parentAgencyName?: string;
  staffData: ReportSummaryItem[];
  currentUserName?: string;
  managerName?: string;
  reportLocation?: string;
  controllerName?: string;
  managerTitle?: string;
  creatorTitle?: string;
  controllerTitle?: string;
}

/**
 * Xuất file Excel Báo cáo thống kê thu BHXH/BHYT định dạng chuẩn văn bản hành chính
 */
export const exportRevenueReportToExcel = async ({
  periodText,
  agencyName = 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ',
  parentAgencyName = 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA',
  staffData,
  currentUserName = 'Người lập biểu',
  managerName = 'Thủ trưởng đơn vị',
  reportLocation = 'Sông Mã',
  controllerName = '',
  managerTitle = 'THỦ TRƯỞNG ĐƠN VỊ',
  creatorTitle = 'NGƯỜI LẬP BIỂU',
  controllerTitle = 'NGƯỜI KIỂM SOÁT'
}: ReportExportParams) => {
  const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));

  // Tính tổng cộng các chỉ tiêu
  const totals = staffData.reduce(
    (acc, cur) => ({
      bhxhCount: acc.bhxhCount + (cur.bhxhCount || 0),
      bhxhRevenue: acc.bhxhRevenue + (cur.bhxhRevenue || 0),
      bhxhCommission: acc.bhxhCommission + (cur.bhxhCommission || 0),
      bhytCount: acc.bhytCount + (cur.bhytCount || 0),
      bhytRevenue: acc.bhytRevenue + (cur.bhytRevenue || 0),
      bhytCommission: acc.bhytCommission + (cur.bhytCommission || 0),
      revenue: acc.revenue + (cur.revenue || 0),
      commission: acc.commission + (cur.commission || 0)
    }),
    {
      bhxhCount: 0,
      bhxhRevenue: 0,
      bhxhCommission: 0,
      bhytCount: 0,
      bhytRevenue: 0,
      bhytCommission: 0,
      revenue: 0,
      commission: 0
    }
  );

  const now = new Date();
  const dateStr = `${reportLocation || 'Sông Mã'}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  // Tạo ma trận dữ liệu Excel (AOA - Array of Arrays)
  const aoa: any[][] = [
    // Hàng 1: Cơ quan ban hành & Quốc hiệu
    [parentAgencyName.toUpperCase(), '', '', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', '', '', ''],
    // Hàng 2: Tên đại lý & Tiêu ngữ
    [agencyName.toUpperCase(), '', '', '', '', '', 'Độc lập - Tự do - Hạnh phúc', '', '', ''],
    // Hàng 3: Trống
    ['', '', '', '', '', '', '', '', '', ''],
    // Hàng 4: Tiêu đề báo cáo
    ['BÁO CÁO TỔNG HỢP THU BẢO HIỂM XÃ HỘI, BẢO HIỂM Y TẾ', '', '', '', '', '', '', '', '', ''],
    // Hàng 5: Kỳ báo cáo
    [`Kỳ báo cáo: ${periodText}`, '', '', '', '', '', '', '', '', ''],
    // Hàng 6: Đơn vị tính
    ['Đơn vị tính: Đồng Việt Nam (VNĐ)', '', '', '', '', '', '', '', '', ''],
    // Hàng 7: Header bảng - Cấp 1
    ['STT', 'Cán bộ / Đại lý phụ trách', 'BHXH TỰ NGUYỆN', '', '', 'BHYT HỘ GIA ĐÌNH', '', '', 'TỔNG CỘNG THU', 'TỔNG HOA HỒNG'],
    // Hàng 8: Header bảng - Cấp 2
    ['', '', 'Số hồ sơ', 'Số tiền thu', 'Hoa hồng', 'Số hồ sơ', 'Số tiền thu', 'Hoa hồng', '', '']
  ];

  // Thêm các dòng dữ liệu nhân viên
  staffData.forEach((s, idx) => {
    aoa.push([
      idx + 1,
      s.name,
      s.bhxhCount || 0,
      s.bhxhRevenue || 0,
      s.bhxhCommission || 0,
      s.bhytCount || 0,
      s.bhytRevenue || 0,
      s.bhytCommission || 0,
      s.revenue || 0,
      s.commission || 0
    ]);
  });

  // Dòng TỔNG CỘNG
  aoa.push([
    '',
    'TỔNG CỘNG',
    totals.bhxhCount,
    totals.bhxhRevenue,
    totals.bhxhCommission,
    totals.bhytCount,
    totals.bhytRevenue,
    totals.bhytCommission,
    totals.revenue,
    totals.commission
  ]);

  // Hàng trống
  aoa.push(['', '', '', '', '', '', '', '', '', '']);
  // Ngày tháng năm lập biểu
  aoa.push(['', '', '', '', '', '', dateStr, '', '', '']);
  // Các ô ký tên
  aoa.push([creatorTitle, '', '', controllerTitle, '', '', managerTitle, '', '', '']);
  aoa.push(['(Ký, ghi rõ họ tên)', '', '', '(Ký, ghi rõ họ tên)', '', '', '(Ký, đóng dấu, ghi rõ họ tên)', '', '', '']);
  aoa.push(['', '', '', '', '', '', '', '', '', '']);
  aoa.push(['', '', '', '', '', '', '', '', '', '']);
  aoa.push([currentUserName, '', '', controllerName || '', '', '', managerName, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Thiết lập độ rộng cột (Column widths)
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 25 }, // Cán bộ phụ trách
    { wch: 12 }, // Số HS BHXH
    { wch: 18 }, // Tiền thu BHXH
    { wch: 16 }, // Hoa hồng BHXH
    { wch: 12 }, // Số HS BHYT
    { wch: 18 }, // Tiền thu BHYT
    { wch: 16 }, // Hoa hồng BHYT
    { wch: 20 }, // Tổng tiền thu
    { wch: 18 }  // Tổng hoa hồng
  ];

  // Thiết lập Merges
  ws['!merges'] = [
    // Cơ quan ban hành & Quốc hiệu
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 1, c: 6 }, e: { r: 1, c: 9 } },
    // Tiêu đề & Kỳ
    { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: 9 } },
    // Header Table Merges
    { s: { r: 6, c: 0 }, e: { r: 7, c: 0 } }, // STT
    { s: { r: 6, c: 1 }, e: { r: 7, c: 1 } }, // Tên
    { s: { r: 6, c: 2 }, e: { r: 6, c: 4 } }, // BHXH Tự nguyện
    { s: { r: 6, c: 5 }, e: { r: 6, c: 7 } }, // BHYT Hộ gia đình
    { s: { r: 6, c: 8 }, e: { r: 7, c: 8 } }, // Tổng thu
    { s: { r: 6, c: 9 }, e: { r: 7, c: 9 } }, // Tổng hoa hồng
    // Dòng tổng cộng: Cột 0 và 1 gộp lại
    { s: { r: 8 + staffData.length, c: 0 }, e: { r: 8 + staffData.length, c: 1 } },
    // Ngày tháng ký tên
    { s: { r: 10 + staffData.length, c: 6 }, e: { r: 10 + staffData.length, c: 9 } },
    // Chữ ký Người lập biểu
    { s: { r: 11 + staffData.length, c: 0 }, e: { r: 11 + staffData.length, c: 2 } },
    { s: { r: 12 + staffData.length, c: 0 }, e: { r: 12 + staffData.length, c: 2 } },
    { s: { r: 15 + staffData.length, c: 0 }, e: { r: 15 + staffData.length, c: 2 } },
    // Chữ ký Người kiểm soát
    { s: { r: 11 + staffData.length, c: 3 }, e: { r: 11 + staffData.length, c: 5 } },
    { s: { r: 12 + staffData.length, c: 3 }, e: { r: 12 + staffData.length, c: 5 } },
    // Chữ ký Thủ trưởng
    { s: { r: 11 + staffData.length, c: 6 }, e: { r: 11 + staffData.length, c: 9 } },
    { s: { r: 12 + staffData.length, c: 6 }, e: { r: 12 + staffData.length, c: 9 } },
    { s: { r: 15 + staffData.length, c: 6 }, e: { r: 15 + staffData.length, c: 9 } }
  ];

  // Định nghĩa Styles cho các ô
  const thinBorder = {
    top: { style: 'thin', color: { rgb: '94A3B8' } },
    bottom: { style: 'thin', color: { rgb: '94A3B8' } },
    left: { style: 'thin', color: { rgb: '94A3B8' } },
    right: { style: 'thin', color: { rgb: '94A3B8' } }
  };

  const headerStyle = {
    font: { name: 'Times New Roman', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '004182' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder
  };

  const subHeaderStyle = {
    font: { name: 'Times New Roman', sz: 9.5, bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '0369A1' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder
  };

  const dataTextStyle = {
    font: { name: 'Times New Roman', sz: 10 },
    alignment: { vertical: 'center' },
    border: thinBorder
  };

  const dataCenterStyle = {
    font: { name: 'Times New Roman', sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder
  };

  const dataNumberStyle = {
    font: { name: 'Times New Roman', sz: 10 },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: thinBorder
  };

  const totalRowStyle = {
    font: { name: 'Times New Roman', sz: 10.5, bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'F1F5F9' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: thinBorder
  };

  // Áp dụng Styles cho từng Cell
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:J25');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      let cell = ws[cellAddress];
      if (!cell) {
        cell = { t: 's', v: '' };
        ws[cellAddress] = cell;
      }

      // 1. Tiêu đề cơ quan & Quốc hiệu
      if (R === 0 || R === 1) {
        cell.s = {
          font: { name: 'Times New Roman', sz: 10, bold: R === 0 || C === 0 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
      // 2. Tiêu đề Báo cáo
      else if (R === 3) {
        cell.s = {
          font: { name: 'Times New Roman', sz: 14, bold: true, color: { rgb: '004182' } },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
      // 3. Kỳ báo cáo & Đơn vị tính
      else if (R === 4 || R === 5) {
        cell.s = {
          font: { name: 'Times New Roman', sz: 10, italic: R === 4 },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
      // 4. Header hàng 1
      else if (R === 6) {
        cell.s = headerStyle;
      }
      // 5. Header hàng 2
      else if (R === 7) {
        cell.s = subHeaderStyle;
      }
      // 6. Các dòng dữ liệu nhân viên
      else if (R >= 8 && R < 8 + staffData.length) {
        if (C === 0) cell.s = dataCenterStyle;
        else if (C === 1) cell.s = dataTextStyle;
        else if (C === 2 || C === 5) cell.s = dataCenterStyle;
        else cell.s = dataNumberStyle;
      }
      // 7. Dòng TỔNG CỘNG
      else if (R === 8 + staffData.length) {
        cell.s = {
          ...totalRowStyle,
          alignment: C <= 1 ? { horizontal: 'center', vertical: 'center' } : { horizontal: 'right', vertical: 'center' }
        };
      }
      // 8. Chữ ký & Ngày tháng
      else if (R >= 10 + staffData.length) {
        const isBold = R === 11 + staffData.length || R === 15 + staffData.length;
        const isItalic = R === 10 + staffData.length || R === 12 + staffData.length;
        cell.s = {
          font: { name: 'Times New Roman', sz: 10, bold: isBold, italic: isItalic },
          alignment: { horizontal: 'center', vertical: 'center' }
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BaoCaoThu_BHXH_BHYT');
  const fileName = `Bao_Cao_Thu_BHXH_BHYT_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

/**
 * Xuất file PDF Báo cáo thống kê thu BHXH/BHYT chuẩn văn bản hành chính Việt Nam
 */
export const exportRevenueReportToPdf = async ({
  periodText,
  agencyName = 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ',
  parentAgencyName = 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA',
  staffData,
  currentUserName = 'Người lập biểu',
  managerName = 'Thủ trưởng đơn vị',
  reportLocation = 'Sông Mã',
  controllerName = '',
  managerTitle = 'THỦ TRƯỞNG ĐƠN VỊ',
  creatorTitle = 'NGƯỜI LẬP BIỂU',
  controllerTitle = 'NGƯỜI KIỂM SOÁT'
}: ReportExportParams) => {
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.vfs = pdfFonts?.pdfMake?.vfs || (pdfFonts as any).vfs || pdfFonts;

  const now = new Date();
  const dateStr = `${reportLocation || 'Sông Mã'}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  const totals = staffData.reduce(
    (acc, cur) => ({
      bhxhCount: acc.bhxhCount + (cur.bhxhCount || 0),
      bhxhRevenue: acc.bhxhRevenue + (cur.bhxhRevenue || 0),
      bhxhCommission: acc.bhxhCommission + (cur.bhxhCommission || 0),
      bhytCount: acc.bhytCount + (cur.bhytCount || 0),
      bhytRevenue: acc.bhytRevenue + (cur.bhytRevenue || 0),
      bhytCommission: acc.bhytCommission + (cur.bhytCommission || 0),
      revenue: acc.revenue + (cur.revenue || 0),
      commission: acc.commission + (cur.commission || 0)
    }),
    {
      bhxhCount: 0,
      bhxhRevenue: 0,
      bhxhCommission: 0,
      bhytCount: 0,
      bhytRevenue: 0,
      bhytCommission: 0,
      revenue: 0,
      commission: 0
    }
  );

  // Xây dựng Table Body cho PDF
  const tableBody: any[][] = [
    // Header row 1
    [
      { text: 'STT', rowSpan: 2, style: 'tableHeader', alignment: 'center' },
      { text: 'Cán bộ / Đại lý', rowSpan: 2, style: 'tableHeader', alignment: 'center' },
      { text: 'BHXH TỰ NGUYỆN', colSpan: 3, style: 'tableHeader', alignment: 'center' },
      {},
      {},
      { text: 'BHYT HỘ GIA ĐÌNH', colSpan: 3, style: 'tableHeader', alignment: 'center' },
      {},
      {},
      { text: 'TỔNG THU', rowSpan: 2, style: 'tableHeader', alignment: 'center' },
      { text: 'HOA HỒNG', rowSpan: 2, style: 'tableHeader', alignment: 'center' }
    ],
    // Header row 2
    [
      {},
      {},
      { text: 'Số HS', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Tiền thu', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Hoa hồng', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Số HS', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Tiền thu', style: 'tableSubHeader', alignment: 'center' },
      { text: 'Hoa hồng', style: 'tableSubHeader', alignment: 'center' },
      {},
      {}
    ]
  ];

  // Dữ liệu từng nhân viên
  staffData.forEach((s, idx) => {
    tableBody.push([
      { text: (idx + 1).toString(), alignment: 'center', style: 'tableCell' },
      { text: s.name, style: 'tableCellBold' },
      { text: (s.bhxhCount || 0).toString(), alignment: 'center', style: 'tableCell' },
      { text: formatMoney(s.bhxhRevenue || 0), alignment: 'right', style: 'tableCell' },
      { text: formatMoney(s.bhxhCommission || 0), alignment: 'right', style: 'tableCell' },
      { text: (s.bhytCount || 0).toString(), alignment: 'center', style: 'tableCell' },
      { text: formatMoney(s.bhytRevenue || 0), alignment: 'right', style: 'tableCell' },
      { text: formatMoney(s.bhytCommission || 0), alignment: 'right', style: 'tableCell' },
      { text: formatMoney(s.revenue || 0), alignment: 'right', style: 'tableCellBold' },
      { text: formatMoney(s.commission || 0), alignment: 'right', style: 'tableCellBold' }
    ]);
  });

  // Dòng Tổng cộng
  tableBody.push([
    { text: 'TỔNG CỘNG', colSpan: 2, alignment: 'center', style: 'tableTotal' },
    {},
    { text: totals.bhxhCount.toString(), alignment: 'center', style: 'tableTotal' },
    { text: formatMoney(totals.bhxhRevenue), alignment: 'right', style: 'tableTotal' },
    { text: formatMoney(totals.bhxhCommission), alignment: 'right', style: 'tableTotal' },
    { text: totals.bhytCount.toString(), alignment: 'center', style: 'tableTotal' },
    { text: formatMoney(totals.bhytRevenue), alignment: 'right', style: 'tableTotal' },
    { text: formatMoney(totals.bhytCommission), alignment: 'right', style: 'tableTotal' },
    { text: formatMoney(totals.revenue), alignment: 'right', style: 'tableTotal' },
    { text: formatMoney(totals.commission), alignment: 'right', style: 'tableTotal' }
  ]);

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [25, 25, 25, 25],
    content: [
      // Quốc hiệu & Tên cơ quan
      {
        columns: [
          {
            width: '45%',
            stack: [
              { text: parentAgencyName.toUpperCase(), fontSize: 9, bold: true, alignment: 'center' },
              { text: agencyName.toUpperCase(), fontSize: 9, bold: true, color: '#004182', alignment: 'center' },
              { text: '-----------------------', fontSize: 8, alignment: 'center', color: '#94A3B8' }
            ]
          },
          {
            width: '10%',
            text: ''
          },
          {
            width: '45%',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', fontSize: 9.5, bold: true, alignment: 'center' },
              { text: 'Độc lập - Tự do - Hạnh phúc', fontSize: 9, italics: true, bold: true, alignment: 'center' },
              { text: '-------------------------------', fontSize: 8, alignment: 'center', color: '#94A3B8' }
            ]
          }
        ],
        margin: [0, 0, 0, 12]
      },
      // Tiêu đề báo cáo
      {
        text: 'BÁO CÁO TỔNG HỢP THU BẢO HIỂM XÃ HỘI, BẢO HIỂM Y TẾ',
        fontSize: 13,
        bold: true,
        color: '#004182',
        alignment: 'center',
        margin: [0, 0, 0, 3]
      },
      {
        text: `Kỳ báo cáo: ${periodText}`,
        fontSize: 9.5,
        italics: true,
        alignment: 'center',
        margin: [0, 0, 0, 2]
      },
      {
        text: 'Đơn vị tính: Đồng Việt Nam (VNĐ)',
        fontSize: 8,
        italics: true,
        alignment: 'right',
        margin: [0, 0, 0, 6]
      },
      // Bảng biểu
      {
        table: {
          headerRows: 2,
          widths: [20, 110, 35, 75, 65, 35, 75, 65, 85, 75],
          body: tableBody
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === 2 || i === node.table.body.length - 1 || i === node.table.body.length) ? 1 : 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#94A3B8',
          vLineColor: () => '#94A3B8',
          paddingLeft: () => 3,
          paddingRight: () => 3,
          paddingTop: () => 2.5,
          paddingBottom: () => 2.5
        }
      },
      // Phần chữ ký
      {
        text: dateStr,
        fontSize: 8.5,
        italics: true,
        alignment: 'right',
        margin: [0, 12, 15, 6]
      },
      {
        columns: [
          {
            width: '33%',
            stack: [
              { text: creatorTitle, fontSize: 9, bold: true, alignment: 'center' },
              { text: '(Ký, ghi rõ họ tên)', fontSize: 7.5, italics: true, alignment: 'center', margin: [0, 2, 0, 45] },
              { text: currentUserName, fontSize: 9, bold: true, alignment: 'center' }
            ]
          },
          {
            width: '34%',
            stack: [
              { text: controllerTitle, fontSize: 9, bold: true, alignment: 'center' },
              { text: '(Ký, ghi rõ họ tên)', fontSize: 7.5, italics: true, alignment: 'center', margin: [0, 2, 0, 45] },
              { text: controllerName || '', fontSize: 9, bold: true, alignment: 'center' }
            ]
          },
          {
            width: '33%',
            stack: [
              { text: managerTitle, fontSize: 9, bold: true, alignment: 'center' },
              { text: '(Ký, đóng dấu, ghi rõ họ tên)', fontSize: 7.5, italics: true, alignment: 'center', margin: [0, 2, 0, 45] },
              { text: managerName, fontSize: 9, bold: true, alignment: 'center' }
            ]
          }
        ]
      }
    ],
    styles: {
      tableHeader: { fontSize: 7.5, bold: true, color: '#FFFFFF', fillColor: '#004182', margin: [0, 2, 0, 2] },
      tableSubHeader: { fontSize: 7, bold: true, color: '#FFFFFF', fillColor: '#0369A1', margin: [0, 1, 0, 1] },
      tableCell: { fontSize: 7.5, color: '#1E293B' },
      tableCellBold: { fontSize: 7.5, bold: true, color: '#0F172A' },
      tableTotal: { fontSize: 7.5, bold: true, color: '#000000', fillColor: '#F1F5F9' }
    }
  };

  const fileName = `Bao_Cao_Thu_BHXH_BHYT_${now.getFullYear()}_${now.getMonth() + 1}_${now.getDate()}.pdf`;
  pdfMake.createPdf(docDefinition).download(fileName);
};
