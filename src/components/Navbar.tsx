import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Home, Calculator, Shield, LogIn, Sparkles, Search } from 'lucide-react';

const Navbar = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Delegate header rendering to AdminView when in admin panel
  if (path.startsWith('/admin') && currentUser) {
    return null;
  }

  const navItems = [
    { label: 'Dịch vụ công', path: '/', icon: Home },
    { label: 'Tính mức đóng', path: '/tinh-muc-dong', icon: Calculator },
    { label: 'Tính BHXH 1 lần', path: '/bhxh1lan', icon: Calculator },
    { label: 'Trợ lý hưu trí', path: '/tro-ly-huu-tri', icon: Sparkles },
  ];

  const handleNavClick = (targetPath: string) => {
    navigate(targetPath);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs h-16 sm:h-20 lg:h-24 flex items-center">
      <div className="max-w-[1360px] w-full mx-auto px-3 sm:px-8 lg:px-12 flex justify-between items-center relative">
        {/* Logo */}
        <div className="cursor-pointer flex items-center shrink-0 py-1" onClick={() => handleNavClick('/')}>
          <img 
            alt="Logo BHXH Sông Mã" 
            className="h-10 sm:h-14 lg:h-[64px] w-auto object-contain max-w-[200px] sm:max-w-[320px]" 
            src="https://lh3.googleusercontent.com/aida/AP1WRLsJfPseKuvjVk4oSyKMKw1jpU9_yAYj7HTFV0GYUZ9-SRoPR9eQM7EgY7baTuBcZycPg-l327pQsMB8N3nNmb-p798p-PQIbr68u_3atJXGYYsnGm_OEPLJfDRUFxztkHpqcjvNZCCm51G_DKbZwbf3KWoJTOYCjgYXGQX9mBJkOL_sfzOKktciUHTiMeunzWqQtJ-D1Bjs4WPso8GOtweXytUNK3Vfd7mi1iN6DucY-uy_Q_YLHKFVCh_y"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/logo.png";
            }}
          />
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 lg:gap-8 absolute left-1/2 -translate-x-1/2">
          {navItems.map((item) => {
            const isActive = path === item.path;
            return (
              <button 
                key={item.path}
                onClick={() => handleNavClick(item.path)} 
                className={`font-semibold transition-all text-sm cursor-pointer whitespace-nowrap ${
                  isActive 
                    ? 'text-[#004182] font-extrabold relative after:content-[\'\'] after:absolute after:-bottom-2 after:left-0 after:w-full after:h-[3px] after:bg-[#004182] after:rounded-full' 
                    : 'text-gray-600 hover:text-[#004182]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Action Button & Mobile Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
            className="hidden lg:flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200/70 text-gray-500 rounded-xl text-xs font-medium border border-gray-200 transition cursor-pointer"
            title="Mở tìm kiếm nhanh (Ctrl + K)"
          >
            <Search size={14} className="text-gray-400" />
            <span>Tìm kiếm...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white text-gray-600 rounded border border-gray-300 font-mono shadow-2xs">Ctrl K</kbd>
          </button>

          <button 
            onClick={() => handleNavClick('/admin')} 
            className="bg-[#004182] hover:bg-blue-900 text-white px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 rounded-xl font-bold active:scale-[0.98] transition-all shadow-sm text-xs sm:text-sm whitespace-nowrap cursor-pointer flex items-center gap-1.5 touch-manipulation"
          >
            {currentUser ? <Shield size={15} /> : <LogIn size={15} />}
            <span>{currentUser ? 'Quản Trị' : 'Đăng nhập'}</span>
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:text-[#004182] hover:bg-gray-100 active:bg-gray-200 rounded-xl transition-colors touch-manipulation"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/98 backdrop-blur-xl border-b border-gray-200 shadow-2xl py-3 px-4 flex flex-col gap-1 z-50 animate-in slide-in-from-top-2 duration-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = path === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-left transition-all touch-manipulation ${
                  isActive 
                    ? 'bg-blue-50 text-[#004182]' 
                    : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100 hover:text-[#004182]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#004182]' : 'text-gray-400'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};

export default Navbar;
