import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PolicyTimelineVisualizer } from '../components/admin/PolicyTimelineVisualizer';
import { DEFAULT_SYSTEM_POLICIES } from '../data/defaultPolicies';
import type { Policy } from '../context/types';

describe('Kiểm thử Giao diện Dòng Thời Gian Chính Sách & Căn Cứ Pháp Lý (Policy Timeline Visualizer)', () => {
  const mockPolicies: Policy[] = [
    {
      id: 1,
      parameter_type: 'commission',
      name: 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026',
      value: {
        commBHXHNew: 15,
        commBHYTNew: 9,
        commBHXHRenew: 9,
        commBHYTRenew: 5
      },
      effective_date: '2026-08-01',
      description: 'Cơ chế tỷ lệ hoa hồng đại lý mới áp dụng từ tháng 08/2026',
      is_active: true
    },
    {
      id: 2,
      parameter_type: 'base_salary',
      name: 'Nghị định số 161/2026/NĐ-CP',
      value: 2530000,
      effective_date: '2026-07-01',
      description: 'Nghị định 161 quy định mức lương cơ sở mới',
      is_active: true
    },
    {
      id: 3,
      parameter_type: 'poverty_standard',
      name: 'Chuẩn nghèo nông thôn 2026',
      value: 1500000,
      effective_date: '2026-01-01',
      description: 'Điều 3 Nghị định 07/2021/NĐ-CP',
      is_active: true
    },
    {
      id: 4,
      parameter_type: 'investment_rate',
      name: 'Quyết định Lãi suất đầu tư quỹ 2026',
      value: 0.31,
      effective_date: '2026-01-01',
      description: 'Công văn 151/BHXH-ĐTQ lãi suất đầu tư quỹ 0.31%/tháng',
      is_active: true
    },
    {
      id: 5,
      parameter_type: 'cpi_index',
      name: 'Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026',
      value: {
        "2024": 1.03,
        "2025": 1.0,
        "2026": 1.0
      },
      effective_date: '2026-01-01',
      description: 'Hệ số trượt giá năm 2026',
      is_active: true
    },
    {
      id: 6,
      parameter_type: 'commission',
      name: 'Quyết định 11/QĐ-BHXH (Cũ)',
      value: {
        commBHXHNew: 5,
        commBHYTNew: 5,
        commBHXHRenew: 3,
        commBHYTRenew: 3
      },
      effective_date: '2026-01-01',
      description: 'Quyết định 11 mức chi thù lao đại lý cũ',
      is_active: false
    }
  ];

  it('1. Hiển thị hoa hồng trực quan theo 4 thông số rõ ràng, không in chuỗi JSON thô', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={mockPolicies} />);

    // Kiểm tra tên phân loại tiếng Việt
    expect(html).toContain('Tỷ Lệ Hoa Hồng Đại Lý');

    // Không được xuất hiện chuỗi JSON thô như {"commBHXHNew":15...}
    expect(html).not.toMatch(/\{&quot;commBHXHNew&quot;/i);
    expect(html).not.toMatch(/{"commBHXHNew"/i);

    // Kiểm tra hiển thị đủ 4 mức hoa hồng với tỷ lệ %
    expect(html).toContain('15%');
    expect(html).toContain('9%');
    expect(html).toContain('5%');
    expect(html).toContain('BHXH Mới');
    expect(html).toContain('BHYT Mới');
    expect(html).toContain('BHXH Gia Hạn');
    expect(html).toContain('BHYT Gia Hạn');
  });

  it('2. Lãi suất đầu tư quỹ hiển thị % / tháng, tuyệt đối không hiển thị đơn vị tiền tệ "đ"', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={mockPolicies} />);

    // Phân loại tiếng Việt
    expect(html).toContain('Lãi Suất Đầu Tư Quỹ');
    // Hiển thị 0.31% / tháng
    expect(html).toContain('0.31%');
    expect(html).toContain('/ tháng');
    expect(html).toContain('~3.72% / năm');

    // Không được có chuỗi 0.31 đ hay 0,31 đ
    expect(html).not.toContain('0.31 đ');
    expect(html).not.toContain('0,31 đ');
  });

  it('3. Mức lương cơ sở và Chuẩn nghèo hiển thị định dạng VNĐ và mốc trần/sàn', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={mockPolicies} />);

    expect(html).toContain('2.530.000 đ');
    expect(html).toContain('Trần đóng tối đa (20 lần): 50.600.000 đ');

    expect(html).toContain('1.500.000 đ');
    expect(html).toContain('Mức sàn thu nhập đóng BHXH tự nguyện');
  });

  it('4. Hệ số trượt giá CPI hiển thị tóm tắt năm và hệ số', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={mockPolicies} />);

    expect(html).toContain('Hệ Số Trượt Giá (CPI)');
    expect(html).toContain('Bảng hệ số điều chỉnh thu nhập đã đóng BHXH (3 năm: 2024 - 2026)');
    expect(html).toContain('2026:');
    expect(html).toContain('1.00');
  });

  it('5. Dropdown phân loại hỗ trợ tất cả danh mục tham số', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={mockPolicies} />);

    expect(html).toContain('value="ALL"');
    expect(html).toContain('value="base_salary"');
    expect(html).toContain('value="poverty_standard"');
    expect(html).toContain('value="commission"');
    expect(html).toContain('value="investment_rate"');
    expect(html).toContain('value="cpi_index"');
  });

  it('6. Nút kích hoạt mốc chỉ xuất hiện cho tài khoản Admin trên mốc chưa kích hoạt', () => {
    const htmlAdmin = renderToString(
      <PolicyTimelineVisualizer policies={mockPolicies} isAdmin={true} onActivatePolicy={() => {}} />
    );
    expect(htmlAdmin).toContain('Kích hoạt mốc này');

    const htmlUser = renderToString(
      <PolicyTimelineVisualizer policies={mockPolicies} isAdmin={false} onActivatePolicy={() => {}} />
    );
    expect(htmlUser).not.toContain('Kích hoạt mốc này');
  });

  it('7. Danh sách 8 chính sách mặc định trong DEFAULT_SYSTEM_POLICIES hiển thị đầy đủ và chính xác', () => {
    const html = renderToString(<PolicyTimelineVisualizer policies={DEFAULT_SYSTEM_POLICIES} />);

    expect(DEFAULT_SYSTEM_POLICIES).toHaveLength(8);
    // Kiểm tra các mốc chính sách quan trọng
    expect(html).toContain('Nghị định 73/2024/NĐ-CP');
    expect(html).toContain('Nghị định số 161/2026/NĐ-CP');
    expect(html).toContain('Chuẩn nghèo nông thôn 2026');
    expect(html).toContain('Cài đặt Tỷ lệ Hoa hồng đại lý 2026');
    expect(html).toContain('Quyết định điều chỉnh Lãi suất đầu tư quỹ 2026');
    expect(html).toContain('Công văn 340/BHXH-CSXH đ/c Hệ số trượt giá 2026');
  });
});
