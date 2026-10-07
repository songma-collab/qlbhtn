import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppContext } from '../../context/AppContext';
import { CONSTANTS } from '../../utils/constants';
import { formatDateInput, parseDateISO, parseMonthISO, dateISOToVN, monthISOToVN, formatMonthVN, getLocalYYYYMMDD, formatTitleCase } from '../../utils/helpers';
import { calculateNextRenewalMonth, toUIDate, toUIMonth, toDbDate, toDbMonth, parseMonthAndYear } from '../../utils/dateStandardHelper';
import { 
  formatDateInputMask, 
  validateDOBInput, 
  bhxhFormDateSchema, 
  bhytFormDateSchema, 
  renewalFormDateSchema,
  formatDateToISO,
  formatDateToVN,
  formatMonthToISO,
  formatMonthToVN
} from '../../utils/dateFormatter';
import { calculateBHXH, calculateBHYTCoterminous, getPolicyValueForDate, getCustomerPreviousBHXHMonths } from '../../utils/calculations';
import { X, Check, Clock, ShieldCheck } from 'lucide-react';
import { recordService, customerService } from '../../services';
import { callPublicPortal } from '../../utils/publicPortal';
import TurnstileCaptcha from '../TurnstileCaptcha';
import { generateIdempotencyKey, dbToRecord } from '../../utils/sanitize';
import { maskCCCD, maskName, maskPhone, maskBHXH } from '../../utils/security';

import BHXHForm from './register/BHXHForm';
import BHXHActionTypeSelector from './register/BHXHActionTypeSelector';
import BHXHCalcSettings from './register/BHXHCalcSettings';
import BHYTForm from './register/BHYTForm';
import BHYTCalcSettings from './register/BHYTCalcSettings';
import RegisterSummary from './register/RegisterSummary';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'BHXH' | 'BHYT';
  record?: any | null;
  isRenew?: boolean;
  initialData?: any;
}

