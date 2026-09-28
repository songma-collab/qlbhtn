import { describe, it, expect } from 'vitest';
import { 
  filterRecords, 
  calculateQuickPillCounts, 
  extractSubmissionBatches, 
  DEFAULT_RECORD_FILTER_STATE,
  RecordFilterState 
} from '../utils/recordFilters';

describe('Kiểm thử Logic Thanh Công Cụ Lọc Hồ Sơ BHXH (Record Filter Scenarios)', () => {
  // Chuẩn bị tập dữ liệu giả định với ngày tháng tương đối so với thời điểm hiện tại
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  // Ngày sắp hết hạn (trong vòng 15 ngày tới)
  const expiringDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
  const expiringDateStr = expiringDate.toISOString().slice(0, 10);

  // Ngày còn hạn xa (60 ngày tới)
  const activeDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const activeDateStr = activeDate.toISOString().slice(0, 10);

  // Ngày đã hết hạn (10 ngày trước)
  const expiredDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const expiredDateStr = expiredDate.toISOString().slice(0, 10);

  // Ngày tháng trước
  const prevMonthDate = new Date(y, now.getMonth() - 1, 15);
  const prevMonthDateStr = prevMonthDate.toISOString().slice(0, 10);

  const mockRecords = [
    {
      id: 1,
      name: 'Nguyễn Văn An',
      cccd: '001200000001',
      bhxh: '7912345678',
      phone: '0901234567',
      staffId: 'staff_1',
      isSubmittedBHXH: false,
      submissionBatch: undefined,
      paymentStatus: 'Đã đóng',
      status: 'Đang tham gia',
      nextPayment: expiringDateStr,
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 2,
      name: 'Trần Thị Bình',
      cccd: '001200000002',
      bhxh: '7923456789',
      phone: '0912345678',
      staffId: 'staff_2',
      isSubmittedBHXH: true,
      submissionBatch: 'DOT_2026_09_01',
      paymentStatus: 'Đã đóng',
      status: 'Đang tham gia',
      nextPayment: activeDateStr,
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 3,
      name: 'Lê Hoàng Cường (Dừng đóng)',
      cccd: '001200000003',
      bhxh: '7934567890',
      phone: '0923456789',
      staffId: 'staff_1',
      isSubmittedBHXH: true,
      submissionBatch: 'DOT_2026_09_01',
      paymentStatus: 'Đã đóng',
      status: 'Đã dừng đóng',
      nextPayment: expiringDateStr, // Nằm trong khoảng sắp hết hạn nhưng đã dừng đóng
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 4,
      name: 'Phạm Minh Dũng (Chờ nộp)',
      cccd: '001200000004',
      bhxh: '7945678901',
      phone: '0934567890',
      staffId: 'staff_2',
      isSubmittedBHXH: false,
      submissionBatch: undefined,
      paymentStatus: 'Chờ thanh toán',
      status: 'Đang tham gia',
      nextPayment: activeDateStr,
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 5,
      name: 'Đặng Thu Giang (Đã hủy)',
      cccd: '001200000005',
      bhxh: '7956789012',
      phone: '0945678901',
      staffId: 'staff_1',
      isSubmittedBHXH: false,
      paymentStatus: 'Đã hủy', // Phải bị loại trừ toàn cục
      status: 'Đang tham gia',
      nextPayment: expiringDateStr,
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 6,
      name: 'Bản ghi điều chỉnh bù',
      cccd: '001200000001',
      isAdjustment: true, // Phải bị loại trừ toàn cục
      paymentStatus: 'Đã đóng',
      nextPayment: expiringDateStr,
      date: todayStr,
      type: 'BHXH'
    },
    {
      id: 7,
      name: 'Vũ Thị Hạnh (Giao dịch tháng trước)',
      cccd: '001200000007',
      bhxh: '7978901234',
      phone: '0978901234',
      staffId: 'staff_1',
      isSubmittedBHXH: true,
      submissionBatch: 'DOT_PREV_MONTH',
      paymentStatus: 'Đã đóng',
      status: 'Đang tham gia',
      nextPayment: expiredDateStr,
      date: prevMonthDateStr,
      type: 'BHXH'
    },
    {
      id: 8,
      name: 'Ngô Thanh Tùng (Đã thu tiền, chưa nộp)',
      cccd: '001200000008',
      bhxh: '7989012345',
      phone: '0989012345',
      staffId: 'staff_1',
      isSubmittedBHXH: false,
      submissionBatch: undefined,
      paymentStatus: 'Đã thu tiền',
      status: 'Đang tham gia',
      nextPayment: activeDateStr,
      date: todayStr,
      type: 'BHXH'
    }
  ];

  describe('1. Quick Filter Pills Logic & Badge Counts', () => {
    it('Đếm số lượng bản ghi chính xác theo từng Quick Pill và loại trừ bản ghi Đã hủy / isAdjustment', () => {
      const counts = calculateQuickPillCounts(mockRecords);

      // Tổng số bản ghi hợp lệ: id 1, 2, 3, 4, 7, 8 = 6 bản ghi (id 5 là Đã hủy, id 6 là isAdjustment)
      expect(counts.ALL).toBe(6);

      // Chưa nộp cơ quan BHXH: id 1 (Đã đóng, chưa nộp), id 8 (Đã thu tiền, chưa nộp) => 2
      expect(counts.UNSUBMITTED).toBe(2);

      // Đã nộp BHXH: id 2, id 3, id 7 => 3
      expect(counts.SUBMITTED).toBe(3);

      // Sắp đến hạn tái tục (< 30 ngày):
      // id 1: còn hạn trong 15 ngày, status = 'Đang tham gia' => ĐƯỢC TÍNH (1)
      // id 3: còn hạn trong 15 ngày, nhưng status = 'Đã dừng đóng' => PHẢI BỊ LOẠI TRỪ (0)
      // id 5: Đã hủy => BỊ LOẠI TRỪ
      // id 7: Đã hết hạn (quá khứ) => không nằm trong [today, today + 30]
      expect(counts.UPCOMING_RENEWAL).toBe(1);

      // Chờ thanh toán: id 4 => 1
      expect(counts.PENDING_PAYMENT).toBe(1);
    });

    it('Lọc chính xác khi chọn Quick Pill UNSUBMITTED', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        quickPill: 'UNSUBMITTED'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(2);
      expect(result.map(r => r.id).sort()).toEqual([1, 8]);
    });

    it('Lọc chính xác khi chọn Trạng thái SUBMITTED (Đã nộp cơ quan BHXH)', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        submissionFilter: 'SUBMITTED'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(3);
      expect(result.map(r => r.id).sort()).toEqual([2, 3, 7]);
    });

    it('Lọc chính xác khi chọn Quick Pill PENDING_PAYMENT', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        quickPill: 'PENDING_PAYMENT'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(4);
    });
  });

  describe('2. Loại trừ hồ sơ "Đã dừng đóng" khi lọc theo UPCOMING_RENEWAL', () => {
    it('Khách hàng "Đã dừng đóng" (id 3) tuyệt đối không xuất hiện trong danh sách UPCOMING_RENEWAL', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        quickPill: 'UPCOMING_RENEWAL'
      };
      const result = filterRecords(mockRecords, filter);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
      expect(result.some(r => r.id === 3)).toBe(false);
      expect(result.some(r => r.status === 'Đã dừng đóng')).toBe(false);
    });
  });

  describe('3. Tìm kiếm theo Từ khóa (Search txt)', () => {
    it('Tìm kiếm theo họ tên có dấu (hỗ trợ case-insensitive và khoảng trắng thừa)', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        searchQuery: '   văn an  '
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('Tìm kiếm theo số CCCD', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        searchQuery: '001200000002'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(2);
    });

    it('Tìm kiếm theo Mã số BHXH', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        searchQuery: '7945678901'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(4);
    });

    it('Tìm kiếm theo Số điện thoại', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        searchQuery: '0978901234'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(7);
    });
  });

  describe('4. Lọc theo Kỳ thời gian (Period Filter)', () => {
    it('Lọc theo Tháng hiện tại (CURRENT_MONTH)', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        periodType: 'CURRENT_MONTH'
      };
      const result = filterRecords(mockRecords, filter);
      // id 1, 2, 3, 4, 8 có date = todayStr (tháng này). id 7 có date = prevMonthDateStr
      expect(result.map(r => r.id).sort()).toEqual([1, 2, 3, 4, 8]);
      expect(result.some(r => r.id === 7)).toBe(false);
    });

    it('Lọc theo Tháng trước (PREV_MONTH)', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        periodType: 'PREV_MONTH'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(7);
    });

    it('Lọc theo Khoảng thời gian tùy chỉnh (CUSTOM)', () => {
      const [fy, fm, fd] = todayStr.split('-');
      const formattedToday = `${fd}/${fm}/${fy}`;

      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        periodType: 'CUSTOM',
        customStartDate: formattedToday,
        customEndDate: formattedToday
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.map(r => r.id).sort()).toEqual([1, 2, 3, 4, 8]);
    });
  });

  describe('5. Trích xuất Đợt nộp (Submission Batches) & Lọc theo Đợt nộp', () => {
    it('Trích xuất danh sách đợt nộp duy nhất đã sắp xếp', () => {
      const batches = extractSubmissionBatches(mockRecords);
      expect(batches).toContain('DOT_2026_09_01');
      expect(batches).toContain('DOT_PREV_MONTH');
    });

    it('Lọc chính xác theo đợt nộp cụ thể', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        submissionFilter: 'DOT_2026_09_01'
      };
      const result = filterRecords(mockRecords, filter);
      expect(result.map(r => r.id).sort()).toEqual([2, 3]);
    });
  });

  describe('6. Lọc theo Nhân viên thu & RBAC Phân quyền', () => {
    it('Admin có thể lọc theo nhân viên cụ thể', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        staffId: 'staff_1'
      };
      const result = filterRecords(mockRecords, filter, {
        currentUser: { role: 'Admin', id: 'admin' }
      });
      // staff_1 gồm: id 1, 3, 7, 8 (id 5 là Đã hủy)
      expect(result.map(r => r.id).sort()).toEqual([1, 3, 7, 8]);
    });

    it('Nhân viên thông thường (non-admin) bị giới hạn chỉ thấy hồ sơ của chính mình', () => {
      const filter: RecordFilterState = {
        ...DEFAULT_RECORD_FILTER_STATE,
        staffId: 'ALL' // Người dùng chọn "Tất cả" nhưng vì là nhân viên thông thường nên bị enforce
      };
      const result = filterRecords(mockRecords, filter, {
        currentUser: { role: 'Nhân viên', id: 'staff_2' }
      });
      // staff_2 gồm: id 2, 4
      expect(result.map(r => r.id).sort()).toEqual([2, 4]);
    });
  });
});
