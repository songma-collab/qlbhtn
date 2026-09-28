import React, { useState, useEffect } from 'react';
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
import { X, Check, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { callPublicPortal } from '../../utils/publicPortal';
import TurnstileCaptcha from '../TurnstileCaptcha';
import { generateIdempotencyKey, dbToRecord } from '../../utils/sanitize';

import BHXHForm from './register/BHXHForm';
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
      
      if (type === 'BHXH') {
        if (rec) {
          const cccdVal = rec.cccd || rec.citizenId || '';
          const bhxhVal = rec.bhxh || rec.bhxhCode || (rec.type === 'BHXH' ? rec.code : '') || '';
          const nationVal = rec.nation || (rec.nnSupportPct === 30 || rec.nnSupport === 30 ? 'Thiểu_số' : 'Kinh');
          
          let fromM = toUIMonth(rec.fromMonth) || '';
          if (isRenew) {
            fromM = calculateNextRenewalMonth(rec.toMonth, rec.nextPayment);
          }

          let initialNotes = isRenew ? '' : (rec.notes || '');

          setFormData({
            name: rec.name || rec.fullName || '', 
            cccd: cccdVal, 
            phone: rec.phone || '', 
            bhxh: bhxhVal,
            oldBhxh: rec.oldBhxh || rec.bhxhCu || (bhxhVal.length === 10 ? bhxhVal : '') || '',
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
            : (rec.nnSupport != null 
                ? Number(rec.nnSupport) 
                : (nationVal === 'Thiểu_số' ? 30 : 20));

          setBhxhCalc(prev => ({
            ...prev,
            income: Number(rec.income) || settings?.povertyStandard || 1500000,
            nnSupport: nnSupportVal,
            dpSupport: rec.dpSupportPct != null ? Number(rec.dpSupportPct) : (rec.dpSupport != null ? Number(rec.dpSupport) : 0),
            method: methodVal,
            customMonths: Number(rec.months) || 1,
            fromMonth: fromM,
            toMonth: '',
            basePremium: 0, nnSupportAmount: 0, dpSupportAmount: 0, amount: 0, discountAmount: 0, penaltyAmount: 0
          }));
        } else {
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
          const { data } = await supabase.from('records').select('name, dob, cccd').eq('cccd', formData.cccd).limit(1);
          const existing = data?.[0];
          if (existing) {
            const existingDobStr = existing.dob ? dateISOToVN(existing.dob) : '';
            const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0]) : '';
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
            const { data } = await supabase.from('records').select('name, dob, cccd').eq('cccd', m.cccd).limit(1);
            const existing = data?.[0];
            if (existing) {
              const existingDobStr = existing.dob ? dateISOToVN(existing.dob) : '';
              const existingName = existing.name ? formatTitleCase(existing.name.split(' (+')[0]) : '';
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

    const actionType = isRenew ? 'Gia hạn' : (record ? (record.actionType || 'Đăng ký mới') : 'Đăng ký mới');
    
    let baseRecordData: any = {
      type,
      actionType,
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
          recordToUpdate.id = oldRecord.id;
          recordToUpdate.date = oldRecord.date;
          recordToUpdate.status = oldRecord.status;
          recordToUpdate.paymentStatus = oldRecord.paymentStatus;
          recordToUpdate.staffId = oldRecord.staffId; 
          if (type === 'BHYT') {
             recordToUpdate.fromMonth = oldRecord.fromMonth;
             recordToUpdate.toMonth = oldRecord.toMonth;
             recordToUpdate.nextPayment = oldRecord.nextPayment;
          }
          const success = await updateRecord(recordToUpdate.id, recordToUpdate);
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

          showToast(isRenew ? 'Đã ghi nhận giao dịch gia hạn!' : 'Lưu hồ sơ và ghi nhận thu tiền thành công!');
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
        if (fromCtx) return fromCtx;
      }

      // 1. TÌM KIẾM TRONG BỘ NHỚ CỤC BỘ (records từ AppContext) - Tốc độ tức thì (0ms)
      if (records && records.length > 0) {
        // Ưu tiên các bản ghi không bị hủy, sắp xếp mới nhất
        const activeRecords = records.filter(r => r.paymentStatus !== 'Đã hủy');
        
        // 1a. Khớp trên hồ sơ chính
        const found = activeRecords.find(r => {
          const rCccd = (r.cccd || '').replace(/\D/g, '');
          const rBhxh = (r.bhxh || '').replace(/\D/g, '');
          const rOldBhxh = (r.oldBhxh || (r as any).bhxhCu || (r as any).old_bhxh || '').replace(/\D/g, '');
          return rCccd === cleanCode || rBhxh === cleanCode || rOldBhxh === cleanCode;
        });

        if (found) {
          return {
            name: found.name,
            dob: found.dob,
            gender: found.gender,
            nation: found.nation,
            cccd: found.cccd,
            phone: found.phone,
            email: found.email,
            address: found.address,
            notes: found.notes,
            bhxh: found.bhxh,
            oldBhxh: found.oldBhxh || (found as any).bhxhCu || (found as any).old_bhxh || (found.bhxh && found.bhxh.length === 10 ? found.bhxh : ''),
            income: found.income,
            method: found.method,
            nnSupportPct: found.nnSupportPct,
            dpSupportPct: found.dpSupportPct,
            source: 'Bộ nhớ CSDL cục bộ'
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

      // 2. TRUY VẤN TRỰC TIẾP TỪ BẢNG records SUPABASE (trường hợp record chưa kịp tải về Context)
      try {
        const { data: dbRecords, error: dbErr } = await supabase
          .from('records')
          .select('*')
          .or(`cccd.eq.${cleanCode},bhxh.eq.${cleanCode},old_bhxh.eq.${cleanCode}`)
          .order('date', { ascending: false })
          .limit(1);

        if (!dbErr && dbRecords && dbRecords.length > 0) {
          const r = dbToRecord(dbRecords[0]);
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
            old_bhxh: r.old_bhxh || r.oldBhxh || (r.bhxh && r.bhxh.length === 10 ? r.bhxh : ''),
            oldBhxh: r.old_bhxh || r.oldBhxh || (r.bhxh && r.bhxh.length === 10 ? r.bhxh : ''),
            income: r.income,
            method: r.method,
            nnSupportPct: r.nnSupportPct,
            dpSupportPct: r.dpSupportPct,
            source: 'Máy chủ CSDL'
          };
        }
      } catch (e) {
        console.warn('Tra cứu bảng records Supabase không thành công:', e);
      }

      // 3. NẾU CÓ RPC lookup_customer_profile (cán bộ/nhân viên đã đăng nhập)
      if (currentUser) {
        const { data: rpcData, error: rpcError } = await supabase.rpc('lookup_customer_profile', { p_code: cleanCode });
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
            nnSupport: customer.nnSupportPct != null ? Number(customer.nnSupportPct) : prev.nnSupport,
            dpSupport: customer.dpSupportPct != null ? Number(customer.dpSupportPct) : prev.dpSupport,
            method: customer.method ? (methodMap[customer.method] || customer.method) : prev.method
          }));
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

        if (index === 0 && !isRenew && !record) {
          setFormData((prev: any) => ({
            ...prev,
            recvName: cleanName || prev.recvName,
            recvPhone: customer.phone || prev.recvPhone,
            recvAddress: customer.address || prev.recvAddress
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
  const subtitleText = isRenew ? 'Hồ sơ Gia hạn' : (record ? 'Cập nhật' : 'Đăng ký mới');
  const subtitleClass = isRenew ? 'bg-tertiary-fixed-dim/90 text-primary-dark font-bold' : 'bg-white/20 text-white';

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
                <div className="bg-blue-50/60 p-4 sm:p-5 rounded-2xl border border-blue-100 shadow-sm mb-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-3 mb-3">
                    <div>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Khách hàng</p>
                      <p className="text-lg font-black text-[#004182] uppercase">{rec.name ? rec.name.split(' (+')[0] : '---'}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Số ĐDCN / CCCD</p>
                      <p className="text-base font-black text-blue-600">{rec.cccd || rec.citizenId || rec.bhxh}</p>
                    </div>
                  </div>
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
                          {isRenew ? 'Xác Nhận Gia Hạn' : (record ? 'Lưu & Cập Nhật' : 'Lưu & Xác Nhận')}
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
