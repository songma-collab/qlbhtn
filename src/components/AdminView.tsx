import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { PieChart, Wallet, BadgeCheck, FileText, LogOut, Shield, HeartPulse, Menu, X, ChevronDown, ChevronRight, Home, Bell, User, Search, Users, UserCheck, Sliders, Trophy, TrendingUp, Send, History } from 'lucide-react';
import AdminLogin from './AdminLogin';
import { UserProfileModal } from './modals/UserProfileModal';
import RenewalReminderModal from './modals/RenewalReminderModal';
import RegisterModal from './modals/RegisterModal';
import { classifyRenewalRecords, RenewalUrgency } from '../utils/renewalDispatchHelper';
import { formatMoney, getInitials } from '../utils/helpers';
import { hasPermission } from '../utils/permissions';
import { getTabFromPathname, getPathFromTab } from '../utils/adminRoutes';

import { lazyWithRetry } from '../utils/lazyWithRetry';

// Each administration module is loaded only when its tab is selected with auto-retry.
const Dashboard = lazyWithRetry(() => import('./admin/Dashboard'));
const CRM = lazyWithRetry(() => import('./admin/CRM'));
const CustomerParticipationManagement = lazyWithRetry(() => import('./admin/CustomerParticipationManagement'));
const Finance = lazyWithRetry(() => import('./admin/Finance'));
const Staff = lazyWithRetry(() => import('./admin/Staff'));
const Reports = lazyWithRetry(() => import('./admin/Reports'));
const CommissionReport = lazyWithRetry(() => import('./admin/CommissionReport'));
const Leaderboard = lazyWithRetry(() => import('./admin/Leaderboard'));
const PredictiveAnalytics = lazyWithRetry(() => import('./admin/PredictiveAnalytics'));
const SystemSettings = lazyWithRetry(() => import('./admin/SystemSettings'));
const HomepageSettings = lazyWithRetry(() => import('./admin/HomepageSettings'));
const AuditLogs = lazyWithRetry(() => import('./admin/AuditLogs'));
const FinancialSettlement = lazyWithRetry(() => import('./admin/FinancialSettlement'));
const DispatchOperations = lazyWithRetry(() => import('./admin/DispatchOperations'));

