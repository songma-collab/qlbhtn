import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser for JSON with large payload limit for base64 images/PDFs
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Initialize Google GenAI with GEMINI_API_KEY
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
    "salary": "4,500,000",
    "position": "Nhân viên văn phòng",
    "workplace": "Công ty ABC"
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

// Server-side OCR Endpoint
app.post('/api/gemini-ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Không tìm thấy dữ liệu ảnh hoặc file PDF để quét.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:(image\/\w+|application\/pdf);base64,/, '');
    const targetMime = (mimeType || 'image/jpeg').toLowerCase();

    const imagePart = {
      inlineData: {
        mimeType: targetMime,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: ocrPrompt,
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    });

    let textResult = response.text || '';
    textResult = textResult.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsedResult = [];
    try {
      parsedResult = JSON.parse(textResult);
    } catch {
      const match = textResult.match(/\[[\s\S]*\]/);
      if (match) {
        parsedResult = JSON.parse(match[0]);
      } else {
        return res.status(422).json({ error: 'PARSE_ERROR', message: 'Không thể phân tích dữ liệu JSON từ AI phản hồi.' });
      }
    }

    if (!Array.isArray(parsedResult)) {
      if (parsedResult && Array.isArray((parsedResult as any).periods)) {
        parsedResult = (parsedResult as any).periods;
      } else {
        parsedResult = [];
      }
    }

    return res.json({ periods: parsedResult });
  } catch (err: any) {
    console.error('Server Gemini OCR Error:', err);
    return res.status(500).json({
      error: 'AI_OCR_ERROR',
      message: err.message || 'Lỗi xử lý AI OCR trên máy chủ.'
    });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
