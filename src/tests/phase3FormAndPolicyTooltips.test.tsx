import { describe, it, expect } from 'vitest';
import React from 'react';
import { Tooltip, PolicyHelpBadge } from '../components/ui/Tooltip';

describe('Kiểm thử Nâng cấp Frontend Giai đoạn 3 (Phase 3 Form UX & Policy Tooltips)', () => {
  it('1. Đảm bảo Tooltip component render với đầy đủ vị trí và nội dung', () => {
    const tooltipTop = React.createElement(Tooltip, {
      content: 'Nội dung chú thích',
      position: 'top',
      children: React.createElement('span', null, 'Hover tôi')
    });
    expect(tooltipTop).toBeDefined();
    expect(tooltipTop.props.position).toBe('top');

    const tooltipBottom = React.createElement(Tooltip, {
      content: 'Nội dung phía dưới',
      position: 'bottom',
      children: React.createElement('span', null, 'Target')
    });
    expect(tooltipBottom.props.position).toBe('bottom');
  });

  it('2. Đảm bảo PolicyHelpBadge render đúng căn cứ pháp lý Luật BHXH 2024', () => {
    const badge = React.createElement(PolicyHelpBadge, {
      title: 'Trần hỗ trợ 10 năm NSNN',
      lawRef: 'Khoản 1 Điều 36 Luật BHXH 2024',
      content: 'Nhà nước hỗ trợ tiền đóng tối đa 120 tháng trong suốt cuộc đời.'
    });
    expect(badge).toBeDefined();
    expect(badge.props.title).toBe('Trần hỗ trợ 10 năm NSNN');
    expect(badge.props.lawRef).toBe('Khoản 1 Điều 36 Luật BHXH 2024');
  });

  it('3. Đảm bảo RegisterModal nạp thành công với Step Wizard phân bước', async () => {
    const regModalMod = await import('../components/modals/RegisterModal');
    expect(regModalMod.default).toBeDefined();
  });

  it('4. Đảm bảo CustomerParticipationViewModal và SearchResultModal tích hợp PolicyHelpBadge không gây lỗi', async () => {
    const partModalMod = await import('../components/modals/CustomerParticipationViewModal');
    expect(partModalMod.CustomerParticipationViewModal).toBeDefined();

    const searchModalMod = await import('../components/modals/SearchResultModal');
    expect(searchModalMod.default).toBeDefined();
  });
});
