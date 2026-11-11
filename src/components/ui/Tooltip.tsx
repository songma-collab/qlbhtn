import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info, Scale } from 'lucide-react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Tooltip linh hoạt hỗ trợ cả Hover (Desktop) và Tap/Click (Mobile Touchscreen)
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isVisible]);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800 border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <div 
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(prev => !prev);
        }}
        className="cursor-pointer"
      >
        {children}
      </div>

      {isVisible && (
        <div
          role="tooltip"
          className={`absolute z-50 px-3 py-2 text-xs font-medium text-white bg-slate-900/95 backdrop-blur-xs rounded-xl shadow-xl w-max max-w-xs text-left animate-tab-fade pointer-events-none ${positionClasses[position]}`}
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${arrowClasses[position]}`} />
        </div>
      )}
    </div>
  );
};

export interface PolicyHelpBadgeProps {
  title: string;
  lawRef?: string;
  content: string;
  className?: string;
}

/**
 * Huy hiệu giải thích căn cứ luật định theo Luật BHXH 2024 & NĐ 159/2025/NĐ-CP
 */
export const PolicyHelpBadge: React.FC<PolicyHelpBadgeProps> = ({
  title,
  lawRef = 'Luật BHXH 2024',
  content,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={popoverRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        className="p-0.5 text-blue-600 hover:text-blue-800 rounded-full hover:bg-blue-50 transition-colors cursor-pointer"
        title="Bấm để xem căn cứ pháp lý & hướng dẫn nghiệp vụ"
      >
        <HelpCircle size={14} className="stroke-[2.2]" />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700/80 p-3.5 text-left animate-tab-fade text-xs select-text"
          role="dialog"
          aria-label={title}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
              <Scale size={14} className="text-[#004182] dark:text-sky-400 shrink-0" />
              <span>{title}</span>
            </div>
            {lawRef && (
              <span className="text-[10px] font-bold text-blue-700 dark:text-sky-300 bg-blue-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-full border border-blue-200 dark:border-sky-800">
                {lawRef}
              </span>
            )}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {content}
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-bold text-[#004182] dark:text-sky-400 hover:underline cursor-pointer"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
