/**
 * Module Tích hợp Thanh toán Số VietQR Chuẩn NAPAS 247 & Kịch bản Nhắc hạn Zalo/SMS
 */
import { formatMoney, formatDateVN } from './helpers';

export interface VietQRConfig {
  agencyName?: string;
  agencyCode?: string;
  bankBin?: string;
  bankId?: string;
  bankName?: string;
  accountNo?: string;
  accountNumber?: string;
  accountName?: string;
  accountHolder?: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print' | string;
  qrTemplate?: 'compact' | 'compact2' | 'qr_only' | 'print' | string;
}

export interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

export const POPULAR_VIETNAMESE_BANKS: BankOption[] = [
  { bin: '970422', shortName: 'MB', name: 'MB (Ngân hàng Quân Đội)' },
  { bin: '970436', shortName: 'VCB', name: 'Vietcombank (Ngân hàng Ngoại thương Việt Nam)' },
  { bin: '970415', shortName: 'CTG', name: 'VietinBank (Ngân hàng Công thương Việt Nam)' },
  { bin: '970418', shortName: 'BIDV', name: 'BIDV (Ngân hàng Đầu tư và Phát triển Việt Nam)' },
  { bin: '970405', shortName: 'VBA', name: 'Agribank (Ngân hàng Nông nghiệp & PTNT)' },
  { bin: '970407', shortName: 'TCB', name: 'Techcombank (Ngân hàng Kỹ thương Việt Nam)' },
  { bin: '970416', shortName: 'ACB', name: 'ACB (Ngân hàng Á Châu)' },
  { bin: '970432', shortName: 'VPB', name: 'VPBank (Ngân hàng Việt Nam Thịnh Vượng)' },
  { bin: '970423', shortName: 'TPB', name: 'TPBank (Ngân hàng Tiên Phong)' },
  { bin: '970437', shortName: 'HDB', name: 'HDBank (Ngân hàng Phát triển TP.HCM)' },
  { bin: '970403', shortName: 'STB', name: 'Sacombank (Ngân hàng Sài Gòn Thương Tín)' },
  { bin: '970441', shortName: 'VIB', name: 'VIB (Ngân hàng Quốc tế)' },
  { bin: '970443', shortName: 'SHB', name: 'SHB (Ngân hàng Sài Gòn - Hà Nội)' },
  { bin: '970426', shortName: 'MSB', name: 'MSB (Ngân hàng Hàng Hải)' },
  { bin: '970448', shortName: 'OCB', name: 'OCB (Ngân hàng Phương Đông)' },
  { bin: '970449', shortName: 'LPB', name: 'LPBank (Ngân hàng Bưu điện Liên Việt)' },
  { bin: '970440', shortName: 'SSB', name: 'SeABank (Ngân hàng Đông Nam Á)' }
];

export const DEFAULT_VIETQR_CONFIG: VietQRConfig = {
  agencyName: 'Đại lý thu BHXH Sông Mã',
  agencyCode: 'VSS-SM-001',
  bankBin: '970422',
  bankId: 'MB',
  bankName: 'MB (Ngân hàng Quân Đội)',
  accountNo: '0868123456',
  accountNumber: '0868123456',
  accountName: 'DAI LY THU BHXH SONG MA',
  accountHolder: 'DAI LY THU BHXH SONG MA',
  template: 'compact2',
  qrTemplate: 'compact2'
};

/**
 * Kiểm tra tính hợp lệ của số tài khoản ngân hàng (6 - 20 chữ số)
 */
export const validateBankAccount = (accountNumber?: string): { valid: boolean; error?: string } => {
  if (!accountNumber || accountNumber.trim() === '') {
    return { valid: false, error: 'Số tài khoản không được để trống.' };
  }
  const clean = accountNumber.trim().replace(/\s+/g, '');
  if (!/^\d{6,20}$/.test(clean)) {
    return { valid: false, error: 'Số tài khoản phải gồm từ 6 đến 20 chữ số.' };
  }
  return { valid: true };
};

/**
 * Loại bỏ dấu tiếng Việt để tạo chuỗi thanh toán ngân hàng an toàn (ASCII chỉ chữ hoa, số và khoảng trắng)
 */
