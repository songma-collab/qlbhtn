import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-[#004182] hover:bg-[#003166] text-white shadow-2xs border border-transparent',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 shadow-2xs',
  ghost: 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-transparent',
  danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80',
  success: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80',
  warning: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80',
};

const sizeStyles: Record<NonNullable<ButtonProps['size']>, string> = {
  xs: 'px-2 py-1 text-[11px] rounded-lg gap-1',
  sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-3.5 py-2 text-xs sm:text-sm rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm sm:text-base rounded-xl font-bold gap-2.5',
  icon: 'p-2 rounded-xl',
  'icon-sm': 'p-1.5 rounded-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...props
}, ref) => {
  const isIconButton = size === 'icon' || size === 'icon-sm';

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004182]/50 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={16} className="animate-spin text-current" />
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          {children && <span>{children}</span>}
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
