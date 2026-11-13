import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { StaffType } from '../../../context/types';

interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  staff: StaffType[];
  assignStaffId: string;
  setAssignStaffId: (id: string) => void;
  onConfirm: () => void;
  isAssigning: boolean;
}

export const AssignStaffModal: React.FC<AssignStaffModalProps> = ({
  isOpen,
  onClose,
  selectedCount,
  staff,
  assignStaffId,
  setAssignStaffId,
  onConfirm,
  isAssigning
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[1000] animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200">
        <h3 className="text-base font-bold text-slate-900 mb-2">
          Phân Công Nhân Viên Phụ Trách ({selectedCount} khách hàng)
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Chọn nhân viên phụ trách chăm sóc, đôn đốc gia hạn cho các khách hàng được chọn:
        </p>
        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nhân viên phụ trách:
          </label>
          <select
            value={assignStaffId}
            onChange={e => setAssignStaffId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#004182] bg-white cursor-pointer"
          >
            <option value="">-- Thu hồi phân công (Chưa giao ai) --</option>
            {staff.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name} ({s.phone || 'Không có SĐT'})</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isAssigning}
            className="px-4 py-2 bg-[#004182] hover:bg-[#003166] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isAssigning ? 'Đang lưu...' : 'Xác nhận phân công'}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};
