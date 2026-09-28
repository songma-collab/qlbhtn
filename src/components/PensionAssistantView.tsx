import { Helmet } from 'react-helmet-async';
import PensionAssistant from './calculators/PensionAssistant';
import { useNavigate } from 'react-router-dom';

const PensionAssistantView = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Trợ Lý Hưu Trí - Dự Phóng & Gợi Ý Mức Đóng Tối Ưu 2026 | Đại lý thu BHXH Sông Mã</title>
        <meta name="description" content="Thuật toán thông minh phân tích lộ trình đóng BHXH Tự Nguyện để đạt mức lương hưu mong muốn mà không gây áp lực tài chính." />
        <meta property="og:title" content="Trợ Lý Hưu Trí - Dự Phóng & Gợi Ý Mức Đóng Tối Ưu 2026 | Đại lý thu BHXH Sông Mã" />
        <meta property="og:description" content="Thuật toán thông minh phân tích lộ trình đóng BHXH Tự Nguyện để đạt mức lương hưu mong muốn mà không gây áp lực tài chính." />
      </Helmet>

      <main className="max-w-[1360px] mx-auto px-4 sm:px-8 lg:px-12 pt-8 pb-12 transition-opacity duration-300">
        {/* Switcher Tab Header */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 border border-gray-300/60 shadow-inner">
            <button
              onClick={() => navigate('/bhxh1lan')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-gray-600 hover:text-gray-900 hover:bg-white/60 transition cursor-pointer border-none"
            >
              Tính BHXH 1 lần
            </button>
            <button
              onClick={() => navigate('/tro-ly-huu-tri')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#004182] text-white shadow transition cursor-pointer border-none flex items-center gap-1.5"
            >
              <span>✨</span> Trợ Lý Hưu Trí
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 lg:p-10 mb-8">
          <PensionAssistant />
        </div>
      </main>
    </>
  );
};

export default PensionAssistantView;
