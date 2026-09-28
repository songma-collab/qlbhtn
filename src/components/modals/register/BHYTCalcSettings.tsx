import React from 'react';
import { Sliders, Truck } from 'lucide-react';
import { formatTitleCase } from '../../../utils/helpers';

interface BHYTCalcSettingsProps {
  bhytMembers: any[];
  setBhytMembers: React.Dispatch<React.SetStateAction<any[]>>;
  bhytCalc: any;
  setBhytCalc: React.Dispatch<React.SetStateAction<any>>;
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  isRenew: boolean;
  recordId: number | null;
}

const BHYTCalcSettings: React.FC<BHYTCalcSettingsProps> = ({
  bhytMembers,
  setBhytMembers,
  bhytCalc,
  setBhytCalc,
  formData,
  setFormData,
  isRenew,
  recordId
}) => {
  return (
    <>
      <div className="space-y-3.5 pt-1">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
          <Sliders className="text-[#004182] shrink-0" size={18} />
          <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">Thiết Lập Mức Đóng</h4>
        </div>
        <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Số người tham gia:</label>
            <select 
              value={bhytMembers.length || 1} 
              onChange={e => {
                const num = Number(e.target.value);
                const currentMembers = [...bhytMembers];
                if (num > currentMembers.length) {
                  for (let i = currentMembers.length; i < num; i++) {
                    currentMembers.push({ name: '', cccd: '', phone: '', dob: '', gender: 'Nam', address: '', bhxh: '' });
                  }
                } else if (num < currentMembers.length) {
                  currentMembers.splice(num);
                }
                setBhytMembers(currentMembers);
              }} 
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-gray-800 h-[50px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <option key={n} value={n}>{n} người</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Số tháng đóng (Kỳ đóng):</label>
            <select 
              id="modal-bhyt-duration" 
              value={bhytCalc.duration || 12} 
              onChange={e => {
                const dur = Number(e.target.value);
                setBhytCalc({ ...bhytCalc, duration: dur });
                if (!bhytCalc.isCoterminous) {
                  setBhytMembers(bhytMembers.map(m => ({ ...m, durationMonths: dur })));
                }
              }} 
              className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-gray-800 h-[50px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
            >
              <option value="12">Đóng 12 tháng (1 năm)</option>
              <option value="6">Đóng 6 tháng</option>
              <option value="3">Đóng 3 tháng</option>
            </select>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(bhytCalc.isCoterminous)}
                onChange={e => {
                  const isCot = e.target.checked;
                  setBhytCalc({ ...bhytCalc, isCoterminous: isCot });
                  if (!isCot) {
                    setBhytMembers(bhytMembers.map(m => ({ ...m, durationMonths: bhytCalc.duration })));
                  }
                }}
                className="w-4 h-4 text-[#004182] rounded border-gray-300 focus:ring-[#004182]"
              />
              <span className="text-sm font-bold text-gray-800">
                Đồng bộ ngày hết hạn (Đóng tháng lẻ 1-12 tháng cho từng thành viên)
              </span>
            </label>
            {bhytCalc.isCoterminous && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                Nghị định 146/2018/NĐ-CP
              </span>
            )}
          </div>

          {bhytCalc.isCoterminous && (
            <div className="space-y-2.5 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
              <p className="text-xs text-gray-600">
                Tùy chỉnh số tháng đóng lẻ (1 - 12 tháng) riêng cho từng người để thẻ cả gia đình cùng hết hạn vào 1 ngày. Biểu phí tự động áp dụng tỷ lệ giảm trừ theo thứ tự (100% - 70% - 60% - 50% - 40%).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {bhytMembers.map((m, idx) => {
                  const rates = ['100%', '70%', '60%', '50%'];
                  const rateStr = idx < 4 ? rates[idx] : '40%';
                  return (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-200 shadow-xs flex items-center justify-between">
                      <div className="text-xs">
                        <span className="font-bold text-gray-800 block truncate max-w-[120px]">
                          {m.name || `Thành viên ${idx + 1}`}
                        </span>
                        <span className="text-gray-400 text-[11px]">Bậc {idx + 1} ({rateStr})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <select
                          value={m.durationMonths || bhytCalc.duration || 12}
                          onChange={e => {
                            const newM = [...bhytMembers];
                            newM[idx] = { ...newM[idx], durationMonths: Number(e.target.value) };
                            setBhytMembers(newM);
                          }}
                          className="text-xs font-bold border border-gray-200 rounded px-2 py-1 bg-white text-gray-800 outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                            <option key={num} value={num}>{num} tháng</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {!isRenew && (
        <div className="space-y-3.5 pt-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Truck className="text-[#004182] shrink-0" size={18} />
            <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">Thông tin giao thẻ chung</h4>
          </div>
          <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Người nhận (*)</label>
              <input type="text" required={!isRenew && !recordId} value={formData.recvName || ''} onChange={e => setFormData({...formData, recvName: formatTitleCase(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">SĐT Nhận (*)</label>
              <input type="text" inputMode="numeric" required={!isRenew && !recordId} value={formData.recvPhone || ''} onChange={e => setFormData({...formData, recvPhone: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Địa chỉ Giao thẻ chung</label>
              <input type="text" value={formData.recvAddress || ''} onChange={e => setFormData({...formData, recvAddress: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Ghi chú</label>
              <input type="text" value={formData.recvNotes || ''} onChange={e => setFormData({...formData, recvNotes: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white text-gray-900 font-bold" />
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
};

export default BHYTCalcSettings;
