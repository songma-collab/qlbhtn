/**
 * Service Layer: Data Access Layer cho Supabase Authentication
 * Tuân thủ Clean Architecture, trừu tượng hóa toàn bộ tương tác Supabase Auth.
 */
import { supabase } from '../lib/supabase';

export const authService = {
  /**
   * Đăng nhập người dùng bằng email và mật khẩu
   */
  async signInWithPassword(email: string, password: string) {
    return await supabase.auth.signInWithPassword({
      email,
      password
    });
  },

  /**
   * Đăng ký tài khoản người dùng
   */
  async signUp(email: string, password: string) {
    return await supabase.auth.signUp({
      email,
      password
    });
  },

  /**
   * Đăng xuất phiên làm việc hiện tại
   */
  async signOut() {
    return await supabase.auth.signOut();
  },

  /**
   * Gửi email đặt lại mật khẩu
   */
  async resetPasswordForEmail(email: string, redirectTo?: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${window.location.origin}/admin`
    });
  },

  /**
   * Cập nhật thông tin / mật khẩu người dùng
   */
  async updateUser(attributes: { password?: string; data?: any }) {
    return await supabase.auth.updateUser(attributes);
  },

  /**
   * Lấy phiên làm việc hiện tại
   */
  async getSession() {
    return await supabase.auth.getSession();
  },

  /**
   * Lấy thông tin user hiện tại
   */
  async getUser() {
    return await supabase.auth.getUser();
  },

  /**
   * Lắng nghe sự kiện thay đổi trạng thái xác thực
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
};
