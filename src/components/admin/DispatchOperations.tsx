import React, { useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatMoney, formatDateVN, formatMonthVN, groupRecordsByCustomer } from '../../utils/helpers';
import { recordService, auditService } from '../../services';
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Phone,
  MessageSquare,
  FileDown,
  UserCheck,
  Send,
  Calendar,
  MapPin,
  Search,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Shield,
  HeartPulse,
  CheckSquare,
  Square,
  ClipboardList,
  Zap,
  X,
  QrCode
} from 'lucide-react';
import RegisterModal from '../modals/RegisterModal';
import { VietQRModal } from '../modals/VietQRModal';
import { buildZaloReminderMessage } from '../../utils/vietqr';
import { CustomerStatusBadge } from '../common/CustomerStatusBadge';
import { filterRenewalDispatchCustomers } from '../../utils/customerStatus';

interface CustomerItem {
  id: number | string;
  name: string;
  phone: string;
  cccd: string;
  bhxh: string;
  address: string;
  type: 'BHXH' | 'BHYT';
  actionType?: string;
  amount: number;
  months?: number;
  method?: string;
  fromMonth?: string;
  toMonth?: string;
  date: string;
  nextPayment: string;
  staffId: string;
  notes?: string;
  paymentStatus: string;
  status?: string;
  daysRemaining: number;
  slaStatus: 'overdue' | 'urgent' | 'warning' | 'safe' | 'renewed';
}

