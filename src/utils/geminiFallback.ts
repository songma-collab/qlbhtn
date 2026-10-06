import { supabase } from '../lib/supabase';

/**
 * Tiện ích OCR Sổ BHXH / VssID / File PDF.
 * Giao tiếp DUY NHẤT với Supabase Edge Function `gemini-ocr` từ frontend để đảm bảo an ninh (JWT validation).
 * Tuyệt đối không gọi qua express route nội bộ hay lưu trữ API key tại browser client.
 */
export async function callGeminiOcrClientSide(imageBase64: string, mimeType: string): Promise<any[]> {
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
