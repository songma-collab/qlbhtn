import React from 'react';
import { TrendingUp, RotateCw, Sparkles, CheckCircle2 } from 'lucide-react';

export interface BHXHActionTypeSelectorProps {
  actionType: 'Tăng mới' | 'Gia hạn';
  onChange: (type: 'Tăng mới' | 'Gia hạn') => void;
  previousMonths: number;
  commBHXHNewPct?: number;
  commBHXHRenewPct?: number;
  isRenew?: boolean;
  hasPreviousRenew?: boolean;
}

export const BHXHActionTypeSelector: React.FC<BHXHActionTypeSelectorProps> = ({
  actionType,
  onChange,
  previousMonths,
  isRenew = false,
  hasPreviousRenew = false,
}) => {
  const isSuggestedNew = isRenew && previousMonths < 12 && !hasPreviousRenew;
  const isSuggestedRenew = isRenew && (previousMonths >= 12 || hasPreviousRenew);

  return (
    <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/70 p-4 sm:p-5 rounded-2xl border-2 border-blue-200/90 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-100 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[#004182] shrink-0" size={18} />
          <h4 className="font-extrabold text-[#004182] text-sm sm:text-base">
            Phân Loại Nghiệp Vụ Hồ Sơ Đóng BHXH
          </h4>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 font-medium">Tích lũy tại đại lý:</span>
          <span className="font-black text-[#004182] bg-white px-2 py-0.5 rounded-md border border-blue-200 shadow-2xs">
            {previousMonths} tháng
          </span>
        </div>
      </div>

      {/* 2 Nút tích chọn phân loại hồ sơ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Nút 1: Hồ Sơ Tăng Mới */}
        <label
          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
            actionType === 'Tăng mới'
              ? 'bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/10'
              : 'bg-white/60 border-gray-200 hover:border-emerald-300 hover:bg-white'
          }`}
        >
          <input
            type="radio"
            name="bhxh_action_type_choice"
            value="Tăng mới"
            checked={actionType === 'Tăng mới'}
            onChange={() => onChange('Tăng mới')}
            className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 cursor-pointer accent-emerald-600"
          />
          <div className="flex-1 min-w-0">
            <span className="font-black text-gray-900 text-sm flex items-center gap-1.5 truncate">
              <TrendingUp size={16} className="text-emerald-600 shrink-0" />
              Hồ Sơ Tăng Mới
            </span>
            {isSuggestedNew && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>Gợi ý: Mới tích lũy {previousMonths}/12 tháng (Được tính tăng mới)</span>
              </div>
            )}
          </div>
        </label>

        {/* Nút 2: Hồ Sơ Gia Hạn */}
        <label
          className={`relative flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
            actionType === 'Gia hạn'
              ? 'bg-white border-[#FDB913] shadow-md ring-2 ring-amber-500/10'
              : 'bg-white/60 border-gray-200 hover:border-amber-300 hover:bg-white'
          }`}
        >
          <input
            type="radio"
            name="bhxh_action_type_choice"
            value="Gia hạn"
            checked={actionType === 'Gia hạn'}
            onChange={() => onChange('Gia hạn')}
            className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 cursor-pointer accent-amber-600"
          />
          <div className="flex-1 min-w-0">
            <span className="font-black text-gray-900 text-sm flex items-center gap-1.5 truncate">
              <RotateCw size={16} className="text-amber-600 shrink-0" />
              Hồ Sơ Gia Hạn
            </span>
            {isSuggestedRenew && (
              <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>
                  {hasPreviousRenew && previousMonths < 12
                    ? `Gợi ý: Hồ sơ đã xác nhận gia hạn (${previousMonths} tháng tại đại lý)`
                    : `Gợi ý: Đã tích lũy ${previousMonths} tháng (≥ 12 tháng tính gia hạn)`}
                </span>
              </div>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};

export default BHXHActionTypeSelector;

