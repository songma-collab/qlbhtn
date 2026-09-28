import React from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import { X, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';

const AlertModal: React.FC = () => {
  const { alertModalConfig, closeAlert } = useAppContext();

  if (!alertModalConfig || !alertModalConfig.isOpen) return null;

  const type = alertModalConfig.type || 'info';

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          iconBg: 'bg-emerald-100 text-emerald-600',
          icon: <CheckCircle2 size={36} />,
          btnColor: 'bg-emerald-600 hover:bg-emerald-700',
          titleColor: 'text-emerald-800'
        };
      case 'error':
        return {
          iconBg: 'bg-rose-100 text-rose-600',
          icon: <XCircle size={36} />,
          btnColor: 'bg-rose-600 hover:bg-rose-700',
          titleColor: 'text-rose-800'
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-100 text-amber-600',
          icon: <AlertTriangle size={36} />,
          btnColor: 'bg-amber-600 hover:bg-amber-700',
          titleColor: 'text-amber-800'
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-blue-100 text-[#004182]',
          icon: <Info size={36} />,
          btnColor: 'bg-[#004182] hover:bg-blue-800',
          titleColor: 'text-[#004182]'
        };
    }
  };

  const { iconBg, icon, btnColor, titleColor } = getTypeStyles();

  const handleConfirm = () => {
    if (typeof alertModalConfig.onConfirm === 'function') {
      try {
        alertModalConfig.onConfirm();
      } catch (e) {
        console.error('Error in alert onConfirm handler:', e);
      }
    }
    closeAlert();
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-[#004182]/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 transition-opacity duration-300 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAlert();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-transform duration-300 border border-slate-100">
        <div className="p-6 text-center relative">
          <button 
            type="button" 
            onClick={closeAlert} 
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition"
            title="Đóng"
          >
            <X size={20} />
          </button>
          
          <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm ${iconBg}`}>
            {icon}
          </div>

          <h3 className={`text-lg sm:text-xl font-bold mb-2 ${titleColor}`}>
            {alertModalConfig.title}
          </h3>
          
          <p className="text-gray-600 text-xs sm:text-sm mb-6 leading-relaxed whitespace-pre-line font-medium">
            {alertModalConfig.message}
          </p>
          
          <button 
            type="button" 
            onClick={handleConfirm} 
            className={`w-full px-5 py-2.5 rounded-xl font-bold text-white shadow-md transition transform active:scale-95 cursor-pointer ${btnColor}`}
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AlertModal;
