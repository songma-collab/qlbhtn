import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  FileText, 
  Shield, 
  HeartPulse, 
  CreditCard, 
  ChevronRight,
  Info,
  ArrowUpRight,
  MessageSquare,
  PlayCircle,
  HelpCircle,
  BookOpen,
  Lock
} from 'lucide-react';
import Footer from './Footer';
import { Helmet } from 'react-helmet-async';

const SupportView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'about', label: 'Về chúng tôi', icon: <Info size={18} /> },
    { id: 'payment_process', label: 'Quy trình đóng phí', icon: <ArrowUpRight size={18} /> },
    { id: 'register', label: 'Hướng dẫn đăng ký', icon: <FileText size={18} /> },
    { id: 'bhxh', label: 'Quyền lợi BHXH', icon: <Shield size={18} /> },
    { id: 'bhyt', label: 'Quyền lợi BHYT', icon: <HeartPulse size={18} /> },
    { id: 'reissue', label: 'Cấp lại sổ, thẻ', icon: <CreditCard size={18} /> },
    { id: 'help_center', label: 'Trung tâm trợ giúp', icon: <MessageSquare size={18} /> },
    { id: 'videos', label: 'Video hướng dẫn', icon: <PlayCircle size={18} /> },
    { id: 'faqs', label: 'Câu hỏi thường gặp', icon: <HelpCircle size={18} /> },
    { id: 'terms', label: 'Điều khoản sử dụng', icon: <BookOpen size={18} /> },
    { id: 'privacy', label: 'Bảo mật dữ liệu', icon: <Lock size={18} /> },
  ];

  return (
    <>
      <Helmet>
        <title>Trung Tâm Trợ Giúp & Hướng Dẫn | Đại lý thu BHXH Sông Mã</title>
        <meta name="description" content="Hướng dẫn tham gia Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình, giải đáp thắc mắc và liên hệ hotline Đại lý thu BHXH Sông Mã." />
        <meta property="og:title" content="Trung Tâm Trợ Giúp & Hướng Dẫn | Đại lý thu BHXH Sông Mã" />
        <meta property="og:description" content="Hướng dẫn tham gia Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình, giải đáp thắc mắc và liên hệ hotline Đại lý thu BHXH Sông Mã." />
      </Helmet>
      <div className="max-w-[1360px] mx-auto px-6 pt-12 pb-12 sm:px-10 lg:px-12 text-left">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Hỗ Trợ Khách Hàng</h2>
          <p className="text-slate-600 max-w-2xl mx-auto font-medium">
            Giải đáp thắc mắc, hướng dẫn thủ tục và cung cấp thông tin chi tiết về các dịch vụ và quyền lợi bảo hiểm của bạn.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-72 shrink-0">
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-2 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto custom-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all mb-1 cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-[#004182] font-bold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={activeTab === tab.id ? 'text-[#004182]' : 'text-slate-400'}>
                      {tab.icon}
                    </span>
                    <span className="text-sm">{tab.label}</span>
                  </div>
                  {activeTab === tab.id && <ChevronRight size={16} className="text-[#004182]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 bg-white rounded-2xl shadow-xs border border-slate-200 p-6 md:p-10">
            {/* Về chúng tôi */}
            {activeTab === 'about' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Info className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Về Chúng Tôi - Đại lý thu Sông Mã</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium">
                  <strong>Đại lý thu Sông Mã</strong> là nền tảng an sinh số tiên phong tại Việt Nam, ra đời với mục tiêu mang đến giải pháp tối ưu hóa việc quản lý và tham gia Bảo hiểm xã hội tự nguyện và Bảo hiểm y tế hộ gia đình cho mọi người dân.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-2 text-base">Sứ mệnh của chúng tôi</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Số hóa toàn diện các thủ tục bảo hiểm, đưa chính sách an sinh xã hội tiếp cận gần hơn với người dân mọi lúc mọi nơi một cách nhanh chóng, minh bạch và an toàn nhất.
                    </p>
                  </div>
                  <div className="bg-blue-50/30 border border-blue-100/50 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-2 text-base">Tầm nhìn chiến lược</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Trở thành đại lý an sinh số tin cậy hàng đầu Việt Nam, đồng hành cùng hàng triệu gia đình xây dựng một tương lai an nhàn, đảm bảo tài chính tuổi già.
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 mb-4 text-lg">Giá trị cốt lõi</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                    <div className="p-4 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50">
                      <div className="font-black text-[#004182] text-lg mb-1">Minh Bạch</div>
                      <div className="text-xs text-gray-500">Mọi tính toán, hóa đơn rõ ràng</div>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50">
                      <div className="font-black text-[#004182] text-lg mb-1">An Toàn</div>
                      <div className="text-xs text-gray-500">Mã hóa bảo mật thông tin tối đa</div>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50">
                      <div className="font-black text-[#004182] text-lg mb-1">Tận Tâm</div>
                      <div className="text-xs text-gray-500">Đội ngũ hỗ trợ nhiệt tình 24/7</div>
                    </div>
                    <div className="p-4 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50">
                      <div className="font-black text-[#004182] text-lg mb-1">Tiện Lợi</div>
                      <div className="text-xs text-gray-500">Thao tác trực tuyến trong vài phút</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quy trình đóng phí */}
            {activeTab === 'payment_process' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <ArrowUpRight className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Quy trình đóng phí an toàn</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium">
                  Hệ thống hỗ trợ đóng phí BHXH Tự nguyện và BHYT Hộ gia đình trực tuyến hoàn toàn bảo mật và nhanh chóng qua các bước sau:
                </p>

                <div className="space-y-4 pt-4">
                  <div className="flex gap-4 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shrink-0">1</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Khai báo & Tính phí</h4>
                      <p className="text-gray-600 text-sm">Sử dụng công cụ tính để chọn mức thu nhập làm căn cứ đóng (với BHXH) hoặc số lượng thành viên (với BHYT) để hệ thống tự động áp dụng chính sách giảm trừ/hỗ trợ.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shrink-0">2</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Xác nhận thông tin hồ sơ</h4>
                      <p className="text-gray-600 text-sm">Điền đầy đủ thông tin định danh cá nhân (Họ tên, CCCD, Số điện thoại, địa chỉ). Đảm bảo thông tin trùng khớp với cơ sở dữ liệu quốc gia.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shrink-0">3</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Thanh toán an toàn qua QR</h4>
                      <p className="text-gray-600 text-sm">Sử dụng tính năng quét mã QR thanh toán nhanh bằng ngân hàng của bạn. Hệ thống tự động ghi nhận giao dịch tức thời và gửi biên lai xác nhận điện tử.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shrink-0">4</div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-base mb-1">Đồng bộ cơ quan Bảo hiểm & Nhận kết quả</h4>
                      <p className="text-gray-600 text-sm">Hồ sơ được cập nhật lên hệ thống cơ quan Bảo hiểm Xã hội Việt Nam. Thời gian ghi nhận trực tuyến từ 3-5 ngày làm việc. Quý khách có thể kiểm tra trực tiếp qua ứng dụng VssID.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hướng dẫn đăng ký */}
            {activeTab === 'register' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <FileText className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Hướng dẫn đăng ký đóng mới</h3>
                </div>
                <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                  Để đăng ký tham gia Bảo hiểm xã hội (BHXH) tự nguyện hoặc Bảo hiểm y tế (BHYT) hộ gia đình lần đầu, quý khách vui lòng thực hiện theo các bước sau:
                </p>

                <div className="space-y-6">
                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Bước 1: Chuẩn bị hồ sơ</h4>
                    <ul className="list-disc list-inside text-gray-700 space-y-2 text-sm font-semibold">
                      <li>Bản sao Chứng minh nhân dân (CMND) hoặc Căn cước công dân (CCCD) còn hạn sử dụng.</li>
                      <li>Sổ hộ khẩu hoặc Giấy tạm trú (đối với BHYT hộ gia đình).</li>
                      <li>Mã số BHXH (nếu đã từng tham gia trước đây).</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Bước 2: Lựa chọn mức đóng và phương thức đóng</h4>
                    <ul className="list-disc list-inside text-gray-700 space-y-3 text-sm font-semibold">
                      <li>
                        <span className="font-bold text-gray-900">BHXH tự nguyện:</span> Lựa chọn mức thu nhập tháng làm căn cứ đóng (từ mức chuẩn nghèo khu vực nông thôn đến 20 lần mức lương cơ sở). Chọn phương thức đóng: hàng tháng, 3 tháng, 6 tháng, 12 tháng, hoặc đóng một lần cho nhiều năm về sau.
                      </li>
                      <li>
                        <span className="font-bold text-gray-900">BHYT hộ gia đình:</span> Đóng theo năm (12 tháng). Mức đóng giảm dần từ thành viên thứ 2 trở đi.
                      </li>
                    </ul>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Bước 3: Đăng ký và nộp tiền</h4>
                    <p className="text-gray-700 text-sm leading-relaxed font-semibold">
                      Quý khách có thể đăng ký trực tiếp trên hệ thống bằng cách nhấn nút <strong>"Đăng Ký Ngay"</strong> trên trang chủ, điền đầy đủ thông tin và thực hiện thanh toán chuyển khoản theo hướng dẫn. Đại lý sẽ xử lý hồ sơ và cấp biên lai điện tử ngay sau khi nhận được thanh toán.
                    </p>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Bước 4: Nhận sổ BHXH / Thẻ BHYT</h4>
                    <p className="text-gray-700 text-sm leading-relaxed font-semibold">
                      Sau khi hồ sơ được cơ quan BHXH phê duyệt (thường từ 3-5 ngày làm việc), quý khách sẽ nhận được thông báo. Sổ BHXH và Thẻ BHYT (bản cứng) sẽ được gửi về địa chỉ đã đăng ký, hoặc quý khách có thể sử dụng hình ảnh thẻ trên ứng dụng VssID.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Quyền lợi BHXH */}
            {activeTab === 'bhxh' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <Shield className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Quyền lợi BHXH Tự nguyện</h3>
                </div>
                <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                  Người tham gia Bảo hiểm xã hội tự nguyện được hưởng các quyền lợi thiết thực sau:
                </p>
                <div className="space-y-4 text-gray-700 text-sm">
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">1. Chế độ hưu trí</h4>
                    <p className="font-medium text-gray-600">Được hưởng lương hưu hàng tháng khi đủ điều kiện về tuổi đời và thời gian đóng BHXH (đóng đủ 15 năm theo quy định mới).</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">2. Cấp thẻ BHYT miễn phí</h4>
                    <p className="font-medium text-gray-600">Được cấp thẻ BHYT miễn phí trong suốt thời gian hưởng lương hưu với mức hưởng 95% chi phí khám chữa bệnh.</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">3. Chế độ tử tuất</h4>
                    <p className="font-medium text-gray-600">Người lo mai táng được nhận trợ cấp mai táng bằng 10 lần mức lương cơ sở. Thân nhân được hưởng trợ cấp tuất một lần.</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">4. Chế độ thai sản</h4>
                    <p className="font-medium text-gray-600">Theo Luật BHXH mới, người tham gia BHXH tự nguyện được bổ sung chế độ trợ cấp thai sản (áp dụng theo quy định cụ thể của pháp luật).</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quyền lợi BHYT */}
            {activeTab === 'bhyt' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <HeartPulse className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Quyền lợi BHYT Hộ gia đình</h3>
                </div>
                <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                  Tham gia BHYT hộ gia đình giúp giảm bớt gánh nặng tài chính khi ốm đau, bệnh tật.
                </p>
                <div className="space-y-4 text-gray-700 text-sm">
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">1. Khám chữa bệnh đúng tuyến</h4>
                    <p className="font-medium text-gray-600">Được quỹ BHYT thanh toán 80% chi phí khám bệnh, chữa bệnh trong phạm vi được hưởng.</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">2. Khám chữa bệnh trái tuyến</h4>
                    <p className="font-medium text-gray-600">Được thanh toán 40% chi phí điều trị nội trú tại bệnh viện tuyến trung ương; 100% chi phí điều trị nội trú tại bệnh viện tuyến tỉnh; 100% chi phí tại bệnh viện tuyến huyện.</p>
                  </div>
                  <div className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                    <h4 className="font-bold text-[#004182] mb-2">3. Tham gia 5 năm liên tục</h4>
                    <p className="font-medium text-gray-600">Người tham gia BHYT 5 năm liên tục trở lên và có số tiền cùng chi trả chi phí KCB trong năm lớn hơn 6 tháng lương cơ sở sẽ được hưởng 100% chi phí KCB.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cấp lại sổ, thẻ */}
            {activeTab === 'reissue' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <CreditCard className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Cấp lại sổ BHXH, thẻ BHYT</h3>
                </div>
                <p className="text-gray-600 mb-8 leading-relaxed font-medium">
                  Trường hợp bị mất, hỏng sổ BHXH hoặc thẻ BHYT, quý khách có thể yêu cầu cấp lại theo hướng dẫn sau:
                </p>
                <div className="space-y-6 text-gray-700 text-sm">
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Cách 1: Thực hiện qua ứng dụng VssID</h4>
                    <p className="mb-2 font-medium text-gray-600">Đây là cách nhanh chóng và thuận tiện nhất:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2 font-semibold text-gray-700">
                      <li>Đăng nhập vào ứng dụng VssID trên điện thoại.</li>
                      <li>Chọn mục <strong>Dịch vụ công</strong>.</li>
                      <li>Chọn <strong>Cấp lại sổ BHXH không thay đổi thông tin</strong> hoặc <strong>Cấp lại thẻ BHYT do hỏng, mất</strong>.</li>
                      <li>Điền địa chỉ nhận kết quả (qua bưu điện) và xác nhận.</li>
                    </ol>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Cách 2: Thực hiện qua Cổng Dịch vụ công</h4>
                    <p className="mb-2 font-medium text-gray-600">Truy cập Cổng Dịch vụ công của BHXH Việt Nam (dichvucong.baohiemxahoi.gov.vn) hoặc Cổng Dịch vụ công Quốc gia, đăng nhập và thực hiện thủ tục cấp lại.</p>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                    <h4 className="font-bold text-[#004182] mb-3">Cách 3: Nộp hồ sơ trực tiếp</h4>
                    <p className="font-medium text-gray-600">Quý khách có thể đến trực tiếp cơ quan BHXH nơi đang tham gia hoặc đại lý thu để nộp Tờ khai tham gia, điều chỉnh thông tin BHXH, BHYT (Mẫu TK1-TS).</p>
                  </div>
                </div>
              </div>
            )}

            {/* Trung tâm trợ giúp */}
            {activeTab === 'help_center' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <MessageSquare className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Trung tâm trợ giúp BHXH</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium">
                  Quý khách cần hỗ trợ giải đáp thắc mắc liên quan tới quy trình đăng ký, xử lý hồ sơ, hoặc kỹ thuật thanh toán trực tuyến? Vui lòng liên hệ với các kênh sau:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="border border-gray-100 shadow-sm rounded-2xl p-6 space-y-3">
                    <div className="font-bold text-gray-900 text-lg">Tổng đài BHXH Việt Nam</div>
                    <p className="text-gray-500 text-sm">Hỗ trợ chính sách bảo hiểm chính thống, giải đáp mã số BHXH và quá trình đóng.</p>
                    <div className="text-xl font-black text-primary">1900 9068</div>
                  </div>
                  <div className="border border-gray-100 shadow-sm rounded-2xl p-6 space-y-3">
                    <div className="font-bold text-gray-900 text-lg">Hotline Đại Lý Thu Sông Mã</div>
                    <p className="text-gray-500 text-sm">Hỗ trợ đăng ký, hoàn tất đóng phí trực tuyến nhanh 24/7.</p>
                    <div className="text-xl font-black text-[#22c55e]">0983 774 078</div>
                  </div>
                </div>

                <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100 mt-6">
                  <h4 className="font-bold text-gray-900 mb-2">Hỗ trợ qua Kênh Trực Tuyến</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Bạn có thể gửi thư về địa chỉ hòm thư điện tử <strong className="text-primary">bhxhtn1410@gmail.com</strong> để được hỗ trợ chuyên sâu hoặc trao đổi trực tiếp qua các mạng xã hội của chúng tôi ở phần cuối chân trang.
                  </p>
                </div>
              </div>
            )}

            {/* Video hướng dẫn */}
            {activeTab === 'videos' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <PlayCircle className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Video hướng dẫn & Thao tác</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium">
                  Tổng hợp các video hướng dẫn chi tiết các thao tác tham gia an sinh xã hội số:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-gray-50 group hover:shadow-md transition-all">
                    <div className="aspect-video bg-slate-800 flex items-center justify-center relative cursor-pointer">
                      <span className="material-symbols-outlined text-white/40 text-6xl group-hover:text-white group-hover:scale-110 transition-all">play_circle</span>
                    </div>
                    <div className="p-5 text-left">
                      <h4 className="font-bold text-gray-900 text-sm mb-1">Hướng dẫn đóng BHXH tự nguyện trực tuyến</h4>
                      <p className="text-gray-500 text-xs font-semibold">Thời lượng: 3:15 phút • Cập nhật: 2026</p>
                    </div>
                  </div>
                  
                  <div className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-gray-50 group hover:shadow-md transition-all">
                    <div className="aspect-video bg-slate-800 flex items-center justify-center relative cursor-pointer">
                      <span className="material-symbols-outlined text-white/40 text-6xl group-hover:text-white group-hover:scale-110 transition-all">play_circle</span>
                    </div>
                    <div className="p-5 text-left">
                      <h4 className="font-bold text-gray-900 text-sm mb-1">Cách tra cứu quá trình đóng trên ứng dụng VssID</h4>
                      <p className="text-gray-500 text-xs font-semibold">Thời lượng: 4:20 phút • Cập nhật: 2026</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Câu hỏi thường gặp */}
            {activeTab === 'faqs' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <HelpCircle className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Câu hỏi thường gặp (FAQs)</h3>
                </div>
                <p className="text-gray-600 leading-relaxed font-medium">
                  Giải đáp nhanh một số thắc mắc phổ biến nhất của người dân khi tham gia bảo hiểm trực tuyến:
                </p>

                <div className="space-y-4 pt-4">
                  <div className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <h4 className="font-bold text-gray-900 mb-2">Q: Đóng BHXH tự nguyện bao nhiêu năm thì được nhận lương hưu?</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      A: Theo quy định mới tại Luật BHXH 2024, thời gian đóng BHXH tối thiểu để hưởng chế độ hưu trí được rút ngắn xuống còn <strong>15 năm</strong> thay vì 20 năm như trước đây, nhằm tạo điều kiện cho người tham gia muộn dễ dàng tích lũy đủ số năm đóng để nhận lương hưu.
                    </p>
                  </div>
                  
                  <div className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <h4 className="font-bold text-gray-900 mb-2">Q: Đóng BHXH tự nguyện một lần cho nhiều năm về sau có được không?</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      A: Có, người tham gia có quyền lựa chọn phương thức đóng một lần cho nhiều năm về sau (tối đa 5 năm / 60 tháng) hoặc đóng một lần cho những năm còn thiếu để đủ điều kiện hưởng lương hưu.
                    </p>
                  </div>

                  <div className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50">
                    <h4 className="font-bold text-gray-900 mb-2">Q: Nếu bị mất thẻ BHYT giấy thì đi khám chữa bệnh như thế nào?</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      A: Bạn hoàn toàn có thể đi KCB bình thường bằng cách xuất trình <strong>Căn cước công dân gắn chíp</strong> hoặc sử dụng hình ảnh thẻ BHYT điện tử trên <strong>ứng dụng VssID</strong>. Cả hai hình thức này đều có giá trị pháp lý tương đương thẻ giấy.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Điều khoản sử dụng */}
            {activeTab === 'terms' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <BookOpen className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Điều khoản sử dụng dịch vụ</h3>
                </div>
                <div className="space-y-4 text-gray-600 text-sm leading-relaxed font-medium">
                  <p>Chào mừng bạn đến với cổng thông tin an sinh số BHXH Sổ. Khi truy cập và thực hiện giao dịch trên hệ thống, bạn cam kết tuân thủ các điều khoản sau:</p>
                  
                  <h4 className="font-bold text-gray-900 text-base mt-4">1. Tính chính xác của thông tin khai báo</h4>
                  <p>Người dùng chịu trách nhiệm hoàn toàn về tính chính xác, trung thực của thông tin định danh cá nhân (Họ tên, số CCCD, mã số bảo hiểm, số điện thoại) khai báo khi đăng ký.</p>
                  
                  <h4 className="font-bold text-gray-900 text-base mt-4">2. Thời hạn xử lý hồ sơ hành chính</h4>
                  <p>Hồ sơ đăng ký của bạn sau khi thanh toán thành công sẽ được đồng bộ gửi trực tiếp đến cổng thụ lý của cơ quan BHXH Việt Nam. Thời gian hoàn tất thủ tục và đồng bộ từ 3-5 ngày làm việc theo quy định hành chính hiện hành.</p>

                  <h4 className="font-bold text-gray-900 text-base mt-4">3. Quy định về tính toán biểu phí</h4>
                  <p>Biểu phí đóng và mức hỗ trợ của ngân sách Nhà nước, hỗ trợ địa phương được cập nhật chính xác theo Luật Bảo hiểm xã hội 2024 và các nghị định điều chỉnh mức chuẩn nghèo hiện hành.</p>
                </div>
              </div>
            )}

            {/* Bảo mật dữ liệu */}
            {activeTab === 'privacy' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Lock className="text-[#0ea5e9]" size={28} />
                  <h3 className="text-2xl font-bold text-gray-900">Bảo mật thông tin & Dữ liệu</h3>
                </div>
                <div className="space-y-4 text-gray-600 text-sm leading-relaxed font-medium">
                  <p>Chúng tôi coi trọng việc bảo vệ bí mật thông tin của khách hàng. Chính sách bảo mật này quy định cách thức chúng tôi tiếp nhận và quản lý dữ liệu cá nhân của quý khách:</p>
                  
                  <h4 className="font-bold text-gray-900 text-base mt-4">1. Phạm vi thu thập thông tin</h4>
                  <p>Chúng tôi chỉ thu thập các trường thông tin cần thiết nhất để lập hồ sơ bảo hiểm định danh bao gồm: Họ tên, số định danh cá nhân CCCD, ngày sinh, giới tính, địa chỉ liên hệ và số điện thoại nhận thông báo nhắc lịch.</p>
                  
                  <h4 className="font-bold text-gray-900 text-base mt-4">2. Cam kết bảo mật tuyệt đối</h4>
                  <p>Mọi thông tin giao dịch trực tuyến và thông tin cá nhân của người tham gia được mã hóa đầu cuối và chuyển tiếp trực tiếp vào cổng dịch vụ quốc gia. Chúng tôi cam kết tuyệt đối không chia sẻ, bán, hoặc cho thuê dữ liệu người dùng cho bất kỳ bên thứ ba nào vì mục đích thương mại.</p>

                  <h4 className="font-bold text-gray-900 text-base mt-4">3. Quyền hạn của người dùng</h4>
                  <p>Quý khách có quyền yêu cầu tra soát thông tin giao dịch, kiểm tra quá trình thụ lý hồ sơ trực tuyến bất kỳ lúc nào thông qua tổng đài hỗ trợ hoặc đại lý phụ trách của chúng tôi.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default SupportView;
