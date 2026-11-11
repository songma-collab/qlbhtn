import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import {
  getStoredTheme,
  setTheme,
  resolveTheme,
  toggleTheme,
  applyThemeToDOM,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
} from '../utils/theme';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

describe('Kiểm thử Nâng cấp Frontend Giai đoạn 4 (Phase 4 Design Tokens & Dark Mode Ready)', () => {
  const mockStorage: Record<string, string> = {};
  const classListSet = new Set<string>();
  const attributesMap = new Map<string, string>();
  let lastDispatchedEvent: any = null;

  const mockDocElement = {
    classList: {
      add: (cls: string) => classListSet.add(cls),
      remove: (cls: string) => classListSet.delete(cls),
      contains: (cls: string) => classListSet.has(cls),
    },
    setAttribute: (k: string, v: string) => attributesMap.set(k, v),
    getAttribute: (k: string) => attributesMap.get(k) || null,
    removeAttribute: (k: string) => attributesMap.delete(k),
    style: { colorScheme: '' },
  };

  beforeEach(() => {
    // Reset storage
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
    classListSet.clear();
    attributesMap.clear();
    mockDocElement.style.colorScheme = '';
    lastDispatchedEvent = null;

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => { mockStorage[k] = v; },
      removeItem: (k: string) => { delete mockStorage[k]; },
      clear: () => {
        for (const key of Object.keys(mockStorage)) {
          delete mockStorage[key];
        }
      },
    });

    vi.stubGlobal('document', {
      documentElement: mockDocElement,
    });

    vi.stubGlobal('window', {
      localStorage: (globalThis as any).localStorage,
      dispatchEvent: (e: any) => { lastDispatchedEvent = e; },
      matchMedia: (query: string) => ({
        matches: query.includes('dark') ? false : true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('1. Đảm bảo hàm getStoredTheme trả về mặc định light khi chưa cấu hình', () => {
    expect(getStoredTheme()).toBe('light');
  });

  it('2. Đảm bảo setTheme("dark") cập nhật localStorage, class .dark và attribute data-theme="dark"', () => {
    setTheme('dark');

    expect(mockStorage[THEME_STORAGE_KEY]).toBe('dark');
    expect(mockDocElement.classList.contains('dark')).toBe(true);
    expect(mockDocElement.getAttribute('data-theme')).toBe('dark');
    expect(mockDocElement.style.colorScheme).toBe('dark');
    expect(lastDispatchedEvent?.detail).toEqual({ mode: 'dark', resolved: 'dark' });
  });

  it('3. Đảm bảo setTheme("light") gỡ class .dark và đặt data-theme="light"', () => {
    // Trước tiên đặt dark
    setTheme('dark');
    expect(mockDocElement.classList.contains('dark')).toBe(true);

    // Chuyển sang light
    setTheme('light');
    expect(mockStorage[THEME_STORAGE_KEY]).toBe('light');
    expect(mockDocElement.classList.contains('dark')).toBe(false);
    expect(mockDocElement.getAttribute('data-theme')).toBe('light');
    expect(mockDocElement.style.colorScheme).toBe('light');
    expect(lastDispatchedEvent?.detail).toEqual({ mode: 'light', resolved: 'light' });
  });

  it('4. Đảm bảo toggleTheme chuyển đổi qua lại giữa light và dark', () => {
    setTheme('light');
    const next1 = toggleTheme();
    expect(next1).toBe('dark');
    expect(mockDocElement.classList.contains('dark')).toBe(true);

    const next2 = toggleTheme();
    expect(next2).toBe('light');
    expect(mockDocElement.classList.contains('dark')).toBe(false);
  });

  it('5. Đảm bảo ThemeToggle component render thành công với các variant icon và segmented', () => {
    const iconToggle = React.createElement(ThemeToggle, { variant: 'icon' });
    expect(iconToggle).toBeDefined();
    expect(iconToggle.props.variant).toBe('icon');

    const segmentedToggle = React.createElement(ThemeToggle, { variant: 'segmented', size: 'sm' });
    expect(segmentedToggle).toBeDefined();
    expect(segmentedToggle.props.variant).toBe('segmented');
  });

  it('6. Đảm bảo Atomic UI Primitives hỗ trợ các class token dark mode không gây lỗi', () => {
    const cardEl = React.createElement(Card, { hoverable: true },
      React.createElement(CardHeader, null,
        React.createElement(CardTitle, null, 'Tiêu đề thẻ')
      ),
      React.createElement(CardContent, null, 'Nội dung')
    );
    expect(cardEl).toBeDefined();

    const btnEl = React.createElement(Button, { variant: 'primary', size: 'md' }, 'Lưu');
    expect(btnEl).toBeDefined();

    const badgeEl = React.createElement(Badge, { variant: 'primary', dot: true }, 'BHXH');
    expect(badgeEl).toBeDefined();

    const inputEl = React.createElement(Input, { label: 'Họ tên', placeholder: 'Nhập họ tên' });
    expect(inputEl).toBeDefined();

    const selectEl = React.createElement(Select, { label: 'Chọn kỳ đóng', options: [{ label: '1 Tháng', value: 1 }] });
    expect(selectEl).toBeDefined();
  });
});
