import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Download, Send, ShieldCheck } from 'lucide-react';
import { formatMoney } from '../../utils/helpers';
import { useAppContext } from '../../context/AppContext';
import {
  DEFAULT_VIETQR_CONFIG,
  buildTransferSyntax,
  generateVietQRUrl,
  buildZaloReminderMessage,
  CustomerReminderInfo,
  VietQRConfig
} from '../../utils/vietqr';

export interface VietQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  showToast?: (msg: string) => void;
  staffList?: any[];
  qrConfig?: Partial<VietQRConfig>;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  isOpen,
  onClose,
  record,
  showToast,
  staffList = [],
  qrConfig
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Lấy cấu hình hệ thống từ Context (nếu có)
  const appContext = (() => {
    try {
      return useAppContext();
    } catch {
      return null;
    }
  })();
  const appSettings = appContext?.settings;

  if (!isOpen || !record) return null;

  // Tính cấu hình hiệu lực kết hợp giữa prop truyền vào, settings từ DB và mặc định
  const effectiveConfig: VietQRConfig = {
    agencyName: qrConfig?.agencyName || appSettings?.agencyName || appSettings?.agency_name || DEFAULT_VIETQR_CONFIG.agencyName,
    agencyCode: qrConfig?.agencyCode || appSettings?.agencyCode || appSettings?.agency_code || DEFAULT_VIETQR_CONFIG.agencyCode,
    bankBin: qrConfig?.bankBin || appSettings?.bankBin || appSettings?.bank_bin || DEFAULT_VIETQR_CONFIG.bankBin,
    bankId: qrConfig?.bankId || appSettings?.bankId || appSettings?.bank_id || DEFAULT_VIETQR_CONFIG.bankId,
    bankName: qrConfig?.bankName || appSettings?.bankName || appSettings?.bank_name || DEFAULT_VIETQR_CONFIG.bankName,
    accountNumber: qrConfig?.accountNumber || qrConfig?.accountNo || appSettings?.accountNumber || appSettings?.account_number || appSettings?.bank_account || DEFAULT_VIETQR_CONFIG.accountNumber,
    accountNo: qrConfig?.accountNo || qrConfig?.accountNumber || appSettings?.accountNumber || appSettings?.account_number || appSettings?.bank_account || DEFAULT_VIETQR_CONFIG.accountNo,
    accountHolder: qrConfig?.accountHolder || qrConfig?.accountName || appSettings?.accountHolder || appSettings?.account_holder || appSettings?.bank_owner || DEFAULT_VIETQR_CONFIG.accountHolder,
    accountName: qrConfig?.accountName || qrConfig?.accountHolder || appSettings?.accountHolder || appSettings?.account_holder || appSettings?.bank_owner || DEFAULT_VIETQR_CONFIG.accountName,
    qrTemplate: qrConfig?.qrTemplate || qrConfig?.template || appSettings?.qrTemplate || appSettings?.qr_template || DEFAULT_VIETQR_CONFIG.qrTemplate,
    template: qrConfig?.template || qrConfig?.qrTemplate || appSettings?.qrTemplate || appSettings?.qr_template || DEFAULT_VIETQR_CONFIG.template
  };

  const staffObj = staffList.find(s => s.id === record.staffId);
  const staffName = staffObj?.name || record.staffId || 'Đại lý';
  const staffPhone = staffObj?.phone || '';

  const shortType = record.type === 'BHYT' ? 'BHYT' : 'BHXH';
  const code = (record.bhxh || record.cccd || '').trim();
  const amount = Number(record.amount) || 0;

  const transferSyntax = buildTransferSyntax(shortType, code, record.name, record.phone);

  const qrUrl = generateVietQRUrl({
    bankBin: effectiveConfig.bankBin,
    bankId: effectiveConfig.bankId,
    accountNo: effectiveConfig.accountNumber,
    accountNumber: effectiveConfig.accountNumber,
    accountName: effectiveConfig.accountHolder,
    accountHolder: effectiveConfig.accountHolder,
    amount,
    content: transferSyntax,
    qrTemplate: effectiveConfig.qrTemplate
  });

  const reminderInfo: CustomerReminderInfo = {
    name: record.name || 'Khách hàng',
    phone: record.phone || '',
    type: shortType,
    code,
    amount,
    nextPayment: record.nextPayment || record.date || '',
    months: Number(record.months) || 12,
    daysRemaining: 0, // Current transaction
    staffName,
    staffPhone
  };

  const zaloData = buildZaloReminderMessage(reminderInfo, effectiveConfig);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    if (showToast) showToast(`Đã sao chép ${fieldName}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadQR = async () => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `VietQR_${shortType}_${(record.name || 'KH').replace(/\s+/g, '_')}_${amount}d.png`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      if (showToast) showToast('Đã tải mã VietQR thành công!');
    } catch (err) {
      window.open(qrUrl, '_blank');
    }
  };

  const handleOpenZalo = () => {
    navigator.clipboard.writeText(zaloData.content);
    if (showToast) showToast('Đã sao chép nội dung tin nhắn đôn đốc!');
    if (zaloData.zaloLink) {
      window.open(zaloData.zaloLink, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-[400] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                Mã Thanh Toán VietQR NAPAS 247
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                  Tự động
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {effectiveConfig.agencyName} • Mã ĐL: {effectiveConfig.agencyCode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-blue-50/50 to-slate-50 p-4 rounded-2xl border border-blue-100/60 shadow-inner">
          <div className="bg-white p-2.5 rounded-2xl shadow-md border border-slate-200 max-w-[280px] w-full flex justify-center">
            <img
              src={qrUrl}
              alt="VietQR Payment Code"
              className="w-full h-auto max-h-[320px] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5 text-center flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            Quét mã bằng ứng dụng ngân hàng hoặc ví điện tử (chuyển nhanh 24/7)
          </p>
        </div>

        {/* Payment Details */}
        <div className="space-y-2.5 text-xs text-slate-700">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Người nộp tiền:</span>
              <span className="font-bold text-slate-800">{record.name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Mã BHXH / CCCD:</span>
              <span className="font-bold text-slate-800">{code || '---'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Ngân hàng thụ hưởng:</span>
              <span className="font-bold text-blue-700">{effectiveConfig.bankName || effectiveConfig.bankId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Số tài khoản đại lý:</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                <span>{effectiveConfig.accountNumber}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(effectiveConfig.accountNumber || '', 'Số tài khoản')}
                  className="p-1 hover:bg-slate-200 rounded text-slate-600 transition"
                  title="Sao chép STK"
                >
                  {copiedField === 'Số tài khoản' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Chủ tài khoản:</span>
              <span className="font-bold text-slate-800">{effectiveConfig.accountHolder}</span>
            </div>
          </div>

          {/* Amount & Syntax Box */}
          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-amber-900 uppercase text-[11px]">Số tiền thanh toán:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-rose-700">{formatMoney(amount)}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(String(amount), 'Số tiền')}
                  className="p-1 hover:bg-amber-100 rounded text-amber-700 transition"
                  title="Sao chép số tiền"
                >
                  {copiedField === 'Số tiền' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
            <div>
              <span className="font-bold text-slate-700 text-[11px] block mb-1">
                Cú pháp chuyển khoản chuẩn (bắt buộc):
              </span>
              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 font-mono font-bold text-slate-800 text-xs">
                <span className="truncate pr-2">{transferSyntax}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(transferSyntax, 'Cú pháp chuyển khoản')}
                  className="shrink-0 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 px-2 py-0.5 rounded text-[11px] font-sans font-bold transition"
                >
                  {copiedField === 'Cú pháp chuyển khoản' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  Sao chép
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleDownloadQR}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer"
          >
            <Download size={15} /> Tải Ảnh VietQR
          </button>

          <button
            type="button"
            onClick={handleOpenZalo}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm cursor-pointer"
          >
            <Send size={15} /> Gửi Zalo Kèm QR
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer border-none"
        >
          Đóng cửa sổ
        </button>
      </div>
    </div>
  );
};

export default VietQRModal;
