import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:4173"
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const configuredOrigins = (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const allowedOrigins = configuredOrigins.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
  const isAllowed = allowedOrigins.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : (origin || "*"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-captcha-token, cf-turnstile-response",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const MAX_PAYLOAD_BYTES = 100 * 1024; // 100KB payload limit

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "METHOD_NOT_ALLOWED", message: "Chỉ hỗ trợ phương thức POST." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (req.headers.get("Origin") && corsHeaders["Access-Control-Allow-Origin"] === "null") {
      return new Response(JSON.stringify({ error: "ORIGIN_NOT_ALLOWED", message: "Nguồn yêu cầu không được phép." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "PAYLOAD_TOO_LARGE", message: "Kích thước dữ liệu vượt quá giới hạn cho phép (100KB)." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "INVALID_JSON", message: "Định dạng dữ liệu gửi lên không hợp lệ." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action = "submit", payload, code, type } = body || {};

    if (!["submit", "lookup", "exists", "renewal_info"].includes(action)) {
      return new Response(JSON.stringify({ error: "INVALID_ACTION", message: "Yêu cầu không hợp lệ." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Trích xuất Client IP chuẩn từ headers, chặn triệt để tình trạng fallback về 127.0.0.1
    const clientIp = (
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      ""
    ).trim();

    // 1. Thắt chặt Xác thực Cloudflare Turnstile CAPTCHA cho luồng tiếp nhận công khai
    const turnstileToken = (
      req.headers.get("cf-turnstile-response") ||
      req.headers.get("x-captcha-token") ||
      body?.["cf-turnstile-response"] ||
      body?.captchaToken ||
      body?.turnstileToken ||
      ""
    ).trim();

    // Bắt buộc kiểm tra token Cloudflare Turnstile đối với bất kỳ payload đăng ký công khai nào
    if (action === "submit") {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({
            error: "CAPTCHA_VERIFICATION_FAILED",
            message: "Vui lòng xác minh bảo mật Turnstile CAPTCHA (cf-turnstile-response)."
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const captchaSecret = Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET_KEY");
      if (captchaSecret) {
        try {
          const verifyParams = new URLSearchParams();
          verifyParams.append("secret", captchaSecret);
          verifyParams.append("response", turnstileToken);
          if (clientIp) {
            verifyParams.append("remoteip", clientIp);
          }

          const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: verifyParams.toString()
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            return new Response(
              JSON.stringify({
                error: "CAPTCHA_VERIFICATION_FAILED",
                message: "Mã xác minh CAPTCHA không hợp lệ hoặc đã hết hạn.",
                details: verifyData["error-codes"] || []
              }),
              { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch {
          return new Response(
            JSON.stringify({
              error: "CAPTCHA_VERIFICATION_FAILED",
              message: "Lỗi kết nối kiểm tra máy chủ CAPTCHA Turnstile."
            }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // 2. Initialize Supabase Client with forwarded Client IP
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "SERVER_CONFIG_ERROR", message: "Cấu hình máy chủ chưa hoàn thiện." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const effectiveClientIp = clientIp || "Public-Gateway-Intake";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          "x-forwarded-for": effectiveClientIp,
          "cf-connecting-ip": effectiveClientIp
        }
      }
    });

    // Truyền kèm Client IP chuẩn vào payload đăng ký
    const enrichedPayload = action === "submit" && payload
      ? { ...payload, ip_address: effectiveClientIp }
      : payload;

    // 3. Only this server-side function may reach the database RPCs.
    const rpcName = action === "submit" ? "public_register_customer"
      : action === "lookup" ? "public_lookup_process"
      : action === "renewal_info" ? "public_get_renewal_info"
      : "check_customer_exists";
    const rpcArgs = action === "submit" ? { p_payload: enrichedPayload }
      : (action === "lookup" || action === "renewal_info") ? { p_code: String(code || ""), p_type: String(type || "") }
      : { p_code: String(code || "") };
    const { data: rpcResult, error: rpcError } = await supabase.rpc(rpcName, rpcArgs);

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: "DATABASE_ERROR", message: rpcError.message || "Lỗi xử lý cơ sở dữ liệu." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const success = action === "submit" ? Boolean(rpcResult?.success) : true;
    return new Response(JSON.stringify(rpcResult), {
      status: success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: "Lỗi máy chủ nội bộ trong quá trình tiếp nhận hồ sơ." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
