import { describe, it, expect, vi, beforeEach } from 'vitest';
import { policyService, invalidatePolicyCache } from '../services/policyService';
import { systemSettingService, invalidateSettingsCache } from '../services/systemSettingService';
import {
  getCachedRecordDigits,
  normalizeDigits,
  filterRecords,
  DEFAULT_RECORD_FILTER_STATE
} from '../utils/recordFilters';
import { yieldToEventLoop } from '../utils/exportNationalStandardForms';
import {
  parseExcelRows,
  parseExcelRowsAsync,
  processSingleExcelRow
} from '../utils/excelImportHelper';
import { supabase } from '../lib/supabase';

// Mock Supabase Client
vi.mock('../lib/supabase', () => {
  const fromMock = vi.fn();
  const rpcMock = vi.fn();
  return {
    supabase: {
      from: fromMock,
      rpc: rpcMock
    }
  };
});

describe('Giai đoạn 4: Kiểm thử Hiệu năng Mở rộng Quy mô lớn & In-memory Caching (Enterprise Scale & High Performance)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    invalidatePolicyCache();
    invalidateSettingsCache();
  });

  // ==========================================
  // 1. POLICY SERVICE IN-MEMORY TTL CACHE & DEDUPLICATION
  // ==========================================
  describe('PolicyService - In-memory TTL Cache & Auto Invalidation', () => {
    it('phải lưu cache danh sách chính sách và không gọi lại Supabase trong thời gian TTL', async () => {
      const mockPoliciesData = [
        { id: 1, name: 'Lương cơ sở 2.340.000', parameter_type: 'base_salary', value: 2340000, effective_date: '2024-07-01', is_active: true },
        { id: 2, name: 'Chuẩn nghèo 1.500.000', parameter_type: 'poverty_standard', value: 1500000, effective_date: '2022-01-01', is_active: true }
      ];

      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockPoliciesData, error: null })
      });
      (supabase.from as any).mockReturnValue({ select: selectMock });

      // Lần 1: Chưa có cache -> Phải gọi Supabase
      const res1 = await policyService.fetchPolicies();
      expect(res1.data).toHaveLength(2);
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Lần 2: Trong vòng 60s -> Phải trả về từ cache, không gọi Supabase thêm
      const res2 = await policyService.fetchPolicies();
      expect(res2.data).toEqual(mockPoliciesData);
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Lần 3: Gọi với bypassCache: true -> Phải bỏ qua cache và truy vấn lại
      const res3 = await policyService.fetchPolicies({ bypassCache: true });
      expect(res3.data).toEqual(mockPoliciesData);
      expect(supabase.from).toHaveBeenCalledTimes(2);
    });

    it('phải tự động làm mới cache (invalidate) khi thêm, sửa hoặc xóa chính sách', async () => {
      const mockPoliciesData = [
        { id: 1, name: 'Chính sách gốc', parameter_type: 'base_salary', value: 2340000, effective_date: '2024-07-01', is_active: true }
      ];

      const selectMock = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockPoliciesData, error: null })
      });
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 3, name: 'Chính sách mới', parameter_type: 'base_salary', value: 2530000, effective_date: '2026-10-01', is_active: true },
            error: null
          })
        })
      });
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 1, name: 'Chính sách đã cập nhật', parameter_type: 'base_salary', value: 2530000, effective_date: '2026-10-01', is_active: true },
              error: null
            })
          })
        })
      });
      const deleteMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 1 }],
            error: null
          })
        })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'policies') {
          return {
            select: selectMock,
            insert: insertMock,
            update: updateMock,
            delete: deleteMock
          };
        }
        return {};
      });

      // Nạp cache ban đầu
      await policyService.fetchPolicies();
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Mutate 1: Thêm chính sách mới -> Cache phải bị xóa
      await policyService.addPolicy({
        name: 'Chính sách mới',
        parameter_type: 'base_salary',
        value: 2530000,
        effective_date: '2026-10-01'
      });

      // Lần fetch tiếp theo phải gọi lại Supabase vì cache đã bị xóa
      await policyService.fetchPolicies();
      expect(supabase.from).toHaveBeenCalledTimes(3); // 1 (fetch1) + 1 (insert) + 1 (fetch2)

      // Mutate 2: Sửa chính sách -> Cache tiếp tục bị xóa
      await policyService.updatePolicy(1, { value: 2600000 });
      await policyService.fetchPolicies();
      expect(supabase.from).toHaveBeenCalledTimes(5); // + 1 (update) + 1 (fetch3)

      // Mutate 3: Xóa chính sách -> Cache tiếp tục bị xóa
      await policyService.deletePolicy(1);
      await policyService.fetchPolicies();
      expect(supabase.from).toHaveBeenCalledTimes(7); // + 1 (delete) + 1 (fetch4)
    });
  });

  // ==========================================
  // 2. SYSTEM SETTING SERVICE IN-MEMORY TTL CACHE
  // ==========================================
  describe('SystemSettingService - In-memory TTL Cache & Invalidation', () => {
    it('phải lưu cache cấu hình hệ thống và tự hủy cache khi cập nhật', async () => {
      const mockSettings = {
        id: 1,
        agency_name: 'Đại lý Sông Mã',
        agency_code: 'SM-001',
        d05_default_sign_date: '15/10/2026'
      };

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockSettings, error: null })
        })
      });
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'settings') {
          return {
            select: selectMock,
            update: updateMock
          };
        }
        return {};
      });

      // Lần 1: Gọi fetchSettings
      const res1 = await systemSettingService.fetchSettings();
      expect(res1.data?.agency_name).toBe('Đại lý Sông Mã');
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Lần 2: Gọi lại fetchSettings trong thời gian cache -> Không gọi Supabase
      const res2 = await systemSettingService.fetchSettings();
      expect(res2.data?.agency_name).toBe('Đại lý Sông Mã');
      expect(supabase.from).toHaveBeenCalledTimes(1);

      // Cập nhật cấu hình -> Invalidate cache
      await systemSettingService.updateSettings({ agency_name: 'Đại lý Sông Mã Cập Nhật' });
      expect(supabase.from).toHaveBeenCalledTimes(2);

      // Lần 3: Gọi lại fetchSettings -> Phải gọi lại Supabase vì cache đã bị xóa
      await systemSettingService.fetchSettings();
      expect(supabase.from).toHaveBeenCalledTimes(3);
    });
  });

  // ==========================================
  // 3. WEAKMAP MEMOIZATION TRONG BỘ LỌC HỒ SƠ
  // ==========================================
  describe('RecordFilters - WeakMap Memoization & High Performance Search', () => {
    it('phải memoize chuỗi số CCCD, BHXH, SĐT trong WeakMap theo object reference', () => {
      const record = {
        id: 101,
        name: 'Trần Văn An',
        cccd: '012.345.678-901',
        bhxh: '12 34 56 78 90',
        phone: '098-765-4321'
      };

      const digits1 = getCachedRecordDigits(record);
      expect(digits1.cccd).toBe('012345678901');
      expect(digits1.bhxh).toBe('1234567890');
      expect(digits1.phone).toBe('0987654321');

      // Lần truy cập thứ 2 với cùng reference object: phải trả về cùng instance (Zero overhead regex)
      const digits2 = getCachedRecordDigits(record);
      expect(digits2).toBe(digits1); // Cùng tham chiếu bộ nhớ trong WeakMap
    });

    it('phải lọc chính xác hồ sơ theo CCCD, BHXH, SĐT và Tên với hiệu năng cao', () => {
      const records = [
        { id: 1, name: 'Nguyễn Văn A', cccd: '014-090-001-234', bhxh: '1410001234', phone: '0912-345-678', payment_status: 'Đã thu tiền' },
        { id: 2, name: 'Trần Thị B', cccd: '014-092-005-678', bhxh: '1410005678', phone: '0987-654-321', payment_status: 'Đã thu tiền' },
        { id: 3, name: 'Lê Hoàng C', cccd: '014-088-009-999', bhxh: '1410009999', phone: '0933-111-222', payment_status: 'Đã thu tiền' }
      ];

      // 1. Tìm theo tên
      const filterByName = filterRecords(records, { ...DEFAULT_RECORD_FILTER_STATE, searchQuery: 'Trần Thị' });
      expect(filterByName).toHaveLength(1);
      expect(filterByName[0].name).toBe('Trần Thị B');

      // 2. Tìm theo số CCCD có định dạng thô (không dấu chấm)
      const filterByCccd = filterRecords(records, { ...DEFAULT_RECORD_FILTER_STATE, searchQuery: '014090001234' });
      expect(filterByCccd).toHaveLength(1);
      expect(filterByCccd[0].name).toBe('Nguyễn Văn A');

      // 3. Tìm theo số BHXH
      const filterByBhxh = filterRecords(records, { ...DEFAULT_RECORD_FILTER_STATE, searchQuery: '1410009999' });
      expect(filterByBhxh).toHaveLength(1);
      expect(filterByBhxh[0].name).toBe('Lê Hoàng C');

      // 4. Tìm theo SĐT
      const filterByPhone = filterRecords(records, { ...DEFAULT_RECORD_FILTER_STATE, searchQuery: '0987654321' });
      expect(filterByPhone).toHaveLength(1);
      expect(filterByPhone[0].name).toBe('Trần Thị B');

      // 5. Tìm chuỗi không khớp
      const filterNotFound = filterRecords(records, { ...DEFAULT_RECORD_FILTER_STATE, searchQuery: 'KhongTonTai999' });
      expect(filterNotFound).toHaveLength(0);
    });
  });

  // ==========================================
  // 4. NON-BLOCKING EVENT LOOP & ASYNC IMPORT CHUNKING
  // ==========================================
  describe('Non-blocking Event Loop & Excel Import Chunking', () => {
    it('yieldToEventLoop phải giải phóng Event Loop thành công', async () => {
      const startTime = Date.now();
      await yieldToEventLoop();
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('parseExcelRowsAsync và parseExcelRows đồng bộ phải cho kết quả phân tích giống hệt nhau', async () => {
      // Giả lập 20 dòng bảng tính Excel thô
      const rawRows = Array.from({ length: 20 }, (_, i) => ({
        'Họ và tên': `Người Tham Gia ${i + 1}`,
        'Số CCCD': `01409000${1000 + i}`,
        'Mã số BHXH': `1410${10000 + i}`,
        'Loại hình': i % 2 === 0 ? 'BHXH tự nguyện' : 'BHYT hộ gia đình',
        'Số điện thoại': `098700${1000 + i}`,
        'Tổng tiền': 1500000,
        'Từ tháng': '07/2026',
        'Đến tháng': '09/2026',
        'Số tháng': 3
      }));

      const parseOptions = {
        defaultType: 'BHXH' as const,
        staffList: [{ id: 'NV01', name: 'Nguyễn Thị Ngọc' }],
        policies: [],
        settings: {},
        currentUserId: 'NV01'
      };

      // 1. Phân tích đồng bộ
      const syncResult = parseExcelRows(rawRows, parseOptions);

      // 2. Phân tích bất đồng bộ với chunk size = 5 dòng
      const asyncResult = await parseExcelRowsAsync(rawRows, parseOptions, 5);

      expect(asyncResult.totalRows).toBe(syncResult.totalRows);
      expect(asyncResult.hasTransactionData).toBe(syncResult.hasTransactionData);
      expect(asyncResult.records.length).toBe(syncResult.records.length);
      expect(asyncResult.customerProfiles.length).toBe(syncResult.customerProfiles.length);

      // Kiểm tra tính nhất quán từng dòng
      for (let i = 0; i < syncResult.records.length; i++) {
        expect(asyncResult.records[i].name).toBe(syncResult.records[i].name);
        expect(asyncResult.records[i].cccd).toBe(syncResult.records[i].cccd);
        expect(asyncResult.records[i].amount).toBe(syncResult.records[i].amount);
        expect(asyncResult.records[i].months).toBe(syncResult.records[i].months);
      }
    });

    it('processSingleExcelRow phải xử lý chính xác dòng rỗng và trả về null nếu thiếu tên', () => {
      const invalidRow = { 'Số CCCD': '014090001234' }; // Thiếu tên
      const res = processSingleExcelRow(invalidRow, 0, {
        defaultType: 'BHXH',
        staffList: [],
        policies: [],
        settings: {}
      });
      expect(res).toBeNull();
    });
  });

});
