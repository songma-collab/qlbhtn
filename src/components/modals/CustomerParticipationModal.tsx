import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import {
  X,
  History,
  Plus,
  Trash2,
  Camera,
  FileDown,
  Download,
  Calculator,
  Save,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Shield,
  Briefcase,
  Building,
  UserCheck
} from 'lucide-react';
import type { CustomerType, CustomerParticipationPeriod } from '../../context/types';
import { calculateMonthsFromPeriods } from '../../utils/calculations';
import { compressImageForOcr, normalizeOcrPeriods, PeriodItem } from '../../utils/ocrHelper';
import { callGeminiOcrClientSide } from '../../utils/geminiFallback';
import { protectWorksheetFormulas, validateExcelFile } from '../../utils/excelSecurity';
import { extractAgencyPeriods } from '../../utils/customerParticipationHelper';
import { formatMonthInput, parseMonthAndYear, normalizePeriod, parseToIsoMonthDate } from '../../utils/dateStandardHelper';
import { participationPeriodDateSchema, formatMonthInputMask } from '../../utils/dateFormatter';

interface CustomerParticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerType | any | null;
  onSaved?: () => void;
}

export const CustomerParticipationModal: React.FC<CustomerParticipationModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSaved
}) => {
  const {
    records,
    updateCustomerParticipation,
    showToast,
    showAlert,
    currentUser
  } = useAppContext() as any;

  const navigate = useNavigate();

  const [periods, setPeriods] = useState<CustomerParticipationPeriod[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  // Khởi tạo dữ liệu khi mở modal
  useEffect(() => {
    if (!isOpen || !customer) return;

    const existingPeriods: CustomerParticipationPeriod[] = customer.prior_periods && Array.isArray(customer.prior_periods) && customer.prior_periods.length > 0
      ? customer.prior_periods.map(p => normalizePeriod({
          ...p,
          id: p.id || (Date.now() + Math.random())
        }))
      : [];

    if (existingPeriods.length === 0) {
      // Nếu chưa có giai đoạn nào, tạo 1 dòng mặc định
      const currentYear = new Date().getFullYear();
      existingPeriods.push(normalizePeriod({
        id: Date.now(),
        type: 'batbuoc',
        position: 'Đóng BHXH bắt buộc',
        workplace: '',
        fromMonth: `01/${currentYear}`,
        toMonth: `12/${currentYear}`,
        sm: 1,
        sy: currentYear,
        em: 12,
        ey: currentYear,
        salary: ''
      }));
    }

    setPeriods(existingPeriods);
    setNotes(customer.prior_participation_notes || '');
  }, [isOpen, customer]);

  // Tính số tháng tự nguyện tại đại lý này từ bảng records
  const agencyRecordsVoluntaryMonths = useMemo(() => {
    if (!records || !customer) return 0;
    const cleanCccd = (customer.cccd || '').trim();
    const cleanBhxh = (customer.bhxh || customer.old_bhxh || customer.oldBhxh || '').trim();
    if (!cleanCccd && !cleanBhxh) return 0;

    let m = 0;
    for (const r of records) {
      if (!r || r.type !== 'BHXH') continue;
      if (r.paymentStatus === 'Đã hủy' || r.status === 'Đã hủy' || r.isAdjustment) continue;

      const rCccd = (r.cccd || r.citizenId || '').trim();
      const rBhxh = (r.bhxh || r.bhxhCode || r.old_bhxh || r.oldBhxh || '').trim();

      const matches = (cleanCccd && (rCccd === cleanCccd || rBhxh === cleanCccd)) ||
                      (cleanBhxh && (rBhxh === cleanBhxh || rCccd === cleanBhxh));
      if (!matches) continue;

      const count = Number(r.months) || 0;
      if (count > 0) m += count;
    }
    return m;
  }, [records, customer]);

  // Tổng hợp số tháng từ các giai đoạn khai báo ngoài
  const calculated = useMemo(() => {
    return calculateMonthsFromPeriods(periods);
  }, [periods]);

  // Tổng số tháng tự nguyện cộng dồn (ngoài nơi khác + tại đại lý này)
  const totalVoluntaryMonthsAllSources = calculated.voluntaryMonths + agencyRecordsVoluntaryMonths;
  // Tính tổng số tháng ĐƯỢC NSNN HỖ TRỢ (chỉ tính từ 01/2018 trở đi theo NĐ 134/2015 & Luật BHXH 2024)
  const totalSupportedMonths = calculated.voluntarySupportedMonths + agencyRecordsVoluntaryMonths;
  const voluntarySupportedMonths = Math.min(120, totalSupportedMonths);
  const remainingSupportMonths = Math.max(0, 120 - totalSupportedMonths);

  // Thêm giai đoạn mới
  const handleAddPeriod = (init?: Partial<CustomerParticipationPeriod>) => {
    const currentYear = new Date().getFullYear();
    const newP: CustomerParticipationPeriod = normalizePeriod({
      id: Date.now() + Math.random(),
      type: init?.type || 'batbuoc',
      position: init?.position || (init?.type === 'tunguyen' ? 'Tham gia BHXH tự nguyện' : 'Đóng BHXH bắt buộc'),
      workplace: init?.workplace || '',
      fromMonth: init?.fromMonth || `01/${currentYear}`,
      toMonth: init?.toMonth || `12/${currentYear}`,
      sm: init?.sm || 1,
      sy: init?.sy || currentYear,
      em: init?.em || 12,
      ey: init?.ey || currentYear,
      salary: init?.salary || ''
    });
    setPeriods(prev => [...prev, newP]);
  };

  // Xóa giai đoạn
  const handleRemovePeriod = (id: number) => {
    setPeriods(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) {
        const currentYear = new Date().getFullYear();
        return [normalizePeriod({
          id: Date.now(),
          type: 'batbuoc',
          position: 'Đóng BHXH bắt buộc',
          workplace: '',
          fromMonth: `01/${currentYear}`,
          toMonth: `12/${currentYear}`,
          sm: 1,
          sy: currentYear,
          em: 12,
          ey: currentYear,
          salary: ''
        })];
      }
      return next;
    });
  };

  // Cập nhật từng trường của giai đoạn
  const handleUpdatePeriod = (id: number, field: keyof CustomerParticipationPeriod, value: any) => {
    setPeriods(prev => prev.map(p => {
      if (p.id !== id) return p;

      let newVal = value;
      if (field === 'salary' && p.type !== 'nhanuoc') {
        const v = String(value).replace(/\D/g, '');
        newVal = v ? new Intl.NumberFormat('vi-VN').format(Number(v)) : '';
      }

      // Tự động điền chức danh gợi ý khi đổi loại hình nếu người dùng chưa nhập
      if (field === 'type') {
        let suggestedPos = p.position || '';
        if (!suggestedPos || suggestedPos === 'Đóng BHXH bắt buộc' || suggestedPos === 'Tham gia BHXH tự nguyện') {
          suggestedPos = value === 'tunguyen' ? 'Tham gia BHXH tự nguyện' : 'Đóng BHXH bắt buộc';
        }
        return { ...p, type: value, position: suggestedPos };
      }

      // Cập nhật trường Từ tháng (MM/YYYY)
      if (field === 'fromMonth') {
        const masked = formatMonthInput(String(value));
        const updated = { ...p, fromMonth: masked };
        if (masked.length === 7) {
          const { month, year } = parseMonthAndYear(masked);
          updated.sm = month;
          updated.sy = year;
          if (updated.ey && updated.em) {
            updated.months = Math.max(0, (updated.ey - updated.sy) * 12 + (updated.em - updated.sm) + 1);
          }
        }
        return updated;
      }

      // Cập nhật trường Đến tháng (MM/YYYY)
      if (field === 'toMonth') {
        const masked = formatMonthInput(String(value));
        const updated = { ...p, toMonth: masked };
        if (masked.length === 7) {
          const { month, year } = parseMonthAndYear(masked);
          updated.em = month;
          updated.ey = year;
          if (updated.sy && updated.sm) {
            updated.months = Math.max(0, (updated.ey - updated.sy) * 12 + (updated.em - updated.sm) + 1);
          }
        }
        return updated;
      }

      const updated = { ...p, [field]: newVal };

      // Kiểm tra tính hợp lệ thời gian và đồng bộ lại
      if (field === 'sm' || field === 'sy' || field === 'em' || field === 'ey') {
        const startMonth = Number(updated.sm) || 1;
        const startYear = Number(updated.sy) || 0;
        const endMonth = Number(updated.em) || 12;
        const endYear = Number(updated.ey) || 0;

        if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
          showToast('Thời gian kết thúc không được nhỏ hơn thời gian bắt đầu!', 'warning');
          return p;
        }

        updated.fromMonth = `${String(startMonth).padStart(2, '0')}/${startYear}`;
        updated.toMonth = `${String(endMonth).padStart(2, '0')}/${endYear}`;
        updated.months = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
      }

      return updated;
    }));
  };

  // Tải file mẫu Excel
  const handleDownloadTemplate = async () => {
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const h = [
      ["Loại", "Chức danh", "Tháng BĐ", "Năm BĐ", "Tháng KT", "Năm KT", "Mức lương/HS", "Đơn vị"],
      ["batbuoc", "Đóng BHXH bắt buộc - Thợ hàn", 1, 2022, 12, 2024, 6500000, "Công ty TNHH Cơ Khí Sông Mã"],
      ["nhanuoc", "Giáo viên tiểu học (Hạng II)", 1, 2018, 12, 2021, 3.33, "Trường Tiểu Học Sông Mã"],
      ["tunguyen", "Tham gia BHXH tự nguyện", 1, 2025, 12, 2025, 1500000, "Đại lý Bưu điện Huyện"]
    ];
    const sheet = XLSX.utils.aoa_to_sheet(h);
    protectWorksheetFormulas(sheet);
    XLSX.writeFile({ SheetNames: ["BHXH"], Sheets: { "BHXH": sheet } }, `Mau_Qua_Trinh_BHXH_${customer?.name ? customer.name.replace(/\s+/g, '_') : 'Mau'}.xlsx`);
  };

  // Nhập dữ liệu từ Excel
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileError = validateExcelFile(file);
    if (fileError) {
      showAlert('File không hợp lệ', fileError, 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const workbook = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

          const newPeriods: CustomerParticipationPeriod[] = [];
          for (let j = 1; j < data.length; j++) {
            const r: any = data[j];
            if (!r || r[0] === undefined) continue;

            const typeT = String(r[0]).toLowerCase().trim();
            const t: 'batbuoc' | 'nhanuoc' | 'tunguyen' = (typeT.includes('nha') || typeT.includes('heso'))
              ? 'nhanuoc'
              : (typeT.includes('tu') ? 'tunguyen' : 'batbuoc');

            const position = r[1] ? String(r[1]).trim() : (t === 'tunguyen' ? 'Tham gia BHXH tự nguyện' : 'Đóng BHXH bắt buộc');
            const sm = Number(r[2]) || 1;
            const sy = Number(r[3]) || new Date().getFullYear();
            const em = Number(r[4]) || 12;
            const ey = Number(r[5]) || new Date().getFullYear();
            const salary = r[6] ? String(r[6]).trim() : '';
            const workplace = r[7] ? String(r[7]).trim() : '';

            newPeriods.push(normalizePeriod({
              id: Date.now() + Math.random() + j,
              type: t,
              position,
              workplace,
              sm,
              sy,
              em,
              ey,
              salary: t === 'nhanuoc' ? salary : (salary ? parseInt(salary.replace(/\D/g, '') || '0').toLocaleString('vi-VN') : '')
            }));
          }

          if (newPeriods.length > 0) {
            setPeriods(newPeriods);
            showToast(`Đã nhập thành công ${newPeriods.length} giai đoạn đóng BHXH từ Excel!`, 'success');
          } else {
            showToast('Không tìm thấy dòng giai đoạn hợp lệ trong file Excel.', 'warning');
          }
        } catch (err: any) {
          showAlert('Lỗi đọc file Excel', err.message || 'Không thể đọc nội dung file.', 'error');
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      showAlert('Lỗi hệ thống', err.message, 'error');
    }
  };

  // Quét Sổ AI qua Gemini
  const handleOcrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentUser) {
      showAlert(
        'Yêu cầu Đăng nhập',
        'Tính năng Quét Sổ AI chỉ dành cho Cán bộ / Nhân viên đã đăng nhập.',
        'warning'
      );
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('Dung lượng tệp quá lớn (tối đa 20MB)!', 'error');
      if (e.target) e.target.value = '';
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setOcrLoading(true);
    showToast(`Đang phân tích bóc tách quá trình đóng BHXH bằng AI...`, 'info');

    try {
      let base64Data = '';
      let mimeType = isPdf ? 'application/pdf' : (file.type || 'image/jpeg');

      if (isPdf) {
        base64Data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = (evt) => resolve(evt.target?.result as string);
          r.onerror = reject;
          r.readAsDataURL(file);
        });
      } else {
        const compressed = await compressImageForOcr(file);
        base64Data = compressed.base64;
        mimeType = compressed.mimeType;
      }

      const rawPeriods = await callGeminiOcrClientSide(base64Data, mimeType);
      const extracted = normalizeOcrPeriods(rawPeriods);

      if (extracted.length > 0) {
        const mapped: CustomerParticipationPeriod[] = extracted.map((ep, idx) => normalizePeriod({
          id: Date.now() + Math.random() + idx,
          type: ep.type || 'batbuoc',
          position: ep.position || (ep.type === 'tunguyen' ? 'Tham gia BHXH tự nguyện' : 'Đóng BHXH bắt buộc'),
          workplace: ep.workplace || '',
          sm: ep.sm || 1,
          sy: ep.sy || new Date().getFullYear(),
          em: ep.em || 12,
          ey: ep.ey || new Date().getFullYear(),
          salary: ep.salary || ''
        }));

        setPeriods(mapped);
        showToast(`AI đã nhận diện thành công ${mapped.length} giai đoạn đóng BHXH!`, 'success');
      } else {
        showToast('Không tìm thấy dữ liệu quá trình đóng hợp lệ trong ảnh/tài liệu này.', 'warning');
      }
    } catch (err: any) {
      console.error('OCR Error:', err);
      showAlert('Lỗi Quét AI', err.message || 'Có lỗi xảy ra khi phân tích tài liệu.', 'error');
    } finally {
      setOcrLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Lưu hồ sơ tham gia
  const handleSave = async () => {
    if (!customer) return;

    // Validate periods using Zod schema
    for (let i = 0; i < periods.length; i++) {
      const p = periods[i];
      const fromM = p.fromMonth || `${String(p.sm || 1).padStart(2, '0')}/${p.sy || new Date().getFullYear()}`;
      const toM = p.toMonth || `${String(p.em || 12).padStart(2, '0')}/${p.ey || p.sy || new Date().getFullYear()}`;
      const periodValidation = participationPeriodDateSchema.safeParse({
        fromMonth: fromM,
        toMonth: toM
      });
      if (!periodValidation.success) {
        showAlert('Lỗi thời gian', `Giai đoạn thứ ${i + 1}: ${periodValidation.error.issues[0]?.message || 'Khoảng thời gian không hợp lệ.'}`, 'warning');
        return;
      }
    }

    setIsSaving(true);
    try {
      const enrichedPeriods = periods.map(p => {
        const fromM = p.fromMonth || `${String(p.sm || 1).padStart(2, '0')}/${p.sy || new Date().getFullYear()}`;
        const toM = p.toMonth || `${String(p.em || 12).padStart(2, '0')}/${p.ey || p.sy || new Date().getFullYear()}`;
        return {
          ...p,
          fromMonth: fromM,
          toMonth: toM,
          from_month_date: parseToIsoMonthDate(fromM),
          to_month_date: parseToIsoMonthDate(toM),
          months: Math.max(0, (Number(p.ey) - Number(p.sy)) * 12 + (Number(p.em) - Number(p.sm)) + 1)
        };
      });

      const targetKey = customer.id || customer.customer_key || customer.cccd || customer.bhxh;
      const success = await updateCustomerParticipation(targetKey, {
        prior_periods: enrichedPeriods,
        prior_voluntary_months: calculated.voluntaryMonths,
        prior_compulsory_months: calculated.compulsoryMonths,
        prior_participation_notes: notes.trim()
      });

      if (success) {
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err: any) {
      showAlert('Lỗi lưu trữ', err.message || 'Không thể lưu hồ sơ.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Chuyển dữ liệu sang tab Tính BHXH 1 lần
  const handleTransferTo1Lan = () => {
    // 1. Format PeriodItem của modal (giai đoạn trước đây)
    const formattedPrior: PeriodItem[] = (periods || []).map(p => ({
      id: p.id || (Date.now() + Math.random()),
      type: p.type || 'batbuoc',
      position: p.position || '',
      workplace: p.workplace || '',
      sm: Number(p.sm) || 1,
      sy: Number(p.sy) || new Date().getFullYear(),
      em: Number(p.em) || 12,
      ey: Number(p.ey) || new Date().getFullYear(),
      salary: p.salary ? (typeof p.salary === 'number' ? new Intl.NumberFormat('vi-VN').format(p.salary) : String(p.salary).trim()) : ''
    }));

    // 2. Gộp thêm các giai đoạn đã phát sinh tại đại lý này
    const agencyPeriods = extractAgencyPeriods(customer, records || []);
    const completePeriods: PeriodItem[] = [...formattedPrior, ...agencyPeriods];

    if (completePeriods.length === 0) {
      showAlert('Chưa có giai đoạn', 'Vui lòng nhập ít nhất 1 giai đoạn đóng trước khi chuyển sang tính BHXH 1 lần.', 'warning');
      return;
    }

    // 3. Sắp xếp tăng dần theo thời gian
    completePeriods.sort((a, b) => {
      const aVal = (Number(a.sy) || 0) * 12 + (Number(a.sm) || 0);
      const bVal = (Number(b.sy) || 0) * 12 + (Number(b.sm) || 0);
      return aVal - bVal;
    });

    const gender = (customer?.gender || '').toLowerCase().includes('nữ') || (customer?.gender || '').toLowerCase() === 'female'
      ? 'female'
      : 'male';

    try {
      sessionStorage.setItem('TRANSFER_TO_BHXH1LAN', JSON.stringify({
        customerName: customer?.name || '',
        customerCccd: customer?.cccd || '',
        customerBhxh: customer?.bhxh || '',
        gender,
        periods: completePeriods,
        autoCalculate: true
      }));

      showToast(`Đã gộp ${completePeriods.length} giai đoạn (gồm ${agencyPeriods.length} kỳ tại đại lý) sang phân hệ Tính BHXH 1 lần!`, 'success');
      onClose();
      navigate('/bhxh1lan');
    } catch (err: any) {
      showAlert('Lỗi chuyển tiếp', err.message || 'Không thể lưu tạm dữ liệu chuyển tiếp.', 'error');
    }
  };

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-gray-100 flex flex-col my-auto max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50 via-sky-50 to-indigo-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#004182] text-white flex items-center justify-center shadow-md">
              <History size={20} className="text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-[#004182] text-base sm:text-lg leading-tight">
                  Hồ Sơ Quá Trình Tham Gia BHXH
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  {customer.name}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                CCCD: <span className="font-bold text-gray-700">{customer.cccd || '---'}</span> | Mã BHXH: <span className="font-bold text-gray-700">{customer.bhxh || customer.old_bhxh || customer.oldBhxh || '---'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white/80 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1">
          
          {/* Top KPI Cards: Thống kê tổng hợp thời gian tham gia */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">BHXH Bắt buộc</span>
              <span className="text-base sm:text-lg font-black text-[#004182] mt-0.5 block">
                {calculated.compulsoryMonths} <span className="text-xs font-semibold text-gray-500">tháng</span>
              </span>
              <span className="text-[10px] text-gray-400 font-medium">({(calculated.compulsoryMonths / 12).toFixed(1)} năm)</span>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/70 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">BHXH TN nơi khác</span>
              <span className="text-base sm:text-lg font-black text-blue-800 mt-0.5 block">
                {calculated.voluntaryMonths} <span className="text-xs font-semibold text-blue-600">tháng</span>
              </span>
              <span className="text-[10px] text-blue-500 font-medium">({(calculated.voluntaryMonths / 12).toFixed(1)} năm)</span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">BHXH TN tại đại lý</span>
              <span className="text-base sm:text-lg font-black text-emerald-800 mt-0.5 block">
                {agencyRecordsVoluntaryMonths} <span className="text-xs font-semibold text-emerald-600">tháng</span>
              </span>
              <span className="text-[10px] text-emerald-600 font-medium">(Tự động từ giao dịch)</span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">Tổng tích lũy</span>
              <span className="text-base sm:text-lg font-black text-amber-900 mt-0.5 block">
                {calculated.compulsoryMonths + calculated.voluntaryMonths + agencyRecordsVoluntaryMonths} <span className="text-xs font-semibold text-amber-700">tháng</span>
              </span>
              <span className="text-[10px] text-amber-700 font-medium">
                ({((calculated.compulsoryMonths + calculated.voluntaryMonths + agencyRecordsVoluntaryMonths) / 12).toFixed(1)} năm)
              </span>
            </div>
          </div>

          {/* Progress Bar Tiến trình NSNN hỗ trợ 10 năm (120 tháng) */}
          <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-2xl p-3.5 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2 text-xs">
              <div>
                <div className="flex items-center gap-1.5 font-bold text-gray-800">
                  <Shield size={15} className="text-[#004182]" />
                  <span>Tiến trình hưởng hỗ trợ Ngân sách Nhà nước (Trần 10 năm / 120 tháng theo Luật BHXH 2024):</span>
                </div>
                {calculated.voluntaryUnsupportedBefore2018Months > 0 && (
                  <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                    🗓️ Gồm <strong>{calculated.voluntaryUnsupportedBefore2018Months} tháng</strong> đóng trước ngày 01/01/2018 (chưa có chính sách hỗ trợ tiền đóng theo NĐ 134/2015/NĐ-CP nên không tính vào trần 120 tháng).
                  </p>
                )}
              </div>
              <div className="font-extrabold text-blue-900 shrink-0 text-right">
                <span>{voluntarySupportedMonths}/120 tháng</span>
                {remainingSupportMonths > 0 ? (
                  <span className="text-emerald-700 ml-1.5 font-semibold">(Còn {remainingSupportMonths} tháng được hỗ trợ)</span>
                ) : (
                  <span className="text-rose-700 ml-1.5 font-semibold">(Đã đủ 120 tháng - Hết hỗ trợ NSNN)</span>
                )}
              </div>
            </div>
            
            {/* Progress Track */}
            <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, (voluntarySupportedMonths / 120) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-semibold mt-1">
              <span>0 tháng</span>
              <span>60 tháng (5 năm)</span>
              <span>120 tháng (10 năm trần NSNN)</span>
            </div>
          </div>

          {/* Toolbar tiện ích (AI OCR, Excel, Tải mẫu, Thêm dòng) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-gray-800 uppercase tracking-wide">
                Chi tiết các giai đoạn tham gia ({periods.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Nút Quét Sổ AI */}
              <input
                type="file"
                ref={ocrFileInputRef}
                accept="image/*, application/pdf, .pdf"
                className="hidden"
                onChange={handleOcrImageUpload}
              />
              <button
                type="button"
                onClick={() => ocrFileInputRef.current?.click()}
                disabled={ocrLoading}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Quét ảnh tờ rời Sổ BHXH / VssID / File PDF bằng AI Gemini"
              >
                {ocrLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang quét AI...</span>
                  </>
                ) : (
                  <>
                    <Camera size={14} />
                    <span>Quét Sổ AI</span>
                  </>
                )}
              </button>

              {/* Nút Nhập Excel */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportExcel}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileDown size={14} className="text-emerald-600" />
                <span>Nhập Excel</span>
              </button>

              {/* Nút Tải Mẫu */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition flex items-center gap-1 cursor-pointer"
                title="Tải file mẫu Excel"
              >
                <Download size={14} />
                <span>Mẫu</span>
              </button>

              {/* Nút Thêm Giai Đoạn */}
              <button
                type="button"
                onClick={() => handleAddPeriod()}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#004182] text-white hover:bg-[#003166] transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Thêm giai đoạn</span>
              </button>
            </div>
          </div>

          {/* Danh sách các dòng giai đoạn */}
          <div className="space-y-3">
            {periods.map((p, idx) => (
              <div
                key={p.id || idx}
                className="bg-gray-50/80 hover:bg-gray-50 p-3 sm:p-4 rounded-2xl border border-gray-200/90 transition shadow-2xs space-y-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-[1.85fr_1.85fr_1.15fr_1.15fr_2.4fr] gap-2.5 sm:gap-3 items-end">
                  
                  {/* Cột 1: Loại hình */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1 truncate">
                      Loại hình tham gia
                    </label>
                    <select
                      value={p.type || 'batbuoc'}
                      onChange={e => handleUpdatePeriod(p.id, 'type', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-semibold text-gray-800 focus:border-[#004182] outline-none cursor-pointer"
                    >
                      <option value="batbuoc">Bắt buộc / Doanh nghiệp</option>
                      <option value="nhanuoc">Bắt buộc / Nhà nước (Hệ số)</option>
                      <option value="tunguyen">Tự nguyện (Đại lý khác)</option>
                    </select>
                  </div>

                  {/* Cột 2: Chức danh / Nghề nghiệp */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1 truncate">
                      Chức danh / Nghề nghiệp
                    </label>
                    <input
                      type="text"
                      value={p.position || ''}
                      onChange={e => handleUpdatePeriod(p.id, 'position', e.target.value)}
                      placeholder="VD: Đóng BHXH bắt buộc, Công nhân..."
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-medium text-gray-800 focus:border-[#004182] outline-none"
                    />
                  </div>

                  {/* Cột 3: Từ tháng (MM/YYYY) */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1 flex items-center justify-between">
                      <span>Từ tháng</span>
                      <span className="text-[10px] text-gray-400 font-normal">MM/YYYY</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      value={p.fromMonth || `${String(p.sm || 1).padStart(2, '0')}/${p.sy || new Date().getFullYear()}`}
                      onChange={e => handleUpdatePeriod(p.id, 'fromMonth', e.target.value)}
                      placeholder="MM/YYYY"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-bold text-gray-800 focus:border-[#004182] outline-none text-center"
                    />
                  </div>

                  {/* Cột 4: Đến tháng (MM/YYYY) */}
                  <div className="min-w-0">
                    <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1 flex items-center justify-between">
                      <span>Đến tháng</span>
                      <span className="text-[10px] text-gray-400 font-normal">MM/YYYY</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={7}
                      value={p.toMonth || `${String(p.em || 12).padStart(2, '0')}/${p.ey || new Date().getFullYear()}`}
                      onChange={e => handleUpdatePeriod(p.id, 'toMonth', e.target.value)}
                      placeholder="MM/YYYY"
                      className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-bold text-gray-800 focus:border-[#004182] outline-none text-center"
                    />
                  </div>

                  {/* Cột 5: Mức lương/HS & Nút Xóa */}
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1 truncate">
                        Mức lương / HS
                      </label>
                      <input
                        type="text"
                        inputMode={p.type === 'nhanuoc' ? 'decimal' : 'numeric'}
                        value={p.salary || ''}
                        onChange={e => handleUpdatePeriod(p.id, 'salary', e.target.value)}
                        placeholder={p.type === 'nhanuoc' ? 'VD: 3.33' : 'VD: 6.000.000'}
                        className="w-full p-2.5 rounded-xl border border-gray-300 bg-white text-xs sm:text-sm font-bold text-[#004182] focus:border-[#004182] outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePeriod(p.id)}
                      className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition cursor-pointer mt-5 shrink-0"
                      title="Xóa dòng này"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Dòng phụ: Tên Cơ quan / Doanh nghiệp / Đại lý cũ */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-200/60 text-xs">
                  <Building size={14} className="text-gray-400 shrink-0" />
                  <span className="text-gray-500 font-medium shrink-0">Đơn vị / Đại lý cũ:</span>
                  <input
                    type="text"
                    value={p.workplace || ''}
                    onChange={e => handleUpdatePeriod(p.id, 'workplace', e.target.value)}
                    placeholder="VD: Công ty May Sông Mã, Bưu điện Huyện, BHXH Tỉnh..."
                    className="flex-1 p-1 px-2.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 outline-none focus:border-[#004182]"
                  />
                  {p.sy && p.ey && (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                      Thời lượng: {Math.max(0, (p.ey - p.sy) * 12 + (p.em - p.sm) + 1)} tháng
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Ô nhập Ghi chú tổng quát */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              Ghi chú hồ sơ tham gia (Số sổ BHXH, số quyết định thôi việc/chốt sổ, ghi chú nghiệp vụ)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="VD: Đã chốt sổ BHXH số 1421100097 ngày 15/01/2025; Đóng tự nguyện tại Đại lý Bưu điện Sông Mã từ T01/2024 đến T12/2024..."
              className="w-full p-3 rounded-2xl border border-gray-300 bg-white text-xs sm:text-sm text-gray-800 focus:border-[#004182] outline-none"
            />
          </div>

          {/* Cảnh báo an toàn rõ ràng */}
          <div className="bg-amber-50/70 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Cam kết an toàn hệ thống: </span>
              Việc lưu hồ sơ tại đây chỉ nhằm mục đích cập nhật quá trình tham gia để theo dõi quyền lợi an sinh và làm căn cứ tính trần 10 năm NSNN hỗ trợ. Thao tác này 
              <span className="font-extrabold text-red-700"> tuyệt đối KHÔNG tạo giao dịch nộp tiền, hóa đơn hay phát sinh công nợ đại lý</span> trong hệ thống.
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {/* Nút liên kết sang BHXH 1 lần */}
          <button
            type="button"
            onClick={handleTransferTo1Lan}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            title="Chuyển toàn bộ quá trình sang tab Tính BHXH 1 lần"
          >
            <Calculator size={16} />
            <span>Chuyển sang Tính BHXH 1 Lần</span>
            <ArrowRight size={14} />
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#004182] hover:bg-[#003166] text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang lưu hồ sơ...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Lưu Hồ Sơ Tham Gia</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
