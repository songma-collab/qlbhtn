import React, { useRef, useState, useEffect } from 'react';
import { Printer, Download, FileSpreadsheet, X, SlidersHorizontal, Check, RotateCcw } from 'lucide-react';
import { formatMoney } from '../../utils/helpers';
import { ReportSummaryItem, exportRevenueReportToExcel, exportRevenueReportToPdf } from '../../utils/reportExportHelper';
import { useAppContext } from '../../context/AppContext';
import { DEFAULT_REPORT_PRINT_CONFIG } from '../../utils/settingsHelper';

interface ReportPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodText: string;
  agencyName?: string;
  parentAgencyName?: string;
  staffData: ReportSummaryItem[];
  currentUserName?: string;
  managerName?: string;
  reportLocation?: string;
  controllerName?: string;
  managerTitle?: string;
  creatorTitle?: string;
  controllerTitle?: string;
}

export const ReportPrintPreviewModal: React.FC<ReportPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  periodText,
  agencyName: propAgencyName,
  parentAgencyName: propParentAgencyName,
  staffData,
  currentUserName: propCurrentUserName,
  managerName: propManagerName,
  reportLocation: propReportLocation,
  controllerName: propControllerName,
  managerTitle: propManagerTitle,
  creatorTitle: propCreatorTitle,
  controllerTitle: propControllerTitle
}) => {
  const { settings, updateSettings, showToast, currentUser, addAuditLog } = useAppContext() as any;
  const printAreaRef = useRef<HTMLDivElement>(null);

  // State cấu hình in ấn đang áp dụng trên modal preview
  const [printConfig, setPrintConfig] = useState({
    parentAgencyName: propParentAgencyName || settings?.parentAgencyName || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
    agencyName: propAgencyName || settings?.agencyName || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
    managerName: propManagerName || settings?.managerName || DEFAULT_REPORT_PRINT_CONFIG.managerName,
    reportLocation: propReportLocation || settings?.reportLocation || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
    controllerName: propControllerName || settings?.controllerName || '',
    managerTitle: propManagerTitle || settings?.managerTitle || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
    creatorTitle: propCreatorTitle || settings?.creatorTitle || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
    controllerTitle: propControllerTitle || settings?.controllerTitle || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle,
    currentUserName: propCurrentUserName || currentUser?.name || 'Người lập biểu'
  });

  // State mở drawer chỉnh sửa thông số in ấn nhanh
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Form chỉnh sửa tạm thời trong quick settings drawer
  const [editForm, setEditForm] = useState({ ...printConfig });

  // Đồng bộ khi settings từ AppContext hoặc props thay đổi
  useEffect(() => {
    const nextCfg = {
      parentAgencyName: propParentAgencyName || settings?.parentAgencyName || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
      agencyName: propAgencyName || settings?.agencyName || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
      managerName: propManagerName || settings?.managerName || DEFAULT_REPORT_PRINT_CONFIG.managerName,
      reportLocation: propReportLocation || settings?.reportLocation || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
      controllerName: propControllerName || settings?.controllerName || '',
      managerTitle: propManagerTitle || settings?.managerTitle || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
      creatorTitle: propCreatorTitle || settings?.creatorTitle || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
      controllerTitle: propControllerTitle || settings?.controllerTitle || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle,
      currentUserName: propCurrentUserName || currentUser?.name || 'Người lập biểu'
    };
    setPrintConfig(nextCfg);
    setEditForm(nextCfg);
  }, [settings, propParentAgencyName, propAgencyName, propManagerName, propReportLocation, propControllerName, propManagerTitle, propCreatorTitle, propControllerTitle, propCurrentUserName, currentUser]);

  if (!isOpen) return null;

  // Tính tổng cộng số liệu
  const totals = staffData.reduce(
    (acc, cur) => ({
      bhxhCount: acc.bhxhCount + (cur.bhxhCount || 0),
      bhxhRevenue: acc.bhxhRevenue + (cur.bhxhRevenue || 0),
      bhxhCommission: acc.bhxhCommission + (cur.bhxhCommission || 0),
      bhytCount: acc.bhytCount + (cur.bhytCount || 0),
      bhytRevenue: acc.bhytRevenue + (cur.bhytRevenue || 0),
      bhytCommission: acc.bhytCommission + (cur.bhytCommission || 0),
      revenue: acc.revenue + (cur.revenue || 0),
      commission: acc.commission + (cur.commission || 0)
    }),
    {
      bhxhCount: 0,
      bhxhRevenue: 0,
      bhxhCommission: 0,
      bhytCount: 0,
      bhytRevenue: 0,
      bhytCommission: 0,
      revenue: 0,
      commission: 0
    }
  );

  const now = new Date();
  const dateStr = `${printConfig.reportLocation || 'Sông Mã'}, ngày ${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportRevenueReportToExcel({
      periodText,
      agencyName: printConfig.agencyName,
      parentAgencyName: printConfig.parentAgencyName,
      staffData,
      currentUserName: printConfig.currentUserName,
      managerName: printConfig.managerName,
      reportLocation: printConfig.reportLocation,
      controllerName: printConfig.controllerName,
      managerTitle: printConfig.managerTitle,
      creatorTitle: printConfig.creatorTitle,
      controllerTitle: printConfig.controllerTitle
    });
  };

  const handleExportPdf = () => {
    exportRevenueReportToPdf({
      periodText,
      agencyName: printConfig.agencyName,
      parentAgencyName: printConfig.parentAgencyName,
      staffData,
      currentUserName: printConfig.currentUserName,
      managerName: printConfig.managerName,
      reportLocation: printConfig.reportLocation,
      controllerName: printConfig.controllerName,
      managerTitle: printConfig.managerTitle,
      creatorTitle: printConfig.creatorTitle,
      controllerTitle: printConfig.controllerTitle
    });
  };

  // Lưu cấu hình thông số in ấn vào database/settings
  const handleSaveQuickSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const payload = {
        parentAgencyName: editForm.parentAgencyName.trim() || DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
        agencyName: editForm.agencyName.trim() || DEFAULT_REPORT_PRINT_CONFIG.agencyName,
        managerName: editForm.managerName.trim() || DEFAULT_REPORT_PRINT_CONFIG.managerName,
        reportLocation: editForm.reportLocation.trim() || DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
        controllerName: editForm.controllerName.trim(),
        managerTitle: editForm.managerTitle.trim() || DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
        creatorTitle: editForm.creatorTitle.trim() || DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
        controllerTitle: editForm.controllerTitle.trim() || DEFAULT_REPORT_PRINT_CONFIG.controllerTitle
      };

      if (updateSettings) {
        await updateSettings(payload);
      }

      setPrintConfig(prev => ({ ...prev, ...payload }));
      setIsQuickSettingsOpen(false);
      showToast?.('Đã lưu và áp dụng thông số in ấn thành công!', 'success');
      addAuditLog?.('Cài đặt thông số in ấn', `Cập nhật thông tin đơn vị: ${payload.parentAgencyName} | Đại lý: ${payload.agencyName} | Thủ trưởng: ${payload.managerName}`);
    } catch (err) {
      console.error('Lỗi khi lưu cấu hình in ấn:', err);
      showToast?.('Không thể lưu cấu hình in ấn. Vui lòng thử lại!', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Khôi phục cài đặt mặc định
  const handleResetDefaultSettings = () => {
    setEditForm(prev => ({
      ...prev,
      parentAgencyName: DEFAULT_REPORT_PRINT_CONFIG.parentAgencyName,
      agencyName: DEFAULT_REPORT_PRINT_CONFIG.agencyName,
      managerName: DEFAULT_REPORT_PRINT_CONFIG.managerName,
      reportLocation: DEFAULT_REPORT_PRINT_CONFIG.reportLocation,
      controllerName: '',
      managerTitle: DEFAULT_REPORT_PRINT_CONFIG.managerTitle,
      creatorTitle: DEFAULT_REPORT_PRINT_CONFIG.creatorTitle,
      controllerTitle: DEFAULT_REPORT_PRINT_CONFIG.controllerTitle
    }));
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      {/* Container Dialog */}
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
        {/* Modal Toolbar - Hidden during print */}
        <div className="print:hidden px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Printer className="text-[#004182]" size={20} />
            <h3 className="text-base sm:text-lg font-bold text-slate-800">
              Xem Trước & In Báo Cáo Thống Kê Thu
            </h3>
            <span className="hidden sm:inline-block text-xs bg-blue-100 text-[#004182] font-semibold px-2.5 py-0.5 rounded-full">
              Khổ A4 • Times New Roman
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditForm({ ...printConfig });
                setIsQuickSettingsOpen(!isQuickSettingsOpen);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer border ${
                isQuickSettingsOpen 
                  ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-inner' 
                  : 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700'
              }`}
              title="Thiết lập cài đặt thông số in ấn: Đơn vị, Đại lý, Thủ trưởng"
            >
              <SlidersHorizontal size={15} className="text-[#004182]" />
              <span>Cài đặt in ấn</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-[#004182] hover:bg-blue-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow transition flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Printer size={15} /> In Ngay
            </button>

            <button
              onClick={handleExportPdf}
              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow transition flex items-center gap-1.5 cursor-pointer border-none"
            >
              <Download size={15} /> Tải PDF
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow transition flex items-center gap-1.5 cursor-pointer border-none"
            >
              <FileSpreadsheet size={15} /> Xuất Excel
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer border-none ml-1"
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Quick Settings Panel (Drawer toggle) */}
        {isQuickSettingsOpen && (
          <div className="print:hidden bg-amber-50/80 border-b border-amber-200 p-4 sm:p-5 transition-all duration-300 animate-in slide-in-from-top-2">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="text-[#004182]" size={18} />
                  <h4 className="font-extrabold text-sm sm:text-base text-slate-800">
                    Cài đặt Thông số In ấn & Mẫu biểu Báo cáo
                  </h4>
                  <span className="text-[11px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-semibold">
                    Áp dụng cho Bản in, PDF & Excel
                  </span>
                </div>
                <button
                  onClick={handleResetDefaultSettings}
                  className="text-xs text-slate-600 hover:text-rose-600 flex items-center gap-1 font-semibold cursor-pointer border-none bg-transparent"
                >
                  <RotateCcw size={13} /> Khôi phục mặc định
                </button>
              </div>

              <form onSubmit={handleSaveQuickSettings}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 text-xs">
                  {/* Mục 1: Đơn vị quản lý cấp trên */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Cơ quan BHXH cấp trên (Góc trên trái) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.parentAgencyName}
                      onChange={e => setEditForm({ ...editForm, parentAgencyName: e.target.value })}
                      placeholder="VD: BẢO HIỂM XÃ HỘI TỈNH SƠN LA"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                      required
                    />
                  </div>

                  {/* Mục 2: Tên cơ sở đại lý thu */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Tên Đại lý thu BHXH/BHYT <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.agencyName}
                      onChange={e => setEditForm({ ...editForm, agencyName: e.target.value })}
                      placeholder="VD: ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                      required
                    />
                  </div>

                  {/* Mục 3: Thủ trưởng đơn vị */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Họ tên Thủ trưởng đơn vị (Ký duyệt) <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={editForm.managerName}
                      onChange={e => setEditForm({ ...editForm, managerName: e.target.value })}
                      placeholder="VD: Phạm Văn Học hoặc Thủ trưởng đơn vị"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                      required
                    />
                  </div>

                  {/* Địa danh */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Địa danh ngày tháng
                    </label>
                    <input
                      type="text"
                      value={editForm.reportLocation}
                      onChange={e => setEditForm({ ...editForm, reportLocation: e.target.value })}
                      placeholder="VD: Sông Mã"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                    />
                  </div>

                  {/* Người kiểm soát */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Họ tên Người kiểm soát (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={editForm.controllerName}
                      onChange={e => setEditForm({ ...editForm, controllerName: e.target.value })}
                      placeholder="VD: Nguyễn Thị B (để trống nếu tự ký)"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                    />
                  </div>

                  {/* Chức danh thủ trưởng */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Chức danh người ký duyệt
                    </label>
                    <input
                      type="text"
                      value={editForm.managerTitle}
                      onChange={e => setEditForm({ ...editForm, managerTitle: e.target.value })}
                      placeholder="VD: THỦ TRƯỞNG ĐƠN VỊ hoặc GIÁM ĐỐC ĐẠI LÝ"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#004182]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={() => setIsQuickSettingsOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="px-4 py-1.5 rounded-lg bg-[#004182] hover:bg-blue-900 text-white font-bold text-xs shadow transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check size={14} />
                    {isSavingSettings ? 'Đang lưu...' : 'Lưu & Cập nhật Bản in'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Document Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex justify-center">
          {/* Paper Sheet (A4 Landscape styled container) */}
          <div
            ref={printAreaRef}
            id="printable-report-area"
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
            className="bg-white w-full max-w-[297mm] min-h-[210mm] p-6 sm:p-10 shadow-lg border border-slate-200 text-black leading-normal print:shadow-none print:border-none print:p-0 print:m-0"
          >
            {/* Header: Quốc hiệu & Tên cơ quan */}
            <div className="grid grid-cols-2 gap-4 pb-4">
              <div className="text-center">
                <p className="text-[12px] font-bold uppercase tracking-tight text-black">
                  {printConfig.parentAgencyName}
                </p>
                <p className="text-[13px] font-extrabold uppercase text-[#004182] mt-0.5">
                  {printConfig.agencyName}
                </p>
                <div className="w-24 border-b border-slate-400 mx-auto mt-1"></div>
              </div>

              <div className="text-center">
                <p className="text-[12px] font-bold uppercase text-black">
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </p>
                <p className="text-[13px] font-bold italic text-black mt-0.5">
                  Độc lập - Tự do - Hạnh phúc
                </p>
                <div className="w-32 border-b border-slate-400 mx-auto mt-1"></div>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center my-6">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#004182]">
                BÁO CÁO TỔNG HỢP THU BẢO HIỂM XÃ HỘI, BẢO HIỂM Y TẾ
              </h1>
              <p className="text-sm font-bold italic text-slate-700 mt-1">
                Kỳ báo cáo: {periodText}
              </p>
              <p className="text-xs italic text-slate-500 text-right mt-2">
                Đơn vị tính: Đồng Việt Nam (VNĐ)
              </p>
            </div>

            {/* Administrative Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full border-collapse border border-slate-400 text-[11px] sm:text-xs">
                <thead>
                  <tr className="bg-[#004182] text-white">
                    <th rowSpan={2} className="border border-slate-400 p-2 text-center font-bold w-8">
                      STT
                    </th>
                    <th rowSpan={2} className="border border-slate-400 p-2 text-center font-bold min-w-[140px]">
                      Cán bộ / Đại lý phụ trách
                    </th>
                    <th colSpan={3} className="border border-slate-400 p-2 text-center font-bold">
                      BHXH TỰ NGUYỆN
                    </th>
                    <th colSpan={3} className="border border-slate-400 p-2 text-center font-bold">
                      BHYT HỘ GIA ĐÌNH
                    </th>
                    <th rowSpan={2} className="border border-slate-400 p-2 text-center font-bold min-w-[110px]">
                      TỔNG TIỀN THU
                    </th>
                    <th rowSpan={2} className="border border-slate-400 p-2 text-center font-bold min-w-[100px]">
                      TỔNG HOA HỒNG
                    </th>
                  </tr>
                  <tr className="bg-[#0369A1] text-white text-[10.5px]">
                    <th className="border border-slate-400 p-1.5 text-center font-semibold w-14">Số HS</th>
                    <th className="border border-slate-400 p-1.5 text-center font-semibold min-w-[90px]">Tiền thu</th>
                    <th className="border border-slate-400 p-1.5 text-center font-semibold min-w-[80px]">Hoa hồng</th>
                    <th className="border border-slate-400 p-1.5 text-center font-semibold w-14">Số HS</th>
                    <th className="border border-slate-400 p-1.5 text-center font-semibold min-w-[90px]">Tiền thu</th>
                    <th className="border border-slate-400 p-1.5 text-center font-semibold min-w-[80px]">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody>
                  {staffData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="border border-slate-300 p-4 text-center text-slate-400 italic">
                        Không có dữ liệu thu trong kỳ báo cáo này
                      </td>
                    </tr>
                  ) : (
                    staffData.map((s, idx) => (
                      <tr key={s.id || idx} className="hover:bg-slate-50 even:bg-slate-50/50">
                        <td className="border border-slate-300 p-2 text-center font-medium">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-bold text-slate-900">{s.name}</td>
                        <td className="border border-slate-300 p-2 text-center font-semibold">{s.bhxhCount || 0}</td>
                        <td className="border border-slate-300 p-2 text-right font-medium">{formatMoney(s.bhxhRevenue || 0)}</td>
                        <td className="border border-slate-300 p-2 text-right font-medium text-emerald-700">{formatMoney(s.bhxhCommission || 0)}</td>
                        <td className="border border-slate-300 p-2 text-center font-semibold">{s.bhytCount || 0}</td>
                        <td className="border border-slate-300 p-2 text-right font-medium">{formatMoney(s.bhytRevenue || 0)}</td>
                        <td className="border border-slate-300 p-2 text-right font-medium text-emerald-700">{formatMoney(s.bhytCommission || 0)}</td>
                        <td className="border border-slate-300 p-2 text-right font-black text-[#004182]">{formatMoney(s.revenue || 0)}</td>
                        <td className="border border-slate-300 p-2 text-right font-black text-amber-600">{formatMoney(s.commission || 0)}</td>
                      </tr>
                    ))
                  )}

                  {/* Dòng Tổng cộng */}
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-[11.5px]">
                    <td colSpan={2} className="border border-slate-400 p-2.5 text-center uppercase tracking-wide">
                      TỔNG CỘNG
                    </td>
                    <td className="border border-slate-400 p-2.5 text-center text-black font-black">{totals.bhxhCount}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-black font-black">{formatMoney(totals.bhxhRevenue)}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-emerald-800 font-black">{formatMoney(totals.bhxhCommission)}</td>
                    <td className="border border-slate-400 p-2.5 text-center text-black font-black">{totals.bhytCount}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-black font-black">{formatMoney(totals.bhytRevenue)}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-emerald-800 font-black">{formatMoney(totals.bhytCommission)}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-[#004182] font-black">{formatMoney(totals.revenue)}</td>
                    <td className="border border-slate-400 p-2.5 text-right text-amber-700 font-black">{formatMoney(totals.commission)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer Signatures */}
            <div className="mt-8 pt-4">
              <p className="text-right text-xs italic text-slate-700 mb-4">
                {dateStr}
              </p>

              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs font-bold uppercase text-black">{printConfig.creatorTitle}</p>
                  <p className="text-[10px] italic text-slate-500 mb-14">(Ký, ghi rõ họ tên)</p>
                  <p className="text-xs font-bold text-slate-900">{printConfig.currentUserName}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-black">{printConfig.controllerTitle}</p>
                  <p className="text-[10px] italic text-slate-500 mb-14">(Ký, ghi rõ họ tên)</p>
                  <p className="text-xs font-bold text-slate-900">{printConfig.controllerName}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-black">{printConfig.managerTitle}</p>
                  <p className="text-[10px] italic text-slate-500 mb-14">(Ký, đóng dấu, ghi rõ họ tên)</p>
                  <p className="text-xs font-bold text-slate-900">{printConfig.managerName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Print Styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report-area, #printable-report-area * {
            visibility: visible;
          }
          #printable-report-area {
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            margin: 0;
            padding: 10mm;
            box-shadow: none;
            border: none;
          }
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
};

export default ReportPrintPreviewModal;
