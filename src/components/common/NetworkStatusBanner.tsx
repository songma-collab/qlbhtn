import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { WifiOff, Wifi } from 'lucide-react';

export const NetworkStatusBanner: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="bg-amber-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-md flex items-center justify-between sticky top-0 z-[9999] transition-all animate-pulse"
      >
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <WifiOff size={18} className="shrink-0 animate-bounce" />
          <span>
            <strong>Đang mất kết nối mạng.</strong> Các thao tác sẽ tự động được gửi lại khi có sóng 4G/Internet trở lại.
          </span>
        </div>
      </div>
    );
  }

  if (showRestored) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="bg-emerald-600 text-white px-4 py-2 text-xs sm:text-sm font-semibold shadow-md flex items-center justify-between sticky top-0 z-[9999] transition-all"
      >
        <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
          <Wifi size={18} className="shrink-0" />
          <span>Đã khôi phục kết nối mạng Internet thành công!</span>
        </div>
      </div>
    );
  }

  return null;
};
