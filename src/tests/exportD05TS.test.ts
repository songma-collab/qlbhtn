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
});
