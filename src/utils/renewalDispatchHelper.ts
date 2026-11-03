/**
 * Tiện ích Quản lý Đôn đốc & Nhắc hạn Gia hạn BHXH / BHYT
 * Phân loại mức độ khẩn cấp, sinh tin nhắn Zalo/SMS chuẩn nghiệp vụ và xuất Excel đôn đốc
 */

import { calculateNextPaymentFromToMonth } from './dateUtils';
import { ReminderMessageTemplates } from '../context/types';
import { DEFAULT_REMINDER_MESSAGE_TEMPLATES, getStoredReminderMessageTemplates, renderReminderMessageTemplate } from './settingsHelper';

export type RenewalUrgency = 'overdue' | 'urgent' | 'warning' | 'upcoming';

export interface RenewalRecordItem {
  record: any;
  diffDays: number;
  urgency: RenewalUrgency;
  urgencyLabel: string;
  urgencyColor: string; // Tailwind color class or hex
  deadlineDate?: string; // YYYY-MM-DD
}

export interface RenewalClassification {
  all: RenewalRecordItem[];
  overdue: RenewalRecordItem[];
  urgent: RenewalRecordItem[];
  warning: RenewalRecordItem[];
  upcoming: RenewalRecordItem[];
  totalActionable: number;
}

/**
 * Phân loại các hồ sơ cần đôn đốc theo 4 cấp độ
 */
export const classifyRenewalRecords = (records: any[]): RenewalClassification => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validRecords = records.filter(r => {
    const toM = r.to_month || r.toMonth;
    const fromM = r.from_month || r.fromMonth;
    const nextPay = r.next_payment || r.nextPayment || ((toM || fromM)
      ? calculateNextPaymentFromToMonth(toM || fromM, r.months || r.method, r.type)
      : null);
    const payStatus = r.payment_status || r.paymentStatus;
    if (!nextPay) return false;
    if (payStatus === 'Đã hủy') return false;
    if (r.status === 'Đã dừng đóng') return false;

    // YÊU CẦU NGHIỆP VỤ: Chỉ hiển thị và thông báo những hồ sơ có số tiền > 0
    // Loại trừ các hồ sơ gốc danh bạ / hồ sơ có số tiền = 0 hoặc không có số tiền thu phí thực tế
    const rawAmt = r.amount !== undefined ? r.amount : (r.latest_amount !== undefined ? r.latest_amount : r.latestAmount);
    const amt = Number(rawAmt);
    if (isNaN(amt) || amt <= 0) return false;

    return true;
  });

  // Lọc lấy bản ghi mới nhất của từng người tham gia (dựa trên CCCD hoặc Mã định danh/Mã BHXH)
  const latestByPerson = new Map<string, any>();
  validRecords.forEach(r => {
    const key = `${r.type || 'BHXH'}_${r.citizenId || r.cccd || r.bhxhCode || r.bhxh || r.bhytCode || r.id}`;
    const existing = latestByPerson.get(key);
    if (!existing) {
      latestByPerson.set(key, r);
    } else {
      const existingDate = new Date(existing.next_payment || existing.nextPayment || existing.date || 0).getTime();
      const currentDate = new Date(r.next_payment || r.nextPayment || r.date || 0).getTime();
      if (currentDate > existingDate) {
        latestByPerson.set(key, r);
      }
    }
  });

  const classifiedList: RenewalRecordItem[] = [];

  latestByPerson.forEach(record => {
    // Phòng vệ: Bắt buộc hồ sơ phải có số tiền > 0
    const rawAmt = record.amount !== undefined ? record.amount : (record.latest_amount !== undefined ? record.latest_amount : record.latestAmount);
    const amt = Number(rawAmt);
    if (isNaN(amt) || amt <= 0) return;

    const toM = record.to_month || record.toMonth;
    const fromM = record.from_month || record.fromMonth;
    const nextPayStr = record.next_payment || record.nextPayment || ((toM || fromM)
      ? calculateNextPaymentFromToMonth(toM || fromM, record.months || record.method, record.type)
      : null);
    if (!nextPayStr) return;
    const nextPayDate = new Date(nextPayStr);
    if (isNaN(nextPayDate.getTime())) return;
    nextPayDate.setHours(0, 0, 0, 0);

    const diffMs = nextPayDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let urgency: RenewalUrgency | null = null;
    let urgencyLabel = '';
    let urgencyColor = '';

    if (diffDays < 0 && Math.abs(diffDays) <= 60) {
      urgency = 'overdue';
      urgencyLabel = `Quá hạn ${Math.abs(diffDays)} ngày`;
      urgencyColor = '#ef4444'; // Red
    } else if (diffDays >= 0 && diffDays <= 7) {
      urgency = 'urgent';
      urgencyLabel = diffDays === 0 ? 'Đến hạn hôm nay' : `Còn ${diffDays} ngày (Khẩn cấp)`;
      urgencyColor = '#f97316'; // Orange
    } else if (diffDays >= 8 && diffDays <= 15) {
      urgency = 'warning';
      urgencyLabel = `Còn ${diffDays} ngày (Cận hạn)`;
      urgencyColor = '#eab308'; // Yellow/Amber
    } else if (diffDays >= 16 && diffDays <= 30) {
      urgency = 'upcoming';
      urgencyLabel = `Còn ${diffDays} ngày (Sắp đến)`;
      urgencyColor = '#3b82f6'; // Blue
    }

    if (urgency) {
      classifiedList.push({
        record,
        diffDays,
        urgency,
        urgencyLabel,
        urgencyColor,
        deadlineDate: nextPayStr
      });
    }
  });

  // Sắp xếp: Ưu tiên quá hạn và những hồ sơ có diffDays nhỏ nhất lên đầu
  classifiedList.sort((a, b) => a.diffDays - b.diffDays);

  const overdue = classifiedList.filter(item => item.urgency === 'overdue');
  const urgent = classifiedList.filter(item => item.urgency === 'urgent');
  const warning = classifiedList.filter(item => item.urgency === 'warning');
  const upcoming = classifiedList.filter(item => item.urgency === 'upcoming');

  return {
    all: classifiedList,
    overdue,
    urgent,
    warning,
    upcoming,
    totalActionable: classifiedList.length
  };
};

