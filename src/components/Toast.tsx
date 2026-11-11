import React from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { ToastConfig } from '../context/providers/UIContext';

const Toast: React.FC = () => {
  const { toasts, toastConfig, toastMessage, hideToast } = useAppContext() as any;

  // Hỗ trợ cả danh sách toasts xếp tầng (mới) và toast đơn lẻ (tương thích ngược)
  const activeToasts: ToastConfig[] = React.useMemo(() => {
    if (Array.isArray(toasts) && toasts.length > 0) {
      return toasts;
    }
    if (toastConfig) {
      return [toastConfig];
    }
    if (toastMessage) {
      return [{
        id: 'legacy-toast',
        message: toastMessage,
        type: 'success',
        duration: 4000
      }];
    }
    return [];
  }, [toasts, toastConfig, toastMessage]);

  if (activeToasts.length === 0 || typeof document === 'undefined') return null;

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-rose-600/95 dark:bg-rose-700/95 border-rose-500 shadow-rose-950/25',
          icon: <XCircle size={18} className="text-white shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-600/95 dark:bg-amber-700/95 border-amber-500 shadow-amber-950/25',
          icon: <AlertTriangle size={18} className="text-white shrink-0" />
        };
      case 'info':
        return {
          bg: 'bg-[#004182]/95 dark:bg-sky-700/95 border-blue-500/80 shadow-blue-950/25',
          icon: <Info size={18} className="text-blue-200 shrink-0" />
        };
      case 'success':
      default:
        return {
          bg: 'bg-emerald-600/95 dark:bg-emerald-700/95 border-emerald-500 shadow-emerald-950/25',
          icon: <CheckCircle2 size={18} className="text-white shrink-0" />
        };
    }
  };

  return createPortal(
    <div 
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:bottom-5 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-none flex flex-col gap-2.5"
      role="status"
      aria-live="polite"
    >
      {activeToasts.map((toast) => {
        const { bg, icon } = getTypeStyles(toast.type || 'success');
        return (
          <div 
            key={toast.id || toast.message}
            className="pointer-events-auto transform transition-all duration-300 ease-out animate-toast-stack hover:scale-[1.01]"
          >
            <div
              className={`${bg} text-white px-4 py-3 rounded-2xl shadow-xl font-medium flex items-center gap-3 border backdrop-blur-md`}
            >
              <div>{icon}</div>

              <div className="flex-1 min-w-0 text-left">
                {toast.title && (
                  <p className="text-xs font-bold leading-tight mb-0.5 opacity-90">
                    {toast.title}
                  </p>
                )}
                <p className="text-xs sm:text-sm font-medium leading-snug break-words">
                  {toast.message}
                </p>
              </div>

              {/* Nút Hành Động / Hoàn Tác (Undo Action) */}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    try {
                      toast.action?.onClick();
                    } catch (e) {
                      console.error('[Toast] Lỗi thực thi action:', e);
                    }
                    hideToast && hideToast(toast.id);
                  }}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/20 hover:bg-white/30 text-white transition active:scale-95 cursor-pointer whitespace-nowrap shadow-2xs border border-white/25 shrink-0"
                >
                  {toast.action.label}
                </button>
              )}

              <button
                type="button"
                onClick={() => hideToast && hideToast(toast.id)}
                className="text-white/70 hover:text-white transition p-1 shrink-0 cursor-pointer rounded-lg hover:bg-white/20 active:scale-95"
                title="Đóng thông báo"
                aria-label="Đóng thông báo"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>,
    document.body
  );
};

export default Toast;
