import type { RecordType } from '../context/types';

/**
 * Trạng thái chuẩn hóa của Khách hàng tham gia BHXH & BHYT
 */
export type CustomerStatus = 'Đang tham gia' | 'Đã dừng đóng' | 'Chờ duyệt';

/**
 * Danh mục lý do cán bộ ghi nhận khi khách hàng dừng đóng
 */
export const STOP_CONTRIBUTION_REASONS = [
  'Chuyển sang tham gia BHXH bắt buộc',
  'Đi nước ngoài / Xuất khẩu lao động',
  'Khó khăn tài chính tạm thời',
  'Chuyển nơi cư trú',
  'Đã đủ điều kiện hưởng chế độ hưu trí',
  'Không có nhu cầu tiếp tục tham gia',
  'Lý do khác'
] as const;

export type StopContributionReason = typeof STOP_CONTRIBUTION_REASONS[number];

/**
 * Kiểm tra một khách hàng có đang ở trạng thái dừng đóng hay không
 */
export function isCustomerSuspended(recordOrStatus: RecordType | string | null | undefined): boolean {
  if (!recordOrStatus) return false;
  const status = typeof recordOrStatus === 'string' ? recordOrStatus : recordOrStatus.status;
  return status === 'Đã dừng đóng';
}

/**
 * Kiểm tra một khách hàng có đang duy trì đóng (active) hay không
 */
export function isCustomerActive(recordOrStatus: RecordType | string | null | undefined): boolean {
  if (!recordOrStatus) return true;
  const status = typeof recordOrStatus === 'string' ? recordOrStatus : recordOrStatus.status;
  return status !== 'Đã dừng đóng';
}

/**
 * Kiểm tra xem khách hàng có đủ điều kiện nhận cảnh báo tái tục / SLA hay không
 * KHÁCH HÀNG "ĐÃ DỪNG ĐÓNG" BỊ LOẠI TRỪ 100%
 */
export function isCustomerEligibleForRenewalAlert(
  recordOrCustomer: { status?: string; paymentStatus?: string; isAdjustment?: boolean } | null | undefined
): boolean {
  if (!recordOrCustomer) return false;
  if (recordOrCustomer.status === 'Đã dừng đóng') return false;
  if (recordOrCustomer.paymentStatus === 'Đã hủy') return false;
  if (recordOrCustomer.isAdjustment) return false;
  return true;
}

/**
 * Đếm số lượng khách hàng thực tế (Active vs Stopped)
 */
export function countActiveAndStoppedParticipants<T extends { status?: string }>(customers: T[]): {
  total: number;
  active: number;
  stopped: number;
} {
  if (!Array.isArray(customers)) return { total: 0, active: 0, stopped: 0 };
  let active = 0;
  let stopped = 0;
  customers.forEach(c => {
    if (c.status === 'Đã dừng đóng') {
      stopped++;
    } else {
      active++;
    }
  });
  return {
    total: customers.length,
    active,
    stopped
  };
}

/**
 * Lọc danh sách khách hàng phục vụ đôn đốc thu & cảnh báo hạn nộp
 * TUÂN THỦ NGHIỆP VỤ: Khách hàng có trạng thái "Đã dừng đóng" BẮT BUỘC bị loại trừ
 * khỏi danh sách đôn đốc tái tục, cảnh báo SLA và các chỉ số thống kê đôn đốc.
 */
export function filterRenewalDispatchCustomers<T extends { status?: string; paymentStatus?: string; isAdjustment?: boolean }>(
  customers: T[],
  options?: { includeSuspended?: boolean }
): T[] {
  if (!Array.isArray(customers)) return [];

  return customers.filter(item => {
    // Luôn loại trừ bản ghi đã hủy và bút toán thoái thu
    if (item.paymentStatus === 'Đã hủy') return false;
    if (item.isAdjustment) return false;

    // Loại trừ khách hàng đã dừng đóng trừ khi có tùy chọn hiển thị rõ ràng
    if (!options?.includeSuspended && item.status === 'Đã dừng đóng') {
      return false;
    }

    return true;
  });
}

/**
 * Tự động nhận diện và kích hoạt lại (Re-activate) khách hàng khi phát sinh giao dịch đóng tiền mới
 * Kế thừa toàn bộ thông tin cá nhân, CCCD, Mã số BHXH cũ.
 */
export function reActivateCustomerOnNewContribution(
  existingRecord: any,
  newContributionData: any
): any {
  const amount = Number(newContributionData?.amount);
  const isValidAmount = !isNaN(amount) ? amount > 0 : true;
  const isPaid = (newContributionData?.paymentStatus === 'Đã thu tiền' || !newContributionData?.paymentStatus) && isValidAmount;
  const wasStopped = existingRecord?.status === 'Đã dừng đóng';
  const shouldReactivate = wasStopped && isPaid;

  const currentNotes = existingRecord?.notes || '';
  const newNotes = shouldReactivate
    ? (currentNotes ? `${currentNotes} | Kích hoạt lại sau khi đóng tiền` : 'Kích hoạt lại sau khi đóng tiền')
    : (newContributionData?.notes || currentNotes);

  return {
    ...existingRecord,
    ...newContributionData,
    name: newContributionData?.name || existingRecord?.name,
    cccd: newContributionData?.cccd || existingRecord?.cccd,
    bhxh: newContributionData?.bhxh || existingRecord?.bhxh,
    old_bhxh: newContributionData?.old_bhxh || existingRecord?.old_bhxh || existingRecord?.oldBhxh,
    oldBhxh: newContributionData?.oldBhxh || existingRecord?.oldBhxh || existingRecord?.old_bhxh,
    phone: newContributionData?.phone || existingRecord?.phone,
    address: newContributionData?.address || existingRecord?.address,
    dob: newContributionData?.dob || existingRecord?.dob,
    gender: newContributionData?.gender || existingRecord?.gender,
    nation: newContributionData?.nation || existingRecord?.nation,
    email: newContributionData?.email || existingRecord?.email,
    type: newContributionData?.type || existingRecord?.type,
    status: shouldReactivate ? 'Đang tham gia' : (newContributionData?.status || existingRecord?.status || 'Đang tham gia'),
    wasReactivated: shouldReactivate,
    notes: newNotes,
    paymentStatus: newContributionData?.paymentStatus || 'Đã thu tiền'
  };
}

/**
 * Hàm tra cứu hồ sơ khách hàng (Memory simulation của RPC lookup_customer_profile)
 * VẪN CHO PHÉP tra cứu ra khách hàng dù đang ở trạng thái 'Đã dừng đóng'
 * để cán bộ điền form khi họ tái tục.
 */
export function lookupCustomerProfileMemory(
  records: RecordType[],
  code: string
): RecordType | null {
  if (!code || !Array.isArray(records)) return null;
  const cleanCode = code.trim();
  if (!cleanCode) return null;

  // Lọc các bản ghi hợp lệ (không phân biệt Đang tham gia hay Đã dừng đóng)
  const matching = records.filter(r => {
    if (r.paymentStatus === 'Đã hủy') return false;
    const matchCccd = r.cccd && r.cccd.trim() === cleanCode;
    const matchBhxh = r.bhxh && r.bhxh.trim() === cleanCode;
    return matchCccd || matchBhxh;
  });

  if (matching.length === 0) return null;

  // Sắp xếp lấy bản ghi mới nhất
  matching.sort((a, b) => {
    const timeA = new Date(a.date || a.created_at || 0).getTime();
    const timeB = new Date(b.date || b.created_at || 0).getTime();
    if (timeB !== timeA) return timeB - timeA;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });

  return matching[0];
}
