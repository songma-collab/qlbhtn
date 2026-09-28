/**
 * Service Layer: Data Access Layer cho Thống kê Tài chính và Quyết toán
 */
import { supabase } from '../lib/supabase';

export interface FinanceStatsFilter {
  filter_type?: string;
  filter_staff?: string;
  filter_period?: string;
  start_date?: string;
  end_date?: string;
  search_txt?: string;
  action_type_filter?: string;
  payment_status_filter?: string;
  filter_submitted?: string;
}

export interface FinanceStatsResult {
  totalRev: number;
  totalPending: number;
  totalComm: number;
}

export const financeService = {
  /**
   * Gọi RPC get_admin_finance_stats để tính toán tổng doanh thu, chờ nộp, hoa hồng tại CSDL
   */
  async getAdminFinanceStats(filters: FinanceStatsFilter): Promise<{ data: FinanceStatsResult | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('get_admin_finance_stats', {
        filter_type: filters.filter_type ?? 'all',
        filter_staff: filters.filter_staff ?? 'all',
        filter_period: filters.filter_period ?? 'all',
        start_date: filters.start_date ?? '',
        end_date: filters.end_date ?? '',
        search_txt: filters.search_txt ?? '',
        action_type_filter: filters.action_type_filter ?? 'all',
        payment_status_filter: filters.payment_status_filter ?? 'all',
        filter_submitted: filters.filter_submitted ?? 'all'
      });

      if (error) throw error;
      return {
        data: data as FinanceStatsResult,
        error: null
      };
    } catch (err: any) {
      console.error('[FinanceService] Lỗi tính toán thống kê tài chính:', err);
      return { data: null, error: err };
    }
  }
};
