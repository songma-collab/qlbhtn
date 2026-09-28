import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import BHXH1LanCalc from './calculators/BHXH1LanCalc';

const BHXH1LanView = () => {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>Tính BHXH 1 Lần & Lương Hưu Dự Kiến 2026 | Đại lý thu BHXH Sông Mã</title>
        <meta name="description" content="Công cụ trực tuyến hỗ trợ người lao động ước tính chính xác số tiền Bảo hiểm xã hội 1 lần được nhận hoặc lương hưu dự kiến theo hệ số trượt giá mới nhất." />
        <meta property="og:title" content="Tính BHXH 1 Lần & Lương Hưu Dự Kiến 2026 | Đại lý thu BHXH Sông Mã" />
        <meta property="og:description" content="Công cụ trực tuyến hỗ trợ người lao động ước tính chính xác số tiền Bảo hiểm xã hội 1 lần được nhận hoặc lương hưu dự kiến theo hệ số trượt giá mới nhất." />
      </Helmet>

      <main className="max-w-[1360px] mx-auto px-4 sm:px-8 lg:px-12 pt-8 pb-12 transition-opacity duration-300">
        {/* Switcher Tab Header */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-200/70 p-1.5 rounded-2xl flex items-center gap-1.5 border border-gray-300/60 shadow-inner">
            <button
              onClick={() => navigate('/bhxh1lan')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-[#004182] text-white shadow transition cursor-pointer border-none"
            >
              Tính BHXH 1 lần
            </button>
            <button
              onClick={() => navigate('/tro-ly-huu-tri')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-gray-600 hover:text-gray-900 hover:bg-white/60 transition cursor-pointer border-none flex items-center gap-1.5"
            >
              <span>✨</span> Trợ Lý Hưu Trí
            </button>
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4 text-[#004182]">
            Tính Bảo Hiểm Xã Hội Một Lần, Lương hưu dự kiến
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">
            Công cụ hỗ trợ người lao động ước tính chính xác số tiền BHXH 1 lần được nhận hoặc tiền lương hưu dự kiến căn cứ theo thời gian và quá trình tham gia.
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6 lg:p-10 mb-8">
          <BHXH1LanCalc />
        </div>
      </main>
    </>
  );
};

export default BHXH1LanView;
