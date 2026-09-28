import React from 'react';
import { Search, History, X } from 'lucide-react';
import { formatMonthVN, formatDateVN, getLocalYYYYMMDD, formatMoney } from '../../utils/helpers';
import { parseMonthAndYear } from '../../utils/dateStandardHelper';

interface SearchResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: any[];
  searchCode: string;
}

const SearchResultModal: React.FC<SearchResultModalProps> = ({ isOpen, onClose, results, searchCode }) => {
  if (!isOpen) return null;

  // Filter out incomplete shell records (must have BOTH fromMonth & toMonth OR amount > 0) if other valid records exist
  const displayResults = (results || []).filter(r => {
    if (r.paymentStatus === 'Đã hủy') return false;
    const hasFullPeriod = Boolean(r.fromMonth && r.toMonth);
    const hasAmount = Number(r.amount) > 0;
    if (!hasFullPeriod && !hasAmount && results.length > 1) return false;
    return true;
  });

  const activeResults = displayResults.length > 0 ? displayResults : results;

  // Thống kê quá trình tham gia BHXH tự nguyện và hạn mức hỗ trợ NSNN 10 năm (từ 01/2018)
  const bhxhRecords = (activeResults || []).filter(r => r.type === 'BHXH' && r.paymentStatus !== 'Đã hủy');
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
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 font-semibold mb-1">Khách hàng</p>
              <p className="text-xl font-extrabold text-[#004182] uppercase">{activeResults[0]?.name ? activeResults[0]?.name.split(' (+')[0] : '---'}</p>
            </div>
            <div className="md:text-right">
              <p className="text-sm text-gray-500 font-semibold mb-1">Số ĐDCN / CCCD</p>
              <p className="text-lg font-bold text-[#0ea5e9]">{searchCode}</p>
            </div>
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

          <h4 className="font-bold text-gray-700 mb-3 flex items-center"><History className="mr-2 text-[#FDB913]" size={18} /> Lịch sử tham gia & đóng phí</h4>
          
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {activeResults.map((r, idx) => {
              const periodStr = (r.fromMonth && r.toMonth) ? `${formatMonthVN(r.fromMonth)} - ${formatMonthVN(r.toMonth)}` : '---';
              
              // Only check for "Expiring" on the latest record of each type in the results
              const isLatestOfThisType = activeResults.findIndex(res => res.type === r.type && res.paymentStatus !== 'Đã hủy') === idx;
              const todayStr = getLocalYYYYMMDD();
              const thirtyDaysLaterStr = getLocalYYYYMMDD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
              
              const isExpiring = isLatestOfThisType && r.nextPayment && r.nextPayment >= todayStr && r.nextPayment <= thirtyDaysLaterStr;
              const isExpired = isLatestOfThisType && r.nextPayment && r.nextPayment < todayStr;
              
              let statusLabel = r.paymentStatus;
              let statusClass = "text-green-600 bg-green-50";
              if (r.paymentStatus === 'Chờ thanh toán') statusClass = "text-amber-600 bg-amber-50";
              if (r.paymentStatus === 'Đã hủy') statusClass = "text-red-600 bg-red-50";

              if (!isLatestOfThisType && r.paymentStatus === 'Đã thu tiền') {
                statusLabel = "Khách hàng cũ";
                statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-100";
              } else if (isExpired && r.paymentStatus === 'Đã thu tiền') {
                statusLabel = "Đã hết hạn";
                statusClass = "text-red-600 bg-red-50 border border-red-200";
              } else if (isExpiring && r.paymentStatus === 'Đã thu tiền') {
                statusLabel = "Sắp hết hạn";
                statusClass = "text-orange-600 bg-orange-50 border border-orange-200";
              }

              return (
                <div key={idx} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                  <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                    <span className={`font-bold ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-[#0ea5e9]'}`}>{r.type}</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Thời gian:</span>
                      <span className="text-gray-800 font-medium">{periodStr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Số tháng:</span>
                      <span className="text-gray-800 font-medium">{r.months} tháng</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mức thu nhập lựa chọn:</span>
                      <span className="text-gray-800 font-semibold">{(r.income || r.wage) && (r.income || r.wage) > 0 ? formatMoney(r.income || r.wage) : '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tổng tiền thanh toán:</span>
                      <span className="text-[#004182] font-bold">{r.amount ? formatMoney(r.amount) : '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hạn tiếp theo:</span>
                      <span className="text-gray-800 font-semibold">{formatDateVN(r.nextPayment)}</span>
                    </div>
                    {r.notes && (
                      <div className="pt-2 border-t border-gray-100 text-xs flex items-start gap-1">
                        <span className="text-gray-500 font-bold shrink-0">Ghi chú:</span>
                        <span className="text-gray-800 font-medium italic">{r.notes}</span>
                      </div>
                    )}
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
                    const periodStr = (r.fromMonth && r.toMonth) ? `${formatMonthVN(r.fromMonth)} - ${formatMonthVN(r.toMonth)}` : '---';
                    const incVal = r.income || r.wage;
                    
                    // Only check for "Expiring" on the latest record of each type in the results
                    const isLatestOfThisType = activeResults.findIndex(res => res.type === r.type && res.paymentStatus !== 'Đã hủy') === idx;
                    const todayStr = getLocalYYYYMMDD();
                    const thirtyDaysLaterStr = getLocalYYYYMMDD(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                    
                    const isExpiring = isLatestOfThisType && r.nextPayment && r.nextPayment >= todayStr && r.nextPayment <= thirtyDaysLaterStr;
                    const isExpired = isLatestOfThisType && r.nextPayment && r.nextPayment < todayStr;
                    
                    let statusLabel = r.paymentStatus;
                    let statusClass = "text-green-600 bg-green-50";
                    if (r.paymentStatus === 'Chờ thanh toán') statusClass = "text-amber-600 bg-amber-50";
                    if (r.paymentStatus === 'Đã hủy') statusClass = "text-red-600 bg-red-50";

                    if (!isLatestOfThisType && r.paymentStatus === 'Đã thu tiền') {
                      statusLabel = "Khách hàng cũ";
                      statusClass = "text-emerald-700 bg-emerald-50 border border-emerald-100";
                    } else if (isExpired && r.paymentStatus === 'Đã thu tiền') {
                      statusLabel = "Đã hết hạn";
                      statusClass = "text-red-600 bg-red-50 border border-red-200";
                    } else if (isExpiring && r.paymentStatus === 'Đã thu tiền') {
                      statusLabel = "Sắp hết hạn";
                      statusClass = "text-orange-600 bg-orange-50 border border-orange-200";
                    }

                    return (
                      <tr key={idx} className="hover:bg-gray-100 transition">
                        <td className={`p-3 font-bold ${r.type === 'BHXH' ? 'text-[#004182]' : 'text-[#0ea5e9]'}`}>{r.type}</td>
                        <td className="p-3 text-gray-700 whitespace-nowrap">{periodStr}</td>
                        <td className="p-3 text-gray-600 font-medium whitespace-nowrap">{r.months} tháng</td>
                        <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">{incVal && incVal > 0 ? formatMoney(incVal) : '---'}</td>
                        <td className="p-3 font-bold text-[#004182] whitespace-nowrap">{r.amount ? formatMoney(r.amount) : '---'}</td>
                        <td className="p-3 text-xs text-gray-700 max-w-[220px]" title={r.notes || ''}>
                          {r.notes ? (
                            <span className="bg-gray-50 border border-gray-200/80 px-2 py-1 rounded-md block truncate">
                              {r.notes}
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">---</span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-gray-800 whitespace-nowrap">{formatDateVN(r.nextPayment)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${statusClass}`}>{statusLabel}</span>
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
