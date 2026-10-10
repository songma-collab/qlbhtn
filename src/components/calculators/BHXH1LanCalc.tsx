import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { CONSTANTS } from '../../utils/constants';
import { formatMoney, getInt, getLocalYYYYMMDD } from '../../utils/helpers';
import { formatMonthInputMask, formatDateInputMask, formatDateToVN, formatMonthToVN } from '../../utils/dateFormatter';
import { getPolicyValueForDate } from '../../utils/calculations';
import { SlidersHorizontal, Calendar, Info, ChevronDown, ChevronUp, FileDown, Download, AlertTriangle, History, Plus, Zap, FileSpreadsheet, FileText, Receipt, Trash2, Camera, Lock, UserCheck } from 'lucide-react';
import { protectWorksheetFormulas, validateExcelFile } from '../../utils/excelSecurity';
import { callGeminiOcrClientSide } from '../../utils/geminiFallback';
import { compressImageForOcr, normalizeOcrPeriods, PeriodItem } from '../../utils/ocrHelper';
import { parseMonthAndYear, normalizePeriod } from '../../utils/dateStandardHelper';

type Period = PeriodItem;

const BHXH1LanCalc = () => {
  const { showAlert, showToast, settings, policies, currentUser } = useAppContext();

  const [gender, setGender] = useState('male');
  const [stopDate, setStopDate] = useState('');
  const [benefitMonth, setBenefitMonth] = useState('');
  const [support, setSupport] = useState(0.2);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [eligibleDate, setEligibleDate] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [systemCore, setSystemCore] = useState<any>({ ready: false });
  const [calcTuat, setCalcTuat] = useState(false);
  const [deathDate, setDeathDate] = useState('');
  const [isPensionOptionsOpen, setIsPensionOptionsOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [loadedCustomer, setLoadedCustomer] = useState<{ name?: string; cccd?: string; bhxh?: string } | null>(null);
  const calc1LanRef = useRef<((override?: Period[]) => void) | null>(null);

  const getCurrentMonthVN = () => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return `${m}/${y}`;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  const handleOcrImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Yêu cầu bắt buộc đăng nhập tài khoản Cán bộ / Đại lý
    if (!currentUser) {
      showAlert(
        'Yêu cầu Đăng nhập Cán bộ',
        'Tính năng Quét Sổ AI bằng mô hình trí tuệ nhân tạo Gemini chỉ dành riêng cho Cán bộ / Đại lý thu BHXH đã đăng nhập hệ thống. Quý khách vui lòng đăng nhập tài khoản để sử dụng tính năng này.',
        'warning'
      );
      if (e.target) e.target.value = '';
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('Dung lượng tệp tin quá lớn (tối đa 20MB cho file Ảnh/PDF)!');
      if (e.target) e.target.value = '';
      return;
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setOcrLoading(true);
    showToast(`Đang phân tích và bóc tách ${isPdf ? 'file PDF' : 'ảnh'} Sổ BHXH/VssID bằng AI...`);

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
      const extracted = normalizeOcrPeriods(rawPeriods).map(normalizePeriod);

      if (extracted.length > 0) {
        setPeriods(extracted);
        const firstP = extracted[0];
        const lastP = extracted[extracted.length - 1];
        if (firstP && lastP) {
          showToast(`Đã nhận diện thành công ${extracted.length} giai đoạn đóng BHXH (Từ ${firstP.fromMonth || `T${firstP.sm}/${firstP.sy}`} đến ${lastP.toMonth || `T${lastP.em}/${lastP.ey}`})!`);
        }
      } else {
        showToast('Không tìm thấy dữ liệu quá trình đóng BHXH hợp lệ trong tài liệu này.');
      }
    } catch (err: any) {
      console.error("OCR Error:", err);
      showAlert("Lỗi Quét AI", err.message || "Có lỗi xảy ra khi phân tích tài liệu bằng AI.", "error");
    } finally {
      setOcrLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    try {
      const savedTransfer = sessionStorage.getItem('TRANSFER_TO_BHXH1LAN');
      if (savedTransfer) {
        const parsed = JSON.parse(savedTransfer);
        if (parsed?.periods && Array.isArray(parsed.periods) && parsed.periods.length > 0) {
          const normalized = parsed.periods.map(normalizePeriod);
          setPeriods(normalized);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.customerName || parsed.customerCccd || parsed.customerBhxh) {
            setLoadedCustomer({
              name: parsed.customerName,
              cccd: parsed.customerCccd,
              bhxh: parsed.customerBhxh
            });
          }
          sessionStorage.removeItem('TRANSFER_TO_BHXH1LAN');
          const custInfo = parsed.customerName ? `của khách hàng ${parsed.customerName}` : '';
          showToast(`Đã nhận diện & nạp ${normalized.length} giai đoạn đóng BHXH ${custInfo}!`, 'success');

          if (parsed.autoCalculate) {
            setTimeout(() => {
              if (calc1LanRef.current) {
                calc1LanRef.current(normalized);
              }
            }, 250);
          }
          return;
        }
      }
    } catch (_) {}
    addPeriod();
  }, []);

  const checkPolicy1Lan = (date: string) => {
    setStopDate(date);
    if (date) {
      const d = new Date(date);
      d.setFullYear(d.getFullYear() + 1);
      setEligibleDate(d.toLocaleDateString('vi-VN'));
      
      // Auto-set benefit month to 12 months after stop date
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const y = d.getFullYear();
      setBenefitMonth(`${m}/${y}`);
    } else {
      setEligibleDate('');
    }
  };

  const addPeriod = (init?: Partial<Period>) => {
    const currentYear = new Date().getFullYear();
    const newPeriod: Period = normalizePeriod({
      id: Date.now() + Math.random(),
      type: init?.type || 'batbuoc',
      fromMonth: init?.fromMonth || `01/${currentYear}`,
      toMonth: init?.toMonth || `12/${currentYear}`,
      sm: init?.sm || 1,
      sy: init?.sy || currentYear,
      em: init?.em || 12,
      ey: init?.ey || currentYear,
      salary: init?.salary || ''
    });
    setPeriods([...periods, newPeriod]);
  };

  const removePeriod = (id: number) => {
    setPeriods(periods.filter(p => p.id !== id));
  };

  const updatePeriod = (id: number, field: keyof Period | string, value: any) => {
    setPeriods(periods.map(p => {
      if (p.id === id) {
        let newVal = value;
        if (field === 'salary' && p.type !== 'nhanuoc') {
          let v = value.replace(/\D/g, "");
          newVal = v ? new Intl.NumberFormat('vi-VN').format(Number(v)) : "";
        }

        if (field === 'fromMonth') {
          const masked = formatMonthInputMask(String(value));
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

        if (field === 'toMonth') {
          const masked = formatMonthInputMask(String(value));
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
        
        const updatedPeriod = { ...p, [field]: newVal };
        
        // Validate dates
        if (field === 'sm' || field === 'sy' || field === 'em' || field === 'ey') {
          const startMonth = Number(updatedPeriod.sm) || 1;
          const startYear = Number(updatedPeriod.sy) || 0;
          const endMonth = Number(updatedPeriod.em) || 12;
          const endYear = Number(updatedPeriod.ey) || 0;
          
          if (endYear < startYear || (endYear === startYear && endMonth < startMonth)) {
            showAlert("Lỗi thời gian", "Thời gian kết thúc không được nhỏ hơn thời gian bắt đầu.", "warning");
            return p;
          }

          updatedPeriod.fromMonth = `${String(startMonth).padStart(2, '0')}/${startYear}`;
          updatedPeriod.toMonth = `${String(endMonth).padStart(2, '0')}/${endYear}`;
          updatedPeriod.months = Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);
        }
        
        return updatedPeriod;
      }
      return p;
    }));
  };

  const getHistoricalLCS = (m: number, y: number) => {
    if (policies && policies.length > 0) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const hasPolicy = policies.some(p => p.parameter_type === 'base_salary' && p.effective_date <= dateStr);
      if (hasPolicy) {
        return Number(getPolicyValueForDate(
          policies,
          'base_salary',
          dateStr,
          settings?.baseSalary || 2340000
        ));
      }
    }
    const absM = y * 12 + m;
    if (absM >= 2024 * 12 + 7) return settings?.baseSalary || 2340000;
    if (absM >= 2023 * 12 + 7) return 1800000;
    if (absM >= 2019 * 12 + 7) return 1490000;
    if (absM >= 2018 * 12 + 7) return 1390000;
    if (absM >= 2017 * 12 + 7) return 1300000;
    if (absM >= 2016 * 12 + 5) return 1210000;
    return 1150000;
  };

  const calc1Lan = (overridePeriods?: Period[]) => {
    try {
      if (calcTuat && !deathDate) {
        return showAlert("Thiếu dữ liệu", "Vui lòng nhập Ngày tử vong (Ngày chết) để tính chế độ tử tuất!", "warning");
      }

      const activePeriods = (overridePeriods && Array.isArray(overridePeriods) && overridePeriods.length > 0)
        ? overridePeriods
        : periods;

      if (!activePeriods || activePeriods.length === 0) {
        return showAlert("Chưa có dữ liệu", "Vui lòng nhập quá trình tham gia BHXH!", "warning");
      }

      let tAdj = 0, tM = 0, tD = 0, mPreCount = 0, mPostCount = 0, bd: any[] = [], stateM_old: any[] = [], startY = 9999;
      let bhtnCheck: any[] = [];
      let compulsoryMonths = 0;
      let voluntaryMonths = 0;

      let resolvedDate = new Date().toISOString().split('T')[0] ?? '';
      if (benefitMonth && benefitMonth.trim()) {
        const { month, year } = parseMonthAndYear(benefitMonth);
        resolvedDate = `${year}-${String(month).padStart(2, '0')}-01`;
      } else if (stopDate) {
        resolvedDate = stopDate;
      } else if (deathDate) {
        resolvedDate = deathDate;
      }

      activePeriods.forEach(r => { if (r.sy < startY) startY = r.sy; });
      activePeriods.forEach(r => {
        const type = r.type, sm = Number(r.sm), sy = Number(r.sy), em = Number(r.em), ey = Number(r.ey);
        let vStr = r.salary, v = (type === 'nhanuoc' ? parseFloat(String(vStr).replace(',', '.')) : getInt(vStr));

        if (!v || v <= 0) return;
        let absS = sy * 12 + sm, absE = ey * 12 + em;
        if (absE < absS) return;

        for (let i = absS; i <= absE; i++) {
          let y = Math.floor((i - 1) / 12), m = ((i - 1) % 12) + 1, adj = 0, ded = 0, curLCS = 0;
          let yrK = (y < 1995) ? 1994 : y;
          const DEFAULT_CPI: Record<number, number> = { 2026: 1.0, 2025: 1.0, 2024: 1.03, 2023: 1.07, 2022: 1.11, 2021: 1.14, 2020: 1.16, 2019: 1.20, 2018: 1.23, 2017: 1.28, 2016: 1.32, 2015: 1.36, 2014: 1.36, 2013: 1.42, 2012: 1.51, 2011: 1.65, 2010: 1.96, 2009: 2.14, 2008: 2.29, 2007: 2.81, 2006: 3.05, 2005: 3.27, 2004: 3.54, 2003: 3.81, 2002: 3.94, 2001: 4.09, 2000: 4.07, 1999: 4.01, 1998: 4.18, 1997: 4.50, 1996: 4.65, 1995: 4.91, 1994: 5.81 };
          
          const targetDateForCPI = resolvedDate;
          const cpiVal = policies && policies.length > 0
            ? getPolicyValueForDate(policies, 'cpi_index', targetDateForCPI, settings?.cpiIndex || DEFAULT_CPI)
            : (settings?.cpiIndex || DEFAULT_CPI);
          
          const cpiMap = typeof cpiVal === 'string' ? JSON.parse(cpiVal) : cpiVal;
          let coef = cpiMap[yrK.toString()] || DEFAULT_CPI[yrK] || 1.0;

          if (type === 'nhanuoc') {
            if (startY < 2016) {
              const targetDate = resolvedDate;
              curLCS = policies && policies.length > 0
                ? Number(getPolicyValueForDate(policies, 'base_salary', targetDate, settings?.baseSalary || CONSTANTS.BHYT_BASE))
                : (settings?.baseSalary || CONSTANTS.BHYT_BASE);
              coef = 1.0;
              adj = v * curLCS * coef;
              stateM_old.push({ abs: i, sal: adj });
            } else {
              curLCS = getHistoricalLCS(m, y);
              adj = v * curLCS * coef;
            }
          } else {
            adj = v * coef;
          }

          if (type === 'tunguyen' && y >= 2018) {
            const dateStr = `${y}-${String(m).padStart(2, '0')}-01`;
            const curPoverty = policies && policies.length > 0
              ? Number(getPolicyValueForDate(policies, 'poverty_standard', dateStr, settings?.povertyStandard || 1500000))
              : (settings?.povertyStandard || 1500000);
            ded = curPoverty * 0.22 * support;
          }
          tAdj += adj; tD += ded; tM++;
          if (y < 2014) mPreCount++; else mPostCount++;

          const targetDateForLCS = resolvedDate;
          const activeBaseSalary = policies && policies.length > 0
            ? Number(getPolicyValueForDate(policies, 'base_salary', targetDateForLCS, settings?.baseSalary || CONSTANTS.BHYT_BASE))
            : (settings?.baseSalary || CONSTANTS.BHYT_BASE);

          if (type === 'batbuoc' || type === 'nhanuoc') { 
            bhtnCheck.push({ sal: (type === 'nhanuoc' ? v * activeBaseSalary : v) }); 
            compulsoryMonths++;
          } else if (type === 'tunguyen') {
            voluntaryMonths++;
          }

          let key = y + "-" + type + "-" + v + "-" + curLCS; let ex = bd.find(x => x.key === key);
          if (!ex) bd.push({ key, year: y, type, val: v, lcs: curLCS, sM: m, eM: m, mC: 1, tA: adj, tD: ded, coef }); else { ex.eM = m; ex.mC++; ex.tA += adj; ex.tD += ded; }
        }
      });
      if (tM === 0) return showAlert("Chưa có dữ liệu", "Vui lòng nhập quá trình tham gia BHXH!", "warning");

      let mbq = tAdj / tM;
      if (stateM_old.length > 0 && startY < 2016) {
        let yT = (startY < 1995) ? 5 : (startY < 2001) ? 6 : (startY < 2007) ? 8 : (startY < 2016) ? 10 : 15;
        let numMonths = yT * 12;
        if (stateM_old.length < numMonths) { numMonths = stateM_old.length; }
        let lastN = stateM_old.slice(-numMonths);
        let avgLastN = lastN.reduce((a, c) => a + c.sal, 0) / (lastN.length || 1);
        let sumState = avgLastN * stateM_old.length;
        let sumOther = tAdj - stateM_old.reduce((a, c) => a + c.sal, 0);
        mbq = (sumState + sumOther) / tM;
      }

      const rY = (m: number) => { let y = Math.floor(m / 12), r = m % 12; return r >= 7 ? y + 1.0 : (r >= 1 ? y + 0.5 : y); };
      let yTot = rY(tM), yPre = rY(mPreCount), yPost = Math.max(0, rY(tM) - yPre);

      let bSal = 0, bM = 0, bMbqActual = 0;
      if (bhtnCheck.length >= 12) {
        let last6 = bhtnCheck.slice(-6);
        bMbqActual = (last6.reduce((a, c) => a + c.sal, 0) / 6);
        bSal = bMbqActual * 0.6;
        bM = Math.min(12, (bhtnCheck.length <= 36 ? 3 : 3 + Math.floor((bhtnCheck.length - 36) / 12)));
      }

      let pr = (yTot >= 15) ? ((gender === 'female') ? 45 + (yTot - 15) * 2 : (yTot <= 20 ? 40 + (yTot - 15) * 1 : 45 + (yTot - 20) * 2)) : 0;
      let pRate = Math.min(75, pr);

      const res1Time = Math.round(tM < 12 ? (mbq * tM * 0.22) : (mbq * (yPre * 1.5 + yPost * 2.0)) - tD);

      // Tính chế độ tử tuất
      let lcsAtDeath = 0;
      let isEligibleFuneral = false;
      let funeralAmount = 0;
      let survivorAmount = 0;
      let isTuatMinApplied = false;

      if (calcTuat && deathDate) {
        const { month: resM, year: resY } = parseMonthAndYear(resolvedDate);
        lcsAtDeath = getHistoricalLCS(resM, resY);

        isEligibleFuneral = (compulsoryMonths >= 12) || (compulsoryMonths + voluntaryMonths >= 60);
        funeralAmount = isEligibleFuneral ? 10 * lcsAtDeath : 0;

        if (tM < 12) {
          survivorAmount = Math.min(3 * mbq, Math.round(tAdj * 0.22));
        } else {
          const survivorBase = mbq * (yPre * 1.5 + yPost * 2.0);
          survivorAmount = survivorBase;
          if (compulsoryMonths >= 12) {
            const minTuat = 3 * mbq;
            if (survivorAmount < minTuat) {
              survivorAmount = minTuat;
              isTuatMinApplied = true;
            }
          }
        }
        survivorAmount = Math.round(survivorAmount);
      }

      setSystemCore({
        ready: true, mCount: tM, adjMoney: tAdj, mbq, bhtnSal: bSal, bhtnM: bM, bhtnMbq: bMbqActual,
        details: bd.sort((a, b) => a.year - b.year), mPre: mPreCount, mPost: mPostCount, yTot, yPre, yPost, pRate,
        res1Time,
        tD,
        calcTuat,
        deathDate,
        benefitMonth,
        lcsAtDeath,
        isEligibleFuneral,
        funeralAmount,
        survivorAmount,
        isTuatMinApplied,
        compulsoryMonths,
        voluntaryMonths
      });

      setShowResults(true);
      setTimeout(() => { document.getElementById('bh1_results')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    } catch (e: any) { showAlert("Lỗi hệ thống", "Có lỗi xảy ra: " + e.message, "error"); }
  };

  calc1LanRef.current = calc1Lan;

  const downloadTemplate = async () => {
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const h = [["Loại", "Tháng BĐ", "Năm BĐ", "Tháng KT", "Năm KT", "Mức lương/HS"], ["batbuoc", 1, 2024, 12, 2024, 6000000], ["nhanuoc", 1, 2016, 12, 2016, 2.34]];
    const sheet = XLSX.utils.aoa_to_sheet(h); protectWorksheetFormulas(sheet);
    XLSX.writeFile({ SheetNames: ["BHXH"], Sheets: { "BHXH": sheet } }, "Mau_Nhap_BHXH_1_Lan.xlsx");
  };

  const importExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateExcelFile(file);
    if (fileError) { showAlert("File không hợp lệ", fileError, "error"); return; }
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(new Uint8Array(evt.target?.result as ArrayBuffer), { type: 'array' });
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
      const newPeriods: Period[] = [];
      for (let j = 1; j < data.length; j++) {
        const r: any = data[j];
        if (!r || r[0] === undefined) continue;
        let typeT = String(r[0]).toLowerCase().trim();
        let t: 'batbuoc' | 'nhanuoc' | 'tunguyen' = (typeT.includes('nha') || typeT.includes('heso')) ? 'nhanuoc' : (typeT.includes('tu') ? 'tunguyen' : 'batbuoc');
        if (r[5] > 0) {
          newPeriods.push({
            id: Date.now() + Math.random(),
            type: t,
            sm: getInt(r[1]),
            sy: getInt(r[2]),
            em: getInt(r[3]),
            ey: getInt(r[4]),
            salary: t === 'nhanuoc' ? r[5] : parseInt(r[5]).toLocaleString('vi-VN')
          });
        }
      }
      setPeriods(newPeriods);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast("Nhập dữ liệu thành công!");
    };
    reader.readAsArrayBuffer(file);
  };

  const exportExcel = async () => {
    if (!systemCore || !systemCore.ready) return showAlert("Trống", "Vui lòng phân tích trước khi xuất!", "info");
    const XLSX = (await import('xlsx-js-style')).default || (await import('xlsx-js-style'));
    const d = [
      ["BÁO CÁO DỰ TOÁN BHXH"],
      ["Tháng năm hưởng chế độ:", systemCore.benefitMonth || "Chưa chọn"],
      ["Mức bình quân tiền lương (Mbq):", Math.round(systemCore.mbq)],
      ["Thời gian đóng:", `${systemCore.yTot} năm (${systemCore.mCount} tháng)`]
    ];
    
    if (systemCore.calcTuat && systemCore.deathDate) {
      d.push(["--- CHẾ ĐỘ TỬ TUẤT ---"]);
      d.push(["Ngày tử vong:", systemCore.deathDate]);
      d.push(["Trợ cấp mai táng:", systemCore.isEligibleFuneral ? systemCore.funeralAmount : "Không đủ điều kiện"]);
      d.push(["Trợ cấp tuất 1 lần:", systemCore.survivorAmount]);
      d.push(["Tổng trợ cấp tử tuất:", (systemCore.isEligibleFuneral ? systemCore.funeralAmount : 0) + systemCore.survivorAmount]);
    }
    
    d.push([]);
    d.push(["Tháng", "Loại", "Lương gốc/Hệ số", "Thành tiền"]);
    systemCore.details.forEach((i: any) => d.push([`${i.year} (T${i.sM}-T${i.eM})`, i.type, i.val, Math.round(i.tA / i.mC)]));
    setTimeout(() => { XLSX.writeFile({ SheetNames: ["BHXH"], Sheets: { "BHXH": XLSX.utils.aoa_to_sheet(d) } }, "BaoCao_TruotGia_1Lan.xlsx"); }, 100);
  };

  const exportPDF = async () => {
    if (!systemCore || !systemCore.ready) return showAlert("Trống", "Vui lòng phân tích trước khi xuất!", "info");
    
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;
    const pdfFonts = (pdfFontsModule as any).default || pdfFontsModule;
    pdfMake.vfs = pdfFonts?.pdfMake?.vfs || (pdfFonts as any).vfs || pdfFonts;

    const resultStack = [
      { text: '1. BHXH Một lần: ' + formatMoney(systemCore.res1Time), fontSize: 14, bold: true, color: '#004182' },
      { text: '2. Trợ cấp Thất nghiệp: ' + formatMoney(systemCore.bhtnSal) + ' / Tháng (Hưởng ' + systemCore.bhtnM + ' tháng)', fontSize: 11 },
      { text: '3. Lương hưu dự tính: ' + formatMoney(systemCore.mbq * systemCore.pRate / 100) + ' / Tháng (Tỷ lệ: ' + systemCore.pRate + '%)', fontSize: 11 }
    ];
    if (systemCore.benefitMonth) {
      resultStack.unshift({ text: '• Tháng năm hưởng chế độ: ' + systemCore.benefitMonth, fontSize: 11, bold: true } as any);
    }
    
    if (systemCore.calcTuat && systemCore.deathDate) {
      resultStack.push(
        { text: '4. Chế độ tử tuất khi tử vong (Tổng trợ cấp: ' + formatMoney(systemCore.funeralAmount + systemCore.survivorAmount) + ')', fontSize: 14, bold: true, color: '#e056fd', margin: [0, 5, 0, 0] } as any
      );
      resultStack.push(
        { text: '   • Trợ cấp mai táng (Mai táng phí): ' + (systemCore.isEligibleFuneral ? formatMoney(systemCore.funeralAmount) : "Không đủ điều kiện"), fontSize: 11 } as any
      );
      resultStack.push(
        { text: '   • Trợ cấp tuất một lần: ' + formatMoney(systemCore.survivorAmount) + (systemCore.isTuatMinApplied ? ' (Đã áp dụng mức tối thiểu 3 tháng Mbq)' : ''), fontSize: 11 } as any
      );
    }

    const docDef: any = {
      pageSize: 'A4',
      pageMargins: [40, 45, 40, 45],
      content: [
        { columns: [{ stack: [{ text: 'BẢO HIỂM XÃ HỘI VIỆT NAM', bold: true, alignment: 'center' }, { text: 'ĐẠI LÝ SÔNG MÃ', fontSize: 8, alignment: 'center' }], width: '45%' }, { stack: [{ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, alignment: 'center' }, { text: 'Độc lập - Tự do - Hạnh phúc', fontSize: 10, alignment: 'center' }, { canvas: [{ type: 'line', x1: 50, y1: 5, x2: 150, y2: 5, lineWidth: 1 }] }], width: '55%' }] },
        { text: '\n\nQUYẾT ĐỊNH DỰ TOÁN QUYỀN LỢI', fontSize: 18, bold: true, alignment: 'center' },
        { text: 'Về việc hưởng BHXH một lần & BHTN (Cập nhật 2026)\n', fontSize: 11, bold: true, alignment: 'center' },
        { text: 'GIÁM ĐỐC BẢO HIỂM XÃ HỘI', fontSize: 11, bold: true, alignment: 'center', margin: [0, 0, 0, 10] },
        { text: [{ text: 'Căn cứ Luật BHXH số 41/2024/QH15 và CV 340/2026 về hệ số trượt giá;\n', fontSize: 10, italics: true }] },
        { text: '\nI. KẾT QUẢ DỰ TOÁN:', fontSize: 11, bold: true },
        {
          margin: [20, 5, 0, 10],
          stack: resultStack
        },
        { text: '\nII. DIỄN GIẢI CHI TIẾT MỨC HƯỞNG:', fontSize: 11, bold: true },
        {
          margin: [10, 5, 0, 15], stack: [
            { text: '• Tổng thời gian đóng BHXH: ' + systemCore.yTot + ' năm (' + Math.floor(systemCore.mCount / 12) + ' năm ' + (systemCore.mCount % 12) + ' tháng).', fontSize: 10 },
            { text: '• Mức bình quân tiền lương (Mbq): ' + Math.round(systemCore.mbq).toLocaleString() + ' đồng.', fontSize: 10 },
            { text: '• Mbq hưởng Thất nghiệp (06 tháng cuối): ' + Math.round(systemCore.bhtnMbq).toLocaleString() + ' đồng.', fontSize: 10 },
            { text: '• Công thức hưởng: Mbq x [ (Năm trước 2014 x 1.5) + (Năm từ 2014 x 2.0) ]', fontSize: 10, italics: true }
          ]
        },
        { columns: [{ stack: [{ text: '\n\nNGƯỜI LẬP BIỂU', fontSize: 10, bold: true, alignment: 'center' }, { text: '(Ký, ghi rõ họ tên)', fontSize: 8, italics: true, alignment: 'center' }], width: '*' }, { stack: [{ text: '\n\nXÁC NHẬN CƠ QUAN', fontSize: 10, bold: true, alignment: 'center' }, { text: '(Ký tên, đóng dấu)', fontSize: 8, italics: true, alignment: 'center' }], width: '*' }], margin: [0, 40, 0, 0] },
        { text: '', pageBreak: 'before' },
        { text: 'PHỤ LỤC: BẢN QUÁ TRÌNH ĐÓNG BHXH CHI TIẾT', fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
        {
          table: {
            headerRows: 1, widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*'], body: [
              [{ text: 'Năm', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'Tháng', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'Loại', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'Mức gốc', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'LCS', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'CPI', fontSize: 9, bold: true, fillColor: '#f2f2f2' }, { text: 'Thành tiền', fontSize: 9, bold: true, fillColor: '#f2f2f2' }],
              ...systemCore.details.map((i: any) => [i.year, i.sM + '-' + i.eM, i.type, { text: i.val.toLocaleString(), alignment: 'right' }, { text: i.lcs ? i.lcs.toLocaleString() : '--', alignment: 'right' }, { text: i.coef.toFixed(2), alignment: 'center' }, { text: Math.round(i.tA / i.mC).toLocaleString(), alignment: 'right', bold: true }])
            ]
          }
        }
      ]
    };
    setTimeout(() => { pdfMake.createPdf(docDef).download("BC_BHXH_1LAN_SongMa.pdf"); }, 100);
  };

  return (
    <div className="w-full flex flex-col bg-white rounded-2xl relative transition-opacity duration-300">
      <div className="space-y-6">
        {/* Banner thông tin khách hàng được nạp tự động từ Hồ sơ tham gia */}
        {loadedCustomer && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <UserCheck size={20} />
              </div>
              <div>
                <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                  Dữ liệu tự động đồng bộ từ Hồ sơ tham gia
                </div>
                <div className="text-sm font-bold text-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5">
                  {loadedCustomer.name && (
                    <span>Họ tên: <strong className="text-emerald-700">{loadedCustomer.name}</strong></span>
                  )}
                  {loadedCustomer.cccd && (
                    <span>CCCD: <strong className="text-slate-700">{loadedCustomer.cccd}</strong></span>
                  )}
                  {loadedCustomer.bhxh && (
                    <span>Mã BHXH: <strong className="text-slate-700">{loadedCustomer.bhxh}</strong></span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLoadedCustomer(null)}
              className="text-xs text-slate-500 hover:text-slate-700 font-medium px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors cursor-pointer self-end sm:self-center"
            >
              Đóng thông báo
            </button>
          </div>
        )}

        {/* Khung Cấu hình tham số tính toán - Chuẩn giao diện mới */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          {/* Header & Toggle Chế độ */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <SlidersHorizontal size={22} />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Cấu hình tham số tính toán</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Chọn chế độ cần tính toán và tham số phù hợp để trả về kết quả chính xác nhất.
                </p>
              </div>
            </div>

            {/* Pill Toggle Switch: BHXH 1 Lần vs Chế độ Tử tuất */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center border border-slate-200/70 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCalcTuat(false)}
                className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  !calcTuat
                    ? 'bg-[#0f766e] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                Thanh toán BHXH 1 Lần
              </button>
              <button
                type="button"
                onClick={() => {
                  setCalcTuat(true);
                  if (!deathDate) setDeathDate(getLocalYYYYMMDD());
                }}
                className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  calcTuat
                    ? 'bg-[#e11d48] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                Chế độ Tử tuất
              </button>
            </div>
          </div>

          {/* Form Input Row */}
          {!calcTuat ? (
            /* Chế độ 1: Thanh toán BHXH 1 Lần */
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row items-start lg:items-end justify-between gap-4">
                {/* Cột Trái: Tháng/Năm nộp hồ sơ */}
                <div className="w-full lg:flex-1 max-w-2xl">
                  <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                    THÁNG/NĂM NỘP HỒ SƠ
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={benefitMonth || getCurrentMonthVN()}
                      onChange={e => setBenefitMonth(formatMonthInputMask(e.target.value))}
                      placeholder="MM/YYYY"
                      maxLength={7}
                      className="w-full p-3.5 pr-11 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-inner"
                    />
                    <Calendar size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  <p className="text-xs text-amber-700 font-medium mt-2 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>Hệ thống tự động áp dụng hệ số trượt giá CPI và mức Lương cơ sở tại thời điểm nhận.</span>
                  </p>
                </div>

                {/* Cột Phải: Nút mở rộng Tùy chọn tính Lương hưu */}
                <div className="w-full lg:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPensionOptionsOpen(!isPensionOptionsOpen)}
                    className="w-full lg:w-auto p-3.5 px-4 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm flex items-center justify-between gap-2.5 transition-all shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={16} className="text-slate-500" />
                      <span>{isPensionOptionsOpen ? 'Ẩn tùy chọn tính Lương hưu' : 'Tùy chọn tính Lương hưu (Giới tính, Mức hỗ trợ)'}</span>
                    </div>
                    {isPensionOptionsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Khung Thông số tham chiếu bổ sung khi mở rộng */}
              {isPensionOptionsOpen && (
                <div className="bg-[#f8fafc] border border-blue-100/90 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-slate-800 font-black text-xs uppercase tracking-wider">
                    <Info size={18} className="text-blue-500" />
                    <span>THÔNG SỐ THAM CHIẾU BỔ SUNG</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                        GIỚI TÍNH (DÙNG ƯỚC TÍNH HƯU TRÍ)
                      </label>
                      <select
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer shadow-sm"
                      >
                        <option value="male">Nam (Tính tuổi hưu theo lộ trình)</option>
                        <option value="female">Nữ (Tính tuổi hưu theo lộ trình)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                        TỶ LỆ NHÀ NƯỚC HỖ TRỢ (BHXH TỰ NGUYỆN)
                      </label>
                      <select
                        value={support}
                        onChange={e => setSupport(Number(e.target.value))}
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white font-bold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all cursor-pointer shadow-sm"
                      >
                        <option value="0.2">Khác (20%)</option>
                        <option value="0.5">Hộ nghèo (50%)</option>
                        <option value="0.4">Hộ cận nghèo (40%)</option>
                        <option value="0.3">Dân tộc thiểu số (30%)</option>
                        <option value="0.1">Khác (10%)</option>
                        <option value="0">Không hỗ trợ (0%)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center gap-3">
                    <span className="text-xs font-bold text-slate-600">Ngày dừng đóng BHXH:</span>
                    <input
                      type="date"
                      value={stopDate}
                      onChange={e => checkPolicy1Lan(e.target.value)}
                      className="p-2.5 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white font-semibold text-slate-800 focus:border-blue-500 outline-none shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chế độ 2: Chế độ Tử tuất */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-start">
              {/* Cột Trái: Tháng/Năm nộp hồ sơ */}
              <div>
                <label className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  THÁNG/NĂM NỘP HỒ SƠ
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={benefitMonth || getCurrentMonthVN()}
                    onChange={e => setBenefitMonth(formatMonthInputMask(e.target.value))}
                    placeholder="MM/YYYY"
                    maxLength={7}
                    className="w-full p-3.5 pr-11 rounded-2xl border border-slate-200 bg-slate-50/50 text-sm font-bold text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-inner"
                  />
                  <Calendar size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-xs text-amber-700 font-medium mt-2 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Hệ thống tự động áp dụng hệ số trượt giá CPI và mức Lương cơ sở tại thời điểm nhận.</span>
                </p>
              </div>

              {/* Cột Phải: Khung Ngày người tham gia chết */}
              <div className="bg-rose-50/40 border border-rose-200/80 rounded-2xl p-4 sm:p-5 space-y-2">
                <label className="block text-xs font-black text-rose-900 uppercase tracking-wider mb-1.5">
                  NGÀY NGƯỜI THAM GIA CHẾT
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={deathDate}
                    onChange={e => setDeathDate(e.target.value)}
                    className="w-full p-3 pr-11 rounded-xl border border-rose-200 text-sm bg-white font-bold text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 outline-none shadow-sm"
                  />
                </div>
                <p className="text-xs text-rose-700 font-medium mt-2">
                  * Dùng tính Trợ cấp Mai táng (10 tháng Lương cơ sở = {formatMoney(Number(getPolicyValueForDate(policies, 'base_salary', deathDate || getLocalYYYYMMDD(), settings?.baseSalary || 2340000)) * 10)}) & Trợ cấp Tử tuất 1 lần cho thân nhân.
                </p>
              </div>
            </div>
          )}

          {eligibleDate && !calcTuat && (
            <div className="bg-red-50/80 border border-red-200 text-red-700 p-4 rounded-2xl text-sm flex items-start shadow-sm mt-3">
              <AlertTriangle size={18} className="mr-2.5 mt-0.5 flex-shrink-0 text-red-500" />
              <div>
                <span className="font-bold">Ngày đủ điều kiện nhận BHXH 1 lần: </span>
                <span className="font-extrabold underline text-red-800">{eligibleDate}</span>
                <p className="text-xs font-medium mt-1 text-red-600/90">* Theo Luật 2024: Phải sau 12 tháng nghỉ việc và không tiếp tục đóng BHXH.</p>
              </div>
            </div>
          )}
        </div>

        {/* Khung Quá trình tham gia */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h4 className="font-bold text-slate-900 text-base flex items-center">
                <History className="text-[#004182] mr-2" size={18} /> Quá trình tham gia
              </h4>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Khai báo các khoảng thời gian đóng BHXH hoặc nhập nhanh qua AI / Excel</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Nút Quét AI */}
              <input
                type="file"
                ref={ocrFileInputRef}
                accept="image/*, application/pdf, .pdf"
                className="hidden"
                onChange={handleOcrImageUpload}
              />
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) {
                    showAlert(
                      'Yêu cầu Đăng nhập Cán bộ',
                      'Tính năng Quét Sổ AI bằng mô hình trí tuệ nhân tạo Gemini chỉ dành riêng cho Cán bộ / Đại lý thu BHXH đã đăng nhập hệ thống. Quý khách vui lòng đăng nhập tài khoản để sử dụng tính năng cao cấp này.',
                      'warning'
                    );
                    return;
                  }
                  ocrFileInputRef.current?.click();
                }}
                disabled={ocrLoading}
                className={`px-4 py-2 rounded-full font-black text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 border cursor-pointer disabled:opacity-50 ${
                  currentUser
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 border-amber-600/40'
                    : 'bg-amber-50 text-amber-800 border-amber-300/80 hover:bg-amber-100'
                }`}
                title={currentUser ? "Tự động bóc tách quá trình đóng BHXH từ Ảnh tờ rời / VssID / File PDF" : "Yêu cầu đăng nhập tài khoản Cán bộ để sử dụng Quét Sổ AI"}
              >
                {ocrLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang quét ảnh sổ AI</span>
                  </>
                ) : (
                  <>
                    {currentUser ? <Camera size={15} className="text-slate-950" /> : <Lock size={13} className="text-amber-700" />}
                    <span>Quét Sổ AI</span>
                    {!currentUser && <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold">Khóa</span>}
                  </>
                )}
              </button>

              {/* 2. Nút Nhập Excel */}
              <label className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3.5 py-2 rounded-full text-xs font-bold hover:bg-emerald-100 hover:shadow-md transition-all cursor-pointer flex items-center shadow-sm">
                <FileDown size={15} className="mr-1.5 text-emerald-600" /> Nhập Excel
                <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={importExcel} />
              </label>

              {/* 3. Nút Tải Mẫu */}
              <button 
                type="button"
                onClick={downloadTemplate} 
                className="bg-blue-50 text-[#004182] border border-blue-200/80 px-3.5 py-2 rounded-full text-xs font-bold hover:bg-blue-100 hover:shadow-md transition-all flex items-center shadow-sm cursor-pointer"
              >
                <Download size={15} className="mr-1.5 text-[#0ea5e9]" /> Tải Mẫu
              </button>
            </div>
          </div>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {periods.map(p => (
              <div key={p.id} className="grid grid-cols-1 md:grid-cols-[1.8fr_1.2fr_1.2fr_1.8fr_auto] gap-3 sm:gap-4 items-end bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 truncate">Loại hình</label>
                  <select value={p.type || 'batbuoc'} onChange={e => updatePeriod(p.id, 'type', e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm h-[45px] text-slate-800 focus:border-[#004182] outline-none">
                    <option value="batbuoc">Bắt buộc / DN</option>
                    <option value="nhanuoc">Nhà nước (Hệ số)</option>
                    <option value="tunguyen">Tự nguyện</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Từ tháng</span>
                    <span className="text-[10px] text-slate-400">MM/YYYY</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={p.fromMonth || `${String(p.sm || 1).padStart(2, '0')}/${p.sy || new Date().getFullYear()}`}
                    onChange={e => updatePeriod(p.id, 'fromMonth', e.target.value)}
                    placeholder="MM/YYYY"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm h-[45px] font-bold text-center text-slate-800 focus:border-[#004182] outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center justify-between">
                    <span>Đến tháng</span>
                    <span className="text-[10px] text-slate-400">MM/YYYY</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    value={p.toMonth || `${String(p.em || 12).padStart(2, '0')}/${p.ey || new Date().getFullYear()}`}
                    onChange={e => updatePeriod(p.id, 'toMonth', e.target.value)}
                    placeholder="MM/YYYY"
                    className="w-full p-3 rounded-xl border border-slate-200 text-sm h-[45px] font-bold text-center text-slate-800 focus:border-[#004182] outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-semibold text-slate-600 mb-1 truncate">Mức lương/HS</label>
                  <input type="text" inputMode="numeric" value={p.salary} onChange={e => updatePeriod(p.id, 'salary', e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 text-sm h-[45px] font-bold text-[#004182] focus:border-[#004182] outline-none" placeholder="Nhập..." />
                </div>
                <button type="button" onClick={() => removePeriod(p.id)} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white w-full md:w-11 h-[45px] rounded-xl flex items-center justify-center transition shadow-xs mt-2 md:mt-0 shrink-0 border border-red-200">
                  <Trash2 size={16} className="md:mr-0 mr-2" /> <span className="md:hidden">Xóa giai đoạn</span>
                </button>
                <div className="col-span-1 md:col-span-5 text-xs text-slate-600 font-medium flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 mt-1">
                  <div className="flex items-center gap-2">
                    {p.position && <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md font-bold">{p.position}</span>}
                    {p.workplace && <span>Đơn vị: <strong className="text-slate-800">{p.workplace}</strong></span>}
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    Thời lượng: {p.months || Math.max(0, (Number(p.ey) - Number(p.sy)) * 12 + (Number(p.em) - Number(p.sm)) + 1)} tháng
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4 pt-4 border-t border-slate-200">
            <button onClick={() => addPeriod()} className="bg-white border border-[#004182] text-[#004182] font-bold px-5 py-2 rounded-xl hover:bg-blue-50 transition text-sm shadow-xs flex items-center mx-auto cursor-pointer">
              <Plus size={16} className="mr-2" /> Thêm Giai Đoạn Đóng
            </button>
          </div>
        </div>

        <div className="text-center pb-2 pt-1 border-b border-slate-200">
          <button 
            onClick={() => calc1Lan()} 
            className="bg-[#004182] hover:bg-[#003166] text-white font-extrabold text-sm tracking-wide px-7 py-3 rounded-xl shadow-xs hover:shadow-md transition-all transform active:scale-95 w-full md:w-auto flex items-center justify-center mx-auto cursor-pointer"
          >
            <Zap size={17} className="mr-2 text-[#FDB913]" /> PHÂN TÍCH QUYỀN LỢI
          </button>
        </div>

        {showResults && systemCore.ready && (
          <div id="bh1_results" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-gradient-to-br from-[#0c4e8a] to-[#003366] text-white p-6 rounded-3xl shadow-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-sm text-white/80 font-bold uppercase tracking-wider mb-2">BHXH 1 LẦN (DỰ TÍNH)</h4>
                  <span className="text-3xl font-black">{formatMoney(systemCore.res1Time)}</span>
                </div>
                
                <div className="bg-black/15 p-4 rounded-2xl border border-white/10 space-y-3 mt-5 text-xs text-white">
                  <div>
                    <span className="font-bold text-[#FDB913] block mb-1">🔍 1. MỨC LƯƠNG BÌNH QUÂN (Mbq):</span>
                    <div className="flex justify-between font-semibold">
                      <span>Tổng quỹ / {systemCore.mCount} tháng</span>
                      <span>{formatMoney(systemCore.mbq)}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-[#FDB913] block mb-1">🕒 2. HỆ SỐ THỜI GIAN:</span>
                    {systemCore.mCount < 12 ? (
                      <div className="flex justify-between font-semibold">
                        <span>Dưới 12 tháng</span>
                        <span>= 22% tổng đóng</span>
                      </div>
                    ) : (
                      <div className="space-y-1 font-semibold">
                        <div className="flex justify-between">
                          <span>- Trước 2014: {systemCore.yPre} năm × 1.5</span>
                          <span>= {systemCore.yPre * 1.5} tháng</span>
                        </div>
                        <div className="flex justify-between">
                          <span>- Từ 2014: {systemCore.yPost} năm × 2.0</span>
                          <span>= {systemCore.yPost * 2.0} tháng</span>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1 text-[#FDB913]">
                          <span>=&gt; Tổng tháng hưởng:</span>
                          <span>{systemCore.yPre * 1.5 + systemCore.yPost * 2.0} tháng</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-[#FDB913] block mb-1">📋 3. CÔNG THỨC CHỐT:</span>
                    {systemCore.mCount < 12 ? (
                      <div className="flex justify-between font-semibold">
                        <span>(Mbq × {systemCore.mCount} tháng × 22%)</span>
                        <span>{formatMoney(systemCore.res1Time)}</span>
                      </div>
                    ) : (
                      <div className="space-y-1 font-semibold">
                        <div className="flex justify-between">
                          <span>(Mbq × Tổng tháng hưởng)</span>
                          <span>{formatMoney(Math.round(systemCore.mbq * (systemCore.yPre * 1.5 + systemCore.yPost * 2.0)))}</span>
                        </div>
                        {systemCore.tD > 0 && (
                          <div className="flex justify-between text-red-200">
                            <span>- Trừ tiền NN Hỗ trợ:</span>
                            <span>- {formatMoney(systemCore.tD)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#f97316] to-[#ea580c] text-white p-6 rounded-3xl shadow-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-sm text-white/80 font-bold uppercase tracking-wider mb-2">TRỢ CẤP THẤT NGHIỆP</h4>
                  <span className="text-3xl font-black block">{formatMoney(systemCore.bhtnSal)}</span>
                  <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold mt-2">
                    {systemCore.bhtnM} tháng
                  </span>
                </div>
                
                <div className="bg-black/15 p-4 rounded-2xl border border-white/10 space-y-3 mt-5 text-xs text-white">
                  <div>
                    <span className="font-bold text-yellow-300 block mb-1">🔍 1. BÌNH QUÂN 6 THÁNG:</span>
                    <div className="flex justify-between font-semibold">
                      <span>Mức lương BQ</span>
                      <span>{formatMoney(systemCore.bhtnMbq)}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-yellow-300 block mb-1">🕒 2. THỜI GIAN ĐÓNG BHTN:</span>
                    <div className="space-y-1 font-semibold">
                      <div className="flex justify-between">
                        <span>Tổng thời gian</span>
                        <span>{systemCore.compulsoryMonths || 0} tháng</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Số tháng hưởng</span>
                        <span>{systemCore.bhtnM} tháng</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-yellow-300 block mb-1">📋 3. CÔNG THỨC CHỐT:</span>
                    <div className="flex justify-between font-semibold">
                      <span>(BQ 6 tháng × 60%)</span>
                      <span>{formatMoney(systemCore.bhtnSal)} / tháng</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#0284c7] to-[#0369a1] text-white p-6 rounded-3xl shadow-lg flex flex-col justify-between">
                <div>
                  <h4 className="text-sm text-white/80 font-bold uppercase tracking-wider mb-2">LƯƠNG HƯU (DỰ KIẾN)</h4>
                  <span className="text-3xl font-black block">{formatMoney(systemCore.mbq * systemCore.pRate / 100)}</span>
                  <span className="inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold mt-2">
                    Tỷ lệ hưởng: {systemCore.pRate}%
                  </span>
                </div>
                
                <div className="bg-black/15 p-4 rounded-2xl border border-white/10 space-y-3 mt-5 text-xs text-white">
                  <div>
                    <span className="font-bold text-yellow-200 block mb-1">🔍 1. MỨC LƯƠNG BÌNH QUÂN:</span>
                    <div className="flex justify-between font-semibold">
                      <span>Mức lương BQ (Mbq)</span>
                      <span>{formatMoney(systemCore.mbq)}</span>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-yellow-200 block mb-1">🕒 2. TỶ LỆ HƯỞNG LƯƠNG HƯU:</span>
                    <div className="space-y-1 font-semibold">
                      <div className="flex justify-between">
                        <span>Tổng thời gian đóng</span>
                        <span>{systemCore.mCount} tháng</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tỷ lệ hưởng tương ứng</span>
                        <span>{systemCore.pRate}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-t border-dashed border-white/20 pt-2">
                    <span className="font-bold text-yellow-200 block mb-1">📋 3. CÔNG THỨC CHỐT:</span>
                    <div className="flex justify-between font-semibold">
                      <span>(Mbq × Tỷ lệ hưởng)</span>
                      <span>{formatMoney(systemCore.mbq * systemCore.pRate / 100)} / tháng</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {systemCore.calcTuat && systemCore.deathDate && (
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl shadow-lg border border-slate-700/50 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-3 gap-2">
                  <h4 className="font-extrabold text-[#0ea5e9] uppercase text-sm tracking-wider flex items-center">
                    <Zap className="text-yellow-400 mr-2 animate-pulse" size={18} /> Chế độ tử tuất khi tử vong
                  </h4>
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 font-bold">
                    <span className="bg-white/10 px-2.5 py-1 rounded-full">
                      Ngày tử vong: {new Date(systemCore.deathDate).toLocaleDateString('vi-VN')}
                    </span>
                    {systemCore.benefitMonth && (
                      <span className="bg-blue-600/30 text-[#0ea5e9] border border-[#0ea5e9]/20 px-2.5 py-1 rounded-full">
                        Tháng hưởng: {systemCore.benefitMonth}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Trợ cấp mai táng (Mai táng phí)</span>
                    <span className="text-xl font-extrabold text-yellow-400">{formatMoney(systemCore.funeralAmount)}</span>
                    <div className="text-[10px] text-slate-300 mt-2 pt-2 border-t border-white/5 space-y-1">
                      <div>Đóng bắt buộc: <span className="font-bold">{systemCore.compulsoryMonths} tháng</span></div>
                      <div>Đóng tự nguyện: <span className="font-bold">{systemCore.voluntaryMonths} tháng</span></div>
                      {systemCore.isEligibleFuneral ? (
                        <div className="text-emerald-400 font-semibold mt-1">
                          ✓ Đủ điều kiện hưởng
                          <div className="text-[9px] text-slate-400 font-normal">Diễn giải: 10 x Lương cơ sở ({formatMoney(systemCore.lcsAtDeath)})</div>
                        </div>
                      ) : (
                        <div className="text-rose-400 font-semibold mt-1">
                          ✗ Không đủ điều kiện
                          <div className="text-[9px] text-slate-400 font-normal">Yêu cầu: Đóng bắt buộc ≥ 12 tháng hoặc Tổng đóng ≥ 60 tháng</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Trợ cấp tuất một lần</span>
                    <span className="text-xl font-extrabold text-[#0ea5e9]">{formatMoney(systemCore.survivorAmount)}</span>
                    <div className="text-[10px] text-slate-300 mt-2 pt-2 border-t border-white/5 space-y-1">
                      <div>Thời gian đóng: <span className="font-bold">{systemCore.yTot} năm</span> ({systemCore.mCount} tháng)</div>
                      {systemCore.mCount < 12 ? (
                        <div className="space-y-0.5">
                          <div>Cách tính: 22% x Tổng đóng</div>
                          <div className="text-[9px] text-slate-400">Diễn giải: 22% x {formatMoney(systemCore.adjMoney)} = {formatMoney(Math.round(systemCore.adjMoney * 0.22))} (Tối đa 3 tháng Mbq: {formatMoney(systemCore.mbq * 3)})</div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div>Trước 2014: {systemCore.yPre}n x 1.5 = {systemCore.yPre * 1.5} tháng</div>
                          <div>Sau 2014: {systemCore.yPost}n x 2.0 = {systemCore.yPost * 2.0} tháng</div>
                          <div className="text-yellow-400 font-semibold">Tổng hệ số: {systemCore.yPre * 1.5 + systemCore.yPost * 2.0} tháng x Mbq</div>
                          <div className="text-[9px] text-slate-400 font-normal">
                            Diễn giải: {systemCore.yPre * 1.5 + systemCore.yPost * 2.0} x {formatMoney(systemCore.mbq)} = {formatMoney(Math.round(systemCore.mbq * (systemCore.yPre * 1.5 + systemCore.yPost * 2.0)))}
                          </div>
                        </div>
                      )}
                      {systemCore.isTuatMinApplied && (
                        <div className="text-amber-400 font-semibold mt-1">
                          ★ Áp dụng mức sàn tối thiểu: 3 x Mbq (bắt buộc ≥ 12 tháng)
                          <div className="text-[9px] text-slate-400 font-normal">Diễn giải: 3 x {formatMoney(systemCore.mbq)} = {formatMoney(systemCore.mbq * 3)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/10 p-4 rounded-xl border border-yellow-500/30 flex flex-col justify-center">
                    <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider mb-1">Tổng cộng trợ cấp tử tuất</span>
                    <span className="text-3xl font-black text-white">{formatMoney(systemCore.funeralAmount + systemCore.survivorAmount)}</span>
                    <div className="text-[10px] text-slate-300 mt-2 pt-2 border-t border-white/5 space-y-0.5">
                      <div>Mai táng phí: {formatMoney(systemCore.funeralAmount)}</div>
                      <div>Tuất một lần: {formatMoney(systemCore.survivorAmount)}</div>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-3 border-t border-white/5 pt-2">* Thân nhân nhận trợ cấp tuất một lần không bị khấu trừ số tiền Nhà nước hỗ trợ đóng BHXH tự nguyện.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center"><Receipt size={14} className="text-[#0ea5e9] mr-2" /> Bảng kê trượt giá</span>
                <div className="flex gap-2">
                  <button onClick={exportExcel} className="text-green-600 bg-white border border-green-200 px-2 py-1 rounded text-[10px] font-bold hover:bg-green-50 transition flex items-center"><FileSpreadsheet size={12} className="mr-1" /> Excel</button>
                  <button onClick={exportPDF} className="text-red-500 bg-white border border-red-200 px-2 py-1 rounded text-[10px] font-bold hover:bg-red-50 transition flex items-center"><FileText size={12} className="mr-1" /> PDF</button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[300px] custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-200">
                    <tr><th className="p-3">Giai đoạn</th><th className="p-3 text-center">Loại hình</th><th className="p-3 text-right">HS / Mức đóng</th><th className="p-3 text-center">LCS tháng</th><th className="p-3 text-center">Số tháng</th><th className="p-3 text-center">CPI</th><th className="p-3 text-right">Thành tiền (Quy đổi)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {systemCore.details.map((i: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-3 font-bold text-gray-800">{i.year} <span className="text-gray-400 font-normal">(T{i.sM}-{i.eM})</span></td>
                        <td className="p-3 text-center uppercase text-[10px] font-bold text-[#0ea5e9] bg-[#0ea5e9]/5">{i.type}</td>
                        <td className="p-3 text-right font-bold text-[#004182]">{i.type === 'nhanuoc' ? i.val : i.val.toLocaleString()}</td>
                        <td className="p-3 text-center font-semibold text-gray-500">{i.lcs ? i.lcs.toLocaleString() : '--'}</td>
                        <td className="p-3 text-center font-bold">{i.mC}</td>
                        <td className="p-3 text-center text-gray-400 font-bold">{i.coef.toFixed(2)}</td>
                        <td className="p-3 text-right font-bold text-[#FDB913]">{Math.round(i.tA / i.mC).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BHXH1LanCalc;