/**
 * Sinh mẫu tin nhắn Zalo/SMS chuẩn nghiệp vụ an sinh xã hội
 */
export const generateRenewalMessage = (
  record: any, 
  staffMember?: any,
  customTemplates?: ReminderMessageTemplates,
  agencyNameInput?: string
): string => {
  const isBHYT = record.type === 'BHYT' || record.insurance_type === 'BHYT';
  const name = record.name || record.fullName || record.customer_name || record.customerName || 'Quý khách';
  const code = isBHYT 
    ? (record.bhytCode || record.code || record.bhyt || record.insurance_code || 'Chưa cập nhật') 
    : (record.bhxhCode || record.code || record.bhxh || record.insurance_code || 'Chưa cập nhật');
  
  let formattedDate = 'sắp tới';
  const toM = record.to_month || record.toMonth;
  const fromM = record.from_month || record.fromMonth;
  const rawNext = record.next_payment || record.nextPayment || record.expiry_date || record.deadlineDate || ((toM || fromM)
    ? calculateNextPaymentFromToMonth(toM || fromM, record.months || record.method, record.type)
    : null);
  if (rawNext) {
    const d = new Date(rawNext);
    if (!isNaN(d.getTime())) {
      formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
  }

  const staffName = (typeof staffMember === 'string'
    ? staffMember
    : (staffMember?.name || staffMember?.full_name || staffMember?.fullName)) || 'Bộ phận Quản lý Khách hàng';
  const staffPhone = (typeof staffMember === 'object'
    ? (staffMember?.phone || staffMember?.phoneNumber)
    : undefined) || '0988.408.996';
  const agencyName = agencyNameInput || 'Điểm thu BHXH, BHYT Sông Mã';
  const amt = Number(record.amount !== undefined ? record.amount : (record.total_amount !== undefined ? record.total_amount : (record.latest_amount || 0))) || 0;
  const amountStr = amt > 0 ? amt.toLocaleString('vi-VN') + ' đ' : '0 đ';

  const tpls = customTemplates || getStoredReminderMessageTemplates();
  const templateStr = (isBHYT
    ? (tpls?.renewalReminderBHYT || tpls?.renewal_bhyt || DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewalReminderBHYT)
    : (tpls?.renewalReminderBHXH || tpls?.renewal_bhxh || DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewalReminderBHXH)) || '';

  return renderReminderMessageTemplate(templateStr, {
    ten_khach_hang: name,
    ma_so: code,
    ngay_het_han: formattedDate,
    so_tien: amountStr,
    ten_can_bo: staffName,
    sdt_can_bo: staffPhone,
    ten_dai_ly: agencyName,
    loai_hinh: isBHYT ? 'BHYT' : 'BHXH'
  });
};

/**
 * Xuất danh sách hồ sơ đôn đốc ra file Excel chuẩn nghiệp vụ
 */
export const exportRenewalListToExcel = async (
  items: RenewalRecordItem[],
  filterTitle: string = 'Toàn bộ danh sách cần đôn đốc',
  staffList?: any[]
) => {
  const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));

  const now = new Date();
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Chuẩn bị dữ liệu bảng
  const headerRows = [
    ['ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ', '', '', '', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM'],
    ['BỘ PHẬN ĐÔN ĐỐC & CSKH', '', '', '', 'Độc lập - Tự do - Hạnh phúc'],
    [''],
    ['DANH SÁCH KHÁCH HÀNG ĐẾN HẠN ĐÔN ĐỐC GIA HẠN BHXH / BHYT'],
    [`(Phân loại: ${filterTitle} - Ngày trích xuất: ${dateStr})`],
    ['']
  ];

  const tableHeaders = [
    'STT',
    'Họ và tên',
    'Số CCCD/Định danh',
    'Mã số BHXH / BHYT',
    'Số điện thoại',
    'Địa chỉ',
    'Loại hình',
    'Ngày đến hạn',
    'Tình trạng hạn',
    'Mức độ',
    'Dự kiến thu (VNĐ)',
    'Nhân viên quản lý',
    'Ghi chú'
  ];

  const dataRows = items.map((item, index) => {
    const r = item.record;
    const toM = r.to_month || r.toMonth;
    const fromM = r.from_month || r.fromMonth;
    const np = r.next_payment || r.nextPayment || ((toM || fromM)
      ? calculateNextPaymentFromToMonth(toM || fromM, r.months || r.method, r.type)
      : null);

    let nextPayStr = '';
    if (np) {
      const d = new Date(np);
      if (!isNaN(d.getTime())) {
        nextPayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }

    const urgencyMap: Record<RenewalUrgency, string> = {
      overdue: 'ĐÃ QUÁ HẠN',
      urgent: 'KHẨN CẤP (≤7 ngày)',
      warning: 'CẬN HẠN (8-15 ngày)',
      upcoming: 'SẮP ĐẾN (16-30 ngày)'
    };

    const amt = Number(r.amount !== undefined ? r.amount : (r.latest_amount !== undefined ? r.latest_amount : 0)) || 0;
    const amountStr = amt > 0 ? amt.toLocaleString('vi-VN') + ' đ' : '0 đ';

    const staffId = r.staff_id || r.staffId;
    const matchedStaff = staffList?.find((s: any) => 
      s.id === staffId || s.username === staffId || s.staffCode === staffId || s.code === staffId
    );
    const resolvedStaffName = r.staffName || r.staff || matchedStaff?.name || (staffId ? staffId : '');

    const noteText = r.notes || r.note || r.contactNote || '';

    return [
      index + 1,
      r.name || r.fullName || '',
      r.citizenId || r.cccd || '',
      r.type === 'BHYT' ? (r.bhytCode || r.code || '') : (r.bhxhCode || r.code || ''),
      r.phone || '',
      r.address || '',
      r.type || 'BHXH',
      nextPayStr,
      item.urgencyLabel,
      urgencyMap[item.urgency],
      amountStr,
      resolvedStaffName,
      noteText
    ];
  });

  const fullSheetData = [...headerRows, tableHeaders, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(fullSheetData);

  // Định dạng độ rộng cột
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 24 }, // Họ tên
    { wch: 16 }, // CCCD
    { wch: 18 }, // Mã BHXH/BHYT
    { wch: 14 }, // SĐT
    { wch: 30 }, // Địa chỉ
    { wch: 10 }, // Loại hình
    { wch: 14 }, // Ngày đến hạn
    { wch: 22 }, // Tình trạng hạn
    { wch: 20 }, // Mức độ
    { wch: 18 }, // Dự kiến thu
    { wch: 22 }, // Nhân viên quản lý
    { wch: 28 }  // Ghi chú
  ];

  // Merge headers
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 0, c: 4 }, e: { r: 0, c: 9 } },
    { s: { r: 1, c: 4 }, e: { r: 1, c: 9 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 12 } }
  ];

  // Áp dụng style
  const fontName = 'Times New Roman';
  
  if (ws['A1']) {
    ws['A1'].s = { font: { name: fontName, bold: true, sz: 11 }, alignment: { horizontal: 'center' } };
  }
  if (ws['A2']) {
    ws['A2'].s = { font: { name: fontName, sz: 10 }, alignment: { horizontal: 'center' } };
  }
  if (ws['E1']) {
    ws['E1'].s = { font: { name: fontName, bold: true, sz: 11 }, alignment: { horizontal: 'center' } };
  }
  if (ws['E2']) {
    ws['E2'].s = { font: { name: fontName, italic: true, sz: 10 }, alignment: { horizontal: 'center' } };
  }
  if (ws['A4']) {
    ws['A4'].s = { font: { name: fontName, bold: true, sz: 15, color: { rgb: '004182' } }, alignment: { horizontal: 'center' } };
  }
  if (ws['A5']) {
    ws['A5'].s = { font: { name: fontName, italic: true, sz: 10 }, alignment: { horizontal: 'center' } };
  }

  // Style Header hàng 7 (index r=6)
  const headerRowIdx = 6;
  for (let c = 0; c < tableHeaders.length; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        font: { name: fontName, bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '004182' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        }
      };
    }
  }

  // Style Data rows
  dataRows.forEach((_, rowOffset) => {
    const rIdx = headerRowIdx + 1 + rowOffset;
    const item = items[rowOffset];
    const isOverdue = item?.urgency === 'overdue';
    const isUrgent = item?.urgency === 'urgent';

    for (let c = 0; c < tableHeaders.length; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: rIdx, c });
      if (ws[cellRef]) {
        let align: any = 'left';
        if (c === 0 || c === 6 || c === 7) align = 'center';
        if (c === 2 || c === 3 || c === 4) align = 'center';
        if (c === 10) align = 'right';

        let fontColor = '333333';
        if (isOverdue && (c === 8 || c === 9)) fontColor = 'DC2626';
        if (isUrgent && (c === 8 || c === 9)) fontColor = 'EA580C';

        ws[cellRef].s = {
          font: { name: fontName, sz: 10, bold: c === 1 || c === 8 || c === 9, color: { rgb: fontColor } },
          alignment: { horizontal: align, vertical: 'center' },
          fill: rowOffset % 2 === 1 ? { fgColor: { rgb: 'F8FAFC' } } : undefined,
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };
      }
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DonDocGiaHan');
  XLSX.writeFile(wb, `Danh_sach_don_doc_gia_han_${new Date().getTime()}.xlsx`);
};
