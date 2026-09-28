import React from 'react';
import { Sliders, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { formatMoney, parseMonthISO, getLocalYYYYMMDD } from '../../../utils/helpers';
import { formatMonthInputMask } from '../../../utils/dateFormatter';
import { CONSTANTS } from '../../../utils/constants';
import { useAppContext } from '../../../context/AppContext';
import { getPolicyValueForDate } from '../../../utils/calculations';

interface BHXHCalcSettingsProps {
  bhxhCalc: any;
  setBhxhCalc: React.Dispatch<React.SetStateAction<any>>;
}

const BHXHCalcSettings: React.FC<BHXHCalcSettingsProps> = ({ bhxhCalc, setBhxhCalc }) => {
  const { settings, policies } = useAppContext();
  
  const dateStr = bhxhCalc.fromMonth ? parseMonthISO(bhxhCalc.fromMonth) + '-01' : getLocalYYYYMMDD();
  const povertyStandard = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || CONSTANTS.POVERTY_LINE))
    : (settings?.povertyStandard || CONSTANTS.POVERTY_LINE);
  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || 2340000))
    : (settings?.baseSalary || 2340000);

  const incomeOptions = [];
  const dynamicIncomeMax = baseSalary * 20;
  for (let i = povertyStandard; i <= dynamicIncomeMax; i += CONSTANTS.INCOME_STEP) {
    incomeOptions.push(i);
  }

  return (
    <div className="space-y-3.5 pt-1">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <Sliders className="text-[#004182] shrink-0" size={18} />
        <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">Thiết Lập Mức Đóng</h4>
      </div>

      {/* Cảnh báo / Thông báo tiến độ hỗ trợ NSNN 10 năm theo Luật BHXH 2024 */}
      {bhxhCalc.previousMonths !== undefined && bhxhCalc.previousMonths > 0 && (
        <div className="space-y-2">
          {bhxhCalc.previousMonths >= 120 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3 sm:p-3.5 text-xs sm:text-sm text-amber-900 shadow-xs flex items-start gap-2.5">
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-amber-950">
                    Đã tích lũy {bhxhCalc.previousMonths} tháng (≥ 10 năm) BHXH tự nguyện
                  </span>
                  <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                    Hết hạn hỗ trợ NSNN
                  </span>
                </div>
                <p className="mt-1 text-amber-800 leading-relaxed text-xs">
                  Căn cứ <strong>Khoản 1 Điều 36 Luật BHXH 2024 &amp; Nghị định 159/2025/NĐ-CP</strong>: Nhà nước chỉ hỗ trợ tiền đóng tối đa 10 năm (120 tháng). Kỳ này người tham gia đóng <strong>100% mức đóng gốc</strong> (22% mức thu nhập chọn, không trừ tiền hỗ trợ).
                </p>
              </div>
            </div>
          ) : (bhxhCalc.unsupportedMonthsCount || 0) > 0 ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-3 sm:p-3.5 text-xs sm:text-sm text-blue-900 shadow-xs flex items-start gap-2.5">
              <Info className="text-blue-600 shrink-0 mt-0.5" size={18} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-black text-blue-950">
                    Chuyển tiếp trần hỗ trợ 10 năm (Đã tích lũy {bhxhCalc.previousMonths}/120 tháng)
                  </span>
                  <span className="bg-blue-200 text-blue-900 text-[10px] px-2 py-0.5 rounded-full font-black uppercase">
                    Giai đoạn chuyển tiếp
                  </span>
                </div>
                <p className="mt-1 text-blue-800 leading-relaxed text-xs">
                  Kỳ này gồm <strong>{bhxhCalc.supportedMonthsCount} tháng đầu</strong> được hưởng hỗ trợ NSNN (vừa đủ 120 tháng trần hỗ trợ) và <strong>{bhxhCalc.unsupportedMonthsCount} tháng sau</strong> đóng 100% mức đóng gốc theo Luật BHXH 2024.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 sm:p-3 text-xs text-emerald-900 shadow-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Tiến độ hỗ trợ NSNN: Đã dùng <strong>{bhxhCalc.previousMonths}/120 tháng</strong> (Còn lại <strong>{Math.max(0, 120 - (bhxhCalc.totalAccumulatedMonths || bhxhCalc.previousMonths))} tháng</strong> được hỗ trợ).
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-slate-50/70 p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Mức thu nhập lựa chọn</label>
            <select value={bhxhCalc.income ?? 1500000} onChange={e => setBhxhCalc({...bhxhCalc, income: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer">
              {incomeOptions.map(opt => <option key={opt} value={opt}>{formatMoney(opt)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Hỗ trợ từ Nhà nước</label>
            <select value={bhxhCalc.nnSupport ?? 20} onChange={e => setBhxhCalc({...bhxhCalc, nnSupport: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer">
              <option value="20">Khác (20%)</option>
              <option value="50">Hộ nghèo (50%)</option>
              <option value="40">Hộ cận nghèo (40%)</option>
              <option value="30">Dân tộc thiểu số (30%)</option>
              <option value="10">Khác (10%)</option>
              <option value="0">Không hỗ trợ (0%)</option>
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Hỗ trợ từ Địa phương</label>
            <select value={bhxhCalc.dpSupport ?? 0} onChange={e => setBhxhCalc({...bhxhCalc, dpSupport: Number(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer">
              <option value="0">Hỗ trợ 0%</option>
              <option value="5">Hỗ trợ 5%</option>
              <option value="10">Hỗ trợ 10%</option>
              <option value="20">Hỗ trợ 20%</option>
              <option value="30">Hỗ trợ 30%</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className={`transition-all duration-300 ${bhxhCalc.method === 'post_custom' ? '' : 'md:col-span-2'}`}>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Phương thức đóng</label>
            <select id="modal-bhxh-method" value={bhxhCalc.method || '1'} onChange={e => setBhxhCalc({...bhxhCalc, method: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer">
              <option value="1">Đóng hằng tháng</option>
              <option value="3">Đóng 3 tháng</option>
              <option value="6">Đóng 6 tháng</option>
              <option value="12">Đóng 12 tháng</option>
              <option disabled style={{fontWeight: 'bold', color: '#004182'}}>--- ĐÓNG TRƯỚC VỀ SAU ---</option>
              <option value="pre_24">Đóng trước 2 năm</option>
              <option value="pre_36">Đóng trước 3 năm</option>
              <option value="pre_48">Đóng trước 4 năm</option>
              <option value="pre_60">Đóng trước 5 năm</option>
              <option disabled style={{fontWeight: 'bold', color: '#004182'}}>--- ĐÓNG BÙ THỜI GIAN THIẾU ---</option>
              <option value="post_custom">Đóng 1 lần để nghỉ hưu</option>
            </select>
          </div>
          {bhxhCalc.method === 'post_custom' && (
            <div className="transition-all duration-300">
              <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Số tháng đóng bù</label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={bhxhCalc.customMonths}
                  onChange={e => setBhxhCalc({...bhxhCalc, customMonths: Math.min(60, Math.max(1, Number(e.target.value)))})}
                  className="w-full p-3 rounded-2xl border border-gray-200 pr-14 text-base bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 font-extrabold text-gray-900 outline-none transition-all"
                  min="1"
                  max="60"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm pointer-events-none">tháng</span>
              </div>
              <p className="flex items-center gap-1.5 text-red-500 text-xs sm:text-[13px] mt-1.5 font-medium">
                <AlertTriangle size={13} className="shrink-0 text-red-500" />
                <span>Tối đa 60 tháng</span>
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-gray-200">
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Từ tháng</label>
            <input type="text" inputMode="numeric" value={bhxhCalc.fromMonth} onChange={e => setBhxhCalc({...bhxhCalc, fromMonth: formatMonthInputMask(e.target.value)})} placeholder="MM/YYYY" maxLength={7} className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-white font-bold text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-500 mb-1.5">Đến tháng</label>
            <input type="text" value={bhxhCalc.toMonth} placeholder="MM/YYYY" className="w-full p-3 rounded-xl border border-gray-200 text-sm bg-gray-100 font-bold text-gray-400 cursor-not-allowed outline-none" readOnly />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BHXHCalcSettings;
