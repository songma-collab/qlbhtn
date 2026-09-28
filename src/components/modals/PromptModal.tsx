import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import { HelpCircle, X, Check } from 'lucide-react';

const PromptModal: React.FC = () => {
  const { promptModalConfig, closePrompt } = useAppContext();
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (promptModalConfig?.isOpen) {
      setInputValue(promptModalConfig.defaultValue || '');
      setIsSubmitting(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if ('select' in inputRef.current) {
            inputRef.current.select();
          }
        }
      }, 100);
    }
  }, [promptModalConfig]);

  if (!promptModalConfig || !promptModalConfig.isOpen) return null;

  const handleConfirm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await promptModalConfig.onConfirm(inputValue);
      closePrompt();
    } catch (err) {
      console.error('Lỗi khi thực hiện xác nhận prompt:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (promptModalConfig.onCancel) {
      promptModalConfig.onCancel();
    }
    closePrompt();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && !e.shiftKey && promptModalConfig.inputType !== 'textarea') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && promptModalConfig.inputType === 'textarea') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 bg-[#004182]/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all duration-300 border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#004182] to-[#005bb5] px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
              <HelpCircle size={18} className="text-amber-300" />
            </div>
            <h3 className="text-base sm:text-lg font-bold truncate">
              {promptModalConfig.title || 'Xác nhận thông tin'}
            </h3>
          </div>
          <button 
            type="button" 
            onClick={handleCancel}
            className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirm} className="p-6">
          <p className="text-gray-700 text-sm font-medium mb-4 whitespace-pre-line leading-relaxed">
            {promptModalConfig.message}
          </p>

          <div className="mb-5">
            {promptModalConfig.inputType === 'textarea' ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={promptModalConfig.placeholder || 'Nhập thông tin tại đây...'}
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 text-sm text-gray-800 outline-none transition resize-none font-medium"
              />
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={promptModalConfig.placeholder || 'Nhập thông tin...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 text-sm text-gray-800 outline-none transition font-medium"
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            >
              {promptModalConfig.cancelText || 'Hủy bỏ'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#004182] hover:bg-[#003366] shadow-md hover:shadow-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Check size={16} />
              <span>{promptModalConfig.confirmText || 'Xác nhận'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default PromptModal;
