import { describe, it, expect } from 'vitest';
import { generateBatchCode, getNextBatchSequence, isValidBatchCode } from '../utils/batchSubmission';

describe('Kiểm thử Quản lý Mã Đợt Nộp Chuẩn Đợt_YYYYMMDD_XX & Tự động tăng đợt kế tiếp', () => {
  const targetDate = '2026-10-07';
  const targetDateClean = '20261007';

  it('1. Đợt đầu tiên trong ngày tự động sinh mã dạng Chuẩn Đợt_YYYYMMDD_01', () => {
    const existingBatches: string[] = [];
    const seq = getNextBatchSequence(existingBatches, targetDate);
    expect(seq).toBe(1);

    const firstBatchCode = generateBatchCode(targetDate, seq);
    expect(firstBatchCode).toBe(`Đợt_${targetDateClean}_01`);
    expect(isValidBatchCode(firstBatchCode)).toBe(true);
  });

  it('2. Đợt kế tiếp tự động tăng lên 02, 03 khi đã có các đợt trước đó', () => {
    // Đã có đợt 01
    const batchesWith01 = [`Đợt_${targetDateClean}_01`];
    const seq2 = getNextBatchSequence(batchesWith01, targetDate);
    expect(seq2).toBe(2);
    expect(generateBatchCode(targetDate, seq2)).toBe(`Đợt_${targetDateClean}_02`);

    // Đã có cả đợt 01 và 02
    const batchesWith01And02 = [`Đợt_${targetDateClean}_01`, `Đợt_${targetDateClean}_02`];
    const seq3 = getNextBatchSequence(batchesWith01And02, targetDate);
    expect(seq3).toBe(3);
    expect(generateBatchCode(targetDate, seq3)).toBe(`Đợt_${targetDateClean}_03`);
  });

  it('3. Không bị ảnh hưởng bởi các đợt nộp của các ngày khác', () => {
    const mixedBatches = [
      'Đợt_20261005_01',
      'Đợt_20261005_02',
      'Đợt_20261006_01',
      'Đợt_20261006_03',
      'BATCH_20261006_04',
      'Đợt 1', // Legacy text
      'Đợt 2'
    ];

    // Ngày 2026-10-07 chưa có đợt nào -> Phải bắt đầu từ 01
    const seq = getNextBatchSequence(mixedBatches, targetDate);
    expect(seq).toBe(1);
    expect(generateBatchCode(targetDate, seq)).toBe(`Đợt_${targetDateClean}_01`);

    // Ngày 2026-10-06 đã có max là 04 -> Ngày 2026-10-06 phải kế tiếp là 05
    const seq20261006 = getNextBatchSequence(mixedBatches, '2026-10-06');
    expect(seq20261006).toBe(5);
    expect(generateBatchCode('2026-10-06', seq20261006)).toBe('Đợt_20261006_05');
  });

  it('4. Danh sách presets gợi ý chỉ chứa mã chuẩn Đợt_YYYYMMDD_XX và loại bỏ hoàn toàn Đợt 1, Đợt 2, Đợt 3', () => {
    const existing = [`Đợt_${targetDateClean}_01`];
    const nextSeq = getNextBatchSequence(existing, targetDate); // 2

    const maxPresets = Math.max(3, nextSeq + 1); // 3
    const presets: string[] = [];
    for (let i = 1; i <= maxPresets; i++) {
      presets.push(generateBatchCode(targetDate, i));
    }

    // Các preset chuẩn: Đợt_20261007_01, Đợt_20261007_02, Đợt_20261007_03
    expect(presets).toEqual([
      `Đợt_${targetDateClean}_01`,
      `Đợt_${targetDateClean}_02`,
      `Đợt_${targetDateClean}_03`
    ]);

    // Tuyệt đối không chứa text cũ dạng 'Đợt 1', 'Đợt 2', 'Đợt 3'
    expect(presets).not.toContain('Đợt 1');
    expect(presets).not.toContain('Đợt 2');
    expect(presets).not.toContain('Đợt 3');
  });

  it('5. Tự động nhận diện cả tiền tố BATCH_ và Đợt_ không phân biệt hoa thường', () => {
    const legacyCased = [
      `đợt_${targetDateClean}_01`,
      `ĐỢT_${targetDateClean}_02`,
      `batch_${targetDateClean}_03`
    ];
    const seq = getNextBatchSequence(legacyCased, targetDate);
    expect(seq).toBe(4);
    expect(generateBatchCode(targetDate, seq)).toBe(`Đợt_${targetDateClean}_04`);
  });
});
