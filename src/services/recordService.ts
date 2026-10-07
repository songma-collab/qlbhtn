/**
 * Service Layer: Data Access Layer cho Bảng Records (Giao dịch tham gia BHXH/BHYT)
 * Tuân thủ Clean Architecture, trừu tượng hóa tương tác Supabase và đảm bảo Schema Resilience.
 * 100% snake_case cho toàn bộ query keys và RPC params.
 */
import { supabase } from '../lib/supabase';
import { RecordType } from '../context/types';
import { recordToDb, dbToRecord, generateIdempotencyKey } from '../utils/sanitize';
import { withRetry } from '../utils/networkHelper';

// Bộ nhớ đệm các cột chưa tồn tại trong Database để tránh lỗi PostgREST PGRST204
export const unsupportedRecordColumns = new Set<string>();

/**
 * Xử lý lỗi Schema Cache thiếu cột trong database của Supabase
 */
export const handleSchemaCacheMissingColumn = (error: any, payload: any): boolean => {
  if (!error) return false;
  const errorMsg = error.message || '';
  if (
    error.code === 'PGRST204' ||
    errorMsg.includes('in the schema cache') ||
    errorMsg.includes('Could not find the')
  ) {
    const match = errorMsg.match(/Could not find the '([^']+)' column/);
    if (match && match[1]) {
      const missingCol = match[1];
      console.warn(`[RecordService Fallback] Database chưa có cột '${missingCol}', tự động loại trừ và ghi nhớ.`);
      unsupportedRecordColumns.add(missingCol);
      if (Array.isArray(payload)) {
        payload.forEach(item => {
          if (item && typeof item === 'object') delete item[missingCol];
        });
      } else if (payload && typeof payload === 'object') {
        delete payload[missingCol];
      }
      return true;
    }
  }
  return false;
};

/**
 * Làm sạch và chuẩn hóa dữ liệu bản ghi sang 100% snake_case trước khi truyền xuống CSDL
 */
export const prepareRecordPayload = (record: any, isUpdate = false): any => {
  if (!record || typeof record !== 'object') return record;
  const clean = recordToDb(record);
  if (isUpdate) {
    delete clean.id; // Không update primary key
  } else {
    // Tự động gán idempotency_key nếu chưa có để ngăn chặn trùng lặp giao dịch
    if (!clean.idempotency_key) {
      clean.idempotency_key = generateIdempotencyKey();
    }
  }
  unsupportedRecordColumns.forEach(col => {
    delete clean[col];
  });
  return clean;
};

