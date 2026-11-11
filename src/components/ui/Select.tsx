import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helperText,
  isRequired = false,
  options,
  children,
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {isRequired && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
          className={`w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border text-xs sm:text-sm rounded-xl py-2 pl-3.5 pr-9 appearance-none transition-all duration-150 cursor-pointer disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-600 disabled:cursor-not-allowed ${
            error
              ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/30'
              : 'border-slate-300 dark:border-slate-700 focus:border-[#004182] dark:focus:border-sky-400 focus:ring-2 focus:ring-[#004182]/20 dark:focus:ring-sky-400/20'
          } ${className}`}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={String(opt.value)} value={opt.value} disabled={opt.disabled} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <span className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none flex items-center justify-center">
          <ChevronDown size={15} />
        </span>
      </div>

      {error ? (
        <p id={`${selectId}-error`} className="text-[11px] font-medium text-rose-600 dark:text-rose-400 animate-tab-fade">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="text-[11px] text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

Select.displayName = 'Select';
