import { describe, it, expect } from 'vitest';
import { 
  DEFAULT_VIETQR_CONFIG, 
  POPULAR_VIETNAMESE_BANKS, 
  generateVietQRUrl, 
  buildTransferSyntax, 
  buildZaloReminderMessage, 
  validateBankAccount, 
  removeVietnameseTones,
  CustomerReminderInfo,
  VietQRConfig
} from '../utils/vietqr';
import { checkVietQRSettingsPermission } from '../utils/security';

describe('Kiểm thử Tích hợp Cấu hình VietQR Đại lý & Sinh Mã Thanh toán Động (VietQR Integration Suite)', () => {

  describe('1. Cấu hình Mặc định & Danh mục Ngân hàng Chuẩn NAPAS', () => {
    it('Cấu hình mặc định DEFAULT_VIETQR_CONFIG có đầy đủ thông tin chuẩn xác', () => {
      expect(DEFAULT_VIETQR_CONFIG.bankBin).toBe('970422');
      expect(DEFAULT_VIETQR_CONFIG.bankId).toBe('MB');
      expect(DEFAULT_VIETQR_CONFIG.accountNo).toBe('0868123456');
      expect(DEFAULT_VIETQR_CONFIG.accountNumber).toBe('0868123456');
      expect(DEFAULT_VIETQR_CONFIG.accountName).toBe('DAI LY THU BHXH SONG MA');
      expect(DEFAULT_VIETQR_CONFIG.accountHolder).toBe('DAI LY THU BHXH SONG MA');
      expect(DEFAULT_VIETQR_CONFIG.agencyName).toBe('Đại lý thu BHXH Sông Mã');
      expect(DEFAULT_VIETQR_CONFIG.agencyCode).toBe('VSS-SM-001');
      expect(DEFAULT_VIETQR_CONFIG.qrTemplate).toBe('compact2');
    });

    it('Danh mục POPULAR_VIETNAMESE_BANKS chứa đầy đủ các ngân hàng lớn với mã BIN chính xác', () => {
      const mb = POPULAR_VIETNAMESE_BANKS.find(b => b.shortName === 'MB');
      const vcb = POPULAR_VIETNAMESE_BANKS.find(b => b.shortName === 'VCB' || b.name.includes('Vietcombank'));
      const icb = POPULAR_VIETNAMESE_BANKS.find(b => b.shortName === 'CTG' || b.name.includes('VietinBank'));
      const bidv = POPULAR_VIETNAMESE_BANKS.find(b => b.shortName === 'BIDV');
      const agri = POPULAR_VIETNAMESE_BANKS.find(b => b.shortName === 'VBA' || b.name.includes('Agribank'));

      expect(mb).toBeDefined();
      expect(mb?.bin).toBe('970422');

      expect(vcb).toBeDefined();
      expect(vcb?.bin).toBe('970436');

      expect(icb).toBeDefined();
      expect(icb?.bin).toBe('970415');

      expect(bidv).toBeDefined();
      expect(bidv?.bin).toBe('970418');

      expect(agri).toBeDefined();
      expect(agri?.bin).toBe('970405');
    });
  });

  describe('2. Sinh Đường dẫn Mã VietQR Động theo Chuẩn NAPAS 247', () => {
    it('Sinh URL VietQR mặc định khi không truyền cấu hình mới', () => {
      const url = generateVietQRUrl({
        amount: 500000,
        content: 'BHXH 0141930150 NGUYEN VAN A 0912345678'
      });

      expect(url).toContain('https://img.vietqr.io/image/970422-0868123456-compact2.png');
      expect(url).toContain('amount=500000');
      expect(url).toContain('accountName=' + encodeURIComponent('DAI LY THU BHXH SONG MA'));
      expect(url).toContain('addInfo=' + encodeURIComponent('BHXH 0141930150 NGUYEN VAN A 0912345678'));
    });

    it('Sinh URL VietQR động khi Quản trị viên đổi Ngân hàng sang Vietcombank và số tài khoản mới', () => {
      const dynamicConfig: VietQRConfig = {
        agencyName: 'Đại lý thu BHXH TP Sơn La',
        agencyCode: 'VSS-SL-002',
        bankBin: '970436', // Vietcombank
        bankId: 'Vietcombank',
        bankName: 'Vietcombank (Ngoại Thương Việt Nam)',
        accountNumber: '1029384756',
        accountHolder: 'CONG TY CP CONG DONG SON LA',
        qrTemplate: 'compact'
      };

      const url = generateVietQRUrl({
        bankBin: dynamicConfig.bankBin,
        bankId: dynamicConfig.bankId,
        accountNo: dynamicConfig.accountNumber,
        accountHolder: dynamicConfig.accountHolder,
        amount: 1544400,
        content: 'BHYT 7912345678 TRAN THI B 0987654321',
        qrTemplate: dynamicConfig.qrTemplate
      });

      expect(url).toContain('https://img.vietqr.io/image/970436-1029384756-compact.png');
      expect(url).toContain('amount=1544400');
      expect(url).toContain('accountName=' + encodeURIComponent('CONG TY CP CONG DONG SON LA'));
      expect(url).toContain('addInfo=' + encodeURIComponent('BHYT 7912345678 TRAN THI B 0987654321'));
    });

    it('Tự động tra cứu mã BIN từ bankId nếu bankBin không được truyền trực tiếp', () => {
      const url = generateVietQRUrl({
        bankId: 'Techcombank',
        accountNo: '190333888999',
        accountName: 'HO TRUONG AN',
        amount: 297000,
        content: 'BHXH TEST'
      });

      // Techcombank có BIN là 970407
      expect(url).toContain('https://img.vietqr.io/image/970407-190333888999-compact2.png');
    });

    it('Loại bỏ dấu tiếng Việt trong tên chủ tài khoản và nội dung chuyển khoản', () => {
      const rawHolder = 'Nguyễn Thị Ánh Tuyết';
      const rawContent = 'Đóng tiền BHXH tự nguyện tháng 10';
      const cleanHolder = removeVietnameseTones(rawHolder).toUpperCase();
      const cleanContent = removeVietnameseTones(rawContent).toUpperCase();

      expect(cleanHolder).toBe('NGUYEN THI ANH TUYET');
      expect(cleanContent).toBe('DONG TIEN BHXH TU NGUYEN THANG 10');

      const url = generateVietQRUrl({
        accountName: cleanHolder,
        content: cleanContent,
        amount: 2000000
      });

      expect(url).toContain('accountName=' + encodeURIComponent('NGUYEN THI ANH TUYET'));
      expect(url).toContain('addInfo=' + encodeURIComponent('DONG TIEN BHXH TU NGUYEN THANG 10'));
    });
  });

  describe('3. Phân quyền Quản trị & Ràng buộc Bảo mật (RBAC Settings)', () => {
    it('Cho phép Quản trị viên (Admin) cập nhật cấu hình tài khoản ngân hàng VietQR', () => {
      const adminUser = { id: 'admin-1', role: 'Admin', status: 'Hoạt động' };
      const res = checkVietQRSettingsPermission(adminUser);

      expect(res.allowed).toBe(true);
      expect(res.reason).toBeUndefined();
    });

    it('Từ chối Nhân viên (Staff) sửa thông tin tài khoản đại lý', () => {
      const staffUser = { id: 'staff-1', role: 'Staff', status: 'Hoạt động' };
      const res = checkVietQRSettingsPermission(staffUser);

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Chỉ Quản trị viên (Admin)');
    });

    it('Từ chối Kế toán hoặc vai trò khác không phải Admin', () => {
      const accountantUser = { id: 'acc-1', role: 'Kế toán', status: 'Hoạt động' };
      const res = checkVietQRSettingsPermission(accountantUser);

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Chỉ Quản trị viên (Admin)');
    });

    it('Từ chối tài khoản chưa đăng nhập hoặc bị Tạm khóa', () => {
      expect(checkVietQRSettingsPermission(null).allowed).toBe(false);
      expect(checkVietQRSettingsPermission(undefined).allowed).toBe(false);

      const lockedAdmin = { id: 'admin-locked', role: 'Admin', status: 'Tạm khóa' };
      expect(checkVietQRSettingsPermission(lockedAdmin).allowed).toBe(false);
    });
  });

  describe('4. Kiểm tra Định dạng Dữ liệu Đầu vào (Validation)', () => {
    it('validateBankAccount chấp nhận số tài khoản hợp lệ từ 6 đến 20 chữ số', () => {
      expect(validateBankAccount('0914193015').valid).toBe(true);
      expect(validateBankAccount('1029384756').valid).toBe(true);
      expect(validateBankAccount('123456').valid).toBe(true);
      expect(validateBankAccount('12345678901234567890').valid).toBe(true);
    });

    it('validateBankAccount từ chối số tài khoản rỗng, có chữ cái hoặc sai độ dài', () => {
      expect(validateBankAccount('').valid).toBe(false);
      expect(validateBankAccount('12345').valid).toBe(false); // < 6 ký tự
      expect(validateBankAccount('123456789012345678901').valid).toBe(false); // > 20 ký tự
      expect(validateBankAccount('0914ABCD15').valid).toBe(false); // có chữ cái
      expect(validateBankAccount('0914-193-015').valid).toBe(false); // có ký tự đặc biệt
    });

    it('buildTransferSyntax tạo đúng cú pháp chuẩn: [LOAI_BH] [MA_BHXH/CCCD] [HO_TEN] [SO_DIEN_THOAI]', () => {
      const syntax = buildTransferSyntax('BHXH', '0141930150', 'Nguyễn Văn An', '0912345678');
      expect(syntax).toBe('BHXH 0141930150 NGUYEN VAN AN 0912345678');

      const syntaxBHYT = buildTransferSyntax('BHYT', '7912345678', 'Trần Thị Bình', '0987654321');
      expect(syntaxBHYT).toBe('BHYT 7912345678 TRAN THI BINH 0987654321');
    });
  });

  describe('5. Sinh Thông điệp Zalo Nhắc Nợ/Đôn đốc Động theo Cấu hình Đại lý', () => {
    it('buildZaloReminderMessage nhúng chính xác thông tin ngân hàng và đại lý mới', () => {
      const reminder: CustomerReminderInfo = {
        name: 'Hoàng Văn Cường',
        phone: '0977112233',
        type: 'BHXH',
        code: '1234567890',
        amount: 297000,
        nextPayment: '2026-10-15',
        months: 6,
        daysRemaining: 5,
        staffName: 'Lò Thị Hoa',
        staffPhone: '0988776655'
      };

      const customConfig: VietQRConfig = {
        agencyName: 'Đại lý thu BHXH Mộc Châu',
        agencyCode: 'VSS-MC-003',
        bankBin: '970415', // VietinBank
        bankId: 'VietinBank',
        bankName: 'VietinBank (Công Thương Việt Nam)',
        accountNumber: '113002889999',
        accountHolder: 'DAI LY THU MOC CHAU',
        qrTemplate: 'compact2'
      };

      const zalo = buildZaloReminderMessage(reminder, customConfig, 'urgent_7');

      expect(zalo.title).toContain('[SẮP HẾT HẠN - CÒN 5 NGÀY]');
      expect(zalo.content).toContain('Ngân hàng: VietinBank (Công Thương Việt Nam)');
      expect(zalo.content).toContain('Số tài khoản: 113002889999');
      expect(zalo.content).toContain('Chủ tài khoản: DAI LY THU MOC CHAU');
      expect(zalo.content).toContain('Đại lý thu BHXH Mộc Châu sẵn sàng hỗ trợ');
      expect(zalo.qrUrl).toContain('https://img.vietqr.io/image/970415-113002889999-compact2.png');
      expect(zalo.zaloLink).toBe('https://zalo.me/0977112233');
    });
  });
});
