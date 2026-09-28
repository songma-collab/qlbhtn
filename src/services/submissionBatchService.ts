/**
 * Service Layer: Data Access Layer cho Bảng submission_batches (Quản lý các đợt nộp BHXH/BHYT chính quy)
 * Đảm bảo kiến trúc Zero-Downtime, tương thích ngược hoàn hảo với các chuỗi submission_batch hiện có.
 */
import { supabase } from '../lib/supabase';
import { withRetry } from '../utils/networkHelper';

export interface SubmissionBatch {
  id: string;
  batch_code: string;
  insurance_type: 'BHXH' | 'BHYT' | 'CA_HAI';
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_by?: string | null;
  total_records: number;
  total_amount: number;
  submission_date?: string | null;
  approval_date?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const submissionBatchService = {
  /**
   * Lấy danh sách các đợt nộp hồ sơ
   */
  async fetchBatches(): Promise<{ data: SubmissionBatch[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase
          .from('submission_batches')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return { data: (data || []) as SubmissionBatch[], error: null };
      });
    } catch (err: any) {
      console.warn('[SubmissionBatchService] Bảng submission_batches chưa khả dụng hoặc có lỗi truy vấn:', err?.message);
      return { data: [], error: err };
    }
  },

  /**
   * Tạo hoặc đồng bộ một đợt nộp hồ sơ
   */
  async upsertBatch(batch: Partial<SubmissionBatch>): Promise<{ data: SubmissionBatch | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('submission_batches')
        .upsert([batch], { onConflict: 'batch_code' })
        .select()
        .maybeSingle();

      if (error) throw error;
      return { data: data as SubmissionBatch, error: null };
    } catch (err: any) {
      console.error('[SubmissionBatchService] Lỗi lưu đợt nộp hồ sơ:', err);
      return { data: null, error: err };
    }
  }
};
