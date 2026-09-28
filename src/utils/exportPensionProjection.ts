import { formatMoney, getLocalYYYYMMDD } from './helpers';
import type { BreakEvenAnalysis } from './pensionAccumulation';

export interface ExportPensionPDFParams {
  chartElement?: HTMLElement | null;
  roadmapYears: number;
  income: number;
  gender: 'male' | 'female';
  povertyStandard: number;
  baseSalary: number;
  nsnnRate: number;
  dpRate: number;
  applyCpi: boolean;
  breakEvenData: BreakEvenAnalysis;
  agencyName?: string;
}

/**
 * Chuyển đổi mã màu CSS oklch(...) sang định dạng RGB/HEX an toàn bằng Canvas 2D
 */
const convertOklchToRgb = (val: string): string => {
  if (!val || typeof val !== 'string' || !val.includes('oklch')) return val;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillStyle = val;
      return ctx.fillStyle;
    }
  } catch {
    // fallback
  }
  return '#1e293b';
};

/**
 * Chụp một HTMLElement sang Canvas an toàn, khắc phục lỗi màu oklch của Tailwind v4 và co giãn SVG của Recharts
 */
export const captureElementToCanvas = async (element: HTMLElement): Promise<HTMLCanvasElement> => {
  const html2canvasModule = await import('html2canvas');
  const html2canvas = (html2canvasModule as any).default || html2canvasModule;

  // Lấy kích thước thực tế của element
  const rect = element.getBoundingClientRect();
  const width = Math.max(element.scrollWidth, Math.round(rect.width), 320);
  const height = Math.max(element.scrollHeight, Math.round(rect.height), 200);

  return await html2canvas(element, {
    scale: 2, // Độ phân giải sắc nét 2x
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      // 1. Cố định kích thước phần tử gốc được clone
      clonedElement.style.width = `${width}px`;
      clonedElement.style.minWidth = `${width}px`;
      clonedElement.style.boxSizing = 'border-box';

      // 2. Chuyển đổi các rules trong style sheets có chứa oklch
      const styleTags = clonedDoc.querySelectorAll('style');
      styleTags.forEach((styleTag) => {
        if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
          try {
            styleTag.textContent = styleTag.textContent.replace(/oklch\([^)]+\)/g, (match) => {
              return convertOklchToRgb(match);
            });
          } catch {}
        }
      });

      // 3. Khử màu oklch trên computed style của tất cả nodes
      const COLOR_PROPS = [
        'color',
        'backgroundColor',
        'borderColor',
        'borderTopColor',
        'borderBottomColor',
        'borderLeftColor',
        'borderRightColor',
        'fill',
        'stroke',
        'outlineColor'
      ] as const;

      const allNodes = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))];
      for (const node of allNodes) {
        if (node instanceof HTMLElement || node instanceof SVGElement) {
          const comp = window.getComputedStyle(node);
          for (const prop of COLOR_PROPS) {
            const val = (comp as any)[prop];
            if (val && typeof val === 'string' && val.includes('oklch')) {
              (node.style as any)[prop] = convertOklchToRgb(val);
            }
          }
        }
      }

      // 4. Khắc phục kích thước SVG của Recharts trong cloned DOM
      const origSvgs = element.querySelectorAll('svg');
      const cloneSvgs = clonedElement.querySelectorAll('svg');
      origSvgs.forEach((origSvg, idx) => {
        const cloneSvg = cloneSvgs[idx];
        if (cloneSvg) {
          const sRect = origSvg.getBoundingClientRect();
          if (sRect.width > 0 && sRect.height > 0) {
            cloneSvg.setAttribute('width', String(Math.round(sRect.width)));
            cloneSvg.setAttribute('height', String(Math.round(sRect.height)));
            cloneSvg.style.width = `${Math.round(sRect.width)}px`;
            cloneSvg.style.height = `${Math.round(sRect.height)}px`;
          }
        }
      });

      const origContainers = element.querySelectorAll('.recharts-responsive-container');
      const cloneContainers = clonedElement.querySelectorAll('.recharts-responsive-container');
      origContainers.forEach((origCont, idx) => {
        const cloneCont = cloneContainers[idx] as HTMLElement;
        if (cloneCont) {
          const cRect = origCont.getBoundingClientRect();
          if (cRect.width > 0 && cRect.height > 0) {
            cloneCont.style.width = `${Math.round(cRect.width)}px`;
            cloneCont.style.height = `${Math.round(cRect.height)}px`;
          }
        }
      });
    }
  });
};

