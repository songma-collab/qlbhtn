import { supabase } from '../lib/supabase';

/**
 * Secure Utility for Gemini OCR Sổ BHXH / VssID / PDF scanning.
 * Calls server-side endpoint `/api/gemini-ocr` powered by @google/genai SDK.
 * The client browser NEVER holds API keys nor calls public CORS proxies.
 */
export async function callGeminiOcrClientSide(imageBase64: string, mimeType: string): Promise<any[]> {
  // 1. Primary: Call the server-side full-stack proxy route `/api/gemini-ocr`
  try {
    const response = await fetch('/api/gemini-ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageBase64, mimeType }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data?.periods)) {
        return data.periods;
      }
      if (Array.isArray(data)) {
        return data;
      }
      if (data?.error) {
        throw new Error(data.message || 'Không thể bóc tách dữ liệu từ tài liệu.');
      }
    } else {
      let serverErrMessage = '';
      try {
        const errJson = await response.json();
        serverErrMessage = errJson?.message || errJson?.error;
      } catch {
        // Ignored
      }
      if (serverErrMessage && response.status !== 404 && response.status !== 502) {
        throw new Error(serverErrMessage);
      }
    }
  } catch (apiErr: any) {
    console.warn('[Gemini OCR] Local server route error, trying edge function fallback:', apiErr.message);
    if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
      // If server returned specific business error, rethrow
      throw apiErr;
    }
  }

  // 2. Secondary Fallback: Supabase Edge Function 'gemini-ocr'
  try {
    const { data, error } = await supabase.functions.invoke('gemini-ocr', {
      body: { imageBase64, mimeType }
    });

    if (error) {
      let detailedMsg = error.message;
      try {
        if ((error as any).context && typeof (error as any).context.json === 'function') {
          const errBody = await (error as any).context.json();
          if (errBody?.message) {
            detailedMsg = errBody.message;
          }
        }
      } catch {
        // Ignored
      }
      throw new Error(detailedMsg || 'Dịch vụ AI phản hồi lỗi.');
    }

    if (data?.error) {
      throw new Error(data.message || 'Không thể bóc tách dữ liệu.');
    }

    if (Array.isArray(data?.periods)) {
      return data.periods;
    }
    if (Array.isArray(data)) {
      return data;
    }

    throw new Error('Không thể bóc tách mảng dữ liệu quá trình đóng BHXH từ tài liệu này.');
  } catch (err: any) {
    console.error("Secure AI OCR Service Error:", err);
    const msg = err?.message || '';
    if (msg && !msg.includes('Failed to send') && !msg.includes('AI_SERVICE_UNAVAILABLE') && !msg.includes('FunctionsHttpError') && !msg.includes('Failed to fetch')) {
      throw new Error(msg);
    }
    throw new Error('Dịch vụ AI Quét Tờ rời / Sổ BHXH tạm thời không khả dụng. Vui lòng kiểm tra lại ảnh chụp rõ nét hoặc liên hệ Quản trị viên.');
  }
}
