import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, formatMonthVN } from '../../utils/helpers';
import { Trophy, Award, Medal, Flame, Target, TrendingUp, Users, Settings, Search, Sparkles } from 'lucide-react';

interface StaffKPI {
  [staffId: string]: number;
}

const DEFAULT_KPI_TARGET = 50000000; // 50.000.000 đ default monthly target

const Leaderboard: React.FC = () => {
  const { staff, records, currentUser, showToast } = useAppContext();
  
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [isKpiModalOpen, setIsKpiModalOpen] = useState<boolean>(false);

  // Chỉ tiêu KPI nhân viên quản lý trong phiên làm việc (in-memory)
  const [kpiTargets, setKpiTargets] = useState<StaffKPI>({});

  // Dọn dẹp khóa cũ trên trình duyệt
  useEffect(() => {
    try {
      localStorage.removeItem('vss_staff_kpis');
    } catch {
      // Ignored
    }
  }, []);

  const [editingTargets, setEditingTargets] = useState<StaffKPI>({});

  const handleOpenKpiModal = () => {
    const initial: StaffKPI = {};
    staff.forEach(s => {
      initial[s.id] = kpiTargets[s.id] || DEFAULT_KPI_TARGET;
    });
    setEditingTargets(initial);
    setIsKpiModalOpen(true);
  };

  const handleSaveKpis = () => {
    setKpiTargets(editingTargets);
    setIsKpiModalOpen(false);
    showToast('Đã cập nhật chỉ tiêu KPI nhân viên thành công!', 'success');
  };

  // Get available months list from records
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    (records || []).forEach(r => {
      if (r.date) {
        const m = r.date.substring(0, 7);
        if (m) monthsSet.add(m);
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [records]);

  // Compute staff performance data
  const leaderboardData = useMemo(() => {
    const staffStatsMap: { [id: string]: any } = {};

    const effectiveStaff = staff.length > 0 ? staff : (currentUser ? [currentUser] : []);

    // Initialize all active staff
    effectiveStaff.forEach(s => {
      const entry = {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        role: s.role,
        area: s.area || 'Hà Nội',
        bhxhCount: 0,
        bhytCount: 0,
        totalRecords: 0,
        totalRevenue: 0,
        totalCommission: 0,
        targetKPI: kpiTargets[s.id] || DEFAULT_KPI_TARGET
      };
      staffStatsMap[s.id] = entry;
      if (s.username) {
        staffStatsMap[s.username] = entry;
      }
      const sCode = s.staff_code || (s as any).staffCode;
      if (sCode) {
        staffStatsMap[sCode] = entry;
      }
    });

    // Process records
    (records || []).forEach(r => {
      const pStatus = r.payment_status || (r as any).paymentStatus;
      if (pStatus === 'Đã hủy') return;

      // Check month filter
      if (selectedMonth !== 'all' && r.date && !r.date.startsWith(selectedMonth)) {
        return;
      }

      // Check assigned staff
      const staffId = r.staff_id || (r as any).staffId;
      if (staffId && staffStatsMap[staffId]) {
        const targetStaff = staffStatsMap[staffId];
        const amount = Number(r.amount) || 0;
        const comm = Number(r.commission) || 0;

        if (r.is_adjustment || (r as any).isAdjustment) {
          if (r.type === 'BHXH') {
            targetStaff.bhxhCount = Math.max(0, targetStaff.bhxhCount - 1);
          } else if (r.type === 'BHYT') {
            targetStaff.bhytCount = Math.max(0, targetStaff.bhytCount - 1);
          }
          targetStaff.totalRecords = Math.max(0, targetStaff.totalRecords - 1);
        } else {
          if (r.type === 'BHXH') {
            targetStaff.bhxhCount += 1;
          } else if (r.type === 'BHYT') {
            targetStaff.bhytCount += 1;
          }
          targetStaff.totalRecords += 1;
          targetStaff.totalRevenue += amount;
          targetStaff.totalCommission += comm;
        }
      }
    });

    // Deduplicate distinct staff by id
    const seenIds = new Set<string>();
    let list = Object.values(staffStatsMap).filter(s => {
      if (!s || seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    // Apply Area Filter
    if (selectedArea !== 'all') {
      list = list.filter(s => s.area === selectedArea);
    }

    // Apply Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q));
    }

    // Calculate completion rates and sort by totalRevenue desc
    list.forEach(s => {
      s.completionRate = s.targetKPI > 0 ? Math.round((s.totalRevenue / s.targetKPI) * 100) : 0;
    });

    list.sort((a, b) => b.totalRevenue - a.totalRevenue);

    return list;
  }, [staff, records, selectedMonth, selectedArea, searchQuery, kpiTargets]);

  // Aggregate Team KPI Totals
  const teamTotals = useMemo(() => {
    let totalRev = 0;
    let totalTarget = 0;
    let totalComm = 0;
    let reachedCount = 0;

    leaderboardData.forEach(s => {
      totalRev += s.totalRevenue;
      totalTarget += s.targetKPI;
      totalComm += s.totalCommission;
      if (s.completionRate >= 100) reachedCount++;
    });

    const teamRate = totalTarget > 0 ? Math.round((totalRev / totalTarget) * 100) : 0;

    return {
      totalRev,
      totalTarget,
      totalComm,
      reachedCount,
      teamRate,
      totalStaff: leaderboardData.length
    };
  }, [leaderboardData]);

  // Top 3 Champions
  const top1 = leaderboardData[0];
  const top2 = leaderboardData[1];
  const top3 = leaderboardData[2];

  // Distinct list of areas
  const areasList = useMemo(() => {
    const set = new Set<string>();
    staff.forEach(s => {
      if (s.area) set.add(s.area);
    });
    return Array.from(set);
  }, [staff]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Header & Filter Card */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70 shadow-2xs mb-1.5">
              <Sparkles size={13} className="text-amber-500 fill-amber-400" />
              <span>Bảng Vàng Thi Đua Doanh Số & KPI</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500 flex-shrink-0" />
              <span>Bảng Xếp Hạng & Vượt Chỉ Tiêu</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Vinh danh các Chuyên viên & Đại lý thu BHXH/BHYT xuất sắc nhất. Theo dõi tiến độ hoàn thành chỉ tiêu KPI thời gian thực.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-shrink-0">
            {currentUser?.role === 'Admin' && (
              <button
                onClick={handleOpenKpiModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#004182] hover:bg-[#003166] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors active:scale-98 cursor-pointer"
              >
                <Settings size={15} className="text-white/80" />
                <span>Thiết Lập KPI Nhân Viên</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="pt-3.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Chọn Tháng Lương
            </label>
            <select
              value={selectedMonth || 'all'}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 transition cursor-pointer"
            >
              <option value="all">-- Tất cả thời gian --</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  Tháng {formatMonthVN(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Khu Vực
            </label>
            <select
              value={selectedArea || 'all'}
              onChange={e => setSelectedArea(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 transition cursor-pointer"
            >
              <option value="all">-- Tất cả khu vực --</option>
              {areasList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Tìm Kiếm Nhân Viên
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập tên nhân viên..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl pl-8.5 pr-3 py-2 text-xs font-medium outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/10 transition"
              />
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-50 text-[#004182]">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Doanh Thu</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{formatMoney(teamTotals.totalRev)}</p>
            <p className="text-xs text-slate-500 mt-1">Chỉ tiêu: {formatMoney(teamTotals.totalTarget)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600">
            <Target size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiến Độ KPI Đội Ngu</p>
            <p className="text-xl font-black text-amber-600 mt-0.5">{teamTotals.teamRate}%</p>
            <div className="w-28 bg-slate-100 h-2 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(teamTotals.teamRate, 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-600">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">NV Vượt Chỉ Tiêu</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{teamTotals.reachedCount} / {teamTotals.totalStaff} NV</p>
            <p className="text-xs text-emerald-700 font-semibold mt-1">
              {teamTotals.totalStaff > 0 ? `${Math.round((teamTotals.reachedCount / teamTotals.totalStaff) * 100)}% đạt chỉ tiêu` : '---'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-purple-50 text-purple-600">
            <Award size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hoa Hồng Khen Thưởng</p>
            <p className="text-xl font-black text-purple-700 mt-0.5">{formatMoney(teamTotals.totalComm)}</p>
            <p className="text-xs text-slate-500 mt-1">Dành cho toàn bộ đại lý</p>
          </div>
        </div>
      </div>

      {/* TOP 3 PODIUM HALL OF FAME */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-md">
        <div className="text-center mb-8">
          <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center justify-center gap-2">
            <Trophy className="text-amber-500" size={28} /> Bục Vinh Danh Top 3 Cao Thủ Doanh Số
          </h2>
          <p className="text-slate-500 text-sm mt-1">Những đại diện dẫn đầu thi đua phát triển đối tượng tham gia BHXH & BHYT</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-5xl mx-auto">
          {/* RANK 2 - Á QUÂN (SILVER) */}
          <div className="order-2 md:order-1 bg-gradient-to-b from-slate-50 via-slate-100/50 to-white rounded-3xl p-6 border-2 border-slate-300 shadow-lg text-center relative overflow-hidden transform hover:-translate-y-1 transition duration-300">
            <div className="absolute top-0 right-0 bg-slate-300 text-slate-800 text-xs font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1">
              <Medal size={14} /> Hạng 2
            </div>
            
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-slate-400 to-slate-200 p-1 shadow-md mb-4 relative">
              <div className="w-full h-full rounded-full bg-slate-700 text-white font-black text-xl flex items-center justify-center border-2 border-white uppercase">
                {top2 ? top2.name.substring(0, 2) : 'NV'}
              </div>
              <span className="absolute -bottom-2 right-0 bg-slate-300 text-slate-900 text-xs font-extrabold px-2 py-0.5 rounded-full border border-white">#2</span>
            </div>

            <h3 className="font-extrabold text-slate-800 text-lg line-clamp-1">{top2 ? top2.name : 'Chưa cập nhật'}</h3>
            <p className="text-xs font-semibold text-slate-500 mb-3">{top2 ? top2.area : 'Khu vực'}</p>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs text-slate-500 font-semibold">Doanh thu đạt được</div>
              <div className="text-lg font-black text-slate-700">{top2 ? formatMoney(top2.totalRevenue) : '0 đ'}</div>
              
              {top2 && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>Tiến độ KPI</span>
                    <span className="text-slate-800">{top2.completionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-slate-500 h-full rounded-full" style={{ width: `${Math.min(top2.completionRate, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-slate-700 bg-slate-200/80 px-3 py-1.5 rounded-xl">
              <Medal size={14} className="text-slate-600" /> Á QUÂN DOANH SỐ 🥈
            </div>
          </div>

          {/* RANK 1 - QUÁN QUÂN (GOLD) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50 via-amber-100/40 to-white rounded-3xl p-7 border-4 border-amber-400 shadow-2xl text-center relative overflow-hidden transform md:-translate-y-4 hover:-translate-y-5 transition duration-300">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 text-xs font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1 shadow-sm">
              <Trophy size={14} /> Hạng 1
            </div>

            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-500 p-1.5 shadow-xl mb-4 relative">
              <div className="w-full h-full rounded-full bg-[#004182] text-white font-black text-2xl flex items-center justify-center border-4 border-white uppercase">
                {top1 ? top1.name.substring(0, 2) : 'NV'}
              </div>
              <span className="absolute -bottom-2 right-0 bg-amber-400 text-gray-900 text-xs font-black px-2.5 py-0.5 rounded-full border-2 border-white shadow">👑 #1</span>
            </div>

            <h3 className="font-black text-[#004182] text-xl line-clamp-1">{top1 ? top1.name : 'Chưa cập nhật'}</h3>
            <p className="text-xs font-bold text-amber-700 mb-3">{top1 ? top1.area : 'Khu vực'}</p>

            <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-md space-y-2">
              <div className="text-xs text-slate-500 font-semibold">Doanh thu dẫn đầu</div>
              <div className="text-xl font-extrabold text-[#004182]">{top1 ? formatMoney(top1.totalRevenue) : '0 đ'}</div>

              {top1 && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">
                    <span>Tiến độ KPI</span>
                    <span>{top1.completionRate}%</span>
                  </div>
                  <div className="w-full bg-amber-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-amber-400 to-amber-600 h-full rounded-full" style={{ width: `${Math.min(top1.completionRate, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-amber-900 bg-amber-200/90 px-4 py-2 rounded-xl shadow-sm animate-pulse">
              <Trophy size={16} className="text-amber-700" /> 🥇 QUÁN QUÂN XUẤT SẮC
            </div>
          </div>

          {/* RANK 3 - HẠNG BA (BRONZE) */}
          <div className="order-3 bg-gradient-to-b from-orange-50 via-orange-100/30 to-white rounded-3xl p-6 border-2 border-orange-300 shadow-lg text-center relative overflow-hidden transform hover:-translate-y-1 transition duration-300">
            <div className="absolute top-0 right-0 bg-amber-700 text-white text-xs font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider flex items-center gap-1">
              <Award size={14} /> Hạng 3
            </div>

            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-800 p-1 shadow-md mb-4 relative">
              <div className="w-full h-full rounded-full bg-amber-900 text-white font-black text-xl flex items-center justify-center border-2 border-white uppercase">
                {top3 ? top3.name.substring(0, 2) : 'NV'}
              </div>
              <span className="absolute -bottom-2 right-0 bg-amber-700 text-white text-xs font-extrabold px-2 py-0.5 rounded-full border border-white">#3</span>
            </div>

            <h3 className="font-extrabold text-slate-800 text-lg line-clamp-1">{top3 ? top3.name : 'Chưa cập nhật'}</h3>
            <p className="text-xs font-semibold text-slate-500 mb-3">{top3 ? top3.area : 'Khu vực'}</p>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2">
              <div className="text-xs text-slate-500 font-semibold">Doanh thu đạt được</div>
              <div className="text-lg font-black text-slate-700">{top3 ? formatMoney(top3.totalRevenue) : '0 đ'}</div>

              {top3 && (
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                    <span>Tiến độ KPI</span>
                    <span className="text-slate-800">{top3.completionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-700 h-full rounded-full" style={{ width: `${Math.min(top3.completionRate, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-amber-900 bg-amber-100 px-3 py-1.5 rounded-xl">
              <Award size={14} className="text-amber-700" /> HẠNG BA DOANH SỐ 🥉
            </div>
          </div>
        </div>
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <Users size={20} className="text-[#004182]" /> Danh Sách Bảng Thi Đua Nhân Viên
            </h3>
            <p className="text-xs text-slate-500 mt-1">Xếp hạng chi tiết theo tổng doanh thu thu phí đã thực hiện</p>
          </div>
          <span className="px-3.5 py-1.5 rounded-full bg-blue-50 text-[#004182] font-bold text-xs w-fit">
            Tổng số: {leaderboardData.length} Nhân viên
          </span>
        </div>

        {/* Mobile View Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {leaderboardData.map((s, idx) => {
            const rank = idx + 1;
            let rankBadge = <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-extrabold text-xs flex items-center justify-center">#{rank}</span>;
            if (rank === 1) rankBadge = <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center">🥇</span>;
            if (rank === 2) rankBadge = <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center">🥈</span>;
            if (rank === 3) rankBadge = <span className="w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs flex items-center justify-center">🥉</span>;

            let statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600">Cần nỗ lực</span>;
            if (s.completionRate >= 100) {
              statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-800 flex items-center gap-1"><Flame size={12} /> Vượt chỉ tiêu</span>;
            } else if (s.completionRate >= 70) {
              statusBadge = <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-800">Đạt tiến độ</span>;
            }

            return (
              <div key={s.id} className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {rankBadge}
                    <div>
                      <h4 className="font-extrabold text-slate-800">{s.name}</h4>
                      <p className="text-xs text-slate-400 font-medium">{s.area}</p>
                    </div>
                  </div>
                  {statusBadge}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-400 block">Doanh thu</span>
                    <span className="font-bold text-[#004182]">{formatMoney(s.totalRevenue)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Chỉ tiêu KPI</span>
                    <span className="font-bold text-slate-700">{formatMoney(s.targetKPI)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hồ sơ BHXH/BHYT</span>
                    <span className="font-bold text-slate-700">{s.bhxhCount} BHXH - {s.bhytCount} BHYT</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hoa hồng đạt được</span>
                    <span className="font-bold text-purple-700">{formatMoney(s.totalCommission)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">Tiến độ KPI</span>
                    <span className={s.completionRate >= 100 ? 'text-amber-600' : 'text-slate-700'}>{s.completionRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.completionRate >= 100 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-[#004182]'}`}
                      style={{ width: `${Math.min(s.completionRate, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-xs border-b border-slate-200">
              <tr>
                <th className="p-4 w-16 text-center">Thứ Hạng</th>
                <th className="p-4">Nhân Viên</th>
                <th className="p-4">Khu Vực</th>
                <th className="p-4 text-center">Hồ Sơ (BHXH/BHYT)</th>
                <th className="p-4">Doanh Thu Đạt Được</th>
                <th className="p-4">Chỉ Tiêu KPI</th>
                <th className="p-4 w-48">Độ Hoàn Thành (%)</th>
                <th className="p-4">Hoa Hồng Earned</th>
                <th className="p-4 text-center">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboardData.map((s, idx) => {
                const rank = idx + 1;

                let rowBg = 'hover:bg-slate-50/80';
                if (rank === 1) rowBg = 'bg-amber-50/40 hover:bg-amber-50/80';
                if (rank === 2) rowBg = 'bg-slate-50/60 hover:bg-slate-100/70';
                if (rank === 3) rowBg = 'bg-orange-50/30 hover:bg-orange-50/60';

                let rankElement = <span className="font-extrabold text-slate-500 text-base">#{rank}</span>;
                if (rank === 1) rankElement = <span className="text-xl">🥇</span>;
                if (rank === 2) rankElement = <span className="text-xl">🥈</span>;
                if (rank === 3) rankElement = <span className="text-xl">🥉</span>;

                let statusBadge = <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">Cần nỗ lực</span>;
                if (s.completionRate >= 100) {
                  statusBadge = <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center gap-1"><Flame size={12} /> Vượt chỉ tiêu</span>;
                } else if (s.completionRate >= 70) {
                  statusBadge = <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Đạt tiến độ</span>;
                }

                return (
                  <tr key={s.id} className={`transition ${rowBg}`}>
                    <td className="p-4 text-center">{rankElement}</td>
                    <td className="p-4">
                      <div className="font-extrabold text-slate-800">{s.name}</div>
                      <div className="text-xs text-slate-400 font-medium">{s.email || s.role}</div>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">{s.area}</td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-blue-50 text-[#004182] font-bold text-xs rounded mr-1">{s.bhxhCount} BHXH</span>
                      <span className="px-2 py-1 bg-sky-50 text-[#0ea5e9] font-bold text-xs rounded">{s.bhytCount} BHYT</span>
                    </td>
                    <td className="p-4 font-black text-[#004182]">{formatMoney(s.totalRevenue)}</td>
                    <td className="p-4 font-semibold text-slate-600">{formatMoney(s.targetKPI)}</td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className={s.completionRate >= 100 ? 'text-amber-700' : 'text-slate-600'}>{s.completionRate}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${s.completionRate >= 100 ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-[#004182]'}`}
                            style={{ width: `${Math.min(s.completionRate, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-extrabold text-purple-700">{formatMoney(s.totalCommission)}</td>
                    <td className="p-4 text-center">{statusBadge}</td>
                  </tr>
                );
              })}

              {leaderboardData.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold">
                    Chưa tìm thấy dữ liệu nhân viên thi đua nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADMIN EDIT KPI TARGETS MODAL */}
      {isKpiModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[#004182] p-5 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Settings size={20} /> Thiết Lập Chỉ Tiêu KPI Doanh Thu Nhân Viên
              </h3>
              <button onClick={() => setIsKpiModalOpen(false)} className="text-white/80 hover:text-white">✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-xs text-slate-500">
                Nhập mức doanh thu giao chỉ tiêu hàng tháng (VNĐ) cho từng nhân viên đại lý:
              </p>

              <div className="space-y-3 divide-y divide-slate-100">
                {staff.map(s => (
                  <div key={s.id} className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.area || 'Hà Nội'} • {s.role}</div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="1000000"
                        value={editingTargets[s.id] || ''}
                        onChange={e => setEditingTargets({ ...editingTargets, [s.id]: Number(e.target.value) })}
                        placeholder="VD: 50000000"
                        className="w-full sm:w-48 p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800 text-sm outline-none focus:border-[#004182]"
                      />
                      <span className="text-[10px] text-slate-400 block mt-1">
                        = {formatMoney(editingTargets[s.id] || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsKpiModalOpen(false)}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveKpis}
                className="px-6 py-2.5 rounded-xl bg-[#004182] text-white font-extrabold hover:bg-blue-800 shadow-md"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
