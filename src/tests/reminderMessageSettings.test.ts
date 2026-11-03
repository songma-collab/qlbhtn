import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  DEFAULT_REMINDER_MESSAGE_TEMPLATES,
  getStoredReminderMessageTemplates,
  storeReminderMessageTemplates,
  extractReminderMessageTemplates,
  renderReminderMessageTemplate,
  mergeSettingsWithVietQR,
  ReminderMessageTemplates
} from '../utils/settingsHelper';
import { generateRenewalMessage } from '../utils/renewalDispatchHelper';

// Mock localStorage
const mockStorage: Record<string, string> = {};

beforeEach(() => {
  for (const key of Object.keys(mockStorage)) {
    delete mockStorage[key];
  }
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mockStorage[k] || null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => {
      for (const key of Object.keys(mockStorage)) {
        delete mockStorage[key];
      }
    }
  });
});

describe('Kiểm thử Cấu hình Mẫu Tin Nhắn Đôn Đốc (Reminder Message Settings)', () => {
  it('1. DEFAULT_REMINDER_MESSAGE_TEMPLATES chứa đầy đủ 6 mẫu tin nhắn theo chuẩn nghiệp vụ', () => {
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhxh).toBeDefined();
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhyt).toBeDefined();
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatch_urgent_bhxh).toBeDefined();
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatch_urgent_bhyt).toBeDefined();
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatch_periodic).toBeDefined();
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatch_confirmed).toBeDefined();

    // Kiểm tra nội dung chứa các biến mẫu quan trọng
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhxh).toContain('{ten_khach_hang}');
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhxh).toContain('{ngay_het_han}');
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhyt).toContain('5 NĂM LIÊN TỤC');
    expect(DEFAULT_REMINDER_MESSAGE_TEMPLATES.dispatch_urgent_bhxh).toContain('Nghị định 158/2025');
  });

  it('2. getStoredReminderMessageTemplates và storeReminderMessageTemplates lưu và nạp đúng từ bộ nhớ', () => {
    // Ban đầu chưa có dữ liệu trong storage -> trả về mặc định
    const initial = getStoredReminderMessageTemplates();
    expect(initial.renewal_bhxh).toBe(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhxh);

    // Lưu template tùy chỉnh mới
    const customTemplate: Partial<ReminderMessageTemplates> = {
      renewal_bhxh: 'Xin chao {ten_khach_hang}, BHXH {ma_so} het han ngay {ngay_het_han}.',
      dispatch_urgent_bhxh: 'Khan cap: {ten_khach_hang} can dong {so_tien} truoc {ngay_het_han}.'
    };
    storeReminderMessageTemplates(customTemplate);

    const reloaded = getStoredReminderMessageTemplates();
    expect(reloaded.renewal_bhxh).toBe('Xin chao {ten_khach_hang}, BHXH {ma_so} het han ngay {ngay_het_han}.');
    expect(reloaded.dispatch_urgent_bhxh).toBe('Khan cap: {ten_khach_hang} can dong {so_tien} truoc {ngay_het_han}.');
    // Các trường không tùy chỉnh vẫn giữ giá trị mặc định
    expect(reloaded.renewal_bhyt).toBe(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhyt);
  });

  it('3. renderReminderMessageTemplate thay thế chính xác các tag biến động và không phân biệt chữ hoa chữ thường', () => {
    const template = 'Kính gửi {TEN_KHACH_HANG}, mã {ma_so}, số tiền {SO_TIEN}, hạn {ngay_het_han}, cán bộ: {ten_can_bo} - {sdt_can_bo}, đại lý: {TEN_DAI_LY}.';
    const data = {
      ten_khach_hang: 'Lò Thị Thuận',
      ma_so: '1420991133',
      so_tien: '319.000 đ',
      ngay_het_han: '31/12/2026',
      ten_can_bo: 'Nguyễn Văn A',
      sdt_can_bo: '0988408996',
      ten_dai_ly: 'Đại lý Sông Mã'
    };

    const rendered = renderReminderMessageTemplate(template, data);
    expect(rendered).toBe('Kính gửi Lò Thị Thuận, mã 1420991133, số tiền 319.000 đ, hạn 31/12/2026, cán bộ: Nguyễn Văn A - 0988408996, đại lý: Đại lý Sông Mã.');
    expect(rendered).not.toContain('{');
    expect(rendered).not.toContain('}');
  });

  it('4. extractReminderMessageTemplates trích xuất chính xác từ policies hoặc settings object', () => {
    // Trích xuất từ Policies list
    const mockPolicies: any[] = [
      { parameter_type: 'base_salary', value: 2340000, is_active: true },
      { 
        parameter_type: 'reminder_message_templates', 
        value: {
          renewal_bhxh: 'Mẫu riêng từ CSDL chính sách cho BHXH {ten_khach_hang}'
        }, 
        is_active: true 
      }
    ];

    const extracted = extractReminderMessageTemplates(mockPolicies as any);
    expect(extracted.renewal_bhxh).toBe('Mẫu riêng từ CSDL chính sách cho BHXH {ten_khach_hang}');
    expect(extracted.renewal_bhyt).toBe(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhyt);

    // Trích xuất khi value là JSON string
    const mockStringPolicies: any[] = [
      { 
        parameter_type: 'reminder_message_templates', 
        value: JSON.stringify({
          renewal_bhyt: 'Mẫu riêng BHYT cho {ten_khach_hang}'
        }), 
        is_active: true 
      }
    ];
    const extractedFromString = extractReminderMessageTemplates(mockStringPolicies as any);
    expect(extractedFromString.renewal_bhyt).toBe('Mẫu riêng BHYT cho {ten_khach_hang}');
  });

  it('5. generateRenewalMessage ưu tiên mẫu tùy chỉnh từ settings và tham số', () => {
    const mockRecord: any = {
      id: 'rec-1',
      customer_id: 'cust-1',
      customer_name: 'Lò Thị Thuận',
      insurance_type: 'BHXH',
      insurance_code: '1420991133',
      citizen_id: '014184014435',
      phone: '0868408996',
      address: 'Bản Nậm Mằn, Sông Mã',
      expiry_date: '2026-12-31',
      total_amount: 319000
    };

    const mockStaff: any = {
      id: 'staff-1',
      full_name: 'Phạm Văn Học',
      phone: '0988408996'
    };

    // Khi truyền customTemplates
    const customTemplates: ReminderMessageTemplates = {
      renewal_bhxh: 'THÔNG BÁO TÙY BIẾN: Chào {ten_khach_hang}, mã {ma_so}, hạn {ngay_het_han}, số tiền {so_tien}, LH: {ten_can_bo} - {sdt_can_bo}.'
    };

    const message = generateRenewalMessage(mockRecord, mockStaff, customTemplates, 'Đại lý Thu BHXH Sông Mã');
    expect(message).toContain('THÔNG BÁO TÙY BIẾN: Chào Lò Thị Thuận');
    expect(message).toContain('mã 1420991133');
    expect(message).toContain('hạn 31/12/2026');
    expect(message).toContain('số tiền 319.000 đ');
    expect(message).toContain('LH: Phạm Văn Học - 0988408996');

    // Khi không truyền customTemplates nhưng có trong localStorage
    storeReminderMessageTemplates({
      renewal_bhxh: 'MẪU TỪ LOCALSTORAGE: {ten_khach_hang} - {so_tien}'
    });
    const messageFromStorage = generateRenewalMessage(mockRecord, mockStaff, undefined, 'Đại lý Thu BHXH Sông Mã');
    expect(messageFromStorage).toContain('MẪU TỪ LOCALSTORAGE: Lò Thị Thuận - 319.000 đ');
  });

  it('6. mergeSettingsWithVietQR hợp nhất và duy trì cấu hình mẫu tin nhắn đôn đốc', () => {
    const rawSettings = {
      baseSalary: 2340000,
      reminder_message_templates: {
        renewal_bhxh: 'Template từ cơ sở dữ liệu'
      }
    };

    const merged = mergeSettingsWithVietQR(rawSettings, []);
    expect(merged.reminder_message_templates).toBeDefined();
    expect(merged.reminder_message_templates?.renewal_bhxh).toBe('Template từ cơ sở dữ liệu');
    expect(merged.reminder_message_templates?.renewal_bhyt).toBe(DEFAULT_REMINDER_MESSAGE_TEMPLATES.renewal_bhyt);
  });

  it('7. Đồng bộ hai chiều (Bi-directional Sync) giữa camelCase và snake_case alias khi lưu hoặc chuẩn hóa', () => {
    // Trường hợp 1: Cập nhật camelCase renewalReminderBHXH
    storeReminderMessageTemplates({
      renewalReminderBHXH: 'Mẫu mới qua camelCase: {ten_khach_hang}'
    });
    const fromStorage1 = getStoredReminderMessageTemplates();
    expect(fromStorage1.renewalReminderBHXH).toBe('Mẫu mới qua camelCase: {ten_khach_hang}');
    expect(fromStorage1.renewal_bhxh).toBe('Mẫu mới qua camelCase: {ten_khach_hang}');

    // Trường hợp 2: Cập nhật snake_case dispatch_urgent_bhxh
    storeReminderMessageTemplates({
      dispatch_urgent_bhxh: 'Mẫu khẩn cấp snake_case: {ten_khach_hang} - {so_tien}'
    });
    const fromStorage2 = getStoredReminderMessageTemplates();
    expect(fromStorage2.dispatchUrgentBHXH).toBe('Mẫu khẩn cấp snake_case: {ten_khach_hang} - {so_tien}');
    expect(fromStorage2.dispatch_urgent_bhxh).toBe('Mẫu khẩn cấp snake_case: {ten_khach_hang} - {so_tien}');

    // Trường hợp 3: Khi truyền một object có cả hai trường nhưng một trường bị sửa đổi
    const customMixed = {
      ...DEFAULT_REMINDER_MESSAGE_TEMPLATES,
      renewalReminderBHXH: 'Nội dung người dùng chỉnh sửa trong form'
    };
    storeReminderMessageTemplates(customMixed);
    const fromStorage3 = getStoredReminderMessageTemplates();
    expect(fromStorage3.renewalReminderBHXH).toBe('Nội dung người dùng chỉnh sửa trong form');
    expect(fromStorage3.renewal_bhxh).toBe('Nội dung người dùng chỉnh sửa trong form');
  });
});