interface SidebarNavItemProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  title,
  icon,
  isActive,
  isCollapsed,
  onClick,
  badge
}) => {
  return (
    <button 
      type="button"
      onClick={onClick} 
      title={title}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative w-full flex items-center ${
        isCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3.5 py-2.5'
      } rounded-xl text-sm transition-all duration-200 text-left cursor-pointer select-none border ${
        isActive 
          ? 'bg-gradient-to-r from-sky-500/30 via-blue-600/40 to-blue-500/20 text-white font-bold shadow-lg shadow-blue-950/50 border-sky-400/50 backdrop-blur-xs' 
          : 'text-blue-100/85 border-transparent hover:text-white hover:bg-white/10 hover:border-white/15 hover:shadow-sm ' + (isCollapsed ? '' : 'hover:translate-x-1')
      }`}
    >
      {/* Icon với hiệu ứng phóng to và đổi màu sáng khi hover/active */}
      <span className={`shrink-0 transition-all duration-200 ${
        isActive 
          ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] scale-105' 
          : 'text-blue-200/90 group-hover:scale-110 group-hover:text-cyan-200'
      }`}>
        {icon}
      </span>

      {/* Tiêu đề & Chấm trạng thái dạ quang bên phải */}
      {!isCollapsed && (
        <>
          <span className="text-left truncate flex-1 tracking-wide">
            {title}
          </span>
          {isActive ? (
            <span 
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" 
              title="Đang hoạt động"
            />
          ) : badge ? (
            badge
          ) : null}
        </>
      )}
    </button>
  );
};

const AdminView = () => {
  const { 
    adminTab, 
    setAdminTab, 
    currentUser, 
    setCurrentUser, 
    staff, 
    records, 
    settings,
    isAuthReady, 
    isAdmin, 
    showToast,
    globalRegisterModal,
    setGlobalRegisterModal
  } = useAppContext() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(!!currentUser);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRenewalReminderOpen, setIsRenewalReminderOpen] = useState(false);
  const [renewalInitialFilter, setRenewalInitialFilter] = useState<RenewalUrgency | 'all'>('all');
  const [renewalRegisterModal, setRenewalRegisterModal] = useState<{
    isOpen: boolean;
    type: 'BHXH' | 'BHYT';
    record: any | null;
    fromReminder?: boolean;
  }>({
    isOpen: false,
    type: 'BHXH',
    record: null,
    fromReminder: false
  });
  const hasNotifiedRenewalOnLogin = React.useRef(false);

  // Lắng nghe yêu cầu mở modal đăng ký / gia hạn toàn cục
  React.useEffect(() => {
    if (globalRegisterModal?.isOpen) {
      setRenewalRegisterModal({
        isOpen: true,
        type: globalRegisterModal.type || 'BHXH',
        record: globalRegisterModal.record || globalRegisterModal.initialData || null,
        fromReminder: !!globalRegisterModal.fromReminder
      });
      setGlobalRegisterModal((prev: any) => ({ ...prev, isOpen: false }));
    }
  }, [globalRegisterModal, setGlobalRegisterModal]);

  const handleOpenRenewalFromReminder = (rec: any) => {
    // Không đóng isRenewalReminderOpen để khi đóng form gia hạn hoặc gia hạn xong
    // người dùng vẫn ở lại popup Trung Tâm Quản Lý & Nhắc Hạn Hồ Sơ
    setRenewalRegisterModal({
      isOpen: true,
      type: (rec.type === 'BHYT' ? 'BHYT' : 'BHXH') as 'BHXH' | 'BHYT',
      record: rec,
      fromReminder: true
    });
  };

  const [openMenus, setOpenMenus] = useState({
    crm: true,
    finance: true,
    reports: true,
    system: true
  });

  const [headerSearch, setHeaderSearch] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<any | null>(null);

  // Phân quyền chi tiết cho sidebar và modules
  const canAccessDispatch = hasPermission(currentUser, 'dispatch.view', settings);
  const canAccessSettlement = hasPermission(currentUser, 'finance.settlement', settings);
  const canAccessLeaderboard = hasPermission(currentUser, 'reports.leaderboard', settings);
  const canAccessStaff = hasPermission(currentUser, 'system.staff', settings);
  const canAccessSystemSettings = hasPermission(currentUser, 'system.settings', settings);
  const canAccessAudit = hasPermission(currentUser, 'system.audit', settings);
  const canAccessSystem = canAccessStaff || canAccessSystemSettings || canAccessAudit;

  React.useEffect(() => {
    setIsAuthenticated(!!currentUser);
  }, [currentUser]);

  const filteredHeaderRecords = React.useMemo(() => {
    if (headerSearch.trim().length < 2) return [];
    const query = headerSearch.toLowerCase();
    
    // Deduplicate records by customer identity (CCCD or Phone or Name)
    const seen = new Set();
    const uniqueRecords: any[] = [];
    
    const recordsList = records || [];
    for (const r of recordsList) {
      const key = `${r.type}-${r.cccd || r.phone || r.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        // Also check filter match
        const match = (r.name && r.name.toLowerCase().includes(query)) ||
                      (r.cccd && r.cccd.toLowerCase().includes(query)) ||
                      (r.phone && r.phone.toLowerCase().includes(query)) ||
                      (r.bhxh && r.bhxh.toLowerCase().includes(query));
        if (match) {
          uniqueRecords.push(r);
        }
      }
    }
    
    return uniqueRecords.slice(0, 8);
  }, [records, headerSearch]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setIsNotificationOpen(false);
        setIsAdminDropdownOpen(false);
        setHeaderSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (menu: keyof typeof openMenus) => {
    setOpenMenus(prev => ({ ...prev, [menu]: !prev[menu] }));
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('vss_current_user');
    navigate('/');
  };

  // 1. Đồng bộ từ URL vào State (Hỗ trợ F5, truy cập trực tiếp bằng link, bookmark, nút Back/Forward)
  React.useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      const targetTab = getTabFromPathname(location.pathname);
      if (adminTab !== targetTab) {
        setAdminTab(targetTab);
      }
      // Nếu truy cập thẳng /admin hoặc /admin/, tự động chuyển hướng về /admin/tong-quan
      if (location.pathname === '/admin' || location.pathname === '/admin/') {
        navigate('/admin/tong-quan', { replace: true });
      }
    }
  }, [location.pathname]);

  // 2. Đồng bộ từ State vào URL (Khi component con kích hoạt setAdminTab hoặc đổi tab nội bộ)
  const isFirstMountRef = React.useRef(true);
  React.useEffect(() => {
    // URL luôn là Source of Truth trong lần mount đầu tiên, không ghi đè URL khi mới nạp trang
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (location.pathname.startsWith('/admin')) {
      const expectedPath = getPathFromTab(adminTab);
      if (location.pathname !== expectedPath && location.pathname !== '/admin' && location.pathname !== '/admin/') {
        navigate(expectedPath);
      }
    }
  }, [adminTab]);

  const handleTabChange = (tab: string) => {
    setAdminTab(tab);
    const targetPath = getPathFromTab(tab);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
    setIsMobileMenuOpen(false);
    setIsMobileSearchOpen(false);
  };

  const breadcrumbInfo = React.useMemo(() => {
    const tabMap: Record<string, { parent?: string; current: string }> = {
      'dashboard': { current: 'Tổng Quan' },
      'crm-participation': { parent: 'Khách Hàng', current: 'Hồ Sơ Tham Gia' },
      'crm-bhxh': { parent: 'Khách Hàng', current: 'Quản Lý BHXH' },
      'crm-bhyt': { parent: 'Khách Hàng', current: 'Quản Lý BHYT' },
      'crm-dispatch': { parent: 'Khách Hàng', current: 'Điều Phối & Đôn Đốc' },
      'finance-bhxh': { parent: 'Tài Chính', current: 'Giao Dịch BHXH' },
      'finance-bhyt': { parent: 'Tài Chính', current: 'Giao Dịch BHYT' },
      'financial-settlement': { parent: 'Tài Chính', current: 'Báo Cáo & Chốt Sổ' },
      'predictive-analytics': { parent: 'Tài Chính', current: 'Dự Báo Dòng Tiền' },
      'reports': { parent: 'Thống Kê', current: 'Báo Cáo Thống Kê' },
      'commission-reports': { parent: 'Thống Kê', current: 'Báo Cáo Hoa Hồng' },
      'leaderboard': { parent: 'Thống Kê', current: 'Bảng Thi Đua & KPI' },
      'staff': { parent: 'Hệ Thống', current: 'Quản Lý Nhân Viên' },
      'system-settings': { parent: 'Hệ Thống', current: 'Cấu Hình Hệ Thống' },
      'homepage-settings': { parent: 'Hệ Thống', current: 'Cài Đặt Trang Chủ' },
      'audit': { parent: 'Hệ Thống', current: 'Nhật Ký Hoạt Động' },
    };
    return tabMap[adminTab] || { current: 'Tổng Quan' };
  }, [adminTab]);

  const formatNotificationTime = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
    return `${timeStr} ${dateStr}`;
  };

  // Phân loại đôn đốc gia hạn 4 cấp độ (Quá hạn, Khẩn cấp ≤7 ngày, Cận hạn 8-15 ngày, Sắp đến 16-30 ngày)
  const renewalClassification = React.useMemo(() => {
    return classifyRenewalRecords(records || []);
  }, [records]);

  // Tự động quét và hiển thị Toast đôn đốc thông minh khi đăng nhập
  React.useEffect(() => {
    if (!isAuthReady || !currentUser || hasNotifiedRenewalOnLogin.current) return;
    if (!records || records.length === 0) return;

    hasNotifiedRenewalOnLogin.current = true;
    const total = renewalClassification.totalActionable;
    if (total > 0) {
      const overdue = renewalClassification.overdue.length;
      const urgent = renewalClassification.urgent.length;
      
      let message = `Hệ thống ghi nhận ${total} hồ sơ cần đôn đốc gia hạn`;
      if (overdue > 0 && urgent > 0) {
        message += ` (${overdue} đã quá hạn, ${urgent} khẩn cấp ≤7 ngày).`;
      } else if (overdue > 0) {
        message += ` (${overdue} hồ sơ đã quá hạn cần xử lý ngay).`;
      } else if (urgent > 0) {
        message += ` (${urgent} hồ sơ khẩn cấp ≤7 ngày).`;
      } else {
        message += ` trong 30 ngày tới.`;
      }

      showToast(message, {
        type: overdue > 0 ? 'warning' : 'info',
        action: {
          label: 'Xem & Đôn đốc ngay',
          onClick: () => {
            setRenewalInitialFilter(overdue > 0 ? 'overdue' : urgent > 0 ? 'urgent' : 'all');
            setIsRenewalReminderOpen(true);
          }
        },
        duration: 8000
      });
    }
  }, [isAuthReady, currentUser, records, renewalClassification, showToast]);

  const expiringCount = renewalClassification.totalActionable;

  if (!isAuthReady) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#004182]"></div>
        <span className="mt-3 text-sm text-gray-600 font-bold">Đang tải dữ liệu quản trị...</span>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 h-16 sm:h-20 flex shrink-0 sticky top-0 z-50">
        {/* Brand Block (Left) - Hidden on mobile, w-64 or w-20 on desktop based on collapse */}
        <div 
          onClick={() => navigate('/')} 
          className={`hidden md:flex ${isSidebarCollapsed ? 'w-20 justify-center px-2' : 'w-64 px-6'} bg-gradient-to-br from-[#004182] to-[#001b3a] items-center h-full border-r border-blue-900/30 cursor-pointer hover:opacity-90 transition-all duration-300`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shadow-inner shrink-0">
              <Shield className="text-white w-5 h-5" />
            </div>
            {!isSidebarCollapsed && (
              <div className="text-left overflow-hidden">
                <h1 className="text-white font-extrabold text-lg leading-none tracking-tight truncate">BHXH TN</h1>
                <span className="text-[9px] text-blue-200/70 font-bold uppercase tracking-wider block mt-1 leading-none truncate">Hệ thống quản trị</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Header Area */}
        <div className="flex-1 px-3 sm:px-6 flex justify-between items-center h-full">
          {/* Sidebar Toggle Button & Breadcrumbs for Desktop */}
          <div className="hidden md:flex items-center gap-2.5 lg:gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-2 text-gray-600 hover:text-[#004182] hover:bg-gray-100 rounded-xl transition cursor-pointer"
              title={isSidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-gray-200" aria-hidden="true" />

            {/* Breadcrumbs Navigation */}
            <nav aria-label="Breadcrumb Navigation" className="flex items-center gap-1.5 text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={() => handleTabChange('dashboard')}
                className="inline-flex items-center gap-1.5 text-gray-500 hover:text-[#004182] transition-colors p-1 rounded-lg hover:bg-gray-100 font-medium cursor-pointer"
                title="Về Home / Tổng quan"
              >
                <Home size={15} className="text-gray-500 mb-0.5" />
                <span>Home</span>
              </button>
              <ChevronRight size={13} className="text-gray-400 shrink-0" />
              {breadcrumbInfo.parent && (
                <>
                  <span className="text-gray-500 select-none">
                    {breadcrumbInfo.parent}
                  </span>
                  <ChevronRight size={13} className="text-gray-400 shrink-0" />
                </>
              )}
              <span className="font-bold text-gray-900 select-none truncate max-w-[180px] lg:max-w-none">
                {breadcrumbInfo.current}
              </span>
            </nav>
          </div>

          {/* Mobile menu toggle and brand */}
          <div className="flex items-center gap-2 md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
              className="text-gray-700 p-2 hover:bg-gray-100 active:bg-gray-200 rounded-xl transition focus:outline-none touch-manipulation"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <div 
              onClick={() => navigate('/')} 
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Shield className="text-[#004182] w-5 h-5" />
              <span className="font-extrabold text-[#004182] text-sm tracking-tight">BHXH TN</span>
            </div>
          </div>

          {/* Global Quick Search Bar - Centered on desktop */}
          <div className="hidden md:flex flex-1 max-w-lg mx-6 relative dropdown-container">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Tìm nhanh khách hàng (Tên, CCCD, SĐT)..."
                value={headerSearch}
                onChange={e => setHeaderSearch(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:border-[#004182] focus:bg-white transition-all"
              />
              {headerSearch && (
                <button 
                  onClick={() => setHeaderSearch('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Live Search Results Dropdown */}
            {headerSearch.trim().length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto custom-scrollbar z-50 text-left">
                <div className="p-3 border-b border-slate-200 bg-slate-50/80 flex justify-between items-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kết quả tìm kiếm</span>
                  <span className="text-[10px] font-bold text-[#004182]">{filteredHeaderRecords.length} kết quả</span>
                </div>
                {filteredHeaderRecords.length === 0 ? (
                  <div className="p-5 text-center text-sm text-slate-400 italic">Không tìm thấy khách hàng nào</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredHeaderRecords.map((r) => (
                      <div 
                        key={r.id} 
                        onClick={() => {
                          setSelectedRecordDetail(r);
                          setHeaderSearch('');
                        }}
                        className="p-3 hover:bg-slate-50/70 transition cursor-pointer flex justify-between items-center group"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm group-hover:text-[#004182] transition-colors">{r.name}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-medium">SĐT: {r.phone || 'N/A'} | CCCD: {r.cccd || 'N/A'}</p>
                        </div>
                        <div className="text-right flex items-center gap-2 shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase ${r.type === 'BHXH' ? 'bg-blue-50 text-blue-700' : 'bg-sky-50 text-sky-700'}`}>
                            {r.type}
                          </span>
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${r.paymentStatus === 'Đã thu tiền' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : r.paymentStatus === 'Chờ thanh toán' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {r.paymentStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-4 ml-auto">
            {/* Mobile Search Toggle Button */}
            <button
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-[#004182] hover:bg-gray-100 rounded-xl transition focus:outline-none touch-manipulation"
              aria-label="Tìm kiếm"
            >
              <Search size={20} />
            </button>

            <button 
              onClick={() => navigate('/')} 
              className="hidden sm:flex items-center gap-2 font-bold px-3 sm:px-4 py-2 rounded-xl bg-blue-50 text-[#004182] hover:bg-blue-100 transition-all text-xs sm:text-sm active:scale-95"
            >
              <Home size={16} />
              Cổng Dịch Vụ
            </button>
            
            {/* Notification Dropdown Container */}
            <div className="relative dropdown-container">
              <button 
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsAdminDropdownOpen(false);
                }} 
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl cursor-pointer transition focus:outline-none touch-manipulation"
                title="Thông báo đôn đốc & gia hạn hồ sơ"
              >
                <Bell size={20} />
                {expiringCount > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center text-[10px] font-extrabold text-white rounded-full border-2 border-white shadow-xs ${
                    renewalClassification.overdue.length > 0 
                      ? 'bg-rose-600 animate-pulse' 
                      : renewalClassification.urgent.length > 0 
                        ? 'bg-amber-500' 
                        : 'bg-[#004182]'
                  }`}>
                    {expiringCount > 99 ? '99+' : expiringCount}
                  </span>
                )}
              </button>
              
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-3.5 border-b border-gray-100 flex justify-between items-center bg-[#004182] text-white">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-amber-300" />
                      <h4 className="font-bold text-sm">Nhắc Hạn & Đôn Đốc</h4>
                    </div>
                    {expiringCount > 0 ? (
                      <span className="bg-amber-400 text-blue-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        {expiringCount} hồ sơ
                      </span>
                    ) : (
                      <span className="text-blue-100 text-xs font-normal">Đã hoàn tất</span>
                    )}
                  </div>

                  {/* 4 Mini Urgency Badges */}
                  <div className="grid grid-cols-4 gap-1 p-2 bg-gray-50 border-b border-gray-100 text-center text-[10px]">
                    <div 
                      onClick={() => {
                        setRenewalInitialFilter('overdue');
                        setIsRenewalReminderOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="p-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold hover:bg-rose-100 transition cursor-pointer"
                    >
                      <span className="block text-gray-500 font-normal text-[9px]">Quá hạn</span>
                      {renewalClassification.overdue.length}
                    </div>
                    <div 
                      onClick={() => {
                        setRenewalInitialFilter('urgent');
                        setIsRenewalReminderOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="p-1.5 rounded-lg bg-amber-50 text-amber-700 font-bold hover:bg-amber-100 transition cursor-pointer"
                    >
                      <span className="block text-gray-500 font-normal text-[9px]">≤7 ngày</span>
                      {renewalClassification.urgent.length}
                    </div>
                    <div 
                      onClick={() => {
                        setRenewalInitialFilter('warning');
                        setIsRenewalReminderOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="p-1.5 rounded-lg bg-yellow-50 text-yellow-800 font-bold hover:bg-yellow-100 transition cursor-pointer"
                    >
                      <span className="block text-gray-500 font-normal text-[9px]">8-15 ngày</span>
                      {renewalClassification.warning.length}
                    </div>
                    <div 
                      onClick={() => {
                        setRenewalInitialFilter('upcoming');
                        setIsRenewalReminderOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="p-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition cursor-pointer"
                    >
                      <span className="block text-gray-500 font-normal text-[9px]">16-30 ngày</span>
                      {renewalClassification.upcoming.length}
                    </div>
                  </div>

                  {/* 3 Urgent preview records */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {renewalClassification.all.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-500">
                        Không có hồ sơ nào cần đôn đốc trong kỳ này.
                      </div>
                    ) : (
                      renewalClassification.all.slice(0, 4).map((item, idx) => {
                        const r = item.record;
                        return (
                          <div 
                            key={r.id || idx} 
                            onClick={() => {
                              setRenewalInitialFilter(item.urgency);
                              setIsRenewalReminderOpen(true);
                              setIsNotificationOpen(false);
                            }}
                            className="p-3 hover:bg-blue-50/50 transition cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-gray-800 text-xs truncate">
                                {r.name || r.fullName || 'Khách hàng'}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1.5">
                                <span className={`font-semibold ${r.type === 'BHYT' ? 'text-cyan-700' : 'text-blue-700'}`}>
                                  {r.type}
                                </span>
                                <span>•</span>
                                <span>{r.phone || r.citizenId || '---'}</span>
                              </p>
                            </div>
                            <span 
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                              style={{ backgroundColor: item.urgencyColor }}
                            >
                              {item.urgencyLabel}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Dropdown Footer Action */}
                  <div className="p-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button 
                      onClick={() => {
                        setIsRenewalReminderOpen(true);
                        setIsNotificationOpen(false);
                      }}
                      className="w-full py-2 bg-[#004182] hover:bg-[#003166] text-white rounded-xl text-xs font-bold transition shadow-xs text-center cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>Mở Trung Tâm Nhắc Hạn Hồ Sơ</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown Container */}
            <div className="relative dropdown-container">
              <button 
                onClick={() => {
                  setIsAdminDropdownOpen(!isAdminDropdownOpen);
                  setIsNotificationOpen(false);
                }} 
                className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-gray-200 cursor-pointer focus:outline-none hover:opacity-85 transition-opacity"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#0ea5e9] flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm select-none">
                  {getInitials(currentUser?.name || 'Admin')}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="font-bold text-sm text-gray-800 leading-tight">{currentUser?.name || 'Admin'}</p>
                  <p className="text-[11px] text-green-600 font-semibold mt-0.5">{currentUser?.role || 'Admin'}</p>
                </div>
              </button>
              
              {isAdminDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 py-2 text-left animate-in fade-in zoom-in-95 duration-150">
                  <button 
                    onClick={() => {
                      setIsProfileModalOpen(true);
                      setIsAdminDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left focus:outline-none cursor-pointer"
                  >
                    <User size={16} className="text-[#0ea5e9]" />
                    <span className="font-medium">Hồ sơ của tôi</span>
                  </button>
                  
                  <div className="border-t border-gray-100 my-1"></div>
                  
                  <button 
                    onClick={() => {
                      handleLogout();
                      setIsAdminDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50/50 transition text-left focus:outline-none cursor-pointer"
                  >
                    <LogOut size={16} className="text-red-500" />
                    <span className="font-semibold">Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search Dropdown Overlay */}
      {isMobileSearchOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 p-3 shadow-md z-40 sticky top-16 dropdown-container">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              autoFocus
              placeholder="Tìm nhanh khách hàng (Tên, CCCD, SĐT)..."
              value={headerSearch}
              onChange={e => setHeaderSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:border-[#004182] focus:bg-white"
            />
            {headerSearch && (
              <button 
                onClick={() => setHeaderSearch('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Live Mobile Search Results */}
          {headerSearch.trim().length >= 2 && (
            <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 max-h-64 overflow-y-auto divide-y divide-gray-100">
              {filteredHeaderRecords.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 italic">Không tìm thấy khách hàng nào</div>
              ) : (
                filteredHeaderRecords.map((r) => (
                  <div 
                    key={r.id} 
                    onClick={() => {
                      setSelectedRecordDetail(r);
                      setHeaderSearch('');
                      setIsMobileSearchOpen(false);
                    }}
                    className="p-3 active:bg-gray-50 transition cursor-pointer flex justify-between items-center"
                  >
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{r.name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">SĐT: {r.phone || 'N/A'} | CCCD: {r.cccd || 'N/A'}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.type === 'BHXH' ? 'bg-blue-50 text-blue-700' : 'bg-sky-50 text-sky-700'}`}>
                      {r.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {isMobileMenuOpen && (
          <div 
            onClick={() => setIsMobileMenuOpen(false)} 
            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity duration-300"
          />
        )}

        {/* Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} transition-all duration-300 ease-in-out fixed md:relative ${isSidebarCollapsed ? 'w-20' : 'w-72 max-w-[85vw] md:w-64'} bg-gradient-to-br from-[#004182] to-[#001b3a] text-white flex flex-col h-full shadow-2xl md:shadow-none z-50 top-0 left-0 bottom-0 overflow-hidden`}>
          {/* Subtle Decorative Blurred Circular Orbs & Rings (Góc trên, Thân giữa, Đáy sidebar) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none">
            {/* 1. Góc trên (Top Corner): Vòng tròn mờ và vành khuyên tinh tế */}
            <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full border border-sky-400/20 bg-sky-500/10 blur-xl"></div>
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full border border-white/10"></div>
            <div className="absolute top-2 right-2 w-18 h-18 rounded-full border border-cyan-300/15 border-dashed"></div>

            {/* 2. Thân giữa (Middle Body): Vành tròn mờ phân bổ mềm mại */}
            <div className="absolute top-1/2 -left-14 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-400/15 bg-blue-400/[0.08] blur-2xl"></div>
            <div className="absolute top-1/2 -left-8 -translate-y-1/2 w-36 h-36 rounded-full border border-white/[0.08]"></div>
            <div className="absolute top-[48%] -left-2 -translate-y-1/2 w-24 h-24 rounded-full border border-sky-300/10 border-dashed"></div>

            {/* 3. Đáy sidebar (Bottom Sidebar): Cụm dải vòng tròn mờ đa tầng */}
            <div className="absolute -bottom-14 -right-10 w-52 h-52 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] blur-xl"></div>
            <div className="absolute -bottom-8 -right-4 w-40 h-40 rounded-full border border-white/10"></div>
            <div className="absolute -bottom-2 right-2 w-28 h-28 rounded-full border border-teal-300/15 border-dashed"></div>
            <div className="absolute bottom-6 right-8 w-14 h-14 rounded-full border border-white/5"></div>
          </div>

          {/* Mobile Sidebar Close Button */}
          <div className="relative z-10 md:hidden flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Shield className="text-white w-5 h-5" />
              <span className="font-extrabold text-white text-base">Menu Quản Trị</span>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 active:scale-95"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative z-10 flex-1 py-4 flex flex-col gap-1 px-3 overflow-y-auto custom-scrollbar pb-24 md:pb-4">
            <SidebarNavItem
              id="dashboard"
              title="Tổng Quan"
              icon={<PieChart size={20} />}
              isActive={adminTab === 'dashboard'}
              isCollapsed={isSidebarCollapsed}
              onClick={() => handleTabChange('dashboard')}
            />
            
            <div 
              className={`mt-2.5 mb-1 px-3 py-1.5 text-xs font-bold text-blue-200/80 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-white hover:bg-white/5 rounded-lg transition-all select-none ${isSidebarCollapsed ? 'hidden' : 'flex'}`} 
              onClick={() => toggleMenu('crm')}
              title={openMenus.crm ? 'Thu gọn nhóm Khách Hàng' : 'Mở rộng nhóm Khách Hàng'}
            >
              <span>Khách Hàng</span>
              <span className="p-0.5 rounded text-blue-300 hover:text-white transition-colors">
                {openMenus.crm ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </div>
            {(openMenus.crm || isSidebarCollapsed) && (
              <div className={`${isSidebarCollapsed ? '' : 'pl-2'} flex flex-col gap-1`}>
                <SidebarNavItem
                  id="crm-participation"
                  title="Hồ Sơ Tham Gia"
                  icon={<History size={18} className={adminTab === 'crm-participation' ? 'text-amber-300' : 'text-amber-400/90'} />}
                  isActive={adminTab === 'crm-participation'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('crm-participation')}
                />
                <SidebarNavItem
                  id="crm-bhxh"
                  title="Quản Lý BHXH"
                  icon={<Shield size={18} />}
                  isActive={adminTab === 'crm-bhxh'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('crm-bhxh')}
                />
                <SidebarNavItem
                  id="crm-bhyt"
                  title="Quản Lý BHYT"
                  icon={<HeartPulse size={18} />}
                  isActive={adminTab === 'crm-bhyt'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('crm-bhyt')}
                />
                {canAccessDispatch && (
                  <SidebarNavItem
                    id="crm-dispatch"
                    title="Điều Phối & Đôn Đốc"
                    icon={<Send size={18} />}
                    isActive={adminTab === 'crm-dispatch'}
                    isCollapsed={isSidebarCollapsed}
                    onClick={() => handleTabChange('crm-dispatch')}
                  />
                )}
              </div>
            )}
            
            <div 
              className={`mt-2.5 mb-1 px-3 py-1.5 text-xs font-bold text-blue-200/80 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-white hover:bg-white/5 rounded-lg transition-all select-none ${isSidebarCollapsed ? 'hidden' : 'flex'}`} 
              onClick={() => toggleMenu('finance')}
              title={openMenus.finance ? 'Thu gọn nhóm Tài Chính' : 'Mở rộng nhóm Tài Chính'}
            >
              <span>Tài Chính</span>
              <span className="p-0.5 rounded text-blue-300 hover:text-white transition-colors">
                {openMenus.finance ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </div>
            {(openMenus.finance || isSidebarCollapsed) && (
              <div className={`${isSidebarCollapsed ? '' : 'pl-2'} flex flex-col gap-1`}>
                <SidebarNavItem
                  id="finance-bhxh"
                  title="Giao Dịch BHXH"
                  icon={<Wallet size={18} />}
                  isActive={adminTab === 'finance-bhxh'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('finance-bhxh')}
                />
                <SidebarNavItem
                  id="finance-bhyt"
                  title="Giao Dịch BHYT"
                  icon={<Wallet size={18} />}
                  isActive={adminTab === 'finance-bhyt'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('finance-bhyt')}
                />
                {canAccessSettlement && (
                  <SidebarNavItem
                    id="financial-settlement"
                    title="Báo Cáo & Chốt Sổ"
                    icon={<FileText size={18} />}
                    isActive={adminTab === 'financial-settlement'}
                    isCollapsed={isSidebarCollapsed}
                    onClick={() => handleTabChange('financial-settlement')}
                  />
                )}
                <SidebarNavItem
                  id="predictive-analytics"
                  title="Dự Báo Dòng Tiền"
                  icon={<TrendingUp size={18} />}
                  isActive={adminTab === 'predictive-analytics'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('predictive-analytics')}
                />
              </div>
            )}

            <div 
              className={`mt-2.5 mb-1 px-3 py-1.5 text-xs font-bold text-blue-200/80 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-white hover:bg-white/5 rounded-lg transition-all select-none ${isSidebarCollapsed ? 'hidden' : 'flex'}`} 
              onClick={() => toggleMenu('reports')}
              title={openMenus.reports ? 'Thu gọn nhóm Thống Kê' : 'Mở rộng nhóm Thống Kê'}
            >
              <span>Thống Kê</span>
              <span className="p-0.5 rounded text-blue-300 hover:text-white transition-colors">
                {openMenus.reports ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </div>
            {(openMenus.reports || isSidebarCollapsed) && (
              <div className={`${isSidebarCollapsed ? '' : 'pl-2'} flex flex-col gap-1`}>
                <SidebarNavItem
                  id="reports"
                  title="Báo Cáo Thống Kê"
                  icon={<FileText size={18} />}
                  isActive={adminTab === 'reports'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('reports')}
                />
                <SidebarNavItem
                  id="commission-reports"
                  title="Báo Cáo Hoa Hồng"
                  icon={<FileText size={18} />}
                  isActive={adminTab === 'commission-reports'}
                  isCollapsed={isSidebarCollapsed}
                  onClick={() => handleTabChange('commission-reports')}
                />
                {canAccessLeaderboard && (
                  <SidebarNavItem
                    id="leaderboard"
                    title="Bảng Thi Đua & KPI"
                    icon={<Trophy size={18} />}
                    isActive={adminTab === 'leaderboard'}
                    isCollapsed={isSidebarCollapsed}
                    onClick={() => handleTabChange('leaderboard')}
                  />
                )}
              </div>
            )}

            {canAccessSystem && (
              <>
                <div 
                  className={`mt-2.5 mb-1 px-3 py-1.5 text-xs font-bold text-blue-200/80 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-white hover:bg-white/5 rounded-lg transition-all select-none ${isSidebarCollapsed ? 'hidden' : 'flex'}`} 
                  onClick={() => toggleMenu('system')}
                  title={openMenus.system ? 'Thu gọn nhóm Hệ Thống' : 'Mở rộng nhóm Hệ Thống'}
                >
                  <span>Hệ Thống</span>
                  <span className="p-0.5 rounded text-blue-300 hover:text-white transition-colors">
                    {openMenus.system ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </span>
                </div>
                {(openMenus.system || isSidebarCollapsed) && (
                  <div className={`${isSidebarCollapsed ? '' : 'pl-2'} flex flex-col gap-1`}>
                    {canAccessStaff && (
                      <SidebarNavItem
                        id="staff"
                        title="Quản Lý Nhân Viên"
                        icon={<BadgeCheck size={18} />}
                        isActive={adminTab === 'staff'}
                        isCollapsed={isSidebarCollapsed}
                        onClick={() => handleTabChange('staff')}
                      />
                    )}
                    {canAccessSystemSettings && (
                      <>
                        <SidebarNavItem
                          id="system-settings"
                          title="Cấu Hình Hệ Thống"
                          icon={<BadgeCheck size={18} />}
                          isActive={adminTab === 'system-settings'}
                          isCollapsed={isSidebarCollapsed}
                          onClick={() => handleTabChange('system-settings')}
                        />
                        <SidebarNavItem
                          id="homepage-settings"
                          title="Cài Đặt Trang Chủ"
                          icon={<Sliders size={18} />}
                          isActive={adminTab === 'homepage-settings'}
                          isCollapsed={isSidebarCollapsed}
                          onClick={() => handleTabChange('homepage-settings')}
                        />
                      </>
                    )}
                    {canAccessAudit && (
                      <SidebarNavItem
                        id="audit"
                        title="Nhật Ký Hoạt Động"
                        icon={<FileText size={18} />}
                        isActive={adminTab === 'audit'}
                        isCollapsed={isSidebarCollapsed}
                        onClick={() => handleTabChange('audit')}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main Content View with extra bottom padding on mobile for Bottom Navigation */}
        <div className="flex-1 p-3 sm:p-5 md:p-8 overflow-y-auto bg-[#F8FAFC] pb-24 md:pb-8">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[360px]">
                <div className="flex flex-col items-center gap-2.5">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#004182] border-t-transparent"></div>
                  <span className="text-xs text-slate-500 font-medium">Đang tải phân hệ...</span>
                </div>
              </div>
            }
          >
            {adminTab === 'dashboard' && <Dashboard />}
            {adminTab === 'crm-bhxh' && <CRM type="BHXH" />}
            {adminTab === 'crm-bhyt' && <CRM type="BHYT" />}
            {adminTab === 'crm-participation' && <CustomerParticipationManagement />}
            {adminTab === 'crm-dispatch' && (canAccessDispatch ? <DispatchOperations /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền truy cập chức năng Điều Phối & Đôn Đốc.
              </div>
            ))}
            {adminTab === 'predictive-analytics' && <PredictiveAnalytics />}
            {adminTab === 'finance-bhxh' && <Finance type="BHXH" />}
            {adminTab === 'finance-bhyt' && <Finance type="BHYT" />}
            {adminTab === 'financial-settlement' && (canAccessSettlement ? <FinancialSettlement /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền truy cập chức năng Báo Cáo & Chốt Sổ Tài Chính.
              </div>
            ))}
            {adminTab === 'staff' && (canAccessStaff ? <Staff /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền quản lý danh sách và phân quyền nhân viên.
              </div>
            ))}
            {adminTab === 'system-settings' && (canAccessSystemSettings ? <SystemSettings /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền cấu hình hệ thống.
              </div>
            ))}
            {adminTab === 'homepage-settings' && (canAccessSystemSettings ? <HomepageSettings /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền chỉnh sửa trang chủ.
              </div>
            ))}
            {adminTab === 'audit' && (canAccessAudit ? <AuditLogs /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền xem nhật ký hoạt động hệ thống.
              </div>
            ))}
            {adminTab === 'reports' && <Reports />}
            {adminTab === 'commission-reports' && <CommissionReport />}
            {adminTab === 'leaderboard' && (canAccessLeaderboard ? <Leaderboard /> : (
              <div className="p-8 bg-white rounded-2xl border border-rose-100 text-center text-rose-600 font-medium">
                Bạn không có quyền xem bảng xếp hạng & thi đua KPI.
              </div>
            ))}
          </React.Suspense>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex justify-around items-center">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all touch-manipulation ${
            adminTab === 'dashboard' ? 'text-[#004182] font-extrabold' : 'text-gray-500 font-medium hover:text-gray-800'
          }`}
        >
          <PieChart size={20} className={adminTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-0.5">Tổng quan</span>
        </button>

        <button
          onClick={() => handleTabChange('crm-bhxh')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all touch-manipulation ${
            adminTab === 'crm-bhxh' ? 'text-[#004182] font-extrabold' : 'text-gray-500 font-medium hover:text-gray-800'
          }`}
        >
          <Shield size={20} className={adminTab === 'crm-bhxh' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-0.5">BHXH</span>
        </button>

        <button
          onClick={() => handleTabChange('crm-bhyt')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all touch-manipulation ${
            adminTab === 'crm-bhyt' ? 'text-[#004182] font-extrabold' : 'text-gray-500 font-medium hover:text-gray-800'
          }`}
        >
          <HeartPulse size={20} className={adminTab === 'crm-bhyt' ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-0.5">BHYT</span>
        </button>

        <button
          onClick={() => handleTabChange('finance-bhxh')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all touch-manipulation ${
            adminTab.startsWith('finance') || adminTab === 'financial-settlement' ? 'text-[#004182] font-extrabold' : 'text-gray-500 font-medium hover:text-gray-800'
          }`}
        >
          <Wallet size={20} className={adminTab.startsWith('finance') ? 'stroke-[2.5]' : 'stroke-[1.8]'} />
          <span className="text-[10px] mt-0.5">Tài chính</span>
        </button>

        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-gray-500 font-medium hover:text-gray-800 transition-all touch-manipulation"
        >
          <Menu size={20} className="stroke-[1.8]" />
          <span className="text-[10px] mt-0.5">Thêm</span>
        </button>
      </nav>

      {/* Quick Search Record Detail Modal */}
      {selectedRecordDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6 transition-opacity duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden transform transition-all duration-300 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-br from-[#004182] to-[#001b3a] p-6 flex justify-between items-center text-white border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${selectedRecordDetail.type === 'BHXH' ? 'bg-[#004182]' : 'bg-[#0ea5e9]'}`}>
                  {selectedRecordDetail.type === 'BHXH' ? <Shield size={20} /> : <HeartPulse size={20} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg leading-tight uppercase">{selectedRecordDetail.name}</h3>
                  <span className="text-[11px] text-blue-200/80 font-bold tracking-wider uppercase">Chi tiết hồ sơ {selectedRecordDetail.type}</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedRecordDetail(null)} 
                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 text-left bg-slate-50/50">
              {/* Row 1: Demographics */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
                  <User className="text-[#004182]" size={16} /> Thông tin cá nhân
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Số ĐDCN / CCCD</span><span className="font-bold text-slate-700">{selectedRecordDetail.cccd || selectedRecordDetail.bhxh || 'N/A'}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Số điện thoại</span><span className="font-bold text-slate-700">{selectedRecordDetail.phone || 'N/A'}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Ngày sinh</span><span className="font-bold text-slate-700">{selectedRecordDetail.dob ? new Date(selectedRecordDetail.dob).toLocaleDateString('vi-VN') : 'N/A'}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Giới tính</span><span className="font-bold text-slate-700">{selectedRecordDetail.gender === 'male' ? 'Nam' : selectedRecordDetail.gender === 'female' ? 'Nữ' : 'N/A'}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Dân tộc</span><span className="font-bold text-slate-700">{selectedRecordDetail.nation || 'N/A'}</span></div>
                  <div className="sm:col-span-2 md:col-span-3"><span className="text-gray-400 block font-semibold mb-0.5">Địa chỉ</span><span className="font-bold text-slate-700">{selectedRecordDetail.address || 'N/A'}</span></div>
                </div>
              </div>

              {/* Row 2: Premium & Payment Details */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
                  <Wallet className="text-[#004182]" size={16} /> Thông tin đóng phí & Mức hưởng
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Loại hình</span><span className={`px-2 py-0.5 rounded text-xs font-bold inline-block ${selectedRecordDetail.actionType === 'Gia hạn' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{selectedRecordDetail.actionType}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Trạng thái thanh toán</span><span className={`px-2 py-0.5 rounded text-xs font-bold inline-block ${selectedRecordDetail.paymentStatus === 'Đã thu tiền' ? 'bg-green-50 text-green-700 border border-green-200' : selectedRecordDetail.paymentStatus === 'Chờ thanh toán' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{selectedRecordDetail.paymentStatus}</span></div>
                  <div><span className="text-gray-400 block font-semibold mb-0.5">Trạng thái duyệt hồ sơ</span><span className={`px-2 py-0.5 rounded text-xs font-bold inline-block ${selectedRecordDetail.status === 'Đã hoàn thành' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : selectedRecordDetail.status === 'Chờ xử lý' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{selectedRecordDetail.status}</span></div>
                  
                  {selectedRecordDetail.type === 'BHXH' && (
                    <>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Thu nhập lựa chọn</span><span className="font-bold text-slate-800">{formatMoney(selectedRecordDetail.income || 0)}</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Thời gian đóng</span><span className="font-bold text-slate-800">{selectedRecordDetail.months} tháng ({selectedRecordDetail.fromMonth} - {selectedRecordDetail.toMonth})</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Hạn đóng tiếp theo</span><span className="font-bold text-[#FDB913]">{selectedRecordDetail.nextPayment ? new Date(selectedRecordDetail.nextPayment).toLocaleDateString('vi-VN') : 'N/A'}</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Mức đóng gốc</span><span className="font-bold text-slate-700">{formatMoney(selectedRecordDetail.basePremium || 0)}</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Hỗ trợ Nhà nước</span><span className="font-bold text-slate-700">{formatMoney((selectedRecordDetail.nnSupportAmount || 0) + (selectedRecordDetail.dpSupportAmount || 0))} ({selectedRecordDetail.nnSupportPct + selectedRecordDetail.dpSupportPct}%)</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Tổng số tiền phải đóng</span><span className="font-extrabold text-[#004182]">{formatMoney(selectedRecordDetail.amount || 0)}</span></div>
                    </>
                  )}

                  {selectedRecordDetail.type === 'BHYT' && (
                    <>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Thời gian đóng</span><span className="font-bold text-slate-800">{selectedRecordDetail.months} tháng ({selectedRecordDetail.fromMonth} - {selectedRecordDetail.toMonth})</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Hạn đóng tiếp theo</span><span className="font-bold text-[#FDB913]">{selectedRecordDetail.nextPayment ? new Date(selectedRecordDetail.nextPayment).toLocaleDateString('vi-VN') : 'N/A'}</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Tổng số tiền phải đóng</span><span className="font-extrabold text-[#004182]">{formatMoney(selectedRecordDetail.amount || 0)}</span></div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 3: BHYT Family Members or Delivery Info */}
              {selectedRecordDetail.type === 'BHYT' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                  <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 flex items-center gap-2">
                    <Users className="text-[#004182]" size={16} /> Thành viên tham gia hộ gia đình
                  </h4>
                  {selectedRecordDetail.members && selectedRecordDetail.members.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-gray-500 font-semibold border-b border-slate-200">
                            <th className="p-2.5">Họ và tên</th>
                            <th className="p-2.5">Số ĐDCN / CCCD</th>
                            <th className="p-2.5">SĐT</th>
                            <th className="p-2.5">Ngày sinh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedRecordDetail.members.map((m: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5 font-bold text-slate-800">{m.name}</td>
                              <td className="p-2.5 text-[#004182] font-bold">{m.cccd || m.bhxh || 'N/A'}</td>
                              <td className="p-2.5 text-slate-600">{m.phone || 'N/A'}</td>
                              <td className="p-2.5 text-slate-600">{m.dob ? new Date(m.dob).toLocaleDateString('vi-VN') : 'N/A'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-xs italic">Không có danh sách thành viên đi kèm.</p>
                  )}
                  
                  {/* Delivery Info */}
                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <h5 className="font-bold text-slate-800 text-xs sm:text-sm mb-2">Thông tin nhận thẻ BHYT giấy:</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                      <div><span className="text-gray-400 block font-semibold mb-0.5">Người nhận</span><span className="font-bold text-slate-700">{selectedRecordDetail.recvName || 'N/A'}</span></div>
                      <div><span className="text-gray-400 block font-semibold mb-0.5">SĐT nhận</span><span className="font-bold text-slate-700">{selectedRecordDetail.recvPhone || 'N/A'}</span></div>
                      <div className="sm:col-span-2 md:col-span-3"><span className="text-gray-400 block font-semibold mb-0.5">Địa chỉ nhận</span><span className="font-bold text-slate-700">{selectedRecordDetail.recvAddress || 'N/A'}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Row 4: Assigned Staff & Notes */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <UserCheck className="text-green-600" size={16} /> Nhân viên phụ trách
                    </h4>
                    {(() => {
                      const assigned = staff.find(s => s.id === selectedRecordDetail.staffId);
                      if (assigned) {
                        return (
                          <div className="space-y-1 bg-green-50/50 p-3 rounded-xl border border-green-100">
                            <p className="font-bold text-slate-800">{assigned.name}</p>
                            <p className="text-xs text-gray-500">Mã NV: {assigned.staffCode || assigned.id} | SĐT: {assigned.phone}</p>
                          </div>
                        );
                      }
                      return <p className="text-gray-500 italic">Chưa được phân công nhân viên xử lý.</p>;
                    })()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                      <FileText className="text-[#004182]" size={16} /> Ghi chú nội bộ
                    </h4>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 min-h-[50px] text-slate-600 italic">
                      {selectedRecordDetail.notes || 'Không có ghi chú nào.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-150 bg-white flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setSelectedRecordDetail(null)} 
                className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition-all text-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xem Hồ sơ cá nhân của nhân viên */}
      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        user={currentUser} 
      />

      {/* Modal Quản Lý & Nhắc Hạn Đôn Đốc Hồ Sơ */}
      <RenewalReminderModal
        isOpen={isRenewalReminderOpen}
        onClose={() => setIsRenewalReminderOpen(false)}
        initialFilter={renewalInitialFilter}
        onRenewCustomer={handleOpenRenewalFromReminder}
      />

      {/* Modal Gia Hạn BHXH / BHYT Đồng Bộ Trực Tiếp */}
      {renewalRegisterModal.isOpen && (
        <RegisterModal
          isOpen={renewalRegisterModal.isOpen}
          onClose={() => {
            const wasFromReminder = !!renewalRegisterModal.fromReminder;
            setRenewalRegisterModal({ isOpen: false, type: 'BHXH', record: null, fromReminder: false });
            if (wasFromReminder) {
              setIsRenewalReminderOpen(true);
            }
          }}
          type={renewalRegisterModal.type}
          record={renewalRegisterModal.record}
          isRenew={true}
        />
      )}
    </div>
  );
};

export default AdminView;
