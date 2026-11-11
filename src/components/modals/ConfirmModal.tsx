import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

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
          btnVariant: 'warning' as const
        };
      case 'info':
      case 'primary':
        return {
          iconBg: 'bg-blue-100 text-[#004182]',
          icon: <RotateCcw size={32} />,
          btnVariant: 'primary' as const
        };
      case 'danger':
      default:
        return {
          iconBg: 'bg-rose-100 text-rose-500',
          icon: <AlertTriangle size={32} />,
          btnVariant: 'danger' as const
        };
    }
  };

  const { iconBg, icon, btnVariant } = getVariantStyles();

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-300 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all duration-300 border border-slate-100 dark:border-slate-700/80 p-6 text-center animate-bottom-sheet sm:animate-none">
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4 sm:hidden" />

        <div className={`w-16 h-16 rounded-2xl ${iconBg} mx-auto flex items-center justify-center mb-4 shadow-inner`}>
          {icon}
        </div>
        <h3 className="text-lg sm:text-xl font-black text-[#004182] dark:text-sky-400 mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-medium leading-relaxed mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <Button 
            variant="secondary" 
            size="md"
            onClick={onClose} 
            className="flex-1 order-2 sm:order-1"
          >
            {cancelText}
          </Button>
          <Button 
            variant={btnVariant}
            size="md"
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className="flex-1 order-1 sm:order-2 shadow-md"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
