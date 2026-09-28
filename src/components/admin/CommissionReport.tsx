import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney } from '../../utils/helpers';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { FileDown, Percent } from 'lucide-react';

const CommissionReport = () => {
  const { staff, settings, currentUser, isAuthReady, records, policies } = useAppContext();
  const [period, setPeriod] = useState('month');
  const [staffReportFilter, setStaffReportFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const [stats, setStats] = useState({
    commBHXHNewTotal: 0,
    commBHXHRenewTotal: 0,
    commBHYTNewTotal: 0,
    commBHYTRenewTotal: 0,
    totalComm: 0,
    staffPerformance: [] as any[]
  });

  useEffect(() => {
    const calculateCommissionStats = () => {
      if (!isAuthReady || !currentUser) return;
      setIsLoading(true);

      try {
        const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'admin' || currentUser.role === 'Quản lý';
        
        let filteredRecords = records.filter(r => r.paymentStatus === 'Đã thu tiền');

        if (!isAdmin) {
          filteredRecords = filteredRecords.filter(r => 
            (r.staffId || r.staff_id) === currentUser.id || 
            (currentUser.username && (r.staffId || r.staff_id) === currentUser.username) ||
            (currentUser.staffCode && (r.staffId || r.staff_id) === currentUser.staffCode)
          );
        } else if (staffReportFilter !== 'all') {
          filteredRecords = filteredRecords.filter(r => (r.staffId || r.staff_id) === staffReportFilter);
        }

        if (period !== 'all') {
          const now = new Date();
          let startDate: Date | null = null;
          let endDate: Date | null = null;

          if (period === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
          } else if (period === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
          } else if (period === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          } else if (period === 'last_month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          } else if (period === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            endDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999);
          } else if (period === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          }

          if (startDate && endDate) {
            filteredRecords = filteredRecords.filter(r => {
              const rDate = new Date(r.date);
              return rDate >= startDate! && rDate <= endDate!;
            });
          }
        }

        const staffToProcess = !isAdmin 
          ? (staff.filter(s => s.id === currentUser.id).length > 0 
              ? staff.filter(s => s.id === currentUser.id) 
              : [currentUser])
          : (staffReportFilter === 'all' ? (staff.length > 0 ? staff : [currentUser]) : staff.filter(s => s.id === staffReportFilter));

        const staffPerformance = staffToProcess.map(s => {
          const sRecords = filteredRecords.filter(r => 
            (r.staffId || r.staff_id) === s.id || 
            (s.username && (r.staffId || r.staff_id) === s.username) ||
            (s.staffCode && (r.staffId || r.staff_id) === s.staffCode)
          );
          
          const sBhxhRecords = sRecords.filter(r => r.type === 'BHXH');
          const sBhytRecords = sRecords.filter(r => r.type === 'BHYT');

          const isRenewRec = (r: any) => String(r.actionType || '').toLowerCase().includes('gia hạn');

          const bhxhNewComm = sBhxhRecords.filter(r => !isRenewRec(r)).reduce((sum, r) => sum + ((r.amount || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
          const bhxhRenewComm = sBhxhRecords.filter(r => isRenewRec(r)).reduce((sum, r) => sum + ((r.amount || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
          const bhytNewComm = sBhytRecords.filter(r => !isRenewRec(r)).reduce((sum, r) => sum + ((r.amount || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
          const bhytRenewComm = sBhytRecords.filter(r => isRenewRec(r)).reduce((sum, r) => sum + ((r.amount || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
          const sComm = bhxhNewComm + bhxhRenewComm + bhytNewComm + bhytRenewComm;

          return {
            ...s,
            commission: sComm,
            bhxhNewComm,
            bhxhRenewComm,
            bhytNewComm,
            bhytRenewComm
          };
        });

        staffPerformance.sort((a, b) => b.commission - a.commission);

        let commBHXHNewTotal = 0;
        let commBHXHRenewTotal = 0;
        let commBHYTNewTotal = 0;
        let commBHYTRenewTotal = 0;
        let totalComm = 0;

        staffPerformance.forEach(p => {
          commBHXHNewTotal += p.bhxhNewComm;
          commBHXHRenewTotal += p.bhxhRenewComm;
          commBHYTNewTotal += p.bhytNewComm;
          commBHYTRenewTotal += p.bhytRenewComm;
          totalComm += p.commission;
        });

        setStats({
          commBHXHNewTotal,
          commBHXHRenewTotal,
          commBHYTNewTotal,
          commBHYTRenewTotal,
          totalComm,
          staffPerformance
        });

      } catch (error) {
        console.error("Error calculating commission stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    calculateCommissionStats();
  }, [currentUser, settings, period, staffReportFilter, staff, isAuthReady, records, policies]);

  const displayedStaffData = React.useMemo(() => {
    return staffReportFilter === 'all' 
      ? stats.staffPerformance 
      : stats.staffPerformance.filter(s => s.id === staffReportFilter);
  }, [stats.staffPerformance, staffReportFilter]);

  const exportReport = async () => {
    const summaryData = [
      { "Chỉ tiêu": "Giai đoạn", "Giá trị": period === 'all' ? 'Toàn thời gian' : period === 'month' ? 'Tháng này' : period === 'quarter' ? 'Quý này' : 'Năm nay' },
      { "Chỉ tiêu": "Nhân viên", "Giá trị": staffReportFilter === 'all' ? 'Tất cả' : staff.find(s => s.id === staffReportFilter)?.name || '' },
      { "Chỉ tiêu": "Hoa hồng BHXH Tăng mới", "Giá trị": formatMoney(stats.commBHXHNewTotal) },
      { "Chỉ tiêu": "Hoa hồng BHXH Gia hạn", "Giá trị": formatMoney(stats.commBHXHRenewTotal) },
      { "Chỉ tiêu": "Hoa hồng BHYT Tăng mới", "Giá trị": formatMoney(stats.commBHYTNewTotal) },
      { "Chỉ tiêu": "Hoa hồng BHYT Gia hạn", "Giá trị": formatMoney(stats.commBHYTRenewTotal) },
      { "Chỉ tiêu": "Tổng hoa hồng", "Giá trị": formatMoney(stats.totalComm) }
    ];
    
    const staffData = displayedStaffData.map(s => ({
      "Nhân viên": s.name,
      "Hoa hồng BHXH Tăng mới": s.bhxhNewComm || 0,
      "Hoa hồng BHXH Gia hạn": s.bhxhRenewComm || 0,
      "Hoa hồng BHYT Tăng mới": s.bhytNewComm || 0,
      "Hoa hồng BHYT Gia hạn": s.bhytRenewComm || 0,
      "Tổng Hoa hồng": s.commission
    }));

    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const wb = XLSX.utils.book_new();
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "TongHopHoaHong");
    
    if (staffData.length > 0) {
      const wsStaff = XLSX.utils.json_to_sheet(staffData);
      XLSX.utils.book_append_sheet(wb, wsStaff, "ChiTietHoaHong");
    }

    XLSX.writeFile(wb, `Bao_cao_hoa_hong_${new Date().getTime()}.xlsx`);
  };

  const exportStaffDetails = async (staffMember: any) => {
    try {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (period !== 'all') {
        if (period === 'today') {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        } else if (period === 'week') {
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (period === 'last_month') {
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        } else if (period === 'quarter') {
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
          endDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999);
        } else if (period === 'year') {
          startDate = new Date(now.getFullYear(), 0, 1);
          endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        }
      }

      const staffRecords = records.filter(r => {
        if (r.staffId !== staffMember.id) return false;
        if (r.paymentStatus !== 'Đã thu tiền') return false;
        if (startDate && endDate) {
          const rDate = new Date(r.date);
          return rDate >= startDate && rDate <= endDate;
        }
        return true;
      });
      
      if (staffRecords.length === 0) {
        return;
      }

      const data = staffRecords.map(r => {
        const rate = getCommissionRateForRecord(r, policies, settings);
        
        return {
          "Mã GD": r.id,
          "Ngày": new Date(r.date).toLocaleDateString('vi-VN'),
          "Khách hàng": r.name || "",
          "Mã số BHXH": r.bhxh || "",
          "Loại": r.type,
          "Loại đăng ký": r.actionType,
          "Số tiền": r.amount,
          "Tỷ lệ hoa hồng": `${(rate * 100).toFixed(1)}%`,
          "Hoa hồng": r.amount * rate
        };
      });

      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "ChiTietHoaHong");
      XLSX.writeFile(wb, `Chi_tiet_HH_${staffMember.name.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
    } catch (error) {
      console.error("Error exporting staff details:", error);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Báo Cáo Hoa Hồng</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tổng hợp và đối chiếu hoa hồng tăng mới và gia hạn chi tiết theo từng cán bộ thu
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {currentUser?.role !== 'Nhân viên' && (
            <select 
              value={staffReportFilter || 'all'} 
              onChange={e => setStaffReportFilter(e.target.value)} 
              className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
            >
              <option value="all">Tất cả nhân viên</option>
              {staff.map((s: any, index: number) => (
                <option key={s.id || `new-${index}`} value={s.id || ''}>{s.name}</option>
              ))}
            </select>
          )}
          <select value={period || 'all'} onChange={e => setPeriod(e.target.value)} className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all">
            <option value="all">Toàn thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="last_month">Tháng trước</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm nay</option>
          </select>
          <button onClick={exportReport} className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-emerald-700 transition shadow-xs flex items-center justify-center w-full sm:w-auto cursor-pointer text-xs sm:text-sm">
            <FileDown size={16} className="mr-2" /> Tải Báo Cáo
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 mb-6">
        <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4">Tổng Hợp Hoa Hồng</h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#004182]"></div>
            <span className="ml-2 text-slate-500">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-blue-50/70 rounded-xl border border-blue-100">
                <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">BHXH Tăng mới</p>
                <p className="text-lg sm:text-xl font-bold text-[#004182]">{formatMoney(stats.commBHXHNewTotal || 0)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-blue-50/70 rounded-xl border border-blue-100">
                <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">BHXH Gia hạn</p>
                <p className="text-lg sm:text-xl font-bold text-[#004182]">{formatMoney(stats.commBHXHRenewTotal || 0)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-cyan-50/70 rounded-xl border border-cyan-100">
                <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">BHYT Tăng mới</p>
                <p className="text-lg sm:text-xl font-bold text-[#0ea5e9]">{formatMoney(stats.commBHYTNewTotal || 0)}</p>
              </div>
              <div className="p-3 sm:p-4 bg-cyan-50/70 rounded-xl border border-cyan-100">
                <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">BHYT Gia hạn</p>
                <p className="text-lg sm:text-xl font-bold text-[#0ea5e9]">{formatMoney(stats.commBHYTRenewTotal || 0)}</p>
              </div>
            </div>
            <div className="mt-4 p-3 sm:p-4 bg-[#FDB913]/10 rounded-xl border border-[#FDB913]/25 flex justify-between items-center">
              <span className="font-bold text-slate-700 text-sm sm:text-base">Tổng Hoa Hồng:</span>
              <span className="text-xl sm:text-2xl font-extrabold text-[#b45309]">{formatMoney(stats.totalComm || 0)}</span>
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 mt-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center">
            <Percent className="text-[#004182] mr-2" size={18} />
            Chi Tiết Hoa Hồng Theo Nhân Viên
          </h3>
        </div>

        <div className="flex flex-col gap-8">
          <div className="w-full">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto w-full custom-scrollbar rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Nhân viên</th>
                    <th className="p-3 text-right">Hoa hồng BHXH Tăng mới</th>
                    <th className="p-3 text-right">Hoa hồng BHXH Gia hạn</th>
                    <th className="p-3 text-right">Hoa hồng BHYT Tăng mới</th>
                    <th className="p-3 text-right">Hoa hồng BHYT Gia hạn</th>
                    <th className="p-3 text-right">Tổng Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStaffData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-gray-500">Không có dữ liệu</td>
                    </tr>
                  ) : (
                    displayedStaffData.map((s, index) => (
                      <tr key={s.id || `new-${index}`} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">
                          <div className="flex items-center justify-between">
                            <span>{s.name}</span>
                            <button 
                              onClick={() => exportStaffDetails(s)}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition"
                              title="Tải chi tiết hoa hồng"
                            >
                              <FileDown size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhxhNewComm || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhxhRenewComm || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhytNewComm || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhytRenewComm || 0)}</td>
                        <td className="p-3 text-right font-bold text-[#FDB913]">{formatMoney(s.commission || 0)}</td>
                      </tr>
                    ))
                  )}
                  {displayedStaffData.length > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-3 text-gray-800">Tổng cộng</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhNewComm || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhRenewComm || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytNewComm || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytRenewComm || 0), 0))}</td>
                      <td className="p-3 text-right text-[#FDB913]">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.commission || 0), 0))}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col gap-4">
              {displayedStaffData.length === 0 ? (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-xl">Không có dữ liệu</div>
              ) : (
                displayedStaffData.map((s, index) => (
                  <div key={s.id || `new-${index}`} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200 flex justify-between items-center">
                      <span>{s.name}</span>
                      <button 
                        onClick={() => exportStaffDetails(s)}
                        className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition"
                        title="Tải chi tiết hoa hồng"
                      >
                        <FileDown size={16} />
                      </button>
                    </h4>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 text-xs block">BHXH Tăng mới</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhxhNewComm || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">BHXH Gia hạn</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhxhRenewComm || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">BHYT Tăng mới</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhytNewComm || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">BHYT Gia hạn</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhytRenewComm || 0)}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                      <span className="font-bold text-gray-700">Tổng Hoa hồng:</span>
                      <span className="font-bold text-[#FDB913] text-lg">{formatMoney(s.commission || 0)}</span>
                    </div>
                  </div>
                ))
              )}
              {displayedStaffData.length > 0 && (
                <div className="bg-[#FDB913]/10 p-4 rounded-xl border border-[#FDB913]/20 mt-2">
                  <h4 className="font-bold text-gray-800 mb-2">Tổng Cộng Tất Cả</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="text-gray-600 text-xs block">BHXH Tăng mới</span>
                      <span className="font-medium text-gray-800">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhNewComm || 0), 0))}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs block">BHXH Gia hạn</span>
                      <span className="font-medium text-gray-800">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhRenewComm || 0), 0))}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs block">BHYT Tăng mới</span>
                      <span className="font-medium text-gray-800">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytNewComm || 0), 0))}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs block">BHYT Gia hạn</span>
                      <span className="font-medium text-gray-800">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytRenewComm || 0), 0))}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-[#FDB913]/30 flex justify-between items-center">
                    <span className="font-bold text-gray-800">Tổng Hoa hồng:</span>
                    <span className="font-bold text-[#FDB913] text-xl">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.commission || 0), 0))}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionReport;
