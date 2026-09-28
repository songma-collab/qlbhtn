import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  message, 
  title = "Xác nhận xóa?", 
  confirmText = "Xóa ngay",
  cancelText = "Hủy",
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'warning':
        return {
          iconBg: 'bg-amber-100 text-amber-600',
          icon: <AlertTriangle size={32} />,
          btnColor: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-300'
        };
      case 'info':
      case 'primary':
        return {
          iconBg: 'bg-blue-100 text-[#004182]',
          icon: <RotateCcw size={32} />,
          btnColor: 'bg-[#004182] hover:bg-blue-800 focus:ring-blue-300'
        };
      case 'danger':
      default:
        return {
          iconBg: 'bg-red-100 text-red-500',
          icon: <AlertTriangle size={32} />,
          btnColor: 'bg-red-500 hover:bg-red-600 focus:ring-red-300'
        };
    }
  };

  const { iconBg, icon, btnColor } = getVariantStyles();

  return (
    <div className="fixed inset-0 bg-[#004182]/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all duration-300 border border-slate-100 p-6 text-center">
        <div className={`w-16 h-16 rounded-2xl ${iconBg} mx-auto flex items-center justify-center mb-4 shadow-inner`}>
          {icon}
        </div>
        <h3 className="text-lg sm:text-xl font-black text-[#004182] mb-2">{title}</h3>
        <p className="text-gray-600 text-xs sm:text-sm font-medium leading-relaxed mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <button 
            type="button" 
            onClick={onClose} 
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-gray-700 font-bold bg-slate-100 hover:bg-slate-200 transition-all flex-1 order-2 sm:order-1 text-xs sm:text-sm cursor-pointer border-none"
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-white font-bold ${btnColor} shadow-lg transition-all flex-1 order-1 sm:order-2 text-xs sm:text-sm cursor-pointer border-none`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
