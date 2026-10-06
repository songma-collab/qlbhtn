import { describe, it, expect } from 'vitest';
import { 
  normalizeHeaderKey, 
  parseMoneySafe, 
  parseMonthSafe, 
  parseDateSafe, 
  calculateNextPaymentFromToMonth,
  parseExcelRows,
  generateCustomerKeyJs
} from '../utils/excelImportHelper';

describe('Excel Import & Standardization Suite', () => {
  it('1. Chuẩn hóa tiêu đề cột khử hoàn toàn khác biệt Unicode NFC/NFD và dấu tiếng Việt', () => {
    // NFC (dấu gộp)
    const nfcTitle = 'Tổng Tiền';
    // NFD (dấu tách - decomposed)
    const nfdTitle = 'Tô\u0309ng Tiê\u0300n';
    
    expect(normalizeHeaderKey(nfcTitle)).toBe('tongtien');
    expect(normalizeHeaderKey(nfdTitle)).toBe('tongtien');
    expect(normalizeHeaderKey(nfcTitle)).toBe(normalizeHeaderKey(nfdTitle));

    // Thử với các cột tiếng Việt khác
    expect(normalizeHeaderKey('Mức thu nhập')).toBe('mucthunhap');
    expect(normalizeHeaderKey('Phương thức đóng')).toBe('phuongthucdong');
    expect(normalizeHeaderKey('Từ tháng')).toBe('tuthang');
    expect(normalizeHeaderKey('Đến tháng')).toBe('denthang');
    expect(normalizeHeaderKey('Ngân sách NN hỗ trợ')).toBe('ngansachnnhotro');
    expect(normalizeHeaderKey('Chuyển BHXH')).toBe('chuyenbhxh');
    expect(normalizeHeaderKey('Mã BHXH cũ')).toBe('mabhxhcu');
  });

  it('2. Phân tích số tiền an toàn (hỗ trợ chuỗi có định dạng hoặc đơn vị)', () => {
    expect(parseMoneySafe('231000')).toBe(231000);
    expect(parseMoneySafe('231.000')).toBe(231000);
    expect(parseMoneySafe('231,000 đ')).toBe(231000);
    expect(parseMoneySafe(231000)).toBe(231000);
    expect(parseMoneySafe('')).toBe(0);
    expect(parseMoneySafe(null)).toBe(0);
  });

  it('3. Phân tích định dạng kỳ đóng MM/YYYY và tính hạn nộp tiếp', () => {
    expect(parseMonthSafe('09/2026')).toBe('09/2026');
    expect(parseMonthSafe('9/2026')).toBe('09/2026');
    expect(parseMonthSafe('2026-09')).toBe('09/2026');

    // Nếu kỳ đóng đến hết tháng 09/2026 -> Hạn đóng tiếp phải là ngày 15 của tháng 10/2026
    const nextPay = calculateNextPaymentFromToMonth('09/2026', 1);
    expect(nextPay).toBe('2026-10-15');
  });

  it('4. Phân tích trọn vẹn dữ liệu từ dòng Excel giống mẫu thực tế của người dùng (Image 4)', () => {
    const mockStaffList = [
      { id: 'stf-trang', name: 'Nguyễn Thị Trang' },
      { id: 'stf-admin', name: 'Quản trị viên Hệ thống' }
    ];
    const mockPolicies = [
      { code: 'COMMISSION_BHXH_NEW', value: 0.15 }
    ];
    const mockSettings = { defaultCommissionRate: 0.15 };

    const mockRow = {
      'Ngày đăng ký': '10/09/2026',
      'Loại hình': 'BHXH TN',
      'Mã BHXH': '014075009471',
      'Mã BHXH cũ': '1421086846',
      'Họ và Tên': 'Lò Văn Thơm',
      'Ngày sinh': '02/09/1975',
      'Giới tính': 'Nam',
      'Dân tộc': 'Thiểu_số',
      'CCCD': '014075009471',
      'Số điện thoại': '0111111111',
      'Email': 'bhxhtn1421086846@songma.gov.vn',
      'Địa chỉ': 'Bản Co Phung',
      'Mức thu nhập': '1500000',
      'Phương thức đóng': 'Đóng hằng tháng',
      'Số tháng': '1',
      'Từ tháng': '09/2026',
      'Đến tháng': '09/2026',
      'Mức đóng': '330000',
      'Ngân sách NN hỗ trợ': '99000',
      'Địa phương hỗ trợ': '0',
      'Tổng Tiền': '231000',
      'Trạng thái': 'Đã thu tiền',
      'Chuyển BHXH': 'Đã chuyển Đợt 2',
      'Đợt chuyển': 'Đợt 2',
      'Ngày chuyển': '10/09/2026',
      'Nhân viên': 'Nguyễn Thị Trang',
      'Ghi chú': 'Khách của chị Trang'
    };

    const result = parseExcelRows([mockRow], {
      defaultType: 'BHXH',
      staffList: mockStaffList,
      policies: mockPolicies,
      settings: mockSettings,
      currentUserId: 'stf-admin'
    });

    expect(result.records.length).toBe(1);
    expect(result.hasTransactionData).toBe(true);

    const rec = result.records[0]!;
    expect(rec.name).toBe('Lò Văn Thơm');
    expect(rec.cccd).toBe('014075009471');
    expect(rec.bhxh).toBe('014075009471');
    expect(rec.old_bhxh || (rec as any).oldBhxh).toBe('1421086846');
    expect(rec.gender).toBe('Nam');
    expect(rec.nation).toBe('Thiểu_số');
    expect(rec.income).toBe(1500000);
    expect(rec.from_month || (rec as any).fromMonth).toBe('09/2026');
    expect(rec.to_month || (rec as any).toMonth).toBe('09/2026');
    expect(rec.amount).toBe(231000);
    expect(rec.nn_support_amount ?? (rec as any).nnSupportAmount).toBe(99000);
    expect(rec.staff_id || (rec as any).staffId).toBe('stf-trang'); // Tự động khớp nhân viên 'Nguyễn Thị Trang'
    expect(rec.is_submitted_bhxh ?? (rec as any).isSubmittedBHXH).toBe(true);
    expect(rec.submission_batch || (rec as any).submissionBatch).toBe('Đợt 2');
    expect(rec.next_payment || (rec as any).nextPayment).toBe('2026-10-15'); // Tính chính xác hạn nộp tiếp, không hardcode 1 năm
    expect(rec.commission).toBeGreaterThan(0); // Đã tính hoa hồng

    // Kiểm tra hồ sơ danh bạ khách hàng
    expect(result.customerProfiles.length).toBe(1);
    const profile = result.customerProfiles[0]!;
    expect(profile.customer_key).toBe('CUST_CCCD_014075009471');
    expect(profile.name).toBe('Lò Văn Thơm');
    expect(profile.next_payment).toBe('2026-10-15');
  });

  it('5. Sinh Customer Key chính xác theo phân cấp ưu tiên', () => {
    // Có CCCD 12 số
    expect(generateCustomerKeyJs('BHXH', '014075009471', '014075009471', 'Lò Văn Thơm')).toBe('CUST_CCCD_014075009471');
    // Không CCCD, có BHXH 10 số
    expect(generateCustomerKeyJs('BHXH', '1421086846', '', 'Lò Văn Thơm')).toBe('CUST_BHXH_1421086846');
    // Không CCCD, không BHXH, có SĐT + Tên
    expect(generateCustomerKeyJs('BHXH', '', '', 'Lò Văn Thơm', '0912345678')).toBe('CUST_PHONE_0912345678_lo_van_thom');
  });
});
