import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { Sliders, Save, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';

const DEFAULT_HOMEPAGE_CONFIG = {
  heroTagline: "Hệ Thống Chuẩn Nghị Định 159/2025",
  heroTitleWhite: "Tương lai đảm bảo",
  heroTitleGreen: "An tâm tuổi già!",
  heroSubtitle: "Hệ thống tư vấn & đăng ký Bảo hiểm xã hội tự nguyện, Bảo hiểm y tế hộ gia đình tuân thủ theo Luật BHXH 2024 & NĐ 159/2025/NĐ-CP."
};

const HomepageSettings = () => {
  const { policies, showToast } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_HOMEPAGE_CONFIG);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  useEffect(() => {
    const configPolicy = policies?.find(p => p.parameter_type === 'homepage_config' && p.is_active);
    if (configPolicy) {
      const val = typeof configPolicy.value === 'string' ? JSON.parse(configPolicy.value) : configPolicy.value;
      setFormData({
        heroTagline: val.heroTagline || DEFAULT_HOMEPAGE_CONFIG.heroTagline,
        heroTitleWhite: val.heroTitleWhite || DEFAULT_HOMEPAGE_CONFIG.heroTitleWhite,
        heroTitleGreen: val.heroTitleGreen || DEFAULT_HOMEPAGE_CONFIG.heroTitleGreen,
        heroSubtitle: val.heroSubtitle || DEFAULT_HOMEPAGE_CONFIG.heroSubtitle
      });
    }
  }, [policies]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const configPolicy = policies?.find(p => p.parameter_type === 'homepage_config');
      if (configPolicy) {
        // Update existing policy
        const { error } = await supabase
          .from('policies')
          .update({
            value: formData,
            is_active: true
          })
          .eq('id', configPolicy.id);
        if (error) throw error;
      } else {
        // Insert new policy
        const { error } = await supabase
          .from('policies')
          .insert({
            parameter_type: 'homepage_config',
            name: 'Cấu hình nội dung trang chủ',
            value: formData,
            effective_date: '2026-01-01',
            description: 'Cấu hình nội dung trang chủ',
            is_active: true
          });
        if (error) throw error;
      }
      
      showToast('Cập nhật cấu hình trang chủ thành công!');
    } catch (error: any) {
      console.error("Lỗi khi lưu cấu hình trang chủ:", error);
      showToast('Có lỗi xảy ra khi lưu cấu hình: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIsResetModalOpen(true);
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="text-[#004182]" size={24} /> Cài Đặt Nội Dung Trang Chủ
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Chỉnh sửa nội dung khung chào mừng hiển thị ngoài trang chủ.</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 max-w-4xl">
        {/* Section 0: Hero Section */}
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <div className="w-2.5 h-6 bg-[#004182] rounded-full"></div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800">Khung Chào Mừng (Hero Section)</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Dòng chữ nhỏ (Tagline)</label>
              <input
                type="text"
                value={formData.heroTagline}
                onChange={e => setFormData({ ...formData, heroTagline: e.target.value })}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
                placeholder="Ví dụ: Hệ Thống Chuẩn Nghị Định 159/2025"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tiêu đề chính (Phần chữ trắng)</label>
                <input
                  type="text"
                  value={formData.heroTitleWhite}
                  onChange={e => setFormData({ ...formData, heroTitleWhite: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
                  placeholder="Ví dụ: An Tâm Hơn"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Tiêu đề chính (Phần chữ xanh)</label>
                <input
                  type="text"
                  value={formData.heroTitleGreen}
                  onChange={e => setFormData({ ...formData, heroTitleGreen: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
                  placeholder="Ví dụ: Vững Bước Tương Lai."
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Mô tả ngắn (Subtitle)</label>
              <textarea
                value={formData.heroSubtitle}
                onChange={e => setFormData({ ...formData, heroSubtitle: e.target.value })}
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
                placeholder="Nhập mô tả..."
                required
              />
            </div>
          </div>
        </div>

        {/* Section: Trạng Thái AI Quét Ảnh/PDF (Bảo mật Server-side) */}
        <div className="bg-amber-50/40 p-6 md:p-8 rounded-2xl border border-amber-200 shadow-xs space-y-4">
          <div className="border-b border-amber-200/60 pb-3 flex items-center gap-2">
            <div className="w-2.5 h-6 bg-amber-500 rounded-full"></div>
            <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" /> Trạng Thái AI Quét Ảnh/PDF (Bảo mật Server-side)
            </h3>
          </div>

          <div className="p-4 bg-white rounded-xl border border-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs font-medium text-slate-700 leading-relaxed space-y-1">
              <p className="font-bold text-slate-900">Khóa Gemini API Key được quản lý và bảo mật ở cấp Server (Server-Side Proxy Route /api/gemini-ocr).</p>
              <p>Mã khóa API không còn lưu trữ trên trình duyệt (localStorage) hay cơ sở dữ liệu công khai, đảm bảo an toàn thông tin PII của người dân theo tiêu chuẩn bảo mật hệ thống.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={handleReset}
            className="px-5 py-2.5 rounded-xl text-slate-700 font-bold border border-slate-200 hover:bg-slate-50 transition cursor-pointer flex items-center gap-2 text-xs sm:text-sm"
          >
            <RefreshCw size={16} /> Đặt lại mặc định
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#004182] hover:bg-[#003166] text-white font-bold transition flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-55 text-xs sm:text-sm"
          >
            <Save size={16} /> {loading ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </form>

      <ConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => setFormData(DEFAULT_HOMEPAGE_CONFIG)}
        title="Đặt lại cấu hình mặc định?"
        message="Hệ thống sẽ khôi phục lại các nội dung tiêu đề, tagline và mô tả khung chào mừng về giá trị chuẩn ban đầu. Bạn có chắc chắn muốn tiếp tục?"
        confirmText="Đặt lại ngay"
        cancelText="Hủy bỏ"
        variant="info"
      />
    </div>
  );
};

export default HomepageSettings;
