import React, { useState } from 'react';
import { Policy } from '../../context/types';
import { Calendar, CheckCircle2, History, ShieldCheck, DollarSign, Scale, Layers } from 'lucide-react';
import { formatDateVN } from '../../utils/helpers';

interface PolicyTimelineVisualizerProps {
  policies: Policy[];
  onActivatePolicy?: (id: number, parameterType: string) => void;
  isAdmin?: boolean;
}

export const PolicyTimelineVisualizer: React.FC<PolicyTimelineVisualizerProps> = ({
  policies,
  onActivatePolicy,
  isAdmin = false
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Lọc và sắp xếp theo ngày hiệu lực giảm dần
  const sortedPolicies = React.useMemo(() => {
    let list = [...policies];
    if (selectedType !== 'ALL') {
      list = list.filter(p => p.parameter_type === selectedType);
    }
    return list.sort((a, b) => {
      const dateA = new Date(a.effective_date || '1970-01-01').getTime();
      const dateB = new Date(b.effective_date || '1970-01-01').getTime();
      return dateB - dateA;
    });
  }, [policies, selectedType]);

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'base_salary':
        return <DollarSign size={16} className="text-emerald-600" />;
      case 'poverty_standard':
        return <Scale size={16} className="text-blue-600" />;
      case 'bhxh_voluntary_support':
      case 'nn_support_rates':
        return <ShieldCheck size={16} className="text-purple-600" />;
      default:
        return <Layers size={16} className="text-amber-600" />;
    }
  };

  const getCategoryName = (type: string) => {
    switch (type) {
      case 'base_salary':
        return 'Mức Lương Cơ Sở';
      case 'poverty_standard':
        return 'Chuẩn Nghèo Nông Thôn';
      case 'bhxh_voluntary_support':
      case 'nn_support_rates':
        return 'Tỷ Lệ Hỗ Trợ NSNN';
      case 'commission_rates':
        return 'Tỷ Lệ Hoa Hồng Đại Lý';
      case 'locked_periods':
        return 'Kỳ Khóa Sổ Kế Toán';
      default:
        return type;
    }
  };

  const formatValueDisplay = (policy: Policy) => {
    if (typeof policy.value === 'number') {
      return `${policy.value.toLocaleString('vi-VN')} đ`;
    }
    if (typeof policy.value === 'object' && policy.value !== null) {
      if (policy.parameter_type === 'nn_support_rates' || policy.parameter_type === 'bhxh_voluntary_support') {
        const p = policy.value;
        return `Nghèo: ${((p.poor ?? 0.5) * 100)}% | Cận nghèo: ${((p.nearPoor ?? 0.4) * 100)}% | DTTS: ${((p.ethnicMinority ?? 0.3) * 100)}% | Khác: ${((p.other ?? 0.2) * 100)}%`;
      }
      return JSON.stringify(policy.value);
    }
    return String(policy.value);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h3 className="text-lg font-bold text-[#004182] flex items-center gap-2">
            <History size={20} className="text-[#004182]" />
            Dòng Thời Gian Chính Sách & Căn Cứ Pháp Lý (Policy Timeline)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Lịch sử diễn biến các mốc áp dụng theo Luật BHXH 2024, Nghị định 159/2025/NĐ-CP và các văn bản điều hành
          </p>
        </div>

        {/* Filter Type */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-600">Phân loại:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-[#004182] cursor-pointer text-slate-800 transition"
          >
            <option value="ALL">Tất cả chính sách</option>
            <option value="base_salary">Mức lương cơ sở</option>
            <option value="poverty_standard">Chuẩn nghèo nông thôn</option>
            <option value="nn_support_rates">Tỷ lệ hỗ trợ NSNN</option>
            <option value="commission_rates">Hoa hồng đại lý</option>
            <option value="locked_periods">Kỳ khóa sổ</option>
          </select>
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
        {sortedPolicies.map((policy) => {
          const isActive = policy.is_active;

          return (
            <div key={policy.id || `${policy.parameter_type}-${policy.effective_date}`} className="relative group">
              {/* Dot marker */}
              <div
                className={`absolute -left-[27px] sm:-left-[35px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-xs transition-all ${
                  isActive
                    ? 'bg-[#004182] border-white text-white ring-4 ring-blue-100'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isActive ? <CheckCircle2 size={14} /> : <div className="w-2 h-2 rounded-full bg-gray-300" />}
              </div>

              {/* Card content */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-blue-50/40 border-blue-200 shadow-xs'
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white border border-gray-100 shadow-xs">
                      {getCategoryIcon(policy.parameter_type)}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                        {getCategoryName(policy.parameter_type)}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                        {policy.name}
                      </h4>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Đang có hiệu lực
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        Lịch sử / Đã thay thế
                      </span>
                    )}

                    {isAdmin && !isActive && onActivatePolicy && (
                      <button
                        onClick={() => onActivatePolicy(policy.id, policy.parameter_type)}
                        className="text-xs bg-white border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg font-bold transition shadow-xs cursor-pointer"
                      >
                        Kích hoạt mốc này
                      </button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-white/80 p-3 rounded-lg border border-gray-100/80">
                  <div>
                    <span className="text-gray-400 block font-medium">Giá trị / Thông số:</span>
                    <span className="font-bold text-gray-900 text-sm">
                      {formatValueDisplay(policy)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-medium">Thời điểm hiệu lực:</span>
                    <span className="font-semibold text-gray-700 flex items-center gap-1 mt-0.5">
                      <Calendar size={13} className="text-blue-500" />
                      {formatDateVN(policy.effective_date) || 'Áp dụng liên tục'}
                    </span>
                  </div>
                </div>

                {/* Description or Legal Basis */}
                {(policy.description || policy.notes) && (
                  <p className="mt-2.5 text-xs text-gray-600 italic">
                    Căn cứ: {policy.description || policy.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
