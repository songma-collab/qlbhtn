import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { getTabFromPathname } from '../../utils/adminRoutes';

export type AlertType = 'info' | 'warning' | 'error' | 'success';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface AlertModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  type?: AlertType;
}

export interface PromptModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: 'text' | 'textarea';
  onConfirm: (value: string) => void | Promise<void>;
  onCancel?: () => void;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastConfig {
  id?: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
  timestamp?: number;
}

export interface GlobalRegisterModalState {
  isOpen: boolean;
  type: 'BHXH' | 'BHYT';
  record?: any;
  isRenew?: boolean;
  initialData?: any;
}

export interface UIContextType {
  adminTab: string;
  setAdminTab: (tab: string) => void;
  crmFilter: string;
  setCrmFilter: (filter: string) => void;
  toastMessage: string | null;
  toastConfig: ToastConfig | null;
  toasts: ToastConfig[];
  showToast: (
    msg: string, 
    typeOrOptions?: ToastType | string | { 
      type?: ToastType; 
      action?: ToastAction; 
      duration?: number;
      title?: string;
      badge?: string;
      playSound?: boolean;
    },
    actionParam?: ToastAction
  ) => void;
  hideToast: (id?: string) => void;
  alertModalConfig: AlertModalConfig | null;
  showAlert: (title: string, message: string, onConfirmOrType?: (() => void) | AlertType | string, explicitType?: AlertType) => void;
  closeAlert: () => void;
  promptModalConfig: PromptModalConfig | null;
  showPrompt: (config: Omit<PromptModalConfig, 'isOpen'>) => void;
  closePrompt: () => void;
  globalRegisterModal: GlobalRegisterModalState;
  setGlobalRegisterModal: React.Dispatch<React.SetStateAction<GlobalRegisterModalState>>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminTab, setAdminTabState] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location?.pathname?.startsWith('/admin')) {
      return getTabFromPathname(window.location.pathname);
    }
    return 'dashboard';
  });
  const [crmFilter, setCrmFilterState] = useState<string>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const toasts = useMemo(() => (toastConfig ? [toastConfig] : []), [toastConfig]);
  const [alertModalConfig, setAlertModalConfig] = useState<AlertModalConfig | null>(null);
  const [promptModalConfig, setPromptModalConfig] = useState<PromptModalConfig | null>(null);
  const [globalRegisterModal, setGlobalRegisterModal] = useState<GlobalRegisterModalState>({
    isOpen: false,
    type: 'BHXH'
  });

  const setAdminTab = useCallback((tab: string) => {
    setAdminTabState(tab);
  }, []);

  const setCrmFilter = useCallback((filter: string) => {
    setCrmFilterState(filter);
  }, []);

  const hideToast = useCallback((_id?: string) => {
    setToastConfig(null);
    setToastMessage(null);
  }, []);

  const showToast = useCallback((
    msg: string, 
    typeOrOptions?: ToastType | string | { 
      type?: ToastType; 
      duration?: number;
      title?: string;
    }
  ) => {
    const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];
    let type: ToastType = 'success';
    let duration = 4000;
    let title: string | undefined;

    if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
      if (typeOrOptions.type && validTypes.includes(typeOrOptions.type)) {
        type = typeOrOptions.type;
      }
      if (typeOrOptions.duration) {
        duration = typeOrOptions.duration;
      }
      if (typeOrOptions.title) {
        title = typeOrOptions.title;
      }
    } else if (typeof typeOrOptions === 'string') {
      type = validTypes.includes(typeOrOptions as ToastType) ? (typeOrOptions as ToastType) : 'success';
    }

    const currentToast: ToastConfig = {
      id: `${Date.now()}`,
      message: msg,
      title,
      type,
      duration,
      timestamp: Date.now()
    };

    setToastMessage(msg);
    setToastConfig(currentToast);

    setTimeout(() => {
      setToastConfig(prev => (prev?.id === currentToast.id ? null : prev));
      setToastMessage(prev => (prev === msg ? null : prev));
    }, duration);
  }, []);

  const showAlert = useCallback((
    title: string, 
    message: string, 
    onConfirmOrType?: (() => void) | AlertType | string, 
    explicitType?: AlertType
  ) => {
    let onConfirm: (() => void) | undefined;
    let type: AlertType = explicitType || 'info';

    if (typeof onConfirmOrType === 'function') {
      onConfirm = onConfirmOrType;
    } else if (typeof onConfirmOrType === 'string') {
      type = (['info', 'warning', 'error', 'success'].includes(onConfirmOrType) 
        ? onConfirmOrType 
        : 'info') as AlertType;
    }

    setAlertModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  }, []);

  const closeAlert = useCallback(() => {
    setAlertModalConfig(null);
  }, []);

  const showPrompt = useCallback((config: Omit<PromptModalConfig, 'isOpen'>) => {
    setPromptModalConfig({
      ...config,
      isOpen: true
    });
  }, []);

  const closePrompt = useCallback(() => {
    setPromptModalConfig(null);
  }, []);

  const value = useMemo<UIContextType>(() => ({
    adminTab,
    setAdminTab,
    crmFilter,
    setCrmFilter,
    toastMessage,
    toastConfig,
    toasts,
    showToast,
    hideToast,
    alertModalConfig,
    showAlert,
    closeAlert,
    promptModalConfig,
    showPrompt,
    closePrompt,
    globalRegisterModal,
    setGlobalRegisterModal
  }), [
    adminTab,
    setAdminTab,
    crmFilter,
    setCrmFilter,
    toastMessage,
    toastConfig,
    toasts,
    showToast,
    hideToast,
    alertModalConfig,
    showAlert,
    closeAlert,
    promptModalConfig,
    showPrompt,
    closePrompt,
    globalRegisterModal
  ]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUIContext = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within a UIProvider');
  }
  return context;
};

export const useUI = useUIContext;
