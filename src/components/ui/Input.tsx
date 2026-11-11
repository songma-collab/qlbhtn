import React from 'react';
import { X } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isRequired?: boolean;
  onClear?: () => void;
  tabularNums?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  isRequired = false,
  onClear,
  tabularNums = false,
  className = '',
  id,
  value,
  disabled,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {isRequired && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border text-xs sm:text-sm rounded-xl py-2 transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-600 disabled:cursor-not-allowed ${
            leftIcon ? 'pl-9' : 'pl-3.5'
          } ${rightIcon || (onClear && value) ? 'pr-9' : 'pr-3.5'} ${
            tabularNums ? 'font-mono tabular-nums' : ''
          } ${
            error
              ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/30'
              : 'border-slate-300 dark:border-slate-700 focus:border-[#004182] dark:focus:border-sky-400 focus:ring-2 focus:ring-[#004182]/20 dark:focus:ring-sky-400/20'
          } ${className}`}
          {...props}
        />

        {onClear && value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
            title="Xóa nhanh nội dung"
          >
            <X size={14} />
          </button>
        )}

        {rightIcon && !(onClear && value) && (
          <span className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
            {rightIcon}
          </span>
        )}
      </div>

      {error ? (
        <p id={`${inputId}-error`} className="text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-tab-fade">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-[11px] text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Input.displayName = 'Input';