export const removeVietnameseTones = (str: string): string => {
  if (!str) return '';
  let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'));
  s = s.replace(/[^a-zA-Z0-9\s]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
};

/**
 * Sinh cú pháp chuyển khoản định danh chuẩn ngân hàng:
 * [LOẠI] [MÃ BHXH/CCCD] [HỌ TÊN] [SĐT]
 * Ví dụ: BHXH 0141930150 NGUYEN VAN A 0912345678
 */
export const buildTransferSyntax = (
  type: string = 'BHXH',
  code: string = '',
  name: string = '',
  phone: string = ''
): string => {
  const cleanType = (type || 'BHXH').toUpperCase().replace(/[^A-Z]/g, '');
  const cleanCode = (code || '').trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanName = removeVietnameseTones(name).toUpperCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');

  let syntax = `${cleanType} ${cleanCode} ${cleanName} ${cleanPhone}`.trim();
  syntax = syntax.replace(/\s+/g, ' ');

  // Hầu hết ngân hàng giới hạn nội dung chuyển khoản 50 ký tự
  if (syntax.length > 50) {
    const compactName = cleanName.split(' ').slice(-2).join(' '); // Giữ họ hoặc tên ngắn
    syntax = `${cleanType} ${cleanCode} ${compactName} ${cleanPhone}`.trim();
  }

  return syntax.substring(0, 50);
};

/**
 * Tạo URL mã VietQR động trực tiếp chuẩn NAPAS 247
 * Định dạng: https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<DESCRIPTION>&accountName=<ACCOUNT_NAME>
 */
export const generateVietQRUrl = ({
  bankBin,
  bankId,
  accountNo,
  accountNumber,
  accountName,
  accountHolder,
  amount,
  content,
  template,
  qrTemplate
}: {
  bankBin?: string;
  bankId?: string;
  accountNo?: string;
  accountNumber?: string;
  accountName?: string;
  accountHolder?: string;
  amount: number;
  content: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print' | string;
  qrTemplate?: 'compact' | 'compact2' | 'qr_only' | 'print' | string;
}): string => {
  let resolvedBin = bankBin;
  if (!resolvedBin && bankId) {
    const cleanBank = bankId.trim().toLowerCase();
    const found = POPULAR_VIETNAMESE_BANKS.find(
      b => b.shortName.toLowerCase() === cleanBank || 
           b.bin === cleanBank || 
           b.name.toLowerCase().includes(cleanBank)
    );
    if (found) {
      resolvedBin = found.bin;
    }
  }

  const bankIdentifier = resolvedBin || bankBin || bankId || DEFAULT_VIETQR_CONFIG.bankBin || DEFAULT_VIETQR_CONFIG.bankId || '970422';
  const cleanAccount = (accountNumber || accountNo || DEFAULT_VIETQR_CONFIG.accountNumber || '').trim();
  const effectiveTemplate = qrTemplate || template || DEFAULT_VIETQR_CONFIG.qrTemplate || 'compact2';
  const validAmount = Math.max(0, Math.round(amount || 0));
  const encodedContent = encodeURIComponent(content || '');
  const rawHolder = accountHolder || accountName || DEFAULT_VIETQR_CONFIG.accountHolder || '';
  const encodedAccountName = encodeURIComponent(rawHolder);

  return `https://img.vietqr.io/image/${bankIdentifier}-${cleanAccount}-${effectiveTemplate}.png?amount=${validAmount}&addInfo=${encodedContent}&accountName=${encodedAccountName}`;
};

export type SLALevel = 'overdue' | 'urgent_7' | 'warning_15' | 'notice_30' | 'safe';

export const calculateSLALevel = (daysRemaining: number): SLALevel => {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 7) return 'urgent_7';
  if (daysRemaining <= 15) return 'warning_15';
  if (daysRemaining <= 30) return 'notice_30';
  return 'safe';
};

export interface CustomerReminderInfo {
  name?: string;
  customerName?: string;
  phone?: string;
  type?: 'BHXH' | 'BHYT' | string;
  code?: string; // BHXH hoặc CCCD
  cccd?: string;
  bhxh?: string;
  amount: number;
  nextPayment?: string;
  dueDate?: string;
  months?: number;
  daysRemaining?: number;
  slaStatus?: string;
  staffName?: string;
  staffPhone?: string;
}

/**
 * Xây dựng nội dung tin nhắn nhắc hạn Zalo / SMS cá nhân hóa theo cấp độ SLA
 */
