import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Calendar, 
  Phone, 
  MessageSquare, 
  FileSpreadsheet, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Copy, 
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Send
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { toUIMonth, toUIDate, calculateNextRenewalMonth } from '../../utils/dateStandardHelper';
import { formatDateToVN, formatMonthToVN } from '../../utils/dateFormatter';
import { 
  classifyRenewalRecords, 
  generateRenewalMessage, 
  exportRenewalListToExcel,
  RenewalRecordItem, 
  RenewalUrgency 
} from '../../utils/renewalDispatchHelper';

interface RenewalReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFilter?: RenewalUrgency | 'all';
  onRenewCustomer?: (record: any) => void;
}

const RenewalReminderModal: React.FC<RenewalReminderModalProps> = ({
  isOpen,
  onClose,
  initialFilter = 'all',
  onRenewCustomer
}) => {
  const { records, staff, currentUser, setGlobalRegisterModal, showToast } = useAppContext() as any;
  const [activeUrgency, setActiveUrgency] = useState<RenewalUrgency | 'all'>(initialFilter);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'BHXH' | 'BHYT'>('all');
  const [selectedRecordForMessage, setSelectedRecordForMessage] = useState<any | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Phân loại hồ sơ
  const classification = useMemo(() => {
    return classifyRenewalRecords(records);
  }, [records]);

  // Tìm staff phụ trách của record
  const getStaffForRecord = (record: any) => {
    if (!record) return currentUser;
    const staffId = record.staffId || record.staff_id;
    return staff.find((s: any) => s.id === staffId || s.username === staffId || s.staffCode === staffId) || currentUser;
  };

  // Mở popup soạn tin nhắn đôn đốc
  const handleOpenMessageModal = (record: any) => {
    const staffMember = getStaffForRecord(record);
    const msg = generateRenewalMessage(record, staffMember);
    setSelectedRecordForMessage(record);
    setCustomMessage(msg);
    setCopiedSuccess(false);
  };

  // Copy tin nhắn vào clipboard
  const handleCopyMessage = () => {
    if (!customMessage) return;
    navigator.clipboard.writeText(customMessage);
    setCopiedSuccess(true);
    showToast('Đã sao chép nội dung tin nhắn đôn đốc vào bộ nhớ tạm!', 'success');
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  // Mở form gia hạn 1 chạm đồng bộ trực tiếp
  const handleQuickRenewal = (record: any) => {
    const isBHYT = record.type === 'BHYT';
    
    let fromMonth = toUIMonth(record.fromMonth || record.from_month);
    let toMonth = toUIMonth(record.toMonth || record.to_month);
    
    if (!toMonth && record.nextPayment) {
      const npDate = new Date(record.nextPayment);
      if (!isNaN(npDate.getTime())) {
        const prevMonthDate = new Date(npDate.getFullYear(), npDate.getMonth() - 1, 1);
        toMonth = `${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}/${prevMonthDate.getFullYear()}`;
        if (!fromMonth) {
          fromMonth = toMonth;
        }
      }
    }

    const cccdVal = record.citizenId || record.cccd || '';
    const codeVal = record.bhxhCode || record.bhytCode || record.code || '';
    const nationVal = record.nation || (record.nnSupportPct === 30 || record.nnSupport === 30 ? 'Thiểu_số' : 'Kinh');

    const normalizedRecord = {
      ...record,
      name: record.name || record.fullName || '',
      fullName: record.name || record.fullName || '',
      cccd: cccdVal,
      citizenId: cccdVal,
      bhxh: isBHYT ? '' : codeVal,
      bhxhCode: isBHYT ? '' : codeVal,
      bhyt: isBHYT ? codeVal : '',
      bhytCode: isBHYT ? codeVal : '',
      phone: record.phone || '',
      dob: toUIDate(record.dob) || '',
      gender: record.gender || 'Nam',
      nation: nationVal,
      address: record.address || '',
      method: record.method || 'Đóng hằng tháng',
      fromMonth: fromMonth || '',
      toMonth: toMonth || '',
      income: Number(record.income) || 1500000,
      nnSupportPct: record.nnSupportPct != null ? Number(record.nnSupportPct) : (nationVal === 'Thiểu_số' ? 30 : 20),
      dpSupportPct: record.dpSupportPct != null ? Number(record.dpSupportPct) : 0,
      months: Number(record.months) || 1,
      actionType: 'Gia hạn',
      originalRecordId: record.id
    };

    if (onRenewCustomer) {
      onRenewCustomer(normalizedRecord);
    } else {
      setGlobalRegisterModal({
        isOpen: true,
        type: isBHYT ? 'BHYT' : 'BHXH',
        record: normalizedRecord,
        isRenew: true,
        initialData: normalizedRecord,
        fromReminder: true
      });
    }
  };

  // Lọc dữ liệu theo tab và ô tìm kiếm
  const displayedItems = useMemo(() => {
    let list: RenewalRecordItem[] = [];
    if (activeUrgency === 'all') list = classification.all;
    else if (activeUrgency === 'overdue') list = classification.overdue;
    else if (activeUrgency === 'urgent') list = classification.urgent;
    else if (activeUrgency === 'warning') list = classification.warning;
    else if (activeUrgency === 'upcoming') list = classification.upcoming;

    // Lọc theo loại hình
    if (typeFilter !== 'all') {
      list = list.filter(item => item.record.type === typeFilter);
    }

    // Lọc theo từ khóa tìm kiếm
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(item => {
        const r = item.record;
        const name = (r.name || r.fullName || '').toLowerCase();
        const cccd = (r.citizenId || r.cccd || '').toLowerCase();
        const code = (r.bhxhCode || r.bhytCode || r.code || '').toLowerCase();
        const phone = (r.phone || '').toLowerCase();
        return name.includes(q) || cccd.includes(q) || code.includes(q) || phone.includes(q);
      });
    }

    return list;
  }, [classification, activeUrgency, typeFilter, searchTerm]);

  // Xuất Excel
  const handleExportExcel = () => {
    const titles: Record<string, string> = {
      all: 'Toàn bộ hồ sơ cần đôn đốc',
      overdue: 'Hồ sơ đã quá hạn đóng',
      urgent: 'Hồ sơ khẩn cấp (≤ 7 ngày)',
      warning: 'Hồ sơ cận hạn (8 - 15 ngày)',
      upcoming: 'Hồ sơ sắp đến hạn (16 - 30 ngày)'
    };
    exportRenewalListToExcel(displayedItems, titles[activeUrgency]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-200 bg-[#004182] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <ShieldAlert size={22} className="text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg tracking-wide flex items-center gap-2">
                Trung Tâm Quản Lý & Nhắc Hạn Hồ Sơ
                <span className="bg-amber-400 text-blue-950 text-xs px-2 py-0.5 rounded-full font-extrabold">
                  {classification.totalActionable} Cần Đôn Đốc
                </span>
              </h3>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Quản lý, đôn đốc đóng tiếp BHXH tự nguyện & gia hạn BHYT hộ gia đình duy trì 5 năm liên tục
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cấp độ khẩn cấp (KPI Tabs) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 sm:p-4 bg-gray-50 border-b border-gray-200">
          <button
            onClick={() => setActiveUrgency('all')}
            className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
              activeUrgency === 'all' 
                ? 'bg-[#004182] text-white border-[#004182] shadow-sm' 
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-[11px] block font-medium opacity-80">Tất cả hồ sơ</span>
            <span className="text-lg font-bold">{classification.all.length}</span>
          </button>

          <button
            onClick={() => setActiveUrgency('overdue')}
            className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
              activeUrgency === 'overdue' 
                ? 'bg-rose-600 text-white border-rose-600 shadow-sm' 
                : 'bg-white text-rose-700 border-rose-200 hover:border-rose-300'
            }`}
          >
            <span className="text-[11px] block font-medium opacity-90 flex items-center justify-between">
              Đã Quá Hạn
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            </span>
            <span className="text-lg font-bold">{classification.overdue.length}</span>
          </button>

          <button
            onClick={() => setActiveUrgency('urgent')}
            className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
              activeUrgency === 'urgent' 
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm' 
                : 'bg-white text-amber-700 border-amber-200 hover:border-amber-300'
            }`}
          >
            <span className="text-[11px] block font-medium opacity-90">Khẩn Cấp (≤7 ngày)</span>
            <span className="text-lg font-bold">{classification.urgent.length}</span>
          </button>

          <button
            onClick={() => setActiveUrgency('warning')}
            className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
              activeUrgency === 'warning' 
                ? 'bg-yellow-600 text-white border-yellow-600 shadow-sm' 
                : 'bg-white text-yellow-800 border-yellow-200 hover:border-yellow-300'
            }`}
          >
            <span className="text-[11px] block font-medium opacity-90">Cận Hạn (8-15 ngày)</span>
            <span className="text-lg font-bold">{classification.warning.length}</span>
          </button>

          <button
            onClick={() => setActiveUrgency('upcoming')}
            className={`p-2.5 rounded-xl text-left border transition cursor-pointer col-span-2 sm:col-span-1 ${
              activeUrgency === 'upcoming' 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-white text-blue-700 border-blue-200 hover:border-blue-300'
            }`}
          >
            <span className="text-[11px] block font-medium opacity-90">Sắp Đến (16-30 ngày)</span>
            <span className="text-lg font-bold">{classification.upcoming.length}</span>
          </button>
        </div>

        {/* Thanh công cụ tìm kiếm & lọc */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between bg-white">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Tìm theo Tên, CCCD, Mã BHXH/BHYT, SĐT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#004182]"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white focus:outline-none focus:border-[#004182]"
            >
              <option value="all">Tất cả loại hình</option>
              <option value="BHXH">Chỉ BHXH tự nguyện</option>
              <option value="BHYT">Chỉ BHYT hộ gia đình</option>
            </select>
          </div>

          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium rounded-xl transition shadow-sm cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet size={16} /> Xuất Excel Đôn Đốc
          </button>
        </div>

        {/* Bảng danh sách hồ sơ */}
        <div className="flex-1 overflow-auto">
          {displayedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 size={28} className="text-emerald-500" />
              </div>
              <h4 className="font-bold text-gray-700 text-base">Không có hồ sơ nào trong nhóm này</h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1">
                Tất cả hồ sơ trong khoảng lọc đã được gia hạn đầy đủ hoặc chưa đến hạn cần đôn đốc.
              </p>
            </div>
          ) : (
            <div className="min-w-full inline-block align-middle">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10 text-gray-600 uppercase text-[11px] font-bold">
                  <tr>
                    <th className="px-3 py-3 text-left">Khách Hàng</th>
                    <th className="px-3 py-3 text-left">Loại & Mã Số</th>
                    <th className="px-3 py-3 text-left">Hạn Đóng Tiếp Theo</th>
                    <th className="px-3 py-3 text-left">Mức Độ Đôn Đốc</th>
                    <th className="px-3 py-3 text-left">Nhân Viên</th>
                    <th className="px-3 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {displayedItems.map((item, idx) => {
                    const r = item.record;
                    const isBHYT = r.type === 'BHYT';
                    const code = isBHYT ? (r.bhytCode || r.code) : (r.bhxhCode || r.code);
                    
                    let nextPayStr = 'Chưa xác định';
                    if (r.nextPayment) {
                      const d = new Date(r.nextPayment);
                      if (!isNaN(d.getTime())) {
                        nextPayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                      }
                    }

                    return (
                      <tr key={r.id || idx} className="hover:bg-blue-50/40 transition">
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-800">{r.name || r.fullName || 'Khách hàng'}</div>
                          <div className="text-gray-500 text-xs flex items-center gap-2 mt-0.5">
                            <span>CCCD: {r.citizenId || r.cccd || '---'}</span>
                            {r.phone && (
                              <a 
                                href={`tel:${r.phone}`}
                                className="text-blue-600 hover:underline flex items-center gap-0.5"
                                title="Gọi điện thoại"
                              >
                                <Phone size={11} /> {r.phone}
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold mb-1 ${
                            isBHYT ? 'bg-cyan-100 text-cyan-800' : 'bg-blue-100 text-[#004182]'
                          }`}>
                            {isBHYT ? 'BHYT Hộ gia đình' : 'BHXH Tự nguyện'}
                          </span>
                          <div className="font-mono text-xs text-gray-600">{code || '---'}</div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Calendar size={13} className="text-gray-400" />
                            {nextPayStr}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {item.diffDays < 0 
                              ? `Đã quá hạn ${Math.abs(item.diffDays)} ngày` 
                              : item.diffDays === 0 
                                ? 'Đến hạn hôm nay' 
                                : `Còn ${item.diffDays} ngày nữa`}
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <span 
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white shadow-xs"
                            style={{ backgroundColor: item.urgencyColor }}
                          >
                            <Clock size={12} /> {item.urgencyLabel}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-700 text-xs">
                            {r.staffName || r.staff || 'Chưa phân công'}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenMessageModal(r)}
                              title="Xem & Gửi mẫu tin nhắn nhắc hạn Zalo/SMS"
                              className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
                            >
                              <MessageSquare size={14} />
                              <span className="hidden sm:inline">Mẫu Nhắc</span>
                            </button>

                            <button
                              onClick={() => handleQuickRenewal(r)}
                              title="Lập phiếu thu tiền gia hạn nhanh cho khách hàng"
                              className="px-2.5 py-1.5 bg-[#004182] hover:bg-[#003166] text-white rounded-lg transition cursor-pointer text-xs font-bold flex items-center gap-1 shadow-xs"
                            >
                              <span>Gia hạn</span>
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal con: Xem & Gửi tin nhắn đôn đốc */}
        {selectedRecordForMessage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-5 flex flex-col gap-4 border border-gray-200 animate-fadeIn">
              
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-base">Mẫu Tin Nhắn Đôn Đốc Chuẩn Nghiệp Vụ</h4>
                    <p className="text-xs text-gray-500">Khách hàng: {selectedRecordForMessage.name || selectedRecordForMessage.fullName}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRecordForMessage(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Nội dung tin nhắn (Có thể chỉnh sửa):
                </label>
                <textarea
                  rows={8}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans leading-relaxed focus:outline-none focus:border-[#004182]"
                />
              </div>

              {/* Thao tác gửi & copy */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleCopyMessage}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex-1 sm:flex-initial ${
                      copiedSuccess 
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700' 
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                    }`}
                  >
                    {copiedSuccess ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                    {copiedSuccess ? 'Đã Sao Chép!' : 'Sao Chép Tin Nhắn'}
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {selectedRecordForMessage.phone && (
                    <>
                      <a
                        href={`https://zalo.me/${selectedRecordForMessage.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial"
                      >
                        <ExternalLink size={14} /> Mở Zalo
                      </a>
                      <a
                        href={`sms:${selectedRecordForMessage.phone.replace(/[^0-9]/g, '')}?body=${encodeURIComponent(customMessage)}`}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex-1 sm:flex-initial"
                      >
                        <Send size={14} /> Gửi SMS
                      </a>
                    </>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RenewalReminderModal;
