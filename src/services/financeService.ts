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
  },

  /**
   * Tra cứu danh sách bút toán sổ cái của khách hàng qua RPC get_customer_financial_ledger
   */
  async getCustomerLedger(customerId: string, limit = 50, offset = 0) {
    try {
      const { data, error } = await supabase.rpc('get_customer_financial_ledger', {
        p_customer_id: customerId,
        p_limit: limit,
        p_offset: offset
      });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('[FinanceService] Lỗi tra cứu sổ cái khách hàng:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Lấy lịch sử bút toán sổ cái gắn liền với một hồ sơ giao dịch cụ thể
   */
  async getRecordLedger(recordId: number) {
    try {
      const { data, error } = await supabase
        .from('financial_ledger')
        .select('*')
        .eq('record_id', recordId)
        .order('posted_at', { ascending: false });
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('[FinanceService] Lỗi tra cứu sổ cái theo hồ sơ:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Lấy các bút toán sổ cái tài chính gần nhất
   */
  async getRecentLedgerEntries(limit = 100) {
    try {
      const { data, error } = await supabase
        .from('financial_ledger')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (err: any) {
      console.error('[FinanceService] Lỗi tải sổ cái tài chính gần nhất:', err);
      return { data: [], error: err };
    }
  }
};
