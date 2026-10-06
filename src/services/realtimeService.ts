/**
 * Service Layer: Quản lý Realtime Subscriptions từ Supabase
 */
import { supabase } from '../lib/supabase';

export const realtimeService = {
  /**
   * Đăng ký lắng nghe các thay đổi trên schema public
   */
  subscribeToPublicChanges(onChange: () => void): () => void {
    const channel = supabase.channel('public_db_changes_data')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        onChange();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
