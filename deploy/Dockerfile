# ==============================================================================
# MULTI-STAGE DOCKERFILE CHO HỆ THỐNG QUẢN LÝ THU BHXH / BHYT SÔNG MÃ (QLBHTN)
# ==============================================================================

# ------------------------------------------------------------------------------
# GIAI ĐOẠN 1: BUILD MÃ NGUỒN VITE + TYPESCRIPT (BUILDER)
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Cài đặt pnpm toàn cục để tận dụng lockfile pnpm-lock.yaml
RUN corepack enable && corepack prepare pnpm@latest --activate

# Sao chép manifest và lockfile để tận dụng Docker layer cache
COPY package.json pnpm-lock.yaml ./

# Cài đặt toàn bộ dependencies (bao gồm devDependencies cho build)
RUN pnpm install --frozen-lockfile

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Khai báo các tham số môi trường Build-time (Vite yêu cầu lúc đóng gói)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_TURNSTILE_SITE_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

# Biên dịch ứng dụng SPA sang thư mục /app/dist
RUN pnpm run build

# ------------------------------------------------------------------------------
# GIAI ĐOẠN 2: PRODUCTION RUNTIME (NGINX ALPINE SIÊU NHẸ & AN TOÀN)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Xóa cấu hình mặc định của Nginx
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Sao chép kết quả build từ giai đoạn 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Sao chép cấu hình Nginx tối ưu hóa bảo mật và SPA fallback
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Cấu hình Healthcheck kiểm tra định kỳ tình trạng sống của container
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
