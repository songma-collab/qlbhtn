import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface FeedbackContextType {
  toastMessage: string | null;
  showToast: (msg: string, type?: string) => void;
  alertModalConfig: { isOpen: boolean; title: string; message: string; onConfirm?: (() => void) | undefined } | null;
  showAlert: (title: string, message: string, onConfirmOrType?: (() => void) | string) => void;
  closeAlert: () => void;
  globalRegisterModal: { isOpen: boolean; type: 'BHXH' | 'BHYT'; initialData?: any | undefined };
  setGlobalRegisterModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'BHXH' | 'BHYT'; initialData?: any | undefined }>>;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [alertModalConfig, setAlertModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: (() => void) | undefined;
  } | null>(null);

  const [globalRegisterModal, setGlobalRegisterModal] = useState<{ 
    isOpen: boolean; 
    type: 'BHXH' | 'BHYT'; 
    initialData?: any | undefined;
  }>({ isOpen: false, type: 'BHXH' });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
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

  return (
    <FeedbackContext.Provider value={{
      toastMessage,
      showToast,
      alertModalConfig,
      showAlert,
      closeAlert,
      globalRegisterModal,
      setGlobalRegisterModal
    }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextType => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