export const recordService = {
  /**
   * Lấy danh sách giao dịch có phân trang và bộ lọc (hỗ trợ cả staff_id và staffId)
   */
  async fetchRecords(options?: {
    limit?: number | undefined;
    offset?: number | undefined;
    type?: string | undefined;
    staff_id?: string | undefined;
    staffId?: string | undefined;
  }): Promise<{ data: RecordType[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        let query = supabase.from('records').select('*').order('date', { ascending: false });

        if (options?.type && options.type !== 'all') {
          query = query.eq('type', options.type);
        }
        const staffId = options?.staff_id || options?.staffId;
        if (staffId && staffId !== 'all') {
          query = query.eq('staff_id', staffId);
        }
        if (options?.limit) {
          const from = options.offset || 0;
          query = query.range(from, from + options.limit - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        const normalized = (data || []).map(r => dbToRecord(r));
        return { data: normalized, error: null };
      });
    } catch (err: any) {
      return { data: [], error: err };
    }
  },

  /**
   * Lấy toàn bộ danh sách giao dịch cho DataContext
   */
  async fetchAllRecords(options?: {
    staff_id?: string | undefined;
    limit?: number | undefined;
  }): Promise<RecordType[]> {
    try {
      let query = supabase
        .from('records')
        .select('*')
        .order('date', { ascending: false })
        .limit(options?.limit || 2500);

      if (options?.staff_id) {
        query = query.eq('staff_id', options.staff_id);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        return [];
      }

      // Nhận diện các cột thiếu trên DB để chống lỗi
      if (data.length > 0 && data[0]) {
        const sampleRow = data[0] as Record<string, any>;
        const candidateCols = [
          'base_salary_snapshot',
          'poverty_standard_snapshot',
          'policy_version_id',
          'applied_rates',
          'is_adjustment',
          'original_record_id',
          'adjustment_reason',
          'is_submitted_bhxh',
          'submission_batch',
          'submitted_date'
        ];
        candidateCols.forEach(col => {
          if (!(col in sampleRow)) {
            unsupportedRecordColumns.add(col);
          }
        });
      }

      return (data || []).map(r => dbToRecord(r));
    } catch (err) {
      console.warn('[RecordService] fetchAllRecords failed:', err);
      return [];
    }
  },

  /**
   * Tìm kiếm và phân trang giao dịch tài chính từ Server qua RPC finance_search_records (Hiệu năng cao)
   */
  async searchRecordsServer(options: {
    type?: string | undefined;
    search?: string | undefined;
    staff_id?: string | undefined;
    staffId?: string | undefined;
    payment_status?: string | undefined;
    paymentStatus?: string | undefined;
    batch_code?: string | undefined;
    batchCode?: string | undefined;
    from_date?: string | undefined;
    fromDate?: string | undefined;
    to_date?: string | undefined;
    toDate?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ data: RecordType[]; totalCount: number; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('finance_search_records', {
          p_type: options.type || 'ALL',
          p_search: options.search || '',
          p_staff_id: options.staff_id || options.staffId || 'all',
          p_payment_status: options.payment_status || options.paymentStatus || 'all',
          p_batch_code: options.batch_code || options.batchCode || 'all',
          p_from_date: options.from_date || options.fromDate || null,
          p_to_date: options.to_date || options.toDate || null,
          p_limit: options.limit || 20,
          p_offset: options.offset || 0,
        });

        if (error) throw error;
        const totalCount = data && data.length > 0 ? Number(data[0]?.total_count) || 0 : 0;
        const normalized = (data || []).map((r: any) => dbToRecord(r));
        return { data: normalized, totalCount, error: null };
      });
    } catch (err: any) {
      console.warn('[RecordService] Lỗi searchRecordsServer:', err);
      return { data: [], totalCount: 0, error: err };
    }
  },

  /**
   * Thêm mới một hồ sơ tham gia
   */
  async createRecord(record: Omit<RecordType, 'id'>): Promise<{ data: RecordType | null; error: Error | null }> {
    try {
      const payload = prepareRecordPayload(record, false);
      let data: any = null;
      let error: any = null;
      let maxRetries = 10;

      while (maxRetries > 0) {
        maxRetries--;
        const res = await supabase.from('records').insert([payload]).select().single();
        data = res.data;
        error = res.error;
        if (!error) break;

        const handled = handleSchemaCacheMissingColumn(error, payload);
        if (!handled) break;
      }

      if (error) throw error;
      const created = data ? dbToRecord(data) : null;
      return { data: created, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi tạo hồ sơ:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Cập nhật một hồ sơ theo ID
   */
  async updateRecord(id: number, updates: Partial<RecordType>): Promise<{ success: boolean; error: Error | null }> {
    try {
      const payload = prepareRecordPayload(updates, true);
      let error: any = null;
      let maxRetries = 10;

      while (maxRetries > 0) {
        maxRetries--;
        const res = await supabase.from('records').update(payload).eq('id', id);
        error = res.error;
        if (!error) break;

        const handled = handleSchemaCacheMissingColumn(error, payload);
        if (!handled) break;
      }

      if (error) {
        // Fallback: nếu cập nhật payment_status gặp lỗi RLS từ PostgREST, gọi RPC confirm_record_payment
        const targetPaymentStatus = (updates as any).payment_status || (updates as any).paymentStatus;
        if (targetPaymentStatus && (error.message?.includes('row-level security') || error.code === '42501')) {
          try {
            const { data: rpcRes, error: rpcErr } = await supabase.rpc('confirm_record_payment', {
              p_record_id: id,
              p_new_status: targetPaymentStatus
            });
            if (!rpcErr && (rpcRes?.success === true || rpcRes === true)) {
              error = null;
            }
          } catch (rpcEx) {
            console.warn('[RecordService] RPC confirm_record_payment fallback:', rpcEx);
          }
        }
      }

      if (error) throw error;

      // Tự động đồng bộ các trường thông tin nhân khẩu mới nhất sang các giao dịch khác của cùng khách hàng
      const profileFields = [
        'name', 'phone', 'address', 'dob', 'gender', 'nation', 'email',
        'recv_name', 'recv_phone', 'recv_address'
      ];
      const profileUpdates: Record<string, any> = {};
      profileFields.forEach(f => {
        if (payload[f] !== undefined) {
          profileUpdates[f] = payload[f];
        }
      });

      const targetCccd = payload.cccd || (updates as any).cccd;
      const targetBhxh = payload.bhxh || (updates as any).bhxh;

      if (Object.keys(profileUpdates).length > 0 && (targetCccd || targetBhxh)) {
        profileUpdates.updated_at = new Date().toISOString();
        try {
          let syncQuery = supabase.from('records').update(profileUpdates).neq('id', id);
          if (targetCccd && targetBhxh) {
            syncQuery = syncQuery.or(`cccd.eq.${targetCccd},bhxh.eq.${targetBhxh}`);
          } else if (targetCccd) {
            syncQuery = syncQuery.eq('cccd', targetCccd);
          } else if (targetBhxh) {
            syncQuery = syncQuery.eq('bhxh', targetBhxh);
          }
          await syncQuery;
        } catch (syncErr) {
          console.warn('[RecordService] Đồng bộ thông tin nhân thân hồ sơ khác:', syncErr);
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi cập nhật hồ sơ:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Cập nhật trạng thái và ghi chú hồ sơ
   */
  async updateRecordStatusAndNotes(id: number, status: string, notes: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('records')
        .update({ status, notes })
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi updateRecordStatusAndNotes:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Hủy hồ sơ (cập nhật payment_status = 'Đã hủy')
   */
  async cancelRecord(id: number, reason: string, currentNotes?: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const updatedNotes = `${currentNotes ? currentNotes + ' | ' : ''}[ĐÃ HỦY] Lý do: ${reason || 'Không có'}`;
      const { error } = await supabase
        .from('records')
        .update({
          payment_status: 'Đã hủy',
          notes: updatedNotes
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi cancelRecord:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Xóa một hồ sơ theo ID (ưu tiên RPC delete_record_safe)
   */
  async deleteRecord(id: number): Promise<{ success: boolean; message?: string; error: Error | null }> {
    try {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_record_safe', { p_record_id: id });
        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, error: null };
        } else if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
          return { success: false, message: rpcErr.message, error: new Error(rpcErr.message) };
        } else if (rpcRes && !rpcRes.success) {
          return { success: false, message: rpcRes.message || 'CSDL từ chối xóa giao dịch này', error: new Error(rpcRes.message) };
        }
      } catch (rpcEx) {
        console.warn('[RecordService] RPC delete_record_safe unavailable, proceeding to direct delete:', rpcEx);
      }

      const { data: deletedRows, error } = await supabase.from('records').delete().eq('id', id).select();
      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        return { success: false, message: '0 bản ghi bị xóa (thao tác bị chặn bởi Trigger hoặc phân quyền)', error: new Error('0 bản ghi bị xóa') };
      }
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi xóa hồ sơ:', err);
      return { success: false, message: err?.message, error: err };
    }
  },

  /**
   * Thêm/Cập nhật hàng loạt (Chunked Bulk Insert / Upsert)
   */
  async bulkPutRecords(records: RecordType[]): Promise<{ success: boolean; count: number; error: Error | null }> {
    try {
      const BATCH_SIZE = 200;
      const newItems = records.filter(r => !r.id);
      const existingItems = records.filter(r => Boolean(r.id));

      if (newItems.length > 0) {
        for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
          const chunk = newItems.slice(i, i + BATCH_SIZE).map(item => prepareRecordPayload(item, false));
          let error: any = null;
          let maxRetries = 10;
          while (maxRetries > 0) {
            maxRetries--;
            const res = await supabase.from('records').insert(chunk);
            error = res.error;
            if (!error) break;
            const handled = handleSchemaCacheMissingColumn(error, chunk);
            if (!handled) break;
          }
          if (error) throw error;
        }
      }

      if (existingItems.length > 0) {
        for (let i = 0; i < existingItems.length; i += BATCH_SIZE) {
          const chunk = existingItems.slice(i, i + BATCH_SIZE).map(item => {
            const clean = prepareRecordPayload(item, false);
            clean.id = item.id;
            return clean;
          });
          let error: any = null;
          let maxRetries = 10;
          while (maxRetries > 0) {
            maxRetries--;
            const res = await supabase.from('records').upsert(chunk);
            error = res.error;
            if (!error) break;
            const handled = handleSchemaCacheMissingColumn(error, chunk);
            if (!handled) break;
          }
          if (error) throw error;
        }
      }

      return { success: true, count: records.length, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi lưu hàng loạt hồ sơ:', err);
      return { success: false, count: 0, error: err };
    }
  },

  /**
   * Xóa hàng loạt hồ sơ (ưu tiên RPC bulk_delete_records_safe)
   */
  async bulkDeleteRecords(ids: number[]): Promise<{ success: boolean; count: number; message?: string; error: Error | null }> {
    try {
      if (!ids || ids.length === 0) return { success: true, count: 0, error: null };

      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('bulk_delete_records_safe', { p_record_ids: ids });
        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, count: ids.length, error: null };
        } else if (rpcErr && rpcErr.message && !rpcErr.message.includes('function') && !rpcErr.message.includes('does not exist')) {
          return { success: false, count: 0, message: rpcErr.message, error: new Error(rpcErr.message) };
        }
      } catch (rpcEx) {
        console.warn('[RecordService] RPC bulk_delete_records_safe unavailable, proceeding to direct delete:', rpcEx);
      }

      const { data: deletedRows, error } = await supabase.from('records').delete().in('id', ids).select();
      if (error) throw error;
      const count = deletedRows ? deletedRows.length : 0;
      return { success: count > 0, count, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi xóa hàng loạt hồ sơ:', err);
      return { success: false, count: 0, message: err?.message, error: err };
    }
  },

  /**
   * Tra cứu toàn bộ giao dịch của một khách hàng theo Customer ID hoặc Customer Key
   * Sử dụng 100% snake_case: customer_id, customer_key, cccd, bhxh
   */
  async fetchCustomerTransactions(customerIdOrKey: string): Promise<RecordType[]> {
    if (!customerIdOrKey) return [];
    try {
      const cleanKey = customerIdOrKey.trim();
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .or(`customer_id.eq.${cleanKey},customer_key.eq.${cleanKey},cccd.eq.${cleanKey},bhxh.eq.${cleanKey}`)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []).map(r => dbToRecord(r));
    } catch (err) {
      console.warn('[RecordService] Lỗi fetchCustomerTransactions:', err);
      return [];
    }
  },

  /**
   * Tra cứu bản ghi hồ sơ theo CCCD (chỉ lấy name, dob, cccd)
   */
  async findRecordByCccd(cccd?: string): Promise<{ name?: string; dob?: string; cccd?: string } | null> {
    if (!cccd) return null;
    try {
      const { data, error } = await supabase
        .from('records')
        .select('name, dob, cccd')
        .eq('cccd', cccd)
        .order('updated_at', { ascending: false })
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] || null;
    } catch (err) {
      console.warn('[RecordService] findRecordByCccd error:', err);
      return null;
    }
  },

  /**
   * Tra cứu bản ghi hồ sơ mới nhất theo mã (cccd, bhxh, hoặc old_bhxh)
   * Luôn ưu tiên bản ghi có thời điểm cập nhật gần nhất (updated_at)
   */
  async findLatestRecordByCode(code: string): Promise<RecordType | null> {
    if (!code) return null;
    const clean = code.trim().replace(/\D/g, '');
    if (!clean) return null;
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .or(`cccd.eq.${clean},bhxh.eq.${clean},old_bhxh.eq.${clean}`)
        .neq('payment_status', 'Đã hủy')
        .order('updated_at', { ascending: false })
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data?.[0] ? dbToRecord(data[0]) : null;
    } catch (err) {
      console.warn('[RecordService] findLatestRecordByCode error:', err);
      return null;
    }
  },

  /**
   * Cập nhật ghi chú (notes) của hồ sơ theo ID hoặc định danh khách hàng
   */
  async updateRecordNotes(
    target: { id?: number | string; cccd?: string; bhxh?: string; phone?: string },
    notes: string
  ): Promise<{ error: Error | null }> {
    try {
      let query = supabase.from('records').update({ notes });
      const targetId = Number(target.id);
      if (!isNaN(targetId) && targetId > 0) {
        query = query.eq('id', targetId);
      } else if (target.cccd) {
        query = query.eq('cccd', target.cccd);
      } else if (target.bhxh) {
        query = query.eq('bhxh', target.bhxh);
      } else if (target.phone) {
        query = query.eq('phone', target.phone);
      } else {
        throw new Error('Thiếu điều kiện định danh hồ sơ để cập nhật ghi chú.');
      }

      const { error } = await query;
      if (error) throw error;
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  },

  /**
   * Phân công cán bộ thu cho danh sách hồ sơ
   */
  async assignStaffToRecords(recordIds: (number | string)[], staffId: string | null): Promise<void> {
    if (!recordIds || recordIds.length === 0) return;
    const numericIds = recordIds.map(Number).filter(n => !isNaN(n) && n > 0);
    if (numericIds.length === 0) return;
    try {
      await supabase
        .from('records')
        .update({
          staff_id: staffId || null,
          updated_at: new Date().toISOString()
        })
        .in('id', numericIds);
    } catch (err) {
      console.warn('[RecordService] assignStaffToRecords error:', err);
    }
  }
};