export const buildZaloReminderMessage = (
  info: CustomerReminderInfo,
  qrConfig: VietQRConfig = DEFAULT_VIETQR_CONFIG,
  explicitSlaLevel?: SLALevel
): { title: string; content: string; message: string; transferSyntax: string; qrUrl: string; zaloLink: string } => {
  const daysLeft = typeof info.daysRemaining === 'number' ? info.daysRemaining : 0;
  const slaLevel = explicitSlaLevel || calculateSLALevel(daysLeft);
  const effectiveType = info.type || 'BHXH';
  const typeText = effectiveType === 'BHYT' ? 'Bảo hiểm Y tế Hộ gia đình' : 'Bảo hiểm Xã hội Tự nguyện';
  const shortType = effectiveType === 'BHYT' ? 'BHYT' : 'BHXH';
  const cleanPhone = (info.phone || '').replace(/\D/g, '');
  const rawDate = info.nextPayment || info.dueDate || '';
  const dueDateStr = rawDate ? formatDateVN(rawDate) : 'sắp tới';
  const formattedAmount = formatMoney(info.amount);
  const effectiveName = info.name || info.customerName || 'Quý khách';
  const effectiveCode = info.code || info.bhxh || info.cccd || '';

  const bankDisplay = qrConfig.bankName || qrConfig.bankId || DEFAULT_VIETQR_CONFIG.bankName;
  const accountNumDisplay = qrConfig.accountNumber || qrConfig.accountNo || DEFAULT_VIETQR_CONFIG.accountNumber;
  const accountHolderDisplay = qrConfig.accountHolder || qrConfig.accountName || DEFAULT_VIETQR_CONFIG.accountHolder;
  const agencyDisplay = qrConfig.agencyName || DEFAULT_VIETQR_CONFIG.agencyName || 'Đại lý thu BHXH';

  const transferSyntax = buildTransferSyntax(shortType, effectiveCode, effectiveName, info.phone);
  const qrUrl = generateVietQRUrl({
    bankBin: qrConfig.bankBin,
    bankId: qrConfig.bankId,
    accountNo: qrConfig.accountNo,
    accountNumber: qrConfig.accountNumber,
    accountName: qrConfig.accountName,
    accountHolder: qrConfig.accountHolder,
    amount: info.amount,
    content: transferSyntax,
    qrTemplate: qrConfig.qrTemplate || qrConfig.template
  });

  let urgencyTitle = '';
  let urgencyWarning = '';

  switch (slaLevel) {
    case 'overdue':
      urgencyTitle = `🚨 [KHẨN CẤP] THÔNG BÁO QUÁ HẠN ĐÓNG ${shortType}`;
      urgencyWarning = `⚠️ Thẻ/Sổ của Quý khách ĐÃ QUÁ HẠN ${Math.abs(daysLeft)} ngày (Hạn chót: ${dueDateStr}). Vui lòng nộp tiền ngay để tránh bị gián đoạn quyền lợi khám chữa bệnh BHYT hoặc thời gian tính lương hưu BHXH!`;
      break;
    case 'urgent_7':
      urgencyTitle = `⏰ [SẮP HẾT HẠN - CÒN ${daysLeft} NGÀY] NHẮC ĐÓNG ${shortType}`;
      urgencyWarning = `Thẻ/Sổ của Quý khách sẽ hết hạn vào ngày ${dueDateStr} (còn ${daysLeft} ngày). Kính mong Quý khách sớm gia hạn để đảm bảo quyền lợi liên tục.`;
      break;
    case 'warning_15':
      urgencyTitle = `🔔 [NHẮC HẠN 15 NGÀY] GIA HẠN ${shortType}`;
      urgencyWarning = `Thời hạn tham gia ${shortType} của Quý khách sẽ đến hạn vào ngày ${dueDateStr} (còn ${daysLeft} ngày).`;
      break;
    case 'notice_30':
    default:
      urgencyTitle = `📋 [THÔNG BÁO KẾ HOẠCH ĐÓNG] ${shortType}`;
      urgencyWarning = `Đại lý kính gửi Quý khách thông tin kỳ đóng tiếp theo đến hạn vào ngày ${dueDateStr} (còn ${daysLeft} ngày).`;
      break;
  }

  const message = `${urgencyTitle}

Kính gửi: ${effectiveName}
Mã định danh/Sổ/CCCD: ${effectiveCode || '---'}
Dịch vụ: ${typeText}

${urgencyWarning}

💵 THÔNG TIN THANH TOÁN:
- Số tiền nộp: ${formattedAmount}
- Thời hạn hưởng: ${info.months || 12} tháng (từ ${dueDateStr})

🏦 HƯỚNG DẪN CHUYỂN KHOẢN QUA NGÂN HÀNG (VIETQR):
- Ngân hàng: ${bankDisplay}
- Số tài khoản: ${accountNumDisplay}
- Chủ tài khoản: ${accountHolderDisplay}
- Nội dung chuyển khoản: ${transferSyntax}

📲 Quét mã VietQR thanh toán nhanh tại: ${qrUrl}

${agencyDisplay} sẵn sàng hỗ trợ Quý khách 24/7.
Cán bộ thu phụ trách: ${info.staffName || 'Đại lý'} ${info.staffPhone ? `(${info.staffPhone})` : ''}.
Trân trọng cảm ơn Quý khách!`;

  return {
    title: urgencyTitle,
    content: message,
    message: message,
    transferSyntax,
    qrUrl,
    zaloLink: cleanPhone ? `https://zalo.me/${cleanPhone}` : ''
  };
};
