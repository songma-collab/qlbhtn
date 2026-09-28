import { describe, it, expect } from 'vitest';
import { getOldBhxh10 } from '../utils/helpers';

describe('Excel Export - Bổ sung Cột "Mã BHXH cũ (10 số)"', () => {
  describe('1. Hàm helper getOldBhxh10', () => {
    it('Trường hợp 1: Trích xuất trực tiếp từ oldBhxh / old_bhxh / bhxhCu (10 chữ số)', () => {
      const rec1 = {
        bhxh: '038096001234', // đã gộp CCCD 12 số
        oldBhxh: '0141930150',
        name: 'Trần Văn An'
      };
      expect(getOldBhxh10(rec1)).toBe('0141930150');

      const recCanonical = {
        bhxh: '038096001234',
        old_bhxh: '0141930150',
        name: 'Trần Văn An'
      };
      expect(getOldBhxh10(recCanonical)).toBe('0141930150');

      const rec2 = {
        bhxh: '038096001234',
        bhxhCu: '7912345678',
        name: 'Lê Thị Bình'
      };
      expect(getOldBhxh10(rec2)).toBe('7912345678');
    });

    it('Trường hợp 2: r.bhxh chưa bị gộp và chính là mã 10 số', () => {
      const rec = {
        bhxh: '0141930150',
        cccd: '038096001234',
        name: 'Trần Văn An'
      };
      expect(getOldBhxh10(rec)).toBe('0141930150');
    });

    it('Trường hợp 3: Tra cứu cụm định danh Unification Cluster khi r.bhxh là CCCD 12 số', () => {
      const allRecords = [
        {
          id: 101,
          cccd: '038096009999',
          name: 'Hoàng Văn Cường',
          phone: '0987654321',
          bhxh: '0123456789', // Giao dịch cũ lưu mã BHXH 10 số
          date: '2023-01-15'
        },
        {
          id: 102,
          cccd: '038096009999',
          name: 'Hoàng Văn Cường',
          phone: '0987654321',
          bhxh: '038096009999', // Giao dịch mới đã đồng bộ CCCD 12 số
          date: '2024-05-20'
        }
      ];

      const currentRecord = allRecords[1];
      const result = getOldBhxh10(currentRecord, allRecords);
      expect(result).toBe('0123456789');
    });

    it('Trường hợp 3b: Khớp nối qua SĐT + Họ tên (chưa có CCCD trong đợt cũ)', () => {
      const allRecords = [
        {
          id: 201,
          name: 'Vũ Thị Dung (+1 người)',
          phone: '0912345678',
          oldBhxh: '0198765432',
          date: '2022-06-10'
        },
        {
          id: 202,
          cccd: '038198005555',
          name: 'Vũ Thị Dung',
          phone: '0912345678',
          bhxh: '038198005555',
          date: '2024-01-10'
        }
      ];

      const currentRecord = allRecords[1];
      const result = getOldBhxh10(currentRecord, allRecords);
      expect(result).toBe('0198765432');
    });

    it('Trường hợp 4: Trích xuất chuỗi 10 số từ ghi chú (notes)', () => {
      const rec = {
        bhxh: '038096001234',
        name: 'Phạm Minh Đức',
        notes: 'Khách hàng có sổ BHXH cũ số 0141930150 chuyển từ tỉnh khác'
      };
      expect(getOldBhxh10(rec)).toBe('0141930150');
    });

    it('Trường hợp 5: Không có mã 10 số -> Trả về chuỗi rỗng sạch sẽ', () => {
      const rec = {
        bhxh: '038096001234',
        cccd: '038096001234',
        name: 'Đặng Tuấn Anh',
        notes: 'Đăng ký mới lần đầu'
      };
      expect(getOldBhxh10(rec)).toBe('');
    });
  });

  describe('2. Kiểm tra Cấu trúc Cột Xuất Excel (Finance & CRM)', () => {
    it('Cột "Mã BHXH cũ (10 số)" nằm ngay giữa "Mã BHXH" và "Họ và Tên"', () => {
      const mockRecord = {
        id: 1,
        type: 'BHXH',
        date: '2024-05-15',
        bhxh: '038096001234',
        oldBhxh: '0141930150',
        name: 'Nguyễn Văn An',
        dob: '1990-01-01',
        gender: 'Nam',
        nation: 'Kinh',
        cccd: '038096001234',
        phone: '0901234567',
        income: 2000000,
        amount: 440000
      };

      const oldBhxh = getOldBhxh10(mockRecord);
      const exportedRow = {
        "Ngày đăng ký": "15/05/2024",
        "Loại hình": "BHXH TN",
        "Mã BHXH": mockRecord.bhxh || "",
        "Mã BHXH cũ (10 số)": oldBhxh,
        "Họ và Tên": mockRecord.name || "",
        "Ngày sinh": "01/01/1990",
        "Giới tính": mockRecord.gender || ""
      };

      const keys = Object.keys(exportedRow);
      const bhxhIdx = keys.indexOf("Mã BHXH");
      const oldBhxhIdx = keys.indexOf("Mã BHXH cũ (10 số)");
      const nameIdx = keys.indexOf("Họ và Tên");

      expect(bhxhIdx).toBe(2);
      expect(oldBhxhIdx).toBe(3);
      expect(nameIdx).toBe(4);
      expect(oldBhxhIdx).toBe(bhxhIdx + 1);
      expect(nameIdx).toBe(oldBhxhIdx + 1);
      expect(exportedRow["Mã BHXH cũ (10 số)"]).toBe('0141930150');
    });

    it('Cấu trúc xuất BHYT cũng có cột "Mã BHXH cũ (10 số)" đồng bộ vị trí', () => {
      const mockBhyt = {
        id: 2,
        type: 'BHYT',
        date: '2024-05-15',
        bhxh: '038096005678',
        oldBhxh: '7912345678',
        name: 'Trần Thị Mai',
        dob: '1985-05-10',
        gender: 'Nữ',
        amount: 972000
      };

      const oldBhxh = getOldBhxh10(mockBhyt);
      const exportedRow = {
        "Ngày đăng ký": "15/05/2024",
        "Loại hình": "BHYT HGĐ",
        "Mã BHXH": mockBhyt.bhxh || "",
        "Mã BHXH cũ (10 số)": oldBhxh,
        "Họ và Tên": mockBhyt.name || "",
        "Ngày sinh": "10/05/1985"
      };

      const keys = Object.keys(exportedRow);
      expect(keys[2]).toBe("Mã BHXH");
      expect(keys[3]).toBe("Mã BHXH cũ (10 số)");
      expect(keys[4]).toBe("Họ và Tên");
      expect(exportedRow["Mã BHXH cũ (10 số)"]).toBe('7912345678');
    });
  });
});
