import React from 'react';
import { AlertTriangle, Clock, CheckCircle2, PauseCircle, UserCheck } from 'lucide-react';
import { getLocalYYYYMMDD } from '../../utils/helpers';

export interface CustomerStatusBadgeProps {
  customerStatus?: string | null | undefined;
  paymentStatus?: string | null | undefined;
  payment_status?: string | null | undefined;
  nextPayment?: string | null | undefined;
  next_payment?: string | null | undefined;
  slaStatus?: 'overdue' | 'urgent' | 'warning' | 'safe' | string | null | undefined;
  daysRemaining?: number | null | undefined;
  isExpired?: boolean | undefined;
  isExpiring?: boolean | undefined;
  mode?: 'auto' | 'payment' | 'expiry' | 'sla' | 'customer_status' | undefined;
  className?: string | undefined;
  size?: 'xs' | 'sm' | 'md' | undefined;
  onClick?: (() => void) | undefined;
}

/**
 * Badge hiển thị trạng thái khách hàng tham gia:
 * - "Đang tham gia": Green Badge
 * - "Đã dừng đóng": Amber/Gray Badge
 */
export const CustomerParticipationBadge: React.FC<{
  status?: string | null | undefined;
  className?: string | undefined;
  onClick?: (() => void) | undefined;
  interactive?: boolean | undefined;
}> = ({ status, className = '', onClick, interactive = false }) => {
  const isStopped = status === 'Đã dừng đóng';
  const isPending = status === 'Chờ duyệt';

  if (isStopped) {
    return (
      <span 
        onClick={onClick}
        title={interactive ? "Bấm để đổi trạng thái" : undefined}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 ${interactive ? 'cursor-pointer hover:bg-amber-100 transition-colors' : ''} ${className}`}
      >
        <PauseCircle size={13} className="shrink-0 text-amber-600" />
        <span>Đã dừng đóng</span>
      </span>
    );
  }

  if (isPending) {
    return (
      <span 
        onClick={onClick}
        title={interactive ? "Bấm để đổi trạng thái" : undefined}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200/80 ${interactive ? 'cursor-pointer hover:bg-blue-100 transition-colors' : ''} ${className}`}
      >
        <Clock size={13} className="shrink-0 text-blue-600" />
        <span>Chờ duyệt</span>
      </span>
    );
  }

  return (
    <span 
      onClick={onClick}
      title={interactive ? "Bấm để đổi trạng thái" : undefined}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 ${interactive ? 'cursor-pointer hover:bg-emerald-100 transition-colors' : ''} ${className}`}
    >
      <UserCheck size={13} className="shrink-0 text-emerald-600" />
      <span>Đang tham gia</span>
    </span>
  );
};

export const CustomerStatusBadge: React.FC<CustomerStatusBadgeProps> = ({
  customerStatus,
  paymentStatus,
  payment_status,
  nextPayment,
  next_payment,
  slaStatus,
  daysRemaining,
  isExpired: propIsExpired,
  isExpiring: propIsExpiring,
  mode = 'auto',
  className = '',
  onClick
}) => {
  // Mode customer_status
  if (mode === 'customer_status' || customerStatus) {
    return <CustomerParticipationBadge status={customerStatus} className={className} onClick={onClick} />;
  }

  // Mode SLA (DispatchOperations)
  if (mode === 'sla' || (slaStatus && mode !== 'payment' && mode !== 'expiry')) {
    if (slaStatus === 'overdue') {
      const days = daysRemaining !== undefined && daysRemaining !== null ? Math.abs(daysRemaining) : '';
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse ${className}`}>
          <AlertTriangle className="w-3 h-3 shrink-0" /> Quá hạn {days ? `${days} ngày` : ''}
        </span>
      );
    }
    if (slaStatus === 'urgent') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 ${className}`}>
          <Clock className="w-3 h-3 shrink-0" /> Còn {daysRemaining ?? 0} ngày
        </span>
      );
    }
    if (slaStatus === 'warning') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 ${className}`}>
          Còn {daysRemaining ?? 0} ngày
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 ${className}`}>
        <CheckCircle2 className="w-3 h-3 shrink-0" /> An toàn
      </span>
    );
  }

  const effectivePaymentStatus = payment_status ?? paymentStatus;
  const effectiveNextPayment = next_payment ?? nextPayment;

  // Mode Payment only
  if (mode === 'payment') {
    if (effectivePaymentStatus === 'Chờ thanh toán') {
      return <span className={`bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Chờ thanh toán</span>;
    }
    if (effectivePaymentStatus === 'Đã hủy') {
      return <span className={`bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Đã hủy</span>;
    }
    if (effectivePaymentStatus === 'Khách hàng cũ') {
      return <span className={`bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Khách hàng cũ</span>;
    }
    return <span className={`bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold ${className}`}>{effectivePaymentStatus || 'Đã thu tiền'}</span>;
  }

  // Calculate auto expiry from nextPayment
  const todayStr = getLocalYYYYMMDD();
  const thirtyDaysLaterStr = getLocalYYYYMMDD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  
  const isExpired = propIsExpired ?? (Boolean(effectiveNextPayment && effectiveNextPayment < todayStr));
  const isExpiring = propIsExpiring ?? (Boolean(effectiveNextPayment && effectiveNextPayment >= todayStr && effectiveNextPayment <= thirtyDaysLaterStr));

  if (effectivePaymentStatus === 'Chờ thanh toán') {
    return <span className={`bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Chờ thanh toán</span>;
  }
  if (effectivePaymentStatus === 'Đã hủy') {
    return <span className={`bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Đã hủy</span>;
  }
  if (isExpired) {
    return (
      <span className={`bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold inline-flex items-center w-fit ${className}`}>
        <AlertTriangle size={12} className="mr-1 shrink-0" />Đã hết hạn
      </span>
    );
  }
  if (isExpiring) {
    return (
      <span className={`bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold inline-flex items-center w-fit ${className}`}>
        <AlertTriangle size={12} className="mr-1 shrink-0" />Sắp hết hạn
      </span>
    );
  }

  return <span className={`bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold ${className}`}>Bình thường</span>;
};

export default CustomerStatusBadge;
