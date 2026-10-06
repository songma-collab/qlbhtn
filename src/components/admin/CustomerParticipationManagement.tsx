import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
  History,
  Search,
  Filter,
  UserCheck,
  Building,
  Shield,
  Clock,
  ArrowRight,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  Edit,
  Plus,
  Eye
} from 'lucide-react';
import type { CustomerType } from '../../context/types';
import { CustomerParticipationModal } from '../modals/CustomerParticipationModal';
import { CustomerParticipationViewModal } from '../modals/CustomerParticipationViewModal';
import {
  transferCustomerTo1Lan,
  calculateCustomerParticipationSupport
} from '../../utils/customerParticipationHelper';
import { groupRecordsByCustomer } from '../../utils/helpers';

export const CustomerParticipationManagement: React.FC = () => {
  const { customers, records, showToast } = useAppContext() as any;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'bhxh_only' | 'has_prior' | 'no_prior' | 'support_expired' | 'support_remaining'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // Modal quản lý & xem chi tiết
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerType | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [viewCustomer, setViewCustomer] = useState<CustomerType | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);

  // Map số tháng tự nguyện tại đại lý từ bảng records theo CCCD / Mã BHXH
  const agencyRecordsMonthsMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!records || !Array.isArray(records)) return map;

    for (const r of records) {
      if (!r || r.type !== 'BHXH') continue;
      if (r.paymentStatus === 'Đã hủy' || r.status === 'Đã hủy' || r.isAdjustment) continue;

      const m = Number(r.months) || 0;
      if (m <= 0) continue;

      const cccd = (r.cccd || r.citizenId || '').trim();
      const bhxh = (r.bhxh || r.bhxhCode || r.old_bhxh || r.oldBhxh || '').trim();

      if (cccd) {
        map.set(cccd, (map.get(cccd) || 0) + m);
      }
      if (bhxh && bhxh !== cccd) {
        map.set(bhxh, (map.get(bhxh) || 0) + m);
      }
    }
    return map;
  }, [records]);

  // Map dữ liệu hồ sơ quá trình tham gia từ bảng customers theo CCCD / BHXH / CustomerKey / ID
  const customerMasterMap = useMemo(() => {
    const map = new Map<string, CustomerType>();
    if (!customers || !Array.isArray(customers)) return map;

    for (const c of customers) {
      if (!c) continue;
      const cccd = (c.cccd || '').trim().toLowerCase();
      const bhxh = (c.bhxh || c.old_bhxh || c.oldBhxh || '').trim().toLowerCase();
      const custKey = (c.customer_key || (c as any).customerKey || '').trim().toLowerCase();
      const id = c.id ? String(c.id).trim().toLowerCase() : '';

      if (cccd) map.set(`cccd_${cccd}`, c);
      if (bhxh) map.set(`bhxh_${bhxh}`, c);
      if (custKey) map.set(`key_${custKey}`, c);
      if (id) map.set(`id_${id}`, c);
    }
    return map;
  }, [customers]);

  // Danh sách khách hàng kèm tổng hợp số tháng (Đồng bộ chuẩn 918 khách hàng duy nhất như Dashboard & CRM)
  const enrichedCustomers = useMemo(() => {
    // 1. Lấy danh bạ khách hàng chuẩn từ đại lý (918 khách hàng duy nhất như Dashboard & CRM)
    const baseCustomers: any[] = (records && Array.isArray(records) && records.length > 0)
      ? groupRecordsByCustomer(records)
      : (customers || []);

    return baseCustomers.map((c: any) => {
      const cccd = (c.cccd || '').trim();
      const bhxh = (c.bhxh || c.old_bhxh || c.oldBhxh || '').trim();
      const custKey = (c.customer_key || c.customerKey || '').trim();
      const id = c.id ? String(c.id).trim() : '';

      // Tìm thông tin hồ sơ tham gia đã lưu trong master data
      const master = (cccd ? customerMasterMap.get(`cccd_${cccd.toLowerCase()}`) : null)
        || (bhxh ? customerMasterMap.get(`bhxh_${bhxh.toLowerCase()}`) : null)
        || (custKey ? customerMasterMap.get(`key_${custKey.toLowerCase()}`) : null)
        || (id ? customerMasterMap.get(`id_${id.toLowerCase()}`) : null);

      const agencyMonths = Math.max(
        agencyRecordsMonthsMap.get(cccd) || 0,
        agencyRecordsMonthsMap.get(bhxh) || 0
      );

      const prior_periods = master?.prior_periods || c.prior_periods || [];
      const compulsoryMonths = Number(master?.prior_compulsory_months ?? c.prior_compulsory_months ?? 0);
      const priorVoluntaryMonths = Number(master?.prior_voluntary_months ?? c.prior_voluntary_months ?? 0);
      const prior_participation_notes = master?.prior_participation_notes || c.prior_participation_notes || '';

      const totalVoluntary = priorVoluntaryMonths + agencyMonths;
      const totalAccumulated = compulsoryMonths + totalVoluntary;

      // Tính số tháng được NSNN hỗ trợ chuẩn xác (chỉ tính từ 01/2018 trở đi theo NĐ 134/2015 & Luật BHXH 2024)
      let voluntarySupportedMonths = totalVoluntary;
      let unsupportedBefore2018 = 0;

      if (prior_periods && Array.isArray(prior_periods) && prior_periods.length > 0) {
        const supportStats = calculateCustomerParticipationSupport(prior_periods, [], 0);
        voluntarySupportedMonths = supportStats.voluntarySupportedMonths + agencyMonths;
        unsupportedBefore2018 = supportStats.voluntaryUnsupportedBefore2018Months;
      }

      const supportedMonths = Math.min(120, voluntarySupportedMonths);
      const remainingSupport = Math.max(0, 120 - voluntarySupportedMonths);
      const isSupportExpired = voluntarySupportedMonths >= 120;
      const hasPrior = compulsoryMonths > 0 || priorVoluntaryMonths > 0 || (prior_periods && prior_periods.length > 0);

      return {
        ...c,
        id: master?.id || c.id,
        customer_key: master?.customer_key || c.customer_key || c.customerKey,
        prior_periods,
        prior_compulsory_months: compulsoryMonths,
        prior_voluntary_months: priorVoluntaryMonths,
        prior_participation_notes,
        compulsoryMonths,
        priorVoluntaryMonths,
        agencyMonths,
        totalVoluntary,
        totalAccumulated,
        voluntarySupportedMonths,
        unsupportedBefore2018,
        supportedMonths,
        remainingSupport,
        isSupportExpired,
        hasPrior
      };
    });
  }, [records, customers, customerMasterMap, agencyRecordsMonthsMap]);

  // Bộ lọc tìm kiếm & Filter Pill
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(c => {
      // 1. Tìm kiếm theo từ khóa
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesCccd = (c.cccd || '').toLowerCase().includes(q);
        const matchesBhxh = (c.bhxh || c.old_bhxh || c.oldBhxh || '').toLowerCase().includes(q);
        const matchesPhone = (c.phone || '').toLowerCase().includes(q);
        const matchesNotes = (c.prior_participation_notes || '').toLowerCase().includes(q);

        if (!matchesName && !matchesCccd && !matchesBhxh && !matchesPhone && !matchesNotes) {
          return false;
        }
      }

      // 2. Lọc theo trạng thái
      if (filterType === 'bhxh_only') return c.type === 'BHXH';
      if (filterType === 'has_prior') return c.hasPrior;
      if (filterType === 'no_prior') return !c.hasPrior;
      if (filterType === 'support_expired') return c.isSupportExpired;
      if (filterType === 'support_remaining') return !c.isSupportExpired && c.totalVoluntary > 0;

      return true;
    });
  }, [enrichedCustomers, searchTerm, filterType]);

  // Thống kê nhanh KPI
  const stats = useMemo(() => {
    let totalUpdated = 0;
    let totalCompulsoryMonths = 0;
    let totalPriorVoluntaryMonths = 0;
    let totalExpired = 0;
    let bhxhCount = 0;

    for (const c of enrichedCustomers) {
      if (c.type === 'BHXH') bhxhCount++;
      if (c.hasPrior) totalUpdated++;
      totalCompulsoryMonths += c.compulsoryMonths;
      totalPriorVoluntaryMonths += c.priorVoluntaryMonths;
      if (c.isSupportExpired) totalExpired++;
    }

    return {
      totalCustomers: enrichedCustomers.length,
      bhxhCount,
      totalUpdated,
      totalCompulsoryMonths,
      totalPriorVoluntaryMonths,
      totalExpired
    };
  }, [enrichedCustomers]);

  // Phân trang
  const totalCount = filteredCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  const openUpdateModal = (c: CustomerType) => {
    setSelectedCustomer(c);
    setIsModalOpen(true);
  };

  const openViewModal = (c: CustomerType) => {
    setViewCustomer(c);
    setIsViewModalOpen(true);
  };

  const handleTransferTo1LanDirect = (c: any) => {
    transferCustomerTo1Lan(c, records, navigate, showToast);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Phân Hệ */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#004182] to-[#002b5c] text-white flex items-center justify-center shadow-xs shrink-0">
            <History size={24} className="text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              Hồ Sơ Tham Gia BHXH Trước Đây
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Quản lý thời gian đóng BHXH bắt buộc và tự nguyện nơi khác. Căn cứ tính chính xác trần 10 năm (120 tháng) hỗ trợ NSNN theo Luật BHXH 2024 & NĐ 159/2025.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => navigate('/bhxh1lan')}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Calculator size={16} />
            <span>Mở Phân Hệ BHXH 1 Lần</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng danh bạ</span>
            <UserCheck size={18} className="text-[#004182]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {stats.totalCustomers}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Khách hàng trong hệ thống</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Đã cập nhật quá trình</span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-700">
            {stats.totalUpdated}
          </div>
          <p className="text-[11px] text-emerald-600/80 mt-1">Hồ sơ đã ghi nhận thời gian ngoài</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#004182]">BHXH Bắt Buộc Ngoài</span>
            <Building size={18} className="text-[#004182]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-[#004182]">
            {stats.totalCompulsoryMonths} <span className="text-xs font-semibold text-slate-500">tháng</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">~{(stats.totalCompulsoryMonths / 12).toFixed(1)} năm tích lũy hưu trí</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">Hết hạn mức 120 tháng</span>
            <AlertCircle size={18} className="text-rose-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-700">
            {stats.totalExpired}
          </div>
          <p className="text-[11px] text-rose-600/80 mt-1">Đã đóng đủ 10 năm tự nguyện</p>
        </div>
      </div>

      {/* Thanh Tìm Kiếm & Lọc */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm theo Tên, CCCD, Mã BHXH, SĐT..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none transition placeholder:text-slate-400"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
            <button
              type="button"
              onClick={() => { setFilterType('all'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tất cả ({enrichedCustomers.length})
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('bhxh_only'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterType === 'bhxh_only'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Khách hàng BHXH ({stats.bhxhCount})
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('has_prior'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterType === 'has_prior'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Đã có thời gian ngoài ({stats.totalUpdated})
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('support_remaining'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterType === 'support_remaining'
                  ? 'bg-[#004182] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Còn hỗ trợ NSNN
            </button>
            <button
              type="button"
              onClick={() => { setFilterType('support_expired'); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                filterType === 'support_expired'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Đã hết 120 tháng ({stats.totalExpired})
            </button>
          </div>
        </div>
      </div>

      {/* Bảng Danh Sách 7 Cột Chi Tiết */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">1. Khách Hàng</th>
                <th className="p-4">2. BHXH Bắt Buộc Trước Đây</th>
                <th className="p-4">3. BHXH TN Nơi Khác</th>
                <th className="p-4">4. BHXH TN Tại Đại Lý</th>
                <th className="p-4">5. Tổng Tích Lũy</th>
                <th className="p-4">6. Hỗ Trợ NSNN (Trần 10 Năm)</th>
                <th className="p-4 text-center">7. Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedCustomers.map((c, index) => {
                const recentWorkplace = c.prior_periods?.find((p: any) => p.workplace)?.workplace || '';
                const recentPosition = c.prior_periods?.find((p: any) => p.position)?.position || '';

                return (
                  <tr key={c.id || c.customer_key || index} className="hover:bg-slate-50/80 transition border-b border-slate-100">
                    
                    {/* Cột 1: Thông tin khách hàng */}
                    <td className="p-4">
                      <div className="font-extrabold text-gray-900 text-sm sm:text-base">
                        {c.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                        <div>
                          CCCD: <span className="font-bold text-gray-700">{c.cccd || '---'}</span>
                        </div>
                        <div>
                          Mã BHXH: <span className="font-bold text-gray-700">{c.bhxh || c.old_bhxh || c.oldBhxh || '---'}</span>
                        </div>
                        {c.phone && (
                          <div className="text-blue-600 font-medium flex items-center gap-1">
                            <Phone size={11} className="text-green-600" /> {c.phone}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Cột 2: BHXH Bắt buộc trước đây */}
                    <td className="p-4">
                      {c.compulsoryMonths > 0 ? (
                        <div>
                          <span className="font-black text-[#004182] text-sm">
                            {c.compulsoryMonths} tháng
                          </span>
                          <span className="text-xs text-gray-500 ml-1">
                            ({(c.compulsoryMonths / 12).toFixed(1)} năm)
                          </span>
                          {(recentPosition || recentWorkplace) && (
                            <div className="text-[11px] text-gray-500 mt-1 truncate max-w-[200px]" title={`${recentPosition} - ${recentWorkplace}`}>
                              {recentPosition || recentWorkplace}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa ghi nhận</span>
                      )}
                    </td>

                    {/* Cột 3: BHXH Tự nguyện nơi khác */}
                    <td className="p-4">
                      {c.priorVoluntaryMonths > 0 ? (
                        <div>
                          <span className="font-black text-blue-700 text-sm">
                            {c.priorVoluntaryMonths} tháng
                          </span>
                          <span className="text-xs text-blue-500 ml-1">
                            ({(c.priorVoluntaryMonths / 12).toFixed(1)} năm)
                          </span>
                          {c.prior_participation_notes && (
                            <div className="text-[11px] text-gray-500 mt-1 truncate max-w-[180px]" title={c.prior_participation_notes}>
                              {c.prior_participation_notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa ghi nhận</span>
                      )}
                    </td>

                    {/* Cột 4: BHXH Tự nguyện tại đại lý này */}
                    <td className="p-4">
                      {c.agencyMonths > 0 ? (
                        <div>
                          <span className="font-black text-emerald-700 text-sm">
                            {c.agencyMonths} tháng
                          </span>
                          <div className="text-[10px] text-emerald-600 font-medium">Tự động từ phiếu thu</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">0 tháng</span>
                      )}
                    </td>

                    {/* Cột 5: Tổng thời gian tích lũy */}
                    <td className="p-4">
                      <div className="font-black text-gray-900 text-sm">
                        {c.totalAccumulated} tháng
                      </div>
                      <div className="text-xs font-semibold text-amber-700">
                        ({(c.totalAccumulated / 12).toFixed(1)} năm)
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {c.totalAccumulated >= 180 ? '✓ Đủ 15 năm hưu trí' : `Thiếu ${180 - c.totalAccumulated} tháng để hưởng hưu`}
                      </div>
                    </td>

                    {/* Cột 6: Tiến trình hỗ trợ NSNN 10 năm */}
                    <td className="p-4 min-w-[180px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-gray-700">
                          {c.supportedMonths}/120 tháng
                        </span>
                        {c.isSupportExpired ? (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                            Hết hỗ trợ
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Còn {c.remainingSupport} th
                          </span>
                        )}
                      </div>
                      
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            c.isSupportExpired
                              ? 'bg-rose-500'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                          }`}
                          style={{ width: `${Math.min(100, (c.supportedMonths / 120) * 100)}%` }}
                        />
                      </div>
                    </td>

                    {/* Cột 7: Thao tác */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openViewModal(c)}
                          className="p-2 rounded-xl bg-teal-50 text-teal-700 hover:bg-teal-100 transition cursor-pointer font-bold text-xs flex items-center gap-1 shadow-2xs"
                          title="Xem chi tiết toàn bộ quá trình đóng BHXH (trước đây và tại đại lý)"
                        >
                          <Eye size={14} />
                          <span>Xem quá trình</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openUpdateModal(c)}
                          className="p-2 rounded-xl bg-blue-50 text-[#004182] hover:bg-blue-100 transition cursor-pointer font-bold text-xs flex items-center gap-1 shadow-2xs"
                          title="Cập nhật chi tiết các giai đoạn tham gia"
                        >
                          <Edit size={14} />
                          <span>Cập nhật</span>
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => handleTransferTo1LanDirect(c)}
                          className="p-2 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition cursor-pointer font-bold text-xs flex items-center gap-1 shadow-2xs"
                          title="Chuyển dữ liệu sang phân hệ Tính BHXH 1 lần và tự động tính toán kết quả"
                        >
                          <Calculator size={14} />
                          <span>BHXH 1 lần</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {paginatedCustomers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-gray-400 italic">
                    Không tìm thấy hồ sơ khách hàng nào phù hợp với điều kiện tìm kiếm.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 0 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50/50 gap-3">
            <div className="text-xs text-gray-500">
              Hiển thị {totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} trên tổng số {totalCount} khách hàng
            </div>

            <div className="flex items-center gap-2">
              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 outline-none"
              >
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Trang trước"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="px-2 text-xs font-bold text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Trang tiếp"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Trang cuối"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal xem chi tiết quá trình tham gia */}
      <CustomerParticipationViewModal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setViewCustomer(null);
        }}
        customer={viewCustomer}
        records={records}
        onOpenEditModal={(c) => {
          setSelectedCustomer(c);
          setIsModalOpen(true);
        }}
      />

      {/* Modal cập nhật hồ sơ */}
      <CustomerParticipationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCustomer(null);
        }}
        customer={selectedCustomer}
      />

    </div>
  );
};

export default CustomerParticipationManagement;
