import React, { useState, useEffect } from 'react';
import { CONSTANTS } from '../../utils/constants';
import { useAppContext } from '../../context/AppContext';
import { formatMoney } from '../../utils/helpers';
import { calculateBHYT, getPolicyValueForDate } from '../../utils/calculations';
import { HeartPulse, Activity } from 'lucide-react';

interface BHYTCalcProps {
  onRegister: (data?: any) => void;
}

const BHYTCalc: React.FC<BHYTCalcProps> = ({ onRegister }) => {
  const { settings, policies } = useAppContext();
  const [numMembers, setNumMembers] = useState(1);
  const [duration, setDuration] = useState(12);

  // Get base salary effective today
  const dateStr = new Date().toISOString().split('T')[0];
  const baseSalary = policies && policies.length > 0
    ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || CONSTANTS.BHYT_BASE))
    : (settings?.baseSalary || CONSTANTS.BHYT_BASE);

  const [calcResult, setCalcResult] = useState({
    total: 0,
    breakdown: [] as { title: string, label: string, amount: number }[]
  });

  useEffect(() => {
    updateCalc();
  }, [numMembers, duration, baseSalary]);

  const updateCalc = () => {
    const calcResult = calculateBHYT(duration, numMembers, baseSalary);
    setCalcResult({ total: calcResult.amount, breakdown: calcResult.breakdown });
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 relative transition-all duration-300">
      {/* Input panel */}
      <div className="flex-grow bg-slate-50/70 border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-7 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 mb-0.5 flex items-center">
              <HeartPulse className="text-[#004182] mr-2 shrink-0" size={20} /> <span>Tham số dự toán BHYT</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">Ước tính mức đóng BHYT hộ gia đình với cơ chế giảm trừ tự động.</p>
          </div>
          <span className="text-xs bg-blue-100 text-[#004182] font-extrabold px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-auto border border-blue-200/60">
            Mức tham chiếu: {formatMoney(baseSalary)}
          </span>
        </div>
        
        <div className="bg-blue-50/70 p-3.5 sm:p-4 rounded-xl border border-blue-200/60">
          <p className="text-xs sm:text-sm text-[#004182] font-semibold leading-relaxed">
            Giảm trừ mức đóng từ thành viên thứ 2 trở đi: <br className="hidden sm:inline" />
            <strong className="text-secondary-bright bg-[#004182] px-2.5 py-1 rounded-lg ml-1 font-black inline-block mt-1 sm:mt-0 text-xs sm:text-sm">
              100% ➔ 70% ➔ 60% ➔ 50% ➔ 40%
            </strong>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs sm:text-[13px] font-bold text-slate-600 mb-1.5 block">Số người tham gia</label>
            <div className="relative">
              <select 
                value={numMembers || 1} 
                onChange={(e) => setNumMembers(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition-all cursor-pointer appearance-none h-[46px]"
              >
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <option key={n} value={n}>{n} người</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
          
          <div>
            <label className="text-xs sm:text-[13px] font-bold text-slate-600 mb-1.5 block">Số tháng đóng</label>
            <div className="relative">
              <select 
                value={duration || 12} 
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 sm:py-3 pl-4 pr-10 text-xs sm:text-sm font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition-all cursor-pointer appearance-none h-[46px]"
              >
                <option value="12">Đóng 12 tháng (1 năm)</option>
                <option value="6">Đóng 6 tháng</option>
                <option value="3">Đóng 3 tháng</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Display Card */}
      <div className="lg:w-[380px] shrink-0">
        <div className="bg-[#004182] h-full rounded-2xl sm:rounded-3xl text-white p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary-bright/20 blur-[100px] rounded-full"></div>
          
          <h3 className="text-xl font-black mb-5 border-b border-white/10 pb-4 relative z-10 flex items-center gap-2.5">
            <Activity className="text-secondary-bright" size={20} /> Chi Tiết Thanh Toán
          </h3>

          <div className="bg-white/5 rounded-xl overflow-hidden flex flex-col border border-white/10 mb-6 max-h-[200px] relative z-10">
            <div className="bg-white/10 px-4 py-2.5 border-b border-white/10 text-[10px] font-bold text-white/70 flex justify-between uppercase tracking-wider">
              <span>Thành viên</span><span>Mức đóng (VNĐ)</span>
            </div>
            <div className="divide-y divide-white/5 flex-1 overflow-y-auto">
              {calcResult.breakdown.map((item, idx) => (
                <div key={idx} className="px-4 py-3 flex justify-between items-center text-xs sm:text-sm hover:bg-white/5 transition">
                  <div>
                    <span className="font-semibold text-white/95">{item.title}</span>
                    <span className="text-[9px] text-[#ffdea6] bg-[#ffdea6]/10 px-2 py-0.5 rounded-full ml-2 font-bold">{item.label}</span>
                  </div>
                  <span className="font-bold text-white">{formatMoney(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-auto relative z-10 pt-4">
            <div className="mb-4">
              <span className="text-white/60 text-[11px] font-black uppercase tracking-wider block mb-1">TỔNG CẦN THANH TOÁN</span>
              <div className="flex items-end gap-2 text-right justify-end">
                <span className="font-black text-3xl sm:text-4xl text-secondary-bright tracking-tight">
                  {formatMoney(calcResult.total).replace(' đ', '')}
                </span>
                <span className="text-gray-300 font-bold mb-1 text-sm">VNĐ</span>
              </div>
            </div>
            
            <button 
              onClick={() => onRegister({ numMembers, duration })}
              className="w-full bg-white text-[#004182] py-3.5 rounded-xl font-black text-base hover:bg-secondary-bright hover:text-primary-dark transition-all active:scale-[0.97] shadow-lg cursor-pointer text-center flex items-center justify-center gap-2 border-none outline-none"
            >
              <HeartPulse size={18} /> TIẾP TỤC ĐĂNG KÝ
            </button>
            
            <div className="mt-4 flex items-center justify-center text-white/50 text-xs font-medium gap-1.5">
              <Activity size={13} /> Giao dịch được bảo mật và mã hóa
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BHYTCalc;

