import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Save, 
  RotateCcw, 
  Sparkles, 
  Info, 
  CheckCircle, 
  Copy, 
  Eye, 
  Tag, 
  ShieldAlert, 
  Send,
  FileCheck,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { 
  DEFAULT_REMINDER_MESSAGE_TEMPLATES, 
  renderReminderMessageTemplate,
  ReminderMessageTemplates
} from '../../utils/settingsHelper';

type TemplateGroup = 'renewal_center' | 'dispatch_center';

export const ReminderMessageSettings: React.FC = () => {
  const { settings, updateSettings, addAuditLog, showToast, currentUser } = useAppContext() as any;

  const [activeGroup, setActiveGroup] = useState<TemplateGroup>('renewal_center');
  const [activeSubTab, setActiveSubTab] = useState<string>('renewal_bhxh');

  // Form State
  const [templates, setTemplates] = useState<Required<ReminderMessageTemplates>>({
    ...DEFAULT_REMINDER_MESSAGE_TEMPLATES,
    ...(settings?.reminder_message_templates || settings?.reminderMessageTemplates || {})
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Đồng bộ khi settings thay đổi từ hệ thống (chỉ khi người dùng chưa có thay đổi dở dang)
  useEffect(() => {
    if (hasChanges) return;
    const currentTemplates = settings?.reminder_message_templates || settings?.reminderMessageTemplates;
    if (currentTemplates) {
      setTemplates({
        ...DEFAULT_REMINDER_MESSAGE_TEMPLATES,
        ...currentTemplates
      });
      setHasChanges(false);
    }
  }, [settings, hasChanges]);

  const handleTextChange = (field: keyof ReminderMessageTemplates, value: string) => {
    setTemplates((prev: Required<ReminderMessageTemplates>) => {
      const next = { ...prev, [field]: value };
      if (field === 'renewalReminderBHXH' || field === 'renewal_bhxh') {
        next.renewalReminderBHXH = value;
        next.renewal_bhxh = value;
      } else if (field === 'renewalReminderBHYT' || field === 'renewal_bhyt') {
        next.renewalReminderBHYT = value;
        next.renewal_bhyt = value;
      } else if (field === 'dispatchUrgentBHXH' || field === 'dispatch_urgent_bhxh') {
        next.dispatchUrgentBHXH = value;
        next.dispatch_urgent_bhxh = value;
      } else if (field === 'dispatchUrgentBHYT' || field === 'dispatch_urgent_bhyt') {
        next.dispatchUrgentBHYT = value;
        next.dispatch_urgent_bhyt = value;
      } else if (field === 'dispatchStandard' || field === 'dispatch_standard' || field === 'dispatch_periodic') {
        next.dispatchStandard = value;
        next.dispatch_standard = value;
        next.dispatch_periodic = value;
      } else if (field === 'dispatchReceipt' || field === 'dispatch_receipt' || field === 'dispatch_confirmed') {
        next.dispatchReceipt = value;
        next.dispatch_receipt = value;
        next.dispatch_confirmed = value;
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleResetToDefault = () => {
    if (window.confirm('Bạn có chắc chắn muốn khôi phục toàn bộ mẫu tin nhắn về mặc định của hệ thống không?')) {
      setTemplates({ ...DEFAULT_REMINDER_MESSAGE_TEMPLATES });
      setHasChanges(true);
      showToast?.('Đã nạp lại mẫu tin nhắn đôn đốc mặc định chuẩn quy định!', 'info');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (updateSettings) {
        await updateSettings({
          reminderMessageTemplates: templates,
          reminder_message_templates: templates
        } as any);
      }

      setHasChanges(false);
      showToast?.('Đã lưu cấu hình mẫu tin nhắn đôn đốc thành công!', 'success');
      if (addAuditLog) {
        await addAuditLog(
          'Cập nhật Mẫu tin nhắn đôn đốc',
          `Cán bộ ${currentUser?.name || 'Admin'} đã cập nhật mẫu tin nhắn đôn đốc & kịch bản thu phí.`
        );
      }
    } catch (error: any) {
      console.error('Lỗi khi lưu cấu hình tin nhắn mẫu:', error);
      showToast?.('Lỗi khi lưu cấu hình mẫu tin nhắn: ' + (error?.message || 'Không thể lưu'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Sample data cho hộp xem trước (Live Preview)
  const sampleCustomer = {
    ten_khach_hang: 'Lường Thị Hậu',
    ma_so: '014196005767',
    ngay_het_han: '30/11/2026',
    so_tien: '781.000 đ',
    ten_can_bo: currentUser?.name || 'Quản Trị Viên',
    sdt_can_bo: currentUser?.phone || '0988.123.456',
    ten_dai_ly: settings?.agencyName || 'Điểm thu BHXH, BHYT Sông Mã',
    loai_hinh: activeSubTab.includes('bhyt') ? 'BHYT' : 'BHXH'
  };

  const availableTags = [
    { tag: '{ten_khach_hang}', label: 'Họ tên khách hàng' },
    { tag: '{ma_so}', label: 'Mã số BHXH / BHYT' },
    { tag: '{ngay_het_han}', label: 'Hạn đóng tiếp theo' },
    { tag: '{so_tien}', label: 'Số tiền dự kiến thu' },
    { tag: '{ten_can_bo}', label: 'Tên cán bộ phụ trách' },
    { tag: '{sdt_can_bo}', label: 'SĐT / Zalo cán bộ' },
    { tag: '{ten_dai_ly}', label: 'Tên đại lý thu' },
    { tag: '{loai_hinh}', label: 'Loại hình (BHXH/BHYT)' }
  ];

  const handleCopyTag = (tag: string, targetField: keyof ReminderMessageTemplates) => {
    // Chèn tag vào cuối nội dung của targetField
    const currentVal = templates[targetField] || '';
    handleTextChange(targetField, currentVal + ' ' + tag);
    setCopiedTag(tag);
    showToast?.(`Đã chèn thẻ tham số ${tag} vào mẫu tin nhắn`, 'info');
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Lấy template đang chọn hiện tại để render xem trước
  const getCurrentTemplateKey = (): keyof ReminderMessageTemplates => {
    switch (activeSubTab) {
      case 'renewal_bhxh': return 'renewalReminderBHXH';
      case 'renewal_bhyt': return 'renewalReminderBHYT';
      case 'dispatch_urgent_bhxh': return 'dispatchUrgentBHXH';
      case 'dispatch_urgent_bhyt': return 'dispatchUrgentBHYT';
      case 'dispatch_standard': return 'dispatchStandard';
      case 'dispatch_receipt': return 'dispatchReceipt';
      default: return 'renewalReminderBHXH';
    }
  };

  const currentKey = getCurrentTemplateKey();
  const currentPreviewText = renderReminderMessageTemplate(templates[currentKey] || '', sampleCustomer);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004182] to-[#0369A1] p-6 rounded-2xl text-white shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-white/10 backdrop-blur-md rounded-xl text-white">
              <MessageSquare size={22} />
            </span>
            <h2 className="text-xl font-black tracking-tight">
              Cài Đặt Mẫu Tin Nhắn Đôn Đốc & Kịch Bản Thu Phí
            </h2>
          </div>
          <p className="text-blue-100 text-xs mt-2 max-w-2xl leading-relaxed">
            Tùy biến nội dung tin nhắn gửi Zalo/SMS cho người dân. Khi cần thay đổi chính sách, câu từ hoặc lời chào, bạn chỉ cần sửa trực tiếp tại đây mà không cần sửa code.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer"
            title="Khôi phục mẫu tin nhắn mặc định"
          >
            <RotateCcw size={14} />
            <span>Mặc định</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md transition cursor-pointer ${
              hasChanges ? 'ring-2 ring-emerald-300 animate-pulse' : ''
            }`}
          >
            <Save size={14} />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
          </button>
        </div>
      </div>

      {/* Main Groups Switcher */}
      <div className="flex border-b border-gray-200 gap-3">
        <button
          type="button"
          onClick={() => {
            setActiveGroup('renewal_center');
            setActiveSubTab('renewal_bhxh');
          }}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeGroup === 'renewal_center'
              ? 'border-[#004182] text-[#004182]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ShieldAlert size={16} />
          <span>1. Mẫu Nhắc Hạn (Trung Tâm Quản Lý & Nhắc Hạn)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveGroup('dispatch_center');
            setActiveSubTab('dispatch_urgent_bhxh');
          }}
          className={`flex items-center gap-2 pb-3 px-3 text-sm font-bold border-b-2 transition cursor-pointer ${
            activeGroup === 'dispatch_center'
              ? 'border-[#004182] text-[#004182]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Send size={16} />
          <span>2. Kịch Bản Thu Phí (Trung Tâm Điều Phối & Đôn Đốc)</span>
        </button>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeGroup === 'renewal_center' ? (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('renewal_bhxh')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'renewal_bhxh'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Mẫu BHXH Tự Nguyện
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('renewal_bhyt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'renewal_bhyt'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Mẫu BHYT Hộ Gia Đình
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('dispatch_urgent_bhxh')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'dispatch_urgent_bhxh'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Nhắc Gấp (Khẩn Cấp) - BHXH
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('dispatch_urgent_bhyt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'dispatch_urgent_bhyt'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Nhắc Gấp (Khẩn Cấp) - BHYT
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('dispatch_standard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'dispatch_standard'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Nhắc Định Kỳ
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('dispatch_receipt')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeSubTab === 'dispatch_receipt'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Xác Nhận Đã Thu
            </button>
          </>
        )}
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Box */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
              <MessageSquare size={16} className="text-[#004182]" />
              <span>Nội Dung Mẫu Tin Nhắn Đang Chỉnh Sửa</span>
            </h3>
            <span className="text-[11px] font-medium text-gray-500">
              Có thể chỉnh sửa & chèn tham số
            </span>
          </div>

          {/* Placeholders Toolbar */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mb-2">
              <Tag size={12} className="text-[#004182]" />
              <span>Bấm vào thẻ tham số để tự động chèn vào nội dung tin nhắn:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map(item => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => handleCopyTag(item.tag, currentKey)}
                  className="px-2 py-1 bg-white hover:bg-blue-50 text-[#004182] border border-blue-200 rounded-lg text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  title={`Chèn ${item.label}`}
                >
                  <span>{item.tag}</span>
                  <span className="text-[9px] text-gray-400 font-sans font-normal">({item.label})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1">
            <textarea
              rows={12}
              value={templates[currentKey]}
              onChange={(e) => handleTextChange(currentKey, e.target.value)}
              placeholder="Nhập nội dung mẫu tin nhắn..."
              className="w-full p-4 border border-gray-300 rounded-xl text-xs sm:text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#004182] focus:border-[#004182] text-gray-800"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-gray-400">
              Số ký tự: <b>{templates[currentKey]?.length || 0}</b>
            </div>
            {hasChanges && (
              <span className="text-xs font-bold text-amber-600 animate-pulse">
                • Có thay đổi chưa lưu
              </span>
            )}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
              <Eye size={16} className="text-emerald-600" />
              <span>Xem Trước Trực Tiếp (Live Preview Khi Gửi Cho Người Dân)</span>
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              Mô phỏng thực tế
            </span>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            Dữ liệu mô phỏng: Khách hàng <b>{sampleCustomer.ten_khach_hang}</b> | Mã: <b>{sampleCustomer.ma_so}</b> | Hạn: <b>{sampleCustomer.ngay_het_han}</b> | Số tiền: <b>{sampleCustomer.so_tien}</b>
          </div>

          {/* Chat Bubble Preview */}
          <div className="flex-1 bg-gradient-to-b from-slate-100 to-slate-200/80 p-4 rounded-xl border border-slate-200 flex flex-col justify-start">
            <div className="max-w-md bg-white p-4 rounded-2xl rounded-tl-xs shadow-md border border-slate-100 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
              {currentPreviewText}
            </div>
            <div className="text-[10px] text-slate-400 mt-2 px-1">
              Hiển thị mẫu khi nhân viên bấm gửi Zalo/SMS hoặc sao chép tin nhắn
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(currentPreviewText);
                showToast?.('Đã sao chép nội dung tin nhắn xem trước vào bộ nhớ tạm!', 'success');
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Copy size={13} />
              <span>Sao chép bản xem trước</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderMessageSettings;

