/**
 * Service Layer: Data Access Layer cho Bảng Records (Giao dịch tham gia BHXH/BHYT)
 * Tuân thủ Clean Architecture, trừu tượng hóa tương tác Supabase và đảm bảo Schema Resilience.
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
   * Lấy danh sách giao dịch có phân trang và bộ lọc
   */
  async fetchRecords(options?: {
    limit?: number;
    offset?: number;
    type?: string;
    staffId?: string;
  }): Promise<{ data: RecordType[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        let query = supabase.from('records').select('*').order('date', { ascending: false });

        if (options?.type && options.type !== 'all') {
          query = query.eq('type', options.type);
        }
        if (options?.staffId && options.staffId !== 'all') {
          query = query.eq('staff_id', options.staffId);
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
   * Tìm kiếm và phân trang giao dịch tài chính từ Server qua RPC finance_search_records (Hiệu năng cao)
   */
  async searchRecordsServer(options: {
    type?: string;
    search?: string;
    staffId?: string;
    paymentStatus?: string;
    batchCode?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: RecordType[]; totalCount: number; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase.rpc('finance_search_records', {
          p_type: options.type || 'ALL',
          p_search: options.search || '',
          p_staff_id: options.staffId || 'all',
          p_payment_status: options.paymentStatus || 'all',
          p_batch_code: options.batchCode || 'all',
          p_from_date: options.fromDate || null,
          p_to_date: options.toDate || null,
          p_limit: options.limit || 20,
          p_offset: options.offset || 0,
        });

        if (error) throw error;
        const totalCount = data && data.length > 0 ? Number(data[0].total_count) || 0 : 0;
        const normalized = (data || []).map(r => dbToRecord(r));
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
      let { data, error } = await supabase.from('records').insert([payload]).select();

      if (error && handleSchemaCacheMissingColumn(error, payload)) {
        const retryRes = await supabase.from('records').insert([payload]).select();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;
      const created = data && data[0] ? dbToRecord(data[0]) : null;
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
      let { error } = await supabase.from('records').update(payload).eq('id', id);

      if (error && handleSchemaCacheMissingColumn(error, payload)) {
        const retryRes = await supabase.from('records').update(payload).eq('id', id);
        error = retryRes.error;
      }

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi cập nhật hồ sơ:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Xóa một hồ sơ theo ID (ưu tiên RPC delete_record_safe)
   */
  async deleteRecord(id: number): Promise<{ success: boolean; error: Error | null }> {
    try {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_record_safe', { p_record_id: id });
        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, error: null };
        } else if (rpcRes && !rpcRes.success) {
          return { success: false, error: new Error(rpcRes.message || 'CSDL từ chối xóa giao dịch') };
        }
      } catch (_) {}

      const { data: deletedRows, error } = await supabase.from('records').delete().eq('id', id).select();
      if (error) throw error;
      if (!deletedRows || deletedRows.length === 0) {
        return { success: false, error: new Error('0 bản ghi bị xóa (thao tác bị chặn bởi Trigger hoặc chính sách bảo vệ dữ liệu CSDL)') };
      }
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi xóa hồ sơ:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Thêm/Cập nhật hàng loạt (Bulk Upsert)
   */
  async bulkPutRecords(records: RecordType[]): Promise<{ success: boolean; count: number; error: Error | null }> {
    try {
      const cleanRecords = records.map(r => prepareRecordPayload(r, false));
      let { error } = await supabase.from('records').upsert(cleanRecords, { onConflict: 'id' });

      if (error && handleSchemaCacheMissingColumn(error, cleanRecords)) {
        const retryRes = await supabase.from('records').upsert(cleanRecords, { onConflict: 'id' });
        error = retryRes.error;
      }

      if (error) throw error;
      return { success: true, count: records.length, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi lưu hàng loạt hồ sơ:', err);
      return { success: false, count: 0, error: err };
    }
  },

  /**
   * Xóa hàng loạt hồ sơ (Bulk Delete)
   */
  async bulkDeleteRecords(ids: number[]): Promise<{ success: boolean; count: number; error: Error | null }> {
    try {
      if (!ids || ids.length === 0) return { success: true, count: 0, error: null };
      const { error } = await supabase.from('records').delete().in('id', ids);
      if (error) throw error;
      return { success: true, count: ids.length, error: null };
    } catch (err: any) {
      console.error('[RecordService] Lỗi khi xóa hàng loạt hồ sơ:', err);
      return { success: false, count: 0, error: err };
    }
  },

  /**
   * Tra cứu toàn bộ giao dịch của một khách hàng theo Customer ID hoặc Customer Key
   */
  async fetchCustomerTransactions(customerIdOrKey: string): Promise<RecordType[]> {
    if (!customerIdOrKey) return [];
    try {
      const cleanKey = customerIdOrKey.trim();
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .or(`customerId.eq.${cleanKey},customerKey.eq.${cleanKey},cccd.eq.${cleanKey},bhxh.eq.${cleanKey}`)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []).map(r => dbToRecord(r));
    } catch (err) {
      console.warn('[RecordService] Lỗi fetchCustomerTransactions:', err);
      return [];
    }
  }
};
