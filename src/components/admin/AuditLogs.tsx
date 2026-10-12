import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { auditService } from '../../services/auditService';
import { 
  Search, 
  Filter, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ShieldCheck,
  DollarSign,
  Users,
  UserCog,
  Landmark,
  RefreshCw,
  Sparkles
} from 'lucide-react';

type AuditCategory = 'ALL' | 'FINANCE' | 'CUSTOMER' | 'STAFF' | 'SYSTEM';

const SYSTEM_EXCLUDED_ACTIONS = [
  'homepage_settings_update',
  'Cập nhật trang chủ',
  'Cài đặt thông số in ấn',
  'In biên lai',
  'Xuất ảnh biên lai',
  'Xuất Excel Tài Chính',
  'Xuất Mẫu D03-TS',
  'Xuất Mẫu D05-TS',
  'Xuất danh sách khách hàng ra Excel',
  'VIEW_UNMASKED_PII',
  'EXPORT_D03_EXCEL',
  'EXPORT_D05_EXCEL'
];

const getActionCategory = (action: string): 'FINANCE' | 'CUSTOMER' | 'STAFF' | 'SYSTEM' => {
  const act = (action || '').toLowerCase();
  if (
    act.includes('thu tiền') || 
    act.includes('thanh toán') || 
    act.includes('hủy giao dịch') || 
    act.includes('thoái thu') || 
    act.includes('clawback') || 
    act.includes('kỳ tài chính') || 
    act.includes('chốt sổ') || 
    act.includes('mở khóa kỳ') || 
    act.includes('financial period')
  ) {
    return 'FINANCE';
  }
  if (
    act.includes('nhân viên') || 
    act.includes('nhân sự') || 
    act.includes('phân quyền') || 
    act.includes('rbac') || 
    act.includes('staff')
  ) {
    return 'STAFF';
  }
  if (
    act.includes('chính sách') || 
    act.includes('tham số') || 
    act.includes('vietqr') || 
    act.includes('chuyển nộp') || 
    act.includes('đợt nộp')
  ) {
    return 'SYSTEM';
  }
  return 'CUSTOMER';
};

