/**
 * Tiện ích xử lý kết nối mạng & Tự động gửi lại yêu cầu (Auto-Retry with Exponential Backoff)
 * Hỗ trợ các cán bộ thu làm việc tại các vùng sóng 4G chập chờn / yếu.
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

const isNetworkOrServerError = (error: any): boolean => {
  if (!error) return false;
  const msg = (error.message || String(error)).toLowerCase();
  
  // Các lỗi mạng chập chờn, timeout, fetch failed
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('connection') ||
    msg.includes('offline') ||
    msg.includes('failed to fetch') ||
    msg.includes('aborterror') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  ) {
    return true;
  }

  // Mã lỗi HTTP 5xx từ server
  if (error.status && error.status >= 500 && error.status <= 599) {
    return true;
  }

  return false;
};

export async function withRetry<T>(
  fn: () => PromiseLike<T> | Promise<T> | any,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 5000,
    shouldRetry = isNetworkOrServerError
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff with jitter: delay = min(maxDelay, baseDelay * 2^(attempt-1)) + jitter
      const delay = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 300
      );

      console.warn(`[Network Retry] Yêu cầu thất bại lần ${attempt}/${maxRetries}. Đang thử lại sau ${Math.round(delay)}ms...`, error?.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
