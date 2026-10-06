/**
 * Tiện ích xử lý tiền kỳ & hậu kỳ dữ liệu OCR Quá trình tham gia BHXH
 * Hỗ trợ các mẫu: Tờ rời Mẫu 07/SBH, Ứng dụng VssID, Mẫu C13-TS, Mẫu 04a, File PDF
 */

export interface PeriodItem {
  id: number;
  type: 'batbuoc' | 'nhanuoc' | 'tunguyen';
  fromMonth?: string | undefined;
  toMonth?: string | undefined;
  months?: number | undefined;
  sm: number;
  sy: number;
  em: number;
  ey: number;
  salary: string;
  workplace?: string | undefined;
  position?: string | undefined;
}

/**
 * Chuẩn hóa định dạng tiền lương / hệ số từ chuỗi OCR
 */
export const formatOcrSalary = (
  val: any,
  pType: string
): { salary: string; realType: 'batbuoc' | 'nhanuoc' | 'tunguyen' } => {
  let str = String(val || '').trim().replace(/\s/g, '');
  let clean = str.replace(/[^\d.,]/g, '');

  const totalDigits = clean.replace(/\D/g, '').length;
  const dotCount = (clean.match(/\./g) || []).length;
  const commaCount = (clean.match(/,/g) || []).length;
  const isMultiSeparator = (dotCount > 1) || (commaCount > 1) || (dotCount >= 1 && commaCount >= 1);
  const isLargeNumber = totalDigits >= 5;

  let parsedCoef = parseFloat(clean.replace(',', '.'));

  // 1. Nhận diện hệ số lương Nhà nước (từ 0.8 đến 12.0, không phải số tiền lớn có >= 5 chữ số)
  if (
    !isMultiSeparator &&
    !isLargeNumber &&
    (pType === 'nhanuoc' || (!isNaN(parsedCoef) && parsedCoef >= 0.8 && parsedCoef <= 12.0 && totalDigits <= 4))
  ) {
    let coefVal = isNaN(parsedCoef) ? 2.34 : parsedCoef;
    return {
      salary: coefVal.toFixed(2),
      realType: 'nhanuoc'
    };
  }

  // 2. BHXH Tự nguyện
  if (pType === 'tunguyen') {
    let num = parseFloat(clean.replace(/\./g, '').replace(/,/g, '.'));
    if (isNaN(num) || num <= 0) return { salary: '1.500.000', realType: 'tunguyen' };
    while (num < 100000 && num > 0) num = num * 1000;
    return { salary: num.toLocaleString('vi-VN'), realType: 'tunguyen' };
  }

  // 3. Lương Doanh nghiệp / Bắt buộc
  let num = 0;
  if (clean.includes('.') && clean.includes(',')) {
    if (clean.indexOf('.') < clean.indexOf(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      clean = clean.replace(/,/g, '');
    }
    num = parseFloat(clean);
  } else if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length > 2) {
      num = parseFloat(parts.join(''));
    } else if (parts[1] && parts[1].length === 3) {
      num = parseFloat(parts.join(''));
    } else {
      num = parseFloat(clean);
    }
  } else if (clean.includes(',')) {
    const parts = clean.split(',');
    if (parts.length > 2) {
      num = parseFloat(parts.join(''));
    } else if (parts[1] && parts[1].length === 3) {
      num = parseFloat(parts.join(''));
    } else {
      num = parseFloat(clean.replace(',', '.'));
    }
  } else {
    num = parseFloat(clean);
  }

  if (isNaN(num) || num <= 0) return { salary: '0', realType: 'batbuoc' };

  while (num < 100000 && num > 0) {
    num = num * 1000;
  }

  return { salary: num.toLocaleString('vi-VN'), realType: 'batbuoc' };
};

/**
 * Làm sạch, sửa lỗi thời gian, bổ sung năm 2 chữ số và sắp xếp trình tự thời gian
 */