const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, type, record = null, isRenew = false, initialData }) => {
  const { 
    records, 
    customers,
    fetchCustomerByCode: fetchCustomerFromContext, 
    updateRecord, 
    addRecord, 
    showToast, 
    showAlert, 
    currentUser, 
    settings, 
    policies 
  } = useAppContext();
  const [formData, setFormData] = useState<any>({});
  const [bhytMembers, setBhytMembers] = useState<any[]>([]);
  const [bhxhCalc, setBhxhCalc] = useState({ 
    income: 1500000, 
    nnSupport: 20, 
    dpSupport: 0, 
    method: '1', 
    customMonths: 1, 
    fromMonth: '', 
    toMonth: '', 
    basePremium: 0, 
    nnSupportAmount: 0, 
    dpSupportAmount: 0, 
    amount: 0, 
    discountAmount: 0, 
    penaltyAmount: 0,
    previousMonths: 0,
    supportedMonthsCount: 0,
    unsupportedMonthsCount: 0,
    totalAccumulatedMonths: 0
  });
  const [bhytCalc, setBhytCalc] = useState({ duration: 12, amount: 0 });
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [autoFilledBadge, setAutoFilledBadge] = useState<{ name: string; cccd: string; phone?: string; source?: string } | null>(null);
  const [errors, setErrors] = useState<{
    dob?: string;
    cccd?: string;
    phone?: string;
    email?: string;
    mismatch?: string;
  }>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetTrigger, setCaptchaResetTrigger] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bhxhActionType, setBhxhActionType] = useState<'Tăng mới' | 'Gia hạn'>('Gia hạn');

  const commRates = useMemo(() => {
    const defaultObj = {
      commBHXHNew: settings?.commBHXHNew || 5,
      commBHXHRenew: settings?.commBHXHRenew || 3,
      commBHYTNew: settings?.commBHYTNew || 5,
      commBHYTRenew: settings?.commBHYTRenew || 3
    };
    const dateStr = getLocalYYYYMMDD();
    const commObjRaw = getPolicyValueForDate(policies, 'commission', dateStr, defaultObj);
    let commObj = defaultObj;
    if (commObjRaw) {
      if (typeof commObjRaw === 'object') commObj = commObjRaw;
      else if (typeof commObjRaw === 'string') {
        try { commObj = JSON.parse(commObjRaw); } catch { commObj = defaultObj; }
      }
    }
    return {
      commBHXHNewPct: Number(commObj.commBHXHNew) || 5,
      commBHXHRenewPct: Number(commObj.commBHXHRenew) || 3
    };
  }, [policies, settings]);

  const hasPreviousRenew = useMemo(() => {
    if (type !== 'BHXH') return false;
    const cleanC = (formData.cccd || formData.bhxh || '').replace(/\D/g, '');
    if (!cleanC) return false;

    const recActionStr = String(record?.actionType || (record as any)?.action_type || '').toLowerCase();
    if (recActionStr.includes('gia hạn') || recActionStr.includes('tái tục')) return true;

    return (records || []).some(r => {
      if (!r || r.type !== 'BHXH') return false;
      const rPayStatus = r.payment_status || (r as any).paymentStatus;
      if (rPayStatus === 'Đã hủy') return false;
      const rC = (r.cccd || (r as any).citizenId || '').replace(/\D/g, '');
      const rB = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
      const isMatch = Boolean(cleanC && (rC === cleanC || rB === cleanC));
      if (!isMatch) return false;
      const aType = String(r.action_type || (r as any).actionType || '').toLowerCase();
      return aType.includes('gia hạn') || aType.includes('tái tục');
    });
  }, [formData.cccd, formData.bhxh, record, records, type]);

  useEffect(() => {
    if (!isOpen || isRenew || record) return;

    const checkMismatch = async () => {
      let mismatchError = '';

      if (type === 'BHXH') {
        if (formData.cccd && formData.cccd.length === 12) {
          const existing = await fetchCustomerByCode(formData.cccd);
          if (existing) {
            const existingDobStr = existing.dob ? toUIDate(existing.dob) : '';
            const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0]) : '';
            const newName = formatTitleCase(formData.name) || '';
            
            if ((newName && existingName !== newName) || (formData.dob && formData.dob.length === 10 && existingDobStr !== formData.dob)) {
              mismatchError = 'Cảnh báo: Số CCCD đã tồn tại nhưng Họ tên hoặc Ngày sinh không khớp!';
            }
          }
        }
      } else if (type === 'BHYT') {
        for (const m of bhytMembers) {
          if (m.cccd && m.cccd.length === 12) {
            const existing = await fetchCustomerByCode(m.cccd);
            if (existing) {
              const existingDobStr = existing.dob ? toUIDate(existing.dob) : '';
              const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0]) : '';
              const newName = formatTitleCase(m.name) || '';
              
              if ((newName && existingName !== newName) || (m.dob && m.dob.length === 10 && existingDobStr !== m.dob)) {
                mismatchError = `Cảnh báo: Số CCCD ${m.cccd} đã tồn tại nhưng Họ tên hoặc Ngày sinh không khớp!`;
                break;
              }
            }
          }
        }
      }

      setErrors(prev => ({ ...prev, mismatch: mismatchError }));
    };

    const t = setTimeout(() => checkMismatch(), 500);
    return () => clearTimeout(t);
  }, [formData.cccd, formData.name, formData.dob, bhytMembers, isOpen, isRenew, record, type]);

  const validateDOB = (dob: string) => {
    return validateDOBInput(dob);
  };

  const validateEmail = (email: string) => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Email không đúng định dạng';
    return '';
  };

  const handleDOBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatDateInputMask(e.target.value);
    setFormData((prev: any) => ({ ...prev, dob: val }));
    if (val.length === 10) {
      setErrors(prev => ({ ...prev, dob: validateDOBInput(val) }));
    } else if (val.length > 0) {
      setErrors(prev => ({ ...prev, dob: 'Ngày sinh phải đủ 10 ký tự (DD/MM/YYYY)' }));
    } else {
      setErrors(prev => ({ ...prev, dob: '' }));
    }
  };

  const handleCCCDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setFormData((prev: any) => ({ ...prev, cccd: val, bhxh: val }));
    if (val.length > 0) {
      if (!/^\d{12}$/.test(val)) {
        setErrors(prev => ({ ...prev, cccd: 'CCCD phải gồm đúng 12 chữ số' }));
      } else {
        setErrors(prev => ({ ...prev, cccd: '' }));
      }
    } else {
      setErrors(prev => ({ ...prev, cccd: '', mismatch: '' }));
      setAutoFilledBadge(null);
    }

    // Tự động gọi lại thông tin CSDL ngay khi đủ 12 số CCCD
    if (val.length === 12 && !isRenew && !record) {
      autoFillCustomerInfo(val, type);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setFormData({ ...formData, phone: val });
    if (val.length > 0) {
      if (!/^0\d{9}$/.test(val)) {
        setErrors(prev => ({ ...prev, phone: 'Số điện thoại phải bắt đầu bằng số 0 và gồm đúng 10 số' }));
      } else {
        setErrors(prev => ({ ...prev, phone: '' }));
      }
    } else {
      setErrors(prev => ({ ...prev, phone: '' }));
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, email: val });
    if (val.length > 0) {
      setErrors(prev => ({ ...prev, email: validateEmail(val) }));
    } else {
      setErrors(prev => ({ ...prev, email: '' }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      const effectiveRec = record || initialData;
      let resolvedRec = effectiveRec;

      // Tự động phục hồi thông tin kỳ đóng gần nhất nếu record truyền vào thiếu trường tài chính/kỳ hạn
      if (effectiveRec && records && records.length > 0) {
        const cleanCccd = (effectiveRec.cccd || effectiveRec.citizenId || '').replace(/\D/g, '');
        const cleanBhxh = (effectiveRec.bhxh || effectiveRec.bhxhCode || (effectiveRec.type === 'BHXH' ? effectiveRec.code : '') || '').replace(/\D/g, '');
        
        const activeRecs = records.filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');
        const matched = activeRecs.filter(r => {
          if (effectiveRec.latest_record_id && r.id === effectiveRec.latest_record_id) return true;
          const rCccd = (r.cccd || '').replace(/\D/g, '');
          const rBhxh = (r.bhxh || '').replace(/\D/g, '');
          const rOld = (r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
          return (cleanCccd && rCccd === cleanCccd) || (cleanBhxh && rBhxh === cleanBhxh) || (cleanBhxh && rOld === cleanBhxh);
        });

        if (matched.length > 0) {
          // 1. Bản ghi có kỳ hạn mới nhất để tính kỳ gia hạn tiếp theo
          const sortedByContract = [...matched].sort((a, b) => {
            const nextA = new Date(a.next_payment || (a as any).nextPayment || 0).getTime();
            const nextB = new Date(b.next_payment || (b as any).nextPayment || 0).getTime();
            if (nextB !== nextA) return nextB - nextA;
            const toMA = a.to_month || (a as any).toMonth || '';
            const toMB = b.to_month || (b as any).toMonth || '';
            if (toMB !== toMA) return toMB.localeCompare(toMA);
            const dateA = new Date(a.date || a.created_at || 0).getTime();
            const dateB = new Date(b.date || b.created_at || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
          });
          const newestByContract = sortedByContract[0];

          // 2. Bản ghi có thời điểm CẬP NHẬT GẦN NHẤT (ưu tiên thông tin nhân khẩu mới nhất)
          const sortedByUpdate = [...matched].sort((a, b) => {
            const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
            const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
            if (upB !== upA) return upB - upA;
            const dateA = new Date(a.date || a.created_at || 0).getTime();
            const dateB = new Date(b.date || b.created_at || 0).getTime();
            if (dateB !== dateA) return dateB - dateA;
            return (Number(b.id) || 0) - (Number(a.id) || 0);
          });
          const newestByUpdate = sortedByUpdate[0];

          if (newestByContract && newestByUpdate) {
            const targetRecordId = typeof effectiveRec.id === 'number' && !isNaN(effectiveRec.id)
              ? effectiveRec.id
              : (Number(effectiveRec.latest_record_id) || newestByContract.id || newestByUpdate.id);

            const hasRenewInMatched = matched.some(r => {
              const a = String(r.action_type || (r as any).actionType || '').toLowerCase();
              return a.includes('gia hạn') || a.includes('tái tục');
            });
            const inheritedActionType = hasRenewInMatched
              ? 'Gia hạn'
              : (newestByContract.action_type || (newestByContract as any).actionType || newestByUpdate.action_type || (newestByUpdate as any).actionType || effectiveRec.action_type || (effectiveRec as any).actionType);

            resolvedRec = {
              ...newestByContract,
              ...newestByUpdate,
              ...effectiveRec,
              id: targetRecordId,
              action_type: inheritedActionType,
              actionType: inheritedActionType,
              name: effectiveRec.name || newestByUpdate.name || newestByContract.name,
              phone: effectiveRec.phone || newestByUpdate.phone || newestByContract.phone,
              address: effectiveRec.address || newestByUpdate.address || newestByContract.address,
              dob: effectiveRec.dob || newestByUpdate.dob || newestByContract.dob,
              gender: effectiveRec.gender || newestByUpdate.gender || newestByContract.gender,
              nation: effectiveRec.nation || newestByUpdate.nation || newestByContract.nation,
              email: effectiveRec.email || newestByUpdate.email || newestByContract.email,
              recvName: effectiveRec.recvName || (effectiveRec as any).recvname || effectiveRec.recv_name || newestByUpdate.recv_name || (newestByUpdate as any).recvName || newestByContract.recv_name || (newestByContract as any).recvName,
              recvPhone: effectiveRec.recvPhone || (effectiveRec as any).recvphone || effectiveRec.recv_phone || newestByUpdate.recv_phone || (newestByUpdate as any).recvPhone || newestByContract.recv_phone || (newestByContract as any).recvPhone,
              recvAddress: effectiveRec.recvAddress || (effectiveRec as any).recvaddress || effectiveRec.recv_address || newestByUpdate.recv_address || (newestByUpdate as any).recvAddress || newestByContract.recv_address || (newestByContract as any).recvAddress,
              income: effectiveRec.income ?? newestByContract.income,
              method: effectiveRec.method || newestByContract.method,
              fromMonth: effectiveRec.fromMonth || (effectiveRec as any).frommonth || effectiveRec.from_month || newestByContract.from_month || (newestByContract as any).fromMonth,
              toMonth: effectiveRec.toMonth || (effectiveRec as any).tomonth || effectiveRec.to_month || newestByContract.to_month || (newestByContract as any).toMonth,
              nextPayment: effectiveRec.nextPayment || (effectiveRec as any).next_payment || newestByContract.next_payment || (newestByContract as any).nextPayment,
              months: effectiveRec.months ?? newestByContract.months,
              wage: effectiveRec.wage ?? newestByContract.wage,
              nnSupportPct: effectiveRec.nnSupportPct ?? effectiveRec.nn_support_pct ?? newestByContract.nn_support_pct ?? (newestByContract as any).nnSupportPct,
              dpSupportPct: effectiveRec.dpSupportPct ?? effectiveRec.dp_support_pct ?? newestByContract.dp_support_pct ?? (newestByContract as any).dpSupportPct,
              members: (effectiveRec.members && effectiveRec.members.length > 0) ? effectiveRec.members : (newestByUpdate.members || newestByContract.members)
            };
          }
        }
      }

      const rec = resolvedRec ? {
        ...resolvedRec,
        name: resolvedRec.name || (resolvedRec as any).fullName || '',
        method: resolvedRec.method || '',
        fromMonth: resolvedRec.fromMonth || (resolvedRec as any).frommonth || resolvedRec.from_month || '',
        toMonth: resolvedRec.toMonth || (resolvedRec as any).tomonth || resolvedRec.to_month || '',
        nextPayment: resolvedRec.nextPayment || (resolvedRec as any).next_payment || '',
        recvName: resolvedRec.recvName || (resolvedRec as any).recvname || resolvedRec.recv_name || '',
        recvPhone: resolvedRec.recvPhone || (resolvedRec as any).recvphone || resolvedRec.recv_phone || '',
        recvAddress: resolvedRec.recvAddress || (resolvedRec as any).recvaddress || resolvedRec.recv_address || '',
      } : null;
      
      if (type === 'BHXH') {
        if (rec) {
          const cccdVal = rec.cccd || (rec as any).citizenId || '';
          const bhxhVal = rec.bhxh || (rec as any).bhxhCode || (rec.type === 'BHXH' ? (rec as any).code : '') || '';
          const nationVal = rec.nation || (rec.nnSupportPct === 30 || (rec as any).nnSupport === 30 ? 'Thiểu_số' : 'Kinh');
          
          let fromM = toUIMonth(rec.fromMonth) || '';
          if (isRenew) {
            fromM = calculateNextRenewalMonth(rec.toMonth, rec.nextPayment);
          }

          let initialNotes = isRenew ? '' : (rec.notes || '');

          setFormData({
            name: rec.name || (rec as any).fullName || '', 
            cccd: cccdVal, 
            phone: rec.phone || '', 
            bhxh: bhxhVal,
            oldBhxh: rec.oldBhxh || (rec as any).bhxhCu || (bhxhVal.length === 10 ? bhxhVal : '') || '',
            dob: toUIDate(rec.dob) || '', 
            gender: rec.gender || 'Nam', 
            nation: nationVal,
            email: rec.email || '', 
            address: rec.address || '', 
            notes: initialNotes
          });
          
          let methodVal = '1';
          const methodMap: Record<string, string> = {
            'Đóng hằng tháng': '1', 'Đóng 3 tháng': '3', 'Đóng 6 tháng': '6', 'Đóng 12 tháng': '12',
            'Đóng trước 2 năm': 'pre_24', 'Đóng trước 3 năm': 'pre_36', 'Đóng trước 4 năm': 'pre_48', 'Đóng trước 5 năm': 'pre_60',
            'Đóng 1 lần để nghỉ hưu': 'post_custom'
          };
          if (rec.method) methodVal = methodMap[rec.method] || '1';

          const nnSupportVal = rec.nnSupportPct != null 
            ? Number(rec.nnSupportPct) 
            : ((rec as any).nnSupport != null 
                ? Number((rec as any).nnSupport) 
                : (nationVal === 'Thiểu_số' ? 30 : 20));

          setBhxhCalc(prev => ({
            ...prev,
            income: Number(rec.income) || settings?.povertyStandard || 1500000,
            nnSupport: nnSupportVal,
            dpSupport: rec.dpSupportPct != null ? Number(rec.dpSupportPct) : ((rec as any).dpSupport != null ? Number((rec as any).dpSupport) : 0),
            method: methodVal,
            customMonths: Number(rec.months) || 1,
            fromMonth: fromM,
            toMonth: '',
            basePremium: 0, nnSupportAmount: 0, dpSupportAmount: 0, amount: 0, discountAmount: 0, penaltyAmount: 0
          }));

          // Xác định phân loại hồ sơ BHXH thông minh:
          const cleanC = (cccdVal || bhxhVal || '').replace(/\D/g, '');
          const hasRenewHistory = (records || []).some(r => {
            if (!r || r.type !== 'BHXH') return false;
            const rPayStatus = r.payment_status || (r as any).paymentStatus;
            if (rPayStatus === 'Đã hủy') return false;
            const rC = (r.cccd || (r as any).citizenId || '').replace(/\D/g, '');
            const rB = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
            const isMatch = Boolean(cleanC && (rC === cleanC || rB === cleanC));
            if (!isMatch) return false;
            const aType = String(r.action_type || (r as any).actionType || '').toLowerCase();
            return aType.includes('gia hạn') || aType.includes('tái tục');
          });

          const recActionStr = String(rec.actionType || (rec as any).action_type || '').toLowerCase();
          const isRecRenew = recActionStr.includes('gia hạn') || recActionStr.includes('tái tục');
          const isCustomerAlreadyRenew = isRecRenew || hasRenewHistory;

          if (isRenew) {
            if (isCustomerAlreadyRenew) {
              // Khách hàng đã được phân loại Gia hạn (từ đại lý khác chuyển sang hoặc đã từng đóng gia hạn)
              setBhxhActionType('Gia hạn');
            } else {
              // Khách hàng mới tham gia chưa từng đóng gia hạn: áp dụng quy tắc 12 tháng đầu tăng mới
              const prevM = getCustomerPreviousBHXHMonths(
                records,
                { cccd: cccdVal, bhxh: bhxhVal },
                null,
                fromM,
                customers
              );
              if (prevM < 12) {
                setBhxhActionType('Tăng mới');
              } else {
                setBhxhActionType('Gia hạn');
              }
            }
          } else {
            if (isCustomerAlreadyRenew) {
              setBhxhActionType('Gia hạn');
            } else {
              setBhxhActionType('Tăng mới');
            }
          }
        } else {
          setBhxhActionType('Tăng mới');
          setFormData({
            gender: initialData?.gender ? (initialData.gender === 'female' ? 'Nữ' : 'Nam') : 'Nam',
            nation: initialData?.nnSupport === 30 ? 'Thiểu_số' : 'Kinh',
            notes: initialData?.notes || ''
          });
          const now = new Date();
          setBhxhCalc(prev => ({
            ...prev,
            income: initialData?.income || settings?.povertyStandard || 1500000, 
            nnSupport: initialData?.nnSupport != null ? initialData.nnSupport : 20, 
            dpSupport: initialData?.dpSupport != null ? initialData.dpSupport : 0, 
            method: initialData?.method || '1', 
            customMonths: initialData?.customMonths || 1,
            fromMonth: initialData?.fromMonth || `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`,
            toMonth: '', basePremium: 0, nnSupportAmount: 0, dpSupportAmount: 0, amount: 0, discountAmount: 0, penaltyAmount: 0,
            roadmap: initialData?.roadmap || null
          }));
        }
      } else {
        if (rec) {
          if (rec.members && rec.members.length > 0) {
            setBhytMembers(rec.members.map((m: any) => ({
              ...m,
              dob: toUIDate(m.dob),
              oldBhxh: m.oldBhxh || m.bhxhCu || (m.bhxh && m.bhxh.length === 10 ? m.bhxh : '') || ''
            })));
          } else {
            setBhytMembers([{
              name: rec.name ? rec.name.split(' (+')[0] : '', cccd: rec.cccd || '', phone: rec.phone || '',
              dob: toUIDate(rec.dob) || '', gender: rec.gender || 'Nam', address: rec.address || '', bhxh: rec.bhxh || '',
              oldBhxh: rec.oldBhxh || rec.bhxhCu || (rec.bhxh && rec.bhxh.length === 10 ? rec.bhxh : '') || ''
            }]);
          }
          setFormData({
            recvName: rec.recvName || (rec.name ? rec.name.split(' (+')[0] : ''), 
            recvPhone: rec.recvPhone || rec.phone || '',
            recvAddress: rec.recvAddress || rec.address || '', 
            recvNotes: rec.notes || ''
          });
          setBhytCalc({ duration: Number(rec.months) || 12, amount: 0 });
        } else {
          const numMembers = initialData?.numMembers || 1;
          const initialMembers = Array.from({ length: numMembers }, () => ({
            name: '', cccd: '', phone: '', dob: '', gender: 'Nam', address: '', bhxh: '', oldBhxh: ''
          }));
          setBhytMembers(initialMembers);
          setFormData({});
          setBhytCalc({ duration: initialData?.duration || 12, amount: 0 });
        }
      }
    }
  }, [isOpen, record, type, isRenew, initialData]);

  useEffect(() => {
    if (type === 'BHXH' && isOpen && formData.nation) {
      if (formData.nation === 'Thiểu_số') {
        setBhxhCalc(prev => ({ ...prev, nnSupport: 30 }));
      } else if (formData.nation === 'Kinh') {
        setBhxhCalc(prev => ({ ...prev, nnSupport: 20 }));
      }
    }
  }, [formData.nation, type, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (type === 'BHXH') {
      const prevMonths = getCustomerPreviousBHXHMonths(
        records,
        { cccd: formData.cccd || record?.cccd, bhxh: formData.bhxh || record?.bhxh },
        isRenew ? null : (record?.id || null),
        bhxhCalc.fromMonth,
        customers
      );

      const calcResult = calculateBHXH(
        bhxhCalc.income,
        bhxhCalc.nnSupport,
        bhxhCalc.dpSupport,
        bhxhCalc.method,
        bhxhCalc.customMonths,
        bhxhCalc.fromMonth,
        settings?.investmentRate !== undefined ? (settings.investmentRate / 100) : CONSTANTS.INTEREST,
        settings?.povertyStandard || CONSTANTS.POVERTY_LINE,
        policies,
        prevMonths
      );

      setBhxhCalc(prev => ({
        ...prev,
        toMonth: calcResult.toMonth,
        basePremium: calcResult.basePremium,
        nnSupportAmount: calcResult.nnSupportAmount,
        dpSupportAmount: calcResult.dpSupportAmount,
        amount: calcResult.amount,
        discountAmount: calcResult.discountAmount,
        penaltyAmount: calcResult.penaltyAmount,
        previousMonths: prevMonths,
        supportedMonthsCount: calcResult.supportedMonthsCount,
        unsupportedMonthsCount: calcResult.unsupportedMonthsCount,
        totalAccumulatedMonths: calcResult.totalAccumulatedMonths
      }));
    } else {
      const dateStr = getLocalYYYYMMDD();
      const activeBaseSalary = policies && policies.length > 0
        ? Number(getPolicyValueForDate(policies, 'base_salary', dateStr, settings?.baseSalary || CONSTANTS.BHYT_BASE))
        : (settings?.baseSalary || CONSTANTS.BHYT_BASE);
      const calcResult = calculateBHYTCoterminous(
        bhytMembers.map(m => ({
          name: m.name,
          durationMonths: Number(m.durationMonths) || bhytCalc.duration
        })),
        activeBaseSalary
      );
      setBhytCalc(prev => ({ ...prev, amount: calcResult.amount, breakdown: calcResult.breakdown }));
    }
  }, [bhxhCalc.income, bhxhCalc.nnSupport, bhxhCalc.dpSupport, bhxhCalc.method, bhxhCalc.customMonths, bhxhCalc.fromMonth, bhytCalc.duration, bhytMembers, isOpen, type, settings, policies, formData.cccd, formData.bhxh, records, isRenew, record]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (type === 'BHXH') {
      const bhxhDateCheck = bhxhFormDateSchema.safeParse({
        dob: formData.dob || '',
        fromMonth: bhxhCalc.fromMonth,
        toMonth: bhxhCalc.toMonth
      });
      if (!bhxhDateCheck.success) {
        showToast(bhxhDateCheck.error.issues[0]?.message || 'Ngày tháng BHXH không hợp lệ');
        return;
      }
      if (errors.dob || errors.cccd || errors.phone || errors.email) {
        showToast('Vui lòng kiểm tra lại thông tin nhập liệu');
        return;
      }
    } else if (type === 'BHYT') {
      const bhytDateCheck = bhytFormDateSchema.safeParse({
        members: bhytMembers.map(m => ({ dob: m.dob || '' }))
      });
      if (!bhytDateCheck.success) {
        showToast(bhytDateCheck.error.issues[0]?.message || 'Ngày sinh thành viên BHYT không hợp lệ');
        return;
      }
    }

    if (!isRenew && !record) {
      if (type === 'BHXH') {
        if (formData.cccd) {
          const existing = await recordService.findRecordByCccd(formData.cccd);
          if (existing) {
            const existingDobStr = existing.dob ? dateISOToVN(existing.dob) : '';
            const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0] || '') : '';
            const newName = formatTitleCase(formData.name) || '';
            if ((newName && existingName !== newName) || (formData.dob && formData.dob.length === 10 && existingDobStr !== formData.dob)) {
              showToast('Cảnh báo: Số CCCD đã tồn tại trong hệ thống nhưng Họ tên hoặc Ngày sinh không khớp!');
              return;
            }
          }
        }
      } else if (type === 'BHYT') {
        for (const m of bhytMembers) {
          if (m.cccd) {
            const existing = await recordService.findRecordByCccd(m.cccd);
            if (existing) {
              const existingDobStr = existing.dob ? dateISOToVN(existing.dob) : '';
              const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0] || '') : '';
              const newName = formatTitleCase(m.name) || '';
              if ((newName && existingName !== newName) || (m.dob && m.dob.length === 10 && existingDobStr !== m.dob)) {
                showToast(`Cảnh báo: Số CCCD ${m.cccd} đã tồn tại nhưng Họ tên hoặc Ngày sinh không khớp!`);
                return;
              }
            }
          }
        }
      }
    }

    const actionType = type === 'BHXH'
      ? bhxhActionType
      : (isRenew ? 'Gia hạn' : (record ? (record.actionType || 'Đăng ký mới') : 'Đăng ký mới'));

    const effectiveIsRenew = type === 'BHXH'
      ? (bhxhActionType === 'Gia hạn')
      : (isRenew || Boolean(actionType.toLowerCase().includes('gia hạn')));
    
    let baseRecordData: any = {
      type,
      actionType,
      action_type: actionType,
      isRenew: effectiveIsRenew,
      paymentStatus: 'Chờ thanh toán'
    };

    let newRecordsToAdd: any[] = [];
    let recordToUpdate: any = null;

    if (type === 'BHXH') {
      const cccdVal = (formData.cccd || '').trim();
      const bhxhVal = (formData.bhxh || '').trim();
      const primaryCode = cccdVal || bhxhVal;
      const dateStrForSnapshot = getLocalYYYYMMDD();
      const currentBaseSalary = policies && policies.length > 0
        ? Number(getPolicyValueForDate(policies, 'base_salary', dateStrForSnapshot, settings?.baseSalary || CONSTANTS.BHYT_BASE))
        : (settings?.baseSalary || CONSTANTS.BHYT_BASE);
      const currentPovertyStandard = policies && policies.length > 0
        ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStrForSnapshot, settings?.povertyStandard || CONSTANTS.POVERTY_LINE))
        : (settings?.povertyStandard || CONSTANTS.POVERTY_LINE);
      const activePolicySalary = policies?.find(p => p.parameter_type === 'base_salary' && p.is_active);

      const oldBhxhVal = (formData.oldBhxh || (bhxhVal && bhxhVal.length === 10 ? bhxhVal : '')).trim();

      let recordData = {
        ...baseRecordData,
        name: formatTitleCase(formData.name) || '',
        cccd: cccdVal || primaryCode,
        phone: formData.phone || '',
        bhxh: bhxhVal || primaryCode,
        old_bhxh: oldBhxhVal || undefined,
        oldBhxh: oldBhxhVal || undefined,
        dob: toDbDate(formData.dob) || null, gender: formData.gender || 'Nam',
        nation: formData.nation || 'Kinh', email: formData.email || '', address: formData.address || '', notes: formData.notes || '',
        income: bhxhCalc.income, nnSupportPct: bhxhCalc.nnSupport, dpSupportPct: bhxhCalc.dpSupport,
        method: document.getElementById('modal-bhxh-method')?.querySelector('option:checked')?.textContent || '',
        months: bhxhCalc.method === 'post_custom' ? bhxhCalc.customMonths : Math.abs(parseInt(bhxhCalc.method.replace('pre_','')) || 1),
        fromMonth: toDbMonth(bhxhCalc.fromMonth) || null, toMonth: toDbMonth(bhxhCalc.toMonth) || null,
        basePremium: bhxhCalc.basePremium, nnSupportAmount: bhxhCalc.nnSupportAmount, dpSupportAmount: bhxhCalc.dpSupportAmount, amount: bhxhCalc.amount,

        // Point-in-time Policy Snapshot
        baseSalarySnapshot: currentBaseSalary,
        povertyStandardSnapshot: currentPovertyStandard,
        policyVersionId: activePolicySalary?.id || undefined,
        appliedRates: {
          nnSupportPct: bhxhCalc.nnSupport,
          dpSupportPct: bhxhCalc.dpSupport,
          investmentRate: settings?.investmentRate !== undefined ? settings.investmentRate : (CONSTANTS.INTEREST * 100),
          bhytRate: CONSTANTS.BHYT_RATE
        }
      };

      if (recordData.toMonth) {
        const { month, year } = parseMonthAndYear(recordData.toMonth);
        const nextD = new Date(year, month, 15);
        recordData.nextPayment = getLocalYYYYMMDD(nextD);
      } else {
        let nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        recordData.nextPayment = getLocalYYYYMMDD(nextYear);
      }

      if (record && !isRenew) {
        recordToUpdate = recordData;
      } else {
        recordData.date = new Date().toISOString();
        recordData.status = 'Đang tham gia';
        recordData.staffId = currentUser ? currentUser.id : 'admin';
        recordData.id = Date.now();
        recordData.idempotencyKey = generateIdempotencyKey();
        newRecordsToAdd.push(recordData);
      }
    } else {
      const now = new Date();
      let startYear = now.getFullYear();
      let startMonth = now.getMonth();
      
      if (isRenew && (record?.toMonth || record?.to_month)) {
        const { month, year } = parseMonthAndYear(record.toMonth || record.to_month);
        const nextD = new Date(year, month, 1);
        startYear = nextD.getFullYear();
        startMonth = nextD.getMonth();
      }

      const fromMonth = `${startYear}-${(startMonth + 1).toString().padStart(2, '0')}`;
      let toDateObj = new Date(startYear, startMonth + bhytCalc.duration - 1, 1);
      const toMonth = `${toDateObj.getFullYear()}-${(toDateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      const nextPayment = getLocalYYYYMMDD(new Date(toDateObj.getFullYear(), toDateObj.getMonth(), 15));
      const method = document.getElementById('modal-bhyt-duration')?.querySelector('option:checked')?.textContent || '';

      const dateStrForBHYT = getLocalYYYYMMDD();
      const baseSalary = policies && policies.length > 0
        ? Number(getPolicyValueForDate(policies, 'base_salary', dateStrForBHYT, settings?.baseSalary || CONSTANTS.BHYT_BASE))
        : (settings?.baseSalary || CONSTANTS.BHYT_BASE);
      const currentPovertyStandard = policies && policies.length > 0
        ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStrForBHYT, settings?.povertyStandard || CONSTANTS.POVERTY_LINE))
        : (settings?.povertyStandard || CONSTANTS.POVERTY_LINE);
      const activePolicySalary = policies?.find(p => p.parameter_type === 'base_salary' && p.is_active);

      const coterminousCalc = calculateBHYTCoterminous(bhytMembers.map(m => ({
        name: m.name,
        durationMonths: Number(m.durationMonths) || bhytCalc.duration
      })), baseSalary);

      const enrichedMembers = bhytMembers.map((m, idx) => {
        const bd = coterminousCalc.breakdown[idx];
        return {
          ...m,
          name: formatTitleCase(m.name),
          dob: toDbDate(m.dob) || null,
          durationMonths: Number(m.durationMonths) || bhytCalc.duration,
          amount: bd ? bd.amount : 0
        };
      });

      if (record && !isRenew) {
        // Update existing record
        const mem0Cccd = (enrichedMembers[0].cccd || '').trim();
        const mem0Bhxh = (enrichedMembers[0].bhxh || '').trim();
        const mem0Id = mem0Cccd || mem0Bhxh;
        const mem0OldBhxh = (enrichedMembers[0].oldBhxh || (mem0Bhxh && mem0Bhxh.length === 10 ? mem0Bhxh : '')).trim();
        let recordData = {
          ...baseRecordData,
          members: enrichedMembers,
          name: enrichedMembers[0].name + (enrichedMembers.length > 1 ? ` (+${enrichedMembers.length - 1} người)` : ''),
          cccd: mem0Cccd || mem0Id,
          phone: enrichedMembers[0].phone || formData.recvPhone || '',
          bhxh: mem0Bhxh || mem0Id,
          old_bhxh: mem0OldBhxh || undefined,
          oldBhxh: mem0OldBhxh || undefined,
          dob: enrichedMembers[0].dob || null, gender: enrichedMembers[0].gender || '',
          address: formData.recvAddress || enrichedMembers[0].address || '', 
          nation: enrichedMembers[0].nation || '', email: enrichedMembers[0].email || '',
          notes: formData.recvNotes || '',
          method,
          months: bhytCalc.duration, income: 0, basePremium: 0, nnSupportAmount: 0, dpSupportAmount: 0, amount: coterminousCalc.amount,
          fromMonth, toMonth, nextPayment,

          // Point-in-time Policy Snapshot
          baseSalarySnapshot: baseSalary,
          povertyStandardSnapshot: currentPovertyStandard,
          policyVersionId: activePolicySalary?.id || undefined,
          appliedRates: {
            bhytRate: CONSTANTS.BHYT_RATE
          }
        };
        recordToUpdate = recordData;
      } else {
        // Create separate records for each member
        enrichedMembers.forEach((m, index) => {
          const bd = coterminousCalc.breakdown[index];
          const memberMonths = Number(m.durationMonths) || bhytCalc.duration;
          const memberAmount = bd ? bd.amount : 0;
          const memberBasePremium = Math.round(baseSalary * CONSTANTS.BHYT_RATE * memberMonths);
          const memberCccd = (m.cccd || '').trim();
          const memberBhxh = (m.bhxh || '').trim();
          const memberIdCode = memberCccd || memberBhxh;
          const memberOldBhxh = (m.oldBhxh || (memberBhxh && memberBhxh.length === 10 ? memberBhxh : '')).trim();
          
          let memberToDateObj = new Date(startYear, startMonth + memberMonths - 1, 1);
          const memberToMonth = `${memberToDateObj.getFullYear()}-${(memberToDateObj.getMonth() + 1).toString().padStart(2, '0')}`;
          const memberNextPayment = getLocalYYYYMMDD(new Date(memberToDateObj.getFullYear(), memberToDateObj.getMonth(), 15));

          let memberRecord = {
            ...baseRecordData,
            name: m.name,
            cccd: memberCccd || memberIdCode,
            phone: m.phone || formData.recvPhone || '',
            bhxh: memberBhxh || memberIdCode,
            old_bhxh: memberOldBhxh || undefined,
            oldBhxh: memberOldBhxh || undefined,
            dob: m.dob || null,
            gender: m.gender || '',
            address: m.address || formData.recvAddress || '',
            nation: m.nation || '',
            email: m.email || '',
            notes: formData.recvNotes || '',
            recvName: formatTitleCase(formData.recvName) || '',
            recvPhone: formData.recvPhone || '',
            recvAddress: formData.recvAddress || '',
            method: `${memberMonths} tháng (${bd ? bd.label : '100%'})`,
            months: memberMonths,
            income: 0,
            basePremium: memberBasePremium,
            nnSupportAmount: 0,
            dpSupportAmount: 0,
            amount: memberAmount,
            fromMonth,
            toMonth: memberToMonth,
            nextPayment: memberNextPayment,
            date: new Date().toISOString(),
            status: 'Đang tham gia',
            staffId: currentUser ? currentUser.id : 'admin',
            id: Date.now() + index,
            idempotencyKey: generateIdempotencyKey(),

            // Point-in-time Policy Snapshot
            baseSalarySnapshot: baseSalary,
            povertyStandardSnapshot: currentPovertyStandard,
            policyVersionId: activePolicySalary?.id || undefined,
            appliedRates: {
              bhytRate: CONSTANTS.BHYT_RATE,
              memberRatePct: bd ? bd.ratePct : 100
            }
          };
          newRecordsToAdd.push(memberRecord);
        });
      }
    }

    try {
      setIsSubmitting(true);
      if (recordToUpdate) {
        if (record) {
          const oldRecord = record;
          const cleanOldCccd = (oldRecord.cccd || (oldRecord as any).citizenId || '').replace(/\D/g, '');
          const cleanOldBhxh = (oldRecord.bhxh || (oldRecord as any).bhxhCode || '').replace(/\D/g, '');
          const targetId = typeof oldRecord.id === 'number' && !isNaN(oldRecord.id)
            ? oldRecord.id
            : (Number(oldRecord.latest_record_id) || (records.find(r => {
                const rCccd = (r.cccd || '').replace(/\D/g, '');
                const rBhxh = (r.bhxh || '').replace(/\D/g, '');
                return (cleanOldCccd && rCccd === cleanOldCccd) || (cleanOldBhxh && rBhxh === cleanOldBhxh);
              })?.id) || Number(recordToUpdate.id));

          if (!targetId || isNaN(targetId)) {
            showToast('Không xác định được mã hồ sơ cần cập nhật!', 'error');
            return;
          }

          recordToUpdate.id = targetId;
          recordToUpdate.date = oldRecord.date || recordToUpdate.date;
          recordToUpdate.status = oldRecord.status || recordToUpdate.status || 'Đang tham gia';
          recordToUpdate.paymentStatus = oldRecord.paymentStatus || recordToUpdate.paymentStatus || 'Đã thu tiền';
          recordToUpdate.staffId = oldRecord.staffId || (currentUser ? currentUser.id : 'admin'); 
          if (type === 'BHYT') {
             recordToUpdate.fromMonth = oldRecord.fromMonth || recordToUpdate.fromMonth;
             recordToUpdate.toMonth = oldRecord.toMonth || recordToUpdate.toMonth;
             recordToUpdate.nextPayment = oldRecord.nextPayment || recordToUpdate.nextPayment;
          }
          const success = await updateRecord(targetId, recordToUpdate);
          if (success) {
            showToast('Cập nhật hồ sơ thành công!');
            onClose();
          }
          return;
        }
      } else if (newRecordsToAdd.length > 0) {
        try {
          if (!currentUser) {
            const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
            if (siteKey && !captchaToken) throw new Error('Vui lòng hoàn thành xác minh bảo mật trước khi gửi yêu cầu.');
            // Khách vãng lai gửi đơn công khai qua RPC an toàn (Server-side Whitelist, Validation & Rate Limit)
            for (const rec of newRecordsToAdd) {
              const rpcRes = await callPublicPortal<{ success?: boolean; message?: string }>('submit', {
                payload: {
                  name: rec.name,
                  cccd: rec.cccd,
                  phone: rec.phone,
                  bhxh: rec.bhxh,
                  dob: rec.dob,
                  gender: rec.gender,
                  nation: rec.nation,
                  email: rec.email,
                  address: rec.address,
                  type: rec.type,
                  method: rec.method,
                  months: rec.months,
                  income: rec.income,
                  fromMonth: rec.fromMonth,
                  toMonth: rec.toMonth,
                  notes: rec.notes,
                  recvName: rec.recvName,
                  recvPhone: rec.recvPhone,
                  recvAddress: rec.recvAddress,
                  members: rec.members,
                  idempotencyKey: rec.idempotencyKey
                }
              }, captchaToken);
              if (!rpcRes?.success) {
                throw new Error(rpcRes?.message || 'Không thể gửi đơn đăng ký.');
              }
            }
            showToast('Đã gửi yêu cầu thành công! Cán bộ thu sẽ liên hệ hướng dẫn bạn.');
            onClose();
            return;
          }

          // Cán bộ thu / Admin đã đăng nhập lưu trực tiếp qua bảng records
          for (const record of newRecordsToAdd) {
            const { id, ...recordWithoutId } = record;
            await addRecord(recordWithoutId);
          }

          showToast(actionType === 'Gia hạn' ? 'Đã ghi nhận giao dịch gia hạn!' : 'Lưu hồ sơ và ghi nhận thu tiền thành công!');
          onClose();
        } catch (error: any) {
          console.error("Lỗi khi thêm hồ sơ:", error);
          setCaptchaResetTrigger(prev => prev + 1);
          showAlert("Thông báo", error.message || "Hệ thống từ chối lưu dữ liệu. Vui lòng liên hệ điểm thu.", "error");
        }
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchCustomerByCode = async (code: string) => {
    if (!code || !code.trim()) return null;
    const cleanCode = code.trim().replace(/\D/g, '');
    
    // Chỉ tìm kiếm khi mã khớp chính xác độ dài Mã BHXH (10 số) hoặc Số CCCD (12 số / 9 số CMND)
    if (cleanCode.length !== 10 && cleanCode.length !== 12 && cleanCode.length !== 9) {
      return null;
    }

    try {
      // 0. ƯU TIÊN GỌI TỪ CONTEXT (Tra cứu trực tiếp từ bảng Master Customers)
      if (fetchCustomerFromContext) {
        const fromCtx = await fetchCustomerFromContext(cleanCode);
        if (fromCtx) {
          if (!fromCtx.income || !fromCtx.method || (!fromCtx.toMonth && !fromCtx.to_month)) {
            const activeRecords = (records || [])
              .filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy')
              .sort((a, b) => {
                const nextA = new Date(a.next_payment || (a as any).nextPayment || 0).getTime();
                const nextB = new Date(b.next_payment || (b as any).nextPayment || 0).getTime();
                if (nextB !== nextA) return nextB - nextA;
                const toMA = a.to_month || (a as any).toMonth || '';
                const toMB = b.to_month || (b as any).toMonth || '';
                if (toMB !== toMA) return toMB.localeCompare(toMA);
                const dateA = new Date(a.date || a.created_at || 0).getTime();
                const dateB = new Date(b.date || b.created_at || 0).getTime();
                if (dateB !== dateA) return dateB - dateA;
                return (Number(b.id) || 0) - (Number(a.id) || 0);
              });

            const foundRec = activeRecords.find(r => {
              const rCccd = (r.cccd || '').replace(/\D/g, '');
              const rBhxh = (r.bhxh || '').replace(/\D/g, '');
              const rOld = (r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
              return rCccd === cleanCode || rBhxh === cleanCode || rOld === cleanCode;
            });

            if (foundRec) {
              return {
                ...foundRec,
                ...fromCtx,
                income: foundRec.income,
                method: foundRec.method,
                fromMonth: foundRec.from_month || (foundRec as any).fromMonth,
                toMonth: foundRec.to_month || (foundRec as any).toMonth,
                nextPayment: foundRec.next_payment || (foundRec as any).nextPayment,
                months: foundRec.months,
                wage: foundRec.wage,
                nnSupportPct: foundRec.nn_support_pct || (foundRec as any).nnSupportPct,
                dpSupportPct: foundRec.dp_support_pct || (foundRec as any).dpSupportPct,
                recvName: foundRec.recv_name || (foundRec as any).recvName,
                recvPhone: foundRec.recv_phone || (foundRec as any).recvPhone,
                recvAddress: foundRec.recv_address || (foundRec as any).recvAddress,
                members: foundRec.members,
                source: 'Danh bạ Khách hàng & Hợp đồng gần nhất'
              };
            }
          }
          return fromCtx;
        }
      }

      // 1. TÌM KIẾM TRONG BỘ NHỚ CỤC BỘ (records từ AppContext) - Luôn ưu tiên thông tin cập nhật gần nhất
      if (records && records.length > 0) {
        const activeRecords = records.filter(r => (r.payment_status || (r as any).paymentStatus) !== 'Đã hủy');

        // Bản ghi có thời điểm CẬP NHẬT GẦN NHẤT (updated_at) để lấy thông tin nhân khẩu mới nhất
        const sortedByUpdate = [...activeRecords].sort((a, b) => {
          const upA = new Date(a.updated_at || a.date || a.created_at || 0).getTime();
          const upB = new Date(b.updated_at || b.date || b.created_at || 0).getTime();
          if (upB !== upA) return upB - upA;
          const dateA = new Date(a.date || a.created_at || 0).getTime();
          const dateB = new Date(b.date || b.created_at || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });

        // Bản ghi có kỳ hạn mới nhất để tính toán gia hạn tiếp theo
        const sortedByContract = [...activeRecords].sort((a, b) => {
          const nextA = new Date(a.next_payment || (a as any).nextPayment || 0).getTime();
          const nextB = new Date(b.next_payment || (b as any).nextPayment || 0).getTime();
          if (nextB !== nextA) return nextB - nextA;
          const toMA = a.to_month || (a as any).toMonth || '';
          const toMB = b.to_month || (b as any).toMonth || '';
          if (toMB !== toMA) return toMB.localeCompare(toMA);
          const dateA = new Date(a.date || a.created_at || 0).getTime();
          const dateB = new Date(b.date || b.created_at || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (Number(b.id) || 0) - (Number(a.id) || 0);
        });

        // 1a. Khớp trên hồ sơ chính
        const foundUpdate = sortedByUpdate.find(r => {
          const rCccd = (r.cccd || '').replace(/\D/g, '');
          const rBhxh = (r.bhxh || '').replace(/\D/g, '');
          const rOldBhxh = (r.old_bhxh || (r as any).oldBhxh || (r as any).bhxhCu || '').replace(/\D/g, '');
          return rCccd === cleanCode || rBhxh === cleanCode || rOldBhxh === cleanCode;
        });

        const foundContract = sortedByContract.find(r => {
          const rCccd = (r.cccd || '').replace(/\D/g, '');
          const rBhxh = (r.bhxh || '').replace(/\D/g, '');
          const rOldBhxh = (r.old_bhxh || (r as any).oldBhxh || (r as any).bhxhCu || '').replace(/\D/g, '');
          return rCccd === cleanCode || rBhxh === cleanCode || rOldBhxh === cleanCode;
        });

        if (foundUpdate) {
          const primaryRec = foundContract || foundUpdate;
          return {
            name: foundUpdate.name,
            dob: foundUpdate.dob,
            gender: foundUpdate.gender,
            nation: foundUpdate.nation,
            cccd: foundUpdate.cccd,
            phone: foundUpdate.phone,
            email: foundUpdate.email,
            address: foundUpdate.address,
            notes: foundUpdate.notes || primaryRec.notes,
            bhxh: foundUpdate.bhxh,
            oldBhxh: foundUpdate.old_bhxh || ((foundUpdate as any).oldBhxh) || (foundUpdate.bhxh && foundUpdate.bhxh.length === 10 ? foundUpdate.bhxh : ''),
            old_bhxh: foundUpdate.old_bhxh || ((foundUpdate as any).oldBhxh) || (foundUpdate.bhxh && foundUpdate.bhxh.length === 10 ? foundUpdate.bhxh : ''),
            income: primaryRec.income,
            method: primaryRec.method,
            fromMonth: primaryRec.from_month || (primaryRec as any).fromMonth,
            toMonth: primaryRec.to_month || (primaryRec as any).toMonth,
            nextPayment: primaryRec.next_payment || (primaryRec as any).nextPayment,
            months: primaryRec.months,
            wage: primaryRec.wage,
            nnSupportPct: primaryRec.nn_support_pct || (primaryRec as any).nnSupportPct,
            dpSupportPct: primaryRec.dp_support_pct || (primaryRec as any).dpSupportPct,
            recvName: foundUpdate.recv_name || (foundUpdate as any).recvName || primaryRec.recv_name || (primaryRec as any).recvName,
            recvPhone: foundUpdate.recv_phone || (foundUpdate as any).recvPhone || primaryRec.recv_phone || (primaryRec as any).recvPhone,
            recvAddress: foundUpdate.recv_address || (foundUpdate as any).recvAddress || primaryRec.recv_address || (primaryRec as any).recvAddress,
            members: foundUpdate.members || primaryRec.members,
            source: 'Hồ sơ giao dịch cập nhật gần nhất'
          };
        }

        // 1b. Khớp trong danh sách thành viên hộ gia đình (members)
        for (const r of activeRecords) {
          if (r.members && Array.isArray(r.members)) {
            const memberFound = (r.members as any[]).find(m => {
              const mCccd = (m.cccd || '').replace(/\D/g, '');
              const mBhxh = (m.bhxh || '').replace(/\D/g, '');
              const mOld = (m.oldBhxh || m.bhxhCu || '').replace(/\D/g, '');
              return mCccd === cleanCode || mBhxh === cleanCode || mOld === cleanCode;
            });
            if (memberFound) {
              return {
                name: memberFound.name,
                dob: memberFound.dob,
                gender: memberFound.gender || 'Nam',
                nation: memberFound.nation || r.nation || 'Kinh',
                cccd: memberFound.cccd || (cleanCode.length === 12 ? cleanCode : r.cccd),
                phone: memberFound.phone || r.phone,
                email: memberFound.email || r.email,
                address: memberFound.address || r.address,
                bhxh: memberFound.bhxh,
                oldBhxh: memberFound.oldBhxh || (memberFound.bhxh && memberFound.bhxh.length === 10 ? memberFound.bhxh : ''),
                source: 'Bộ nhớ CSDL cục bộ'
              };
            }
          }
        }
      }

      // 2. TRUY VẤN TỪ BẢNG records QUA SERVICE (trường hợp record chưa kịp tải về Context)
      try {
        const r = await recordService.findLatestRecordByCode(cleanCode);
        if (r) {
          return {
            name: r.name,
            dob: r.dob,
            gender: r.gender,
            nation: r.nation,
            cccd: r.cccd,
            phone: r.phone,
            email: r.email,
            address: r.address,
            notes: r.notes,
            bhxh: r.bhxh,
            old_bhxh: r.old_bhxh || (r.bhxh && r.bhxh.length === 10 ? r.bhxh : ''),
            oldBhxh: r.old_bhxh || (r.bhxh && r.bhxh.length === 10 ? r.bhxh : ''),
            income: r.income,
            method: r.method,
            fromMonth: r.from_month || (r as any).fromMonth,
            toMonth: r.to_month || (r as any).toMonth,
            nextPayment: r.next_payment || (r as any).nextPayment,
            months: r.months,
            wage: r.wage,
            nnSupportPct: r.nn_support_pct || (r as any).nnSupportPct,
            dpSupportPct: r.dp_support_pct || (r as any).dpSupportPct,
            recvName: r.recv_name || (r as any).recvName,
            recvPhone: r.recv_phone || (r as any).recvPhone,
            recvAddress: r.recv_address || (r as any).recvAddress,
            members: r.members,
            source: 'Máy chủ CSDL'
          };
        }
      } catch (e) {
        console.warn('Tra cứu bảng records không thành công:', e);
      }

      // 3. NẾU CÓ RPC lookup_customer_profile (cán bộ/nhân viên đã đăng nhập)
      if (currentUser) {
        const { data: rpcData, error: rpcError } = await customerService.lookupCustomerProfileRpc(cleanCode);
        if (!rpcError && rpcData && rpcData.length > 0) {
          return {
            ...rpcData[0],
            source: 'RPC CSDL'
          };
        }
      } else {
        // Cổng dịch vụ công
        const existData = await callPublicPortal<any[]>('exists', { code: cleanCode });
        if (existData?.[0]?.customer_exists) {
          return { existsOnly: true };
        }
      }
    } catch (err) {
      console.error("Error fetching customer verification:", err);
    }
    return null;
  };

  const autoFillCustomerInfo = async (code: string, formType: 'BHXH' | 'BHYT', index?: number) => {
    if (!code || !code.trim()) return;
    const cleanCode = code.trim().replace(/\D/g, '');
    
    // Chỉ tự động điền khi Mã BHXH đủ 10 số hoặc CCCD đủ 12/9 số
    if (cleanCode.length !== 10 && cleanCode.length !== 12 && cleanCode.length !== 9) {
      return;
    }

    setIsSearchingCustomer(true);
    try {
      const customer = await fetchCustomerByCode(cleanCode);
      if (!customer || customer.existsOnly) {
        return;
      }
      
      const formattedDob = toUIDate(customer.dob);
      const cleanName = customer.name ? formatTitleCase(customer.name.split(' (+')[0]) : '';

      if (formType === 'BHXH') {
        setFormData((prev: any) => ({
          ...prev,
          name: cleanName || prev.name,
          dob: formattedDob || prev.dob,
          gender: customer.gender || prev.gender || 'Nam',
          nation: customer.nation || prev.nation || 'Kinh',
          cccd: customer.cccd || (cleanCode.length === 12 ? cleanCode : prev.cccd),
          phone: customer.phone || prev.phone,
          email: customer.email || prev.email,
          address: customer.address || prev.address,
          notes: customer.notes || prev.notes,
          bhxh: customer.bhxh || (cleanCode.length === 10 ? cleanCode : prev.bhxh),
          oldBhxh: customer.oldBhxh || customer.bhxhCu || customer.old_bhxh || (customer.bhxh && customer.bhxh.length === 10 ? customer.bhxh : prev.oldBhxh)
        }));

        // Tự động tính kỳ tiếp theo nếu là gia hạn hoặc có toMonth
        let nextStartMonth = '';
        if (isRenew || customer.toMonth || customer.nextPayment) {
          nextStartMonth = calculateNextRenewalMonth(customer.toMonth || customer.to_month, customer.nextPayment || customer.next_payment);
        }

        // Khôi phục mức thu nhập đóng và hình thức đóng cũ nếu có
        if (customer.income) {
          const methodMap: Record<string, string> = {
            'Đóng hằng tháng': '1', 'Đóng 3 tháng': '3', 'Đóng 6 tháng': '6', 'Đóng 12 tháng': '12',
            'Đóng trước 2 năm': 'pre_24', 'Đóng trước 3 năm': 'pre_36', 'Đóng trước 4 năm': 'pre_48', 'Đóng trước 5 năm': 'pre_60',
            'Đóng 1 lần để nghỉ hưu': 'post_custom'
          };
          setBhxhCalc(prev => ({
            ...prev,
            income: Number(customer.income) || prev.income,
            nnSupport: customer.nnSupportPct != null ? Number(customer.nnSupportPct) : (customer.nn_support_pct != null ? Number(customer.nn_support_pct) : prev.nnSupport),
            dpSupport: customer.dpSupportPct != null ? Number(customer.dpSupportPct) : (customer.dp_support_pct != null ? Number(customer.dp_support_pct) : prev.dpSupport),
            method: customer.method ? (methodMap[customer.method] || customer.method) : prev.method,
            fromMonth: nextStartMonth || prev.fromMonth
          }));
        } else if (nextStartMonth) {
          setBhxhCalc(prev => ({
            ...prev,
            fromMonth: nextStartMonth
          }));
        }

        // Tự động phân loại hồ sơ BHXH nếu có dữ liệu lịch sử gia hạn
        const cleanCustCode = (customer.cccd || customer.bhxh || cleanCode || '').replace(/\D/g, '');
        const hasHistoryRenew = (records || []).some(r => {
          if (!r || r.type !== 'BHXH') return false;
          const rPayStatus = r.payment_status || (r as any).paymentStatus;
          if (rPayStatus === 'Đã hủy') return false;
          const rC = (r.cccd || (r as any).citizenId || '').replace(/\D/g, '');
          const rB = (r.bhxh || (r as any).bhxhCode || r.old_bhxh || (r as any).oldBhxh || '').replace(/\D/g, '');
          const isMatch = Boolean(cleanCustCode && (rC === cleanCustCode || rB === cleanCustCode));
          if (!isMatch) return false;
          const aType = String(r.action_type || (r as any).actionType || '').toLowerCase();
          return aType.includes('gia hạn') || aType.includes('tái tục');
        });
        const custActionStr = String((customer as any).action_type || (customer as any).actionType || '').toLowerCase();
        if (hasHistoryRenew || custActionStr.includes('gia hạn') || custActionStr.includes('tái tục')) {
          setBhxhActionType('Gia hạn');
        } else if (isRenew) {
          const prevM = getCustomerPreviousBHXHMonths(
            records,
            { cccd: customer.cccd, bhxh: customer.bhxh },
            null,
            nextStartMonth,
            customers
          );
          if (prevM >= 12) {
            setBhxhActionType('Gia hạn');
          } else {
            setBhxhActionType('Tăng mới');
          }
        }

        setAutoFilledBadge({
          name: cleanName,
          cccd: customer.cccd || cleanCode,
          phone: customer.phone || '',
          source: customer.source || 'CSDL'
        });

        // Xóa lỗi cccd nếu hợp lệ
        setErrors(prev => ({ ...prev, cccd: '', mismatch: '' }));
        showToast(`Đã tự động gọi lại thông tin của ${cleanName || 'khách hàng'} từ CSDL!`);
      } else if (formType === 'BHYT' && index !== undefined) {
        setBhytMembers(prev => {
          const newMembers = [...prev];
          if (!newMembers[index]) return prev;
          newMembers[index] = {
            ...newMembers[index],
            name: cleanName || newMembers[index].name,
            dob: formattedDob || newMembers[index].dob,
            gender: customer.gender || newMembers[index].gender || 'Nam',
            cccd: customer.cccd || (cleanCode.length === 12 ? cleanCode : newMembers[index].cccd),
            phone: customer.phone || newMembers[index].phone,
            address: customer.address || newMembers[index].address,
            nation: customer.nation || newMembers[index].nation || 'Kinh',
            email: customer.email || newMembers[index].email,
            bhxh: customer.bhxh || (cleanCode.length === 10 ? cleanCode : newMembers[index].bhxh),
            oldBhxh: customer.oldBhxh || customer.bhxhCu || customer.old_bhxh || (customer.bhxh && customer.bhxh.length === 10 ? customer.bhxh : newMembers[index].oldBhxh)
          };
          return newMembers;
        });

        if (customer.months) {
          setBhytCalc(prev => ({ ...prev, duration: Number(customer.months) || prev.duration }));
        }

        if (index === 0 && !isRenew && !record) {
          setFormData((prev: any) => ({
            ...prev,
            recvName: cleanName || prev.recvName,
            recvPhone: customer.phone || prev.recvPhone,
            recvAddress: customer.address || prev.recvAddress
          }));
        } else if (isRenew) {
          setFormData((prev: any) => ({
            ...prev,
            recvName: customer.recvName || cleanName || prev.recvName,
            recvPhone: customer.recvPhone || customer.phone || prev.recvPhone,
            recvAddress: customer.recvAddress || customer.address || prev.recvAddress
          }));
        }

        showToast(`Đã tự động gọi lại hồ sơ của thành viên: ${cleanName || 'khách hàng'}!`);
      }
    } catch (error) {
      console.error("Error auto-filling customer info:", error);
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  if (!isOpen) return null;

  const rec = record ? {
    ...record,
    name: record.name || '',
    method: record.method || '',
    fromMonth: record.fromMonth || record.frommonth || record.from_month || '',
    toMonth: record.toMonth || record.tomonth || record.to_month || '',
    recvName: record.recvName || record.recvname || record.recv_name || '',
    recvPhone: record.recvPhone || record.recvphone || record.recv_phone || '',
    recvAddress: record.recvAddress || record.recvaddress || record.recv_address || '',
  } : null;
  const title = isRenew ? `Gia Hạn ${type === 'BHXH' ? 'BHXH Tự Nguyện' : 'BHYT Hộ Gia Đình'}` : (record ? 'Cập Nhật Thông Tin Hồ Sơ' : `Đăng Ký ${type === 'BHXH' ? 'BHXH Tự Nguyện' : 'BHYT Hộ Gia Đình'}`);
  const subtitleText = type === 'BHXH'
    ? (bhxhActionType === 'Tăng mới' ? 'Hồ sơ Tăng mới' : 'Hồ sơ Gia hạn')
    : (isRenew ? 'Hồ sơ Gia hạn' : (record ? 'Cập nhật' : 'Đăng ký mới'));
  const subtitleClass = (type === 'BHXH' ? bhxhActionType === 'Tăng mới' : !isRenew)
    ? 'bg-emerald-500 text-white font-bold'
    : 'bg-tertiary-fixed-dim/90 text-primary-dark font-bold';

  return createPortal(
    <div className="fixed inset-0 bg-primary/70 backdrop-blur-sm z-[100] overflow-y-auto w-full h-full transition-opacity duration-300">
      <div className="min-h-full flex items-start justify-center p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="bg-white text-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl overflow-hidden transform transition-transform duration-300 flex flex-col relative border border-gray-200 my-auto">
          {/* Header */}
          <div className="bg-[#004182] px-5 sm:px-7 py-4 flex justify-between items-center text-white shrink-0 shadow-sm relative z-10">
            <div>
              <h3 className="font-display text-lg md:text-xl font-extrabold leading-tight mb-0.5">{title}</h3>
              <span className={`text-[11px] px-2.5 py-0.5 rounded-full inline-block font-bold ${subtitleClass}`}>{subtitleText}</span>
            </div>
            <button type="button" onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-xl transition-all cursor-pointer">
              <X size={22} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 lg:p-7 flex-1 min-h-0">
            <form onSubmit={handleSave}>
              {errors.mismatch && (
                <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs sm:text-sm font-medium">
                  <strong>Lưu ý:</strong> {errors.mismatch}
                </div>
              )}
              {isRenew && rec && (
                <div className="bg-blue-50/60 p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm mb-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-3">
                    <div>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Khách hàng</p>
                      <p className="text-lg font-black text-[#004182] uppercase">
                        {rec.name ? (currentUser ? rec.name.split(' (+')[0] : maskName(rec.name.split(' (+')[0], false)) : '---'}
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Số ĐDCN / CCCD</p>
                      <p className="text-base font-black text-blue-600 font-mono tabular-nums">
                        {currentUser ? (rec.cccd || rec.citizenId || rec.bhxh) : maskCCCD(rec.cccd || rec.citizenId || rec.bhxh, false)}
                      </p>
                    </div>
                  </div>

                  {!currentUser && (
                    <div className="px-3.5 py-2 bg-emerald-50/80 border border-emerald-200/70 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
                      <ShieldCheck size={15} className="shrink-0 text-emerald-600" />
                      <span>
                        <strong>Tuân thủ Nghị định 13/2023/NĐ-CP:</strong> Dữ liệu CCCD, SĐT và Mã BHXH đang được tự động che dấu bảo vệ quyền riêng tư cá nhân.
                      </span>
                    </div>
                  )}
                  {(() => {
                    let fromMStr = formatMonthVN(rec.fromMonth);
                    let toMStr = formatMonthVN(rec.toMonth);
                    if ((!fromMStr || !toMStr) && rec.nextPayment) {
                      const np = new Date(rec.nextPayment);
                      if (!isNaN(np.getTime())) {
                        const prevM = new Date(np.getFullYear(), np.getMonth() - 1, 1);
                        const fallbackMStr = `${String(prevM.getMonth() + 1).padStart(2, '0')}/${prevM.getFullYear()}`;
                        if (!fromMStr) fromMStr = fallbackMStr;
                        if (!toMStr) toMStr = fallbackMStr;
                      }
                    }
                    return (
                      <div className="space-y-1.5">
                        <p className="text-xs sm:text-sm text-gray-700 flex items-center font-medium">
                          <Clock className="text-[#004182] mr-1.5 shrink-0" size={15} /> Thời gian đóng trước đó: <strong className="text-gray-900 ml-1">{rec.method || 'Đóng hằng tháng'}</strong> (từ tháng {fromMStr || '---'} - {toMStr || '---'})
                        </p>
                        {type === 'BHXH' && (
                          <div className="pt-2 border-t border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="text-gray-600">
                              Tổng thời gian đã tích lũy: <strong className="text-[#004182] font-black">{bhxhCalc.previousMonths || 0} tháng ({Math.floor((bhxhCalc.previousMonths || 0) / 12)} năm {(bhxhCalc.previousMonths || 0) % 12 > 0 ? `${(bhxhCalc.previousMonths || 0) % 12} tháng` : ''})</strong>
                            </span>
                            {(bhxhCalc.previousMonths || 0) >= 120 ? (
                              <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[11px] bg-amber-100 text-amber-900 border border-amber-300">
                                Đã hết hạn hỗ trợ 10 năm NSNN (Đóng 100% gốc)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full font-extrabold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                                Đã dùng {(bhxhCalc.previousMonths || 0)}/120 tháng hỗ trợ
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Bố cục 2 khu vực: Bên Trái (Thông tin & Mức đóng) - Bên Phải (Tổng kết & Xác nhận) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* KHU VỰC BÊN TRÁI: THÔNG TIN CÁ NHÂN & THIẾT LẬP MỨC ĐÓNG (7/12 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Mục 1: Thông Tin Cá Nhân Người Tham Gia */}
                  {type === 'BHXH' && !isRenew && (
                    <BHXHForm
                      formData={formData}
                      setFormData={setFormData}
                      errors={errors}
                      isRenew={isRenew}
                      recordId={record?.id}
                      autoFillCustomerInfo={autoFillCustomerInfo}
                      handleDOBChange={handleDOBChange}
                      handleCCCDChange={handleCCCDChange}
                      handlePhoneChange={handlePhoneChange}
                      handleEmailChange={handleEmailChange}
                      isSearchingCustomer={isSearchingCustomer}
                      autoFilledBadge={autoFilledBadge}
                      bhxhCalc={bhxhCalc}
                    />
                  )}

                  {type === 'BHYT' && !isRenew && (
                    <BHYTForm
                      bhytMembers={bhytMembers}
                      setBhytMembers={setBhytMembers}
                      isRenew={isRenew}
                      recordId={record?.id}
                      autoFillCustomerInfo={autoFillCustomerInfo}
                      setFormData={setFormData}
                      isSearchingCustomer={isSearchingCustomer}
                    />
                  )}

                  {/* Phân loại nghiệp vụ hồ sơ BHXH: Nút tích chọn Tăng mới vs Gia hạn */}
                  {type === 'BHXH' && (
                    <BHXHActionTypeSelector
                      actionType={bhxhActionType}
                      onChange={setBhxhActionType}
                      previousMonths={bhxhCalc.previousMonths || 0}
                      commBHXHNewPct={commRates.commBHXHNewPct}
                      commBHXHRenewPct={commRates.commBHXHRenewPct}
                      isRenew={isRenew}
                      hasPreviousRenew={hasPreviousRenew}
                    />
                  )}

                  {/* Mục 2: Thiết Lập Mức Đóng */}
                  {type === 'BHXH' && (
                    <BHXHCalcSettings
                      bhxhCalc={bhxhCalc}
                      setBhxhCalc={setBhxhCalc}
                    />
                  )}

                  {type === 'BHYT' && (
                    <BHYTCalcSettings
                      bhytMembers={bhytMembers}
                      setBhytMembers={setBhytMembers}
                      bhytCalc={bhytCalc}
                      setBhytCalc={setBhytCalc}
                      formData={formData}
                      setFormData={setFormData}
                      isRenew={isRenew}
                      recordId={record?.id}
                    />
                  )}
                </div>

                {/* KHU VỰC BÊN PHẢI: TỔNG KẾT ĐĂNG KÝ & THANH TOÁN (5/12 cols) */}
                <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
                  <RegisterSummary
                    type={type}
                    isRenew={isRenew}
                    bhxhActionType={bhxhActionType}
                    commBHXHNewPct={commRates.commBHXHNewPct}
                    commBHXHRenewPct={commRates.commBHXHRenewPct}
                    bhxhCalc={bhxhCalc}
                    bhytCalc={bhytCalc}
                    bhytMembers={bhytMembers}
                    customerInfo={{
                      name: formData.name || (rec ? rec.name : '') || (bhytMembers[0]?.name) || '',
                      cccd: formData.cccd || (rec ? rec.cccd : '') || (bhytMembers[0]?.cccd) || '',
                      bhxh: formData.bhxh || (rec ? rec.bhxh : '') || '',
                      phone: formData.phone || (rec ? rec.phone : '') || (bhytMembers[0]?.phone) || '',
                      notes: formData.notes || (rec ? rec.notes : '') || ''
                    }}
                    qrConfig={settings}
                  />

                  {!currentUser && (
                    <TurnstileCaptcha onToken={setCaptchaToken} resetTrigger={captchaResetTrigger} />
                  )}

                  {/* Nút hành động Lưu & Xác Nhận / Hủy bỏ */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className={`w-full py-3.5 px-6 rounded-xl bg-[#004182] hover:bg-blue-900 text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg transition-all transform active:scale-98 flex items-center justify-center ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Đang lưu hồ sơ...
                        </>
                      ) : (
                        <>
                          <Check size={20} className="mr-2 stroke-[3px]" /> 
                          {isRenew 
                            ? (type === 'BHXH' ? (bhxhActionType === 'Tăng mới' ? 'Xác Nhận Đóng Tăng Mới' : 'Xác Nhận Gia Hạn') : 'Xác Nhận Gia Hạn') 
                            : (record ? 'Lưu & Cập Nhật' : 'Lưu & Xác Nhận')}
                        </>
                      )}
                    </button>
                    <button 
                      type="button" 
                      disabled={isSubmitting}
                      onClick={onClose} 
                      className="w-full py-2.5 px-4 rounded-xl text-gray-600 hover:text-gray-900 font-bold hover:bg-gray-200/60 transition border border-gray-200 bg-white cursor-pointer text-sm text-center disabled:opacity-50"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RegisterModal;
