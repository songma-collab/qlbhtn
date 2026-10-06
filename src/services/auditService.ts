/**
 * Service Layer: Data Access Layer cho Bảng auditlogs & Nhật ký liên lạc khách hàng
 * Tuân thủ Clean Architecture, trừu tượng hóa toàn bộ tương tác Supabase.
 */
import { supabase } from '../lib/supabase';
import { AuditLogType } from '../context/types';

export const auditService = {
  /**
   * Lấy danh sách nhật ký kiểm toán hệ thống
   */
  async fetchAuditLogs(limit: number = 500): Promise<{ data: AuditLogType[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('auditlogs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data: (data || []) as AuditLogType[], error: null };
    } catch (err: any) {
      console.warn('[AuditService] fetchAuditLogs error:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Thêm một bản ghi nhật ký kiểm toán mới
   */
  async insertAuditLog(log: {
    action: string;
    details: string;
    user_id?: string;
    user_name?: string;
  }): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('auditlogs')
        .insert([{
          action: log.action,
          details: log.details,
          user_id: log.user_id,
          user_name: log.user_name
        }]);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('[AuditService] insertAuditLog error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Ghi nhận lịch sử tiếp xúc / liên hệ khách hàng đôn đốc qua RPC
   */
  async logCustomerContact(
    recordId: number,
    note: string,
    channel: string
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.rpc('log_customer_contact', {
        p_record_id: recordId,
        p_note: note,
        p_channel: channel
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  }
};
