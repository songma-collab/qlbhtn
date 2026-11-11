import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'xs' | 'sm' | 'md';
  dot?: boolean;
}

const variantStyles: Record<NonNullable<BadgeProps['variant']>, { container: string; dot: string }> = {
  default: {
    container: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  primary: {
    container: 'bg-blue-50 text-[#004182] border-blue-200/80',
    dot: 'bg-[#004182]',
  },
  success: {
    container: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  warning: {
    container: 'bg-amber-50 text-amber-800 border-amber-200/80',
    dot: 'bg-amber-500',
  },
  danger: {
    container: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dot: 'bg-rose-500',
  },
  info: {
    container: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dot: 'bg-sky-500',
  },
  purple: {
    container: 'bg-purple-50 text-purple-700 border-purple-200/80',
    dot: 'bg-purple-500',
  },
};

const sizeStyles: Record<NonNullable<BadgeProps['size']>, string> = {
  xs: 'px-1.5 py-0.5 text-[10px] rounded',
  sm: 'px-2 py-0.5 text-xs rounded-md',
  md: 'px-2.5 py-1 text-xs rounded-lg font-semibold',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'sm',
  dot = false,
  className = '',
  children,
  ...props
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold border shrink-0 select-none ${styles.container} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styles.dot}`} />}
      {children}
    </span>
  );
};
