import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../../context/AppContext';
import { formatMoney } from '../../../utils/helpers';
import { 
  Users, 
  Search, 
  FileDown, 
  UserCheck, 
  Shield, 
  HeartPulse, 
  MapPin, 
  Phone, 
  ExternalLink, 
  X, 
  TrendingUp 
} from 'lucide-react';

interface StaffCustomerStat {
  staffId: string;
  staffName: string;
  staffCode: string;
  role: string;
  area: string;
  phone: string;
  status: string;
  totalCustomers: number;
  bhxhCustomers: number;
  bhytCustomers: number;
  bothCustomers: number;
  totalRecords: number;
  totalRevenue: number;
  expiringCustomers: number;
  customers: {
    key: string;
    name: string;
    cccd?: string | undefined;
    phone?: string | undefined;
    bhxh?: string | undefined;
    address?: string | undefined;
    types: ('BHXH' | 'BHYT')[];
    recordsCount: number;
    totalPaid: number;
    lastPaymentDate: string;
    nextPayment?: string | undefined;
    status: string;
  }[];
}

export const StaffCustomerReport: React.FC = () => {
  const { staff, records, currentUser, isAuthReady } = useAppContext();
  const [searchTxt, setSearchTxt] = useState('');
  const [areaFilter, setAreaFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<StaffCustomerStat | null>(null);
  const [customerSearchTxt, setCustomerSearchTxt] = useState('');
  const [customerTypeFilter, setCustomerTypeFilter] = useState<'all' | 'BHXH' | 'BHYT'>('all');

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'Quản lý';

  // Lọc danh sách nhân viên theo quyền xem
  const visibleStaff = useMemo(() => {
    if (!isAdmin && currentUser) {
      return staff.filter(s => s.id === currentUser.id || s.username === currentUser.username);
    }
    return staff;
  }, [staff, isAdmin, currentUser]);

  // Tập hợp danh sách khu vực để lọc
  const areas = useMemo(() => {
    const set = new Set<string>();
    staff.forEach(s => {
      if (s.area) set.add(s.area.trim());
    });
    return Array.from(set).sort();
  }, [staff]);

  // Tính toán thống kê khách hàng theo từng nhân viên
  const staffStats: StaffCustomerStat[] = useMemo(() => {
    if (!isAuthReady) return [];

    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return visibleStaff.map(s => {
      // Lấy toàn bộ giao dịch hợp lệ của nhân viên này
      const staffRecords = records.filter(r => {
        const sId = r.staff_id || (r as any).staffId;
        const pStatus = r.payment_status || (r as any).paymentStatus;
        return (sId === s.id || sId === s.username) && pStatus !== 'Đã hủy';
      });

      // Gom cụm khách hàng duy nhất của nhân viên (Deduplication theo CCCD hoặc Phone hoặc Tên+Địa chỉ)
      const customerMap = new Map<string, {
        key: string;
        name: string;
        cccd?: string | undefined;
        phone?: string | undefined;
        bhxh?: string | undefined;
        address?: string | undefined;
        types: Set<'BHXH' | 'BHYT'>;
        recordsCount: number;
        totalPaid: number;
        lastPaymentDate: string;
        nextPayment?: string | undefined;
        status: string;
      }>();

      let staffRev = 0;
      let expiringCount = 0;

      staffRecords.forEach(r => {
        staffRev += (Number(r.amount) || 0);

        // Sinh khóa định danh khách hàng duy nhất
        const cleanCccd = (r.cccd || '').replace(/\D/g, '');
        const cleanPhone = (r.phone || '').replace(/\D/g, '');
        const cleanName = (r.name || '').trim().toLowerCase();
        
        const custKey = cleanCccd 
          ? `CCCD_${cleanCccd}` 
          : cleanPhone 
            ? `PHONE_${cleanPhone}` 
            : `NAME_${cleanName}_${(r.address || '').trim().toLowerCase()}`;

        if (!customerMap.has(custKey)) {
          customerMap.set(custKey, {
            key: custKey,
            name: r.name || 'Chưa đặt tên',
            cccd: r.cccd,
            phone: r.phone,
            bhxh: r.bhxh || r.old_bhxh || (r as any).oldBhxh,
            address: r.address,
            types: new Set(),
            recordsCount: 0,
            totalPaid: 0,
            lastPaymentDate: r.date,
            nextPayment: r.next_payment || (r as any).nextPayment || (r as any).targetDate,
            status: r.status || 'Hoạt động'
          });
        }

        const c = customerMap.get(custKey)!;
        if (r.type === 'BHXH' || r.type === 'BHYT') {
          c.types.add(r.type);
        }
        c.recordsCount += 1;
        c.totalPaid += (Number(r.amount) || 0);

        if (!c.cccd && r.cccd) c.cccd = r.cccd;
        if (!c.phone && r.phone) c.phone = r.phone;
        if (!c.bhxh && (r.bhxh || r.old_bhxh || (r as any).oldBhxh)) {
          c.bhxh = r.bhxh || r.old_bhxh || (r as any).oldBhxh;
        }
        if (!c.address && r.address) c.address = r.address;

        if (r.date > c.lastPaymentDate) {
          c.lastPaymentDate = r.date;
        }
        const rNext = r.next_payment || (r as any).nextPayment;
        if (rNext && (!c.nextPayment || rNext > c.nextPayment)) {
          c.nextPayment = rNext;
        }
      });

      // Phân loại khách hàng theo sản phẩm
      let bhxhCount = 0;
      let bhytCount = 0;
      let bothCount = 0;

      const customerList = Array.from(customerMap.values()).map(c => {
        const typeArray = Array.from(c.types);
        if (typeArray.includes('BHXH') && typeArray.includes('BHYT')) {
          bothCount += 1;
          bhxhCount += 1;
          bhytCount += 1;
        } else if (typeArray.includes('BHXH')) {
          bhxhCount += 1;
        } else if (typeArray.includes('BHYT')) {
          bhytCount += 1;
        }

        // Kiểm tra sắp đến hạn trong 30 ngày
        if (c.nextPayment) {
          const nextDate = new Date(c.nextPayment);
          if (!isNaN(nextDate.getTime()) && nextDate >= now && nextDate <= thirtyDaysAhead) {
            expiringCount += 1;
          }
        }

        return {
          ...c,
          types: typeArray
        };
      });

      return {
        staffId: s.id || s.username || '',
        staffName: s.name,
        staffCode: s.staff_code || (s as any).staffCode || s.username || s.id || 'N/A',
        role: s.role || 'Nhân viên',
        area: s.area || 'Chưa phân vùng',
        phone: s.phone || 'Chưa cập nhật',
        status: s.status || 'Hoạt động',
        totalCustomers: customerList.length,
        bhxhCustomers: bhxhCount,
        bhytCustomers: bhytCount,
        bothCustomers: bothCount,
        totalRecords: staffRecords.length,
        totalRevenue: staffRev,
        expiringCustomers: expiringCount,
        customers: customerList
      };
    });
  }, [visibleStaff, records, isAuthReady]);

  // Bộ lọc tìm kiếm và phân vùng
  const filteredStaffStats = useMemo(() => {
    return staffStats.filter(s => {
      const matchSearch = s.staffName.toLowerCase().includes(searchTxt.toLowerCase()) ||
                          s.staffCode.toLowerCase().includes(searchTxt.toLowerCase()) ||
                          s.phone.includes(searchTxt) ||
                          s.area.toLowerCase().includes(searchTxt.toLowerCase());
      const matchArea = areaFilter === 'all' || s.area === areaFilter;
      const matchStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchSearch && matchArea && matchStatus;
    });
  }, [staffStats, searchTxt, areaFilter, statusFilter]);

  // Tổng hợp KPI toàn hệ thống
  const globalKpis = useMemo(() => {
    let totalCust = 0;
    let totalRev = 0;
    let totalExpiring = 0;
    let topStaffName = 'Chưa có';
    let maxCust = -1;

    // Tổng số khách hàng deduplicated toàn hệ thống
    const globalCustomerKeys = new Set<string>();
    let globalBhxhKeys = new Set<string>();
    let globalBhytKeys = new Set<string>();

    staffStats.forEach(s => {
      totalRev += s.totalRevenue;
      totalExpiring += s.expiringCustomers;

      if (s.totalCustomers > maxCust && s.totalCustomers > 0) {
        maxCust = s.totalCustomers;
        topStaffName = `${s.staffName} (${s.totalCustomers} KH)`;
      }

      s.customers.forEach(c => {
        globalCustomerKeys.add(c.key);
        if (c.types.includes('BHXH')) globalBhxhKeys.add(c.key);
        if (c.types.includes('BHYT')) globalBhytKeys.add(c.key);
      });
    });

    totalCust = globalCustomerKeys.size;

    return {
      totalUniqueCustomers: totalCust,
      totalBhxhCustomers: globalBhxhKeys.size,
      totalBhytCustomers: globalBhytKeys.size,
      totalRevenue: totalRev,
      totalExpiring: totalExpiring,
      topStaff: topStaffName
    };
  }, [staffStats]);

  // Xuất file Excel Báo cáo Khách hàng theo nhân viên
  const handleExportExcel = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      // Sheet 1: Tổng hợp theo nhân viên
      const summaryRows = filteredStaffStats.map((s, idx) => ({
        "STT": idx + 1,
        "Mã NV": s.staffCode,
        "Họ và Tên": s.staffName,
        "Phân quyền": s.role,
        "Khu vực": s.area,
        "Số điện thoại": s.phone,
        "Trạng thái": s.status,
        "Tổng số khách hàng": s.totalCustomers,
        "Khách hàng BHXH": s.bhxhCustomers,
        "Khách hàng BHYT": s.bhytCustomers,
        "KH tham gia cả 2": s.bothCustomers,
        "KH sắp đến hạn (30 ngày)": s.expiringCustomers,
        "Tổng số hồ sơ": s.totalRecords,
        "Tổng doanh thu thu hộ (VNĐ)": s.totalRevenue
      }));

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Tong_Hop_Nhan_Vien");

      // Sheet 2: Danh sách khách hàng chi tiết của tất cả nhân viên lọc
      const allCustomersRows: any[] = [];
      filteredStaffStats.forEach(s => {
        s.customers.forEach(c => {
          allCustomersRows.push({
            "Mã NV Quản lý": s.staffCode,
            "Tên NV Quản lý": s.staffName,
            "Khu vực": s.area,
            "Họ tên khách hàng": c.name,
            "Số CCCD/Định danh": c.cccd || '',
            "Số điện thoại": c.phone || '',
            "Mã số BHXH": c.bhxh || '',
            "Địa chỉ": c.address || '',
            "Loại hình tham gia": c.types.join(' & '),
            "Số lượt nộp": c.recordsCount,
            "Tổng tiền đã nộp (VNĐ)": c.totalPaid,
            "Ngày nộp gần nhất": c.lastPaymentDate || '',
            "Hạn đóng tiếp theo": c.nextPayment || '',
            "Trạng thái": c.status
          });
        });
      });

      if (allCustomersRows.length > 0) {
        const wsCustomers = XLSX.utils.json_to_sheet(allCustomersRows);
        XLSX.utils.book_append_sheet(wb, wsCustomers, "Chi_Tiet_Khach_Hang");
      }

      XLSX.writeFile(wb, `Bao_cao_khach_hang_theo_nhan_vien_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error("Lỗi xuất Excel:", err);
    }
  };

  // Lọc danh sách khách hàng trong modal drill-down
  const filteredModalCustomers = useMemo(() => {
    if (!selectedStaffDetail) return [];
    return selectedStaffDetail.customers.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(customerSearchTxt.toLowerCase()) ||
                          (c.cccd && c.cccd.includes(customerSearchTxt)) ||
                          (c.phone && c.phone.includes(customerSearchTxt)) ||
                          (c.bhxh && c.bhxh.includes(customerSearchTxt));
      const matchType = customerTypeFilter === 'all' || c.types.includes(customerTypeFilter);
      return matchSearch && matchType;
    });
  }, [selectedStaffDetail, customerSearchTxt, customerTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Header & Công cụ lọc */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-[#004182] flex items-center gap-2">
            <Users className="text-[#0ea5e9]" size={24} />
            Thống Kê Khách Hàng Theo Từng Nhân Viên Quản Lý
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Theo dõi quy mô tệp người tham gia BHXH Tự nguyện & BHYT Hộ gia đình của từng cán bộ thu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              value={searchTxt}
              onChange={e => setSearchTxt(e.target.value)}
              placeholder="Tìm tên, mã nhân viên, SĐT..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-gray-200 focus:border-[#0ea5e9] outline-none"
            />
          </div>

          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="p-2 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9]"
          >
            <option value="all">Tất cả khu vực</option>
            {areas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="p-2 text-xs sm:text-sm rounded-xl border border-gray-200 bg-white outline-none focus:border-[#0ea5e9]"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Hoạt động">Đang hoạt động</option>
            <option value="Tạm khóa">Tạm khóa / Ngừng</option>
          </select>

          <button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm transition shrink-0 cursor-pointer"
          >
            <FileDown size={16} /> Xuất Excel Thống Kê
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/40 p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#004182] text-white flex items-center justify-center shrink-0">
            <Users size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Tổng khách hàng</span>
            <h4 className="text-xl sm:text-2xl font-black text-[#004182]">{globalKpis.totalUniqueCustomers.toLocaleString()}</h4>
            <span className="text-[11px] text-gray-500">Người tham gia thực tế</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-sky-50/40 p-4 rounded-2xl border border-cyan-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0ea5e9] text-white flex items-center justify-center shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Khách hàng BHXH</span>
            <h4 className="text-xl sm:text-2xl font-black text-[#0ea5e9]">{globalKpis.totalBhxhCustomers.toLocaleString()}</h4>
            <span className="text-[11px] text-gray-500">BHXH Tự nguyện</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <HeartPulse size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Khách hàng BHYT</span>
            <h4 className="text-xl sm:text-2xl font-black text-emerald-700">{globalKpis.totalBhytCustomers.toLocaleString()}</h4>
            <span className="text-[11px] text-gray-500">BHYT Hộ gia đình</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Quản lý nhiều nhất</span>
            <h4 className="text-sm sm:text-base font-black text-amber-900 truncate max-w-[180px]" title={globalKpis.topStaff}>
              {globalKpis.topStaff}
            </h4>
            <span className="text-[11px] text-amber-700 font-semibold">Cán bộ thu tiêu biểu</span>
          </div>
        </div>
      </div>

      {/* Bảng dữ liệu thống kê */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/70">
          <h4 className="text-sm font-bold text-slate-800">
            Danh Sách Nhân Viên & Tỷ Trọng Khách Hàng ({filteredStaffStats.length} nhân sự)
          </h4>
          <span className="text-xs text-slate-500 italic">Nhấn vào "Xem Khách Hàng" để xem danh sách chi tiết</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="p-3 sm:p-4 text-center">STT</th>
                <th className="p-3 sm:p-4">Mã NV</th>
                <th className="p-3 sm:p-4">Họ và Tên</th>
                <th className="p-3 sm:p-4">Khu Vực</th>
                <th className="p-3 sm:p-4 text-center">Tổng KH</th>
                <th className="p-3 sm:p-4 text-center">KH BHXH</th>
                <th className="p-3 sm:p-4 text-center">KH BHYT</th>
                <th className="p-3 sm:p-4 text-center">Cả 2 Loại</th>
                <th className="p-3 sm:p-4 text-right">Tổng Tiền Thu</th>
                <th className="p-3 sm:p-4 text-center">Trạng Thái</th>
                <th className="p-3 sm:p-4 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaffStats.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">
                    Không tìm thấy nhân viên nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              ) : (
                filteredStaffStats.map((s, idx) => (
                  <tr key={s.staffId} className="hover:bg-blue-50/40 transition">
                    <td className="p-3 sm:p-4 text-center font-mono text-gray-500">{idx + 1}</td>
                    <td className="p-3 sm:p-4 font-mono font-bold text-[#004182]">{s.staffCode}</td>
                    <td className="p-3 sm:p-4 font-bold text-gray-800">
                      <div>{s.staffName}</div>
                      <div className="text-[11px] text-gray-400 font-normal flex items-center gap-1 mt-0.5">
                        <Phone size={11} /> {s.phone}
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} className="text-gray-400" /> {s.area}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-[#004182]">
                        {s.totalCustomers}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center font-semibold text-[#004182]">
                      {s.bhxhCustomers}
                    </td>
                    <td className="p-3 sm:p-4 text-center font-semibold text-[#0ea5e9]">
                      {s.bhytCustomers}
                    </td>
                    <td className="p-3 sm:p-4 text-center text-purple-700 font-bold">
                      {s.bothCustomers}
                    </td>
                    <td className="p-3 sm:p-4 text-right font-bold text-amber-700">
                      {formatMoney(s.totalRevenue)}
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        s.status === 'Hoạt động' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 text-center">
                      <button
                        onClick={() => setSelectedStaffDetail(s)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#004182] font-bold text-xs rounded-xl flex items-center gap-1 mx-auto transition cursor-pointer"
                        title="Xem danh sách khách hàng chi tiết"
                      >
                        <ExternalLink size={13} /> Xem Khách Hàng
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Drill-Down Xem Khách Hàng Chi Tiết */}
      {selectedStaffDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#004182] to-[#00264d] p-5 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck size={20} className="text-[#0ea5e9]" />
                  <h3 className="text-lg font-bold">Danh Sách Khách Hàng Quản Lý: {selectedStaffDetail.staffName}</h3>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  Mã NV: <span className="font-mono font-bold text-white">{selectedStaffDetail.staffCode}</span> | Khu vực: {selectedStaffDetail.area} | Tổng: <span className="font-bold text-white">{selectedStaffDetail.totalCustomers} khách hàng</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedStaffDetail(null)}
                className="text-white/80 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Filter Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-3 items-center justify-between">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={customerSearchTxt}
                  onChange={e => setCustomerSearchTxt(e.target.value)}
                  placeholder="Tìm họ tên, CCCD, SĐT, mã BHXH..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:border-[#004182] outline-none text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={customerTypeFilter}
                  onChange={e => setCustomerTypeFilter(e.target.value as any)}
                  className="p-1.5 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-[#004182] text-slate-700"
                >
                  <option value="all">Tất cả sản phẩm</option>
                  <option value="BHXH">Chỉ BHXH Tự nguyện</option>
                  <option value="BHYT">Chỉ BHYT Hộ gia đình</option>
                </select>

                <span className="text-xs text-slate-500 font-semibold">
                  Hiển thị: {filteredModalCustomers.length} KH
                </span>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-xs">
                  <tr>
                    <th className="p-3 text-center">STT</th>
                    <th className="p-3">Họ và Tên</th>
                    <th className="p-3">CCCD / SĐT</th>
                    <th className="p-3">Mã BHXH</th>
                    <th className="p-3">Sản Phẩm</th>
                    <th className="p-3 text-center">Lượt Nộp</th>
                    <th className="p-3 text-right">Tổng Tiền</th>
                    <th className="p-3 text-center">Nộp Gần Nhất</th>
                    <th className="p-3 text-center">Hạn Đóng Tiếp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredModalCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Không có khách hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredModalCustomers.map((c, cIdx) => (
                      <tr key={c.key} className="hover:bg-slate-50/80 transition">
                        <td className="p-3 text-center text-slate-400 font-mono">{cIdx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">
                          <div>{c.name}</div>
                          {c.address && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.address}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-slate-700">{c.cccd || 'Chưa có'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.phone || ''}</div>
                        </td>
                        <td className="p-3 font-mono font-semibold text-[#004182]">
                          {c.bhxh || 'N/A'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {c.types.map(t => (
                              <span 
                                key={t} 
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t === 'BHXH' ? 'bg-blue-100 text-[#004182]' : 'bg-cyan-100 text-[#0ea5e9]'
                                }`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-center font-bold text-slate-600">{c.recordsCount}</td>
                        <td className="p-3 text-right font-bold text-amber-700">{formatMoney(c.totalPaid)}</td>
                        <td className="p-3 text-center font-mono text-slate-600">{c.lastPaymentDate || 'N/A'}</td>
                        <td className="p-3 text-center font-mono text-emerald-700 font-semibold">
                          {c.nextPayment || 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-medium">
                Dữ liệu khớp nối định danh tự động theo CCCD và Số điện thoại.
              </span>
              <button
                onClick={() => setSelectedStaffDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffCustomerReport;
