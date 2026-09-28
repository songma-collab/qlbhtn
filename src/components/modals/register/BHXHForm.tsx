import React from 'react';
import { User, Search, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { formatTitleCase } from '../../../utils/helpers';

interface BHXHFormProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  errors: any;
  isRenew: boolean;
  recordId: number | null;
  autoFillCustomerInfo: (code: string, type: 'BHXH' | 'BHYT', index?: number) => void;
  handleDOBChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCCCDChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSearchingCustomer?: boolean;
  autoFilledBadge?: { name: string; cccd: string; phone?: string; source?: string } | null;
  bhxhCalc?: any;
}

const BHXHForm: React.FC<BHXHFormProps> = ({
  formData,
  setFormData,
  errors,
  isRenew,
  recordId,
  autoFillCustomerInfo,
  handleDOBChange,
  handleCCCDChange,
  handlePhoneChange,
  handleEmailChange,
  isSearchingCustomer = false,
  autoFilledBadge = null,
  bhxhCalc
}) => {
  if (isRenew) return null;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <User className="text-[#004182] shrink-0" size={18} />
        <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">Thông Tin Cá Nhân Người Tham Gia</h4>
      </div>

      <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-700">Số ĐDCN / CCCD (*)</label>
              {isSearchingCustomer && (
                <span className="text-[10px] text-blue-600 flex items-center gap-1 font-medium">
                  <Loader2 size={10} className="animate-spin" /> Đang tra cứu...
                </span>
              )}
            </div>
            <div className="relative">
              <input 
                type="text" 
                inputMode="numeric" 
                required={!isRenew && !recordId} 
                value={formData.cccd || ''} 
                onChange={handleCCCDChange} 
                onBlur={e => {
                  if (e.target.value && !isRenew && !recordId) {
                    autoFillCustomerInfo(e.target.value, 'BHXH');
                  }
                }} 
                className={`w-full h-[42px] pl-3.5 pr-9 rounded-xl border text-sm outline-none bg-white text-gray-900 font-bold transition-all ${errors.cccd ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10'}`} 
                maxLength={12} 
                placeholder="12 số CCCD/ĐDCN" 
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {isSearchingCustomer ? (
                  <Loader2 size={16} className="text-blue-600 animate-spin" />
                ) : autoFilledBadge ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <button
                    type="button"
                    title="Tra cứu thông tin từ CSDL"
                    onClick={() => formData.cccd && autoFillCustomerInfo(formData.cccd, 'BHXH')}
                    className="text-gray-400 hover:text-[#004182] transition-colors p-1 rounded-lg cursor-pointer"
                  >
                    <Search size={15} />
                  </button>
                )}
              </div>
            </div>
            {errors.cccd && <p className="text-red-500 text-xs mt-1 font-medium">{errors.cccd}</p>}
            
            {/* Huy hiệu thông báo tự động gọi lại hồ sơ từ CSDL */}
            {autoFilledBadge && (
              <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800 shadow-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                  <span className="truncate">Đã nạp hồ sơ: <strong className="font-bold text-emerald-950">{autoFilledBadge.name}</strong> {autoFilledBadge.phone ? `(${autoFilledBadge.phone})` : ''}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => autoFillCustomerInfo(formData.cccd, 'BHXH')} 
                  className="shrink-0 ml-2 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5 cursor-pointer"
                  title="Gọi lại dữ liệu từ CSDL"
                >
                  <RotateCcw size={10} /> Tải lại
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Mã BHXH cũ (10 số) <span className="text-gray-400 font-normal">(Tùy chọn)</span></label>
            <input 
              type="text" 
              inputMode="numeric" 
              value={formData.oldBhxh || ''} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData((prev: any) => ({ ...prev, oldBhxh: val }));
                if (val.length === 10 && !isRenew && !recordId) {
                  autoFillCustomerInfo(val, 'BHXH');
                }
              }} 
              onBlur={e => {
                if (e.target.value.length === 10 && !isRenew && !recordId) {
                  autoFillCustomerInfo(e.target.value, 'BHXH');
                }
              }}
              className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" 
              maxLength={10} 
              placeholder="Mã BHXH 10 số (nếu có)" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Họ và tên (*)</label>
            <input type="text" required={!isRenew && !recordId} value={formData.name || ''} onChange={e => setFormData((prev: any) => ({ ...prev, name: formatTitleCase(e.target.value) }))} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder="Nguyễn Văn A" />
          </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Ngày sinh</label>
          <input type="text" inputMode="numeric" value={formData.dob || ''} onChange={handleDOBChange} placeholder="DD/MM/YYYY" maxLength={10} className={`w-full h-[42px] px-3.5 rounded-xl border text-sm outline-none bg-white text-gray-900 font-bold transition-all ${errors.dob ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10'}`} />
          {errors.dob && <p className="text-red-500 text-xs mt-1 font-medium">{errors.dob}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Giới tính</label>
          <select value={formData.gender || 'Nam'} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold cursor-pointer">
            <option>Nam</option>
            <option>Nữ</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Dân tộc</label>
          <select value={formData.nation || 'Kinh'} onChange={e => setFormData({...formData, nation: e.target.value})} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold cursor-pointer">
            <option value="Kinh">Kinh</option>
            <option value="Thiểu_số">Thiểu_số</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại (*)</label>
          <input type="text" inputMode="numeric" required={!isRenew && !recordId} value={formData.phone || ''} onChange={handlePhoneChange} className={`w-full h-[42px] px-3.5 rounded-xl border text-sm outline-none bg-white text-gray-900 font-bold transition-all ${errors.phone ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10'}`} maxLength={10} placeholder="SĐT liên hệ" />
          {errors.phone && <p className="text-red-500 text-xs mt-1 font-medium">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
          <input type="email" value={formData.email || ''} onChange={handleEmailChange} className={`w-full h-[42px] px-3.5 rounded-xl border text-sm outline-none bg-white text-gray-900 font-bold transition-all ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10'}`} placeholder="abc@email.com" />
          {errors.email && <p className="text-red-500 text-xs mt-1 font-medium">{errors.email}</p>}
        </div>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ</label>
            <input 
              type="text" 
              value={formData.address || ''} 
              onChange={e => setFormData({...formData, address: e.target.value})} 
              className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" 
              placeholder="Bản, Xã, Huyện..." 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú</label>
            <input 
              type="text" 
              value={formData.notes || ''} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" 
              placeholder="Thông tin bổ sung..." 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BHXHForm;
