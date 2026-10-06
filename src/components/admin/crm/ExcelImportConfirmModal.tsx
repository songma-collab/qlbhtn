import React from 'react';
import { FileUp, AlertCircle } from 'lucide-react';

interface ExcelImportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  recordCount: number;
  onConfirmFull: () => void;
  onConfirmDirectoryOnly: () => void;
  isImporting: boolean;
}

export const ExcelImportConfirmModal: React.FC<ExcelImportConfirmModalProps> = ({
  isOpen,
  onClose,
  fileName,
  recordCount,
  onConfirmFull,
  onConfirmDirectoryOnly,
  isImporting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl p-6 border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#004182] flex items-center justify-center font-bold">
            <FileUp size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Tùy Chọn Nhập Dữ Liệu Excel
            </h3>
            <p className="text-xs text-slate-500">
              Tệp: <span className="font-semibold text-slate-700">{fileName}</span> ({recordCount} bản ghi hợp lệ)
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 text-xs text-amber-900 leading-relaxed">
          <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
            <AlertCircle size={15} /> Phát hiện dữ liệu giao dịch đóng tiền trong file Excel:
          </p>
          Hệ thống đã nhận diện đầy đủ: <strong>Kỳ đóng (Từ tháng - Đến tháng)</strong>, <strong>Mức thu nhập</strong>, <strong>Số tiền đóng</strong>, <strong>Hoa hồng</strong> và <strong>Nhân viên thu</strong>. Vui lòng chọn cách nhập mong muốn:
        </div>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={onConfirmFull}
            disabled={isImporting}
            className="w-full text-left p-4 rounded-2xl border-2 border-blue-200 hover:border-[#004182] bg-blue-50/50 hover:bg-blue-50 transition cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-[#004182] group-hover:underline">
                1. Đồng bộ toàn diện (Khuyên dùng)
              </span>
              <span className="text-[11px] bg-[#004182] text-white px-2 py-0.5 rounded-full font-semibold">
                Đầy đủ dữ liệu
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Nhập cả <strong>Giao dịch vào Sổ quỹ</strong> (chuẩn hóa tiền thu, kỳ đóng, hoa hồng) và <strong>Tự động cập nhật Danh bạ khách hàng</strong> với hạn đóng tiếp theo chính xác.
            </p>
          </button>

          <button
            type="button"
            onClick={onConfirmDirectoryOnly}
            disabled={isImporting}
            className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-slate-400 bg-slate-50/60 hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-800">
                2. Chỉ cập nhật Danh bạ khách hàng
              </span>
              <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                Không tạo giao dịch
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Chỉ lưu thông tin nhân khẩu (CCCD, SĐT, Địa chỉ, Ngày sinh, Hạn nộp) vào Danh bạ khách hàng. <strong>Hoàn toàn không sinh giao dịch trong Sổ quỹ tài chính</strong>.
            </p>
          </button>
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
};