/**
 * Xuất hình ảnh PNG độ phân giải cao 2x từ HTML Element
 */
export const exportChartToPNG = async (
  element: HTMLElement,
  fileName?: string
): Promise<void> => {
  const canvas = await captureElementToCanvas(element);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const name = fileName || `Du_bao_luong_huu_BHXH_${getLocalYYYYMMDD()}.png`;
  link.download = name;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Xuất tài liệu PDF khổ A4 tiêu chuẩn có Quốc hiệu, bảng phân tích và hình ảnh biểu đồ
 */
export const exportPensionProjectionToPDF = async (
  params: ExportPensionPDFParams
): Promise<void> => {
  const {
    chartElement,
    roadmapYears,
    income,
    gender,
    povertyStandard,
    baseSalary,
    nsnnRate,
    dpRate,
    applyCpi,
    breakEvenData,
    agencyName = 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ'
  } = params;

  // 1. Chụp hình ảnh biểu đồ nếu có element
  let chartImgDataUrl: string | null = null;
  if (chartElement) {
    try {
      const canvas = await captureElementToCanvas(chartElement);
      chartImgDataUrl = canvas.toDataURL('image/png');
    } catch (e) {
      console.warn('Không thể chụp biểu đồ sang ảnh cho PDF:', e);
    }
  }

  // 2. Nạp thư viện pdfmake và font tiếng Việt
  const pdfMakeModule = await import('pdfmake/build/pdfmake');
  const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
  const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
  const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
  pdfMake.vfs = pdfFonts?.pdfMake?.vfs || (pdfFonts as any).vfs || pdfFonts;

  const now = new Date();
  const dateStrDisplay = `Ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  const docDefinition: any = {
    pageSize: 'A4',
    pageOrientation: 'portrait',
    pageMargins: [30, 25, 30, 25],
    content: [
      // Header: Quốc hiệu & Đơn vị
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: agencyName.toUpperCase(), bold: true, fontSize: 9.5, color: '#004182' },
              { text: 'HỆ THỐNG QUẢN LÝ AN SINH XÃ HỘI', fontSize: 8, color: '#475569' },
              { text: 'Số: ......... /TB-BHXHTN', fontSize: 8, italics: true, color: '#64748b', margin: [0, 2, 0, 0] }
            ]
          },
          {
            width: '50%',
            alignment: 'center',
            stack: [
              { text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, fontSize: 9.5 },
              { text: 'Độc lập - Tự do - Hạnh phúc', bold: true, fontSize: 9 },
              { text: '-----------------------', color: '#94a3b8', fontSize: 8 },
              { text: `Sông Mã, ${dateStrDisplay}`, italics: true, fontSize: 8, color: '#475569', margin: [0, 2, 0, 0] }
            ]
          }
        ],
        margin: [0, 0, 0, 12]
      },

      // Document Title
      {
        text: 'BẢNG DỰ PHÓNG LƯƠNG HƯU & PHÂN TÍCH ĐIỂM HÒA VỐN AN SINH',
        style: 'docTitle',
        alignment: 'center',
        margin: [0, 0, 0, 2]
      },
      {
        text: 'Chế độ Bảo hiểm xã hội tự nguyện theo Luật BHXH 2024 & Nghị định 159/2025/NĐ-CP',
        style: 'docSubtitle',
        alignment: 'center',
        margin: [0, 0, 0, 12]
      },

      // Section 1: Thông số đăng ký và quy chế tính toán
      {
        table: {
          widths: ['25%', '25%', '25%', '25%'],
          body: [
            [
              { text: 'Mức thu nhập chọn đóng:', bold: true, style: 'cellLabel' },
              { text: formatMoney(income), style: 'cellValue', bold: true, color: '#004182' },
              { text: 'Giới tính đối tượng:', bold: true, style: 'cellLabel' },
              { text: gender === 'female' ? 'Nữ giới' : 'Nam giới', style: 'cellValue' }
            ],
            [
              { text: 'Lộ trình tham gia:', bold: true, style: 'cellLabel' },
              { text: `${roadmapYears} năm (${roadmapYears * 12} tháng)`, style: 'cellValue', bold: true },
              { text: 'Tỷ lệ lương hưu:', bold: true, style: 'cellLabel' },
              { text: `${Math.round((breakEvenData.monthlyPension / (income * (applyCpi ? 1.23 : 1))) * 100 || 45)}% mức bình quân`, style: 'cellValue', bold: true, color: '#047857' }
            ],
            [
              { text: 'Mức NSNN hỗ trợ:', bold: true, style: 'cellLabel' },
              { text: `${nsnnRate}% chuẩn nghèo (${formatMoney(breakEvenData.supportMonthly)}/th)`, style: 'cellValue' },
              { text: 'Chính sách trượt giá:', bold: true, style: 'cellLabel' },
              { text: applyCpi ? 'Có tính hệ số CPI thực tế' : 'Theo sức mua gốc', style: 'cellValue' }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4
        },
        margin: [0, 0, 0, 10]
      },

      // Section 2: Ghi chú pháp lý Luật BHXH 2024
      {
        table: {
          widths: ['100%'],
          body: [
            [
              {
                fillColor: '#f8fafc',
                stack: [
                  {
                    text: 'CĂN CỨ QUY ĐỊNH PHÁP LÝ QUAN TRỌNG (LUẬT BHXH SỐ 41/2024/QH15 & NGHỊ ĐỊNH 159/2025/NĐ-CP):',
                    bold: true,
                    fontSize: 8,
                    color: '#004182',
                    margin: [0, 0, 0, 3]
                  },
                  {
                    text: `1. Thời gian đóng tối thiểu để hưởng lương hưu hàng tháng được rút ngắn xuống còn 15 NĂM (áp dụng từ 01/07/2025).\n` +
                          `2. Theo Khoản 1 Điều 36 Luật BHXH 2024: Ngân sách Nhà nước hỗ trợ tiền đóng tối đa không quá 10 NĂM (120 tháng). Sau 10 năm, người tham gia đóng 100% mức đóng gốc.\n` +
                          `3. Người hưởng lương hưu được cấp THẺ BHYT MIỄN PHÍ suốt đời với quyền lợi chi trả 95% chi phí KCB tại các cơ sở y tế.`,
                    fontSize: 7.5,
                    color: '#334155',
                    lineHeight: 1.2
                  }
                ]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10]
      },

      // Section 3: Bảng cân đối tài chính & Điểm hòa vốn
      {
        table: {
          widths: ['40%', '30%', '30%'],
          body: [
            [
              { text: 'CHỈ TIÊU AN SINH HƯU TRÍ', style: 'tableHeader', alignment: 'left' },
              { text: 'MỨC HÀNG THÁNG', style: 'tableHeader', alignment: 'right' },
              { text: 'TỔNG GIÁ TRỊ TÍCH LŨY', style: 'tableHeader', alignment: 'right' }
            ],
            [
              { text: `1. Tiền cá nhân đóng 10 năm đầu (120 tháng được hỗ trợ):`, style: 'tableCell' },
              { text: `${formatMoney(breakEvenData.personalMonthlyWithSupport)}/tháng`, alignment: 'right', style: 'tableCell' },
              { text: formatMoney(breakEvenData.supportedContributionTotal), alignment: 'right', style: 'tableCell', bold: true }
            ],
            [
              {
                text: breakEvenData.unsupportedYears > 0
                  ? `2. Tiền cá nhân đóng ${breakEvenData.unsupportedYears} năm sau (${breakEvenData.unsupportedYears * 12} tháng đóng 100% gốc):`
                  : `2. Tiền cá nhân đóng các năm tiếp theo:`,
                style: 'tableCell'
              },
              {
                text: breakEvenData.unsupportedYears > 0 ? `${formatMoney(breakEvenData.grossMonthly)}/tháng` : '0 đ',
                alignment: 'right',
                style: 'tableCell'
              },
              { text: formatMoney(breakEvenData.unsupportedContributionTotal), alignment: 'right', style: 'tableCell', bold: true }
            ],
            [
              { text: `TỔNG VỐN CÁ NHÂN THỰC NỘP (${roadmapYears} NĂM):`, bold: true, fillColor: '#eff6ff', style: 'tableCell' },
              { text: '', fillColor: '#eff6ff' },
              { text: formatMoney(breakEvenData.totalContributed), bold: true, color: '#004182', alignment: 'right', fillColor: '#eff6ff', style: 'tableCell' }
            ],
            [
              { text: 'LƯƠNG HƯU HÀNG THÁNG NHẬN ĐƯỢC (TRỌN ĐỜI):', bold: true, fillColor: '#ecfdf5', style: 'tableCell' },
              { text: `${formatMoney(breakEvenData.monthlyPension)}/tháng`, bold: true, color: '#047857', alignment: 'right', fillColor: '#ecfdf5', style: 'tableCell' },
              { text: `${formatMoney(breakEvenData.monthlyPension * 12)}/năm`, bold: true, color: '#047857', alignment: 'right', fillColor: '#ecfdf5', style: 'tableCell' }
            ],
            [
              { text: 'QUYỀN LỢI THẺ BHYT MIỄN PHÍ 95% (TRỌN ĐỜI):', bold: true, fillColor: '#ecfdf5', style: 'tableCell' },
              { text: 'Miễn phí 100%', bold: true, color: '#047857', alignment: 'right', fillColor: '#ecfdf5', style: 'tableCell' },
              { text: `~${formatMoney(breakEvenData.annualBHYTValue)}/năm`, bold: true, color: '#047857', alignment: 'right', fillColor: '#ecfdf5', style: 'tableCell' }
            ],
            [
              { text: 'ĐIỂM HÒA VỐN AN SINH (THỜI GIAN THU HỒI TOÀN BỘ VỐN):', bold: true, fillColor: '#fef3c7', style: 'tableCell' },
              { text: `Khoảng ${breakEvenData.breakEvenYears} năm`, bold: true, color: '#b45309', alignment: 'right', fillColor: '#fef3c7', style: 'tableCell' },
              { text: `${breakEvenData.breakEvenMonthsTotal} tháng nghỉ hưu`, bold: true, color: '#b45309', alignment: 'right', fillColor: '#fef3c7', style: 'tableCell' }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          paddingTop: () => 4,
          paddingBottom: () => 4
        },
        margin: [0, 0, 0, 10]
      },

      // Section 4: Nhúng hình ảnh biểu đồ nếu có
      ...(chartImgDataUrl ? [
        {
          text: 'BIỂU ĐỒ TRỰC QUAN HÓA TÍCH LŨY & DÒNG TIỀN HƯU TRÍ:',
          bold: true,
          fontSize: 8.5,
          color: '#004182',
          margin: [0, 2, 0, 4]
        },
        {
          image: chartImgDataUrl,
          width: 535,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        }
      ] : []),

      // Section 5: Ký tên xác nhận
      {
        columns: [
          {
            width: '50%',
            alignment: 'center',
            stack: [
              { text: 'NGƯỜI THAM GIA ĐĂNG KÝ', bold: true, fontSize: 8.5 },
              { text: '(Ký và ghi rõ họ tên)', italics: true, fontSize: 7.5, color: '#64748b' },
              { text: '\n\n\n\n', fontSize: 8 }
            ]
          },
          {
            width: '50%',
            alignment: 'center',
            stack: [
              { text: 'ĐẠI LÝ THU BHXH SÔNG MÃ', bold: true, fontSize: 8.5 },
              { text: '(Cán bộ tư vấn ký và đóng dấu)', italics: true, fontSize: 7.5, color: '#64748b' },
              { text: '\n\n\n\n', fontSize: 8 }
            ]
          }
        ],
        margin: [0, 5, 0, 0]
      }
    ],
    styles: {
      docTitle: {
        fontSize: 12,
        bold: true,
        color: '#004182'
      },
      docSubtitle: {
        fontSize: 8.5,
        italics: true,
        color: '#475569'
      },
      tableHeader: {
        fontSize: 8,
        bold: true,
        fillColor: '#004182',
        color: '#ffffff'
      },
      tableCell: {
        fontSize: 7.5,
        color: '#1e293b'
      },
      cellLabel: {
        fontSize: 7.5,
        color: '#475569'
      },
      cellValue: {
        fontSize: 7.5,
        color: '#0f172a'
      }
    }
  };

  pdfMake.createPdf(docDefinition).download(
    `Ho_so_du_phong_huu_tri_${roadmapYears}nam_${now.toISOString().slice(0, 10)}.pdf`
  );
};
