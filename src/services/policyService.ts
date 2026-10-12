/**
 * Service Layer: Data Access Layer cho Bảng policies (Chính sách & Cấu hình động hệ thống)
 * Tuân thủ Clean Architecture, trừu tượng hóa toàn bộ tương tác Supabase.
 */
import { supabase } from '../lib/supabase';
import { Policy } from '../context/types';
import { withRetry } from '../utils/networkHelper';

export const sanitizePolicyForDb = (p: Partial<Policy>): Record<string, any> => {
  return {
    parameter_type: p.parameter_type,
    name: p.name,
    value: p.value,
    effective_date: p.effective_date,
    notes: p.notes ?? p.description ?? '',
    description: p.description ?? p.notes ?? '',
    is_active: p.is_active ?? true,
    created_by: p.created_by ?? 'system'
  };
};

export const policyService = {
  /**
   * Lấy danh sách toàn bộ chính sách hệ thống sắp xếp theo ngày hiệu lực
   */
  async fetchPolicies(): Promise<{ data: Policy[]; error: Error | null }> {
    try {
      return await withRetry(async () => {
        const { data, error } = await supabase
          .from('policies')
          .select('*')
          .order('effective_date', { ascending: false });

        if (error) throw error;
        return { data: (data || []) as Policy[], error: null };
      });
    } catch (err: any) {
      console.warn('[PolicyService] Lỗi fetchPolicies:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Thêm mới một chính sách
   */
  async addPolicy(newPolicy: Partial<Policy> & { parameter_type: string }): Promise<{ data: Policy | null; error: Error | null }> {
    try {
      const payload = sanitizePolicyForDb(newPolicy);
      const { data, error } = await supabase
        .from('policies')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;
      return { data: data as Policy, error: null };
    } catch (err: any) {
      console.error('[PolicyService] Lỗi addPolicy:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Cập nhật chính sách theo ID
   */
  async updatePolicy(id: number | string | undefined, updatedFields: Partial<Policy>): Promise<{ success: boolean; error: Error | null }> {
    if (!id) return { success: false, error: new Error('Missing policy ID') };
    const numId = Number(id);
    if (isNaN(numId)) return { success: false, error: new Error('Invalid policy ID') };
    try {
      const payload = sanitizePolicyForDb(updatedFields);
      delete payload.id;
      const { error } = await supabase
        .from('policies')
        .update(payload)
        .eq('id', numId);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[PolicyService] Lỗi updatePolicy:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Xóa chính sách theo ID (kèm hỗ trợ tên chính sách và RPC delete_policy_safe)
   */
  async deletePolicy(id: number | string | undefined, policyName?: string): Promise<{ success: boolean; error: Error | null; count?: number }> {
    if (!id && !policyName) return { success: false, error: new Error('Thiếu ID hoặc tên chính sách cần xóa') };
    const numId = id ? Number(id) : NaN;

    try {
      // 1. Thử gọi RPC bảo mật delete_policy_safe nếu có sẵn trên CSDL
      if (!isNaN(numId)) {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('delete_policy_safe', {
            p_id: numId
          });
          if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
            if ((rpcRes as any).success === false) {
              return { success: false, error: new Error((rpcRes as any).error || (rpcRes as any).message || 'Không thể xóa chính sách') };
            }
            if ((rpcRes as any).success === true) {
              return { success: true, error: null, count: (rpcRes as any).deleted_count ?? 1 };
            }
          }
        } catch (_) {
          // Bỏ qua lỗi RPC nếu chưa tạo trên CSDL, tiếp tục xóa trực tiếp
        }
      }

      // 2. Xóa trực tiếp theo ID trong bảng public.policies
      let deletedRows: any[] = [];
      if (!isNaN(numId)) {
        const { data: delById, error: errById } = await supabase
          .from('policies')
          .delete()
          .eq('id', numId)
          .select();

        if (errById) throw errById;
        if (delById && delById.length > 0) {
          deletedRows = delById;
        }
      }

      // 3. Fallback: Nếu không tìm thấy dòng theo ID nhưng có tên chính sách, thử xóa theo name
      if (deletedRows.length === 0 && policyName) {
        const { data: delByName, error: errByName } = await supabase
          .from('policies')
          .delete()
          .eq('name', policyName)
          .select();

        if (errByName) throw errByName;
        if (delByName && delByName.length > 0) {
          deletedRows = delByName;
        }
      }

      return { success: true, error: null, count: deletedRows.length };
    } catch (err: any) {
      console.error('[PolicyService] Lỗi deletePolicy:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Kích hoạt chính sách (hủy kích hoạt các bản ghi cùng parameter_type và kích hoạt bản ghi chọn)
   */
  async activatePolicy(id: number | string | undefined, parameterType: string): Promise<{ success: boolean; error: Error | null }> {
    if (!id) return { success: false, error: new Error('Missing policy ID') };
    const numId = Number(id);
    if (isNaN(numId)) return { success: false, error: new Error('Invalid policy ID') };
    try {
      // 1. Thử gọi RPC activate_policy_safe nếu có trong CSDL
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('activate_policy_safe', {
          p_id: numId,
          p_param_type: parameterType
        });
        if (!rpcErr && rpcRes && typeof rpcRes === 'object' && (rpcRes as any).success === true) {
          return { success: true, error: null };
        }
      } catch (_) {
        // Fallback update trực tiếp
      }

      const typesToDeactivate = 
        (parameterType === 'commission' || parameterType === 'commission_rates')
          ? ['commission', 'commission_rates']
          : (parameterType === 'nn_support_rates' || parameterType === 'bhxh_voluntary_support')
          ? ['nn_support_rates', 'bhxh_voluntary_support']
          : [parameterType];

      const { error: deactivateErr } = await supabase
        .from('policies')
        .update({ is_active: false })
        .in('parameter_type', typesToDeactivate);

      if (deactivateErr) throw deactivateErr;

      const { error: activateErr } = await supabase
        .from('policies')
        .update({ is_active: true })
        .eq('id', numId);

      if (activateErr) throw activateErr;

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[PolicyService] Lỗi activatePolicy:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Đồng bộ chính sách mặc định vào CSDL
   */
  async syncDefaultPolicies(defaultPolicies: Policy[]): Promise<{ success: boolean; error: Error | null }> {
    try {
      // 1. Thử gọi RPC sync_system_policies nếu có
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('sync_system_policies', {
          p_policies: defaultPolicies.map(p => sanitizePolicyForDb(p))
        });
        if (!rpcErr && (rpcRes as any)?.success) {
          return { success: true, error: null };
        }
      } catch (_) {
        // Fallback manual upsert
      }

      // 2. Fallback upsert từng bản ghi
      for (const p of defaultPolicies) {
        const payload = sanitizePolicyForDb(p);
        let existingId: number | undefined;

        const { data: byName } = await supabase
          .from('policies')
          .select('id')
          .eq('parameter_type', p.parameter_type)
          .eq('name', p.name)
          .limit(1);

        if (byName && byName.length > 0 && byName[0]) {
          existingId = byName[0].id;
        } else {
          const { data: byDate } = await supabase
            .from('policies')
            .select('id')
            .eq('parameter_type', p.parameter_type)
            .eq('effective_date', p.effective_date)
            .limit(1);
          if (byDate && byDate.length > 0 && byDate[0]) {
            existingId = byDate[0].id;
          }
        }

        if (existingId) {
          const { error: upErr } = await supabase
            .from('policies')
            .update({
              name: payload.name,
              value: payload.value,
              effective_date: payload.effective_date,
              notes: payload.notes,
              description: payload.notes,
              is_active: payload.is_active
            })
            .eq('id', existingId);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase
            .from('policies')
            .insert([payload]);
          if (insErr) throw insErr;
        }
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[PolicyService] Lỗi syncDefaultPolicies:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Upsert chính sách theo parameter_type
   */
  async upsertPolicy(parameterType: string, policyData: Partial<Policy>): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { data: existing } = await supabase
        .from('policies')
        .select('id')
        .eq('parameter_type', parameterType)
        .limit(1);

      if (existing && existing.length > 0 && existing[0]) {
        return await this.updatePolicy(existing[0].id, policyData);
      } else {
        const res = await this.addPolicy({
          parameter_type: parameterType,
          name: policyData.name || parameterType,
          value: policyData.value,
          effective_date: policyData.effective_date || '2026-01-01',
          description: policyData.description || policyData.notes || '',
          notes: policyData.notes || policyData.description || '',
          is_active: policyData.is_active ?? true,
          created_by: policyData.created_by || 'system'
        });
        return { success: !!res.data, error: res.error };
      }
    } catch (err: any) {
      return { success: false, error: err };
    }
  }
};

