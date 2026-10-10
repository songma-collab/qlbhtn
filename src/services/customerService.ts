/**
 * Service Layer: Data Access Layer cho Bảng Customers (Hồ sơ gốc Master Data khách hàng)
 * 100% snake_case cho toàn bộ query keys và RPC params.
 */
import { supabase } from '../lib/supabase';
import { CustomerType, normalizeLegacyPayload } from '../context/types';
import { withRetry } from '../utils/networkHelper';
import { compareRecordsByContractLatest } from '../utils/helpers';

export const customerService = {
  /**
   * Lấy danh sách khách hàng Master Data (có phân trang / lọc)
   */
  async fetchCustomers(options?: {
    type?: string | undefined;
    staff_id?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ data: CustomerType[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        let query = supabase.from('customers').select('*').order('latest_date', { ascending: false });

        if (options?.type && options.type !== 'all' && options.type !== 'ALL') {
          query = query.or(`type.eq.${options.type},type.eq.CẢ HAI`);
        }
        if (options?.staff_id && options.staff_id !== 'all') {
          query = query.eq('staff_id', options.staff_id);
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
   * Lấy toàn bộ danh sách khách hàng cho DataContext
   */
  async fetchAllCustomers(options?: {
    staff_id?: string | undefined;
    limit?: number | undefined;
  }): Promise<CustomerType[]> {
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(options?.limit || 2500);

      if (options?.staff_id) {
        query = query.eq('staff_id', options.staff_id);
      }

      const { data, error } = await query;
      if (error || !data) return [];
      return (data as any[]).map(c => normalizeLegacyPayload(c) as CustomerType);
    } catch (err) {
      console.warn('[CustomerService] fetchAllCustomers failed:', err);
      return [];
    }
  },

  /**
   * Tìm kiếm và phân trang khách hàng từ Server qua RPC crm_search_customers (Hiệu năng cao)
   */
  async searchCustomersServer(options: {
    type?: string | undefined;
    search?: string | undefined;
    staff_id?: string | undefined;
    staffId?: string | undefined;
    status?: string | undefined;
    from_date?: string | undefined;
    fromDate?: string | undefined;
    to_date?: string | undefined;
    toDate?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ data: CustomerType[]; totalCount: number; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('crm_search_customers', {
          p_type: options.type || 'ALL',
          p_search: options.search || '',
          p_staff_id: options.staff_id || options.staffId || 'all',
          p_status: options.status || 'all',
          p_from_date: options.from_date || options.fromDate || null,
          p_to_date: options.to_date || options.toDate || null,
          p_limit: options.limit || 20,
          p_offset: options.offset || 0,
        });

        if (error) throw error;
        const totalCount = data && data.length > 0 ? Number(data[0]?.total_count) || 0 : 0;
        const normalized = (data || []).map((c: any) => normalizeLegacyPayload(c) as CustomerType);
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
      const profile = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      return profile ? (normalizeLegacyPayload(profile) as CustomerType) : null;
    } catch (err) {
      console.warn('[CustomerService] Lỗi khi tra cứu profile khách hàng:', err);
      return null;
    }
  },

  /**
   * Tra cứu khách hàng theo mã số (CCCD, BHXH hoặc old_bhxh) từ bảng customers
   */
  async findCustomerByCode(code: string): Promise<CustomerType | null> {
    const clean = (code || '').replace(/\D/g, '');
    if (!clean) return null;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`cccd.eq.${clean},bhxh.eq.${clean},old_bhxh.eq.${clean}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return normalizeLegacyPayload(data) as CustomerType;
    } catch (err) {
      console.warn('[CustomerService] Lỗi findCustomerByCode:', err);
      return null;
    }
  },

  /**
   * Cập nhật trạng thái khách hàng trong bảng customers
   */
  async updateCustomerStatus(customerKey: string, status: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('customer_key', customerKey);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CustomerService] Lỗi updateCustomerStatus:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Cập nhật trạng thái thanh toán khách hàng trong bảng customers
   */
  async updateCustomerPaymentStatus(customerKey: string, payment_status: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ payment_status, updated_at: new Date().toISOString() })
        .eq('customer_key', customerKey);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CustomerService] Lỗi updateCustomerPaymentStatus:', err);
      return { success: false, error: err };
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
   * Xóa khách hàng cascade thủ công (Fallback nếu RPC delete_customer_cascade chưa có hoặc lỗi)
   */
  async deleteCustomerCascadeFallback(customerKey: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const cleanKey = customerKey.trim();
      const { data: relatedRecords } = await supabase
        .from('records')
        .select('id')
        .or(`customer_key.eq.${cleanKey},bhxh.eq.${cleanKey},cccd.eq.${cleanKey},phone.eq.${cleanKey}`);

      if (relatedRecords && relatedRecords.length > 0) {
        const ids = relatedRecords.map(r => r.id);
        const { error: delRecErr } = await supabase.from('records').delete().in('id', ids);
        if (delRecErr) throw delRecErr;
      }

      const { error: delCustErr } = await supabase
        .from('customers')
        .delete()
        .or(`customer_key.eq.${cleanKey},cccd.eq.${cleanKey},bhxh.eq.${cleanKey}`);

      if (delCustErr) throw delCustErr;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[CustomerService] Lỗi deleteCustomerCascadeFallback:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Đồng bộ lại thông tin tóm tắt của khách hàng trong bảng customers từ danh sách records thực tế còn lại
   */
  async resyncCustomerFromRecords(
    customerIdentifier: { customerKey?: string | undefined; cccd?: string | undefined; bhxh?: string | undefined; phone?: string | undefined; id?: any },
    currentRecords: any[]
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const cleanC = (customerIdentifier.cccd || '').replace(/\D/g, '');
      const cleanB = (customerIdentifier.bhxh || '').replace(/\D/g, '');
      const cleanK = (customerIdentifier.customerKey || '').trim();

      const activeRecords = (currentRecords || []).filter(r => {
        const pStatus = r.payment_status || (r as any).paymentStatus;
        if (pStatus === 'Đã hủy' || pStatus === 'Đã thoái thu') return false;
        const rC = (r.cccd || (r as any).citizenId || '').replace(/\D/g, '');
        const rB = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
        const rK = (r.customer_key || (r as any).customerKey || '').trim();
        return (cleanK && rK === cleanK) || (cleanC && (rC === cleanC || rB === cleanC)) || (cleanB && (rB === cleanB || rC === cleanB));
      });

      if (activeRecords.length === 0) {
        // Không còn giao dịch nào: Xóa khách hàng khỏi danh bạ nếu không có hồ sơ độc lập
        if (cleanK) {
          await supabase.from('customers').delete().eq('customer_key', cleanK);
        } else if (cleanC || cleanB) {
          await supabase.from('customers').delete().or(`cccd.eq.${cleanC || 'null'},bhxh.eq.${cleanB || 'null'}`);
        }
        return { success: true, error: null };
      }

      // Sắp xếp tìm hợp đồng có kỳ hạn mới nhất
      const sortedContract = [...activeRecords].sort(compareRecordsByContractLatest);
      const latestContract = sortedContract[0];

      // Sắp xếp tìm thông tin cập nhật gần nhất
      const sortedUpdate = [...activeRecords].sort((a, b) => {
        const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
        const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
        if (upB !== upA) return upB - upA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
      const latestUpdate = sortedUpdate[0];

      const totalAmountPaid = activeRecords
        .filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      const totalContributions = activeRecords
        .filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
        .reduce((sum, r) => sum + (Number(r.months) || 1), 0);

      const updatePayload: Record<string, any> = {
        name: latestUpdate.name,
        phone: latestUpdate.phone,
        address: latestUpdate.address,
        dob: latestUpdate.dob,
        gender: latestUpdate.gender,
        nation: latestUpdate.nation,
        email: latestUpdate.email,
        from_month: latestContract.from_month || (latestContract as any).fromMonth || null,
        to_month: latestContract.to_month || (latestContract as any).toMonth || null,
        next_payment: latestContract.next_payment || (latestContract as any).nextPayment || null,
        payment_status: latestContract.payment_status || (latestContract as any).paymentStatus || 'Chờ thanh toán',
        status: latestContract.status || 'Đang tham gia',
        latest_date: latestContract.date ? new Date(latestContract.date).toISOString().split('T')[0] : null,
        latest_amount: latestContract.amount,
        latest_record_id: latestContract.id,
        total_amount_paid: totalAmountPaid,
        total_contributions: totalContributions,
        updated_at: new Date().toISOString()
      };

      let query = supabase.from('customers').update(updatePayload);
      if (cleanK) {
        query = query.eq('customer_key', cleanK);
      } else {
        query = query.or(`cccd.eq.${cleanC || 'null'},bhxh.eq.${cleanB || 'null'}`);
      }
      const { error } = await query;
      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.warn('[CustomerService] resyncCustomerFromRecords warning:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Cập nhật hồ sơ quá trình tham gia trước đây của khách hàng (Bắt buộc & Tự nguyện nơi khác)
   */
  async updateCustomerParticipation(
    targetIdOrKey: string,
    data: {
      prior_periods: any[];
      prior_voluntary_months: number;
      prior_compulsory_months: number;
      prior_participation_notes?: string | undefined;
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
      // 1. Thử gọi RPC lưu trữ bảo đảm atomicity
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
      } catch (_) {
        // Fallback direct table update
      }

      // 2. Cập nhật trực tiếp bảng customers
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
                const legacyRows = rows.map(({ from_month_date, to_month_date, ...rest }: any) => rest);
                await supabase.from('customer_participations').insert(legacyRows);
              }
            }
          }
        } catch (syncPartErr) {
          console.warn('[CustomerService] Optional customer_participations table sync warning:', syncPartErr);
        }

        return { success: true, error: null };
      }

      // 3. Fallback nếu thiếu cột
      const errStr = (error.message || '') + ' ' + (error.details || '');
      if (errStr.includes('prior_periods') || errStr.includes('PGRST204') || error.code === 'PGRST204') {
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
  },

  /**
   * Upsert danh sách customer profiles khi import danh bạ
   */
  async upsertCustomerProfiles(customerProfiles: any[]): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('customers')
        .upsert(customerProfiles, { onConflict: 'customer_key' });

      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Gọi RPC tra cứu hồ sơ khách hàng đã đăng nhập
   */
  async lookupCustomerProfileRpc(code: string): Promise<{ data: any[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('lookup_customer_profile', { p_code: code });
      if (error) throw error;
      return { data: (data || []) as any[], error: null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  },

  /**
   * Phân công cán bộ thu cho danh sách khách hàng
   */
  async assignStaffToCustomers(customerKeys: string[], staffId: string | null): Promise<number> {
    if (!customerKeys || customerKeys.length === 0) return 0;
    try {
      const { data, error } = await supabase
        .from('customers')
        .update({
          staff_id: staffId || null,
          updated_at: new Date().toISOString()
        })
        .in('customer_key', customerKeys)
        .select('id');

      if (!error && data) return data.length;

      let totalUpdated = 0;
      for (const cKey of customerKeys) {
        const { error: singleErr } = await supabase
          .from('customers')
          .update({
            staff_id: staffId || null,
            updated_at: new Date().toISOString()
          })
          .or(`customer_key.eq.${cKey},cccd.eq.${cKey},bhxh.eq.${cKey},phone.eq.${cKey}`);

        if (!singleErr) totalUpdated++;
      }
      return totalUpdated;
    } catch (err) {
      console.warn('[CustomerService] assignStaffToCustomers error:', err);
      return 0;
    }
  }
};


