import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

const MAX_BASE64_LENGTH = 20 * 1024 * 1024; // Max ~15MB file size

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", message: "Only POST method is allowed." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Server-side JWT Authorization Check (Chỉ cho phép tài khoản Cán bộ / Nhân sự đã đăng nhập)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ 
          error: "UNAUTHORIZED", 
          message: "Tính năng Quét Sổ AI chỉ dành cho Cán bộ / Đại lý đã đăng nhập hệ thống. Vui lòng đăng nhập tài khoản để sử dụng." 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "SERVER_CONFIG_ERROR", message: "Cấu hình Supabase trên Server chưa hoàn thiện." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify token identity using Supabase Auth
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          error: "UNAUTHORIZED", 
          message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại." 
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Database Staff Identity & Active Status Verification
    const { data: staffData } = await supabaseClient
      .from("staff")
      .select("role, status")
      .eq("email", user.email)
      .maybeSingle();

    if (!staffData || staffData.status === "Tạm khóa") {
      return new Response(
        JSON.stringify({ 
          error: "FORBIDDEN", 
          message: "Tài khoản của bạn đang bị Tạm khóa hoặc không có trong danh bạ cán bộ được cấp quyền." 
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Read Server Secret
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          error: "AI_SERVICE_UNAVAILABLE", 
          message: "Khóa bảo mật GEMINI_API_KEY chưa được cấu hình trong Supabase Secrets." 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Payload Shape & Size Validation
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_JSON", message: "Định dạng gói tin JSON gửi lên không hợp lệ." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, mimeType } = body || {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "INVALID_INPUT", message: "Không tìm thấy dữ liệu ảnh hoặc file PDF để quét." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "Dung lượng tệp vượt quá giới hạn tối đa 15MB." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetMime = (mimeType || "image/jpeg").toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(targetMime)) {
      return new Response(
        JSON.stringify({ error: "UNSUPPORTED_TYPE", message: "Định dạng tệp không được hỗ trợ (chỉ nhận JPG, PNG, WEBP, PDF)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ocrPrompt = `Bạn là một chuyên gia OCR cao cấp của Bảo hiểm Xã hội Việt Nam, chuyên đọc và bóc tách dữ liệu lịch sử tham gia BHXH từ:
1. Tờ rời Sổ BHXH (Mẫu 07/SBH hoặc các mẫu tờ rời qua các thời kỳ)
2. Ảnh chụp màn hình ứng dụng VssID (mục Quá trình tham gia BHXH)
3. Bản in/PDF thông báo đóng BHXH (Mẫu C13-TS, Mẫu 04a, Sổ BHXH bìa xanh cũ)

Nhiệm vụ của bạn:
Trích xuất chính xác, đầy đủ và trung thực TẤT CẢ các giai đoạn tham gia BHXH có trong ảnh/tài liệu.

YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
Trả về KẾT QUẢ DUY NHẤT LÀ MỘT MẢNG JSON hợp lệ chứa các object theo cấu trúc:
[
  {
    "type": "batbuoc" | "nhanuoc" | "tunguyen",
    "sm": 1,
    "sy": 2015,
    "em": 12,
    "ey": 2018,
    "salary": "4,500,000"
  }
]

QUY TẮC BÓC TÁCH NGHIỆP VỤ BHXH BẮT BUỘC TUÂN THỦ:
1. XÁC ĐỊNH MỐC THỜI GIAN (sm, sy, em, ey):
   - sm: Tháng bắt đầu (số nguyên 1 đến 12).
   - sy: Năm bắt đầu (số nguyên 4 chữ số, ví dụ 2015).
   - em: Tháng kết thúc (số nguyên 1 đến 12).
   - ey: Năm kết thúc (số nguyên 4 chữ số, ví dụ 2018).
   - Nếu tài liệu ghi dạng "01/2018 - 12/2019" hoặc "01/18 - 12/19": sm=1, sy=2018, em=12, ey=2019.
   - Nếu năm chỉ ghi 2 chữ số (ví dụ: "98" -> 1998, "05" -> 2005, "24" -> 2024).
   - Nếu mốc kết thúc ghi "Đến nay" hoặc "Hiện tại" (trên màn hình VssID): Lấy tháng và năm của thời điểm chụp tài liệu hoặc tháng/năm hiện tại (tháng 9/2026).
   - Tuyệt đối không để em < 1 hoặc em > 12; không để sm < 1 hoặc sm > 12.

2. PHÂN LOẠI LOẠI HÌNH & ĐƠN VỊ LƯƠNG/HỆ SỐ (type & salary):
   A. HỆ SỐ LƯƠNG NHÀ NƯỚC (type: "nhanuoc"):
      - Khi làm việc tại cơ quan nhà nước, đơn vị sự nghiệp, trường học, bệnh viện, lực lượng vũ trang (quân đội, công an), UBND, cơ quan Đảng/Đoàn thể...
      - HOẶC khi mức lương/tiền lương ghi các số thập phân hệ số công chức từ 1.0 đến 12.0 (ví dụ: 1.5, 1.68, 1.86, 2.04, 2.22, 2.34, 2.67, 3.00, 3.33, 3.66, 3.99, 4.20, 4.50, 4.89...).
      - ĐẶT type là "nhanuoc", salary trả về chính xác chuỗi hệ số (ví dụ: "2.34", "3.00", "1.86"). TUYỆT ĐỐI KHÔNG tự ý nhân với lương cơ sở!
   B. LƯƠNG TIỀN ĐỒNG DOANH NGHIỆP (type: "batbuoc"):
      - Khi làm việc tại công ty cổ phần, TNHH, doanh nghiệp tư nhân, doanh nghiệp FDI theo mức lương tiền đồng cụ thể.
      - ĐẶT type là "batbuoc", salary là số tiền đầy đủ (ví dụ: "4,500,000", "7,200,000", "12,000,000").
   C. BHXH TỰ NGUYỆN (type: "tunguyen"):
      - Khi có ghi rõ "BHXH tự nguyện" hoặc "Đại lý thu".
      - ĐẶT type là "tunguyen", salary là mức thu nhập chọn đóng (ví dụ: "1,500,000", "3,000,000", "5,000,000").

3. CÁC TRƯỜNG HỢP ĐẶC BIỆT CẦN XỬ LÝ:
   - "Nghỉ thai sản" (ký hiệu TS): Vẫn được tính là thời gian đóng BHXH. Mức lương lấy bằng mức lương/hệ số của tháng đóng liền kề trước khi nghỉ thai sản.
   - Dòng "Tổng cộng", "Tổng thời gian tham gia...", "Cộng thời gian...": Đây là dòng tổng hợp số năm tháng, KHÔNG PHẢI một giai đoạn đóng. BẮT BUỘC BỎ QUA dòng này!
   - Dòng ghi rõ "Không tham gia BHXH", "Nghỉ việc không hưởng lương", "Nghỉ ốm đau", "Chỉ đóng BHTN": BỎ QUA, không trích xuất.

4. THỨ TỰ TRÌNH BÀY:
   - Sắp xếp các giai đoạn theo thứ tự thời gian tăng dần từ quá khứ đến hiện tại (sy, sm tăng dần).
   - Không được bỏ sót bất kỳ giai đoạn đóng hợp lệ nào trong ảnh.
5. Chỉ trả về mảng JSON thuần túy (không kèm Markdown block \`\`\`json, không có lời mở đầu hay kết luận).`;

    const cleanBase64 = imageBase64.replace(/^data:(image\/\w+|application\/pdf);base64,/, '');

    // Model Cascade: Thử lần lượt các phiên bản Flash mới nhất (ưu tiên Gemini 3.7 Flash) để đảm bảo luôn phản hồi siêu tốc & chính xác
    const candidateModels = [
      Deno.env.get("GEMINI_MODEL") || "gemini-3.7-flash",
      "gemini-3.7-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash"
    ].filter((v, i, a) => a.indexOf(v) === i);

    let response: Response | null = null;
    let usedModel = "";

    for (const modelName of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: ocrPrompt },
                  { inlineData: { data: cleanBase64, mimeType: targetMime } }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              topP: 0.95,
              responseMimeType: "application/json"
            }
          })
        });

        if (res.ok) {
          response = res;
          usedModel = modelName;
          break;
        } else {
          console.warn(`Model ${modelName} returned status ${res.status}, trying fallback model...`);
        }
      } catch (callErr) {
        console.warn(`Model ${modelName} fetch failed, trying fallback...`, callErr);
      }
    }

    if (!response || !response.ok) {
      return new Response(
        JSON.stringify({ error: "AI_SERVICE_UNAVAILABLE", message: "Tất cả các model Gemini Flash tạm thời bận hoặc không phản hồi. Vui lòng thử lại sau giây lát." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const geminiData = await response.json();
    let textResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    textResult = textResult.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsedResult = [];
    try {
      parsedResult = JSON.parse(textResult);
    } catch {
      const match = textResult.match(/\[[\s\S]*\]/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        return new Response(
          JSON.stringify({ error: "PARSE_ERROR", message: "Could not parse JSON array from OCR response." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(JSON.stringify({ periods: parsedResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "AI_SERVICE_UNAVAILABLE", message: "Internal server processing error." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
