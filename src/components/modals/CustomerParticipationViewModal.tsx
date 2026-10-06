import React, { useMemo } from 'react';
import { CustomerType, RecordType } from '../../context/types';
import {
  X,
  Eye,
  Calendar,
  Building2,
  Briefcase,
  Calculator,
  Edit,
  Clock,
  Coins,
  History,
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
  extractAgencyPeriods,
  transferCustomerTo1Lan,
  doesRecordMatchCustomer,
  calculateCustomerParticipationSupport,
  calculatePeriodSupportedMonths
} from '../../utils/customerParticipationHelper';
import { normalizePeriod } from '../../utils/dateStandardHelper';

interface CustomerParticipationViewModalProps {
  customer: CustomerType | null;
  records: RecordType[];
  isOpen: boolean;
  onClose: () => void;
  onOpenEditModal: (c: CustomerType) => void;
}

export const CustomerParticipationViewModal: React.FC<CustomerParticipationViewModalProps> = ({
  customer,
  records,
  isOpen,
  onClose,
  onOpenEditModal
}) => {
  const navigate = useNavigate();
  const { showToast } = useAppContext() as any;

  // Lấy danh sách các bản ghi phát sinh tại đại lý
  const agencyRecords = useMemo(() => {
    if (!customer || !records || !Array.isArray(records)) return [];
    return records
      .filter(r => {
        if (!r || r.type !== 'BHXH') return false;
        if ((r.payment_status || (r as any).paymentStatus) === 'Đã hủy' || (r as any).status === 'Đã hủy') return false;
        if (r.is_adjustment || (r as any).isAdjustment) return false;
        return doesRecordMatchCustomer(r, customer);
      })
      .sort((a, b) => {
        const dateA = new Date(a.date || a.effective_date || (a as any).effectiveDate || 0).getTime();
        const dateB = new Date(b.date || b.effective_date || (b as any).effectiveDate || 0).getTime();
        return dateB - dateA;
      });
  }, [customer, records]);

  // Danh sách giai đoạn tại đại lý
  const agencyPeriods = useMemo(() => {
    if (!customer) return [];
    return extractAgencyPeriods(customer, records);
  }, [customer, records]);

  // Các giai đoạn trước đây
  const priorPeriods = useMemo(() => {
    return customer?.prior_periods && Array.isArray(customer.prior_periods)
      ? customer.prior_periods
      : [];
  }, [customer]);

  // Tính toán tổng số tháng & hỗ trợ NSNN chuẩn hóa từ mốc 01/2018 (NĐ 134/2015 & Luật BHXH 2024)
  const supportStats = useMemo(() => {
    return calculateCustomerParticipationSupport(
      priorPeriods,
      agencyPeriods,
      Number(customer?.prior_voluntary_months) || 0
    );
  }, [priorPeriods, agencyPeriods, customer]);

  const compulsoryMonths = supportStats.compulsoryMonths || Number(customer?.prior_compulsory_months) || 0;
  const priorVoluntaryMonths = supportStats.priorVoluntaryMonths;
  const agencyMonths = supportStats.agencyVoluntaryMonths;
  const totalVoluntary = supportStats.totalVoluntary;
  const totalAccumulated = supportStats.totalAccumulated;

  // Số tháng được NSNN hỗ trợ (chỉ tính từ 01/2018 trở đi)
  const supportedMonths = supportStats.supportedMonthsCapped;
  const remainingSupport = supportStats.remainingSupportMonths;
  const isSupportExpired = supportStats.isSupportExpired;
  const unsupportedBefore2018 = supportStats.voluntaryUnsupportedBefore2018Months;

  if (!isOpen || !customer) return null;

  const handleExport1Lan = () => {
    const ok = transferCustomerTo1Lan(customer, records, navigate, showToast);
    if (ok) {
      onClose();
    }
  };

  const handleEditClick = () => {
    onClose();
    onOpenEditModal(customer);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-teal-50/50 via-white to-blue-50/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <Eye size={24} className="text-teal-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                  Quá Trình Tham Gia BHXH Chi Tiết
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800">
                  Hồ sơ toàn diện
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Bao gồm toàn bộ thời gian trước đây và các kỳ đóng phát sinh tại đại lý này
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-gray-700">
          
          {/* Thông tin định danh khách hàng */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/60 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Họ và tên khách hàng</div>
              <div className="text-lg font-black text-gray-900 mt-0.5">{customer.name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Số CCCD / ĐDCN</div>
              <div className="font-mono font-bold text-gray-800 text-sm mt-0.5">{customer.cccd || 'Chưa có'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Mã số BHXH</div>
              <div className="font-mono font-bold text-blue-700 text-sm mt-0.5">{customer.bhxh || customer.old_bhxh || 'Chưa cấp'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Số điện thoại</div>
              <div className="font-mono font-semibold text-gray-800 text-sm mt-0.5">{customer.phone || 'Chưa có'}</div>
            </div>
            {customer.address && (
              <div className="w-full pt-2 border-t border-slate-200/50 text-xs text-gray-500">
                <span className="font-semibold text-gray-600">Địa chỉ:</span> {customer.address}
              </div>
            )}
          </div>

          {/* Stat Cards: Tổng hợp số tháng */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/60">
              <div className="text-xs text-amber-800 font-bold flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600" />
                Tổng tích lũy
              </div>
              <div className="text-xl sm:text-2xl font-black text-amber-900 mt-1">
                {totalAccumulated} <span className="text-xs font-semibold text-amber-700">tháng</span>
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5 font-medium">
                ~{(totalAccumulated / 12).toFixed(1)} năm ({totalAccumulated >= 180 ? '✓ Đủ 15 năm hưu trí' : `Thiếu ${180 - totalAccumulated} th`})
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-gray-600 font-bold flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-500" />
                BHXH bắt buộc
              </div>
              <div className="text-xl sm:text-2xl font-black text-gray-800 mt-1">
                {compulsoryMonths} <span className="text-xs font-semibold text-gray-500">tháng</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                Thời gian đóng cơ quan cũ
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/60">
              <div className="text-xs text-blue-800 font-bold flex items-center gap-1.5">
                <Coins size={14} className="text-blue-600" />
                TN nơi khác
              </div>
              <div className="text-xl sm:text-2xl font-black text-blue-900 mt-1">
                {priorVoluntaryMonths} <span className="text-xs font-semibold text-blue-700">tháng</span>
              </div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                Đại lý / Bưu điện trước
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/60">
              <div className="text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                <History size={14} className="text-emerald-600" />
                TN tại đại lý này
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                {agencyMonths} <span className="text-xs font-semibold text-emerald-700">tháng</span>
              </div>
              <div className="text-[11px] text-emerald-600 mt-0.5">
                Tự động từ {agencyRecords.length} phiếu thu
              </div>
            </div>
          </div>

          {/* Tiến trình hỗ trợ NSNN 10 năm */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Info size={15} className="text-blue-600 shrink-0" />
                <span>Tiến trình hưởng hỗ trợ tiền đóng từ Ngân sách Nhà nước (Trần tối đa 10 năm = 120 tháng)</span>
              </div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                Tổng số tháng tự nguyện tích lũy: <strong className="text-blue-700">{totalVoluntary} tháng</strong> (Nơi khác: {priorVoluntaryMonths} th + Đại lý này: {agencyMonths} th)
                {unsupportedBefore2018 > 0 && (
                  <span className="block text-[11px] text-amber-700 font-medium mt-0.5">
                    🗓️ Gồm <strong>{unsupportedBefore2018} tháng</strong> đóng trước ngày 01/01/2018 (chưa có chính sách NSNN hỗ trợ tiền đóng theo NĐ 134/2015/NĐ-CP nên không tính vào trần 120 tháng).
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-sm font-black text-gray-800">{supportedMonths}/120 tháng</span>
                <div className="text-[11px] font-bold text-gray-500">
                  {isSupportExpired ? (
                    <span className="text-rose-600 font-black">Đã hết 10 năm hỗ trợ</span>
                  ) : (
                    <span className="text-emerald-600 font-black">Còn {remainingSupport} tháng được hỗ trợ</span>
                  )}
                </div>
              </div>
              <div className="w-24 h-2.5 bg-gray-200 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full ${isSupportExpired ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (supportedMonths / 120) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* BẢNG 1: Quá trình tham gia trước đây */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                1. Quá trình tham gia trước đây (Hồ sơ nhập bổ sung)
                <span className="text-xs font-bold text-gray-400">({priorPeriods.length} giai đoạn)</span>
              </h3>
              <button
                type="button"
                onClick={handleEditClick}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition cursor-pointer"
              >
                <Edit size={13} />
                <span>Chỉnh sửa hồ sơ</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-gray-600 border-b border-gray-200 font-bold">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Phân loại</th>
                    <th className="p-3">Đơn vị / Cơ quan / Đại lý</th>
                    <th className="p-3">Chức vụ / Công việc</th>
                    <th className="p-3 text-center">Thời gian</th>
                    <th className="p-3 text-center">Số tháng</th>
                    <th className="p-3 text-right">Mức lương / Thu nhập</th>
                    <th className="p-3">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {priorPeriods.map((rawP, idx) => {
                    const p = normalizePeriod(rawP);
                    const isBatBuoc = p.type === 'batbuoc';
                    const suppInfo = calculatePeriodSupportedMonths(p);

                    return (
                      <tr key={p.id || idx} className="hover:bg-blue-50/30 transition">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            isBatBuoc ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isBatBuoc ? 'Bắt buộc' : 'Tự nguyện ngoài'}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-gray-900">
                          {p.workplace || <span className="text-gray-400 italic">Không rõ</span>}
                        </td>
                        <td className="p-3 text-gray-600">
                          {p.position || <span className="text-gray-400 italic">-</span>}
                        </td>
                        <td className="p-3 text-center font-mono font-medium text-gray-700 whitespace-nowrap">
                          {p.fromMonth} → {p.toMonth}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-gray-900 block">{p.months} th</span>
                          {!isBatBuoc && suppInfo.unsupportedBefore2018Months > 0 && (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded font-medium block whitespace-nowrap mt-0.5" title={`Trong đó ${suppInfo.unsupportedBefore2018Months} tháng trước 01/2018 chưa có hỗ trợ NSNN`}>
                              Trước 2018: {suppInfo.unsupportedBefore2018Months}th
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-800">
                          {p.salary ? `${typeof p.salary === 'number' ? new Intl.NumberFormat('vi-VN').format(p.salary) : p.salary} đ` : <span className="text-gray-400 italic">Chưa nhập</span>}
                        </td>
                        <td className="p-3 text-gray-500 text-[11px] max-w-[150px] truncate" title={p.notes || ''}>
                          {p.notes || (!isBatBuoc && suppInfo.unsupportedBefore2018Months > 0 ? `Đóng trước 01/2018 (${suppInfo.unsupportedBefore2018Months}th)` : '-')}
                        </td>
                      </tr>
                    );
                  })}

                  {priorPeriods.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                        Chưa ghi nhận giai đoạn đóng BHXH bắt buộc hoặc tự nguyện ngoài nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {customer.prior_participation_notes && (
              <div className="text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <strong>Ghi chú chung:</strong> {customer.prior_participation_notes}
              </div>
            )}
          </div>

          {/* BẢNG 2: Quá trình phát sinh tại đại lý này */}
          <div className="space-y-2.5">
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              2. Quá trình phát sinh tại Đại lý này (Tự động từ phiếu thu)
              <span className="text-xs font-bold text-emerald-700">({agencyRecords.length} phiếu thu)</span>
            </h3>

            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-gray-600 border-b border-gray-200 font-bold">
                    <th className="p-3 w-12 text-center">STT</th>
                    <th className="p-3">Ngày thu tiền</th>
                    <th className="p-3 text-center">Kỳ đóng</th>
                    <th className="p-3 text-center">Số tháng</th>
                    <th className="p-3 text-right">Thu nhập đóng (Lương căn cứ)</th>
                    <th className="p-3 text-right">Tiền thực đóng</th>
                    <th className="p-3 text-right">NSNN hỗ trợ</th>
                    <th className="p-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agencyRecords.map((r, idx) => {
                    const basePrem = r.base_premium ?? (r as any).basePremium;
                    const sal = r.wage || r.income || (basePrem ? Math.round(Number(basePrem) / 0.22) : 1500000);
                    const fMonth = r.from_month || (r as any).fromMonth;
                    const tMonth = r.to_month || (r as any).toMonth;
                    const nnSup = r.nn_support_amount ?? (r as any).nnSupportAmount;
                    return (
                      <tr key={r.id || idx} className="hover:bg-emerald-50/30 transition">
                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-medium text-gray-700">
                          {r.date ? new Date(r.date).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-emerald-700">
                          {fMonth || '-'} {tMonth ? `→ ${tMonth}` : ''}
                        </td>
                        <td className="p-3 text-center font-black text-gray-900">
                          {r.months || 1} th
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-800">
                          {new Intl.NumberFormat('vi-VN').format(sal)} đ
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {r.amount ? new Intl.NumberFormat('vi-VN').format(r.amount) : 0} đ
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {nnSup ? `${new Intl.NumberFormat('vi-VN').format(nnSup)} đ` : '-'}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <CheckCircle2 size={12} />
                            Đã thu tiền
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {agencyRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 italic">
                        Chưa phát sinh phiếu thu BHXH nào tại đại lý này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
          <div className="text-xs text-gray-500 font-medium">
            Tổng cộng: <strong className="text-gray-900">{totalAccumulated} tháng</strong> đóng BHXH ({priorPeriods.length} giai đoạn ngoài, {agencyPeriods.length} giai đoạn tại đại lý)
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleExport1Lan}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 cursor-pointer transition hover:scale-[1.02]"
              title="Xuất dữ liệu toàn bộ quá trình sang phân hệ BHXH 1 lần và tự động tính toán ra kết quả ngay"
            >
              <Calculator size={16} />
              <span>Tính BHXH 1 Lần Ngay</span>
            </button>

            <button
              type="button"
              onClick={handleEditClick}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Edit size={15} />
              <span>Cập nhật hồ sơ</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs sm:text-sm flex items-center justify-center transition cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
