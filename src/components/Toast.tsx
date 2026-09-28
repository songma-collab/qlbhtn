import React from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../context/AppContext';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const Toast: React.FC = () => {
  const { toastConfig, toastMessage, hideToast } = useAppContext() as any;

  const currentMessage = toastConfig?.message || toastMessage;
  if (!currentMessage) return null;

  const currentType = toastConfig?.type || 'success';

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'error':
        return {
          bg: 'bg-rose-600 border-rose-500 shadow-rose-900/30',
          icon: <XCircle size={18} className="text-white shrink-0" />
        };
      case 'warning':
        return {
          bg: 'bg-amber-600 border-amber-500 shadow-amber-900/30',
          icon: <AlertTriangle size={18} className="text-white shrink-0" />
        };
      case 'info':
        return {
          bg: 'bg-[#004182] border-blue-500 shadow-blue-950/30',
          icon: <Info size={18} className="text-blue-200 shrink-0" />
        };
      case 'success':
      default:
        return {
          bg: 'bg-emerald-600 border-emerald-500 shadow-emerald-950/30',
          icon: <CheckCircle2 size={18} className="text-white shrink-0" />
        };
    }
  };

  const { bg, icon } = getTypeStyles(currentType);

  return createPortal(
    <div 
      className="fixed bottom-5 right-5 z-[9999] max-w-sm sm:max-w-md w-full pointer-events-none px-4"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto transform transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-3">
        <div
          className={`${bg} text-white px-4 py-3 rounded-xl shadow-lg font-medium flex items-center gap-3 border backdrop-blur-md`}
        >
          <div>{icon}</div>

          <div className="flex-1 min-w-0 text-sm font-medium leading-snug">
            {currentMessage}
          </div>

          <button
            type="button"
            onClick={() => hideToast && hideToast()}
            className="text-white/70 hover:text-white transition p-1 shrink-0 cursor-pointer rounded-lg hover:bg-white/20 active:scale-95"
            title="Đóng thông báo"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Toast;
