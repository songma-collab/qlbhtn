import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney } from '../../utils/helpers';
import { getCommissionRateForRecord } from '../../utils/calculations';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { FileDown, Users, BarChart3, Printer, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import StaffCustomerReport from './reports/StaffCustomerReport';
import ReportPrintPreviewModal from '../modals/ReportPrintPreviewModal';
import { exportRevenueReportToExcel, exportRevenueReportToPdf } from '../../utils/reportExportHelper';
import { hasPermission } from '../../utils/permissions';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Reports = () => {
  const { staff, settings, currentUser, isAuthReady, records, policies, isAdmin } = useAppContext() as any;
  const [activeReportTab, setActiveReportTab] = useState<'revenue' | 'staff-customers'>('revenue');
  const [period, setPeriod] = useState('month');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [staffReportFilter, setStaffReportFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  const [stats, setStats] = useState({
    bhxhCount: 0,
    bhytCount: 0,
    totalRev: 0,
    totalComm: 0,
    staffPerformance: [] as any[]
  });

  const userRole = (currentUser?.role || '').toLowerCase();
  const isSuperAdmin = isAdmin || userRole === 'admin' || userRole === 'quản trị viên' || userRole === 'quản lý' || (currentUser?.name && currentUser.name.toLowerCase().includes('phạm văn học'));
  const canViewAll = isSuperAdmin || hasPermission(currentUser, 'reports.view_all', settings);
  const canExportExcel = isSuperAdmin || hasPermission(currentUser, 'reports.export_excel', settings);
  const canExportPdf = isSuperAdmin || hasPermission(currentUser, 'reports.export_pdf', settings);

  useEffect(() => {
    const calculateReportStats = () => {
      if (!isAuthReady || !currentUser) return;
      setIsLoading(true);

      try {
        let filteredRecords = (records || []).filter(r => r.paymentStatus === 'Đã thu tiền');

        if (!canViewAll) {
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
          } else if (period === 'custom') {
            if (customStartDate) {
              const [sy, sm, sd] = customStartDate.split('-').map(Number);
              startDate = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
            }
            if (customEndDate) {
              const [ey, em, ed] = customEndDate.split('-').map(Number);
              endDate = new Date(ey, em - 1, ed, 23, 59, 59, 999);
            }
          }

          if (startDate && endDate) {
            filteredRecords = filteredRecords.filter(r => {
              const rawDate = r.date || (r as any).created_at || (r as any).registration_date;
              if (!rawDate) return false;
              const rDate = new Date(rawDate);
              if (isNaN(rDate.getTime())) return false;
              return rDate >= startDate! && rDate <= endDate!;
            });
          }
        }

        const bhxhCount = filteredRecords.filter(r => r.type === 'BHXH').length;
        const bhytCount = filteredRecords.filter(r => r.type === 'BHYT').length;

        const staffToProcess = !canViewAll 
          ? (staff.filter((s: any) => s.id === currentUser.id).length > 0 
              ? staff.filter((s: any) => s.id === currentUser.id) 
              : [currentUser])
          : (staffReportFilter === 'all' ? (staff.length > 0 ? staff : [currentUser]) : staff.filter((s: any) => s.id === staffReportFilter));

        const staffPerformance = staffToProcess.map(s => {
          const sRecords = filteredRecords.filter(r => 
            (r.staffId || r.staff_id) === s.id || 
            (s.username && (r.staffId || r.staff_id) === s.username) ||
            (s.staffCode && (r.staffId || r.staff_id) === s.staffCode)
          );
          
          const sBhxhRecords = sRecords.filter(r => r.type === 'BHXH');
          const sBhytRecords = sRecords.filter(r => r.type === 'BHYT');

          const revBHXHNew = sBhxhRecords.filter(r => r.actionType === 'Đăng ký mới').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const revBHXHRenew = sBhxhRecords.filter(r => r.actionType === 'Gia hạn' || (r.actionType && r.actionType.toLowerCase().includes('gia hạn'))).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

          const revBHYTNew = sBhytRecords.filter(r => r.actionType === 'Đăng ký mới').reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          const revBHYTRenew = sBhytRecords.filter(r => r.actionType === 'Gia hạn' || (r.actionType && r.actionType.toLowerCase().includes('gia hạn'))).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

          const bhxhRev = revBHXHNew + revBHXHRenew;
          const bhytRev = revBHYTNew + revBHYTRenew;

          const bhxhComm = sBhxhRecords.reduce((sum, r) => sum + ((Number(r.amount) || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
          const bhytComm = sBhytRecords.reduce((sum, r) => sum + ((Number(r.amount) || 0) * getCommissionRateForRecord(r, policies, settings)), 0);

          return {
            ...s,
            totalRecords: sBhxhRecords.length + sBhytRecords.length,
            bhxhCount: sBhxhRecords.length,
            bhytCount: sBhytRecords.length,
            revenue: bhxhRev + bhytRev,
            commission: bhxhComm + bhytComm,
            bhxhRevenue: bhxhRev,
            bhytRevenue: bhytRev,
            bhxhCommission: bhxhComm,
            bhytCommission: bhytComm
          };
        });

        staffPerformance.sort((a, b) => b.revenue - a.revenue);

        let totalRev = 0;
        let totalComm = 0;

        if (staffReportFilter === 'all') {
          totalRev = filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
          totalComm = filteredRecords.reduce((sum, r) => sum + ((Number(r.amount) || 0) * getCommissionRateForRecord(r, policies, settings)), 0);
        } else {
          staffPerformance.forEach(p => {
            totalRev += p.revenue;
            totalComm += p.commission;
          });
        }

        setStats({
          bhxhCount,
          bhytCount,
          totalRev,
          totalComm,
          staffPerformance
        });

      } catch (error) {
        console.error("Error calculating report stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    calculateReportStats();
  }, [currentUser, settings, period, customStartDate, customEndDate, staffReportFilter, staff, isAuthReady, records, policies]);

  const displayedStaffData = React.useMemo(() => {
    return staffReportFilter === 'all' 
      ? stats.staffPerformance 
      : stats.staffPerformance.filter(s => s.id === staffReportFilter);
  }, [stats.staffPerformance, staffReportFilter]);

  const staffChartData = React.useMemo(() => ({
    labels: displayedStaffData.map(s => s.name),
    datasets: [
      {
        label: 'Doanh thu (VNĐ)',
        data: displayedStaffData.map(s => s.revenue),
        backgroundColor: '#004182',
        borderRadius: 4,
      },
      {
        label: 'Hoa hồng (VNĐ)',
        data: displayedStaffData.map(s => s.commission),
        backgroundColor: '#FDB913',
        borderRadius: 4,
      }
    ],
  }), [displayedStaffData]);

  const staffChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
    },
    scales: {
      y: { beginAtZero: true },
    },
    onClick: (_event: any, elements: any) => {
      if (elements.length > 0) {
        const dataIndex = elements[0].index;
        const staffMember = displayedStaffData[dataIndex];
        exportStaffDetails(staffMember);
      }
    }
  };

  const getPeriodText = () => {
    const now = new Date();
    if (period === 'today') {
      return `Hôm nay (ngày ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()})`;
    }
    if (period === 'week') {
      return `Tuần này (năm ${now.getFullYear()})`;
    }
    if (period === 'month') {
      return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }
    if (period === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `Tháng ${lm.getMonth() + 1}/${lm.getFullYear()}`;
    }
    if (period === 'quarter') {
      const q = Math.floor(now.getMonth() / 3) + 1;
      return `Quý ${q}/${now.getFullYear()}`;
    }
    if (period === 'year') {
      return `Năm ${now.getFullYear()}`;
    }
    if (period === 'custom') {
      const formatDateStr = (s: string) => {
        if (!s) return '';
        const [y, m, d] = s.split('-');
        return `${d}/${m}/${y}`;
      };
      return `Từ ngày ${formatDateStr(customStartDate)} đến ngày ${formatDateStr(customEndDate)}`;
    }
    return 'Toàn thời gian';
  };

  const handleExportStandardExcel = async () => {
    if (!canExportExcel) {
      alert("Bạn không có quyền xuất dữ liệu báo cáo ra Excel.");
      return;
    }
    try {
      await exportRevenueReportToExcel({
        periodText: getPeriodText(),
        agencyName: settings?.agencyName || 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ',
        parentAgencyName: settings?.parentAgencyName || 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA',
        staffData: displayedStaffData,
        currentUserName: currentUser?.name || 'Người lập biểu',
        managerName: settings?.managerName || 'Thủ trưởng đơn vị',
        reportLocation: settings?.reportLocation || 'Sông Mã',
        controllerName: settings?.controllerName || '',
        managerTitle: settings?.managerTitle || 'THỦ TRƯỞNG ĐƠN VỊ',
        creatorTitle: settings?.creatorTitle || 'NGƯỜI LẬP BIỂU',
        controllerTitle: settings?.controllerTitle || 'NGƯỜI KIỂM SOÁT'
      });
    } catch (error) {
      console.error("Lỗi xuất Excel chuẩn:", error);
    }
  };

  const handleExportStandardPdf = async () => {
    if (!canExportPdf) {
      alert("Bạn không có quyền xuất tài liệu PDF hoặc in ấn báo cáo.");
      return;
    }
    try {
      await exportRevenueReportToPdf({
        periodText: getPeriodText(),
        agencyName: settings?.agencyName || 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ',
        parentAgencyName: settings?.parentAgencyName || 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA',
        staffData: displayedStaffData,
        currentUserName: currentUser?.name || 'Người lập biểu',
        managerName: settings?.managerName || 'Thủ trưởng đơn vị',
        reportLocation: settings?.reportLocation || 'Sông Mã',
        controllerName: settings?.controllerName || '',
        managerTitle: settings?.managerTitle || 'THỦ TRƯỞNG ĐƠN VỊ',
        creatorTitle: settings?.creatorTitle || 'NGƯỜI LẬP BIỂU',
        controllerTitle: settings?.controllerTitle || 'NGƯỜI KIỂM SOÁT'
      });
    } catch (error) {
      console.error("Lỗi xuất PDF:", error);
    }
  };

  const exportReport = async () => {
    const summaryData = [
      { "Chỉ tiêu": "Giai đoạn", "Giá trị": period === 'all' ? 'Toàn thời gian' : period === 'month' ? 'Tháng này' : period === 'quarter' ? 'Quý này' : 'Năm nay' },
      { "Chỉ tiêu": "Nhân viên", "Giá trị": staffReportFilter === 'all' ? 'Tất cả' : staff.find(s => s.id === staffReportFilter)?.name || '' },
      { "Chỉ tiêu": "Tổng số hồ sơ BHXH", "Giá trị": stats.bhxhCount },
      { "Chỉ tiêu": "Tổng số hồ sơ BHYT", "Giá trị": stats.bhytCount },
      { "Chỉ tiêu": "Tổng doanh thu", "Giá trị": formatMoney(stats.totalRev) },
      { "Chỉ tiêu": "Tổng hoa hồng", "Giá trị": formatMoney(stats.totalComm) }
    ];
    
    const staffData = displayedStaffData.map(s => ({
      "Nhân viên": s.name,
      "Hồ sơ BHXH": s.bhxhCount || 0,
      "Hồ sơ BHYT": s.bhytCount || 0,
      "Doanh thu": s.revenue,
      "Hoa hồng": s.commission
    }));

    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const wb = XLSX.utils.book_new();
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "TongHop");
    
    if (staffData.length > 0) {
      const wsStaff = XLSX.utils.json_to_sheet(staffData);
      XLSX.utils.book_append_sheet(wb, wsStaff, "ChiTietNhanVien");
    }

    XLSX.writeFile(wb, `Bao_cao_tong_hop_${new Date().getTime()}.xlsx`);
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
          "Số tiền": r.amount,
          "Trạng thái": r.paymentStatus,
          "Hoa hồng": r.amount * rate
        };
      });

      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "ChiTietGiaoDich");
      XLSX.writeFile(wb, `Chi_tiet_GD_${staffMember.name.replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
    } catch (error) {
      console.error("Error exporting staff details:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Tab Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#004182]">Báo Cáo Thống Kê</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Tổng hợp dữ liệu doanh thu, hoa hồng và tệp khách hàng theo nhân viên quản lý
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
          <button
            onClick={() => setActiveReportTab('revenue')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeReportTab === 'revenue' 
                ? 'bg-[#004182] text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <BarChart3 size={16} /> Doanh Thu & Hoa Hồng
          </button>
          <button
            onClick={() => setActiveReportTab('staff-customers')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeReportTab === 'staff-customers' 
                ? 'bg-[#004182] text-white shadow-sm' 
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            <Users size={16} /> Khách Hàng Theo Nhân Viên
          </button>
        </div>
      </div>

      {/* Render Sub-Tab: Khách Hàng Theo Nhân Viên */}
      {activeReportTab === 'staff-customers' ? (
        <StaffCustomerReport />
      ) : (
        /* Render Sub-Tab: Doanh Thu & Hoa Hồng (Hiện Hữu) */
        <>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs sm:text-sm font-bold text-slate-700">Bộ lọc thời gian & đối tượng:</div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {canViewAll && (
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
                <option value="custom">Khoảng ngày tùy chọn</option>
              </select>

              {period === 'custom' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <Calendar size={14} className="text-slate-400" />
                    <span>Từ:</span>
                    <input 
                      type="date" 
                      value={customStartDate} 
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <span>Đến:</span>
                    <input 
                      type="date" 
                      value={customEndDate} 
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="bg-transparent font-medium text-slate-800 outline-none cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {canExportExcel && (
                  <button 
                    onClick={handleExportStandardExcel} 
                    title="Xuất bảng tổng hợp Excel chuẩn Nghị định 30/2020/NĐ-CP"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm transition shadow-xs flex items-center justify-center cursor-pointer flex-1 sm:flex-initial"
                  >
                    <FileSpreadsheet size={16} className="mr-1.5" /> Xuất Excel
                  </button>
                )}
                {canExportPdf && (
                  <>
                    <button 
                      onClick={handleExportStandardPdf} 
                      title="Xuất tài liệu PDF định dạng chuẩn BHXH Việt Nam"
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm transition shadow-xs flex items-center justify-center cursor-pointer flex-1 sm:flex-initial"
                    >
                      <FileText size={16} className="mr-1.5" /> Xuất PDF
                    </button>
                    <button 
                      onClick={() => setIsPrintPreviewOpen(true)} 
                      title="Xem trước định dạng A4 và In trực tiếp"
                      className="bg-[#004182] hover:bg-[#003166] text-white px-3.5 py-2 rounded-xl font-medium text-xs sm:text-sm transition shadow-xs flex items-center justify-center cursor-pointer flex-1 sm:flex-initial"
                    >
                      <Printer size={16} className="mr-1.5" /> Xem trước & In
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-4">Tổng Hợp Nhanh</h3>
            {isLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#004182]"></div>
                <span className="ml-2 text-slate-500">Đang tải dữ liệu...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-blue-50/70 rounded-xl border border-blue-100">
                  <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Tổng Hồ Sơ BHXH</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#004182]">{stats.bhxhCount || 0}</p>
                </div>
                <div className="p-3 sm:p-4 bg-cyan-50/70 rounded-xl border border-cyan-100">
                  <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Tổng Hồ Sơ BHYT</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#0ea5e9]">{stats.bhytCount || 0}</p>
                </div>
                <div className="p-3 sm:p-4 bg-amber-50/70 rounded-xl border border-amber-100">
                  <p className="text-xs sm:text-sm text-slate-500 font-semibold mb-1">Tổng Doanh Thu</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#FDB913]">{formatMoney(stats.totalRev || 0)}</p>
                </div>
              </div>
            )}
          </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6 mt-6">
        <div className="flex justify-between items-center mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-800 flex items-center">
            <Users className="text-[#004182] mr-2" size={18} />
            Báo Cáo Doanh Thu & Hoa Hồng Nhân Viên
          </h3>
        </div>

        <div className="flex flex-col gap-8">
          <div className="w-full">
            <h4 className="text-sm font-semibold text-slate-600 mb-4 text-center">Biểu Đồ So Sánh <span className="text-xs font-normal text-slate-400">(Nhấp vào cột để xuất chi tiết)</span></h4>
            <div className="w-full overflow-x-auto custom-scrollbar">
              <div className="h-80 cursor-pointer" style={{ minWidth: `${Math.max(displayedStaffData.length * 60, 600)}px` }}>
                <Bar 
                  data={staffChartData} 
                  options={staffChartOptions} 
                />
              </div>
            </div>
          </div>
          
          <div className="w-full">
            <h4 className="text-sm font-semibold text-slate-600 mb-4">Chi Tiết Hoa Hồng</h4>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto w-full custom-scrollbar rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Nhân viên</th>
                    <th className="p-3 text-center">Hồ sơ BHXH</th>
                    <th className="p-3 text-center">Hồ sơ BHYT</th>
                    <th className="p-3 text-right">Doanh thu BHXH</th>
                    <th className="p-3 text-right">Doanh thu BHYT</th>
                    <th className="p-3 text-right">Tổng Doanh thu</th>
                    <th className="p-3 text-right">Hoa hồng BHXH</th>
                    <th className="p-3 text-right">Hoa hồng BHYT</th>
                    <th className="p-3 text-right">Tổng Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedStaffData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-gray-500">Không có dữ liệu</td>
                    </tr>
                  ) : (
                    displayedStaffData.map((s, index) => (
                      <tr key={s.id || `new-${index}`} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{s.name}</td>
                        <td className="p-3 text-center">{s.bhxhCount || 0}</td>
                        <td className="p-3 text-center">{s.bhytCount || 0}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhxhRevenue || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhytRevenue || 0)}</td>
                        <td className="p-3 text-right font-semibold text-[#004182]">{formatMoney(s.revenue || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhxhCommission || 0)}</td>
                        <td className="p-3 text-right text-gray-600">{formatMoney(s.bhytCommission || 0)}</td>
                        <td className="p-3 text-right font-bold text-[#FDB913]">{formatMoney(s.commission || 0)}</td>
                      </tr>
                    ))
                  )}
                  {displayedStaffData.length > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td className="p-3 text-gray-800">Tổng cộng</td>
                      <td className="p-3 text-center">{displayedStaffData.reduce((sum, s) => sum + (s.bhxhCount || 0), 0)}</td>
                      <td className="p-3 text-center">{displayedStaffData.reduce((sum, s) => sum + (s.bhytCount || 0), 0)}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhRevenue || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytRevenue || 0), 0))}</td>
                      <td className="p-3 text-right text-[#004182]">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.revenue || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhxhCommission || 0), 0))}</td>
                      <td className="p-3 text-right text-gray-600">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.bhytCommission || 0), 0))}</td>
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
                    <h4 className="font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200">{s.name}</h4>
                    
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mb-4">
                      <div>
                        <span className="text-gray-500 text-xs block">Hồ sơ BHXH</span>
                        <span className="font-medium text-gray-700">{s.bhxhCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Hồ sơ BHYT</span>
                        <span className="font-medium text-gray-700">{s.bhytCount || 0}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Doanh thu BHXH</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhxhRevenue || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Doanh thu BHYT</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhytRevenue || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Hoa hồng BHXH</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhxhCommission || 0)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-xs block">Hoa hồng BHYT</span>
                        <span className="font-medium text-gray-700">{formatMoney(s.bhytCommission || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-200 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-700">Tổng Doanh thu:</span>
                        <span className="font-bold text-[#004182]">{formatMoney(s.revenue || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-700">Tổng Hoa hồng:</span>
                        <span className="font-bold text-[#FDB913] text-lg">{formatMoney(s.commission || 0)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {displayedStaffData.length > 0 && (
                <div className="bg-[#004182]/5 p-4 rounded-xl border border-[#004182]/10 mt-2">
                  <h4 className="font-bold text-gray-800 mb-3">Tổng Cộng Tất Cả</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-600 text-xs block">Tổng Hồ sơ BHXH</span>
                      <span className="font-medium text-gray-800">{displayedStaffData.reduce((sum, s) => sum + (s.bhxhCount || 0), 0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs block">Tổng Hồ sơ BHYT</span>
                      <span className="font-medium text-gray-800">{displayedStaffData.reduce((sum, s) => sum + (s.bhytCount || 0), 0)}</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">Tổng Doanh thu:</span>
                      <span className="font-bold text-[#004182]">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.revenue || 0), 0))}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-800">Tổng Hoa hồng:</span>
                      <span className="font-bold text-[#FDB913] text-xl">{formatMoney(displayedStaffData.reduce((sum, s) => sum + (s.commission || 0), 0))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {isPrintPreviewOpen && (
        <ReportPrintPreviewModal
          isOpen={isPrintPreviewOpen}
          onClose={() => setIsPrintPreviewOpen(false)}
          periodText={getPeriodText()}
          agencyName={settings?.agencyName || 'ĐẠI LÝ THU BHXH, BHYT SÔNG MÃ'}
          parentAgencyName={settings?.parentAgencyName || 'BẢO HIỂM XÃ HỘI TỈNH SƠN LA'}
          staffData={displayedStaffData}
          currentUserName={currentUser?.name || 'Người lập biểu'}
          managerName={settings?.managerName || 'Thủ trưởng đơn vị'}
          reportLocation={settings?.reportLocation || 'Sông Mã'}
          controllerName={settings?.controllerName || ''}
          managerTitle={settings?.managerTitle || 'THỦ TRƯỞNG ĐƠN VỊ'}
          creatorTitle={settings?.creatorTitle || 'NGƯỜI LẬP BIỂU'}
          controllerTitle={settings?.controllerTitle || 'NGƯỜI KIỂM SOÁT'}
        />
      )}
    </div>
  );
};

export default Reports;
