import React, { useState, useMemo } from 'react';
import { Policy } from '../../context/types';
import { 
  Calendar, CheckCircle2, History, ShieldCheck, DollarSign, Scale, 
  Layers, Percent, TrendingUp, Activity, FileText, ChevronDown, 
  ChevronUp, Search, Filter, Sparkles, X, Check
} from 'lucide-react';
import { formatMoney, formatDateVN } from '../../utils/helpers';

interface PolicyTimelineVisualizerProps {
  policies: Policy[];
  onActivatePolicy?: (id: number, parameterType: string, policyName?: string) => void;
  isAdmin?: boolean;
}

interface CategoryMeta {
  name: string;
  shortLabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeClass: string;
  iconBoxClass: string;
}

const CATEGORY_META_MAP: Record<string, CategoryMeta> = {
  base_salary: {
    name: 'Mức Lương Cơ Sở',
    shortLabel: 'Lương cơ sở',
    icon: DollarSign,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBoxClass: 'text-emerald-600 bg-emerald-50 border-emerald-100'
  },
  poverty_standard: {
    name: 'Chuẩn Nghèo Nông Thôn',
    shortLabel: 'Chuẩn nghèo NT',
    icon: Scale,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBoxClass: 'text-blue-600 bg-blue-50 border-blue-100'
  },
  commission: {
    name: 'Tỷ Lệ Hoa Hồng Đại Lý',
    shortLabel: 'Hoa hồng đại lý',
    icon: Percent,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBoxClass: 'text-purple-600 bg-purple-50 border-purple-100'
  },
  commission_rates: {
    name: 'Tỷ Lệ Hoa Hồng Đại Lý',
    shortLabel: 'Hoa hồng đại lý',
    icon: Percent,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBoxClass: 'text-purple-600 bg-purple-50 border-purple-100'
  },
  investment_rate: {
    name: 'Lãi Suất Đầu Tư Quỹ',
    shortLabel: 'Lãi suất đầu tư quỹ',
    icon: TrendingUp,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    iconBoxClass: 'text-amber-600 bg-amber-50 border-amber-100'
  },
  cpi_index: {
    name: 'Hệ Số Trượt Giá (CPI)',
    shortLabel: 'Hệ số trượt giá CPI',
    icon: Layers,
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    iconBoxClass: 'text-cyan-600 bg-cyan-50 border-cyan-100'
  },
  nn_support_rates: {
    name: 'Tỷ Lệ Hỗ Trợ NSNN',
    shortLabel: 'Tỷ lệ hỗ trợ NSNN',
    icon: ShieldCheck,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBoxClass: 'text-rose-600 bg-rose-50 border-rose-100'
  },
  bhxh_voluntary_support: {
    name: 'Tỷ Lệ Hỗ Trợ NSNN',
    shortLabel: 'Tỷ lệ hỗ trợ NSNN',
    icon: ShieldCheck,
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBoxClass: 'text-rose-600 bg-rose-50 border-rose-100'
  },
  locked_periods: {
    name: 'Kỳ Khóa Sổ Kế Toán',
    shortLabel: 'Kỳ khóa sổ',
    icon: Activity,
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
    iconBoxClass: 'text-red-600 bg-red-50 border-red-100'
  }
};

const getCategoryMeta = (type: string): CategoryMeta => {
  return CATEGORY_META_MAP[type] || {
    name: type.toUpperCase(),
    shortLabel: type,
    icon: Layers,
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    iconBoxClass: 'text-slate-600 bg-slate-50 border-slate-100'
  };
};

