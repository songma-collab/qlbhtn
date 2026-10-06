import React, { useState } from 'react';
import { ReceiptText, QrCode, Copy, Check, ChevronDown, ChevronUp, CalendarClock } from 'lucide-react';
import { formatMoney } from '../../../utils/helpers';
import { useAppContext } from '../../../context/AppContext';
import {
  DEFAULT_VIETQR_CONFIG,
  buildTransferSyntax,
  generateVietQRUrl,
  VietQRConfig
} from '../../../utils/vietqr';
import { getStoredVietQRConfig } from '../../../utils/settingsHelper';

interface RegisterSummaryProps {
  type: 'BHXH' | 'BHYT';
  isRenew?: boolean;
  bhxhActionType?: 'Tăng mới' | 'Gia hạn';
  commBHXHNewPct?: number;
  commBHXHRenewPct?: number;
  bhxhCalc: any;
  bhytCalc: any;
  bhytMembers: any[];
  customerInfo?: {
    name?: string;
    cccd?: string;
    bhxh?: string;
    phone?: string;
    notes?: string;
  };
  qrConfig?: Partial<VietQRConfig>;
}

const RegisterSummary: React.FC<RegisterSummaryProps> = ({
  type,
  isRenew = false,
  bhxhActionType,
  commBHXHNewPct,
  commBHXHRenewPct,
  bhxhCalc,
  bhytCalc,
  bhytMembers,
  customerInfo,
  qrConfig
}) => {
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  // Lấy cấu hình VietQR hệ thống từ Context hoặc localStorage
  const appContext = (() => {
    try {
      return useAppContext();
    } catch {
      return null;
    }
  })();
  const appSettings = appContext?.settings;
  const storedConfig = getStoredVietQRConfig();

  const effectiveConfig: VietQRConfig = {
    agencyName: qrConfig?.agencyName || appSettings?.agencyName || appSettings?.agency_name || storedConfig.agencyName || DEFAULT_VIETQR_CONFIG.agencyName,
    agencyCode: qrConfig?.agencyCode || appSettings?.agencyCode || appSettings?.agency_code || storedConfig.agencyCode || DEFAULT_VIETQR_CONFIG.agencyCode,
    bankBin: qrConfig?.bankBin || appSettings?.bankBin || appSettings?.bank_bin || storedConfig.bankBin || DEFAULT_VIETQR_CONFIG.bankBin,
    bankId: qrConfig?.bankId || appSettings?.bankId || appSettings?.bank_id || storedConfig.bankId || DEFAULT_VIETQR_CONFIG.bankId,
    bankName: qrConfig?.bankName || appSettings?.bankName || appSettings?.bank_name || storedConfig.bankName || DEFAULT_VIETQR_CONFIG.bankName,
    accountNumber: qrConfig?.accountNumber || qrConfig?.accountNo || appSettings?.accountNumber || appSettings?.account_number || appSettings?.bank_account || storedConfig.accountNumber || DEFAULT_VIETQR_CONFIG.accountNumber,
    accountNo: qrConfig?.accountNo || qrConfig?.accountNumber || appSettings?.accountNumber || appSettings?.account_number || appSettings?.bank_account || storedConfig.accountNo || DEFAULT_VIETQR_CONFIG.accountNo,
    accountHolder: qrConfig?.accountHolder || qrConfig?.accountName || appSettings?.accountHolder || appSettings?.account_holder || appSettings?.bank_owner || storedConfig.accountHolder || DEFAULT_VIETQR_CONFIG.accountHolder,
    accountName: qrConfig?.accountName || qrConfig?.accountHolder || appSettings?.accountHolder || appSettings?.account_holder || appSettings?.bank_owner || storedConfig.accountName || DEFAULT_VIETQR_CONFIG.accountName,
    qrTemplate: qrConfig?.qrTemplate || qrConfig?.template || appSettings?.qrTemplate || appSettings?.qr_template || storedConfig.qrTemplate || DEFAULT_VIETQR_CONFIG.qrTemplate,
    template: qrConfig?.template || qrConfig?.qrTemplate || appSettings?.qrTemplate || appSettings?.qr_template || storedConfig.template || DEFAULT_VIETQR_CONFIG.template
  };

  const totalAmount = type === 'BHXH' ? Number(bhxhCalc.amount) || 0 : Number(bhytCalc.amount) || 0;
  const primaryCode = customerInfo?.bhxh || customerInfo?.cccd || '';
  const primaryName = customerInfo?.name || '';
  const primaryPhone = customerInfo?.phone || '';

  const transferSyntax = buildTransferSyntax(type, primaryCode, primaryName, primaryPhone);
  const qrUrl = totalAmount > 0
    ? generateVietQRUrl({
        bankBin: effectiveConfig.bankBin,
        bankId: effectiveConfig.bankId,
        accountNo: effectiveConfig.accountNo || effectiveConfig.accountNumber,
        accountName: effectiveConfig.accountHolder || effectiveConfig.accountName,
        amount: totalAmount,
        content: transferSyntax,
        template: (effectiveConfig.qrTemplate || effectiveConfig.template || 'compact2') as any
      })
    : '';

  const handleCopySyntax = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(transferSyntax);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Tính toán các mốc thu tiền BHXH theo Luật BHXH 2024
  const incomeVal = Number(bhxhCalc.income) || 1500000;
  const grossMonthly = Math.round(incomeVal * 0.22);
  const povertyStd = appSettings?.povertyStandard || 1500000;
  const totalSuppPct = (Number(bhxhCalc.nnSupport) || 0) + (Number(bhxhCalc.dpSupport) || 0);
  const supportMonthly = Math.round((povertyStd * 0.22) * (totalSuppPct / 100));
  const netMonthly = Math.max(0, grossMonthly - supportMonthly);
  const roadmapData = bhxhCalc.roadmap;

  return (
    <div className="p-5 sm:p-6 bg-blue-50/40 rounded-2xl border border-blue-100/80 shadow-sm space-y-3">
      <h4 className="font-extrabold text-[#004182] text-base sm:text-lg flex items-center gap-2">
        <ReceiptText className="text-[#004182] shrink-0" size={20} />
        Tổng Kết Đăng Ký &amp; Thanh Toán
      </h4>
      <div className="border-t border-blue-200/60 pt-3 pb-2 space-y-2.5 text-xs sm:text-sm text-gray-600">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-500">Gói đăng ký:</span>
          <span className="font-bold text-gray-800">{type === 'BHXH' ? 'BHXH Tự Nguyện' : 'BHYT Hộ Gia Đình'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-500">Kỳ đóng:</span>
          <span className="font-bold text-gray-800">
            {type === 'BHXH' 
              ? `${bhxhCalc.method === 'post_custom' ? bhxhCalc.customMonths : (bhxhCalc.method.startsWith('pre_') ? parseInt(bhxhCalc.method.split('_')[1]) : parseInt(bhxhCalc.method))} tháng` 
              : `${bhytCalc.duration} tháng`}
          </span>
        </div>
        {type === 'BHXH' && (
          <div className="flex justify-between items-center">
            <span className="font-medium text-gray-500">Phân loại hồ sơ:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
              (bhxhActionType || (isRenew ? 'Gia hạn' : 'Tăng mới')) === 'Tăng mới'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-900 border border-amber-200'
            }`}>
              {(bhxhActionType || (isRenew ? 'Gia hạn' : 'Tăng mới')) === 'Tăng mới' ? 'Hồ sơ Tăng mới' : 'Hồ sơ Gia hạn'}
            </span>
          </div>
        )}
        {type === 'BHXH' && (
          <>
            <div className="flex justify-between items-center">
               <span className="font-medium text-gray-500">Mức thu nhập chọn:</span>
              <span className="font-bold text-gray-800">{formatMoney(bhxhCalc.income)}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="font-medium text-gray-500">Mức đóng quy định (22%):</span>
              <span className="font-bold text-gray-800">{formatMoney(bhxhCalc.basePremium)}</span>
            </div>
            {bhxhCalc.previousMonths >= 120 ? (
              <div className="flex justify-between items-center text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-lg">
                <span className="font-medium">Hỗ trợ NSNN (Đã đủ 10 năm):</span>
                <span className="font-extrabold text-amber-900">0 đ (Đóng 100% gốc)</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg">
                <span className="font-medium">
                  Ngân sách NN hỗ trợ {bhxhCalc.supportedMonthsCount > 0 ? `(${bhxhCalc.supportedMonthsCount} tháng)` : ''}:
                </span>
                <span className="font-extrabold">- {formatMoney(bhxhCalc.nnSupportAmount)}</span>
              </div>
            )}
            {bhxhCalc.unsupportedMonthsCount > 0 && bhxhCalc.previousMonths < 120 && (
              <div className="flex justify-between items-center text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-lg text-xs">
                <span className="font-medium">Tháng đóng 100% gốc (vượt trần 120th):</span>
                <span className="font-extrabold">{bhxhCalc.unsupportedMonthsCount} tháng</span>
              </div>
            )}
            {bhxhCalc.dpSupportAmount > 0 && (
              <div className="flex justify-between items-center text-blue-700 bg-blue-50/80 px-2.5 py-1 rounded-lg">
                <span className="font-medium">Địa phương hỗ trợ:</span>
                <span className="font-extrabold">- {formatMoney(bhxhCalc.dpSupportAmount)}</span>
              </div>
            )}
            {bhxhCalc.discountAmount > 0 && (
              <div className="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg">
                <span className="font-medium">Chiết khấu đóng trước:</span>
                <span className="font-extrabold">- {formatMoney(bhxhCalc.discountAmount)}</span>
              </div>
            )}
            {bhxhCalc.penaltyAmount > 0 && (
              <div className="flex justify-between items-center text-rose-700 bg-rose-50/80 px-2.5 py-1 rounded-lg">
                <span className="font-medium">Lãi đóng bù (FV):</span>
                <span className="font-extrabold">+ {formatMoney(bhxhCalc.penaltyAmount)}</span>
              </div>
            )}
          </>
        )}
        {type === 'BHYT' && (
          <>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-500">Số người tham gia:</span>
              <span className="font-bold text-gray-800">{bhytMembers.length} người</span>
            </div>
            {bhytCalc.breakdown && bhytCalc.breakdown.length > 0 && (
              <div className="pt-2 border-t border-gray-200/70 space-y-1.5">
                <span className="font-bold text-[11px] text-gray-500 uppercase tracking-wider block mb-1">Chi tiết đóng từng thành viên:</span>
                {bhytCalc.breakdown.map((b: any, bIdx: number) => (
                  <div key={bIdx} className="flex justify-between items-center text-xs py-0.5">
                    <span className="text-gray-600 truncate max-w-[170px]" title={b.title}>
                      {b.title} <span className="text-gray-400">({b.label} × {b.durationMonths}th)</span>
                    </span>
                    <span className="font-bold text-gray-800">{formatMoney(b.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tổng Tiền */}
      <div className="border-t border-blue-200/60 pt-3 space-y-2">
        <span className="font-extrabold text-gray-700 uppercase tracking-wider text-xs block">
          Tổng Tiền Thanh Toán (VND)
        </span>
        <div className="px-5 py-3 rounded-2xl border-2 border-[#FDB913] bg-white text-right shadow-sm flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400 uppercase">Thực thu:</span>
          <span className="text-2xl sm:text-3xl font-black text-[#004182]">
            {formatMoney(totalAmount)}
          </span>
        </div>
        {type === 'BHXH' && appContext?.currentUser && (() => {
          const effectiveRate = (bhxhActionType || (isRenew ? 'Gia hạn' : 'Tăng mới')) === 'Tăng mới' 
            ? (commBHXHNewPct ?? 5) 
            : (commBHXHRenewPct ?? 3);
          const estimatedComm = Math.round(totalAmount * (effectiveRate / 100));
          return (
            <div className="flex justify-between items-center text-xs text-blue-900 bg-blue-50/90 px-3 py-2 rounded-xl border border-blue-200 shadow-2xs">
              <span className="font-semibold flex items-center gap-1.5">
                <span>Hoa hồng đại lý</span>
                <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                  (bhxhActionType || (isRenew ? 'Gia hạn' : 'Tăng mới')) === 'Tăng mới'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-900'
                }`}>
                  {effectiveRate}%
                </span>
              </span>
              <span className="font-black text-[#004182] text-sm">
                {formatMoney(estimatedComm)}
              </span>
            </div>
          );
        })()}
      </div>

      {/* Phân kỳ & Mốc thu tiền theo Luật BHXH 2024 */}
      {type === 'BHXH' && (
        <div className="border-t border-blue-200/60 pt-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[#004182]">
            <CalendarClock size={15} className="shrink-0 text-[#004182]" />
            <span className="font-black uppercase tracking-wider text-[11px]">
              {roadmapData ? `Phân kỳ thu tiền (${roadmapData.years} năm)` : 'Phân kỳ theo Luật BHXH 2024'}
            </span>
          </div>

          <div className="bg-white border border-blue-200/90 rounded-xl p-2.5 space-y-1.5 text-xs shadow-2xs">
            {roadmapData ? (
              <>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span>10 năm đầu (120th):</span>
                  </span>
                  <span className="font-black text-emerald-700">
                    {formatMoney(roadmapData.first10YearsMonthly)}/tháng
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                    <span>{roadmapData.years - 10} năm sau ({roadmapData.after10YearsMonths}th):</span>
                  </span>
                  <span className="font-black text-blue-900">
                    {formatMoney(roadmapData.after10YearsMonthly)}/tháng
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-900 font-extrabold pt-1.5 border-t border-slate-100">
                  <span>Tổng vốn thực nộp:</span>
                  <span className="text-amber-700 text-sm font-black">
                    {formatMoney(roadmapData.totalContributed)}
                  </span>
                </div>
              </>
            ) : (
              <>
                {bhxhCalc.previousMonths >= 120 ? (
                  <div className="flex items-center justify-between text-amber-900 bg-amber-50 p-1.5 rounded-lg font-bold">
                    <span>Đã đủ 10 năm hỗ trợ (120th):</span>
                    <span className="font-black text-amber-950">{formatMoney(grossMonthly)}/tháng</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span>10 năm đầu (1-120th):</span>
                      </span>
                      <span className="font-black text-emerald-700">
                        {formatMoney(netMonthly)}/tháng
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                        <span>Từ năm 11 trở đi (121th+):</span>
                      </span>
                      <span className="font-black text-blue-900">
                        {formatMoney(grossMonthly)}/tháng
                      </span>
                    </div>
                  </>
                )}
              </>
            )}
            <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-100 leading-tight">
              * Nhà nước hỗ trợ tối đa 10 năm đầu; từ năm thứ 11 nộp 100% gốc theo NĐ 159/2025/NĐ-CP.
            </p>
          </div>
        </div>
      )}

      {/* Ghi chú hồ sơ (Không hiển thị trong form Gia Hạn BHXH Tự Nguyện) */}
      {!(type === 'BHXH' && isRenew) && customerInfo?.notes && customerInfo.notes.trim() !== '' && (
        <div className="border-t border-blue-200/60 pt-2.5 space-y-1 text-xs">
          <span className="font-bold text-gray-500 uppercase tracking-wider block text-[11px]">
            Ghi chú hồ sơ:
          </span>
          <p className="bg-white/85 border border-blue-200/80 p-2.5 rounded-xl text-gray-700 leading-relaxed font-medium">
            {customerInfo.notes}
          </p>
        </div>
      )}

      {/* Tích hợp mã VietQR động */}
      {totalAmount > 0 && (
        <div className="border border-blue-200 rounded-xl bg-white overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setShowQR(!showQR)}
            className="w-full px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100/70 transition flex items-center justify-between text-xs font-bold text-[#004182] cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <QrCode size={16} className="text-blue-600" />
              Xem mã VietQR nộp tiền nhanh (NAPAS 247)
            </span>
            {showQR ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showQR && (
            <div className="p-3.5 space-y-2.5 bg-white border-t border-blue-100 text-xs animate-in fade-in duration-150">
              <div className="flex justify-center bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                <img
                  src={qrUrl}
                  alt="VietQR nộp tiền"
                  className="w-48 h-auto object-contain rounded-lg shadow-xs"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="space-y-1 text-[11px] text-slate-600">
                <div className="flex justify-between">
                  <span>Ngân hàng:</span>
                  <span className="font-bold text-slate-800">{effectiveConfig.bankName || effectiveConfig.bankId}</span>
                </div>
                <div className="flex justify-between">
                  <span>STK đại lý:</span>
                  <span className="font-mono font-bold text-slate-800">{effectiveConfig.accountNo || effectiveConfig.accountNumber}</span>
                </div>
                {(effectiveConfig.accountHolder || effectiveConfig.accountName) && (
                  <div className="flex justify-between">
                    <span>Chủ tài khoản:</span>
                    <span className="font-bold text-slate-800 uppercase">{effectiveConfig.accountHolder || effectiveConfig.accountName}</span>
                  </div>
                )}
                <div className="pt-1">
                  <span className="font-semibold block mb-0.5">Cú pháp chuyển khoản:</span>
                  <div className="flex items-center justify-between bg-amber-50 p-1.5 rounded border border-amber-200 font-mono font-bold text-slate-800 text-[10px]">
                    <span className="truncate pr-1">{transferSyntax}</span>
                    <button
                      type="button"
                      onClick={handleCopySyntax}
                      className="shrink-0 text-blue-600 hover:text-blue-800 flex items-center gap-0.5 px-1 py-0.5 rounded bg-white border border-blue-200"
                    >
                      {copied ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                      {copied ? 'Đã chép' : 'Chép'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RegisterSummary;
