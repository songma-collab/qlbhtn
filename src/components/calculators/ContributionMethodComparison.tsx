import React, { useMemo } from 'react';
import { formatMoney } from '../../utils/helpers';
import { calculateBHXH } from '../../utils/calculations';
import { CONSTANTS } from '../../utils/constants';
import type { Policy } from '../../context/types';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  Shield,
  Clock,
  Layers,
  Zap
} from 'lucide-react';

interface ContributionMethodComparisonProps {
  income: number;
  nnSupport?: number;
  dpSupport?: number;
  povertyStandard: number;
  fromMonth?: string;
  investmentRate?: number;
  policies?: Policy[];
  selectedMethod?: string;
  onSelectMethod?: (method: string) => void;
  onRegisterWithMethod?: (method: string, calcData: any) => void;
  className?: string;
}

interface MethodItem {
  key: string;
  name: string;
  durationLabel: string;
  months: number;
  badge?: string;
  badgeBg?: string;
  isPopular?: boolean;
  isDiscount?: boolean;
  highlightBorder?: string;
}

export const ContributionMethodComparison: React.FC<ContributionMethodComparisonProps> = ({
  income,
  nnSupport = 20,
  dpSupport = 0,
  povertyStandard,
  fromMonth,
  investmentRate = CONSTANTS.INTEREST,
  policies,
  selectedMethod = '1',
  onSelectMethod,
  onRegisterWithMethod,
  className = ''
}) => {
  const methodsConfig: MethodItem[] = [
    {
      key: '1',
      name: 'Đóng Hằng Tháng',
      durationLabel: '1 tháng',
      months: 1,
      badge: 'Cơ bản',
      badgeBg: 'bg-gray-100 text-gray-700'
    },
    {
      key: '3',
      name: 'Đóng 3 Tháng',
      durationLabel: '1 Quý (3 tháng)',
      months: 3,
      badge: 'Theo Quý',
      badgeBg: 'bg-blue-50 text-blue-700 border border-blue-200'
    },
    {
      key: '6',
      name: 'Đóng 6 Tháng',
      durationLabel: 'Nửa năm (6 tháng)',
      months: 6,
      badge: 'Bán niên',
      badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    },
    {
      key: '12',
      name: 'Đóng 12 Tháng',
      durationLabel: '1 năm (12 tháng)',
      months: 12,
      badge: '⭐ Phổ biến nhất',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-black',
      isPopular: true,
      highlightBorder: 'ring-2 ring-emerald-500/40 bg-emerald-50/20'
    },
    {
      key: 'pre_24',
      name: 'Đóng Trước 2 Năm',
      durationLabel: '2 năm (24 tháng)',
      months: 24,
      badge: '🔥 Chiết khấu lãi suất',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-300 font-black',
      isDiscount: true,
      highlightBorder: 'border-amber-300 bg-amber-50/15'
    },
    {
      key: 'pre_36',
      name: 'Đóng Trước 3 Năm',
      durationLabel: '3 năm (36 tháng)',
      months: 36,
      badge: '🔥 Tiết kiệm vượt trội',
      badgeBg: 'bg-amber-100 text-amber-900 border border-amber-400 font-black',
      isDiscount: true,
      highlightBorder: 'border-amber-400 bg-amber-50/25'
    },
    {
      key: 'pre_60',
      name: 'Đóng Trước 5 Năm',
      durationLabel: '5 năm (60 tháng)',
      months: 60,
      badge: '🏆 Ưu đãi tối đa',
      badgeBg: 'bg-purple-100 text-purple-900 border border-purple-300 font-black',
      isDiscount: true,
      highlightBorder: 'border-purple-300 bg-purple-50/25'
    }
  ];

  // Tính toán số liệu so sánh cho từng phương thức
  const calculatedRows = useMemo(() => {
    return methodsConfig.map(m => {
      const calc = calculateBHXH(
        income,
        nnSupport,
        dpSupport,
        m.key,
        1,
        fromMonth,
        investmentRate,
        povertyStandard,
        policies
      );

      const totalSupport = calc.nnSupportAmount + calc.dpSupportAmount;
      const avgMonthly = Math.round(calc.amount / m.months);
      const isSelected = selectedMethod === m.key;

      return {
        ...m,
        calc,
        totalSupport,
        avgMonthly,
        isSelected
      };
    });
  }, [methodsConfig, income, nnSupport, dpSupport, fromMonth, investmentRate, povertyStandard, policies, selectedMethod]);

  return (
    <div className={`w-full bg-white rounded-3xl border border-gray-100 shadow-md p-5 sm:p-8 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-black mb-1.5 border border-amber-200">
            <Zap size={13} className="text-amber-600 fill-amber-500" />
            So Sánh Toàn Diện Các Phương Thức Đóng BHXH Tự Nguyện
          </div>
          <h3 className="text-lg sm:text-2xl font-black text-[#004182] tracking-tight">
            Bảng So Sánh Quyền Lợi & Ưu Đãi Đóng Trước Dài Hạn
          </h3>
          <p className="text-xs sm:text-sm text-gray-500">
            Mức thu nhập lựa chọn: <span className="font-bold text-[#004182]">{formatMoney(income)}</span>. Hỗ trợ NSNN &amp; ĐP: <span className="font-bold text-emerald-700">{nnSupport + dpSupport}%</span> chuẩn nghèo.
          </p>
        </div>

        {/* Note on discount */}
        <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200/80 max-w-sm text-xs text-amber-900 flex items-start gap-2">
          <Sparkles size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Ưu đãi đóng trước:</strong> Đóng trước 2 – 5 năm được hưởng chiết khấu giảm trừ trực tiếp theo lãi suất đầu tư quỹ BHXH!
          </span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200/80 shadow-xs">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-[#004182] text-white font-semibold">
            <tr>
              <th className="p-3.5 sm:p-4">Phương Thức Đóng</th>
              <th className="p-3.5 sm:p-4 text-center">Thời Gian</th>
              <th className="p-3.5 sm:p-4 text-right">Mức Đóng Gốc</th>
              <th className="p-3.5 sm:p-4 text-right">NSNN &amp; ĐP Hỗ Trợ</th>
              <th className="p-3.5 sm:p-4 text-right text-amber-300">Chiết Khấu Ưu Đãi</th>
              <th className="p-3.5 sm:p-4 text-right font-black">Số Tiền Thực Đóng</th>
              <th className="p-3.5 sm:p-4 text-right">Bình Quân / Tháng</th>
              <th className="p-3.5 sm:p-4 text-center">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {calculatedRows.map(row => (
              <tr
                key={row.key}
                onClick={() => onSelectMethod && onSelectMethod(row.key)}
                className={`transition cursor-pointer ${
                  row.isSelected
                    ? 'bg-blue-50/70 font-semibold'
                    : row.isPopular
                    ? 'bg-emerald-50/30 hover:bg-emerald-50/60'
                    : row.isDiscount
                    ? 'bg-amber-50/30 hover:bg-amber-50/60'
                    : 'hover:bg-gray-50'
                }`}
              >
                {/* Method Name & Badge */}
                <td className="p-3.5 sm:p-4 font-bold text-gray-900">
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={15} className={row.isDiscount ? 'text-amber-600' : 'text-[#004182]'} />
                      <span className={row.isSelected ? 'text-[#004182]' : ''}>{row.name}</span>
                    </div>
                    {row.badge && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${row.badgeBg}`}>
                        {row.badge}
                      </span>
                    )}
                  </div>
                </td>

                {/* Duration */}
                <td className="p-3.5 sm:p-4 text-center text-gray-600 font-mono">
                  {row.durationLabel}
                </td>

                {/* Gross Amount */}
                <td className="p-3.5 sm:p-4 text-right text-gray-500 font-mono">
                  {formatMoney(row.calc.basePremium)}
                </td>

                {/* Support Amount */}
                <td className="p-3.5 sm:p-4 text-right text-emerald-700 font-mono font-bold">
                  -{formatMoney(row.totalSupport)}
                </td>

                {/* Discount Amount */}
                <td className="p-3.5 sm:p-4 text-right font-mono font-black">
                  {row.calc.discountAmount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs shadow-xs">
                      <TrendingDown size={13} className="text-amber-700" />
                      -{formatMoney(row.calc.discountAmount)}
                    </span>
                  ) : (
                    <span className="text-gray-400 font-normal">-</span>
                  )}
                </td>

                {/* Final Net Amount */}
                <td className="p-3.5 sm:p-4 text-right font-black text-sm sm:text-base text-[#004182]">
                  {formatMoney(row.calc.amount)}
                </td>

                {/* Average / month */}
                <td className="p-3.5 sm:p-4 text-right font-mono font-bold text-gray-700">
                  {formatMoney(row.avgMonthly)}/th
                </td>

                {/* Actions */}
                <td className="p-3.5 sm:p-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelectMethod && onSelectMethod(row.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        row.isSelected
                          ? 'bg-[#004182] text-white shadow-xs'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {row.isSelected ? 'Đang chọn' : 'Chọn gói'}
                    </button>

                    {onRegisterWithMethod && (
                      <button
                        type="button"
                        onClick={() => onRegisterWithMethod(row.key, row.calc)}
                        title="Đăng ký trực tiếp với phương thức này"
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <span>Đăng ký</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Notes */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <Shield size={14} className="text-[#004182]" />
          <span>Áp dụng quy chuẩn tính toán của BHXH Việt Nam &amp; Nghị định 159/2025/NĐ-CP.</span>
        </div>
        <div className="text-[11px] text-gray-400 italic">
          * Lãi suất chiết khấu đóng trước tính theo lãi suất đầu tư bình quân quỹ BHXH công bố hàng năm.
        </div>
      </div>
    </div>
  );
};

export default ContributionMethodComparison;
