/**
 * Service Layer: Data Access Layer cho Bảng Customers (Hồ sơ gốc Master Data khách hàng)
 * 100% snake_case cho toàn bộ query keys và RPC params.
 */
import { supabase } from '../lib/supabase';
import { CustomerType, normalizeLegacyPayload } from '../context/types';
import { withRetry } from '../utils/networkHelper';
import { compareRecordsByContractLatest, getSafeTimestamp } from '../utils/helpers';

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
      const targetLimit = options?.limit;
      const CHUNK_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('customers')
          .select('*')
          .order('latest_date', { ascending: false, nullsFirst: false })
          .order('updated_at', { ascending: false });

        if (options?.staff_id) {
          query = query.eq('staff_id', options.staff_id);
        }

        const currentChunkSize = targetLimit ? Math.min(CHUNK_SIZE, targetLimit - allRows.length) : CHUNK_SIZE;
        query = query.range(from, from + currentChunkSize - 1);

        const { data, error } = await query;
        if (error) {
          console.warn('[CustomerService] fetchAllCustomers chunk error:', error);
          break;
        }

        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...data);
          from += data.length;

          if (data.length < currentChunkSize || (targetLimit && allRows.length >= targetLimit)) {
            hasMore = false;
          }
        }
      }

      return allRows.map(c => normalizeLegacyPayload(c) as CustomerType);
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
   * Cập nhật trạng thái khách hàng trong bảng customers (hỗ trợ customer_key, UUID id, CCCD, BHXH)
   */
  async updateCustomerStatus(
    customerKeyOrId: string, 
    status: string,
    metadata?: { id?: string | undefined; cccd?: string | undefined; bhxh?: string | undefined; customer_key?: string | undefined }
  ): Promise<{ success: boolean; error: Error | null }> {
    try {
      const trimmed = (customerKeyOrId || '').trim();
      if (!trimmed && !metadata?.id && !metadata?.customer_key && !metadata?.cccd && !metadata?.bhxh) {
        return { success: false, error: new Error('Mã khách hàng không hợp lệ') };
      }

      // 1. Ưu tiên cập nhật bằng UUID (ID chính trong bảng customers)
      const targetUuid = (metadata?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(metadata.id))
        ? metadata.id
        : (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ? trimmed : null);

      if (targetUuid) {
        const { error: uuidErr } = await supabase
          .from('customers')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', targetUuid);
        if (!uuidErr) return { success: true, error: null };
      }

      // 2. Thử cập nhật theo customer_key trực tiếp (không dùng .or() chứa chuỗi có khoảng trắng/unicode)
      const keyToMatch = metadata?.customer_key || (!/^\d+$/.test(trimmed) && trimmed !== targetUuid ? trimmed : null);
      if (keyToMatch) {
        const { data: keyData, error: keyErr } = await supabase
          .from('customers')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('customer_key', keyToMatch)
          .select('id');
        if (!keyErr && keyData && keyData.length > 0) {
          return { success: true, error: null };
        }
      }

      // 3. Thử cập nhật theo số định danh (CCCD hoặc BHXH dạng số thuần túy, an toàn tuyệt đối với PostgREST)
      const cleanNum = (metadata?.cccd || metadata?.bhxh || trimmed).replace(/\D/g, '');
      if (cleanNum) {
        const { error: numErr } = await supabase
          .from('customers')
          .update({ status, updated_at: new Date().toISOString() })
          .or(`cccd.eq.${cleanNum},bhxh.eq.${cleanNum}`);
        if (!numErr) return { success: true, error: null };
      }

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

      // Sắp xếp tìm hợp đồng có kỳ hạn mới nhất (để kế thừa kỳ hạn)
      const sortedContract = [...activeRecords].sort(compareRecordsByContractLatest);
      const latestContract = sortedContract[0];

      // Lọc các bản ghi hợp đồng đóng tiền hợp lệ (loại trừ thoái thu / giảm trừ)
      const validContributionRecords = activeRecords.filter(r => {
        const isAdj = r.is_adjustment || (r as any).isAdjustment;
        const aType = r.action_type || (r as any).actionType;
        return !isAdj && aType !== 'Thoái thu' && (Number(r.amount) || 0) > 0;
      });

      // Sắp xếp tìm giao dịch đóng/nộp tiền mới nhất theo thời gian thực (loại trừ thoái thu âm tiền)
      const recordsForTxn = validContributionRecords.length > 0 ? validContributionRecords : activeRecords;
      const sortedTxn = [...recordsForTxn].sort((a, b) => {
        const tA = getSafeTimestamp(a.date || a.created_at);
        const tB = getSafeTimestamp(b.date || b.created_at);
        if (tB !== tA) return tB - tA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
      const latestTxn = sortedTxn[0] || latestContract;

      // Sắp xếp tìm thông tin cập nhật gần nhất
      const sortedUpdate = [...activeRecords].sort((a, b) => {
        const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
        const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
        if (upB !== upA) return upB - upA;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
      const latestUpdate = sortedUpdate[0];

      // Xác định loại hình tham gia (BHXH, BHYT, CẢ HAI) và hạn nộp từng loại
      const hasBhxh = activeRecords.some(r => r.type === 'BHXH');
      const hasBhyt = activeRecords.some(r => r.type === 'BHYT');
      const overallType = hasBhxh && hasBhyt ? 'CẢ HAI' : (hasBhxh ? 'BHXH' : (hasBhyt ? 'BHYT' : (latestContract.type || 'BHXH')));

      const bhxhContract = activeRecords.filter(r => r.type === 'BHXH').sort(compareRecordsByContractLatest)[0];
      const bhytContract = activeRecords.filter(r => r.type === 'BHYT').sort(compareRecordsByContractLatest)[0];
      const nextPaymentBhxh = bhxhContract?.next_payment || (bhxhContract as any)?.nextPayment || null;
      const nextPaymentBhyt = bhytContract?.next_payment || (bhytContract as any)?.nextPayment || null;

      const totalAmountPaid = Math.max(0, activeRecords
        .filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
        .reduce((sum, r) => sum + (Number(r.amount) || 0), 0));

      const totalContributions = Math.max(0, activeRecords
        .filter(r => (r.payment_status || (r as any).paymentStatus) === 'Đã thu tiền')
        .reduce((sum, r) => {
          const isAdj = r.is_adjustment || (r as any).isAdjustment;
          const aType = r.action_type || (r as any).actionType;
          return sum + (isAdj || aType === 'Thoái thu' ? -1 : 1);
        }, 0));

      const updatePayload: Record<string, any> = {
        name: latestUpdate.name,
        phone: latestUpdate.phone,
        address: latestUpdate.address,
        dob: latestUpdate.dob,
        gender: latestUpdate.gender,
        nation: latestUpdate.nation,
        email: latestUpdate.email,
        type: overallType,
        has_bhxh: hasBhxh,
        has_bhyt: hasBhyt,
        from_month: latestContract.from_month || (latestContract as any).fromMonth || null,
        to_month: latestContract.to_month || (latestContract as any).toMonth || null,
        next_payment: latestContract.next_payment || (latestContract as any).nextPayment || null,
        next_payment_bhxh: nextPaymentBhxh,
        next_payment_bhyt: nextPaymentBhyt,
        payment_status: latestContract.payment_status || (latestContract as any).paymentStatus || 'Chờ thanh toán',
        status: latestContract.status || 'Đang tham gia',
        latest_date: latestTxn.date ? new Date(latestTxn.date).toISOString().split('T')[0] : (latestContract.date ? new Date(latestContract.date).toISOString().split('T')[0] : null),
        latest_amount: Math.max(0, Number(latestTxn.amount !== undefined ? latestTxn.amount : latestContract.amount) || 0),
        latest_record_id: latestTxn.id || latestContract.id,
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
      const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetIdOrKey);
      let query = supabase.from('customers').update(payload);
      if (isTargetUuid) {
        query = query.eq('id', targetIdOrKey);
      } else if (/^\d+$/.test(targetIdOrKey)) {
        query = query.or(`cccd.eq.${targetIdOrKey},bhxh.eq.${targetIdOrKey}`);
      } else {
        query = query.eq('customer_key', targetIdOrKey);
      }

      const { error } = await query;
      if (!error) {
        // Đồng bộ thêm vào bảng quan hệ customer_participations nếu có
        try {
          let custQuery = supabase.from('customers').select('id, customer_key, cccd, bhxh');
          if (isTargetUuid) {
            custQuery = custQuery.eq('id', targetIdOrKey);
          } else if (/^\d+$/.test(targetIdOrKey)) {
            custQuery = custQuery.or(`cccd.eq.${targetIdOrKey},bhxh.eq.${targetIdOrKey}`);
          } else {
            custQuery = custQuery.eq('customer_key', targetIdOrKey);
          }
          const { data: custRec } = await custQuery.limit(1).maybeSingle();

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
   * Phân công cán bộ thu cho danh sách khách hàng (hỗ trợ cả UUID, customer_key, CCCD, BHXH)
   */
  async assignStaffToCustomers(customerKeys: string[], staffId: string | null): Promise<number> {
    if (!customerKeys || customerKeys.length === 0) return 0;
    try {
      const cleanKeys = Array.from(new Set(customerKeys.map(k => (k || '').trim()).filter(Boolean)));
      if (cleanKeys.length === 0) return 0;

      const uuids = cleanKeys.filter(k => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k));
      const nonUuids = cleanKeys.filter(k => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k));

      let updatedCount = 0;

      // 1. Cập nhật theo UUID (ưu tiên hàng đầu, độ tin cậy tuyệt đối)
      if (uuids.length > 0) {
        const { data: uuidData, error: uuidErr } = await supabase
          .from('customers')
          .update({
            staff_id: staffId || null,
            updated_at: new Date().toISOString()
          })
          .in('id', uuids)
          .select('id');
        if (!uuidErr && uuidData) {
          updatedCount += uuidData.length;
        }
      }

      // 2. Cập nhật theo customer_key trước
      if (nonUuids.length > 0) {
        const { data, error } = await supabase
          .from('customers')
          .update({
            staff_id: staffId || null,
            updated_at: new Date().toISOString()
          })
          .in('customer_key', nonUuids)
          .select('id');

        if (!error && data && data.length > 0) {
          updatedCount += data.length;
        } else {
          // Fallback an toàn: Thử khớp theo CCCD / BHXH dạng số thuần túy (tránh unquoted .or())
          const numbersList = nonUuids.filter(k => /^\d+$/.test(k));
          if (numbersList.length > 0) {
            const { data: cccdData, error: cccdErr } = await supabase
              .from('customers')
              .update({
                staff_id: staffId || null,
                updated_at: new Date().toISOString()
              })
              .in('cccd', numbersList)
              .select('id');
            if (!cccdErr && cccdData && cccdData.length > 0) {
              updatedCount += cccdData.length;
            } else {
              const { data: bhxhData, error: bhxhErr } = await supabase
                .from('customers')
                .update({
                  staff_id: staffId || null,
                  updated_at: new Date().toISOString()
                })
                .in('bhxh', numbersList)
                .select('id');
              if (!bhxhErr && bhxhData) {
                updatedCount += bhxhData.length;
              }
            }
          }
        }
      }

      return updatedCount;
    } catch (err) {
      console.warn('[CustomerService] assignStaffToCustomers error:', err);
      return 0;
    }
  }
};


