import React from 'react';
import { Search, History, X, ShieldCheck } from 'lucide-react';
import {
  formatMonthVN,
  formatDateVN,
  getLocalYYYYMMDD,
  formatMoney,
  compareRecordsByContractLatest,
  getMethodLabelFromValue,
  calculateToMonthVN,
  calculateNextPaymentFromToMonth,
  toUIMonth
} from '../../utils/helpers';
import { parseMonthAndYear } from '../../utils/dateStandardHelper';
import { useAppContext } from '../../context/AppContext';
import { maskCCCD, maskName } from '../../utils/security';

interface SearchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[];
  searchCode: string;
}

const SearchResultModal: React.FC<SearchResultModalProps> = ({ isOpen, onClose, results, searchCode }) => {
  const { currentUser } = useAppContext();
  const isPublic = !currentUser;

  if (!isOpen) return null;

  // 1. Chuẩn hóa 100% dữ liệu lịch sử đầu vào (hỗ trợ cả snake_case từ Database và camelCase)
  const normalizedList = (results || []).map((raw: any) => {
    const type = String(raw.type || 'BHXH').toUpperCase();
    const months = Math.max(1, Number(raw.months) || 1);
    const income = Number(raw.income ?? raw.wage) || 0;
    const amount = Number(raw.amount) || 0;
    
    let fromM = raw.fromMonth || raw.from_month || (raw as any).frommonth || '';
    let toM = raw.toMonth || raw.to_month || (raw as any).tomonth || '';
    let nextP = raw.nextPayment || raw.next_payment || (raw as any).nextpayment || '';
    const dateStr = raw.date || raw.created_at || raw.registration_date || '';

    // Chuẩn hóa fromMonth / toMonth sang định dạng MM/YYYY
    if (fromM) fromM = toUIMonth(fromM) || formatMonthVN(fromM) || fromM;
    if (toM) toM = toUIMonth(toM) || formatMonthVN(toM) || toM;

    // Nếu có fromMonth mà thiếu toMonth -> tính toMonth = fromMonth + months - 1
    if (fromM && !toM && months > 0) {
      toM = calculateToMonthVN(fromM, months);
    }

    // Nếu thiếu cả fromMonth và toMonth nhưng có nextPayment -> tính lùi kỳ trước hạn đóng
    if (!fromM && !toM && nextP) {
      const { month, year } = parseMonthAndYear(null, nextP);
      if (month && year) {
        const toDate = new Date(year, month - 2, 1);
        toM = `${String(toDate.getMonth() + 1).padStart(2, '0')}/${toDate.getFullYear()}`;
        if (months > 1) {
          const fromDate = new Date(toDate.getFullYear(), toDate.getMonth() - months + 1, 1);
          fromM = `${String(fromDate.getMonth() + 1).padStart(2, '0')}/${fromDate.getFullYear()}`;
        } else {
          fromM = toM;
        }
      }
    }

    // Nếu vẫn thiếu nhưng có date -> lấy tháng lập hồ sơ làm kỳ đóng
    if (!fromM && !toM && dateStr) {
      const formattedDateM = formatMonthVN(dateStr);
      if (formattedDateM) {
        fromM = formattedDateM;
        toM = months > 1 ? calculateToMonthVN(fromM, months) : fromM;
      }
    }

    // Nếu thiếu nextPayment nhưng có toM -> tự động tính ngày 15 của tháng liền kề
    if (!nextP && toM) {
      nextP = calculateNextPaymentFromToMonth(toM);
    }

    // Chuỗi hiển thị kỳ đóng
    let periodDisplay = '---';
    if (fromM && toM) {
      const fStr = formatMonthVN(fromM) || fromM;
      const tStr = formatMonthVN(toM) || toM;
      periodDisplay = (fStr === tStr) ? fStr : `${fStr} - ${tStr}`;
    } else if (fromM) {
      periodDisplay = formatMonthVN(fromM) || fromM;
    } else if (toM) {
      periodDisplay = formatMonthVN(toM) || toM;
    }

    const paymentStatus = String(raw.paymentStatus || raw.payment_status || (raw as any).paymentstatus || 'Đã thu tiền').trim();
    const actionType = String(raw.actionType || raw.action_type || '').trim();
    const rawMethod = String(raw.method || '').trim();
    const methodLabel = rawMethod ? (getMethodLabelFromValue(rawMethod) || rawMethod) : (months === 1 ? 'Đóng hằng tháng' : `Đóng ${months} tháng`);
    const notes = String(raw.notes || raw.note || '').trim();
    const name = String(raw.name || raw.masked_name || raw.fullName || 'Khách hàng').trim();
    const cccd = String(raw.cccd || raw.masked_cccd || raw.citizenId || '').trim();
    const bhxh = String(raw.bhxh || raw.old_bhxh || raw.oldBhxh || raw.bhxhCode || '').trim();
    const phone = String(raw.phone || '').trim();

    return {
      id: raw.id,
      name,
      cccd,
      bhxh,
      phone,
      type,
      fromMonth: fromM,
      toMonth: toM,
      from_month: fromM,
      to_month: toM,
      periodDisplay,
      months,
      income,
      wage: income,
      amount,
      nextPayment: nextP,
      next_payment: nextP,
      status: raw.status || 'Đang tham gia',
      paymentStatus,
      payment_status: paymentStatus,
      method: methodLabel,
      actionType,
      action_type: actionType,
      notes,
      date: dateStr
    };
  });

  // 2. Sắp xếp theo hợp đồng mới nhất (compareRecordsByContractLatest)
  const sortedResults = [...normalizedList].sort(compareRecordsByContractLatest);

  // 3. Lọc bỏ các bản ghi đã hủy nếu có các bản ghi hợp lệ khác
  const displayResults = sortedResults.filter(r => r.paymentStatus !== 'Đã hủy');
  const activeResults = displayResults.length > 0 ? displayResults : sortedResults;

  // Lấy bản ghi đầu mối thông tin khách hàng (ưu tiên bản ghi có tên đầy đủ)
  const primaryCustomer = activeResults.find(r => r.name && r.name !== 'Khách hàng') || activeResults[0] || (results[0] as any);

  // Thống kê tổng số tiền đã đóng tích lũy
  const totalAmountPaid = activeResults
    .filter(r => r.paymentStatus === 'Đã thu tiền')
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  // 4. Thống kê quá trình tham gia BHXH tự nguyện và hạn mức hỗ trợ NSNN 10 năm (từ 01/2018)
  const bhxhRecords = activeResults.filter(r => r.type === 'BHXH' && r.paymentStatus !== 'Đã hủy');
  let totalBhxhMonths = 0;
  let supportedBhxhMonths = 0;

  for (const r of bhxhRecords) {
    let m = Number(r.months) || 0;
    if (m <= 0 && r.fromMonth && r.toMonth) {
      const { month: m1, year: y1 } = parseMonthAndYear(r.fromMonth);
      const { month: m2, year: y2 } = parseMonthAndYear(r.toMonth);
      if (y1 && m1 && y2 && m2) m = (y2 - y1) * 12 + (m2 - m1) + 1;
    }
    totalBhxhMonths += m;

    let supp = m;
    if (r.fromMonth || r.date) {
      const { year } = parseMonthAndYear(r.fromMonth, r.date);
      if (year > 0 && year < 2018) {
        supp = 0;
      }
    }
    supportedBhxhMonths += supp;
  }

  const bhxhYears = Math.floor(totalBhxhMonths / 12);
  const bhxhRemMonths = totalBhxhMonths % 12;
  const bhxhTimeStr = bhxhYears > 0 
    ? `${totalBhxhMonths} tháng (${bhxhYears} năm${bhxhRemMonths > 0 ? ` ${bhxhRemMonths} tháng` : ''})`
    : `${totalBhxhMonths} tháng`;
  const isOver10Years = supportedBhxhMonths >= 120;

  return (
    <div className="fixed inset-0 bg-[#004182]/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden transform transition-transform duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#004182] to-[#0077c8] p-5 flex justify-between items-center text-white">
          <h3 className="font-bold text-xl flex items-center"><Search size={20} className="mr-2" /> Kết Quả Tra Cứu Quá Trình</h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar bg-gray-50">
          {/* Khối thẻ thông tin khách hàng tổng quan */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Khách hàng</p>
                <p className="text-lg font-extrabold text-[#004182] uppercase truncate" title={primaryCustomer?.name}>
                  {primaryCustomer?.name 
                    ? (isPublic ? maskName(primaryCustomer.name.split(' (+')[0], false) : primaryCustomer.name.split(' (+')[0]) 
                    : '---'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Số ĐDCN / CCCD</p>
                <p className="text-base font-bold text-[#0ea5e9] font-mono tabular-nums">
                  {isPublic ? maskCCCD(primaryCustomer?.cccd || searchCode, false) : (primaryCustomer?.cccd || searchCode || '---')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Mã số BHXH</p>
                <p className="text-base font-bold text-slate-800 font-mono tabular-nums">
                  {primaryCustomer?.bhxh 
                    ? (isPublic ? maskCCCD(primaryCustomer.bhxh, false) : primaryCustomer.bhxh) 
                    : (searchCode && searchCode.length === 10 ? searchCode : 'Chưa cấp mã')}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs text-gray-500 font-semibold mb-1">Tổng tiền đã đóng</p>
                <p className="text-base font-black text-emerald-600 font-mono tabular-nums">
                  {formatMoney(totalAmountPaid)}
                </p>
              </div>
            </div>

            {/* Banner bảo mật Nghị định 13/2023/NĐ-CP */}
            {isPublic && (
              <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50/80 px-3.5 py-2 rounded-xl border border-emerald-200/80">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>Bảo mật dữ liệu theo NĐ 13/2023/NĐ-CP:</strong> Dữ liệu CCCD, SĐT và Mã BHXH đang được tự động che dấu bảo vệ quyền riêng tư cá nhân.
                </span>
              </div>
            )}
          </div>

          {bhxhRecords.length > 0 && (
            <div className={`p-4 sm:p-5 rounded-xl border mb-6 shadow-xs ${isOver10Years ? 'bg-amber-50/90 border-amber-300' : 'bg-emerald-50/80 border-emerald-200'}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Tổng thời gian BHXH tự nguyện đã tích lũy
                  </span>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-xl sm:text-2xl font-black text-[#004182]">{bhxhTimeStr}</span>
                    {isOver10Years ? (
                      <span className="px-2.5 py-0.5 bg-amber-200 text-amber-950 border border-amber-300 text-xs font-black rounded-full uppercase">
                        Đã đủ 10 năm (120/120 tháng)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-950 border border-emerald-300 text-xs font-black rounded-full uppercase">
                        Đã dùng {totalBhxhMonths}/120 tháng hỗ trợ
                      </span>
                    )}
                  </div>
                </div>
                <div className="md:text-right">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                    Trần hỗ trợ NSNN (Khoản 1 Điều 36 Luật BHXH 2024 &amp; NĐ 159/2025)
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-gray-700">
                    {isOver10Years ? (
                      <span className="text-amber-900">
                        ⚠️ Đã hết thời hạn 10 năm hỗ trợ. <strong>Các kỳ tiếp theo đóng 100% mức đóng gốc</strong>.
                      </span>
                    ) : (
                      <span className="text-emerald-900">
                        ✓ Còn lại <strong>{120 - totalBhxhMonths} tháng</strong> được NSNN hỗ trợ mức đóng theo quy định.
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <h4 className="font-bold text-gray-700 mb-3 flex items-center"><History className="mr-2 text-[#FDB913]" size={18} /> Lịch sử tham gia &amp; đóng phí</h4>
          
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {activeResults.map((r, idx) => {
              const incVal = r.income || r.wage;
              const isLatestOfThisType = activeResults.findIndex(res => res.type === r.type && res.paymentStatus !== 'Đã hủy') === idx;
              const todayStr = getLocalYYYYMMDD();
              const thirtyDaysLaterStr = getLocalYYYYMMDD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
              
              const isExpiring = isLatestOfThisType && r.nextPayment && r.nextPayment >= todayStr && r.nextPayment <= thirtyDaysLaterStr;
              const isExpired = isLatestOfThisType && r.nextPayment && r.nextPayment < todayStr;
              
              let statusLabel = r.paymentStatus || 'Đã thu tiền';
              let statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-200";

              if (r.paymentStatus === 'Chờ thanh toán' || r.paymentStatus === 'Chờ thu tiền') {
                statusLabel = "Chờ thanh toán";
                statusClass = "text-amber-700 bg-amber-50 border border-amber-300";
              } else if (r.paymentStatus === 'Đã hủy') {
                statusLabel = "Đã hủy";
                statusClass = "text-red-700 bg-red-50 border border-red-300";
              } else if (r.paymentStatus === 'Đã thoái thu') {
                statusLabel = "Đã thoái thu";
                statusClass = "text-purple-700 bg-purple-50 border border-purple-300";
              } else {
                if (!isLatestOfThisType) {
                  statusLabel = "Kỳ trước (Đã thu)";
                  statusClass = "text-slate-700 bg-slate-100 border border-slate-200";
                } else if (isExpired) {
                  statusLabel = "Đã hết hạn";
                  statusClass = "text-red-700 bg-red-50 border border-red-300";
                } else if (isExpiring) {
                  statusLabel = "Sắp hết hạn";
                  statusClass = "text-orange-700 bg-orange-50 border border-orange-300";
                } else {
                  statusLabel = "Đang hiệu lực";
                  statusClass = "text-emerald-800 bg-emerald-50 border border-emerald-300";
                }
              }

              return (
                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <span className={`font-bold ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-[#0ea5e9]'}`}>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100">
                        {r.type}
                      </span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Thời gian tham gia:</span>
                      <span className="text-gray-800 font-semibold">{r.periodDisplay}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số tháng:</span>
                      <span className="text-gray-800 font-medium">{r.months} tháng</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mức thu nhập:</span>
                      <span className="text-gray-800 font-semibold">{incVal && incVal > 0 ? formatMoney(incVal) : (r.type === 'BHYT' ? 'Theo quy định' : '---')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tổng tiền thanh toán:</span>
                      <span className="text-[#004182] font-black">{r.amount ? formatMoney(r.amount) : '---'}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-gray-500">Phân kỳ &amp; Ghi chú:</span>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {r.method}
                        </span>
                        {r.notes && <p className="text-xs text-gray-600 italic mt-1">{r.notes}</p>}
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hạn tiếp theo:</span>
                      <span className="text-gray-800 font-semibold">{r.nextPayment ? formatDateVN(r.nextPayment) : '---'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#004182] text-white font-semibold whitespace-nowrap">
                  <tr>
                    <th className="p-3">Loại hình</th>
                    <th className="p-3">Thời gian tham gia</th>
                    <th className="p-3">Số tháng</th>
                    <th className="p-3">Mức thu nhập lựa chọn</th>
                    <th className="p-3">Tổng Tiền Thanh Toán (VND)</th>
                    <th className="p-3">Ghi chú &amp; Phân kỳ</th>
                    <th className="p-3">Hạn tiếp theo</th>
                    <th className="p-3">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeResults.map((r, idx) => {
                    const incVal = r.income || r.wage;
                    const isLatestOfThisType = activeResults.findIndex(res => res.type === r.type && res.paymentStatus !== 'Đã hủy') === idx;
                    const todayStr = getLocalYYYYMMDD();
                    const thirtyDaysLaterStr = getLocalYYYYMMDD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                    
                    const isExpiring = isLatestOfThisType && r.nextPayment && r.nextPayment >= todayStr && r.nextPayment <= thirtyDaysLaterStr;
                    const isExpired = isLatestOfThisType && r.nextPayment && r.nextPayment < todayStr;
                    
                    let statusLabel = r.paymentStatus || 'Đã thu tiền';
                    let statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-200";

                    if (r.paymentStatus === 'Chờ thanh toán' || r.paymentStatus === 'Chờ thu tiền') {
                      statusLabel = "Chờ thanh toán";
                      statusClass = "text-amber-700 bg-amber-50 border border-amber-300";
                    } else if (r.paymentStatus === 'Đã hủy') {
                      statusLabel = "Đã hủy";
                      statusClass = "text-red-700 bg-red-50 border border-red-300";
                    } else if (r.paymentStatus === 'Đã thoái thu') {
                      statusLabel = "Đã thoái thu";
                      statusClass = "text-purple-700 bg-purple-50 border border-purple-300";
                    } else {
                      // Đã thu tiền
                      if (!isLatestOfThisType) {
                        statusLabel = "Kỳ trước (Đã thu)";
                        statusClass = "text-slate-700 bg-slate-100 border border-slate-200";
                      } else if (isExpired) {
                        statusLabel = "Đã hết hạn";
                        statusClass = "text-red-700 bg-red-50 border border-red-300";
                      } else if (isExpiring) {
                        statusLabel = "Sắp hết hạn";
                        statusClass = "text-orange-700 bg-orange-50 border border-orange-300";
                      } else {
                        statusLabel = "Đang hiệu lực";
                        statusClass = "text-emerald-800 bg-emerald-50 border border-emerald-300";
                      }
                    }

                    return (
                      <tr key={idx} className="hover:bg-blue-50/40 transition">
                        <td className={`p-3 font-bold ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-[#0ea5e9]'}`}>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100">
                            {r.type}
                          </span>
                        </td>
                        <td className="p-3 text-gray-800 font-semibold whitespace-nowrap">
                          {r.periodDisplay}
                        </td>
                        <td className="p-3 text-gray-700 font-medium whitespace-nowrap">
                          {r.months} tháng
                        </td>
                        <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">
                          {incVal && incVal > 0 ? formatMoney(incVal) : (r.type === 'BHYT' ? 'Theo quy định' : '---')}
                        </td>
                        <td className="p-3 font-black text-[#004182] whitespace-nowrap">
                          {r.amount ? formatMoney(r.amount) : '---'}
                        </td>
                        <td className="p-3 text-xs text-gray-700 max-w-[240px]">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {r.method && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                                  {r.method}
                                </span>
                              )}
                              {r.actionType && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                  {r.actionType}
                                </span>
                              )}
                            </div>
                            {r.notes ? (
                              <span className="text-gray-600 text-xs italic line-clamp-2" title={r.notes}>
                                {r.notes}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">
                          {r.nextPayment ? formatDateVN(r.nextPayment) : '---'}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="p-5 border-t border-gray-200 bg-white flex justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 transition-all">Đóng</button>
        </div>
      </div>
    </div>
  );
};

export default SearchResultModal;