export const PolicyTimelineVisualizer: React.FC<PolicyTimelineVisualizerProps> = ({
  policies,
  onActivatePolicy,
  isAdmin = false
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCpiIds, setExpandedCpiIds] = useState<Record<string, boolean>>({});

  const toggleExpandCpi = (policyKey: string) => {
    setExpandedCpiIds(prev => ({
      ...prev,
      [policyKey]: !prev[policyKey]
    }));
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = policies.length;
    const activeCount = policies.filter(p => p.is_active).length;
    const inactiveCount = total - activeCount;
    return { total, activeCount, inactiveCount };
  }, [policies]);

  // Bộ lọc và sắp xếp
  const filteredPolicies = useMemo(() => {
    let list = [...policies];

    // Lọc theo loại chính sách (hỗ trợ alias giữa commission & commission_rates, v.v.)
    if (selectedType !== 'ALL') {
      if (selectedType === 'commission') {
        list = list.filter(p => p.parameter_type === 'commission' || p.parameter_type === 'commission_rates');
      } else if (selectedType === 'nn_support_rates') {
        list = list.filter(p => p.parameter_type === 'nn_support_rates' || p.parameter_type === 'bhxh_voluntary_support');
      } else {
        list = list.filter(p => p.parameter_type === selectedType);
      }
    }

    // Lọc theo trạng thái
    if (statusFilter === 'ACTIVE') {
      list = list.filter(p => p.is_active);
    } else if (statusFilter === 'INACTIVE') {
      list = list.filter(p => !p.is_active);
    }

    // Tìm kiếm theo từ khóa
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const notesMatch = (p.notes || '').toLowerCase().includes(q);
        const categoryMeta = getCategoryMeta(p.parameter_type);
        const catMatch = categoryMeta.name.toLowerCase().includes(q);
        return nameMatch || descMatch || notesMatch || catMatch;
      });
    }

    // Sắp xếp: ngày hiệu lực giảm dần, nếu cùng ngày thì bản ghi đang active xếp trước, sau đó theo ID giảm dần
    return list.sort((a, b) => {
      const dateA = new Date(a.effective_date || '1970-01-01').getTime();
      const dateB = new Date(b.effective_date || '1970-01-01').getTime();
      if (dateB !== dateA) return dateB - dateA;
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [policies, selectedType, statusFilter, searchQuery]);

  // Parse object an toàn từ value (tránh crash nếu là chuỗi JSON)
  const safeParseObject = (val: any) => {
    if (typeof val === 'object' && val !== null) return val;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }
    return null;
  };

  // Render chi tiết giá trị/thông số theo từng loại chính sách
  const renderPolicyValue = (policy: Policy) => {
    const pType = policy.parameter_type;
    const policyKey = String(policy.id || `${policy.parameter_type}-${policy.effective_date}`);

    // 1. TỶ LỆ HOA HỒNG ĐẠI LÝ (Commission)
    if (pType === 'commission' || pType === 'commission_rates') {
      const val = safeParseObject(policy.value) || {};
      const hasMethodRates = val.commBHXHNew1M !== undefined || val.commBHXHNew3M !== undefined;
      const new1M = val.commBHXHNew1M ?? 12;
      const new3M = val.commBHXHNew3M ?? 15;
      const new6M = val.commBHXHNew6M ?? 17;
      const new12M = val.commBHXHNew12M ?? val.commBHXHNew ?? 20;
      const bhxhRenew = val.commBHXHRenew ?? 9;
      const bhytNew = val.commBHYTNew ?? val.commBHYT ?? 9;
      const bhytRenew = val.commBHYTRenew ?? 5;

      if (hasMethodRates) {
        return (
          <div className="space-y-2 mt-1">
            <div className="bg-blue-50/70 border border-blue-200/70 rounded-xl p-2.5">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-tight block mb-1.5">
                BHXH Tự nguyện - Tăng mới theo phương thức
              </span>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-white/90 p-1 rounded border border-blue-200/60">
                  <span className="text-[9px] text-gray-500 block">1 Tháng</span>
                  <span className="text-xs sm:text-sm font-black text-blue-900">{`${new1M}%`}</span>
                </div>
                <div className="bg-white/90 p-1 rounded border border-blue-200/60">
                  <span className="text-[9px] text-gray-500 block">3 Tháng</span>
                  <span className="text-xs sm:text-sm font-black text-blue-900">{`${new3M}%`}</span>
                </div>
                <div className="bg-white/90 p-1 rounded border border-blue-200/60">
                  <span className="text-[9px] text-gray-500 block">6 Tháng</span>
                  <span className="text-xs sm:text-sm font-black text-blue-900">{`${new6M}%`}</span>
                </div>
                <div className="bg-white/90 p-1 rounded border border-blue-200/60">
                  <span className="text-[9px] text-gray-500 block">12 Tháng</span>
                  <span className="text-xs sm:text-sm font-black text-blue-900">{`${new12M}%`}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-sky-50/90 border border-sky-200/80 rounded-xl p-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-tight block">BHXH Gia Hạn</span>
                <span className="text-sm sm:text-base font-black text-sky-900">{`${bhxhRenew}%`}</span>
              </div>
              <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight block">BHYT Mới</span>
                <span className="text-sm sm:text-base font-black text-emerald-900">{`${bhytNew}%`}</span>
              </div>
              <div className="bg-teal-50/90 border border-teal-200/80 rounded-xl p-2 text-center shadow-2xs">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">BHYT Gia Hạn</span>
                <span className="text-sm sm:text-base font-black text-teal-900">{`${bhytRenew}%`}</span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-2 mt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-blue-50/90 border border-blue-200/80 rounded-xl p-2.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-tight block">BHXH Mới</span>
              <span className="text-base sm:text-lg font-black text-blue-900">{`${new12M}%`}</span>
            </div>
            <div className="bg-sky-50/90 border border-sky-200/80 rounded-xl p-2.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-sky-700 uppercase tracking-tight block">BHXH Gia Hạn</span>
              <span className="text-base sm:text-lg font-black text-sky-900">{`${bhxhRenew}%`}</span>
            </div>
            <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight block">BHYT Mới</span>
              <span className="text-base sm:text-lg font-black text-emerald-900">{`${bhytNew}%`}</span>
            </div>
            <div className="bg-teal-50/90 border border-teal-200/80 rounded-xl p-2.5 text-center shadow-2xs">
              <span className="text-[10px] font-bold text-teal-700 uppercase tracking-tight block">BHYT Gia Hạn</span>
              <span className="text-base sm:text-lg font-black text-teal-900">{`${bhytRenew}%`}</span>
            </div>
          </div>
        </div>
      );
    }

    // 2. MỨC LƯƠNG CƠ SỞ
    if (pType === 'base_salary') {
      const numVal = Number(policy.value) || 0;
      return (
        <div className="flex flex-wrap items-baseline gap-2 mt-1">
          <span className="text-lg sm:text-xl font-black text-emerald-700 tracking-tight">
            {formatMoney(numVal)}
          </span>
          <span className="text-xs text-slate-500 font-medium">/ tháng</span>
          <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold ml-1">
            {`Trần đóng tối đa (20 lần): ${formatMoney(numVal * 20)}`}
          </span>
        </div>
      );
    }

    // 3. CHUẨN NGHÈO NÔNG THÔN
    if (pType === 'poverty_standard') {
      const numVal = Number(policy.value) || 0;
      return (
        <div className="flex flex-wrap items-baseline gap-2 mt-1">
          <span className="text-lg sm:text-xl font-black text-blue-700 tracking-tight">
            {formatMoney(numVal)}
          </span>
          <span className="text-xs text-slate-500 font-medium">/ tháng</span>
          <span className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold ml-1">
            Mức sàn thu nhập đóng BHXH tự nguyện
          </span>
        </div>
      );
    }

    // 4. LÃI SUẤT ĐẦU TƯ QUỸ
    if (pType === 'investment_rate') {
      const numVal = Number(policy.value) || 0;
      return (
        <div className="flex flex-wrap items-baseline gap-2 mt-1">
          <span className="text-lg sm:text-xl font-black text-amber-700 tracking-tight">
            {`${numVal}%`}
          </span>
          <span className="text-xs text-slate-500 font-medium">/ tháng</span>
          <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold ml-1">
            {`Tương đương ~${(numVal * 12).toFixed(2)}% / năm`}
          </span>
        </div>
      );
    }

    // 5. HỆ SỐ TRƯỢT GIÁ (CPI)
    if (pType === 'cpi_index') {
      const cpiObj = safeParseObject(policy.value) || {};
      const years = Object.keys(cpiObj).sort((a, b) => Number(b) - Number(a));
      const isExpanded = Boolean(expandedCpiIds[policyKey]);
      const recentYears = years.slice(0, 5);

      return (
        <div className="mt-1 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700">
              {`Bảng hệ số điều chỉnh thu nhập đã đóng BHXH (${years.length} năm: ${years[years.length - 1]} - ${years[0]})`}
            </span>
            <button
              type="button"
              onClick={() => toggleExpandCpi(policyKey)}
              className="text-[11px] font-bold text-[#004182] hover:text-blue-800 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={13} /> Thu gọn bảng
                </>
              ) : (
                <>
                  <ChevronDown size={13} /> {`Xem toàn bộ (${years.length} năm)`}
                </>
              )}
            </button>
          </div>

          {/* Mốc trượt giá các năm gần nhất */}
          <div className="flex flex-wrap gap-1.5">
            {recentYears.map(year => (
              <span key={year} className="inline-flex items-center gap-1 bg-slate-100/90 text-slate-800 border border-slate-200 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                <span className="text-slate-500">{`${year}:`}</span>
                <span className="font-bold text-[#004182]">{Number(cpiObj[year]).toFixed(2)}</span>
              </span>
            ))}
            {years.length > 5 && !isExpanded && (
              <span className="text-[11px] text-slate-400 self-center font-medium">
                {`+${years.length - 5} năm khác...`}
              </span>
            )}
          </div>

          {/* Bảng mở rộng toàn bộ hệ số */}
          {isExpanded && (
            <div className="mt-2 bg-slate-50/80 p-3 rounded-xl border border-slate-200 max-h-56 overflow-y-auto">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                {years.map(year => (
                  <div key={year} className="bg-white p-1.5 rounded-lg border border-slate-200/70 shadow-2xs">
                    <div className="text-[10px] text-slate-400 font-bold">{year}</div>
                    <div className="font-extrabold text-slate-800 text-xs">
                      {Number(cpiObj[year]).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // 6. TỶ LỆ HỖ TRỢ NSNN
    if (pType === 'nn_support_rates' || pType === 'bhxh_voluntary_support') {
      const p = safeParseObject(policy.value) || {};
      const poor = Math.round((p.poor ?? 0.5) * 100);
      const nearPoor = Math.round((p.nearPoor ?? 0.4) * 100);
      const ethnic = Math.round((p.ethnicMinority ?? 0.3) * 100);
      const other = Math.round((p.other ?? 0.2) * 100);

      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-center">
            <span className="text-[10px] font-bold text-rose-700 block uppercase">Hộ Nghèo</span>
            <span className="text-base font-black text-rose-900">{`${poor}%`}</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-2 text-center">
            <span className="text-[10px] font-bold text-orange-700 block uppercase">Cận Nghèo</span>
            <span className="text-base font-black text-orange-900">{`${nearPoor}%`}</span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-center">
            <span className="text-[10px] font-bold text-amber-700 block uppercase">DTTS</span>
            <span className="text-base font-black text-amber-900">{`${ethnic}%`}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-center">
            <span className="text-[10px] font-bold text-slate-700 block uppercase">Đối Tượng Khác</span>
            <span className="text-base font-black text-slate-900">{`${other}%`}</span>
          </div>
        </div>
      );
    }

    // FALLBACK
    if (typeof policy.value === 'number') {
      return (
        <span className="font-bold text-slate-900 text-sm">
          {formatMoney(policy.value)}
        </span>
      );
    }

    return (
      <span className="font-semibold text-slate-800 text-sm">
        {String(policy.value)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 mb-6">
      {/* 1. Header và Giới thiệu */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-[#004182] border border-blue-100">
              <History size={22} />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                Dòng Thời Gian Chính Sách & Căn Cứ Pháp Lý (Policy Timeline)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Lịch sử diễn biến các mốc áp dụng theo Luật BHXH 2024, Nghị định 159/2025/NĐ-CP, Nghị định 161/2026/NĐ-CP và các văn bản điều hành
              </p>
            </div>
          </div>
        </div>

        {/* Thống kê nhanh các mốc */}
        <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
            <span className="font-bold text-slate-700">Tổng:</span>
            <span className="font-extrabold text-[#004182] bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
              {stats.total}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs text-emerald-800">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span className="font-bold">Đang áp dụng:</span>
            <span className="font-extrabold bg-white px-1.5 py-0.5 rounded-md border border-emerald-200">
              {stats.activeCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-600">
            <span className="font-bold">Lịch sử:</span>
            <span className="font-extrabold bg-white px-1.5 py-0.5 rounded-md border border-slate-200">
              {stats.inactiveCount}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Thanh Tìm kiếm & Bộ Lọc Đa Chiều */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 p-3 bg-slate-50/70 rounded-xl border border-slate-200">
        {/* Tìm kiếm từ khóa */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên nghị định, công văn, số hiệu hoặc nội dung căn cứ..."
            className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#004182] transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Bộ lọc Phân loại & Trạng thái */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdown phân loại */}
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-500 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 outline-none focus:border-[#004182] cursor-pointer text-slate-800 transition"
            >
              <option value="ALL">Tất cả chính sách ({policies.length})</option>
              <option value="base_salary">Mức lương cơ sở</option>
              <option value="poverty_standard">Chuẩn nghèo nông thôn</option>
              <option value="commission">Cài đặt Tỷ lệ hoa hồng đại lý</option>
              <option value="investment_rate">Lãi suất đầu tư quỹ</option>
              <option value="cpi_index">Hệ số trượt giá (CPI)</option>
              <option value="nn_support_rates">Tỷ lệ hỗ trợ NSNN</option>
              <option value="locked_periods">Kỳ khóa sổ kế toán</option>
            </select>
          </div>

          {/* Bộ lọc trạng thái */}
          <div className="inline-flex p-0.5 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[#004182] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang áp dụng
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                statusFilter === 'INACTIVE'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lịch sử
            </button>
          </div>
        </div>
      </div>

      {/* 3. Danh sách Timeline Card */}
      {filteredPolicies.length === 0 ? (
        <div className="text-center py-12 px-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <FileText className="mx-auto text-slate-400 mb-2.5" size={36} />
          <p className="text-slate-800 font-bold text-sm">Không tìm thấy mốc chính sách nào phù hợp</p>
          <p className="text-slate-500 text-xs mt-1">
            Vui lòng thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại bộ lọc phân loại.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-100">
          {filteredPolicies.map((policy) => {
            const isActive = policy.is_active;
            const categoryMeta = getCategoryMeta(policy.parameter_type);
            const Icon = categoryMeta.icon;

            return (
              <div key={policy.id || `${policy.parameter_type}-${policy.effective_date}`} className="relative group">
                {/* Dot marker */}
                <div
                  className={`absolute -left-[27px] sm:-left-[35px] top-2.5 w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-xs transition-all ${
                    isActive
                      ? 'bg-[#004182] border-white text-white ring-4 ring-blue-100'
                      : 'bg-white border-slate-300 text-slate-400 group-hover:border-slate-400'
                  }`}
                >
                  {isActive ? <CheckCircle2 size={13} /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                </div>

                {/* Card content */}
                <div
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50/30 border-blue-200 shadow-sm shadow-blue-500/5'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {/* Card Header: Phân loại, Tên chính sách, Trạng thái */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className={`p-2 rounded-xl border shrink-0 ${categoryMeta.iconBoxClass}`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${categoryMeta.badgeClass}`}>
                            {categoryMeta.name}
                          </span>
                          {policy.id && (
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              ID: #{policy.id}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-base mt-1">
                          {policy.name}
                        </h4>
                      </div>
                    </div>

                    {/* Status Badges & Action */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isActive ? (
                        <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 size={13} className="text-emerald-600" /> Đang có hiệu lực
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                          Lịch sử / Đã thay thế
                        </span>
                      )}

                      {isAdmin && !isActive && onActivatePolicy && (
                        <button
                          onClick={() => policy.id && onActivatePolicy(policy.id, policy.parameter_type, policy.name)}
                          className="text-xs bg-white border border-[#004182] text-[#004182] hover:bg-[#004182] hover:text-white px-3 py-1 rounded-lg font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <Check size={13} /> Kích hoạt mốc này
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Chi tiết Giá trị & Thời điểm hiệu lực */}
                  <div className="mt-3.5 grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80">
                    {/* Cột 1 & 2: Giá trị / Thông số chuyên biệt */}
                    <div className="md:col-span-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Giá trị / Thông số chính sách:
                      </span>
                      {renderPolicyValue(policy)}
                    </div>

                    {/* Cột 3: Thời điểm hiệu lực */}
                    <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-2.5 md:pt-0 md:pl-3.5 flex flex-col justify-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Thời điểm hiệu lực:
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar size={14} className="text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-800 text-sm">
                          {formatDateVN(policy.effective_date) || 'Áp dụng liên tục'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {isActive ? 'Áp dụng vào mọi giao dịch tính toán hiện thời' : 'Mốc lưu trữ lịch sử hoặc thử nghiệm'}
                      </span>
                    </div>
                  </div>

                  {/* Căn cứ pháp lý & Ghi chú */}
                  {(policy.description || policy.notes) && (
                    <div className="mt-3 flex items-start gap-2 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-600">
                      <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-bold text-slate-700">Căn cứ pháp lý: </span>
                        <span>{policy.description || policy.notes}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
