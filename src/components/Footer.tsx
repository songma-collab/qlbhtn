import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white/95 backdrop-blur-md text-gray-600 py-4 overflow-hidden relative mt-auto w-full border-t border-[#E2E8F0] shadow-sm">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-10 lg:px-12 w-full flex flex-col sm:flex-row justify-between items-center gap-3">
        <p className="text-gray-600 font-semibold text-xs text-center sm:text-left tracking-wide">
          © 2026 Đại lý thu BHXH Sông Mã. Bảo lưu mọi quyền.
        </p>
        <div className="px-4 py-1.5 bg-[#eff4ff] rounded-full border border-[#dbeafe] shadow-sm">
          <span className="text-[11px] font-black text-[#004182] tracking-wider uppercase">
            SYSTEM VERSION 2026.01-STABLE
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
