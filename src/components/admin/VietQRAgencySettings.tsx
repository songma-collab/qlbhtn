import React, { useState, useEffect } from 'react';
import { 
  QrCode, Building2, CreditCard, User, Hash, CheckCircle, 
  AlertTriangle, ShieldCheck, RefreshCw, Save, Eye, Copy, Check
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { 
  POPULAR_VIETNAMESE_BANKS, 
  DEFAULT_VIETQR_CONFIG, 
  generateVietQRUrl, 
  removeVietnameseTones, 
  validateBankAccount,
  buildTransferSyntax,
  VietQRConfig
} from '../../utils/vietqr';
import { checkVietQRSettingsPermission } from '../../utils/security';
import { formatMoney } from '../../utils/helpers';
import ConfirmModal from '../modals/ConfirmModal';

export const VietQRAgencySettings: React.FC = () => {
  const { settings, updateSettings, addAuditLog, showToast, currentUser } = useAppContext();

  const permission = checkVietQRSettingsPermission(currentUser);
  const isAdmin = permission.allowed;

  // Local Form State
  const [formData, setFormData] = useState<VietQRConfig>({
    agencyName: settings?.agencyName || settings?.agency_name || DEFAULT_VIETQR_CONFIG.agencyName,
    agencyCode: settings?.agencyCode || settings?.agency_code || DEFAULT_VIETQR_CONFIG.agencyCode,
    bankBin: settings?.bankBin || settings?.bank_bin || DEFAULT_VIETQR_CONFIG.bankBin,
    bankId: settings?.bankId || settings?.bank_id || DEFAULT_VIETQR_CONFIG.bankId,
    bankName: settings?.bankName || settings?.bank_name || DEFAULT_VIETQR_CONFIG.bankName,
    accountNumber: settings?.accountNumber || settings?.account_number || settings?.bank_account || DEFAULT_VIETQR_CONFIG.accountNumber,
    accountHolder: settings?.accountHolder || settings?.account_holder || settings?.bank_owner || DEFAULT_VIETQR_CONFIG.accountHolder,
    qrTemplate: settings?.qrTemplate || settings?.qr_template || DEFAULT_VIETQR_CONFIG.qrTemplate
  });

  // Đồng bộ khi settings từ AppContext thay đổi
  useEffect(() => {
    if (settings) {
      setFormData({
        agencyName: settings.agencyName || settings.agency_name || DEFAULT_VIETQR_CONFIG.agencyName,
        agencyCode: settings.agencyCode || settings.agency_code || DEFAULT_VIETQR_CONFIG.agencyCode,
        bankBin: settings.bankBin || settings.bank_bin || DEFAULT_VIETQR_CONFIG.bankBin,
        bankId: settings.bankId || settings.bank_id || DEFAULT_VIETQR_CONFIG.bankId,
        bankName: settings.bankName || settings.bank_name || DEFAULT_VIETQR_CONFIG.bankName,
        accountNumber: settings.accountNumber || settings.account_number || settings.bank_account || DEFAULT_VIETQR_CONFIG.accountNumber,
        accountHolder: settings.accountHolder || settings.account_holder || settings.bank_owner || DEFAULT_VIETQR_CONFIG.accountHolder,
        qrTemplate: settings.qrTemplate || settings.qr_template || DEFAULT_VIETQR_CONFIG.qrTemplate
      });
    }
  }, [settings]);

  const [isSaving, setIsSaving] = useState(false);
  const [accountValidation, setAccountValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Mẫu xem trước: 1.000.000đ đóng thử
  const previewAmount = 1000000;
  const previewContent = buildTransferSyntax('BHXH', '0141930150', 'NGUYEN VAN A', '0912345678');

  const previewQrUrl = generateVietQRUrl({
    bankBin: formData.bankBin,
    bankId: formData.bankId,
    accountNo: formData.accountNumber,
    accountNumber: formData.accountNumber,
    accountHolder: formData.accountHolder,
    accountName: formData.accountHolder,
    amount: previewAmount,
    content: previewContent,
    qrTemplate: formData.qrTemplate
  });

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedBin = e.target.value;
    const foundBank = POPULAR_VIETNAMESE_BANKS.find(b => b.bin === selectedBin);
    if (foundBank) {
      setFormData(prev => ({
        ...prev,
        bankBin: foundBank.bin,
        bankId: foundBank.shortName,
        bankName: foundBank.name
      }));
    }
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 20);
    setFormData(prev => ({ ...prev, accountNumber: val, accountNo: val }));
    if (accountValidation) setAccountValidation(null);
  };

  const handleHolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uppercaseNoTone = removeVietnameseTones(e.target.value).toUpperCase();
    setFormData(prev => ({ ...prev, accountHolder: uppercaseNoTone, accountName: uppercaseNoTone }));
  };

  const handleCheckAccountValid = () => {
    const res = validateBankAccount(formData.accountNumber);
    setAccountValidation(res);
    if (res.valid) {
      showToast?.('Số tài khoản hợp lệ (từ 6 đến 20 chữ số).', 'success');
    } else {
      showToast?.(res.error || 'Số tài khoản không hợp lệ', 'error');
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    showToast?.(`Đã sao chép ${fieldName}!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      showToast?.(permission.reason || 'Bạn không có quyền thực hiện thao tác này.', 'error');
      return;
    }

    const valRes = validateBankAccount(formData.accountNumber);
    if (!valRes.valid) {
      setAccountValidation(valRes);
      showToast?.(valRes.error || 'Số tài khoản không hợp lệ', 'error');
      return;
    }

    if (!formData.accountHolder || formData.accountHolder.trim().length < 3) {
      showToast?.('Tên chủ tài khoản thụ hưởng phải từ 3 ký tự trở lên.', 'error');
      return;
    }

    // Kiểm tra xem số tài khoản hoặc ngân hàng có bị đổi so với settings hiện tại
    const currentAccount = settings?.accountNumber || settings?.bank_account || DEFAULT_VIETQR_CONFIG.accountNumber;
    const currentBank = settings?.bankBin || settings?.bank_bin || DEFAULT_VIETQR_CONFIG.bankBin;

    const hasBankOrAccountChange = 
      formData.accountNumber !== currentAccount || 
      formData.bankBin !== currentBank;

    if (hasBankOrAccountChange) {
      setIsConfirmModalOpen(true);
    } else {
      executeSave();
    }
  };

  const executeSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        agencyName: formData.agencyName?.trim() || 'Đại lý thu BHXH Sông Mã',
        agencyCode: formData.agencyCode?.trim() || 'VSS-SM-001',
        bankBin: formData.bankBin || '970422',
        bankId: formData.bankId || 'MB',
        bankName: formData.bankName || 'MB (Ngân hàng Quân Đội)',
        accountNumber: formData.accountNumber?.trim() || '',
        accountNo: formData.accountNumber?.trim() || '',
        accountHolder: formData.accountHolder?.trim() || '',
        accountName: formData.accountHolder?.trim() || '',
        qrTemplate: formData.qrTemplate || 'compact2',
        // Alias tương thích
        agency_name: formData.agencyName?.trim() || 'Đại lý thu BHXH Sông Mã',
        agency_code: formData.agencyCode?.trim() || 'VSS-SM-001',
        bank_bin: formData.bankBin || '970422',
        bank_name: formData.bankName || 'MB (Ngân hàng Quân Đội)',
        account_number: formData.accountNumber?.trim() || '',
        account_holder: formData.accountHolder?.trim() || '',
        qr_template: formData.qrTemplate || 'compact2',
        bank_id: formData.bankId || 'MB',
        bank_account: formData.accountNumber?.trim() || '',
        bank_owner: formData.accountHolder?.trim() || ''
      };

      const success = await updateSettings(payload);

      if (success) {
        if (addAuditLog) {
          await addAuditLog(
            'Cập nhật VietQR',
            `Cập nhật cấu hình VietQR Đại lý: ${payload.agencyName} (${payload.agencyCode}) - Ngân hàng: ${payload.bankName}, STK: ${payload.accountNumber}, Chủ TK: ${payload.accountHolder}`
          );
        }
        showToast?.('Đã lưu cấu hình tài khoản VietQR Đại lý thành công!', 'success');
      } else {
        showToast?.('Không thể cập nhật cấu hình. Vui lòng kiểm tra quyền hạn kết nối Supabase.', 'error');
      }
    } catch (err: any) {
      showToast?.('Lỗi khi lưu cấu hình: ' + (err?.message || 'Không xác định'), 'error');
    } finally {
      setIsSaving(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleResetToDefault = () => {
    if (!isAdmin) return;
    setFormData({
      ...DEFAULT_VIETQR_CONFIG
    });
    setAccountValidation(null);
    showToast?.('Đã đặt lại biểu mẫu về thông số mặc định. Nhấn "Lưu Thay Đổi" để áp dụng.', 'info');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Banner cảnh báo quyền hạn nếu không phải Admin */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-amber-800 text-xs">
          <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-bold">Chế độ Chỉ Đọc (Read-Only): </span>
            {permission.reason || 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa cấu hình tài khoản ngân hàng thụ hưởng VietQR.'}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: FORM CÀI ĐẶT */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                <CreditCard size={18} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">
                  Cấu Hình Tài Khoản Nhận Tiền Đại Lý
                </h3>
                <p className="text-xs text-slate-500">
                  Chuẩn VietQR NAPAS 247 • Tự động nhận tiền đóng BHXH & BHYT
                </p>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Khôi phục giá trị mặc định"
              >
                <RefreshCw size={13} />
                <span>Mặc định</span>
              </button>
            )}
          </div>

          <form onSubmit={handlePreSubmit} className="space-y-4 text-xs">
            {/* 1. Tên đơn vị thu & Mã điểm thu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  Tên Đơn Vị / Điểm Thu:
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.agencyName || ''}
                  onChange={e => setFormData(prev => ({ ...prev, agencyName: e.target.value }))}
                  placeholder="Ví dụ: Đại lý thu BHXH Sông Mã"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition disabled:opacity-60"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400" />
                  Mã Điểm Thu:
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.agencyCode || ''}
                  onChange={e => setFormData(prev => ({ ...prev, agencyCode: e.target.value.toUpperCase() }))}
                  placeholder="VSS-SM-001"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition disabled:opacity-60"
                  required
                />
              </div>
            </div>

            {/* 2. Ngân hàng thụ hưởng */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CreditCard size={14} className="text-slate-400" />
                  Ngân Hàng Thụ Hưởng (Chuẩn NAPAS):
                </span>
                <span className="text-[11px] font-mono text-blue-600 font-bold">
                  BIN: {formData.bankBin}
                </span>
              </label>
              <select
                disabled={!isAdmin}
                value={formData.bankBin}
                onChange={handleBankChange}
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer disabled:opacity-60"
              >
                {POPULAR_VIETNAMESE_BANKS.map(b => (
                  <option key={b.bin} value={b.bin}>
                    {b.shortName} - {b.name} (BIN: {b.bin})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Số tài khoản đại lý */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400" />
                  Số Tài Khoản Nhận Tiền:
                </label>
                <button
                  type="button"
                  onClick={handleCheckAccountValid}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                >
                  Kiểm tra định dạng
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={formData.accountNumber || ''}
                  onChange={handleAccountChange}
                  placeholder="Nhập số tài khoản từ 6 - 20 chữ số..."
                  className={`w-full px-3 py-2 bg-slate-50 focus:bg-white border rounded-xl font-mono text-base font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition disabled:opacity-60 ${
                    accountValidation 
                      ? accountValidation.valid 
                        ? 'border-emerald-500 text-emerald-700' 
                        : 'border-rose-400 text-rose-700'
                      : 'border-slate-200'
                  }`}
                  required
                />
                {accountValidation?.valid && (
                  <CheckCircle size={16} className="absolute right-3 top-2.5 text-emerald-600" />
                )}
              </div>
              {accountValidation && !accountValidation.valid && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {accountValidation.error}
                </p>
              )}
            </div>

            {/* 4. Chủ tài khoản thụ hưởng */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  Chủ Tài Khoản (In hoa không dấu):
                </span>
                <span className="text-[10px] text-slate-400">
                  Tự động chuẩn hóa HOA không dấu
                </span>
              </label>
              <input
                type="text"
                disabled={!isAdmin}
                value={formData.accountHolder || ''}
                onChange={handleHolderChange}
                placeholder="Ví dụ: DAI LY THU BHXH SONG MA"
                className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition disabled:opacity-60 uppercase"
                required
              />
            </div>

            {/* 5. Mẫu khung hiển thị VietQR */}
            <div className="space-y-1.5 pt-1">
              <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                <QrCode size={14} className="text-slate-400" />
                Mẫu Khung VietQR Hiển Thị:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'compact2', label: 'Chuẩn Napas (compact2)', desc: 'Đầy đủ logo ngân hàng & Napas' },
                  { id: 'compact', label: 'Khung Gọn (compact)', desc: 'Khung viền tối giản' },
                  { id: 'qr_only', label: 'Chỉ Mã QR (qr_only)', desc: 'Mã vuông thuần túy' }
                ].map(tmpl => {
                  const isSelected = (formData.qrTemplate || 'compact2') === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => setFormData(prev => ({ ...prev, qrTemplate: tmpl.id }))}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer disabled:opacity-60 ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/60 text-blue-900 font-bold ring-1 ring-blue-600' 
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold text-xs">{tmpl.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{tmpl.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nút Submit */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={!isAdmin || isSaving}
                className="w-full py-2.5 px-4 bg-[#004182] hover:bg-[#003166] text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Đang lưu cấu hình vào Supabase...
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    Lưu Thay Đổi Cấu Hình VietQR
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* CỘT PHẢI: LIVE PREVIEW & QUÉT THỬ THỰC TẾ */}
        <div className="xl:col-span-5 bg-gradient-to-b from-slate-50 to-blue-50/30 rounded-2xl border border-blue-100 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
            <div className="flex items-center gap-2">
              <Eye size={16} className="text-blue-700" />
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">
                Xem Trước Thực Tế (Live Preview)
              </h4>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              Thử Nghiệm Trực Tiếp
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Mã VietQR bên dưới được kết nối trực tiếp từ cấu hình trên. Admin có thể mở App ngân hàng quét thử ngay để xác minh tài khoản nhận tiền.
          </p>

          {/* Card Mockup */}
          <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 flex flex-col items-center space-y-3">
            <div className="text-center">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                {formData.agencyName}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Mã ĐL: {formData.agencyCode}
              </p>
            </div>

            {/* QR Image */}
            <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 max-w-[240px] w-full flex justify-center">
              <img
                src={previewQrUrl}
                alt="VietQR Live Preview"
                className="w-full h-auto max-h-[260px] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Mock Payment Details */}
            <div className="w-full space-y-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Ngân hàng:</span>
                <span className="font-bold text-slate-800">{formData.bankName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số tài khoản:</span>
                <div className="flex items-center gap-1 font-mono font-bold text-blue-700">
                  <span>{formData.accountNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(formData.accountNumber || '', 'Số tài khoản')}
                    className="p-0.5 hover:bg-slate-200 rounded text-slate-600 transition"
                  >
                    {copiedField === 'Số tài khoản' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Chủ tài khoản:</span>
                <span className="font-bold text-slate-800">{formData.accountHolder}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Số tiền mẫu:</span>
                <span className="font-black text-rose-600">{formatMoney(previewAmount)}</span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-200">
                <span className="text-slate-500 text-[10px]">Cú pháp chuyển khoản mẫu:</span>
                <span className="font-mono font-bold text-[10px] text-slate-800 bg-white p-1 rounded border border-slate-200 truncate">
                  {previewContent}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
              <ShieldCheck size={13} className="shrink-0 text-emerald-600" />
              Chuẩn NAPAS 247 • Chuyển nhanh liên ngân hàng 24/7
            </div>
          </div>
        </div>
      </div>

      {/* Modal Xác nhận Đổi Ngân hàng / STK để phòng tránh rủi ro */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        title="Xác Nhận Thay Đổi Tài Khoản Ngân Hàng Đại Lý"
        message={`Bạn đang thay đổi Số tài khoản hoặc Ngân hàng thụ hưởng nhận tiền đóng BHXH/BHYT của Đại lý sang: "${formData.bankName} - STK: ${formData.accountNumber} - Chủ TK: ${formData.accountHolder}". Toàn bộ mã QR sinh ra cho khách hàng sẽ lập tức chuyển sang tài khoản mới này. Bạn có chắc chắn muốn áp dụng thay đổi?`}
        confirmText="Xác Nhận Thay Đổi"
        cancelText="Hủy Bỏ"
        variant="warning"
        onConfirm={executeSave}
        onClose={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
};

export default VietQRAgencySettings;
