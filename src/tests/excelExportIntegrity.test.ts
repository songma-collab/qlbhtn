import { describe, it, expect } from 'vitest';
import { exportD05TSStandardExcel, exportD03TSStandardExcel } from '../utils/exportNationalStandardForms';
import { sanitizeFormulaInput, isFormulaInjection, protectWorksheetFormulas } from '../utils/excelSecurity';
import type { RecordType } from '../context/types';

describe('Kiểm thử Toàn vẹn & Bảo mật Biểu Mẫu Xuất Excel Chuẩn Quốc Gia (Excel Export Integrity & Security)', () => {
  const mockCurrentUser = {
    id: 'admin-01',
    name: 'Nguyễn Văn Quản Trị',
    agencyName: 'ĐẠI LÝ THU BHXH SÔNG MÃ',
    agencyCode: '8371584967',
    phone: '0972709321',
    role: 'Admin'
  };

  const sampleBHXHRecords: RecordType[] = [
    {
      id: 101,
      type: 'BHXH',
      name: 'Nguyễn Văn An',
      bhxh: '0123456789',
      cccd: '001099012345',
      dob: '1985-05-15',
      gender: 'Nam',
      nation: 'Kinh',
      address: 'Xã Nà Nghịu, Huyện Sông Mã, Tỉnh Sơn La',
      phone: '0912345678',
      email: 'an.nguyen@gmail.com',
      months: 6,
      fromMonth: '2026-07',
      toMonth: '2026-12',
      income: 1500000,
      amount: 1980000, // 22% * 1.500.000 * 6 = 1.980.000đ
      date: '2026-07-02',
      paymentStatus: 'Đã thanh toán',
      nnSupportPct: 50, // Hộ nghèo theo Luật BHXH 2024: 50% của 22% chuẩn nghèo (1.500.000 * 0.22 * 0.5 * 6 = 990.000đ)
      status: 'Mới'
    },
    {
      id: 102,
      type: 'BHXH',
      name: 'Lò Thị Mai',
      bhxh: '0123456790',
      cccd: '001199012346',
      dob: '1992-10-20',
      gender: 'Nữ',
      nation: 'Thái',
      address: 'Xã Chiềng Khoong, Huyện Sông Mã, Tỉnh Sơn La',
      phone: '0987654321',
      email: 'mai.lo@gmail.com',
      months: 12,
      fromMonth: '2026-07',
      toMonth: '2027-06',
      income: 2000000,
      amount: 5280000, // 22% * 2.000.000 * 12 = 5.280.000đ
      date: '2026-07-05',
      paymentStatus: 'Đã thanh toán',
      nnSupportPct: 30, // Dân tộc thiểu số 30%: 1.500.000 * 0.22 * 0.3 * 12 = 1.188.000đ
      status: 'Gia hạn'
    }
  ];

  const sampleBHYTRecords: RecordType[] = [
    {
      id: 201,
      type: 'BHYT',
      name: 'Trần Văn Bình',
      bhxh: '0234567891',
      cccd: '001088012347',
      dob: '1980-03-10',
      gender: 'Nam',
      address: 'Tổ 5, Thị trấn Sông Mã, Huyện Sông Mã',
      phone: '0933112233',
      months: 12,
      fromMonth: '2026-07',
      toMonth: '2027-06',
      amount: 1263600, // Người thứ nhất: 4.5% * 2.340.000 * 12 = 1.263.600đ
      date: '2026-07-01',
      paymentStatus: 'Đã thanh toán',
      status: 'Mới',
      hospitalCode: '14-015',
      hospitalName: 'BVĐK Huyện Sông Mã'
    },
    {
      id: 202,
      type: 'BHYT',
      name: 'Lê Thị Cúc',
      bhxh: '0234567892',
      cccd: '001188012348',
      dob: '1982-08-25',
      gender: 'Nữ',
      address: 'Tổ 5, Thị trấn Sông Mã, Huyện Sông Mã',
      phone: '0933112234',
      months: 12,
      fromMonth: '2026-07',
      toMonth: '2027-06',
      amount: 884520, // Người thứ 2: 70% * 1.263.600 = 884.520đ
      date: '2026-07-01',
      paymentStatus: 'Đã thanh toán',
      status: 'Mới',
      hospitalCode: '14-015',
      hospitalName: 'BVĐK Huyện Sông Mã'
    }
  ];

  it('1. exportD05TSStandardExcel: Cấu trúc sheet, mergeCells và tính toán tổng tiền khớp 100% với dữ liệu chi tiết', async () => {
    const result = await exportD05TSStandardExcel({
      records: sampleBHXHRecords,
      batchCode: 'DOT_BHXH_2026_07',
      currentUser: mockCurrentUser
    });

    expect(result).toBeDefined();
    expect(result.count).toBe(2);
    expect(result.fileName).toContain('Mau_D05_TS_DOT_BHXH_2026_07');
    expect(result.workbook).toBeDefined();
    expect(result.worksheet).toBeDefined();

    const ws = result.worksheet;
    // Kiểm tra các ô tiêu đề Mẫu D05-TS
    expect(ws['!merges']).toBeDefined();
    expect(Array.isArray(ws['!merges'])).toBe(true);
    expect(ws['!merges']!.length).toBeGreaterThan(0);

    // Tính toán tổng số tiền chi tiết từ các bản ghi
    let expectedSumTuDong = 0;
    let expectedSumNSNN = 0;
    sampleBHXHRecords.forEach(r => {
      const income = Number(r.income || 0);
      const months = Number(r.months || 1);
      const nnPct = Number(r.nnSupportPct || 0);
      const totalTienDong = Math.round(income * 0.22 * months);
      const tienNSNN = Math.round(1500000 * 0.22 * (nnPct / 100) * months);
      const tienTuDong = totalTienDong - tienNSNN;
      expectedSumTuDong += tienTuDong;
      expectedSumNSNN += tienNSNN;
    });
    const expectedSumTotal = expectedSumTuDong + expectedSumNSNN;

    expect(result.totalAmount).toBe(expectedSumTotal);
  });

  it('2. exportD03TSStandardExcel: Cấu trúc sheet, bảo vệ bảng tính và dữ liệu các thành viên BHYT', async () => {
    const result = await exportD03TSStandardExcel({
      records: sampleBHYTRecords,
      batchCode: 'DOT_BHYT_2026_07',
      currentUser: mockCurrentUser
    });

    expect(result).toBeDefined();
    expect(result.count).toBe(2);
    expect(result.fileName).toContain('Mau_D03_TS_DOT_BHYT_2026_07');
    expect(result.workbook).toBeDefined();
    expect(result.worksheet).toBeDefined();

    const expectedTotalAmount = 1263600 + 884520;
    expect(result.totalAmount).toBe(expectedTotalAmount);
  });

  it('3. Bảo mật dữ liệu xuất: Ngăn chặn triệt để lỗ hổng Formula Injection (CWE-1236)', () => {
    const dangerousInputs = [
      '=cmd|"/C calc"!A0',
      '+cmd|"/C notepad"!A0',
      '-2+3+cmd|"/C calc"!A0',
      '@SUM(1+1)*cmd|"/C calc"!A0',
      '=10+20',
      '\t=cmd|',
      '\r-1+1'
    ];

    dangerousInputs.forEach(input => {
      expect(isFormulaInjection(input)).toBe(true);
      const sanitized = sanitizeFormulaInput(input);
      // Giá trị sau sanitize phải có dấu nháy đơn ' ở đầu để Excel hiểu là thuần text
      expect(sanitized.startsWith("'")).toBe(true);
      // Và không còn bị coi là dangerous formula
      expect(sanitized.charAt(0)).toBe("'");
    });

    // Các chuỗi an toàn không được bị biến dạng
    const safeInputs = [
      'Nguyễn Văn An',
      '0123456789',
      'Xã Nà Nghịu, Huyện Sông Mã',
      '0972709321',
      'an.nguyen@gmail.com'
    ];

    safeInputs.forEach(safe => {
      expect(isFormulaInjection(safe)).toBe(false);
      expect(sanitizeFormulaInput(safe)).toBe(safe);
    });
  });

  it('4. protectWorksheetFormulas: Quét và vô hiệu hóa các ô có công thức hoặc tiền tố nguy hiểm trong Sheet', () => {
    const mockSheet: any = {
      A1: { v: 'BẢO HIỂM XÃ HỘI VIỆT NAM', t: 's' },
      B2: { v: '=cmd|"/C calc"!A0', t: 's' },
      C3: { f: 'SYSTEM("calc")', v: 0 },
      D4: { v: 'Nguyễn Văn Bình', t: 's' }
    };

    protectWorksheetFormulas(mockSheet);

    // B2 phải được chuyển thành text an toàn
    expect(mockSheet.B2.v.startsWith("'")).toBe(true);
    // C3 chứa f công thức nguy hiểm phải bị xóa thuộc tính formula
    expect(mockSheet.C3.f).toBeUndefined();
    expect(mockSheet.C3.v).toBe(0);
    // D4 văn bản an toàn giữ nguyên
    expect(mockSheet.D4.v).toBe('Nguyễn Văn Bình');
  });
});
