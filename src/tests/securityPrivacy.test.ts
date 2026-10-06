import { describe, it, expect } from 'vitest';
import { maskCCCD, maskPhone, maskBHXH, maskName, maskAddress, sanitizeInput } from '../utils/security';

describe('Kiểm thử An toàn Thông tin & Bảo vệ Dữ liệu Cá nhân (Security & PII Protection Suite)', () => {

  describe('1. Kiểm thử Mặt nạ Dữ liệu Cá nhân (Data Masking - Nghị định 13/2023/NĐ-CP)', () => {
    const rawCCCD = '001200001234';
    const rawPhone = '0912345678';
    const rawBHXH = '7912345678';
    const rawName = 'Nguyễn Văn An';
    const rawAddress = 'Số 15 Tổ 3, Phường Quyết Thắng, TP. Sơn La';

    it('Người dùng Admin xem đầy đủ thông tin (Không bị che)', () => {
      expect(maskCCCD(rawCCCD, true)).toBe('001200001234');
      expect(maskPhone(rawPhone, true)).toBe('0912345678');
      expect(maskBHXH(rawBHXH, true)).toBe('7912345678');
      expect(maskName(rawName, true)).toBe('Nguyễn Văn An');
      expect(maskAddress(rawAddress, true)).toBe('Số 15 Tổ 3, Phường Quyết Thắng, TP. Sơn La');
    });

    it('Nhân viên thông thường (Staff/non-Admin) bị che số CCCD đúng chuẩn (001******234)', () => {
      const masked = maskCCCD(rawCCCD, false);
      expect(masked).toBe('001******234');
      expect(masked).toHaveLength(12);
      expect(masked.startsWith('001')).toBe(true);
      expect(masked.endsWith('234')).toBe(true);
      expect(masked.includes('******')).toBe(true);
    });

    it('Che đúng chuẩn CMND cũ 9 chữ số', () => {
      const masked = maskCCCD('012345678', false);
      expect(masked).toBe('01*****78');
    });

    it('Nhân viên bị che Số điện thoại đúng chuẩn (091****678)', () => {
      const masked = maskPhone(rawPhone, false);
      expect(masked).toBe('091****678');
      expect(masked.startsWith('091')).toBe(true);
      expect(masked.endsWith('678')).toBe(true);
    });

    it('Nhân viên bị che Mã số BHXH đúng chuẩn (79*****678)', () => {
      const masked = maskBHXH(rawBHXH, false);
      expect(masked).toBe('79*****678');
      expect(masked.startsWith('79')).toBe(true);
      expect(masked.endsWith('678')).toBe(true);
    });

    it('Che tên đệm khách hàng cho nhân viên (Nguyễn *** An)', () => {
      const masked = maskName(rawName, false);
      expect(masked).toBe('Nguyễn *** An');
    });

    it('Che số nhà và ngõ xóm chi tiết trong địa chỉ (***, Phường Quyết Thắng, TP. Sơn La)', () => {
      const masked = maskAddress(rawAddress, false);
      expect(masked).toBe('***, Phường Quyết Thắng, TP. Sơn La');
    });

    it('Xử lý an toàn các trường hợp biên: null, undefined, chuỗi rỗng', () => {
      expect(maskCCCD(null, false)).toBe('---');
      expect(maskPhone(undefined, false)).toBe('---');
      expect(maskBHXH('', false)).toBe('---');
      expect(maskName(null, false)).toBe('---');
      expect(maskAddress('', false)).toBe('---');
    });
  });

  describe('2. Phòng chống XSS & Sanitize Dữ liệu Đầu vào (OWASP Top 10)', () => {
    it('Loại bỏ thẻ <script> độc hại', () => {
      const malicious = 'Nguyễn Văn A <script>alert("XSS")</script>';
      const cleaned = sanitizeInput(malicious);
      expect(cleaned).toBe('Nguyễn Văn A');
      expect(cleaned.includes('<script>')).toBe(false);
    });

    it('Loại bỏ thẻ <iframe> đánh cắp giao diện (Clickjacking / Phishing)', () => {
      const malicious = 'Khách hàng <iframe src="http://evil.com"></iframe> hợp lệ';
      const cleaned = sanitizeInput(malicious);
      expect(cleaned).toBe('Khách hàng  hợp lệ');
      expect(cleaned.includes('<iframe>')).toBe(false);
    });

    it('Loại bỏ giao thức javascript: và event handlers (onerror, onclick)', () => {
      const malicious = '<img src="x" onerror="alert(1)" /> javascript:stealCookie()';
      const cleaned = sanitizeInput(malicious);
      expect(cleaned.includes('javascript:')).toBe(false);
      expect(cleaned.includes('onerror=')).toBe(false);
    });
  });

  describe('3. Kiểm thử Nguyên tắc Bất biến Nhật ký Kiểm toán (Append-Only Simulation)', () => {
    interface AuditLogEntry {
      id: number;
      action: string;
      details: string;
      timestamp: string;
    }

    class MockImmutableAuditStore {
      private logs: AuditLogEntry[] = [];

      public insert(entry: AuditLogEntry) {
        this.logs.push(Object.freeze({ ...entry }));
      }

      public update(_id: number, _newData: Partial<AuditLogEntry>) {
        // Mô phỏng Trigger trg_auditlog_append_only
        throw new Error('BẢO MẬT HỆ THỐNG: Bảng nhật ký kiểm toán (auditlogs) là dữ liệu bất biến (Append-Only). Mọi hành vi UPDATE hoặc DELETE đều bị nghiêm cấm theo luật định!');
      }

      public delete(_id: number) {
        // Mô phỏng Trigger trg_auditlog_append_only
        throw new Error('BẢO MẬT HỆ THỐNG: Bảng nhật ký kiểm toán (auditlogs) là dữ liệu bất biến (Append-Only). Mọi hành vi UPDATE hoặc DELETE đều bị nghiêm cấm theo luật định!');
      }

      public getAll() {
        return [...this.logs];
      }
    }

    it('Cho phép ghi log mới vào hệ thống', () => {
      const store = new MockImmutableAuditStore();
      store.insert({ id: 1, action: 'Đăng nhập', details: 'Nhân viên A đăng nhập', timestamp: new Date().toISOString() });
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0]!.action).toBe('Đăng nhập');
    });

    it('Chặn đứng và ném ngoại lệ khi cố ý UPDATE bản ghi nhật ký kiểm toán', () => {
      const store = new MockImmutableAuditStore();
      store.insert({ id: 1, action: 'Xuất Excel', details: 'Xuất danh sách 500 khách hàng', timestamp: new Date().toISOString() });

      expect(() => {
        store.update(1, { action: 'Hành động giả mạo' });
      }).toThrowError(/bất biến/i);
    });

    it('Chặn đứng và ném ngoại lệ khi cố ý DELETE bản ghi nhật ký kiểm toán', () => {
      const store = new MockImmutableAuditStore();
      store.insert({ id: 1, action: 'Xóa hồ sơ', details: 'Xóa hồ sơ trái phép', timestamp: new Date().toISOString() });

      expect(() => {
        store.delete(1);
      }).toThrowError(/bất biến/i);
    });
  });

  describe('4. Kiểm thử Quy chuẩn Hiển thị Mặt nạ PII trên Giao diện (CRM & CustomerTable UI)', () => {
    const rawCccd = '014197003460';
    const rawPhone = '0984180479';
    const rawBhxh = '7912345678';

    it('Khi chế độ che giấu PII đang bật (isPIIMasked = true), dữ liệu phải được che bất kể vai trò người dùng', () => {
      const isPIIMasked = true;
      const isRowRevealed = false;
      const isFullyRevealed = !isPIIMasked || isRowRevealed;

      expect(isFullyRevealed).toBe(false);

      const displayCccd = isFullyRevealed ? rawCccd : maskCCCD(rawCccd, false);
      const displayPhone = isFullyRevealed ? rawPhone : maskPhone(rawPhone, false);
      const displayBhxh = isFullyRevealed ? rawBhxh : maskBHXH(rawBhxh, false);

      expect(displayCccd).toBe('014******460');
      expect(displayPhone).toBe('098****479');
      expect(displayBhxh).toBe('79*****678');
    });

    it('Khi bấm con mắt ở từng dòng (isRowRevealed = true), dòng đó được mở riêng biệt', () => {
      const isPIIMasked = true;
      const revealedRowIds = new Set([101]);

      // Row 101 được mở
      const isRow101Revealed = !isPIIMasked || revealedRowIds.has(101);
      expect(isRow101Revealed).toBe(true);
      expect(isRow101Revealed ? rawCccd : maskCCCD(rawCccd, false)).toBe('014197003460');

      // Row 102 vẫn bị che
      const isRow102Revealed = !isPIIMasked || revealedRowIds.has(102);
      expect(isRow102Revealed).toBe(false);
      expect(isRow102Revealed ? rawCccd : maskCCCD(rawCccd, false)).toBe('014******460');
    });

    it('Khi người dùng bấm nút PII trên thanh công cụ để mở toàn bộ (isPIIMasked = false), tất cả hiển thị rõ', () => {
      const isPIIMasked = false;
      const isRowRevealed = false;
      const isFullyRevealed = !isPIIMasked || isRowRevealed;

      expect(isFullyRevealed).toBe(true);
      expect(isFullyRevealed ? rawCccd : maskCCCD(rawCccd, false)).toBe('014197003460');
      expect(isFullyRevealed ? rawPhone : maskPhone(rawPhone, false)).toBe('0984180479');
    });
  });

});
