/**
 * Service Layer: Data Access Layer cho Bảng settings (Cấu hình hệ thống, cơ quan, in ấn)
 * Tuân thủ Clean Architecture, trừu tượng hóa toàn bộ tương tác Supabase.
 */
import { supabase } from '../lib/supabase';
import { SettingsType } from '../context/types';
import { handleSettingsSchemaCacheMissingColumn } from '../utils/settingsHelper';
import { withRetry } from '../utils/networkHelper';

// ==========================================
// BỘ NHỚ ĐỆM TTL CHO CẤU HÌNH HỆ THỐNG (IN-MEMORY TTL CACHE)
// ==========================================
let settingsCache: { data: SettingsType; timestamp: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 60_000; // Thời gian sống của cache: 60 giây

export const invalidateSettingsCache = (): void => {
  settingsCache = null;
};

export const systemSettingService = {
  /**
   * Lấy cấu hình hệ thống từ bảng settings (id = 1) - Hỗ trợ In-memory TTL Cache
   */
  async fetchSettings(options?: { bypassCache?: boolean }): Promise<{ data: SettingsType | null; error: Error | null }> {
    try {
      // 1. Trả về từ cache nếu còn hiệu lực
      if (!options?.bypassCache && settingsCache && (Date.now() - settingsCache.timestamp < SETTINGS_CACHE_TTL_MS)) {
        return { data: settingsCache.data, error: null };
      }

      // 2. Tải mới từ Supabase
      return await withRetry(async () => {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 1)
          .maybeSingle();

        if (error) throw error;
        if (data) {
          settingsCache = { data: data as SettingsType, timestamp: Date.now() };
        }
        return { data: data as SettingsType | null, error: null };
      });
    } catch (err: any) {
      console.warn('[SystemSettingService] fetchSettings error:', err);
      if (settingsCache?.data) {
        return { data: settingsCache.data, error: null };
      }
      return { data: null, error: err };
    }
  },

  /**
   * Cập nhật cấu hình hệ thống với khả năng tự phục hồi Schema Cache
   */
  async updateSettings(dbSettingsPayload: Record<string, any>): Promise<{ success: boolean; error: Error | null }> {
    try {
      if (Object.keys(dbSettingsPayload).length === 0) {
        return { success: true, error: null };
      }

      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        const { error } = await supabase
          .from('settings')
          .update(dbSettingsPayload)
          .eq('id', 1);

        if (!error) break;

        const handled = handleSettingsSchemaCacheMissingColumn(error, dbSettingsPayload);
        if (handled && Object.keys(dbSettingsPayload).length > 0) {
          continue;
        }
        if (handled && Object.keys(dbSettingsPayload).length === 0) {
          break;
        }
        throw error;
      }

      invalidateSettingsCache();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[SystemSettingService] updateSettings error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Upsert cấu hình hệ thống
   */
  async upsertSettings(dbSettingsPayload: Record<string, any>): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await withRetry<any>(async () => {
        return await supabase
          .from('settings')
          .upsert({ id: 1, ...dbSettingsPayload });
      });

      if (error) throw error;
      invalidateSettingsCache();
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[SystemSettingService] upsertSettings error:', err);
      return { success: false, error: err };
    }
  }
};
