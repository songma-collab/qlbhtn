# HƯỚNG DẪN TRIỂN KHAI & GO-LIVE HỆ THỐNG
## CỔNG THÔNG TIN ĐẠI LÝ THU BHXH SÔNG MÃ

Tài liệu này tổng hợp toàn bộ các bước kỹ thuật và các vị trí cần cập nhật thông tin tên miền, đường dẫn logo khi chính thức đưa website vào hoạt động thương mại / công vụ (Production Go-Live).

---

### MỤC LỤC
1. [Danh sách các vị trí cần thay thế thông tin](#1-danh-sách-các-vị-trí-cần-thay-thế-thông-tin)
2. [Cấu hình Web Server Nginx trên máy chủ VPS](#2-cấu-hình-web-server-nginx-trên-máy-chủ-vps)
3. [Kích hoạt HTTPS / SSL miễn phí bằng Certbot](#3-kích-hoạt-https--ssl-miễn-phí-bằng-certbot)
4. [Kiểm tra và xóa Cache xem trước trên Zalo / Facebook](#4-kiểm-tra-và-xóa-cache-xem-trước-trên-zalo--facebook)
5. [Quy trình cập nhật phiên bản mới (Zero Downtime)](#5-quy-trình-cập-nhật-phiên-bản-mới-zero-downtime)

---

### 1. DANH SÁCH CÁC VỊ TRÍ CẦN THAY THẾ THÔNG TIN

Khi bạn đã sở hữu tên miền chính thức (Ví dụ: `https://bhxhsongma.vn`), bạn chỉ cần tìm kiếm và thay thế chuỗi đại diện `https://your-domain.vn/` tại các tệp sau:

#### 📍 Tệp 1: `index.html` (Thẻ SEO, Canonical & Card xem trước Zalo/Facebook)
Mở tệp `index.html` tại thư mục gốc và cập nhật các dòng:

```html
<!-- Dòng 21: Canonical URL -->
<link rel="canonical" href="https://bhxhsongma.vn/" />

<!-- Dòng 27: Open Graph URL -->
<meta property="og:url" content="https://bhxhsongma.vn/" />

<!-- Dòng 30 & 31: Link ảnh đại diện khi gửi link qua Zalo/Facebook -->
<!-- Lưu ý: BẮT BUỘC dùng link tuyệt đối https://... để Zalo và Facebook bot đọc được -->
<meta property="og:image" content="https://bhxhsongma.vn/logo.png" />
<meta property="og:image:secure_url" content="https://bhxhsongma.vn/logo.png" />

<!-- Dòng 39 & 43: Thẻ xem trước trên mạng xã hội Twitter / X -->
<meta property="twitter:url" content="https://bhxhsongma.vn/" />
<meta property="twitter:image" content="https://bhxhsongma.vn/logo.png" />

<!-- Dòng 53 & 54: Dữ liệu có cấu trúc Schema.org (Google Rich Snippets) -->
"url": "https://bhxhsongma.vn",
"logo": "https://bhxhsongma.vn/logo.png"
```

> **Mẹo về Logo:** Tệp ảnh `/logo.png` mặc định nằm trong thư mục `public/logo.png`. Kích thước chuẩn nhất để hiển thị đẹp trên Zalo & Facebook là **1200 x 630 pixels** (hoặc tỷ lệ 1.91:1), định dạng PNG/JPG rõ nét.

---

#### 📍 Tệp 2: `nginx.conf.example` (Cấu hình Nginx Web Server)
Mở tệp cấu hình Nginx và thay đổi:

```nginx
# Thay đổi tên miền thực tế
server_name bhxhsongma.vn www.bhxhsongma.vn;

# Đường dẫn thư mục dist sau khi build trên VPS
root /var/www/newBHXH/dist;
```

---

#### 📍 Tệp 3: `public/manifest.json` (Cấu hình Web App / PWA)
Nếu người dùng cài đặt ứng dụng lên màn hình chính điện thoại (PWA), hãy kiểm tra:

```json
{
  "start_url": "/",
  "scope": "/",
  "name": "Đại lý thu BHXH Sông Mã",
  "short_name": "BHXH Sông Mã"
}
```

---

### 2. CẤU HÌNH WEB SERVER NGINX TRÊN MÁY CHỦ VPS

#### Bước 2.1: Đóng gói mã nguồn (Build)
Trên máy tính hoặc trên VPS, chạy lệnh:
```bash
npm run build
```
Lệnh này sẽ tạo ra thư mục `dist/` chứa toàn bộ mã nguồn tối ưu đã được nén và hash.

#### Bước 2.2: Sao chép tệp cấu hình Nginx vào hệ thống VPS
Giả sử mã nguồn nằm tại `/var/www/newBHXH`:

```bash
# 1. Sao chép file cấu hình mẫu vào Nginx
sudo cp nginx.conf.example /etc/nginx/sites-available/bhxhsongma.conf

# 2. Mở file chỉnh sửa domain và thư mục root
sudo nano /etc/nginx/sites-available/bhxhsongma.conf

# 3. Kích hoạt cấu hình (Symbolic Link)
sudo ln -sf /etc/nginx/sites-available/bhxhsongma.conf /etc/nginx/sites-enabled/

# 4. Kiểm tra cú pháp Nginx xem có lỗi không
sudo nginx -t

# 5. Nếu báo "syntax is ok", tiến hành nạp lại cấu hình:
sudo systemctl reload nginx
```

---

### 3. KÍCH HOẠT HTTPS / SSL MIỄN PHÍ BẰNG CERTBOT

Trang web liên quan đến thông tin bảo hiểm, căn cước công dân (PII) **bắt buộc phải có ổ khóa xanh HTTPS**. Bạn có thể cài chứng chỉ SSL tự động của Let's Encrypt hoàn toàn miễn phí:

```bash
# Cài đặt Certbot Nginx plugin (nếu chưa có)
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Cấp phát chứng chỉ tự động cho tên miền của bạn
sudo certbot --nginx -d bhxhsongma.vn -d www.bhxhsongma.vn
```

*Trong quá trình cài, Certbot sẽ hỏi bạn có muốn tự động chuyển hướng mọi truy cập HTTP sang HTTPS không, hãy chọn **2 (Redirect)**.*

Sau khi cài xong, Certbot sẽ tự động gia hạn chứng chỉ trước khi hết hạn. Bạn có thể kiểm tra gia hạn tự động bằng:
```bash
sudo certbot renew --dry-run
```

---

### 4. KIỂM TRA VÀ XÓA CACHE XEM TRƯỚC TRÊN ZALO / FACEBOOK

Sau khi đã Go-Live tên miền chính thức, khi bạn gửi link qua tin nhắn Zalo hoặc Facebook, các mạng xã hội này thường lưu cache hình ảnh cũ. Để Zalo & Facebook nhận diện logo và mô tả mới ngay lập tức:

1. **Facebook Debugger:**
   - Truy cập: [https://developers.facebook.com/tools/debug/](https://developers.facebook.com/tools/debug/)
   - Nhập liên kết website của bạn (VD: `https://bhxhsongma.vn/`)
   - Bấm **Thu nạp lại (Scrape Again)** 1 - 2 lần cho đến khi thấy hiển thị đúng ảnh và tiêu đề.

2. **Kiểm tra trên Zalo:**
   - Zalo thường lấy dữ liệu Open Graph tương tự Facebook. Sau khi xóa cache trên Facebook Debugger, hãy mở một cửa sổ chat riêng trên Zalo và dán link vào để xem Card hiển thị.

3. **Kiểm tra dữ liệu có cấu trúc Google (Schema.org):**
   - Truy cập: [https://search.google.com/test/rich-results](https://search.google.com/test/rich-results)
   - Nhập URL để đảm bảo Google nhận dạng dịch vụ an sinh xã hội chính xác.

---

### 5. QUY TRÌNH CẬP NHẬT PHIÊN BẢN MỚI (ZERO DOWNTIME)

Nhờ các cơ chế chúng ta đã cấu hình (Header `Cache-Control: no-cache` cho `index.html`, cấm cache `sw.js`, và logic tự động hồi phục `vite:preloadError` trong `main.tsx`), mỗi khi bạn muốn cập nhật tính năng mới mà không làm gián đoạn người dùng:

1. Kéo code mới và chạy lại lệnh build:
   ```bash
   git pull origin main
   npm run build
   ```
2. Người dùng đang mở website sẽ **tự động nạp bản cập nhật mới nhất** khi chuyển trang hoặc tải lại, hoàn toàn không bị lỗi màn hình trắng hay lỗi file JS cũ.
