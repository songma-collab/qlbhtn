import { describe, it, expect } from 'vitest';

describe('Kiểm tra load component CRM và modal liên quan', () => {
  it('Import CRM thành công không throw lỗi', async () => {
    const mod = await import('../components/admin/CRM');
    expect(mod.default).toBeDefined();
  });

  it('Import RegisterModal thành công không throw lỗi', async () => {
    const mod = await import('../components/modals/RegisterModal');
    expect(mod.default).toBeDefined();
  });

  it('Import SearchResultModal thành công không throw lỗi', async () => {
    const mod = await import('../components/modals/SearchResultModal');
    expect(mod.default).toBeDefined();
  });
});
