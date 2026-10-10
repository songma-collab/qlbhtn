import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import Footer from './Footer';
import RegisterModal from './modals/RegisterModal';
import SearchResultModal from './modals/SearchResultModal';
import { callPublicPortal } from '../utils/publicPortal';
import TurnstileCaptcha from './TurnstileCaptcha';

import { Helmet } from 'react-helmet-async';

const LandingView = () => {
  const { showAlert, globalRegisterModal, setGlobalRegisterModal, policies } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  const homepagePolicy = policies?.find(p => p.parameter_type === 'homepage_config' && p.is_active);
  const homepageConfig = homepagePolicy 
    ? (typeof homepagePolicy.value === 'string' ? JSON.parse(homepagePolicy.value) : homepagePolicy.value)
    : {
        heroTagline: "Hệ Thống Chuẩn Nghị Định 159/2025",
        heroTitleWhite: "Tương lai đảm bảo",
        heroTitleGreen: "An tâm tuổi già!",
        heroSubtitle: "Hệ thống tư vấn & đăng ký Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình tuân thủ theo Luật BHXH 2024 & NĐ 159/2025/NĐ-CP.",
        trustCardTitle: "Tại sao tin dùng\nBHXH Sổ?",
        trustCardSubtitle: "Kết nối hơn 10 triệu người dân Việt Nam với nền tảng an sinh số hiện đại nhất.",
        trustCardAction: "Xem lộ trình an sinh của bạn",
        trustCardActionLink: "/support",
        trustCardFooter: "Gia nhập cộng đồng an sinh thịnh vượng ngay hôm nay.",
        appCardTitle: "Tải ứng dụng BHXH Sổ",
        appCardSubtitle: "Quản lý đóng phí, nhận thông báo nhắc lịch và tra cứu mọi lúc mọi nơi.",
        googlePlayLink: "#",
        appStoreLink: "#"
      };
  
  const [searchCode, setSearchCode] = useState('');
  const [searchType, setSearchType] = useState<'BHXH' | 'BHYT'>('BHXH');
  const [renewCode, setRenewCode] = useState('');
  const [renewType, setRenewType] = useState<'BHXH' | 'BHYT'>('BHXH');
  
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerType, setRegisterType] = useState<'BHXH' | 'BHYT'>('BHXH');
  const [registerRecord, setRegisterRecord] = useState<any | null>(null);
  const [isRenew, setIsRenew] = useState(false);
  const [registerInitialData, setRegisterInitialData] = useState<any>(null);

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchResult, setSearchResult] = useState<any[]>([]);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetTrigger, setCaptchaResetTrigger] = useState(0);

  const triggerNewCaptcha = () => {
    setCaptchaToken('');
    setCaptchaResetTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (globalRegisterModal.isOpen) {
      openRegisterModal(globalRegisterModal.type);
      setGlobalRegisterModal({ isOpen: false, type: 'BHXH' });
    }
  }, [globalRegisterModal, setGlobalRegisterModal]);

  // Handle scroll navigation anchors from other pages or same page
  useEffect(() => {
    if (location.state && (location.state as any).scrollTo) {
      const anchor = (location.state as any).scrollTo;
      const element = document.getElementById(anchor);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const input = document.getElementById(`${anchor}-input`);
          if (input) input.focus();
        }, 300);
      }
    }
  }, [location]);

  const handleSearchProcess = async () => {
    const code = searchCode.trim();
    if (!code) {
      showAlert("Thiếu thông tin", "Vui lòng nhập mã số BHXH hoặc số CCCD để thực hiện tra cứu.", "info");
      return;
    }

    const currentToken = captchaToken;
    triggerNewCaptcha(); // Tự động reset token để sẵn sàng cho lần tra cứu tiếp theo không cần F5

    try {
      // Gọi RPC public_lookup_process bảo mật (Zero-PII Timeline)
      const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
      if (siteKey && !currentToken) throw new Error('Vui lòng đợi vài giây để hoàn thành xác minh bảo mật rồi bấm lại.');
      const processHistory = await callPublicPortal<any[]>('lookup', { code, type: searchType }, currentToken);

      if (!processHistory || processHistory.length === 0) {
        showAlert("Không có dữ liệu", `Không tìm thấy dữ liệu quá trình tham gia ${searchType} cho mã số này trên hệ thống.`, "warning");
        return;
      }

      // Map dữ liệu đầy đủ sang giao diện SearchResultModal
      const mappedHistory = processHistory.map((r: any) => ({
        id: r.id,
        name: r.name || r.masked_name || 'Khách hàng',
        cccd: r.cccd || r.masked_cccd || '',
        bhxh: r.bhxh || '',
        type: r.type || searchType,
        fromMonth: r.fromMonth || r.from_month || r.frommonth || '',
        toMonth: r.toMonth || r.to_month || r.tomonth || '',
        from_month: r.fromMonth || r.from_month || r.frommonth || '',
        to_month: r.toMonth || r.to_month || r.tomonth || '',
        months: Number(r.months) || 1,
        method: r.method || (r.months ? (r.months === 1 ? 'Đóng hằng tháng' : `Đóng ${r.months} tháng`) : ''),
        income: Number(r.income) || 0,
        amount: Number(r.amount) || 0,
        nextPayment: r.nextPayment || r.next_payment || r.nextpayment || '',
        next_payment: r.nextPayment || r.next_payment || r.nextpayment || '',
        status: r.status || 'Đang tham gia',
        paymentStatus: r.paymentStatus || r.payment_status || r.paymentstatus || 'Đã thu tiền',
        payment_status: r.paymentStatus || r.payment_status || r.paymentstatus || 'Đã thu tiền',
        actionType: r.actionType || r.action_type || '',
        action_type: r.actionType || r.action_type || '',
        date: r.date || r.registration_date || '',
        notes: r.notes || r.note || ''
      }));

      setSearchResult(mappedHistory);
      setIsSearchModalOpen(true);
    } catch (error: any) {
      console.error("Search error:", error);
      showAlert("Lỗi", error.message || "Đã xảy ra lỗi khi tra cứu thông tin.", "error");
    }
  };

  const handleFastRenew = async () => {
    const code = renewCode.trim();
    if (!code) {
      showAlert("Thiếu thông tin", "Vui lòng nhập mã BHXH hoặc số CCCD để thực hiện gia hạn nhanh.", "info");
      return;
    }
    
    const currentToken = captchaToken;
    triggerNewCaptcha(); // Tự động reset token để sẵn sàng cho lần gia hạn tiếp theo không cần F5

    try {
      // Lấy thông tin hợp đồng gần nhất để hiển thị đầy đủ tên, kỳ đóng và tự động tính kỳ tiếp theo
      const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
      if (siteKey && !currentToken) throw new Error('Vui lòng đợi vài giây để hoàn thành xác minh bảo mật rồi bấm lại.');
      const renewalList = await callPublicPortal<any[]>('renewal_info', { code, type: renewType }, currentToken);

      if (renewalList && renewalList.length > 0 && renewalList[0]) {
        const rawCustomer = renewalList[0];
        const existingCustomer = {
          ...rawCustomer,
          fromMonth: rawCustomer.fromMonth || rawCustomer.frommonth || rawCustomer.from_month || '',
          toMonth: rawCustomer.toMonth || rawCustomer.tomonth || rawCustomer.to_month || '',
          recvName: rawCustomer.recvName || rawCustomer.recvname || rawCustomer.recv_name || '',
          recvPhone: rawCustomer.recvPhone || rawCustomer.recvphone || rawCustomer.recv_phone || '',
          recvAddress: rawCustomer.recvAddress || rawCustomer.recvaddress || rawCustomer.recv_address || '',
        };
        openRegisterModal(renewType, existingCustomer, true);
      } else {
        showAlert("Không tìm thấy", `Không tìm thấy thông tin hợp đồng ${renewType} đang có hiệu lực để gia hạn. Bạn có thể đăng ký mới.`, "warning");
      }
    } catch (error: any) {
      console.error("Renew error:", error);
      showAlert("Lỗi", error?.message || "Đã xảy ra lỗi khi tìm kiếm thông tin.", "error");
    }
  };

  const openRegisterModal = (type: 'BHXH' | 'BHYT', record: any | null = null, renew: boolean = false, initialData: any = null) => {
    setRegisterType(type);
    setRegisterRecord(record);
    setIsRenew(renew);
    setRegisterInitialData(initialData);
    setIsRegisterModalOpen(true);
  };

  return (
    <div className="transition-opacity duration-300 flex-1 flex flex-col justify-between w-full">
      <Helmet>
        <title>Đại lý thu BHXH Sông Mã - Dịch vụ BHXH & BHYT Trực tuyến</title>
        <meta name="description" content="Nền tảng tra cứu, tính phí, đăng ký mới và gia hạn Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình trực tuyến chính thức của Đại lý thu BHXH Sông Mã." />
        <meta property="og:title" content="Đại lý thu BHXH Sông Mã - Dịch vụ BHXH & BHYT Trực tuyến" />
        <meta property="og:description" content="Nền tảng tra cứu, tính phí, đăng ký mới và gia hạn Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình trực tuyến chính thức của Đại lý thu BHXH Sông Mã." />
      </Helmet>
      {/* Modern Hero Section */}
      <section className="relative flex-1 flex flex-col justify-start lg:justify-center hero-gradient text-white py-8 sm:py-12 lg:py-16 overflow-hidden">
        {/* Decorative Blobs */}
        <div className="blob-shape bg-[#22c55e] w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] -top-40 -left-40 pointer-events-none"></div>
        <div className="blob-shape bg-[#0EA5E9] w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] -bottom-60 -right-20 pointer-events-none"></div>

        {/* Subtle Decorative Blurred Circular Motifs (Họa tiết vòng tròn mờ tinh tế) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {/* Cụm 1: Vòng tròn mờ phía trên bên trái (phía sau khối Tiêu đề Hero) */}
          <div className="absolute -top-32 -left-20 sm:-top-40 sm:-left-24 w-[380px] sm:w-[560px] h-[380px] sm:h-[560px] rounded-full border border-white/[0.08] pointer-events-none"></div>
          <div className="absolute -top-20 -left-10 sm:-top-28 sm:-left-12 w-[280px] sm:w-[420px] h-[280px] sm:h-[420px] rounded-full border border-emerald-400/[0.12] border-dashed pointer-events-none"></div>
          <div className="absolute -top-8 left-0 sm:-top-14 sm:-left-2 w-[190px] sm:w-[290px] h-[190px] sm:h-[290px] rounded-full border border-white/[0.1] pointer-events-none"></div>
          <div className="absolute top-10 left-14 sm:top-12 sm:left-20 w-36 sm:w-48 h-36 sm:h-48 rounded-full bg-emerald-400/[0.12] blur-2xl pointer-events-none"></div>

          {/* Cụm 2: Vòng tròn mờ phía trên bên phải (phía sau khối thẻ Tra cứu & Gia hạn) */}
          <div className="absolute -top-24 -right-24 sm:-top-32 sm:-right-20 w-[420px] sm:w-[620px] h-[420px] sm:h-[620px] rounded-full border border-white/[0.07] pointer-events-none"></div>
          <div className="absolute -top-12 -right-12 sm:-top-16 sm:-right-8 w-[320px] sm:w-[480px] h-[320px] sm:h-[480px] rounded-full border border-sky-400/[0.12] pointer-events-none"></div>
          <div className="absolute top-4 right-0 sm:top-2 sm:right-6 w-[220px] sm:w-[340px] h-[220px] sm:h-[340px] rounded-full border border-white/[0.1] border-dashed pointer-events-none"></div>
          <div className="absolute top-16 right-12 sm:top-18 sm:right-20 w-[140px] sm:w-[220px] h-[140px] sm:h-[220px] rounded-full border border-cyan-300/[0.14] pointer-events-none"></div>
          <div className="absolute top-20 right-16 sm:top-20 sm:right-24 w-40 sm:w-56 h-40 sm:h-56 rounded-full bg-sky-400/[0.12] blur-2xl pointer-events-none"></div>

          {/* Cụm 3: Vòng tròn mờ trung tâm & đáy banner */}
          <div className="absolute -bottom-36 left-1/2 -translate-x-1/2 w-[340px] sm:w-[520px] h-[340px] sm:h-[520px] rounded-full border border-white/[0.06] pointer-events-none"></div>
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[240px] sm:w-[380px] h-[240px] sm:h-[380px] rounded-full border border-teal-300/[0.1] border-dashed pointer-events-none"></div>
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[160px] sm:w-[260px] h-[160px] sm:h-[260px] rounded-full border border-white/[0.08] pointer-events-none"></div>
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-44 sm:w-64 h-44 sm:h-64 rounded-full bg-teal-400/[0.09] blur-2xl pointer-events-none"></div>
        </div>
        
        <div className="relative z-10 max-w-[1360px] mx-auto px-4 sm:px-8 lg:px-12 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start lg:items-center py-2 sm:py-4">
          <div className="lg:col-span-7 flex flex-col items-start gap-4 sm:gap-6 lg:gap-7">
            <div className="inline-flex items-center gap-2 sm:gap-3 bg-white/10 px-3.5 sm:px-4.5 py-2 sm:py-2.5 rounded-xl border border-white/20 backdrop-blur-sm shadow-sm">
              <span className="material-symbols-outlined text-secondary-bright fill-icon text-sm sm:text-base">verified</span>
              <span className="text-[11px] sm:text-sm font-bold tracking-[0.08em] sm:tracking-[0.1em] uppercase">{homepageConfig.heroTagline || "Hệ Thống Chuẩn Nghị Định 159/2025"}</span>
            </div>
            
            <h1 className="font-display text-2xl sm:text-4xl lg:text-6xl font-black leading-[1.2] tracking-tight text-white">
              {homepageConfig.heroTitleWhite || "An Tâm Hơn"} <br />
              <span className="text-secondary-bright">{homepageConfig.heroTitleGreen || "Vững Bước Tương Lai."}</span>
            </h1>
            
            <p className="font-body text-sm sm:text-lg lg:text-xl text-white/85 max-w-2xl leading-relaxed font-medium">
              {homepageConfig.heroSubtitle || "Sổ BHXH điện tử thế hệ mới - Giải pháp an sinh thông minh, minh bạch và an toàn tuyệt đối cho mọi gia đình Việt."}
            </p>
            
            <div className="flex flex-wrap gap-2.5 sm:gap-3.5 w-full sm:w-auto pt-1 sm:pt-2">
              <button 
                onClick={() => openRegisterModal('BHXH')}
                className="bg-white text-primary px-6 sm:px-7 py-3 sm:py-4 rounded-2xl font-black text-xs sm:text-base flex items-center justify-center gap-2 hover:bg-secondary-bright hover:text-primary-dark transition-all active:scale-95 cursor-pointer shadow-lg flex-1 sm:flex-none whitespace-nowrap"
              >
                <span>ĐĂNG KÝ NGAY</span>
                <span className="material-symbols-outlined font-bold text-lg sm:text-xl">arrow_forward</span>
              </button>
              <button 
                onClick={() => navigate('/bhxh1lan')}
                className="glass-card text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm hover:bg-white/20 transition-all border-white/30 cursor-pointer shadow-md text-center flex-1 sm:flex-none whitespace-nowrap"
              >
                Tính BHXH 1 lần
              </button>
              <button 
                onClick={() => navigate('/tro-ly-huu-tri')}
                className="glass-card text-amber-300 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-extrabold text-xs sm:text-sm hover:bg-white/20 transition-all border-white/30 cursor-pointer flex items-center justify-center gap-1.5 shadow-md w-full sm:w-auto whitespace-nowrap"
              >
                <span className="text-sm sm:text-base">✨</span> Trợ Lý Hưu Trí
              </button>
            </div>
          </div>
          {/* 2 Action Cards (Right Column) - Tra cứu & Gia hạn Stacked */}
          <div className="lg:col-span-5 w-full lg:max-w-md ml-auto flex flex-col gap-5 sm:gap-6">
            <div className="bg-white/95 rounded-xl p-3 shadow-lg">
              <TurnstileCaptcha onToken={setCaptchaToken} resetTrigger={captchaResetTrigger} />
            </div>
            {/* Card 1: Tra cứu quá trình */}
            <div className="glass-card p-6 sm:p-7 lg:p-8 rounded-[2.2rem] relative overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl space-y-5">
              <span className="material-symbols-outlined absolute top-6 right-6 text-white/15 text-3xl pointer-events-none">manage_search</span>
              
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/15 text-white flex items-center justify-center shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-2xl sm:text-3xl">search</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">Tra cứu quá trình</h3>
                  <p className="text-xs sm:text-sm text-white/70 font-medium mt-1">Cập nhật lịch sử đóng BHXH/BHYT</p>
                </div>
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-white text-xs sm:text-sm font-bold">
                  <input 
                    type="radio" 
                    name="lookup-type" 
                    checked={searchType === 'BHXH'} 
                    onChange={() => setSearchType('BHXH')}
                    className="w-4.5 h-4.5 text-blue-500 bg-white/10 border-white/30 focus:ring-blue-400 transition-all cursor-pointer" 
                  />
                  <span>BHXH</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-white text-xs sm:text-sm font-bold">
                  <input 
                    type="radio" 
                    name="lookup-type" 
                    checked={searchType === 'BHYT'} 
                    onChange={() => setSearchType('BHYT')}
                    className="w-4.5 h-4.5 text-blue-500 bg-white/10 border-white/30 focus:ring-blue-400 transition-all cursor-pointer" 
                  />
                  <span>BHYT</span>
                </label>
              </div>

              <div className="relative">
                <input 
                  id="search-process-input"
                  type="text" 
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchProcess()}
                  className="w-full bg-white text-slate-900 font-bold rounded-2xl py-4 sm:py-4.5 pl-6 pr-20 focus:ring-4 focus:ring-blue-400/30 border-none shadow-inner outline-none text-sm sm:text-base" 
                  placeholder="Mã số BHXH / CCCD..." 
                />
                <button 
                  onClick={handleSearchProcess}
                  className="absolute right-2 top-2 bottom-2 px-5 bg-[#004182] hover:bg-blue-900 text-white font-bold rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer text-xs sm:text-sm"
                >
                  <span className="material-symbols-outlined text-white text-xl">search</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-white/85 font-medium pt-0.5">
                <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span>
                <span>Bảo mật dữ liệu theo NĐ 13/2023/NĐ-CP</span>
              </div>
            </div>

            {/* Card 2: Gia hạn thần tốc */}
            <div className="glass-card p-6 sm:p-7 lg:p-8 rounded-[2.2rem] relative overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl space-y-5">
              <span className="material-symbols-outlined absolute top-6 right-6 text-white/15 text-3xl pointer-events-none">payments</span>

              <div className="flex items-center gap-4">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white/10 border border-white/15 text-white flex items-center justify-center shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-2xl sm:text-3xl">history</span>
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">Gia hạn thần tốc</h3>
                  <p className="text-xs sm:text-sm text-white/70 font-medium mt-1">Đóng nối tiếp, không gián đoạn</p>
                </div>
              </div>

              <div className="flex gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-white text-xs sm:text-sm font-bold">
                  <input 
                    type="radio" 
                    name="renew-type" 
                    checked={renewType === 'BHXH'} 
                    onChange={() => setRenewType('BHXH')}
                    className="w-4.5 h-4.5 text-blue-500 bg-white/10 border-white/30 focus:ring-blue-400 transition-all cursor-pointer" 
                  />
                  <span>BHXH</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-white text-xs sm:text-sm font-bold">
                  <input 
                    type="radio" 
                    name="renew-type" 
                    checked={renewType === 'BHYT'} 
                    onChange={() => setRenewType('BHYT')}
                    className="w-4.5 h-4.5 text-blue-500 bg-white/10 border-white/30 focus:ring-blue-400 transition-all cursor-pointer" 
                  />
                  <span>BHYT</span>
                </label>
              </div>

              <div className="relative">
                <input 
                  id="renew-online-input"
                  type="text" 
                  value={renewCode}
                  onChange={(e) => setRenewCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFastRenew()}
                  className="w-full bg-white text-slate-900 font-bold rounded-2xl py-4 sm:py-4.5 pl-6 pr-28 focus:ring-4 focus:ring-emerald-400/30 border-none shadow-inner outline-none text-sm sm:text-base" 
                  placeholder="Nhập mã số cần đóng..." 
                />
                <button 
                  onClick={handleFastRenew}
                  className="absolute right-2 top-2 bottom-2 px-5 bg-[#10b981] hover:bg-[#059669] text-slate-950 font-black rounded-xl flex items-center justify-center transition-all shadow-md cursor-pointer text-xs sm:text-sm"
                >
                  Gia hạn
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-white/85 font-medium pt-0.5">
                <span className="material-symbols-outlined text-emerald-400 text-sm">verified_user</span>
                <span>Bảo mật dữ liệu theo NĐ 13/2023/NĐ-CP</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />

      {isRegisterModalOpen && (
        <RegisterModal 
          isOpen={isRegisterModalOpen} 
          onClose={() => setIsRegisterModalOpen(false)} 
          type={registerType} 
          record={registerRecord} 
          isRenew={isRenew} 
          initialData={registerInitialData}
        />
      )}

      {isSearchModalOpen && (
        <SearchResultModal 
          isOpen={isSearchModalOpen} 
          onClose={() => setIsSearchModalOpen(false)} 
          results={searchResult} 
          searchCode={searchCode} 
        />
      )}
    </div>
  );
};

export default LandingView;