export const normalizeOcrPeriods = (rawPeriods: any[]): PeriodItem[] => {
  if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
    return [];
  }

  const currentYear = new Date().getFullYear();
  let lastValidSalary = '5.000.000';
  let lastValidType: 'batbuoc' | 'nhanuoc' | 'tunguyen' = 'batbuoc';
  const extracted: PeriodItem[] = [];

  for (let idx = 0; idx < rawPeriods.length; idx++) {
    const p = rawPeriods[idx];
    if (!p) continue;

    // Làm sạch tháng & năm
    let sm = typeof p.sm === 'number' ? p.sm : parseInt(String(p.sm || '').replace(/\D/g, ''), 10) || 1;
    let sy = typeof p.sy === 'number' ? p.sy : parseInt(String(p.sy || '').replace(/\D/g, ''), 10) || currentYear;
    let em = typeof p.em === 'number' ? p.em : parseInt(String(p.em || '').replace(/\D/g, ''), 10) || 12;
    let ey = typeof p.ey === 'number' ? p.ey : parseInt(String(p.ey || '').replace(/\D/g, ''), 10) || sy;

    // Xử lý năm 2 chữ số (ví dụ: '95' -> 1995, '23' -> 2023)
    if (sy > 0 && sy < 100) {
      sy = sy >= 50 ? 1900 + sy : 2000 + sy;
    }
    if (ey > 0 && ey < 100) {
      ey = ey >= 50 ? 1900 + ey : 2000 + ey;
    }

    // Giới hạn tháng từ 1 đến 12
    if (sm < 1) sm = 1;
    if (sm > 12) sm = 12;
    if (em < 1) em = 1;
    if (em > 12) em = 12;

    // Giới hạn năm hợp lý (1960 - 2035)
    if (sy < 1960) sy = 1960;
    if (sy > 2035) sy = currentYear;
    if (ey < 1960) ey = 1960;
    if (ey > 2035) ey = currentYear;

    // Tự động đảo lại nếu thời gian bắt đầu > kết thúc
    if (sy > ey || (sy === ey && sm > em)) {
      const tempM = sm; const tempY = sy;
      sm = em; sy = ey;
      em = tempM; ey = tempY;
    }

    const rawType = (p.type === 'nhanuoc' || p.type === 'tunguyen') ? p.type : 'batbuoc';
    const { salary: formattedSal, realType } = formatOcrSalary(p.salary, rawType);

    let finalSal = formattedSal;
    let finalType = realType;

    // Kế thừa lương tháng trước nếu dòng bị khuyết (ví dụ thai sản hoặc truy đóng)
    if (formattedSal === '0' || !p.salary || String(p.salary).trim() === '0') {
      finalSal = lastValidSalary;
      finalType = lastValidType;
    } else {
      lastValidSalary = finalSal;
      lastValidType = finalType;
    }

    extracted.push({
      id: Date.now() + idx + Math.random(),
      type: finalType,
      sm,
      sy,
      em,
      ey,
      salary: finalSal,
      workplace: p.workplace,
      position: p.position
    });
  }

  // Sắp xếp tăng dần theo thời gian (Từ quá khứ đến hiện tại)
  extracted.sort((a, b) => {
    const timeA = a.sy * 12 + a.sm;
    const timeB = b.sy * 12 + b.sm;
    return timeA - timeB;
  });

  return extracted;
};

/**
 * Nén ảnh thông minh bảo toàn độ nét cho OCR tờ rời & VssID
 */
export const compressImageForOcr = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const fileSizeBytes = file.size || 0;
        let width = img.width;
        let height = img.height;

        // Nếu ảnh dung lượng nhẹ (<= 2MB) và kích thước chuẩn (cạnh lớn <= 3000px):
        // Giữ nguyên file gốc để bảo toàn độ nét từng con số
        if (fileSizeBytes <= 2 * 1024 * 1024 && width <= 3000 && height <= 3000) {
          resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
          return;
        }

        const MAX_DIM = 3200;
        const isLongScroll = height / width > 2.0;

        if (isLongScroll) {
          // Đối với ảnh cuộn dài (VssID screenshot), giữ chiều rộng tối thiểu 1100px
          if (width > 1200) {
            const ratio = 1200 / width;
            width = 1200;
            height = Math.round(height * ratio);
          }
          if (height > 6000) {
            const ratio = 6000 / height;
            height = 6000;
            width = Math.max(900, Math.round(width * ratio));
          }
        } else if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
          return;
        }

        // Đảm bảo nền trắng khi convert ảnh trong suốt (PNG) sang JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.90);
        resolve({ base64: compressedBase64, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
      };
      img.src = src;
    };
    reader.onerror = () => resolve({ base64: '', mimeType: file.type || 'image/jpeg' });
    reader.readAsDataURL(file);
  });
};