const DispatchOperations: React.FC = () => {
  const { staff, records, currentUser, showToast, refreshData, addAuditLog } = useAppContext();

  // Filters
  const [searchTxt, setSearchTxt] = useState('');
  const [slaFilter, setSlaFilter] = useState<'all' | 'overdue' | 'urgent' | 'warning' | 'safe' | 'renewed'>('all');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'BHXH' | 'BHYT'>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('all');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [targetStaffId, setTargetStaffId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Script Modal
  const [selectedCustomerForScript, setSelectedCustomerForScript] = useState<CustomerItem | null>(null);
  const [scriptType, setScriptType] = useState<'urgent' | 'standard' | 'receipt' | 'vietqr'>('urgent');

  // VietQR Modal
  const [vietQrRecord, setVietQrRecord] = useState<any | null>(null);

  // Contact Log Modal
  const [selectedCustomerForLog, setSelectedCustomerForLog] = useState<CustomerItem | null>(null);
  const [logChannel, setLogChannel] = useState('📞 Gọi điện thoại trực tiếp');
  const [logResult, setLogResult] = useState('✅ Đã đồng ý & Hẹn ngày nộp tiền');
  const [logPromiseDate, setLogPromiseDate] = useState('');
  const [logPromiseAmount, setLogPromiseAmount] = useState<number | string>('');
  const [logContent, setLogContent] = useState('');
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Quick Renewal Modal
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerType, setRegisterType] = useState<'BHXH' | 'BHYT'>('BHXH');
  const [registerRecord, setRegisterRecord] = useState<any | null>(null);
  const [isRenew, setIsRenew] = useState(false);

  const handleQuickRenew = (customer: CustomerItem) => {
    const fullRecord = records.find(r => r.id === Number(customer.id)) || {
      ...customer,
      id: Number(customer.id) || undefined
    };
    setRegisterType(customer.type);
    setRegisterRecord(fullRecord);
    setIsRenew(true);
    setIsRegisterModalOpen(true);
  };

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const isAdminOrManager = useMemo(() => {
    return currentUser?.role === 'Admin' || currentUser?.role === 'admin' || currentUser?.role === 'Quản lý';
  }, [currentUser]);

  // Process & Deduplicate Customers with SLA based on latest active record
  // MỤC TIÊU NGHIỆP VỤ:
  // Khách hàng có trạng thái "Đã dừng đóng" được LOẠI TRỪ KHỎI:
  // - Danh sách đôn đốc tái tục / cảnh báo hết hạn nộp tiền (SLA / Renewal alerts).
  // - Các chỉ số thống kê hoạt động đôn đốc, số lượng người tham gia thực tế (headcount phát triển).
  const allCustomers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueCustomers = groupRecordsByCustomer(records);
    // LOẠI TRỪ khách hàng 'Đã dừng đóng' khỏi đôn đốc & SLA alerts
    const activeRenewalCustomers = filterRenewalDispatchCustomers(uniqueCustomers);
    const list: CustomerItem[] = [];

    activeRenewalCustomers.forEach(r => {
      let daysRemaining = 999;
      let slaStatus: CustomerItem['slaStatus'] = 'safe';

      const nextPay = r.next_payment || (r as any).nextPayment;
      if (nextPay) {
        const nextDate = new Date(nextPay);
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          slaStatus = 'overdue';
        } else if (daysRemaining <= 7) {
          slaStatus = 'urgent';
        } else if (daysRemaining <= 30) {
          slaStatus = 'warning';
        } else {
          slaStatus = 'safe';
        }
      } else {
        slaStatus = 'warning';
      }

      list.push({
        id: r.id,
        name: r.name || 'Khách hàng',
        phone: r.phone || '',
        cccd: r.cccd || '',
        bhxh: r.bhxh || '',
        address: r.address || '',
        type: (r.type as 'BHXH' | 'BHYT') || 'BHXH',
        actionType: r.action_type || (r as any).actionType,
        amount: Number(r.amount) || 0,
        months: Number(r.months) || 12,
        method: r.method || (r.months ? `Đóng ${r.months} tháng` : ''),
        fromMonth: r.from_month || (r as any).fromMonth || '',
        toMonth: r.to_month || (r as any).toMonth || '',
        date: r.date,
        nextPayment: nextPay || '',
        staffId: r.staff_id || (r as any).staffId || '',
        notes: r.notes || '',
        paymentStatus: r.payment_status || (r as any).paymentStatus || '',
        status: r.status || 'Đang tham gia',
        daysRemaining,
        slaStatus
      });
    });

    return list;
  }, [records]);

  // Filtered List
  const filteredCustomers = useMemo(() => {
    return allCustomers.filter(c => {
      // Role Scope Filter
      if (!isAdminOrManager && c.staffId !== currentUser?.id) {
        return false;
      }

      // Staff Filter
      if (staffFilter !== 'all' && c.staffId !== staffFilter) {
        return false;
      }

      // Type Filter
      if (typeFilter !== 'ALL' && c.type !== typeFilter) {
        return false;
      }

      // SLA Filter
      if (slaFilter !== 'all' && c.slaStatus !== slaFilter) {
        return false;
      }

      // Search text
      if (searchTxt.trim()) {
        const q = searchTxt.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.includes(q);
        const matchCccd = c.cccd.includes(q);
        const matchBhxh = c.bhxh.toLowerCase().includes(q);
        const matchAddress = c.address.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchCccd && !matchBhxh && !matchAddress) {
          return false;
        }
      }

      return true;
    });
  }, [allCustomers, isAdminOrManager, currentUser, staffFilter, typeFilter, slaFilter, searchTxt]);

  // KPI SLA Counts
  const kpiStats = useMemo(() => {
    const scopeList = !isAdminOrManager 
      ? allCustomers.filter(c => c.staffId === currentUser?.id)
      : allCustomers;

    const overdueCount = scopeList.filter(c => c.slaStatus === 'overdue').length;
    const urgentCount = scopeList.filter(c => c.slaStatus === 'urgent').length;
    const warningCount = scopeList.filter(c => c.slaStatus === 'warning').length;
    const safeCount = scopeList.filter(c => c.slaStatus === 'safe').length;
    const totalCount = scopeList.length;

    const retentionRate = totalCount > 0 
      ? (((safeCount) / totalCount) * 100).toFixed(1)
      : '0.0';

    return {
      overdueCount,
      urgentCount,
      warningCount,
      safeCount,
      totalCount,
      retentionRate
    };
  }, [allCustomers, isAdminOrManager, currentUser]);

  // Staff Workload Breakdown
  const staffWorkload = useMemo(() => {
    if (!isAdminOrManager) return [];

    return staff.map(s => {
      const sCustomers = allCustomers.filter(c => c.staffId === s.id);
      const sOverdue = sCustomers.filter(c => c.slaStatus === 'overdue').length;
      const sUrgent = sCustomers.filter(c => c.slaStatus === 'urgent').length;
      const sWarning = sCustomers.filter(c => c.slaStatus === 'warning').length;
      const sSafe = sCustomers.filter(c => c.slaStatus === 'safe').length;
      const sTotal = sCustomers.length;

      const rate = sTotal > 0 ? ((sSafe / sTotal) * 100).toFixed(0) : '0';

      return {
        ...s,
        total: sTotal,
        overdue: sOverdue,
        urgent: sUrgent,
        warning: sWarning,
        safe: sSafe,
        rate
      };
    }).filter(s => s.total > 0 || staffFilter === s.id);
  }, [staff, allCustomers, isAdminOrManager, staffFilter]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(start, start + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage]);

  // Toggle Selection
  const handleToggleSelect = (id: number | string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === paginatedList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedList.map(c => c.id));
    }
  };

  // Bulk Reassign Staff
  const handleBulkReassign = async () => {
    if (!targetStaffId) {
      showToast('Vui lòng chọn cán bộ thu mới để phân công!', 'error');
      return;
    }

    if (selectedIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một khách hàng để điều phối!', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const targetStaff = staff.find(s => s.id === targetStaffId);
      const staffName = targetStaff?.name || targetStaffId;

      // Update qua recordService
      await recordService.assignStaffToRecords(selectedIds, targetStaffId);

      await addAuditLog('Bulk Dispatch Reassignment', `Đã điều phối ${selectedIds.length} khách hàng cho cán bộ ${staffName}`);

      showToast(`Đã điều phối thành công ${selectedIds.length} khách hàng cho ${staffName}!`, 'success');
      setSelectedIds([]);
      setIsReassignModalOpen(false);
      await refreshData();
    } catch (err: any) {
      console.error('Error reassigning staff:', err);
      showToast('Lỗi khi điều phối cán bộ: ' + (err.message || 'Lỗi không xác định'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Update Customer Follow-up Notes
  const handleUpdateNotes = async (customer: CustomerItem, newStatus: string) => {
    try {
      const updatedNotes = `${newStatus} (Cập nhật: ${new Date().toLocaleDateString('vi-VN')})`;
      const { error } = await recordService.updateRecordNotes({
        id: customer.id,
        cccd: customer.cccd,
        bhxh: customer.bhxh,
        phone: customer.phone
      }, updatedNotes);

      if (error) throw error;

      if (addAuditLog) {
        await addAuditLog('Cập nhật trạng thái đôn đốc', `${customer.name}: ${updatedNotes}`);
      }

      showToast(`Đã cập nhật trạng thái: ${newStatus}`, 'success');
      await refreshData();
    } catch (err: any) {
      console.error('Error updating note:', err);
      showToast('Lỗi cập nhật ghi chú: ' + (err?.message || 'Không thể lưu'), 'error');
    }
  };

  // Open Contact Log Modal
  const handleOpenContactLog = (c: CustomerItem) => {
    setSelectedCustomerForLog(c);
    setLogChannel('📞 Gọi điện thoại trực tiếp');
    setLogResult('✅ Đã đồng ý & Hẹn ngày nộp tiền');
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setLogPromiseDate(d.toISOString().split('T')[0] ?? '');
    setLogPromiseAmount(c.amount || '');
    setLogContent('');
  };

  // Save Contact Log
  const handleSaveContactLog = async () => {
    if (!selectedCustomerForLog) return;
    setIsSavingLog(true);
    try {
      const todayVN = new Date().toLocaleDateString('vi-VN');
      let summary = `${logResult}`;
      if (logResult.includes('Hẹn ngày nộp tiền') && logPromiseDate) {
        summary += ` (Hẹn ${formatDateVN(logPromiseDate)}${logPromiseAmount ? ` - ${formatMoney(Number(logPromiseAmount))}` : ''})`;
      }
      if (logContent.trim()) {
        summary += ` - ${logContent.trim()}`;
      }
      const fullLogNote = `${summary} [${logChannel}] (${todayVN})`;

      const targetId = Number(selectedCustomerForLog.id);
      if (!isNaN(targetId) && targetId > 0) {
        const { error: rpcErr } = await auditService.logCustomerContact(targetId, summary, logChannel);
        if (rpcErr) {
          // Fallback an toàn trực tiếp theo ID duy nhất qua recordService
          const { error } = await recordService.updateRecordNotes({ id: targetId }, fullLogNote);
          if (error) throw error;
        }
      } else {
        throw new Error('Khóa chính ID hồ sơ không hợp lệ.');
      }

      if (addAuditLog) {
        await addAuditLog('Nhật ký tiếp xúc khách hàng', `${selectedCustomerForLog.name}: ${fullLogNote}`);
      }

      showToast('Đã lưu nhật ký tiếp xúc thành công!', 'success');
      setSelectedCustomerForLog(null);
      await refreshData();
    } catch (err: any) {
      console.error('Error saving contact log:', err);
      showToast('Lỗi khi lưu nhật ký: ' + (err.message || 'Lỗi không xác định'), 'error');
    } finally {
      setIsSavingLog(false);
    }
  };

  // Export Field Collection Excel Sheet
  const handleExportFieldSheet = async () => {
    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const wb = XLSX.utils.book_new();

      const exportRows = filteredCustomers.map((c, idx) => {
        const staffName = staff.find(s => s.id === c.staffId)?.name || c.staffId || 'Chưa phân công';
        let slaText = 'An toàn';
        if (c.slaStatus === 'overdue') slaText = `Quá hạn ${Math.abs(c.daysRemaining)} ngày`;
        else if (c.slaStatus === 'urgent') slaText = `Khẩn cấp (còn ${c.daysRemaining} ngày)`;
        else if (c.slaStatus === 'warning') slaText = `Sắp đến hạn (còn ${c.daysRemaining} ngày)`;

        const periodStr = (c.fromMonth && c.toMonth)
          ? `${formatMonthVN(c.fromMonth)} - ${formatMonthVN(c.toMonth)}`
          : (c.fromMonth ? formatMonthVN(c.fromMonth) : '');
        const methodDisplay = c.method
          ? `${c.method}${periodStr ? ` (${periodStr})` : ''}`
          : (periodStr || (c.months ? `Đóng ${c.months} tháng` : '---'));

        return [
          idx + 1,
          c.name,
          c.phone,
          c.cccd,
          c.bhxh,
          c.type,
          c.address,
          methodDisplay,
          c.nextPayment ? formatDateVN(c.nextPayment) : '---',
          slaText,
          c.amount,
          staffName,
          c.notes || 'Chưa liên hệ',
          '' // Cột chữ ký người dân
        ];
      });

      const header = [
        'STT',
        'Họ Và Tên',
        'Số Điện Thoại',
        'Số CCCD/CMND',
        'Mã BHXH/Số Thẻ',
        'Loại Hình',
        'Địa Chỉ (Tuyến Thu)',
        'Phương Thức Đóng (Kỳ Gần Nhất)',
        'Hạn Đóng Tiếp',
        'Tình Trạng SLA',
        'Số Tiền Đóng Kỳ Trước (VNĐ)',
        'Cán Bộ Phụ Trách',
        'Nhật Ký Đôn Đốc',
        'Ký Nhận Của Người Dân'
      ];

      const ws = XLSX.utils.aoa_to_sheet([
        ['DANH SÁCH ĐIỀU PHỐI ĐÔN ĐỐC & TUYẾN THU HIỆN TRƯỜNG BHXH - BHYT'],
        [`Ngày xuất danh sách: ${new Date().toLocaleString('vi-VN')}`],
        [`Tổng số lượng: ${filteredCustomers.length} khách hàng`],
        [''],
        header,
        ...exportRows
      ]);

      // Set column widths
      ws['!cols'] = [
        { wch: 6 },
        { wch: 22 },
        { wch: 14 },
        { wch: 16 },
        { wch: 16 },
        { wch: 10 },
        { wch: 32 },
        { wch: 26 },
        { wch: 14 },
        { wch: 20 },
        { wch: 18 },
        { wch: 20 },
        { wch: 24 },
        { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Tuyen_Thu_Hien_Truong');
      const outFilename = `Tuyen_Thu_Don_Doc_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, outFilename);
      if (addAuditLog) {
        await addAuditLog('Xuất danh sách tuyến thu hiện trường', `Đã xuất bảng kê ${filteredCustomers.length} khách hàng ra file ${outFilename}`);
      }
      showToast('Đã xuất Bảng Kê Tuyến Thu Hiện Trường thành công!', 'success');
    } catch (err) {
      console.error('Error exporting sheet:', err);
      showToast('Lỗi khi xuất bảng kê', 'error');
    }
  };

  // Generate Message Script
  const messageScript = useMemo(() => {
    if (!selectedCustomerForScript) return '';
    const c = selectedCustomerForScript;
    const nextDate = c.nextPayment ? formatDateVN(c.nextPayment) : 'sắp tới';
    const amountStr = formatMoney(c.amount);

    if (scriptType === 'urgent') {
      if (c.type === 'BHYT') {
        return `Kính gửi Anh/Chị ${c.name},\nĐại lý thu BHXH-BHYT xin thông báo: Thẻ BHYT (Mã: ${c.bhxh || c.cccd}) của Anh/Chị sẽ hết hạn vào ngày ${nextDate}.\nĐể đảm bảo quyền lợi khám chữa bệnh và QUYỀN LỢI 5 NĂM LIÊN TỤC không bị gián đoạn, xin vui lòng đóng phí gia hạn (ước tính: ${amountStr}).\nCán bộ đại lý sẽ hỗ trợ thu phí tại nhà hoặc qua chuyển khoản. Hotline: 0988.xxx.xxx. Trân trọng!`;
      } else {
        return `Kính gửi Anh/Chị ${c.name},\nĐại lý BHXH xin thông báo: Sổ BHXH tự nguyện (Mã: ${c.bhxh || c.cccd}) của Anh/Chị đến kỳ đóng tiếp vào ngày ${nextDate} với số tiền ${amountStr}.\nKính mời Anh/Chị liên hệ đại lý để hoàn tất nộp phí, tích lũy liên tục thời gian hưởng Lương hưu theo Nghị định 159/2025. Trân trọng!`;
      }
    } else if (scriptType === 'standard') {
      return `Chào Anh/Chị ${c.name}, em là cán bộ đại lý thu BHXH - BHYT. Em xin phép gửi lịch nhắc kỳ đóng ${c.type} sắp tới hạn vào ngày ${nextDate} (Số tiền: ${amountStr}). Anh/Chị cho em xin lịch hẹn thuận tiện nhất để qua hỗ trợ gia hạn hoặc hướng dẫn nộp online nhé ạ! Em cảm ơn Anh/Chị!`;
    } else if (scriptType === 'vietqr') {
      const staffMember = staff.find(s => s.id === c.staffId);
      const reminder = buildZaloReminderMessage({
        customerName: c.name,
        cccd: c.cccd,
        bhxh: c.bhxh,
        phone: c.phone,
        type: c.type,
        amount: c.amount,
        dueDate: c.nextPayment,
        daysRemaining: c.daysRemaining,
        slaStatus: c.slaStatus,
        staffName: staffMember?.name || currentUser?.name,
        staffPhone: staffMember?.phone || currentUser?.phone
      });
      return reminder.message;
    } else {
      return `Xác nhận: Đại lý thu BHXH đã nhận được thông tin đăng ký gia hạn ${c.type} của khách hàng ${c.name} (Mã: ${c.bhxh || c.cccd}). Hồ sơ đang được đồng bộ lên hệ thống BHXH Việt Nam. Cảm ơn Quý khách đã tin tưởng đồng hành!`;
    }
  }, [selectedCustomerForScript, scriptType, staff, currentUser]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(messageScript);
    showToast('Đã sao chép kịch bản tin nhắn vào Clipboard!', 'success');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#004182]">Điều Phối & Đôn Đốc Thu Phí</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Giám sát hạn cam kết SLA, phân công nhiệm vụ đại lý thu hiện trường và kiểm soát vòng đời gia hạn BHXH & BHYT
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleExportFieldSheet}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer"
          >
            <FileDown className="w-4 h-4" /> Xuất Tuyến Thu Hiện Trường
          </button>
          {isAdminOrManager && selectedIds.length > 0 && (
            <button
              onClick={() => setIsReassignModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-sm transition active:scale-95 animate-pulse cursor-pointer"
            >
              <UserCheck className="w-4 h-4" /> Phân Công ({selectedIds.length} khách)
            </button>
          )}
        </div>
      </div>

      {/* SLA Metrics Counters (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Quá Hạn */}
        <div 
          onClick={() => setSlaFilter(slaFilter === 'overdue' ? 'all' : 'overdue')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            slaFilter === 'overdue' 
              ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/30' 
              : 'bg-white border-slate-200 hover:border-rose-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${slaFilter === 'overdue' ? 'text-rose-100' : 'text-slate-500'}`}>
              🔴 Quá Hạn SLA
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${slaFilter === 'overdue' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-700'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{kpiStats.overdueCount}</span>
            <span className={`text-xs font-medium ${slaFilter === 'overdue' ? 'text-rose-100' : 'text-slate-400'}`}>hồ sơ trễ hạn</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium pt-2 border-t ${slaFilter === 'overdue' ? 'border-white/20 text-rose-100' : 'border-slate-100 text-rose-600'}`}>
            Cần cử cán bộ tiếp cận thu phí gấp
          </div>
        </div>

        {/* 2. Khẩn Cấp (1 - 7 Ngày) */}
        <div 
          onClick={() => setSlaFilter(slaFilter === 'urgent' ? 'all' : 'urgent')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            slaFilter === 'urgent' 
              ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30' 
              : 'bg-white border-slate-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${slaFilter === 'urgent' ? 'text-amber-100' : 'text-slate-500'}`}>
              🟠 Khẩn Cấp (1 - 7 Ngày)
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${slaFilter === 'urgent' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{kpiStats.urgentCount}</span>
            <span className={`text-xs font-medium ${slaFilter === 'urgent' ? 'text-amber-100' : 'text-slate-400'}`}>hồ sơ tuần này</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium pt-2 border-t ${slaFilter === 'urgent' ? 'border-white/20 text-amber-100' : 'border-slate-100 text-amber-600'}`}>
            Hết hạn trong 7 ngày tới
          </div>
        </div>

        {/* 3. Cảnh Báo (8 - 30 Ngày) */}
        <div 
          onClick={() => setSlaFilter(slaFilter === 'warning' ? 'all' : 'warning')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            slaFilter === 'warning' 
              ? 'bg-[#004182] text-white border-[#004182] shadow-md shadow-blue-900/30' 
              : 'bg-white border-slate-200 hover:border-blue-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${slaFilter === 'warning' ? 'text-blue-100' : 'text-slate-500'}`}>
              🟡 Sắp Đến Hạn (8 - 30 Ngày)
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${slaFilter === 'warning' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#004182]'}`}>
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight">{kpiStats.warningCount}</span>
            <span className={`text-xs font-medium ${slaFilter === 'warning' ? 'text-blue-100' : 'text-slate-400'}`}>hồ sơ tháng tới</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium pt-2 border-t ${slaFilter === 'warning' ? 'border-white/20 text-blue-100' : 'border-slate-100 text-[#004182]'}`}>
            Diện gửi thông báo nhắc lịch
          </div>
        </div>

        {/* 4. Tỷ Lệ Tái Tục & Giữ Chân */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              📊 Tỷ Lệ Duy Trì (% Retention)
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 tracking-tight">{kpiStats.retentionRate}%</span>
            <span className="text-xs font-medium text-slate-400">tái tục đúng hạn</span>
          </div>
          <div className="mt-2 text-[11px] font-medium pt-2 border-t border-slate-100 text-slate-500 flex items-center justify-between">
            <span>Tổng tệp: <b>{kpiStats.totalCount}</b></span>
            <span className="text-emerald-700 font-bold">An toàn: {kpiStats.safeCount}</span>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Box */}
          <div className="md:col-span-2 relative">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
              Tìm Kiếm Khách Hàng / Địa Chỉ
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTxt}
                onChange={e => { setSearchTxt(e.target.value); setCurrentPage(1); }}
                placeholder="Tên, số điện thoại, CCCD, mã BHXH, xã phường..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Loại Hình</label>
            <select
              value={typeFilter || 'ALL'}
              onChange={(e: any) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả loại hình</option>
              <option value="BHXH">BHXH Tự Nguyện</option>
              <option value="BHYT">BHYT Hộ Gia Đình</option>
            </select>
          </div>

          {/* SLA Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Mức Độ SLA</label>
            <select
              value={slaFilter || 'all'}
              onChange={(e: any) => { setSlaFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none cursor-pointer"
            >
              <option value="all">Tất cả trạng thái SLA</option>
              <option value="overdue">🔴 Quá hạn (Cần đôn đốc)</option>
              <option value="urgent">🟠 Khẩn cấp (1 - 7 ngày)</option>
              <option value="warning">🟡 Sắp đến hạn (8 - 30 ngày)</option>
              <option value="safe">🟢 An toàn (&gt; 30 ngày)</option>
            </select>
          </div>

          {/* Staff Filter (Admin only) */}
          {isAdminOrManager && (
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Cán Bộ Phụ Trách</label>
              <select
                value={staffFilter || 'all'}
                onChange={e => { setStaffFilter(e.target.value); setCurrentPage(1); }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-[#004182] focus:ring-1 focus:ring-[#004182] outline-none cursor-pointer"
              >
                <option value="all">Tất cả cán bộ</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.staff_code || (s as any).staffCode || s.role})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Staff Workload Board (Admin View) */}
      {isAdminOrManager && staffWorkload.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" /> Bảng Giám Sát Phân Bổ Nhiệm Vụ Cán Bộ Thu Hiện Trường
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              {staffWorkload.length} cán bộ đang phụ trách địa bàn
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {staffWorkload.map(s => (
              <div 
                key={s.id}
                onClick={() => setStaffFilter(staffFilter === s.id ? 'all' : s.id)}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  staffFilter === s.id 
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20' 
                    : 'bg-slate-50 border-slate-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 truncate max-w-[140px]">{s.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded">
                    {s.staff_code || (s as any).staffCode || s.role}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-center">
                  <div className="bg-white p-1 rounded border border-slate-100">
                    <span className="block text-[9px] text-slate-400 uppercase font-bold">Tổng</span>
                    <b className="text-slate-800">{s.total}</b>
                  </div>
                  <div className="bg-rose-50 p-1 rounded border border-rose-100">
                    <span className="block text-[9px] text-rose-500 uppercase font-bold">Trễ hạn</span>
                    <b className="text-rose-700">{s.overdue}</b>
                  </div>
                  <div className="bg-amber-50 p-1 rounded border border-amber-100">
                    <span className="block text-[9px] text-amber-500 uppercase font-bold">Gấp</span>
                    <b className="text-amber-700">{s.urgent}</b>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Customers Dispatch Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#004182] transition cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === paginatedList.length ? (
                <CheckSquare className="w-4 h-4 text-[#004182]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>Chọn Tất Cả Trang Này</span>
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs font-black text-[#004182] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                Đã chọn {selectedIds.length} khách hàng
              </span>
            )}
          </div>

          <div className="text-xs font-medium text-slate-500">
            Hiển thị <b>{paginatedList.length}</b> / <b>{filteredCustomers.length}</b> khách hàng
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-3 text-center w-10">Chọn</th>
                <th className="py-3.5 px-3">Khách Hàng</th>
                <th className="py-3.5 px-3">Loại Hình</th>
                <th className="py-3.5 px-3">Tuyến Thu / Địa Chỉ</th>
                <th className="py-3.5 px-3 text-center">Phương Thức Đóng</th>
                <th className="py-3.5 px-3 text-center">Hạn Đóng Tiếp</th>
                <th className="py-3.5 px-3">Dự Kiến Thu</th>
                <th className="py-3.5 px-3 text-center">Tình Trạng SLA</th>
                <th className="py-3.5 px-3">Cán Bộ Thu</th>
                <th className="py-3.5 px-3">Nhật Ký Tác Nghiệp</th>
                <th className="py-3.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-slate-400 font-medium">
                    Không tìm thấy khách hàng nào khớp với điều kiện lọc
                  </td>
                </tr>
              ) : (
                paginatedList.map(c => {
                  const staffObj = staff.find(s => s.id === c.staffId);
                  const isSelected = selectedIds.includes(c.id);

                  return (
                    <tr key={c.id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(c.id)}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-slate-900">{c.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                          {c.phone ? (
                            <a href={`tel:${c.phone}`} className="text-blue-600 font-bold hover:underline flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {c.phone}
                            </a>
                          ) : (
                            <span>Chưa có SĐT</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono font-medium mt-0.5">
                          {c.cccd || c.bhxh ? `ĐDCN/CCCD: ${c.cccd || c.bhxh}` : ''}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide ${
                          c.type === 'BHXH' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.type === 'BHXH' ? <Shield className="w-3 h-3" /> : <HeartPulse className="w-3 h-3" />}
                          {c.type}
                        </span>
                      </td>

                      {/* Address / Field Area */}
                      <td className="py-3.5 px-3 max-w-[200px]">
                        <div className="flex items-start gap-1 text-[11px] text-slate-700 truncate" title={c.address}>
                          <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
                          <span className="truncate">{c.address || 'Chưa cập nhật địa chỉ'}</span>
                        </div>
                      </td>

                      {/* Payment Method / Last Paid Period */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <div className="font-bold text-slate-800 text-xs">
                          {c.method || (c.months ? `Đóng ${c.months} tháng` : '---')}
                        </div>
                        {(c.fromMonth || c.toMonth) && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 font-semibold">
                            {c.fromMonth && c.toMonth ? `${formatMonthVN(c.fromMonth)} - ${formatMonthVN(c.toMonth)}` : (c.fromMonth ? formatMonthVN(c.fromMonth) : '')}
                          </div>
                        )}
                      </td>

                      {/* Next Payment Date */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="font-bold text-slate-900 text-xs">
                          {c.nextPayment ? formatDateVN(c.nextPayment) : '---'}
                        </span>
                      </td>

                      {/* Estimated Collection (NEW) */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          {formatMoney(c.amount)}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Kỳ đóng: {c.months || 12} tháng
                        </div>
                      </td>

                      {/* SLA Urgency Tag */}
                      <td className="py-3.5 px-3 text-center">
                        <CustomerStatusBadge mode="sla" slaStatus={c.slaStatus} daysRemaining={c.daysRemaining} />
                      </td>

                      {/* Assigned Staff */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-800">{staffObj?.name || 'Chưa phân công'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{staffObj?.staff_code || (staffObj as any)?.staffCode || staffObj?.role || ''}</div>
                      </td>

                      {/* Interaction Status */}
                      <td className="py-3.5 px-3">
                        {(() => {
                          let currentSelectVal = 'Chưa liên hệ';
                          const noteHeader = c.notes?.split(' (')[0] || '';
                          if (noteHeader.includes('Đã thu tiền')) currentSelectVal = 'Đã thu tiền thành công';
                          else if (noteHeader.includes('hẹn') || noteHeader.includes('Hẹn')) currentSelectVal = 'Khách hẹn nộp tiền';
                          else if (noteHeader.includes('gọi') || noteHeader.includes('nhắn')) currentSelectVal = 'Đã gọi điện/nhắn tin';
                          else if (noteHeader.includes('dừng') || noteHeader.includes('chối') || noteHeader.includes('từ chối')) currentSelectVal = 'Khách tạm dừng/từ chối';
                          else if (noteHeader && noteHeader !== 'Chưa liên hệ') currentSelectVal = noteHeader;

                          return (
                            <select
                              value={currentSelectVal || 'Chưa liên hệ'}
                              onChange={e => handleUpdateNotes(c, e.target.value)}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-[11px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-sm transition"
                              title={c.notes || 'Nhật ký tác nghiệp'}
                            >
                              <option value="Chưa liên hệ">📞 Chưa liên hệ</option>
                              <option value="Đã gọi điện/nhắn tin">💬 Đã gọi điện/nhắn</option>
                              <option value="Khách hẹn nộp tiền">📅 Khách hẹn nộp</option>
                              <option value="Đã thu tiền thành công">✅ Đã thu tiền</option>
                              <option value="Khách tạm dừng/từ chối">❌ Tạm dừng/Từ chối</option>
                              {!['Chưa liên hệ', 'Đã gọi điện/nhắn tin', 'Khách hẹn nộp tiền', 'Đã thu tiền thành công', 'Khách tạm dừng/từ chối'].includes(currentSelectVal) && (
                                <option value={currentSelectVal}>📝 {currentSelectVal}</option>
                              )}
                            </select>
                          );
                        })()}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* VietQR nộp tiền */}
                          <button
                            type="button"
                            onClick={() => {
                              const fullRecord = records.find(r => r.id === Number(c.id)) || c;
                              setVietQrRecord(fullRecord);
                            }}
                            className="p-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Mã VietQR nộp tiền (NAPAS 247)"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>

                          {/* Gia hạn nhanh */}
                          <button
                            type="button"
                            onClick={() => handleQuickRenew(c)}
                            className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition shadow-sm"
                            title="Gia hạn nhanh hồ sơ"
                          >
                            <Zap className="w-3.5 h-3.5" />
                          </button>

                          {/* Ghi nhận nhật ký tiếp xúc */}
                          <button
                            type="button"
                            onClick={() => handleOpenContactLog(c)}
                            className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Ghi nhận nhật ký tiếp xúc / đôn đốc"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>

                          {c.phone && (
                            <a
                              href={`https://zalo.me/${c.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition shadow-sm"
                              title="Nhắn Zalo"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerForScript(c);
                              setScriptType(c.slaStatus === 'overdue' || c.slaStatus === 'urgent' ? 'urgent' : 'standard');
                            }}
                            className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white rounded-lg transition shadow-sm"
                            title="Xem mẫu tin nhắn đôn đốc"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 0 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50 gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-sm text-gray-500 hidden sm:inline">
                Hiển thị {filteredCustomers.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredCustomers.length)} trong số {filteredCustomers.length} khách hàng
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

      {/* Bulk Reassign Modal */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-blue-600 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">Điều Phối & Phân Công Nhiệm Vụ</h3>
                <p className="text-xs text-blue-600 font-bold">Số lượng: {selectedIds.length} khách hàng</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Chuyển giao tệp khách hàng được chọn cho cán bộ thu phụ trách địa bàn để thực hiện đôn đốc thu phí tận nơi.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Chọn Cán Bộ Thu Mới <span className="text-rose-500">*</span>
              </label>
              <select
                value={targetStaffId || ''}
                onChange={e => setTargetStaffId(e.target.value)}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-800"
              >
                <option value="">-- Chọn cán bộ tiếp nhận --</option>
                {staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.staff_code || (s as any).staffCode || s.role})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={handleBulkReassign}
                disabled={isProcessing || !targetStaffId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? 'Đang điều phối...' : 'Xác Nhận Phân Công'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Script Modal */}
      {selectedCustomerForScript && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Kịch Bản Đôn Đốc Thu Phí</h3>
                  <p className="text-xs text-slate-500 font-medium">Khách hàng: <b>{selectedCustomerForScript.name}</b></p>
                </div>
              </div>
            </div>

            {/* Template Selector */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setScriptType('urgent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  scriptType === 'urgent' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nhắc Gấp (Khẩn Cấp)
              </button>
              <button
                type="button"
                onClick={() => setScriptType('standard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  scriptType === 'standard' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Nhắc Định Kỳ
              </button>
              <button
                type="button"
                onClick={() => setScriptType('receipt')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  scriptType === 'receipt' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Xác Nhận Đã Thu
              </button>
              <button
                type="button"
                onClick={() => setScriptType('vietqr')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                  scriptType === 'vietqr' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" /> Kèm Mã VietQR
              </button>
            </div>

            {/* Message Preview Box */}
            <div className="relative">
              <textarea
                readOnly
                value={messageScript}
                rows={6}
                className="w-full p-3.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium leading-relaxed outline-none"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                {selectedCustomerForScript.phone && (
                  <a
                    href={`https://zalo.me/${selectedCustomerForScript.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Mở Zalo Khách
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const fullRecord = records.find(r => r.id === Number(selectedCustomerForScript.id)) || selectedCustomerForScript;
                    setVietQrRecord(fullRecord);
                  }}
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5" /> Xem VietQR
                </button>
                {selectedCustomerForScript.phone && (
                  <a
                    href={`tel:${selectedCustomerForScript.phone}`}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" /> Gọi Điện
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCustomerForScript(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5" /> Sao Chép Tin Nhắn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Log Modal */}
      {selectedCustomerForLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl tracking-tight">
                  Ghi Nhận Nhật Ký Tiếp Xúc / Đôn Đốc
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Nhiệm vụ: <strong className="text-slate-800 font-bold">DP-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-{String(selectedCustomerForLog.id).slice(-3).padStart(3, '0')}</strong> - <span className="text-blue-700 font-bold">{selectedCustomerForLog.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="space-y-4 text-xs font-bold text-slate-700">
              {/* Channel */}
              <div className="space-y-1.5">
                <label className="block text-slate-800 font-extrabold text-xs">
                  Hình thức / Kênh liên hệ
                </label>
                <select
                  value={logChannel || '📞 Gọi điện thoại trực tiếp'}
                  onChange={e => setLogChannel(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="📞 Gọi điện thoại trực tiếp">📞 Gọi điện thoại trực tiếp</option>
                  <option value="💬 Gửi tin nhắn Zalo OA / SMS">💬 Gửi tin nhắn Zalo OA / SMS</option>
                  <option value="✉️ Gửi Email nhắc hạn kèm QR">✉️ Gửi Email nhắc hạn kèm QR</option>
                  <option value="🏡 Trực tiếp đến tận nhà người dân">🏡 Trực tiếp đến tận nhà người dân</option>
                  <option value="🏢 Tiếp đón tại quầy / Điểm thu UBND">🏢 Tiếp đón tại quầy / Điểm thu UBND</option>
                </select>
              </div>

              {/* Result */}
              <div className="space-y-1.5">
                <label className="block text-slate-800 font-extrabold text-xs">
                  Kết quả tiếp xúc
                </label>
                <select
                  value={logResult || '✅ Đã đồng ý & Hẹn ngày nộp tiền'}
                  onChange={e => setLogResult(e.target.value)}
                  className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                >
                  <option value="✅ Đã đồng ý & Hẹn ngày nộp tiền">✅ Đã đồng ý & Hẹn ngày nộp tiền</option>
                  <option value="📱 Đã chuyển khoản qua VietQR">📱 Đã chuyển khoản qua VietQR</option>
                  <option value="💵 Đã nộp tiền mặt tại chỗ">💵 Đã nộp tiền mặt tại chỗ</option>
                  <option value="🔄 Hẹn gọi lại vào ngày khác">🔄 Hẹn gọi lại vào ngày khác</option>
                  <option value="❌ Không liên lạc được / Tắt máy">❌ Không liên lạc được / Tắt máy</option>
                  <option value="⛔ Từ chối tham gia tiếp">⛔ Từ chối tham gia tiếp</option>
                  <option value="💼 Đã đi làm & đóng BHXH bắt buộc">💼 Đã đi làm & đóng BHXH bắt buộc</option>
                  <option value="🚚 Đã chuyển nơi cư trú">🚚 Đã chuyển nơi cư trú</option>
                  <option value="📋 Khác / Cần theo dõi">📋 Khác / Cần theo dõi</option>
                </select>
              </div>

              {/* Conditional fields for appointment */}
              {(logResult.includes('Hẹn ngày nộp tiền') || logResult.includes('Hẹn gọi lại')) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="block text-slate-800 font-extrabold text-xs">
                      Ngày hẹn nộp tiền
                    </label>
                    <input
                      type="date"
                      value={logPromiseDate}
                      onChange={e => setLogPromiseDate(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-slate-800 font-extrabold text-xs">
                      Số tiền hẹn nộp (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={logPromiseAmount}
                      onChange={e => setLogPromiseAmount(e.target.value)}
                      placeholder="1263600"
                      className="w-full p-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-slate-800 font-extrabold text-xs">
                  Chi tiết trao đổi & Ghi chú
                </label>
                <textarea
                  value={logContent}
                  onChange={e => setLogContent(e.target.value)}
                  rows={3}
                  placeholder="Ghi nhận phản hồi của người dân, thời gian hẹn, yêu cầu tư vấn thêm..."
                  className="w-full p-3.5 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedCustomerForLog(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition text-xs sm:text-sm"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isSavingLog}
                onClick={handleSaveContactLog}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-[#059669] hover:bg-[#047857] transition text-xs sm:text-sm shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingLog ? 'Đang lưu...' : 'Lưu Nhật Ký Liên Hệ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Renewal Modal */}
      {isRegisterModalOpen && (
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => {
            setIsRegisterModalOpen(false);
            refreshData();
          }}
          type={registerType}
          record={registerRecord}
          isRenew={isRenew}
        />
      )}

      {/* VietQR Modal */}
      <VietQRModal
        isOpen={!!vietQrRecord}
        onClose={() => setVietQrRecord(null)}
        record={vietQrRecord}
        showToast={showToast}
        staffList={staff}
      />
    </div>
  );
};

export default DispatchOperations;
