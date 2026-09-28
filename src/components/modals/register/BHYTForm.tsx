import React from 'react';
import { User, Users, Search, Loader2 } from 'lucide-react';
import { formatTitleCase } from '../../../utils/helpers';
import { formatDateInputMask, validateDOBInput } from '../../../utils/dateFormatter';

interface BHYTFormProps {
  bhytMembers: any[];
  setBhytMembers: React.Dispatch<React.SetStateAction<any[]>>;
  isRenew: boolean;
  recordId: number | null;
  autoFillCustomerInfo: (code: string, type: 'BHXH' | 'BHYT', index?: number) => void;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isSearchingCustomer?: boolean;
}

const BHYTForm: React.FC<BHYTFormProps> = ({
  bhytMembers,
  setBhytMembers,
  isRenew,
  recordId,
  autoFillCustomerInfo,
  setFormData,
  isSearchingCustomer = false
}) => {
  if (isRenew) return null;

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Users className="text-[#004182] shrink-0" size={18} />
          <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">Thông Tin Cá Nhân Người Tham Gia</h4>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{bhytMembers.length} người</span>
      </div>

      {bhytMembers.map((m, i) => (
        <div key={i} className="mb-4 p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-gray-200/80 shadow-sm">
          <h4 className="font-extrabold text-[#004182] text-sm sm:text-base mb-4 pb-2 border-b border-gray-200 flex items-center justify-between">
            <span className="flex items-center">
              <User className="mr-2 text-[#004182]" size={18} /> Thông tin Thành viên {i + 1}
            </span>
            {m.name && (
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {m.name}
              </span>
            )}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 mb-3.5">
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
                  value={m.cccd || ''} 
                  onChange={e => { 
                    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                    const newM = [...bhytMembers]; 
                    newM[i].cccd = val; 
                    newM[i].bhxh = val; 
                    setBhytMembers(newM); 
                    if (val.length === 12 && !isRenew && !recordId) {
                      autoFillCustomerInfo(val, 'BHYT', i);
                    }
                  }} 
                  onBlur={e => {
                    if (e.target.value && !isRenew && !recordId) {
                      autoFillCustomerInfo(e.target.value, 'BHYT', i);
                    }
                  }} 
                  className="w-full h-[42px] pl-3.5 pr-8 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" 
                  maxLength={12} 
                  placeholder="12 số CCCD/ĐDCN" 
                />
                <button
                  type="button"
                  title="Tra cứu CSDL cho thành viên này"
                  onClick={() => m.cccd && autoFillCustomerInfo(m.cccd, 'BHYT', i)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#004182] transition-colors p-1 rounded-lg cursor-pointer"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Mã BHXH cũ (10 số) <span className="text-gray-400 font-normal">(Tùy chọn)</span>
              </label>
              <input 
                type="text" 
                inputMode="numeric" 
                value={m.oldBhxh || ''} 
                onChange={e => { 
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  const newM = [...bhytMembers]; 
                  newM[i].oldBhxh = val; 
                  setBhytMembers(newM); 
                  if (val.length === 10 && !isRenew && !recordId) {
                    autoFillCustomerInfo(val, 'BHYT', i);
                  }
                }} 
                onBlur={e => {
                  if (e.target.value.length === 10 && !isRenew && !recordId) {
                    autoFillCustomerInfo(e.target.value, 'BHYT', i);
                  }
                }}
                className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" 
                maxLength={10} 
                placeholder="Mã BHXH 10 số (nếu có)" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Họ và tên (*)</label>
              <input type="text" required={!isRenew && !recordId && i===0} value={m.name || ''} onChange={e => { const newM = [...bhytMembers]; newM[i].name = formatTitleCase(e.target.value); setBhytMembers(newM); if (i === 0 && !isRenew && !recordId) setFormData((prev: any) => ({ ...prev, recvName: formatTitleCase(e.target.value) })); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder={`Họ tên thành viên ${i + 1}`} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 mb-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Ngày sinh</label>
              <input 
                type="text" 
                inputMode="numeric" 
                placeholder="DD/MM/YYYY" 
                maxLength={10} 
                value={m.dob || ''} 
                onChange={e => { 
                  const newM = [...bhytMembers]; 
                  newM[i].dob = formatDateInputMask(e.target.value); 
                  setBhytMembers(newM); 
                }} 
                className={`w-full h-[42px] px-3.5 rounded-xl border text-sm outline-none bg-white text-gray-900 font-bold transition-all ${
                  m.dob && m.dob.length === 10 && validateDOBInput(m.dob) 
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' 
                    : 'border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/10'
                }`} 
              />
              {m.dob && m.dob.length === 10 && validateDOBInput(m.dob) && (
                <p className="text-red-500 text-[11px] mt-1 font-medium">{validateDOBInput(m.dob)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Giới tính</label>
              <select value={m.gender || 'Nam'} onChange={e => { const newM = [...bhytMembers]; newM[i].gender = e.target.value; setBhytMembers(newM); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold cursor-pointer">
                <option>Nam</option>
                <option>Nữ</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Dân tộc</label>
              <select value={m.nation || 'Kinh'} onChange={e => { const newM = [...bhytMembers]; newM[i].nation = e.target.value; setBhytMembers(newM); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold cursor-pointer">
                <option value="Kinh">Kinh</option>
                <option value="Thiểu_số">Thiểu_số</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại</label>
              <input type="text" inputMode="numeric" value={m.phone || ''} onChange={e => { const newM = [...bhytMembers]; newM[i].phone = e.target.value; setBhytMembers(newM); if (i === 0 && !isRenew && !recordId) setFormData((prev: any) => ({ ...prev, recvPhone: e.target.value })); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder="SĐT liên hệ" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ</label>
              <input type="text" value={m.address || ''} onChange={e => { const newM = [...bhytMembers]; newM[i].address = e.target.value; setBhytMembers(newM); if (i === 0 && !isRenew && !recordId) setFormData((prev: any) => ({ ...prev, recvAddress: e.target.value })); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder="Bản, Xã, Huyện..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
              <input type="email" value={m.email || ''} onChange={e => { const newM = [...bhytMembers]; newM[i].email = e.target.value; setBhytMembers(newM); }} className="w-full h-[42px] px-3.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder="Email liên hệ" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default BHYTForm;
