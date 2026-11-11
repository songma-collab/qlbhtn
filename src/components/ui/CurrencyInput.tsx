import React from 'react';
import { formatMoney } from '../../utils/helpers';

export interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  isRequired?: boolean;
  numericValue?: number;
  onValueChange?: (val: number) => void;
  currencySuffix?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(({
  label,
  error,
  helperText,
  isRequired = false,
  numericValue,
  onValueChange,
  currencySuffix = 'đ',
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const [displayValue, setDisplayValue] = React.useState<string>(() => {
    if (numericValue !== undefined && numericValue !== null && !isNaN(numericValue)) {
      return numericValue.toLocaleString('vi-VN');
    }
    return '';
  });

  React.useEffect(() => {
    if (numericValue !== undefined && numericValue !== null && !isNaN(numericValue)) {
      const formatted = numericValue.toLocaleString('vi-VN');
      if (formatted !== displayValue.replace(/\D/g, '').replace(/^0+/, '')) {
        setDisplayValue(formatted);
      }
    } else if (numericValue === 0) {
      setDisplayValue('0');
    }
  }, [numericValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    const num = rawDigits ? parseInt(rawDigits, 10) : 0;
    setDisplayValue(num > 0 ? num.toLocaleString('vi-VN') : (rawDigits === '0' ? '0' : ''));
    if (onValueChange) {
      onValueChange(num);
    }
  };

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {isRequired && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={displayValue}
          onChange={handleInputChange}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={`w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border text-xs sm:text-sm rounded-xl py-2 pl-3.5 pr-10 font-mono tabular-nums font-semibold transition-all duration-150 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-500 dark:disabled:text-slate-600 ${
            error
              ? 'border-rose-400 dark:border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900/30'
              : 'border-slate-300 dark:border-slate-700 focus:border-[#004182] dark:focus:border-sky-400 focus:ring-2 focus:ring-[#004182]/20 dark:focus:ring-sky-400/20'
          } ${className}`}
          {...props}
        />
        <span className="absolute right-3 text-xs font-bold text-slate-600 dark:text-slate-400 pointer-events-none select-none">
          {currencySuffix}
        </span>
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

CurrencyInput.displayName = 'CurrencyInput';
