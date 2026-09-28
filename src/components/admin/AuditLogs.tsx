import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Search, Filter, Clock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const SYSTEM_EXCLUDED_ACTIONS = [
  'homepage_settings_update',
  'Cập nhật trang chủ',
  'Cập nhật Chính sách',
  'Ban hành Chính sách',
  'Xóa Chính sách',
  'Áp dụng Chính sách'
];

const AuditLogs = () => {
  const { auditLogs } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Only include activity logs belonging to Customer Management and Financial Management
  const customerAndFinanceLogs = auditLogs.filter(log => !SYSTEM_EXCLUDED_ACTIONS.includes(log.action));

  const filteredLogs = customerAndFinanceLogs.filter(log => {
    const nameStr = String(log.userName || log.user || 'Hệ thống');
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (log.details || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const uniqueActions = Array.from(new Set(customerAndFinanceLogs.map((log: any) => String(log.action))));

  const formatActionLabel = (action: string) => {
    return action;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Nhật Ký Hoạt Động</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Theo dõi vết kiểm toán toàn bộ các thao tác chỉnh sửa, thêm mới, xóa và tác nghiệp trên hệ thống
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm hành động, nhân viên, nội dung..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 text-sm text-slate-800 placeholder-slate-400 transition-all"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="relative w-full sm:w-auto">
            <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
            <select
              className="w-full sm:w-auto pl-10 pr-8 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 appearance-none bg-white text-sm text-slate-800 transition-all cursor-pointer"
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
            >
              <option value="all">Tất cả hành động</option>
              {uniqueActions.map((action: string) => (
                <option key={action} value={action}>{formatActionLabel(action)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Thời gian</th>
                <th className="p-4">Nhân viên</th>
                <th className="p-4">Hành động</th>
                <th className="p-4">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Không tìm thấy nhật ký hoạt động nào.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-500 whitespace-nowrap">
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2 text-gray-400" />
                        {new Date(log.timestamp).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-800">{log.userName || log.user || 'Hệ thống'}</td>
                    <td className="p-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium">
                        {formatActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {paginatedLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Không tìm thấy nhật ký hoạt động nào.
            </div>
          ) : (
            paginatedLogs.map((log) => (
              <div key={log.id} className="py-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-gray-800 text-sm">{log.userName || log.user || 'Hệ thống'}</span>
                  <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-medium">
                    {formatActionLabel(log.action)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{log.details}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock size={14} className="mr-1" />
                  {new Date(log.timestamp).toLocaleString('vi-VN')}
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-sm text-gray-500 hidden sm:inline">
                Hiển thị {filteredLogs.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredLogs.length)} trong số {filteredLogs.length} nhật ký
              </span>
              <select 
                value={itemsPerPage || 10} 
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1.5 rounded border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#0ea5e9]"
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
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Trang đầu"
              >
                <ChevronsLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Trang trước"
              >
                <ChevronLeft size={16} />
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
                        className={`w-8 h-8 rounded flex items-center justify-center text-sm font-medium transition ${
                          currentPage === pageNum 
                            ? 'bg-[#004182] text-white border border-[#004182]' 
                            : 'border border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
              </div>

              <div className="sm:hidden px-3 text-sm font-medium text-gray-700">
                {currentPage} / {totalPages}
              </div>

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Trang sau"
              >
                <ChevronRight size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(totalPages)} 
                disabled={currentPage === totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Trang cuối"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
