import { z } from 'zod';
import { optionalVnDobSchema } from './dateFormatter';

export * from './dateFormatter';

/**
 * Xóa bỏ toàn bộ ký tự rác, khoảng trắng thừa, zero-width space (\u200B, \uFEFF), ký tự điều khiển
 */
export const cleanRawInput = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .replace(/[\r\n\t]/g, '')             // Line breaks & tabs
    .trim();
};

/**
 * Chỉ giữ lại các chữ số (0-9)
 */
export const cleanNumericInput = (val: unknown): string => {
  return cleanRawInput(val).replace(/\D/g, '');
};

/**
 * Schema CCCD / Số ĐDCN: Đúng 12 chữ số
 */
export const cccdSchema = z
  .string()
  .transform(cleanNumericInput)
  .refine(val => val.length === 12, {
    message: 'Số CCCD / ĐDCN phải bao gồm đúng 12 chữ số'
  })
  .refine(val => /^[0-9]{12}$/.test(val), {
    message: 'Số CCCD / ĐDCN chỉ được chứa các chữ số từ 0 đến 9'
  });

/**
 * Schema Mã số BHXH: Đúng 10 chữ số
 */
export const bhxhSchema = z
  .string()
  .transform(cleanNumericInput)
  .refine(val => val.length === 10, {
    message: 'Mã số BHXH phải bao gồm đúng 10 chữ số'
  })
  .refine(val => /^[0-9]{10}$/.test(val), {
    message: 'Mã số BHXH chỉ được chứa các chữ số từ 0 đến 9'
  });

/**
 * Schema Mã số BHXH cũ (nếu có, thường là 10 số)
 */
export const oldBhxhSchema = z
  .string()
  .transform(cleanNumericInput)
  .optional()
  .refine(val => !val || val.length === 10, {
    message: 'Mã số BHXH cũ (nếu có) phải gồm đúng 10 chữ số'
  });

/**
 * Schema Số điện thoại Việt Nam: Đúng 10 chữ số, bắt đầu bằng số 0 (03, 05, 07, 08, 09, 02)
 */
export const phoneSchema = z
  .string()
  .transform(cleanNumericInput)
  .refine(val => val.length === 10, {
    message: 'Số điện thoại phải bao gồm đúng 10 chữ số'
  })
  .refine(val => /^(03|05|07|08|09|02)[0-9]{8}$/.test(val), {
    message: 'Số điện thoại không đúng định dạng mạng di động/cố định Việt Nam'
  });

/**
 * Schema Họ và tên tiếng Việt: Tối thiểu 2 ký tự, không chứa ký tự đặc biệt lạ
 */
export const fullNameSchema = z
  .string()
  .transform(cleanRawInput)
  .refine(val => val.length >= 2, {
    message: 'Họ và tên phải có tối thiểu 2 ký tự'
  })
  .refine(val => /^[\p{L}\s'-]+$/u.test(val), {
    message: 'Họ và tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng'
  });

/**
 * Helper function: Kiểm tra hợp lệ CCCD
 */
export const validateCCCD = (val: string): { success: boolean; data?: string; error?: string } => {
  const parsed = cccdSchema.safeParse(val);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error.issues[0]?.message || 'CCCD không hợp lệ' };
};

/**
 * Helper function: Kiểm tra hợp lệ Mã BHXH
 */
export const validateBHXH = (val: string): { success: boolean; data?: string; error?: string } => {
  const parsed = bhxhSchema.safeParse(val);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error.issues[0]?.message || 'Mã BHXH không hợp lệ' };
};

/**
 * Helper function: Kiểm tra hợp lệ Số điện thoại
 */
export const validatePhone = (val: string): { success: boolean; data?: string; error?: string } => {
  const parsed = phoneSchema.safeParse(val);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, error: parsed.error.issues[0]?.message || 'Số điện thoại không hợp lệ' };
};

/**
 * Schema tổng hợp cho Form Đăng ký/Chỉnh sửa hồ sơ BHXH - BHYT
 */
export const customerRegistrationSchema = z.object({
  name: fullNameSchema,
  cccd: cccdSchema.optional().or(z.literal('')),
  bhxh: bhxhSchema.optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  dob: optionalVnDobSchema,
  gender: z.enum(['Nam', 'Nữ']).optional(),
  nation: z.string().optional(),
  email: z.string().email('Email không đúng định dạng').optional().or(z.literal('')),
  address: z.string().optional(),
  type: z.enum(['BHXH', 'BHYT']),
  income: z.number().nonnegative().optional(),
  method: z.string().optional(),
  months: z.number().int().positive().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
}).refine(data => Boolean(data.cccd || data.bhxh), {
  message: 'Cần cung cấp ít nhất Số CCCD hoặc Mã số BHXH để định danh hồ sơ',
  path: ['cccd']
});
