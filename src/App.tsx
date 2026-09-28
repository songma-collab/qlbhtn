/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import Navbar from './components/Navbar';
import LandingView from './components/LandingView';
import Toast from './components/Toast';
import AlertModal from './components/modals/AlertModal';
import PromptModal from './components/modals/PromptModal';
import RegisterModal from './components/modals/RegisterModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NetworkStatusBanner } from './components/common/NetworkStatusBanner';
import { CommandPaletteModal } from './components/modals/CommandPaletteModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ProtectedRoute } from './components/common/ProtectedRoute';

import { lazyWithRetry } from './utils/lazyWithRetry';
import AdminView from './components/AdminView';

// Lazy load secondary & heavy views to optimize initial bundle size & load speed
const ContributionCalculationView = lazyWithRetry(() => import('./components/ContributionCalculationView'));
const PensionAssistantView = lazyWithRetry(() => import('./components/PensionAssistantView'));
const SupportView = lazyWithRetry(() => import('./components/SupportView'));
const BHXH1LanView = lazyWithRetry(() => import('./components/BHXH1LanView'));

const DeferredRoute = ({ children }: { children: React.ReactNode }) => (
  <React.Suspense
    fallback={
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center p-8 gap-3">
        <div className="w-10 h-10 border-3 border-[#004182] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-gray-700">Đang khởi tạo chức năng...</p>
        <p className="text-xs text-gray-400">Vui lòng đợi trong giây lát</p>
      </div>
    }
  >
    {children}
  </React.Suspense>
);

const GlobalRegisterModalContainer = () => {
  const { globalRegisterModal, setGlobalRegisterModal } = useAppContext();
  const [modalState, setModalState] = React.useState<{ isOpen: boolean; type: 'BHXH' | 'BHYT'; initialData?: any }>({ isOpen: false, type: 'BHXH' });

  React.useEffect(() => {
    if (globalRegisterModal.isOpen) {
      setModalState({
        isOpen: true,
        type: globalRegisterModal.type,
        initialData: globalRegisterModal.initialData
      });
      setGlobalRegisterModal({ isOpen: false, type: 'BHXH' });
    }
  }, [globalRegisterModal, setGlobalRegisterModal]);

  if (!modalState.isOpen) return null;

  return (
    <RegisterModal
      isOpen={modalState.isOpen}
      onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
      type={modalState.type}
      initialData={modalState.initialData}
    />
  );
};

const AppContent = () => {
  const location = useLocation();
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const { setGlobalRegisterModal } = useAppContext();
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false);

  useKeyboardShortcuts({
    onSearch: () => setIsCommandPaletteOpen(true),
    onEscape: () => setIsCommandPaletteOpen(false),
    onNewBHXH: () => setGlobalRegisterModal({ isOpen: true, type: 'BHXH' }),
    onNewBHYT: () => setGlobalRegisterModal({ isOpen: true, type: 'BHYT' })
  });

  React.useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div className="text-gray-800 antialiased h-screen flex flex-col overflow-hidden bg-[#f0f4f8]">
      <NetworkStatusBanner />
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative flex flex-col">
        {!isAdminRoute && <Navbar />}
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/tinh-muc-dong" element={<DeferredRoute><ContributionCalculationView /></DeferredRoute>} />
          <Route path="/bhxh1lan" element={<DeferredRoute><BHXH1LanView /></DeferredRoute>} />
          <Route path="/tro-ly-huu-tri" element={<DeferredRoute><PensionAssistantView /></DeferredRoute>} />
          <Route path="/support" element={<DeferredRoute><SupportView /></DeferredRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute><AdminView /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Toast />
      <AlertModal />
      <PromptModal />
      <GlobalRegisterModalContainer />
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