const getActionBadgeStyle = (action: string): string => {
  const act = (action || '').toLowerCase();
  if (act.includes('xóa') || act.includes('hủy') || act.includes('thoái thu') || act.includes('clawback')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  if (act.includes('thêm mới') || act.includes('tạo') || act.includes('xác nhận thu') || act.includes('đã thu tiền') || act.includes('ban hành')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (act.includes('cập nhật') || act.includes('sửa') || act.includes('đổi trạng thái') || act.includes('kích hoạt')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (act.includes('chuyển nộp') || act.includes('đợt nộp') || act.includes('khóa')) {
    return 'bg-blue-50 text-blue-700 border-blue-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

export const AuditLogs: React.FC = () => {
  const { auditLogs = [], currentUser, refreshAdminData, showToast } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('ALL');
  const [filterAction, setFilterAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isCleaning, setIsCleaning] = useState(false);

  const isAdmin = currentUser?.role === 'Admin' || currentUser?.role === 'admin';

  // 1. Tự động dọn dẹp các bản ghi quá hạn 90 ngày khi Admin truy cập
  useEffect(() => {
    if (isAdmin) {
      auditService.cleanupOldAuditLogs().then(res => {
        if (res.success && res.deletedCount && res.deletedCount > 0) {
          refreshAdminData?.();
        }
      });
    }
  }, [isAdmin, refreshAdminData]);

  // 2. Lọc trong phạm vi 90 ngày gần nhất & loại trừ các hành vi rác
  const ninetyDaysAgoMs = useMemo(() => {
    return Date.now() - 90 * 24 * 60 * 60 * 1000;
  }, []);

  const valid90DayLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (SYSTEM_EXCLUDED_ACTIONS.includes(log.action)) return false;
      const logTime = new Date(log.timestamp).getTime();
      return logTime >= ninetyDaysAgoMs;
    });
  }, [auditLogs, ninetyDaysAgoMs]);

  // 3. Đếm số lượng theo danh mục
  const counts = useMemo(() => {
    let finance = 0;
    let customer = 0;
    let staff = 0;
    let system = 0;

    valid90DayLogs.forEach(l => {
      const cat = getActionCategory(l.action);
      if (cat === 'FINANCE') finance++;
      else if (cat === 'CUSTOMER') customer++;
      else if (cat === 'STAFF') staff++;
      else if (cat === 'SYSTEM') system++;
    });

    return { all: valid90DayLogs.length, finance, customer, staff, system };
  }, [valid90DayLogs]);

  // 4. Lọc kết hợp Category + Specific Action + Search Term
  const filteredLogs = useMemo(() => {
    return valid90DayLogs.filter(log => {
      if (selectedCategory !== 'ALL') {
        const cat = getActionCategory(log.action);
        if (cat !== selectedCategory) return false;
      }

      if (filterAction !== 'all' && log.action !== filterAction) {
        return false;
      }

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nameStr = String(log.userName || log.user || 'Hệ thống').toLowerCase();
        const detailsStr = String(log.details || '').toLowerCase();
        const actionStr = String(log.action || '').toLowerCase();
        if (!nameStr.includes(term) && !detailsStr.includes(term) && !actionStr.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [valid90DayLogs, selectedCategory, filterAction, searchTerm]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const availableActionsForCategory = useMemo(() => {
    const list = selectedCategory === 'ALL' 
      ? valid90DayLogs 
      : valid90DayLogs.filter(l => getActionCategory(l.action) === selectedCategory);
    return Array.from(new Set(list.map(l => String(l.action)))).sort();
  }, [valid90DayLogs, selectedCategory]);

  const handleManualCleanup = async () => {
    setIsCleaning(true);
    try {
      const res = await auditService.cleanupOldAuditLogs();
      if (res.success) {
        showToast?.(
          res.deletedCount && res.deletedCount > 0 
            ? `Đã dọn dẹp ${res.deletedCount} bản ghi kiểm toán cũ hơn 90 ngày!`
            : 'Dữ liệu kiểm toán hoàn toàn sạch sẽ, không có bản ghi quá hạn 90 ngày.',
          'success'
        );
        refreshAdminData?.();
      } else {
        showToast?.('Không thể thực hiện dọn dẹp dữ liệu kiểm toán.', 'error');
      }
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Tiêu chuẩn lưu trữ 90 ngày */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Nhật Ký Hoạt Động Hệ Thống</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Vết kiểm toán các thao tác trọng yếu: Thu tiền phát sinh, thêm mới, sửa hồ sơ cá nhân, xóa khách hàng, nhân viên
          </p>
        </div>

        {/* Badge chính sách lưu trữ 90 ngày */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50/80 border border-blue-200 text-[#004182] text-xs font-medium shadow-2xs">
            <ShieldCheck size={16} className="text-[#004182] shrink-0" />
            <div>
              <span className="font-bold">Lưu trữ: 90 ngày</span>
              <span className="hidden md:inline text-slate-500 ml-1.5">
                • Tự động xóa bản ghi quá hạn
              </span>
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={handleManualCleanup}
              disabled={isCleaning}
              title="Quét dọn dẹp các bản ghi quá hạn 90 ngày ngay bây giờ"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 text-xs font-semibold transition disabled:opacity-50"
            >
              <RefreshCw size={13} className={isCleaning ? 'animate-spin text-blue-600' : 'text-slate-500'} />
              <span className="hidden sm:inline">Dọn log quá hạn</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs phân loại 4 nhóm sự kiện */}
      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
        <button
          onClick={() => { setSelectedCategory('ALL'); setFilterAction('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'ALL'
              ? 'bg-[#004182] text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles size={14} />
          <span>Tất cả hoạt động</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            selectedCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {counts.all}
          </span>
        </button>

        <button
          onClick={() => { setSelectedCategory('FINANCE'); setFilterAction('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'FINANCE'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-emerald-50/50 border border-slate-200'
          }`}
        >
          <DollarSign size={14} className={selectedCategory === 'FINANCE' ? 'text-white' : 'text-emerald-600'} />
          <span>Thu tiền & Tài chính</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            selectedCategory === 'FINANCE' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-800'
          }`}>
            {counts.finance}
          </span>
        </button>

        <button
          onClick={() => { setSelectedCategory('CUSTOMER'); setFilterAction('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'CUSTOMER'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-blue-50/50 border border-slate-200'
          }`}
        >
          <Users size={14} className={selectedCategory === 'CUSTOMER' ? 'text-white' : 'text-blue-600'} />
          <span>Hồ sơ & Khách hàng</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            selectedCategory === 'CUSTOMER' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-800'
          }`}>
            {counts.customer}
          </span>
        </button>

        <button
          onClick={() => { setSelectedCategory('STAFF'); setFilterAction('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'STAFF'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-indigo-50/50 border border-slate-200'
          }`}
        >
          <UserCog size={14} className={selectedCategory === 'STAFF' ? 'text-white' : 'text-indigo-600'} />
          <span>Nhân sự & Phân quyền</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            selectedCategory === 'STAFF' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-800'
          }`}>
            {counts.staff}
          </span>
        </button>

        <button
          onClick={() => { setSelectedCategory('SYSTEM'); setFilterAction('all'); setCurrentPage(1); }}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            selectedCategory === 'SYSTEM'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Landmark size={14} className={selectedCategory === 'SYSTEM' ? 'text-white' : 'text-slate-600'} />
          <span>Nộp BHXH & Chính sách</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
            selectedCategory === 'SYSTEM' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {counts.system}
          </span>
        </button>
      </div>

      {/* Thẻ chứa bảng và thanh công cụ tìm kiếm */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-5">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm kiếm theo hành động, nhân viên, tên khách hàng, CCCD/BHXH, chi tiết..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 text-sm text-slate-800 placeholder-slate-400 transition-all"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>

          <div className="relative w-full sm:w-auto min-w-[200px]">
            <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
            <select
              className="w-full pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 appearance-none bg-white text-sm text-slate-800 transition-all cursor-pointer truncate"
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Tất cả hành động ({availableActionsForCategory.length})</option>
              {availableActionsForCategory.map((action: string) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 text-slate-700 font-bold border-b border-slate-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-48">Thời gian</th>
                <th className="p-3.5 w-44">Cán bộ thực hiện</th>
                <th className="p-3.5 w-56">Hành động</th>
                <th className="p-3.5">Nội dung vết kiểm toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck size={36} className="text-slate-300" />
                      <p className="text-sm font-medium">Không tìm thấy nhật ký kiểm toán phù hợp.</p>
                      <p className="text-xs text-slate-400">
                        {searchTerm ? 'Thử tìm với từ khóa khác hoặc chuyển sang danh mục Tất cả.' : 'Chưa có hoạt động trọng yếu nào phát sinh trong 90 ngày gần nhất.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-slate-500 whitespace-nowrap text-xs font-mono">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400 shrink-0" />
                        <span>{new Date(log.timestamp).toLocaleString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-800 text-xs">
                      {log.userName || log.user || 'Hệ thống'}
                    </td>
                    <td className="p-3.5">
                      <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold border ${getActionBadgeStyle(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-700 text-xs leading-relaxed font-mono">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Không tìm thấy nhật ký hoạt động nào.
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log.id} className="py-3.5 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-slate-800 text-xs">{log.userName || log.user || 'Hệ thống'}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getActionBadgeStyle(log.action)}`}>
                    {log.action}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                  {log.details}
                </p>
                <div className="flex items-center text-[11px] text-slate-400 font-mono">
                  <Clock size={12} className="mr-1 text-slate-400" />
                  {new Date(log.timestamp).toLocaleString('vi-VN')}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Phân trang */}
        {totalPages > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-slate-500 hidden sm:inline">
                Hiển thị {filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredLogs.length)} trong số <strong className="text-slate-700">{filteredLogs.length}</strong> nhật ký
              </span>
              <select 
                value={itemsPerPage || 20} 
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-[#004182]"
              >
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(1)} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang đầu"
              >
                <ChevronsLeft size={15} />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang trước"
              >
                <ChevronLeft size={15} />
              </button>
              
              <div className="flex items-center px-1 gap-1 hidden sm:flex">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum > 0 && pageNum <= totalPages) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition ${
                          currentPage === pageNum 
                            ? 'bg-[#004182] text-white shadow-xs' 
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>

              <div className="sm:hidden px-3 text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang sau"
              >
                <ChevronRight size={15} />
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Trang cuối"
              >
                <ChevronsRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
