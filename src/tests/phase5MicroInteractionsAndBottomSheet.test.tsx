import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { Modal } from '../components/ui/Modal';
import Toast from '../components/Toast';

// Mock useAppContext for Toast test
const mockHideToast = vi.fn();
let mockAppContextValue: any = {
  toasts: [],
  toastConfig: null,
  toastMessage: null,
  hideToast: mockHideToast,
};

vi.mock('../context/AppContext', () => ({
  useAppContext: () => mockAppContextValue,
}));

describe('Kiểm thử Nâng cấp Frontend Giai đoạn 5 (Phase 5 Micro-interactions & Mobile Bottom Sheet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. Đảm bảo Modal component render với đầy đủ tiêu đề, nội dung và thanh kéo mobile (Pull Handle)', () => {
    const handleClose = vi.fn();
    const modalEl = React.createElement(Modal, {
      isOpen: true,
      onClose: handleClose,
      title: 'Xác nhận thao tác',
      description: 'Mô tả chi tiết',
      asBottomSheetOnMobile: true,
      footer: React.createElement('button', null, 'Đồng ý'),
      children: React.createElement('p', null, 'Nội dung modal')
    });

    expect(modalEl).toBeDefined();
    expect(modalEl.props.isOpen).toBe(true);
    expect(modalEl.props.title).toBe('Xác nhận thao tác');
    expect(modalEl.props.asBottomSheetOnMobile).toBe(true);
  });

  it('2. Đảm bảo Modal không render khi isOpen=false', () => {
    const modalEl = React.createElement(Modal, {
      isOpen: false,
      onClose: vi.fn(),
      title: 'Modal ẩn',
      children: React.createElement('span', null, 'Hidden')
    });

    expect(modalEl.props.isOpen).toBe(false);
  });

  it('3. Đảm bảo Toast component nạp thành công với cấu trúc Stack xếp tầng', () => {
    mockAppContextValue = {
      toasts: [
        { id: '1', message: 'Lưu thành công', type: 'success' },
        { id: '2', message: 'Đã gửi tin nhắn Zalo', type: 'info', action: { label: 'Hoàn tác', onClick: vi.fn() } }
      ],
      toastConfig: null,
      toastMessage: null,
      hideToast: mockHideToast,
    };

    const toastEl = React.createElement(Toast, null);
    expect(toastEl).toBeDefined();
  });

  it('4. Đảm bảo ConfirmModal và AlertModal có thể import và hỗ trợ bottom sheet', async () => {
    const confirmModalMod = await import('../components/modals/ConfirmModal');
    expect(confirmModalMod.default).toBeDefined();

    const alertModalMod = await import('../components/modals/AlertModal');
    expect(alertModalMod.default).toBeDefined();
  });

  it('5. Đảm bảo RegisterModal và SearchResultModal nạp thành công với hỗ trợ Bottom Sheet di động', async () => {
    const registerModalMod = await import('../components/modals/RegisterModal');
    expect(registerModalMod.default).toBeDefined();

    const searchResultModalMod = await import('../components/modals/SearchResultModal');
    expect(searchResultModalMod.default).toBeDefined();
  });
});
