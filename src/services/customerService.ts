/**
 * Service Layer: Data Access Layer cho Bảng Customers (Hồ sơ gốc Master Data khách hàng)
 */
import { supabase } from '../lib/supabase';
import { CustomerType, normalizeLegacyPayload } from '../context/types';
import { withRetry } from '../utils/networkHelper';

export const customerService = {
  /**
   * Lấy danh sách khách hàng Master Data
   */
  async fetchCustomers(options?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CustomerType[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        let query = supabase.from('customers').select('*').order('latest_date', { ascending: false });

        if (options?.type && options.type !== 'all' && options.type !== 'ALL') {
          query = query.or(`type.eq.${options.type},type.eq.CẢ HAI`);
        }
        if (options?.limit) {
          const from = options.offset || 0;
          query = query.range(from, from + options.limit - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        const normalized = (data || []).map(c => normalizeLegacyPayload(c) as CustomerType);
        return { data: normalized, error: null };
      });
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Tìm kiếm và phân trang khách hàng từ Server qua RPC crm_search_customers (Hiệu năng cao)
   */
  async searchCustomersServer(options: {
    type?: string;
    search?: string;
    staffId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: CustomerType[]; totalCount: number; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('crm_search_customers', {
          p_type: options.type || 'ALL',
          p_search: options.search || '',
          p_staff_id: options.staffId || 'all',
          p_status: options.status || 'all',
          p_from_date: options.fromDate || null,
          p_to_date: options.toDate || null,
          p_limit: options.limit || 20,
          p_offset: options.offset || 0,
        });

        if (error) throw error;
        const totalCount = data && data.length > 0 ? Number(data[0].total_count) || 0 : 0;
        const normalized = (data || []).map(c => normalizeLegacyPayload(c) as CustomerType);
        return { data: normalized, totalCount, error: null };
      });
    } catch (err: any) {
      console.warn('[CustomerService] Lỗi searchCustomersServer:', err);
      return { data: [], totalCount: 0, error: err };
    }
  },

  /**
   * Tra cứu hồ sơ khách hàng bằng RPC lookup_customer_profile (bảo mật, hỗ trợ CCCD/BHXH/old_bhxh)
   */
  async lookupCustomerProfile(code: string): Promise<CustomerType | null> {
    if (!code || !code.trim()) return null;
    try {
      const { data, error } = await supabase.rpc('lookup_customer_profile', { p_code: code.trim() });
      if (error) throw error;
      if (!data) return null;
      return normalizeLegacyPayload(data) as CustomerType;
    } catch (err) {
      console.warn('[CustomerService] Lỗi khi tra cứu profile khách hàng:', err);
      return null;
    }
  },

  /**
   * Xóa khách hàng liên đới an toàn (Atomic Cascade Delete)
   */
  async deleteCustomerCascade(customerKey: string): Promise<{ success: boolean; deletedCount: number; message?: string; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('delete_customer_cascade', { p_customer_key: customerKey });
      if (error) throw error;
      return {
        success: data?.success ?? true,
        deletedCount: data?.deleted_records ?? 0,
        message: data?.message,
        error: null
      };
    } catch (err: any) {
      console.error('[CustomerService] Lỗi xóa khách hàng cascade:', err);
      return { success: false, deletedCount: 0, message: err?.message, error: err };
    }
  },

  /**
   * Cập nhật hồ sơ quá trình tham gia trước đây của khách hàng (Bắt buộc & Tự nguyện nơi khác)
   * Tuyệt đối KHÔNG ghi vào bảng records, bảo đảm an toàn giao dịch tài chính.
   * Tích hợp Schema Resilience: tự động xử lý khi database chưa chạy migration.
   */
  async updateCustomerParticipation(
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string;
    }
  ): Promise<{ success: boolean; error: Error | null }> {
    if (!targetIdOrKey) return { success: false, error: new Error('Thiếu ID hoặc CustomerKey') };

    const payload: Record<string, any> = {
      prior_periods: data.prior_periods || [],
      prior_voluntary_months: Number(data.prior_voluntary_months) || 0,
      prior_compulsory_months: Number(data.prior_compulsory_months) || 0,
      prior_participation_notes: data.prior_participation_notes || '',
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Thử gọi RPC lưu trữ bảo đảm atomicity nếu đã có migration RPC
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('save_customer_participation', {
          p_target_key: targetIdOrKey,
          p_prior_periods: data.prior_periods || [],
          p_prior_voluntary_months: Number(data.prior_voluntary_months) || 0,
          p_prior_compulsory_months: Number(data.prior_compulsory_months) || 0,
          p_prior_participation_notes: data.prior_participation_notes || ''
        });

        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, error: null };
        }
      } catch (rpcCallErr) {
        // Tiếp tục fallback direct table update bên dưới
      }

      // 2. Thử cập nhật đầy đủ các cột mới trên bảng customers
      let query = supabase.from('customers').update(payload);
      if (targetIdOrKey.includes('-') && targetIdOrKey.length >= 30) {
        query = query.eq('id', targetIdOrKey);
      } else {
        query = query.or(`customer_key.eq.${targetIdOrKey},id.eq.${targetIdOrKey},cccd.eq.${targetIdOrKey},bhxh.eq.${targetIdOrKey}`);
      }

      const { error } = await query;
      if (!error) {
        // Đồng bộ thêm vào bảng quan hệ customer_participations nếu có
        try {
          // Lấy ID khách hàng thực tế
          const { data: custRec } = await supabase
            .from('customers')
            .select('id, customer_key, cccd, bhxh')
            .or(`customer_key.eq.${targetIdOrKey},id.eq.${targetIdOrKey},cccd.eq.${targetIdOrKey},bhxh.eq.${targetIdOrKey}`)
            .limit(1)
            .maybeSingle();

          if (custRec?.id && Array.isArray(data.prior_periods)) {
            await supabase.from('customer_participations').delete().eq('customer_id', custRec.id);
            if (data.prior_periods.length > 0) {
              const rows = data.prior_periods.map((p: any) => {
                const sm = Number(p.sm) || 1;
                const sy = Number(p.sy) || 2020;
                const em = Number(p.em) || 12;
                const ey = Number(p.ey) || 2020;
                return {
                  customer_id: custRec.id,
                  customer_key: custRec.customer_key,
                  cccd: custRec.cccd,
                  bhxh: custRec.bhxh,
                  type: p.type || 'batbuoc',
                  position: p.position || '',
                  workplace: p.workplace || '',
                  from_month: sm,
                  from_year: sy,
                  to_month: em,
                  to_year: ey,
                  from_month_date: `${sy}-${String(sm).padStart(2, '0')}-01`,
                  to_month_date: `${ey}-${String(em).padStart(2, '0')}-01`,
                  months: Number(p.months) || 0,
                  salary: p.salary ? Number(String(p.salary).replace(/\D/g, '')) || null : null,
                  notes: p.notes || ''
                };
              });
              const { error: insErr } = await supabase.from('customer_participations').insert(rows);
              if (insErr && (insErr.message?.includes('from_month_date') || insErr.code === 'PGRST204')) {
                // Fallback nếu database chưa có cột from_month_date / to_month_date
                const legacyRows = rows.map(({ from_month_date, to_month_date, ...rest }: any) => rest);
                await supabase.from('customer_participations').insert(legacyRows);
              }
            }
          }
        } catch (subErr) {
          // Không gián đoạn nếu bảng customer_participations chưa tồn tại
        }

        return { success: true, error: null };
      }

      // 3. Nếu database chưa có cột (PGRST204 hoặc PostgREST schema cache)
      const errStr = (error.message || '') + ' ' + (error.details || '');
      if (errStr.includes('prior_periods') || errStr.includes('PGRST204') || error.code === 'PGRST204') {
        console.warn('[CustomerService] Supabase chưa có cột prior_periods, thực hiện lưu fallback vào ghi chú khách hàng:', error.message);
        
        // Fallback: lưu vào trường notes dạng metadata tag
        const metaTag = `[PRIOR_BHXH:${data.prior_compulsory_months}B_${data.prior_voluntary_months}T]`;
        const fallbackNotes = data.prior_participation_notes 
          ? `${metaTag} ${data.prior_participation_notes}`
          : metaTag;

        let fallbackQuery = supabase.from('customers').update({
          notes: fallbackNotes,
          updated_at: new Date().toISOString()
        });

        if (targetIdOrKey.includes('-') && targetIdOrKey.length >= 30) {
          fallbackQuery = fallbackQuery.eq('id', targetIdOrKey);
        } else {
          fallbackQuery = fallbackQuery.or(`customer_key.eq.${targetIdOrKey},id.eq.${targetIdOrKey},cccd.eq.${targetIdOrKey},bhxh.eq.${targetIdOrKey}`);
        }

        const { error: fbErr } = await fallbackQuery;
        if (fbErr) throw fbErr;
        return { success: true, error: null };
      }

      throw error;
    } catch (err: any) {
      console.error('[CustomerService] Lỗi khi cập nhật quá trình tham gia khách hàng:', err);
      return { success: false, error: err };
    }
  }
};
