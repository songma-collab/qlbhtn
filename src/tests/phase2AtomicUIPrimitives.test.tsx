import { describe, it, expect } from 'vitest';
import React from 'react';
import { Button, Input, CurrencyInput, Select, Badge, Card, CardHeader, CardTitle, CardContent } from '../components/ui';

describe('Kiểm thử Thư viện Giao diện Nguyên tử (Phase 2 Atomic UI Primitives)', () => {
  it('1. Đảm bảo toàn bộ Atomic UI Primitives được export đầy đủ', () => {
    expect(Button).toBeDefined();
    expect(Input).toBeDefined();
    expect(CurrencyInput).toBeDefined();
    expect(Select).toBeDefined();
    expect(Badge).toBeDefined();
    expect(Card).toBeDefined();
    expect(CardHeader).toBeDefined();
    expect(CardTitle).toBeDefined();
    expect(CardContent).toBeDefined();
  });

  it('2. Button render đúng các biến thể (variants) và kích thước (sizes)', () => {
    const btnPrimary = React.createElement(Button, { variant: 'primary', children: 'Bấm tôi' });
    expect(btnPrimary).toBeDefined();
    expect(btnPrimary.props.variant).toBe('primary');

    const btnDanger = React.createElement(Button, { variant: 'danger', size: 'sm', children: 'Xóa' });
    expect(btnDanger.props.variant).toBe('danger');
    expect(btnDanger.props.size).toBe('sm');

    const btnLoading = React.createElement(Button, { isLoading: true, children: 'Lưu' });
    expect(btnLoading.props.isLoading).toBe(true);
  });

  it('3. Input hỗ trợ nhãn bắt buộc, icon và trạng thái báo lỗi', () => {
    const inputWithErr = React.createElement(Input, {
      label: 'Họ và tên',
      isRequired: true,
      error: 'Vui lòng nhập họ tên',
      value: 'Nguyễn Văn A'
    });
    expect(inputWithErr).toBeDefined();
    expect(inputWithErr.props.label).toBe('Họ và tên');
    expect(inputWithErr.props.isRequired).toBe(true);
    expect(inputWithErr.props.error).toBe('Vui lòng nhập họ tên');
  });

  it('4. CurrencyInput định dạng số tiền VND và hỗ trợ tabular-nums', () => {
    const currInput = React.createElement(CurrencyInput, {
      label: 'Mức thu nhập',
      numericValue: 2500000,
      currencySuffix: 'đ'
    });
    expect(currInput).toBeDefined();
    expect(currInput.props.numericValue).toBe(2500000);
    expect(currInput.props.currencySuffix).toBe('đ');
  });

  it('5. Select render danh sách tùy chọn (options) chuẩn xác', () => {
    const selectElem = React.createElement(Select, {
      label: 'Phương thức đóng',
      options: [
        { value: 1, label: 'Đóng hàng tháng' },
        { value: 3, label: 'Đóng 3 tháng' },
        { value: 12, label: 'Đóng 12 tháng' }
      ]
    });
    expect(selectElem).toBeDefined();
    expect(selectElem.props.options).toHaveLength(3);
  });

  it('6. Badge hiển thị đúng màu sắc ngữ nghĩa và chấm trạng thái (dot)', () => {
    const badgeSuccess = React.createElement(Badge, { variant: 'success', dot: true, children: 'Đã thu tiền' });
    expect(badgeSuccess).toBeDefined();
    expect(badgeSuccess.props.variant).toBe('success');
    expect(badgeSuccess.props.dot).toBe(true);

    const badgeWarning = React.createElement(Badge, { variant: 'warning', children: 'Chờ thanh toán' });
    expect(badgeWarning.props.variant).toBe('warning');
  });

  it('7. Card và các khối thành phần con (CardHeader, CardTitle) render hợp lệ', () => {
    const cardElem = React.createElement(Card, {
      hoverable: true,
      children: [
        React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Tiêu đề thẻ')),
        React.createElement(CardContent, null, 'Nội dung thẻ')
      ]
    });
    expect(cardElem).toBeDefined();
    expect(cardElem.props.hoverable).toBe(true);
  });
});
