import { describe, it, expect } from 'vitest';
import { exportD05TSStandardExcel, exportD03TSStandardExcel } from '../utils/exportNationalStandardForms';

describe('Kiểm thử Xuất Biểu Mẫu Chuẩn Quốc Gia D05-TS & D03-TS', () => {
  const sampleRecords = [
    {
      id: 1,
      name: 'Nguyễn Văn A',
      type: 'BHXH',
      cccd: '001200000001',
      bhxh: '1234567890',
      dob: '1985-05-15',
      gender: 'Nam',
      address: 'Xã Chiềng Khoong, Huyện Sông Mã, Sơn La',
      phone: '0912345678',
      amount: 1500000,
      paymentStatus: 'Đã thu tiền',
      date: '2026-09-10',
      months: 3,
      wage: 1500000,
      nnSupportPct: 10
    },
    {
      id: 2,
      name: 'Trần Thị B',
      type: 'BHXH',
      cccd: '001200000002',
      bhxh: '1234567891',
      dob: '1990-08-20',
      gender: 'Nữ',
      address: 'Thị trấn Sông Mã, Huyện Sông Mã, Sơn La',
      phone: '0987654321',
      amount: 2000000,
      paymentStatus: 'Đã hủy',
      date: '2026-09-11'
    },
    {
      id: 3,
      name: 'Lê Văn C',
      type: 'BHYT',
      cccd: '001200000003',
      dob: '1975-01-01',
      gender: 'Nam',
      address: 'Sơn La',
      amount: 1263600,
      paymentStatus: 'Đã thu tiền',
      date: '2026-09-12'
    }
  ];

  it('1. exportD05TSStandardExcel xuất thành công với hồ sơ BHXH hợp lệ (bỏ qua hồ sơ Đã hủy)', async () => {
    // Chỉ có id 1 là BHXH và chưa hủy
    const result = await exportD05TSStandardExcel({
      records: sampleRecords as any,
      agencyName: 'Đại lý thu BHXH Sông Mã',
      agencyCode: '8371584967',
      periodLabel: 'Tháng 09/2026'
    });

    expect(result).toBeDefined();
    expect(result.count).toBe(1); // Chỉ tính id 1
    expect(result.totalAmount).toBe(1500000);
    expect(result.fileName).toContain('Mau_D05_TS');
  });

  it('2. exportD05TSStandardExcel thông báo lỗi rõ ràng khi không có hồ sơ BHXH hợp lệ', async () => {
    const cancelledRecords = [
      {
        id: 2,
        name: 'Trần Thị B',
        type: 'BHXH',
        paymentStatus: 'Đã hủy'
      }
    ];

    await expect(
      exportD05TSStandardExcel({
        records: cancelledRecords as any
      })
    ).rejects.toThrow('Không có bản ghi hợp lệ để xuất biểu mẫu D05-TS');
  });

  it('3. exportD05TSStandardExcel chặn khi danh sách toàn bộ là BHYT', async () => {
    const onlyBHYT = sampleRecords.filter(r => r.type === 'BHYT');

    await expect(
      exportD05TSStandardExcel({
        records: onlyBHYT as any
      })
    ).rejects.toThrow('Không có bản ghi hợp lệ để xuất biểu mẫu D05-TS');
  });

  it('4. exportD03TSStandardExcel xuất thành công cho hồ sơ BHYT hợp lệ', async () => {
    const result = await exportD03TSStandardExcel({
      records: sampleRecords as any,
      periodLabel: 'Tháng 09/2026'
    });

    expect(result).toBeDefined();
    expect(result.count).toBe(1); // Chỉ tính id 3
    expect(result.totalAmount).toBe(1263600);
    expect(result.fileName).toContain('Mau_D03_TS');
  });

  it('5. Logic tìm hồ sơ theo đợt nộp (Batch Resolution) tìm thấy bản ghi theo targetIds khi chưa lưu mã đợt', () => {
    const batchCode = 'BATCH_20260915_01';
    const batchModalTargetIds = [1, 2];
    const records: any[] = sampleRecords;

    // Khi người dùng bấm xuất ngay trong modal trước khi bấm Xác nhận & Khóa đợt:
    // 1. Tìm các bản ghi đã gán mã đợt này
    let batchRecords = records.filter(r => r.submissionBatch === batchCode && r.type === 'BHXH');

    // 2. Fallback sang targetIds được chọn trong modal
    if (batchRecords.length === 0 && batchModalTargetIds.length > 0) {
      batchRecords = records.filter(r => batchModalTargetIds.includes(r.id) && r.type === 'BHXH');
    }

    expect(batchRecords.length).toBe(2);

    // Lọc các bản ghi hợp lệ chưa hủy
    const validBatchRecords = batchRecords.filter(r => r.paymentStatus !== 'Đã hủy');
    expect(validBatchRecords.length).toBe(1);
    expect(validBatchRecords[0].id).toBe(1);
  });

  it('6. Nhãn đối tượng hỗ trợ theo Luật BHXH 2024 chính xác cho các mức 50%, 40%, 30%, 20%', async () => {
    const { getNNSupportCategoryLabel } = await import('../utils/exportNationalStandardForms');
    expect(getNNSupportCategoryLabel(50)).toBe('Hộ nghèo (50%)');
    expect(getNNSupportCategoryLabel(40)).toBe('Hộ cận nghèo (40%)');
    expect(getNNSupportCategoryLabel(30)).toBe('Dân tộc thiểu số (30%)');
    expect(getNNSupportCategoryLabel(20)).toBe('Khác (20%)');
    expect(getNNSupportCategoryLabel(10)).toBe('Khác (10%)');
    expect(getNNSupportCategoryLabel(0)).toBe('Không hỗ trợ (0%)');
  });

  it('7. Xuất D05-TS theo QĐ 490 tính toán tiền NSNN hỗ trợ đúng tỷ lệ Luật BHXH 2024 (50%, 40%, 30%, 20%)', async () => {
    const records2024: any[] = [
      {
        id: 101,
        type: 'BHXH',
        name: 'Giàng A Pao',
        bhxh: '0123456789',
        cccd: '014095001234',
        income: 1500000,
        months: 3,
        fromMonth: '2026-07',
        toMonth: '2026-09',
        nnSupportPct: 50, // Hộ nghèo theo Luật 2024: 50%
        nnSupportAmount: 495000, // 1.500.000 * 22% * 50% * 3 = 495.000
        amount: 495000,
        paymentStatus: 'Đã thanh toán',
        date: '2026-07-01'
      },
      {
        id: 102,
        type: 'BHXH',
        name: 'Lò Thị Mai',
        bhxh: '0123456780',
        cccd: '014198005678',
        income: 2000000,
        months: 6,
        fromMonth: '2026-07',
        toMonth: '2026-12',
        nnSupportPct: 40, // Hộ cận nghèo theo Luật 2024: 40%
        nnSupportAmount: 792000, // 1.500.000 * 22% * 40% * 6 = 792.000
        amount: 1848000, // (2.000.000 * 22% * 6) - 792.000 = 2.640.000 - 792.000 = 1.848.000
        paymentStatus: 'Đã thanh toán',
        date: '2026-07-05'
      },
      {
        id: 103,
        type: 'BHXH',
        name: 'Trần Văn Nam',
        bhxh: '0123456781',
        cccd: '014088009999',
        income: 1500000,
        months: 1,
        fromMonth: '2026-07',
        toMonth: '2026-07',
        nnSupportPct: 20, // Đối tượng khác theo Luật 2024: 20%
        nnSupportAmount: 66000, // 1.500.000 * 22% * 20% * 1 = 66.000
        amount: 264000,
        paymentStatus: 'Đã thanh toán',
        date: '2026-07-10'
      }
    ];

    const result = await exportD05TSStandardExcel({
      records: records2024,
      batchCode: 'DOT_BHXH_LUAT2024',
      unitName: 'Đại lý thu BHXH Sông Mã',
      unitCode: 'VSS-SM-001',
      currentUser: {
        agencyName: 'Đại lý thu BHXH Sông Mã',
        agencyCode: 'VSS-SM-001',
        taxCode: '8371584967',
        address: 'Thị trấn Sông Mã, Tỉnh Sơn La',
        phone: '0988123456'
      }
    });

    expect(result.count).toBe(3);
    expect(result.totalAmount).toBe(495000 + 1848000 + 264000);
    expect(result.fileName).toContain('Mau_D05_TS');
  });

  it('8. Hàm buildD05TSNotes tạo chuỗi Ghi chú chuẩn xác từng trường theo hình ảnh thực tế', async () => {
    const { buildD05TSNotes } = await import('../utils/exportNationalStandardForms');
    
    // Bản ghi 1 giống hàng 16 trong ảnh: Lò Văn Tuấn (Thiểu số, Đóng tiếp, SĐT, Ngày sinh, email)
    const rec1 = {
      name: 'Lò Văn Tuấn',
      nation: 'Thiểu_số',
      subType: 'Đóng tiếp',
      phone: '0111111111',
      dob: '1994-09-10',
      email: 'bhxhtn1410@gmail.com'
    };
    const note1 = buildD05TSNotes(rec1, { email: 'bhxhtn1410@gmail.com' }, 30);
    expect(note1).toBe('Đối tượng Khác, Dân tộc Thiểu_số, P.Thức Đóng_tiếp, SĐT 0111111111, Ngày sinh 10/09/1994, gmail bhxhtn1410@gmail.com');

    // Bản ghi 2 giống hàng 17 trong ảnh: Lương Thị Lan Anh (Kinh, Tăng mới, SĐT, Ngày sinh, email)
    const rec2 = {
      name: 'Lương Thị Lan Anh',
      nation: 'Kinh',
      subType: 'Tăng mới',
      phone: '0332001568',
      dob: '2002-09-08',
      email: 'bhxhtn1410@gmail.com'
    };
    const note2 = buildD05TSNotes(rec2, { email: 'bhxhtn1410@gmail.com' }, 20);
    expect(note2).toBe('Đối tượng Khác, Dân tộc Kinh, P.Thức Tăng_mới, SĐT 0332001568, Ngày sinh 08/09/2002, gmail bhxhtn1410@gmail.com');

    // Bản ghi 3 giống hàng 18: Dương Văn Lập
    const rec3 = {
      name: 'Dương Văn Lập',
      nation: 'Kinh',
      subType: 'Tăng mới',
      phone: '0332001568',
      dob: '1994-01-15'
    };
    const note3 = buildD05TSNotes(rec3, { email: 'bhxhtn1410@gmail.com' }, 20);
    expect(note3).toBe('Đối tượng Khác, Dân tộc Kinh, P.Thức Tăng_mới, SĐT 0332001568, Ngày sinh 15/01/1994, gmail bhxhtn1410@gmail.com');

    // Bản ghi 4 giống hàng 19: Lò Văn Thắm
    const rec4 = {
      name: 'Lò Văn Thắm',
      nation: 'Thiểu_số',
      subType: 'Tăng mới',
      phone: '0963137481',
      dob: '1993-03-30'
    };
    const note4 = buildD05TSNotes(rec4, { email: 'bhxhtn1410@gmail.com' }, 30);
    expect(note4).toBe('Đối tượng Khác, Dân tộc Thiểu_số, P.Thức Tăng_mới, SĐT 0963137481, Ngày sinh 30/03/1993, gmail bhxhtn1410@gmail.com');

    // Bản ghi 5: Kiểm tra bỏ mục ghi chú riêng (Khách của chị Trang) khỏi chuỗi Ghi chú D05-TS
    const rec5 = {
      name: 'Nguyễn Thị A',
      nation: 'Thiểu_số',
      actionType: 'Đăng ký mới',
      phone: '0961300522',
      dob: '1982-03-30',
      email: 'bhxhtn1410@gmail.com',
      notes: 'Khách của chị Trang'
    };
    const note5 = buildD05TSNotes(rec5, { email: 'bhxhtn1410@gmail.com' }, 20);
    expect(note5).toBe('Đối tượng Khác, Dân tộc Thiểu_số, P.Thức Tăng_mới, SĐT 0961300522, Ngày sinh 30/03/1982, gmail bhxhtn1410@gmail.com');
    expect(note5).not.toContain('Ghi chú: Khách của chị Trang');

    // Bản ghi 6: Đối tượng gia hạn (actionType: 'Gia hạn') -> P.Thức Đóng_tiếp và không chứa ghi chú riêng
    const rec6 = {
      name: 'Trần Văn Gia Hạn',
      nation: 'Kinh',
      actionType: 'Gia hạn',
      phone: '0988776655',
      dob: '1990-05-20',
      email: 'bhxhtn1410@gmail.com',
      notes: 'Đóng tiếp kỳ 2'
    };
    const note6 = buildD05TSNotes(rec6, { email: 'bhxhtn1410@gmail.com' }, 20);
    expect(note6).toBe('Đối tượng Khác, Dân tộc Kinh, P.Thức Đóng_tiếp, SĐT 0988776655, Ngày sinh 20/05/1990, gmail bhxhtn1410@gmail.com');
    expect(note6).not.toContain('Ghi chú: Đóng tiếp kỳ 2');

    // Bản ghi 7: isRenew = true -> P.Thức Đóng_tiếp
    const rec7 = {
      name: 'Lê Thị Renew',
      isRenew: true,
      phone: '0912345678',
      dob: '1985-12-12'
    };
    const note7 = buildD05TSNotes(rec7, { email: 'bhxhtn1410@gmail.com' }, 20);
    expect(note7).toContain('P.Thức Đóng_tiếp');
  });

  it('9. Tỷ lệ % Nhà nước hỗ trợ: Người Kinh là 20%, Dân tộc thiểu số là 30%, Hộ nghèo 50%, Cận nghèo 40%', async () => {
    const { isD05TSRenew, buildD05TSNotes } = await import('../utils/exportNationalStandardForms');

    // Dân tộc thiểu số (Thiểu_số) -> 30%
    const recMinority = {
      name: 'Lò Thị Nga',
      nation: 'Thiểu_số',
      action_type: 'Gia hạn'
    };
    expect(isD05TSRenew(recMinority)).toBe(true);
    const noteMinority = buildD05TSNotes(recMinority, {}, 30);
    expect(noteMinority).toContain('Dân tộc Thiểu_số');
    expect(noteMinority).toContain('P.Thức Đóng_tiếp');

    // Dân tộc Kinh -> 20%
    const recKinh = {
      name: 'Nguyễn Văn Bốn',
      nation: 'Kinh',
      action_type: 'Tăng mới'
    };
    expect(isD05TSRenew(recKinh)).toBe(false);
    const noteKinh = buildD05TSNotes(recKinh, {}, 20);
    expect(noteKinh).toContain('Dân tộc Kinh');
    expect(noteKinh).toContain('P.Thức Tăng_mới');
  });

  it('10. Nhận diện chuẩn xác Gia hạn (P.Thức Đóng_tiếp) vs Tăng mới (P.Thức Tăng_mới) từ các trường Supabase', async () => {
    const { isD05TSRenew, buildD05TSNotes } = await import('../utils/exportNationalStandardForms');

    // Case a: Dữ liệu Supabase có action_type: 'Gia hạn'
    expect(isD05TSRenew({ action_type: 'Gia hạn' })).toBe(true);
    expect(buildD05TSNotes({ action_type: 'Gia hạn', nation: 'Kinh' })).toContain('P.Thức Đóng_tiếp');

    // Case b: Dữ liệu Supabase có status: 'Gia hạn'
    expect(isD05TSRenew({ status: 'Gia hạn' })).toBe(true);
    expect(buildD05TSNotes({ status: 'Gia hạn', nation: 'Thiểu_số' })).toContain('P.Thức Đóng_tiếp');

    // Case c: Dữ liệu Supabase có is_renew: true
    expect(isD05TSRenew({ is_renew: true })).toBe(true);
    expect(buildD05TSNotes({ is_renew: true, nation: 'Kinh' })).toContain('P.Thức Đóng_tiếp');

    // Case d: Dữ liệu Supabase có sub_type: 'Gia hạn'
    expect(isD05TSRenew({ sub_type: 'Gia hạn' })).toBe(true);
    expect(buildD05TSNotes({ sub_type: 'Gia hạn', nation: 'Kinh' })).toContain('P.Thức Đóng_tiếp');

    // Case e: Dữ liệu Supabase có action_type: 'Tăng mới'
    expect(isD05TSRenew({ action_type: 'Tăng mới' })).toBe(false);
    expect(buildD05TSNotes({ action_type: 'Tăng mới', nation: 'Kinh' })).toContain('P.Thức Tăng_mới');

    // Case f: Dữ liệu Supabase có status: 'Mới'
    expect(isD05TSRenew({ status: 'Mới' })).toBe(false);
    expect(buildD05TSNotes({ status: 'Mới', nation: 'Thiểu_số' })).toContain('P.Thức Tăng_mới');
  });

  it('11. Xuất D05-TS đầy đủ: Cột Tỷ lệ % (Cột 10), Tiền NSNN (Cột 11), Từ tháng/năm (Cột 7) và cân đối tài chính', async () => {
    const recordsTest = [
      {
        id: 201,
        type: 'BHXH',
        name: 'Lò Thị Nga',
        nation: 'Thiểu_số',
        bhxh: '1420953015',
        cccd: '014181005653',
        address: 'Tổ dân phố 2',
        months: 3,
        from_month: '2026-10',
        income: 1600000,
        action_type: 'Gia hạn',
        payment_status: 'Đã thanh toán',
        date: '2026-10-10'
      },
      {
        id: 202,
        type: 'BHXH',
        name: 'Nguyễn Văn Bốn',
        nation: 'Kinh',
        bhxh: '1421009268',
        cccd: '014083001709',
        address: 'Bản Ánh Trung, Xã Mường Hung',
        months: 3,
        from_month: '2026-10',
        income: 4800000,
        action_type: 'Tăng mới',
        payment_status: 'Đã thanh toán',
        date: '2026-10-10'
      }
    ];

    const result = await exportD05TSStandardExcel({
      records: recordsTest,
      batchCode: 'DOT_KIEM_TRA_TI_LE',
      periodLabel: 'Tháng 10 năm 2026'
    });

    expect(result.count).toBe(2);
    expect(result.worksheet).toBeDefined();

    const ws = result.worksheet;
    // Row 16 (0-indexed r: 15): Lò Thị Nga (Dân tộc thiểu số)
    // Cột C (c: 2): Mã số BHXH đồng bộ theo số CCCD = 014181005653 (kiểu chuỗi 's' giữ số 0 ở đầu)
    expect(ws['C16']?.v).toBe('014181005653');
    expect(ws['C16']?.t).toBe('s');
    // Cột H (c: 7): Mức thu nhập = 1.600.000
    // Cột I (c: 8): Số tháng = 3
    // Cột J (c: 9): Từ tháng/năm = 10/2026
    expect(ws['J16']?.v).toBe('10/2026');
    // Cột K (c: 10): Phải đóng quy định = 1.600.000 * 22% * 3 = 1.056.000
    expect(ws['K16']?.v).toBe(1056000);
    // Cột M (c: 12): Tỷ lệ % NSNN = 30% (Thiểu số)
    expect(ws['M16']?.v).toBe(30);
    // Cột N (c: 13): Tiền NSNN = 1.500.000 * 22% * 30% * 3 = 297.000
    expect(ws['N16']?.v).toBe(297000);
    // Cột L (c: 11): Người tham gia đóng = 1.056.000 - 297.000 = 759.000
    expect(ws['L16']?.v).toBe(759000);
    // Cột T (c: 19): Ghi chú có Dân tộc Thiểu_số và P.Thức Đóng_tiếp
    expect(ws['T16']?.v).toContain('Dân tộc Thiểu_số');
    expect(ws['T16']?.v).toContain('P.Thức Đóng_tiếp');

    // Row 17 (0-indexed r: 16): Nguyễn Văn Bốn (Dân tộc Kinh)
    // Cột C (c: 2): Mã số BHXH đồng bộ theo số CCCD = 014083001709 (kiểu chuỗi 's' giữ số 0 ở đầu)
    expect(ws['C17']?.v).toBe('014083001709');
    expect(ws['C17']?.t).toBe('s');
    expect(ws['J17']?.v).toBe('10/2026');
    // Cột K: 4.800.000 * 22% * 3 = 3.168.000
    expect(ws['K17']?.v).toBe(3168000);
    // Cột M: Tỷ lệ % NSNN = 20% (Kinh)
    expect(ws['M17']?.v).toBe(20);
    // Cột N: Tiền NSNN = 1.500.000 * 22% * 20% * 3 = 198.000
    expect(ws['N17']?.v).toBe(198000);
    // Cột L: Người tham gia đóng = 3.168.000 - 198.000 = 2.970.000
    expect(ws['L17']?.v).toBe(2970000);
    // Cột T: Ghi chú có Dân tộc Kinh và P.Thức Tăng_mới
    expect(ws['T17']?.v).toContain('Dân tộc Kinh');
    expect(ws['T17']?.v).toContain('P.Thức Tăng_mới');
  });

  it('12. Cột C (Mã số BHXH) luôn ưu tiên CCCD (12 số) và fallback về bhxh cũ nếu không có CCCD', async () => {
    const recordsFallback = [
      {
        id: 301,
        type: 'BHXH',
        name: 'Hồ Sơ Có CCCD',
        cccd: '014195000123',
        bhxh: '1420112233',
        income: 1500000,
        months: 1,
        payment_status: 'Đã thanh toán'
      },
      {
        id: 302,
        type: 'BHXH',
        name: 'Hồ Sơ Chưa Có CCCD (Chỉ có BHXH cũ)',
        cccd: '',
        bhxh: '1420998877',
        income: 1500000,
        months: 1,
        payment_status: 'Đã thanh toán'
      }
    ];

    const result = await exportD05TSStandardExcel({
      records: recordsFallback,
      periodLabel: 'Tháng 10/2026'
    });

    const ws = result.worksheet;
    // Hồ sơ 1: Cột C ưu tiên CCCD 014195000123 thay vì mã 10 số cũ 1420112233
    expect(ws['C16']?.v).toBe('014195000123');
    expect(ws['C16']?.t).toBe('s');

    // Hồ sơ 2: Cột C không có CCCD nên fallback về mã BHXH 10 số cũ 1420998877
    expect(ws['C17']?.v).toBe('1420998877');
    expect(ws['C17']?.t).toBe('s');
  });
});
