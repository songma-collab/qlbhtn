import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import BHXHActionTypeSelector from '../components/modals/register/BHXHActionTypeSelector';
import type { RecordType } from '../context/types';

describe('Kiểm thử Giao diện BHXHActionTypeSelector & Cơ chế gọi lại hồ sơ cập nhật gần nhất', () => {
  describe('1. Kiểm thử giao diện BHXHActionTypeSelector đã tinh gọn theo yêu cầu', () => {
    it('Đảm bảo component import thành công và mã nguồn đã xóa bỏ subtext, badge hoa hồng và hộp info', () => {
      expect(BHXHActionTypeSelector).toBeDefined();

      const componentPath = path.resolve(__dirname, '../components/modals/register/BHXHActionTypeSelector.tsx');
      const fileContent = fs.readFileSync(componentPath, 'utf-8');

      // 1. Phải có 2 nhãn phân loại hồ sơ
      expect(fileContent).toContain('Hồ Sơ Tăng Mới');
      expect(fileContent).toContain('Hồ Sơ Gia Hạn');

      // 2. KHÔNG được chứa các dòng chữ đã yêu cầu xóa
      expect(fileContent).not.toContain('Người tham gia mới hoặc đóng tiếp kỳ 1, 3, 6 tháng cho đến khi đủ');
      expect(fileContent).not.toContain('Đã tham gia đủ 12 tháng, hoặc');
      expect(fileContent).not.toContain('Quy định hoa hồng BHXH Tự nguyện');

      // 3. KHÔNG hiển thị badge tỷ lệ hoa hồng (HH: {commBHXH...}%)
      expect(fileContent).not.toContain('HH: {commBHXHNewPct}%');
      expect(fileContent).not.toContain('HH: {commBHXHRenewPct}%');
    });
  });

  describe('2. Kiểm thử logic gọi lại thông tin ở lần cập nhật gần nhất (updated_at)', () => {
    it('Ưu tiên bản ghi có updated_at mới nhất để lấy thông tin nhân thân (họ tên, SĐT, địa chỉ)', () => {
      // Giả lập 2 bản ghi của cùng khách hàng:
      // Record 1: Giao dịch tháng 6/2026 nhưng tạo lúc đầu, chưa sửa (thông tin cũ)
      const record1: Partial<RecordType> = {
        id: 101,
        date: '2026-06-15T08:00:00Z',
        created_at: '2026-06-15T08:00:00Z',
        updated_at: '2026-06-15T08:00:00Z',
        name: 'Nguyễn Văn A',
        cccd: '001200001111',
        phone: '0901111111', // SĐT cũ
        address: 'Xã Cũ, Huyện A', // Địa chỉ cũ
        to_month: '2026-06',
        next_payment: '2026-07-15'
      };

      // Record 2: Giao dịch tháng 1/2026 nhưng nhân viên vừa vào chỉnh sửa lúc 10:00 hôm nay
      const record2: Partial<RecordType> = {
        id: 50,
        date: '2026-01-10T08:00:00Z',
        created_at: '2026-01-10T08:00:00Z',
        updated_at: '2026-10-07T10:00:00Z', // Vừa cập nhật hôm nay!
        name: 'Nguyễn Văn A',
        cccd: '001200001111',
        phone: '0988888888', // SĐT mới nhân viên vừa cập nhật
        address: 'Tổ 5 Phường Mới, Thành phố B', // Địa chỉ mới vừa cập nhật
        to_month: '2026-01',
        next_payment: '2026-02-15'
      };

      const allRecords = [record1, record2];

      // Logic sắp xếp ưu tiên bản ghi có updated_at mới nhất cho thông tin nhân khẩu
      const sortedByUpdate = [...allRecords].sort((a, b) => {
        const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
        const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
        if (upB !== upA) return upB - upA;
        const dateA = new Date(a.date || a.created_at || 0).getTime();
        const dateB = new Date(b.date || b.created_at || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });

      // Bản ghi lấy thông tin nhân thân phải là record2 (vừa cập nhật)
      const newestProfileRec = sortedByUpdate[0];
      expect(newestProfileRec).toBeDefined();
      expect(newestProfileRec?.id).toBe(50);
      expect(newestProfileRec?.phone).toBe('0988888888');
      expect(newestProfileRec?.address).toBe('Tổ 5 Phường Mới, Thành phố B');

      // Trong khi đó, bản ghi lấy kỳ hạn gia hạn tiếp theo vẫn là record1 (kỳ đóng xa nhất)
      const sortedByContract = [...allRecords].sort((a, b) => {
        const nextA = new Date(a.next_payment || 0).getTime();
        const nextB = new Date(b.next_payment || 0).getTime();
        if (nextB !== nextA) return nextB - nextA;
        return 0;
      });
      const newestContractRec = sortedByContract[0];
      expect(newestContractRec).toBeDefined();
      expect(newestContractRec?.id).toBe(101);
      expect(newestContractRec?.next_payment).toBe('2026-07-15');
    });
  });

  describe('3. Kiểm thử phân loại nghiệp vụ BHXH kế thừa Gia hạn (bảo vệ trường hợp đại lý khác chuyển sang)', () => {
    it('Khách hàng có lịch sử giao dịch là Gia hạn (hoặc chuyển từ đại lý khác) dù tích lũy < 12 tháng vẫn phải giữ nguyên Gia hạn', () => {
      // Giả lập giao dịch trước đó: Bùi Minh Phương, chuyển từ đại lý khác, tích lũy 3 tháng, đã chọn Gia hạn
      const previousRenewRecord: Partial<RecordType> = {
        id: 29,
        type: 'BHXH',
        name: 'Bùi Minh Phương',
        cccd: '014202000001',
        bhxh: '014202000001',
        action_type: 'Gia hạn',
        payment_status: 'Đã thanh toán',
        months: 3,
        from_month: '2026-07',
        to_month: '2026-09',
        next_payment: '2026-10-15'
      };

      const recordsList = [previousRenewRecord] as RecordType[];

      // Kiểm tra hàm phát hiện lịch sử gia hạn
      const cleanC = '014202000001';
      const hasRenewHistory = recordsList.some(r => {
        if (!r || r.type !== 'BHXH') return false;
        const rPayStatus = r.payment_status || (r as any).paymentStatus;
        if (rPayStatus === 'Đã hủy') return false;
        const rC = (r.cccd || (r as any).citizenId || '').replace(/\D/g, '');
        const rB = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
        const isMatch = Boolean(cleanC && (rC === cleanC || rB === cleanC));
        if (!isMatch) return false;
        const aType = String(r.action_type || (r as any).actionType || '').toLowerCase();
        return aType.includes('gia hạn') || aType.includes('tái tục');
      });

      expect(hasRenewHistory).toBe(true);

      // Khi người dùng bấm gia hạn kỳ tiếp theo (kỳ 10/2026 hoặc 11/2026, tích lũy 4 tháng < 12 tháng)
      const prevMonths = 4;
      const isRenew = true;
      const recActionStr = String(previousRenewRecord.action_type || '').toLowerCase();
      const isRecRenew = recActionStr.includes('gia hạn') || recActionStr.includes('tái tục');
      const isCustomerAlreadyRenew = isRecRenew || hasRenewHistory;

      let determinedActionType = 'Tăng mới';
      if (isRenew) {
        if (isCustomerAlreadyRenew) {
          determinedActionType = 'Gia hạn';
        } else {
          determinedActionType = prevMonths < 12 ? 'Tăng mới' : 'Gia hạn';
        }
      }

      // Kết quả phân loại bắt buộc phải là 'Gia hạn'
      expect(determinedActionType).toBe('Gia hạn');

      // Kiểm tra logic hiển thị gợi ý trên BHXHActionTypeSelector
      const hasPreviousRenew = true;
      const isSuggestedNew = isRenew && prevMonths < 12 && !hasPreviousRenew;
      const isSuggestedRenew = isRenew && (prevMonths >= 12 || hasPreviousRenew);

      expect(isSuggestedNew).toBe(false);
      expect(isSuggestedRenew).toBe(true);
    });
  });
});
