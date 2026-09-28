import { describe, it, expect } from 'vitest';
import { maskCCCD, maskPhone, maskBHXH } from '../utils/security';
import { computeTransactionKPIs, getDefaultTransactionFilterState } from '../utils/transactionFilters';

describe('Kiểm thử Phân hệ CRMView và FinanceView theo Design System mới', () => {
  it('1. Đảm bảo component CRMView và FinanceView có thể import thành công', async () => {
    const crmAdminMod = await import('../components/admin/CRMView');
    expect(crmAdminMod.default).toBeDefined();
    expect(crmAdminMod.CRMView).toBeDefined();

    const crmRootMod = await import('../components/CRMView');
    expect(crmRootMod.default).toBeDefined();

    const financeAdminMod = await import('../components/admin/FinanceView');
    expect(financeAdminMod.default).toBeDefined();
    expect(financeAdminMod.FinanceView).toBeDefined();

    const financeRootMod = await import('../components/FinanceView');
    expect(financeRootMod.default).toBeDefined();
  });

  it('2. Tuân thủ quy định che dấu dữ liệu nhạy cảm PII (Nghị định 13/2023/NĐ-CP)', () => {
    const rawCccd = '001200001234';
    const rawPhone = '0987654321';
    const rawBhxh = '7912345678';

    // Khi che (Mặc định cho bảo mật / nhân viên thường)
    expect(maskCCCD(rawCccd, false)).toBe('001******234');
    expect(maskPhone(rawPhone, false)).toBe('098****321');
    expect(maskBHXH(rawBhxh, false)).toBe('79*****678');

    // Khi hiện (Admin / Quản lý có thẩm quyền)
    expect(maskCCCD(rawCccd, true)).toBe('001200001234');
    expect(maskPhone(rawPhone, true)).toBe('0987654321');
    expect(maskBHXH(rawBhxh, true)).toBe('7912345678');
  });

  it('3. Đảm bảo tính toán dòng tiền và KPI tài chính với font-mono căn chỉnh', () => {
    const mockRecords = [
      {
        id: 101,
        type: 'BHXH',
        amount: 2500000,
        paymentStatus: 'Đã thu tiền',
        date: '2026-09-15T08:00:00Z',
        isSubmittedBHXH: true,
        submissionBatch: 'Đợt 1',
        actionType: 'Mới'
      },
      {
        id: 102,
        type: 'BHXH',
        amount: 1500000,
        paymentStatus: 'Chờ thanh toán',
        date: '2026-09-16T09:00:00Z',
        isSubmittedBHXH: false,
        actionType: 'Gia hạn'
      }
    ];

    const filter = getDefaultTransactionFilterState('2026-09-20');
    const result = computeTransactionKPIs(mockRecords, filter, { type: 'BHXH' });

    expect(result.totalRev).toBe(2500000);
    expect(result.totalPending).toBe(1500000);
    expect(result.baseFiltered.length).toBe(2);
  });
});
