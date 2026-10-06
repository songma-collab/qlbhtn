import React, { useState, useEffect } from 'react';
import { 
  Printer, Building2, User, MapPin, Save, RotateCcw, 
  CheckCircle, FileText, Sparkles, ShieldCheck, Info
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { DEFAULT_REPORT_PRINT_CONFIG, ReportPrintConfig } from '../../utils/settingsHelper';

export const ReportPrintSettings: React.FC = () => {
  const { settings, updateSettings, addAuditLog, showToast, currentUser } = useAppContext() as any;

  const isAdmin = Boolean(currentUser?.role === 'Admin' || currentUser?.role === 'admin');

  // Form State
  const [formData, setFormData] = useState<Required<ReportPrintConfig>>({
    parentAgencyName: settings?.parentAgencyName || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
    agencyName: settings?.agencyName || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
    managerName: settings?.managerName || DEFAULT_REPORT_PRINT_CONFIG.managerName,
    reportLocation: settings?.reportLocation || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
    controllerName: settings?.controllerName || '',
    managerTitle: settings?.managerTitle || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
    creatorTitle: settings?.creatorTitle || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
    controllerTitle: settings?.controllerTitle || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Đồng bộ khi settings thay đổi từ hệ thống
  useEffect(() => {
    if (settings) {
      setFormData({
        parentAgencyName: settings.parentAgencyName || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
        agencyName: settings.agencyName || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
        managerName: settings.managerName || DEFAULT_REPORT_PRINT_CONFIG.managerName,
        reportLocation: settings.reportLocation || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
        controllerName: settings.controllerName || '',
        managerTitle: settings.managerTitle || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
        creatorTitle: settings.creatorTitle || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
        controllerTitle: settings.controllerTitle || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle
      });
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (field: keyof ReportPrintConfig, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Khôi phục mặc định ban đầu
  const handleResetToDefault = () => {
    setFormData({ ...DEFAULT_REPORT_PRINT_CONFIG });
    setHasChanges(true);
    showToast?.('Đã nạp lại thông số in ấn mặc định chuẩn Nghị định 30!', 'info');
  };

  // Lưu cấu hình
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: Required<ReportPrintConfig> = {
        parentAgencyName: formData.parentAgencyName?.trim() || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
        agencyName: formData.agencyName?.trim() || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
        managerName: formData.managerName?.trim() || DEFAULT_REPORT_PRINT_CONFIG.managerName,
        reportLocation: formData.reportLocation?.trim() || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
        controllerName: formData.controllerName?.trim() || '',
        managerTitle: formData.managerTitle?.trim() || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
        creatorTitle: formData.creatorTitle?.trim() || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
        controllerTitle: formData.controllerTitle?.trim() || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle
      };

      if (updateSettings) {
        await updateSettings(payload);
      }

      setHasChanges(false);
      showToast?.('Đã lưu cấu hình thông số in ấn và mẫu biểu thành công!', 'success');
      addAuditLog?.(
        'Cập nhật thông số in ấn',
        `Đơn vị cấp trên: ${payload.parentAgencyName} | Đại lý: ${payload.agencyName} | Thủ trưởng: ${payload.managerName}`
      );
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình in ấn:', error);
      showToast?.('Lỗi khi lưu cấu hình in ấn. Vui lòng kiểm tra lại!', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const now = new Date();
  const dateStr = `${formData.reportLocation || 'Sông Mã'}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004182] to-[#0369A1] p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-white/10 backdrop-blur-md rounded-xl text-white">
              <Printer size={22} />
            </span>
            <h2 className="text-xl font-black tracking-tight">
              Cài Đặt Thông Số In Ấn & Mẫu Biểu Báo Cáo
            </h2>
          </div>
          <p className="text-blue-100 text-xs mt-2 max-w-2xl leading-relaxed">
            Tùy chỉnh thông tin Cơ quan BHXH cấp trên, Tên đại lý thu, Họ tên và Chức danh Thủ trưởng đơn vị ký duyệt. 
            Các thông số này sẽ tự động hiển thị trên <strong>Bản xem trước in A4</strong>, <strong>File xuất Excel</strong> và <strong>File xuất PDF</strong> chuẩn Nghị định 30/2020/NĐ-CP.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer"
            title="Khôi phục thông số mặc định"
          >
            <RotateCcw size={14} />
            <span>Mặc định</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form nhập liệu cấu hình (7 cột) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Building2 className="text-[#004182]" size={18} />
              <h3 className="font-bold text-slate-800 text-base">
                Thông Tin Đơn Vị & Ký Biểu Mẫu
              </h3>
            </div>
            {hasChanges && (
              <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                Có thay đổi chưa lưu
              </span>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* 1. Cơ quan BHXH cấp trên */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>Cơ quan BHXH quản lý cấp trên</span>
                <span className="text-rose-500">*</span>
                <span className="text-[10px] text-gray-400 font-normal ml-auto">(Góc trên bên trái bản in)</span>
              </label>
              <input
                type="text"
                value={formData.parentAgencyName}
                onChange={e => handleChange('parentAgencyName', e.target.value)}
                placeholder="VD: BẢO HIỂM XÃ HỘI TỈNH SƠN LA"
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Tên đơn vị quản lý trực tiếp theo quyết định giao đại lý thu.
              </p>
            </div>

            {/* 2. Tên cơ sở đại lý thu */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                <span>Tên Cơ sở / Đại lý thu BHXH, BHYT</span>
                <span className="text-rose-500">*</span>
                <span className="text-[10px] text-gray-400 font-normal ml-auto">(Dưới tên cơ quan cấp trên)</span>
              </label>
              <input
                type="text"
                value={formData.agencyName}
                onChange={e => handleChange('agencyName', e.target.value)}
                placeholder="VD: ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ"
                className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Tên đại lý hoặc điểm thu được hiển thị trang trọng trên phần đầu biểu mẫu.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* 3. Thủ trưởng đơn vị */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>Họ tên Thủ trưởng đơn vị</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.managerName}
                  onChange={e => handleChange('managerName', e.target.value)}
                  placeholder="VD: Phạm Văn Học"
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                  required
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Người ký đóng dấu duyệt báo cáo (Góc dưới bên phải).
                </p>
              </div>

              {/* 4. Chức danh thủ trưởng */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Chức danh Thủ trưởng
                </label>
                <input
                  type="text"
                  value={formData.managerTitle}
                  onChange={e => handleChange('managerTitle', e.target.value)}
                  placeholder="VD: THỦ TRƯỞNG ĐƠN VỊ hoặc GIÁM ĐỐC"
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* 5. Địa danh ngày tháng */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                  <span>Địa danh ban hành báo cáo</span>
                </label>
                <input
                  type="text"
                  value={formData.reportLocation}
                  onChange={e => handleChange('reportLocation', e.target.value)}
                  placeholder="VD: Sông Mã"
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Hiển thị dạng: "{formData.reportLocation || 'Sông Mã'}, ngày ... tháng ... năm ..."
                </p>
              </div>

              {/* 6. Họ tên Người kiểm soát */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Họ tên Người kiểm soát (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={formData.controllerName}
                  onChange={e => handleChange('controllerName', e.target.value)}
                  placeholder="Để trống nếu tự kiểm soát"
                  className="w-full px-3.5 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004182] focus:bg-white transition"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Lưu trữ đồng bộ Supabase & Local Cache</span>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#004182] hover:bg-blue-900 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save size={15} />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu Cài Đặt In Ấn'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Khung Live Preview trực quan (5 cột) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex-1">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="text-[#004182]" size={17} />
                <h4 className="font-bold text-gray-800 text-sm">
                  Khung Xem Trước Trực Tiếp (Live Preview)
                </h4>
              </div>
              <span className="text-[10px] bg-blue-50 text-[#004182] px-2 py-0.5 rounded-full font-bold">
                Times New Roman • A4
              </span>
            </div>

            {/* Mô phỏng góc trên bên trái & phải của văn bản */}
            <div 
              style={{ fontFamily: "'Times New Roman', Times, serif" }}
              className="bg-slate-50/80 p-4 rounded-xl border border-slate-200 text-black leading-snug space-y-4"
            >
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                1. Tiêu đề cơ quan (Góc trên bên trái)
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-center shadow-xs">
                <p className="text-[11.5px] font-bold uppercase tracking-tight text-black">
                  {formData.parentAgencyName || 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA'}
                </p>
                <p className="text-[12px] font-extrabold uppercase text-[#004182] mt-0.5">
                  {formData.agencyName || 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ'}
                </p>
                <div className="w-20 border-b border-slate-400 mx-auto mt-1"></div>
              </div>

              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider pt-2">
                2. Chữ ký thủ trưởng (Góc dưới bên phải)
              </div>
              <div className="p-3 bg-white rounded-lg border border-slate-200 text-right shadow-xs space-y-1">
                <p className="text-[11px] italic text-slate-700">
                  {dateStr}
                </p>
                <div className="text-center inline-block min-w-[140px] pt-1">
                  <p className="text-[11px] font-bold uppercase text-black">
                    {formData.managerTitle || 'THỦ TRƯỞNG ĐƠN VỊ'}
                  </p>
                  <p className="text-[9.5px] italic text-slate-500 mb-8">
                    (Ký, đóng dấu, ghi rõ họ tên)
                  </p>
                  <p className="text-[11.5px] font-bold text-slate-900">
                    {formData.managerName || 'Thủ trưởng đơn vị'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2 text-xs text-slate-600">
              <Info size={16} className="text-[#004182] shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11.5px]">
                Khi bạn nhấn <strong>"Lưu Cài Đặt In Ấn"</strong>, toàn bộ các chức năng <strong>Xem trước & In Báo Cáo Thống Kê Thu</strong>, <strong>Tải PDF</strong>, và <strong>Xuất Excel</strong> sẽ tự động nhận thông tin mới này ngay lập tức.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportPrintSettings;
