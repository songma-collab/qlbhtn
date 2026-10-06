import React, { createContext, useContext, useState, ReactNode, useMemo, useCallback } from 'react';
import { getTabFromPathname } from '../utils/adminRoutes';

interface AlertModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: (() => void) | undefined;
}

interface UIContextType {
  adminTab: string;
  setAdminTab: (tab: string) => void;
  crmFilter: string;
  setCrmFilter: (filter: string) => void;
  toastMessage: string | null;
  showToast: (msg: string, type?: string) => void;
  alertModalConfig: AlertModalConfig | null;
  showAlert: (title: string, message: string, onConfirmOrType?: (() => void) | string) => void;
  closeAlert: () => void;
  globalRegisterModal: { isOpen: boolean; type: 'BHXH' | 'BHYT'; record?: any | undefined; isRenew?: boolean | undefined; initialData?: any | undefined };
  setGlobalRegisterModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'BHXH' | 'BHYT'; record?: any | undefined; isRenew?: boolean | undefined; initialData?: any | undefined }>>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminTab, setAdminTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin')) {
      return getTabFromPathname(window.location.pathname);
    }
    return 'dashboard';
  });
  const [crmFilter, setCrmFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);
  const [globalRegisterModal, setGlobalRegisterModal] = useState<{
    isOpen: boolean;
    type: 'BHXH' | 'BHYT';
    record?: any | undefined;
    isRenew?: boolean | undefined;
    initialData?: any | undefined;
  }>({
    isOpen: false,
    type: 'BHXH',
    initialData: null
  });

  const showToast = useCallback((msg: string, _type?: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  const showAlert = useCallback((title: string, message: string, onConfirmOrType?: (() => void) | string) => {
    const onConfirm = typeof onConfirmOrType === 'function' ? onConfirmOrType : undefined;
    setAlertModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModalConfig(null);
  }, []);

  const value = useMemo(() => ({
    adminTab,
    setAdminTab,
    crmFilter,
    setCrmFilter,
    toastMessage,
    showToast,
    alertModalConfig,
    showAlert,
    closeAlert,
    globalRegisterModal,
    setGlobalRegisterModal
  }), [adminTab, crmFilter, toastMessage, alertModalConfig, globalRegisterModal, showToast, showAlert, closeAlert]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
