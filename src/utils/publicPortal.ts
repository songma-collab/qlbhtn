import { supabase } from '../lib/supabase';

export type PublicPortalAction = 'submit' | 'lookup' | 'exists' | 'renewal_info';

/**
 * SECURITY: Mọi hành động liên quan đến dữ liệu cá nhân công dân (lookup,
 * exists, renewal_info) BẮT BUỘC phải đi qua Edge Function
 * `public-customer-intake`. Đây là lớp duy nhất thực hiện xác minh CAPTCHA,
 * kiểm tra Origin, và dùng service_role key để gọi RPC ở CSDL.
 */
export async function callPublicPortal<T>(
  action: PublicPortalAction,
  params: Record<string, unknown>,
  captchaToken = ''
): Promise<T> {
  let responseData: any = null;
  let responseError: any = null;

  try {
    const { data, error } = await supabase.functions.invoke('public-customer-intake', {
      body: { action, captchaToken, ...params }
    });
    responseData = data;
    responseError = error;
  } catch (err: any) {
    responseError = err;
  }

  if (!responseError && responseData && !responseData.error) {
    return responseData as T;
  }

  if (responseData?.error) {
    throw new Error(responseData.message || 'Yêu cầu không thể xử lý. Vui lòng thử lại sau.');
  }

  // Phân tích lỗi chi tiết từ HTTP Context của Supabase Functions
  let friendlyMessage = '';
  if (responseError) {
    try {
      if (responseError.context && typeof responseError.context.json === 'function') {
        const errorJson = await responseError.context.json();
        if (errorJson?.message) {
          friendlyMessage = errorJson.message;
        }
      }
    } catch {
      // Bỏ qua lỗi parse JSON
    }

    if (!friendlyMessage) {
      if (responseError.message?.includes('non-2xx')) {
        friendlyMessage = 'Mã xác minh bảo mật đã hết hạn hoặc chưa sẵn sàng. Vui lòng thử bấm lại.';
      } else {
        friendlyMessage = responseError.message;
      }
    }
  }

  // Chỉ hành động 'submit' được phép dự phòng sang RPC trực tiếp khi Edge
  // Function tạm thời không khả dụng.
  if (action === 'submit') {
    const { data: rpcData, error: rpcError } = await supabase.rpc('public_register_customer', {
      p_payload: params.payload
    });
    if (rpcError) throw new Error(rpcError.message || 'Không thể gửi đơn đăng ký.');
    return rpcData as T;
  }

  throw new Error(
    friendlyMessage || 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau ít phút.'
  );
}
