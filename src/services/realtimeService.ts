/**
 * Service Layer: Quản lý Realtime Subscriptions từ Supabase
 */
import { supabase } from '../lib/supabase';

export const realtimeService = {
  /**
   * Đăng ký lắng nghe các thay đổi trên các bảng nghiệp vụ chính của schema public
   * Tránh bão refetch do bảng log (auditlogs, public_rpc_call_log)
   */
  subscribeToPublicChanges(onChange: () => void): () => void {
    const channelId = `pub_sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'policies' }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => onChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submission_batches' }, () => onChange())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
