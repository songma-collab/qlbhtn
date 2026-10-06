/**
 * Service Layer: Data Access Layer cho Bảng staff & Phân quyền cán bộ (RBAC)
 * Tuân thủ Clean Architecture, trừu tượng hóa toàn bộ tương tác Supabase.
 */
import { supabase } from '../lib/supabase';
import { StaffType } from '../context/types';

export const staffService = {
  /**
   * Gọi RPC tra cứu thông tin cán bộ thu hiện tại
   */
  async getCurrentStaffProfile(): Promise<{ profile: StaffType | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc('get_current_staff_profile');
      if (error) throw error;
      if (data?.success && data?.profile) {
        return { profile: data.profile as StaffType, error: null };
      }
      return { profile: null, error: null };
    } catch (err: any) {
      return { profile: null, error: err };
    }
  },

  /**
   * Tra cứu nhân sự theo auth_user_id
   */
  async getStaffByAuthId(authUserId: string): Promise<StaffType | null> {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) throw error;
      return data as StaffType | null;
    } catch (err) {
      console.warn('[StaffService] getStaffByAuthId error:', err);
      return null;
    }
  },

  /**
   * Tra cứu nhân sự theo Email
   */
  async getStaffByEmail(email: string): Promise<StaffType | null> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (error) throw error;
      return data as StaffType | null;
    } catch (err) {
      console.warn('[StaffService] getStaffByEmail error:', err);
      return null;
    }
  },

  /**
   * Kiểm tra email nhân viên có tồn tại trong hệ thống hay không (cho luồng đăng ký)
   */
  async checkStaffEmailExists(email: string): Promise<{ exists: boolean; error: Error | null }> {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase
        .from('staff')
        .select('id, name')
        .ilike('email', cleanEmail);

      if (error) throw error;
      return { exists: !!(data && data.length > 0), error: null };
    } catch (err: any) {
      return { exists: false, error: err };
    }
  },

  /**
   * Liên kết auth_user_id vào hồ sơ nhân sự
   */
  async bindStaffAuthUser(staffId: string, authUserId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('staff')
        .update({ auth_user_id: authUserId })
        .eq('id', staffId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[StaffService] bindStaffAuthUser error:', err);
      return false;
    }
  },

  /**
   * Lấy toàn bộ danh sách cán bộ thu
   */
  async fetchAllStaff(): Promise<{ data: StaffType[]; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('staff')
        .select('*');

      if (error) throw error;
      return { data: (data || []) as StaffType[], error: null };
    } catch (err: any) {
      console.error('[StaffService] fetchAllStaff error:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Thêm mới cán bộ thu
   */
  async addStaff(newStaffData: StaffType): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('staff')
        .insert([newStaffData]);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[StaffService] addStaff error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Cập nhật thông tin cán bộ thu
   */
  async updateStaff(id: string, updatedFields: Partial<StaffType>): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('staff')
        .update(updatedFields)
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[StaffService] updateStaff error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Xóa cán bộ thu theo ID
   */
  async deleteStaff(id: string): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      console.error('[StaffService] deleteStaff error:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Cập nhật quyền tùy biến (custom/revoked permissions) cho từng nhân viên
   */
  async updateStaffCustomPermissions(staffId: string, granted: string[], revoked: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('staff')
        .update({
          custom_permissions: granted,
          revoked_permissions: revoked
        })
        .eq('id', staffId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.warn('[StaffService] updateStaffCustomPermissions error:', err);
      return false;
    }
  },

  /**
   * Lưu quyền RBAC qua RPC
   */
  async saveRbacPermissions(rolePermissions: any, userOverrides: any): Promise<{ success: boolean; error: Error | null }> {
    try {
      const { error } = await supabase.rpc('save_rbac_permissions', {
        p_role_permissions: rolePermissions || null,
        p_user_overrides: userOverrides || null
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err };
    }
  },

  /**
   * Đăng xuất người dùng qua auth
   */
  async signOut(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[StaffService] signOut error:', err);
    }
  }
};
