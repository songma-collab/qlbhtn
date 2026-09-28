const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;
const MAX_COLUMNS = 30;
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function validateExcelFile(file: File): string | null {
  if (file.size === 0) return 'File Excel rỗng.';
  if (file.size > MAX_FILE_BYTES) return 'Dung lượng file Excel không được vượt quá 5MB.';
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return 'Chỉ hỗ trợ file .xlsx, .xls hoặc .csv.';
  return null;
}

export function validateImportRows(rows: unknown[]): string | null {
  if (rows.length === 0) return 'File Excel rỗng hoặc không đúng biểu mẫu.';
  if (rows.length > MAX_ROWS) return `File Excel không được vượt quá ${MAX_ROWS.toLocaleString('vi-VN')} dòng.`;
  const columnCount = rows.reduce<number>((max, row) => Math.max(max, row && typeof row === 'object' ? Object.keys(row as object).length : 0), 0);
  if (columnCount > MAX_COLUMNS) return `File Excel không được vượt quá ${MAX_COLUMNS} cột.`;
  return null;
}

export function isSafeColumnKey(key: string): boolean {
  return !DANGEROUS_KEYS.has(key.trim().toLowerCase());
}

/** Kiểm tra xem một chuỗi có nguy cơ dính Formula Injection (CWE-1236) hay không */
export function isFormulaInjection(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trimStart();
  return /^[=+\-@\t\r]/.test(trimmed);
}

/** Sanitize chuỗi văn bản trước khi đưa vào spreadsheet để ngăn chặn Formula Injection */
export function sanitizeFormulaInput(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  const trimmed = value.trimStart();
  return /^[=+\-@\t\r]/.test(trimmed) ? `'${value}` : value;
}

/** Prevent spreadsheet formula execution when exported text is opened in Excel. */
export function safeSpreadsheetText(value: unknown): unknown {
  return sanitizeFormulaInput(value);
}

/** Sanitize every text cell in a worksheet created by SheetJS before export. */
export function protectWorksheetFormulas(worksheet: Record<string, any>): void {
  Object.entries(worksheet).forEach(([address, cell]) => {
    if (!address.startsWith('!') && cell) {
      if (typeof cell.v === 'string') {
        cell.v = safeSpreadsheetText(cell.v);
      }
      if (cell.f && typeof cell.f === 'string') {
        // Nếu công thức chứa lệnh gọi hệ điều hành hoặc không phải hàm tính toán chuẩn
        if (/cmd|system|powershell|calc|exec|wscript|cscript/i.test(cell.f)) {
          delete cell.f;
        }
      }
    }
  });
}
