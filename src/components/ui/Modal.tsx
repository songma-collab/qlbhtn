import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  asBottomSheetOnMobile?: boolean;
  className?: string;
  showCloseButton?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
  full: 'sm:max-w-4xl',
};

/**
 * Linh kiện Modal chuẩn hóa hỗ trợ tự động thích ứng Bottom Sheet trên thiết bị di động
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  asBottomSheetOnMobile = true,
  className = '',
  showCloseButton = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Khóa cuộn trang nền khi mở Modal
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex ${
        asBottomSheetOnMobile ? 'items-end sm:items-center' : 'items-center'
      } justify-center p-0 sm:p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs transition-opacity duration-200 animate-fadeIn`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={modalRef}
        className={`w-full ${sizeClasses[size]} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
          asBottomSheetOnMobile
            ? 'rounded-t-3xl sm:rounded-2xl max-h-[92vh] sm:max-h-[85vh] animate-bottom-sheet sm:animate-none'
            : 'rounded-2xl max-h-[85vh]'
        } shadow-2xl border border-slate-200/90 dark:border-slate-700/80 flex flex-col overflow-hidden transition-all ${className}`}
      >
        {/* Mobile Pull Handle */}
        {asBottomSheetOnMobile && (
          <div className="w-full flex items-center justify-center pt-2.5 pb-1 sm:hidden">
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer shrink-0"
                title="Đóng hộp thoại"
                aria-label="Đóng hộp thoại"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
