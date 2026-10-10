import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { 
  Settings, Plus, FileText, Trash2, Edit2, CheckCircle, Percent, 
  DollarSign, Activity, TrendingUp, X, Database, RefreshCw, QrCode, History, Printer 
} from 'lucide-react';
import { formatMoney, formatDateVN } from '../../utils/helpers';
import { checkPolicyMutationPermission } from '../../utils/security';
import ConfirmModal from '../modals/ConfirmModal';
import VietQRAgencySettings from './VietQRAgencySettings';
import ReportPrintSettings from './ReportPrintSettings';
import { PolicyTimelineVisualizer } from './PolicyTimelineVisualizer';

type PolicyTabType = 
  | 'base_salary' 
  | 'poverty_standard' 
  | 'commission' 
  | 'investment_rate' 
  | 'cpi_index'
  | 'vietqr_settings'
  | 'print_settings'
  | 'timeline';

const SystemSettings = () => {
  const { 
    policies, 
    settings,
    addPolicy, 
    updatePolicy, 
    deletePolicy, 
    activatePolicy, 
    syncDefaultPolicies,
    addAuditLog,
    showToast, 
    currentUser 
  } = useAppContext();

  // Sidebar tab state
  const [activeTab, setActiveTab] = useState<PolicyTabType>('base_salary');
  const [isSyncing, setIsSyncing] = useState(false);

  // Policy Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<any>(null); // null if creating new
  const [modalForm, setModalForm] = useState({
    name: '',
    valueText: '', // For single number or JSON values
    commBHXHNew: '', // For commission object values (fallback)
    commBHXHRenew: '',
    commBHYTNew: '',
    commBHYTRenew: '',
    commBHXHNew1M: '',
    commBHXHNew3M: '',
    commBHXHNew6M: '',
    commBHXHNew12M: '',
    effective_date: '',
    description: ''
  });

  // Custom delete confirm modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [policyToDelete, setPolicyToDelete] = useState<{ id: number; name: string } | null>(null);

  const subTabs = [
    { id: 'timeline', name: 'Dòng thời gian chính sách', icon: History },
    { id: 'base_salary', name: 'Mức lương cơ sở', icon: DollarSign },
    { id: 'poverty_standard', name: 'Chuẩn nghèo nông thôn', icon: Activity },
    { id: 'commission', name: 'Cài đặt Tỷ lệ Hoa hồng đại lý', icon: Percent },
    { id: 'investment_rate', name: 'Lãi suất đầu tư quỹ', icon: Percent },
    { id: 'cpi_index', name: 'Hệ số trượt giá (JSON BHXH)', icon: TrendingUp },
    { id: 'vietqr_settings', name: 'Cài Đặt VietQR Đại Lý', icon: QrCode },
    { id: 'print_settings', name: 'Cài đặt Thông số In ấn & Báo cáo', icon: Printer }
  ] as const;

  // Helper to format values in the list / current display
  const formatValue = (type: string, val: any) => {
    if (!val && val !== 0) return 'Chưa thiết lập';
    if (type === 'base_salary' || type === 'poverty_standard') {
      return formatMoney(Number(val));
    }
    if (type === 'investment_rate') {
      return `${val} %/tháng`;
    }
    if (type === 'cpi_index') {
      try {
        const obj = typeof val === 'string' ? JSON.parse(val) : val;
        return JSON.stringify(obj, null, 2);
      } catch {
        return String(val);
      }
    }
    if (type === 'commission') {
      try {
        const obj = typeof val === 'string' ? JSON.parse(val) : val;
        const new1M = obj.commBHXHNew1M ?? 12;
        const new3M = obj.commBHXHNew3M ?? 15;
        const new6M = obj.commBHXHNew6M ?? 17;
        const new12M = obj.commBHXHNew12M ?? obj.commBHXHNew ?? 20;
        const renew = obj.commBHXHRenew ?? 9;
        const bhytNew = obj.commBHYTNew ?? 9;
        const bhytRenew = obj.commBHYTRenew ?? 5;
        return `BHXH Mới: 1T (${new1M}%), 3T (${new3M}%), 6T (${new6M}%), 12T (${new12M}%) | Gia hạn: ${renew}% | BHYT: Mới ${bhytNew}%, GH ${bhytRenew}%`;
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  // Helper to get fallback value from base settings table if no policy exists
  const getFallbackValue = (type: string) => {
    if (!settings) return null;
    if (type === 'base_salary') return settings.baseSalary ?? 2340000;
    if (type === 'poverty_standard') return settings.povertyStandard ?? 1500000;
    if (type === 'investment_rate') return settings.investmentRate ?? 0.31;
    if (type === 'cpi_index') return settings.cpiIndex ?? { "2026": 1.0, "2025": 1.0 };
    if (type === 'commission') {
      return {
        commBHXHNew: settings.commBHXHNew12M ?? settings.commBHXHNew ?? settings.commBHXH ?? 20,
        commBHXHRenew: settings.commBHXHRenew ?? 9,
        commBHYTNew: settings.commBHYTNew ?? settings.commBHYT ?? 9,
        commBHYTRenew: settings.commBHYTRenew ?? 5,
        commBHXHNew1M: settings.commBHXHNew1M ?? 12,
        commBHXHNew3M: settings.commBHXHNew3M ?? 15,
        commBHXHNew6M: settings.commBHXHNew6M ?? 17,
        commBHXHNew12M: settings.commBHXHNew12M ?? settings.commBHXHNew ?? 20
      };
    }
    return null;
  };

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    if (activeTab === 'commission') {
      const fb = (getFallbackValue('commission') as any) || {};
      setModalForm({
        name: 'Cài đặt Tỷ lệ Hoa hồng đại lý 2026',
        valueText: '',
        commBHXHNew: String(fb.commBHXHNew12M ?? fb.commBHXHNew ?? 20),
        commBHXHRenew: String(fb.commBHXHRenew ?? 9),
        commBHYTNew: String(fb.commBHYTNew ?? 9),
        commBHYTRenew: String(fb.commBHYTRenew ?? 5),
        commBHXHNew1M: String(fb.commBHXHNew1M ?? 12),
        commBHXHNew3M: String(fb.commBHXHNew3M ?? 15),
        commBHXHNew6M: String(fb.commBHXHNew6M ?? 17),
        commBHXHNew12M: String(fb.commBHXHNew12M ?? fb.commBHXHNew ?? 20),
        effective_date: new Date().toISOString().split('T')[0] ?? '',
        description: 'Cài đặt Tỷ lệ Hoa hồng đại lý'
      });
    } else {
      const fb = getFallbackValue(activeTab);
      let defaultValText = '';
      if (activeTab === 'cpi_index') {
        defaultValText = fb ? JSON.stringify(fb, null, 2) : '{\n  "2026": 1.0,\n  "2025": 1.0\n}';
      } else if (activeTab === 'investment_rate') {
        defaultValText = String(fb ?? '0.31');
      } else if (activeTab === 'base_salary') {
        defaultValText = String(fb ?? '2530000');
      } else {
        defaultValText = String(fb ?? '1500000');
      }
      setModalForm({
        name: '',
        valueText: defaultValText,
        commBHXHNew: '',
        commBHXHRenew: '',
        commBHYTNew: '',
        commBHYTRenew: '',
        commBHXHNew1M: '',
        commBHXHNew3M: '',
        commBHXHNew6M: '',
        commBHXHNew12M: '',
        effective_date: new Date().toISOString().split('T')[0] ?? '',
        description: ''
      });
    }
    setModalOpen(true);
  };

  const handleOpenEdit = (policy: any) => {
    setEditingPolicy(policy);
    const desc = policy.description || policy.notes || '';
    if (activeTab === 'commission') {
      const val = typeof policy.value === 'string' ? JSON.parse(policy.value) : policy.value;
      const isLegacy = val.commBHXHNew1M === undefined && val.commBHXHNew !== undefined;
      const fallbackNew = val.commBHXHNew ?? 20;
      const n12 = val.commBHXHNew12M ?? fallbackNew;
      setModalForm({
        name: policy.name,
        valueText: '',
        commBHXHNew: String(n12),
        commBHXHRenew: String(val.commBHXHRenew ?? 9),
        commBHYTNew: String(val.commBHYTNew ?? 9),
        commBHYTRenew: String(val.commBHYTRenew ?? 5),
        commBHXHNew1M: String(val.commBHXHNew1M ?? (isLegacy ? fallbackNew : 12)),
        commBHXHNew3M: String(val.commBHXHNew3M ?? (isLegacy ? fallbackNew : 15)),
        commBHXHNew6M: String(val.commBHXHNew6M ?? (isLegacy ? fallbackNew : 17)),
        commBHXHNew12M: String(n12),
        effective_date: policy.effective_date,
        description: desc
      });
    } else {
      setModalForm({
        name: policy.name,
        valueText: typeof policy.value === 'object' ? JSON.stringify(policy.value, null, 2) : String(policy.value),
        commBHXHNew: '',
        commBHXHRenew: '',
        commBHYTNew: '',
        commBHYTRenew: '',
        commBHXHNew1M: '',
        commBHXHNew3M: '',
        commBHXHNew6M: '',
        commBHXHNew12M: '',
        effective_date: policy.effective_date,
        description: desc
      });
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const perm = checkPolicyMutationPermission(currentUser);
    if (!perm.allowed) {
      showToast(perm.reason || 'Bạn không có quyền thực hiện chức năng này', 'error');
      return;
    }

    try {
      let parsedValue: any;
      if (activeTab === 'commission') {
        const new12 = Number(modalForm.commBHXHNew12M) || Number(modalForm.commBHXHNew) || 20;
        parsedValue = {
          commBHXHNew: new12,
          commBHXHRenew: Number(modalForm.commBHXHRenew) || 9,
          commBHYTNew: Number(modalForm.commBHYTNew) || 9,
          commBHYTRenew: Number(modalForm.commBHYTRenew) || 5,
          commBHXHNew1M: Number(modalForm.commBHXHNew1M) || 12,
          commBHXHNew3M: Number(modalForm.commBHXHNew3M) || 15,
          commBHXHNew6M: Number(modalForm.commBHXHNew6M) || 17,
          commBHXHNew12M: new12
        };
      } else if (activeTab === 'cpi_index') {
        try {
          parsedValue = JSON.parse(modalForm.valueText);
          if (typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
            throw new Error('Định dạng JSON không hợp lệ. Vui lòng nhập một Object JSON.');
          }
        } catch (err) {
          showToast('Lỗi phân tích JSON: ' + (err as Error).message, 'error');
          return;
        }
      } else {
        parsedValue = Number(modalForm.valueText);
        if (isNaN(parsedValue)) {
          showToast('Giá trị phải là một số hợp lệ', 'error');
          return;
        }
      }

      const policyData = {
        parameter_type: activeTab,
        name: modalForm.name,
        value: parsedValue,
        effective_date: modalForm.effective_date,
        description: modalForm.description,
        notes: modalForm.description
      };

      if (editingPolicy) {
        await updatePolicy(editingPolicy.id, policyData);
        if (addAuditLog) {
          await addAuditLog('Cập nhật Chính sách', `Cập nhật chính sách: ${modalForm.name} (Loại: ${activeTab}, ID: ${editingPolicy.id})`);
        }
        showToast('Cập nhật chính sách thành công');
      } else {
        await addPolicy({
          ...policyData,
          is_active: false
        });
        if (addAuditLog) {
          const tabName = subTabs.find(t => t.id === activeTab)?.name || activeTab;
          await addAuditLog('Ban hành Chính sách', `Ban hành chính sách ${tabName}: ${modalForm.name} (Hiệu lực: ${modalForm.effective_date})`);
        }
        showToast('Ban hành chính sách mới thành công');
      }

      setModalOpen(false);
    } catch (err: any) {
      const isRls = err?.code === '42501' || err?.message?.includes('row-level security');
      if (isRls) {
        showToast('Lỗi RLS (42501): Chỉ tài khoản Quản trị viên (Admin) được cấp quyền mới có thể lưu vào CSDL Supabase.', 'error');
      } else {
        showToast('Có lỗi xảy ra: ' + (err as Error).message, 'error');
      }
    }
  };

  const handleDeleteClick = (id: number, name: string) => {
    const perm = checkPolicyMutationPermission(currentUser);
    if (!perm.allowed) {
      showToast(perm.reason || 'Bạn không có quyền thực hiện chức năng này', 'error');
      return;
    }
    setPolicyToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!policyToDelete) return;
    try {
      await deletePolicy(policyToDelete.id);
      if (addAuditLog) {
        await addAuditLog('Xóa Chính sách', `Đã xóa chính sách: "${policyToDelete.name}" (ID: ${policyToDelete.id})`);
      }
      showToast('Đã xóa chính sách thành công');
    } catch (err) {
      showToast('Lỗi khi xóa: ' + (err as Error).message, 'error');
    } finally {
      setDeleteConfirmOpen(false);
      setPolicyToDelete(null);
    }
  };

  const handleActivate = async (id: number, name: string) => {
    const perm = checkPolicyMutationPermission(currentUser);
    if (!perm.allowed) {
      showToast(perm.reason || 'Bạn không có quyền thực hiện chức năng này', 'error');
      return;
    }

    try {
      await activatePolicy(id, activeTab);
      if (addAuditLog) {
        await addAuditLog('Kích hoạt Chính sách', `Kích hoạt áp dụng chính sách: "${name}" (Loại: ${activeTab}, ID: ${id})`);
      }
      showToast(`Đã áp dụng chính sách "${name}" thành công`);
    } catch (err) {
      showToast('Lỗi khi áp dụng: ' + (err as Error).message, 'error');
    }
  };

  const handleActivateFromTimeline = async (id: number, parameterType: string, policyName?: string) => {
    const perm = checkPolicyMutationPermission(currentUser);
    if (!perm.allowed) {
      showToast(perm.reason || 'Bạn không có quyền thực hiện chức năng này', 'error');
      return;
    }

    try {
      await activatePolicy(id, parameterType);
      if (addAuditLog) {
        await addAuditLog('Kích hoạt Chính sách', `Kích hoạt áp dụng chính sách: "${policyName || id}" (Loại: ${parameterType}, ID: ${id})`);
      }
      showToast(`Đã áp dụng chính sách "${policyName || id}" thành công!`);
    } catch (err: any) {
      showToast('Lỗi khi áp dụng: ' + (err?.message || 'Không thể kích hoạt'), 'error');
    }
  };

  const handleSyncDefaultPolicies = async () => {
    const perm = checkPolicyMutationPermission(currentUser);
    if (!perm.allowed) {
      showToast(perm.reason || 'Chỉ Quản trị viên mới có quyền đồng bộ chính sách chuẩn', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      if (syncDefaultPolicies) {
        await syncDefaultPolicies();
      }
      if (addAuditLog) {
        await addAuditLog('Đồng bộ Tham số Hệ thống', 'Đã lưu và đồng bộ 5 nhóm tham số chính sách cốt lõi vào bảng policies trên Supabase');
      }
      showToast('Đã lưu thành công các tham số chính sách vào CSDL Supabase!', 'success');
    } catch (err: any) {
      const isRls = err?.code === '42501' || err?.message?.includes('row-level security');
      if (isRls) {
        showToast('Lỗi RLS (42501): Chỉ tài khoản Quản trị viên (Admin) được cấp quyền mới có thể lưu vào CSDL Supabase.', 'error');
      } else {
        showToast('Lỗi khi đồng bộ vào Supabase: ' + (err?.message || 'Không thể đồng bộ'), 'error');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const activePolicy = policies?.find(p => p.parameter_type === activeTab && p.is_active);
  const fallbackVal = getFallbackValue(activeTab);
  const currentValText = activePolicy 
    ? formatValue(activeTab, activePolicy.value) 
    : fallbackVal !== null 
      ? `${formatValue(activeTab, fallbackVal)} (Mặc định Cấu hình cơ sở)` 
      : 'Chưa thiết lập';

  const currentTabPolicies = policies ? policies.filter(p => p.parameter_type === activeTab) : [];

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 min-h-full p-6 lg:p-8 mb-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center">
            <Settings className="mr-2 text-[#004182]" size={24} />
            Cấu Hình Hệ Thống Chung
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý các thông số cốt lõi: Mức lương cơ sở, Chuẩn nghèo nông thôn, Hoa hồng đại lý, Lãi suất và Chỉ số trượt giá CPI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSyncDefaultPolicies}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Lưu và đồng bộ 5 nhóm tham số chính sách chuẩn vào CSDL Supabase"
          >
            {isSyncing ? (
              <RefreshCw size={14} className="animate-spin text-emerald-600" />
            ) : (
              <Database size={14} className="text-emerald-600" />
            )}
            <span>Đồng bộ chính sách vào CSDL</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sub-sidebar */}
        <div className="w-full lg:w-72 shrink-0 flex flex-col gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200 h-fit">
          <div className="px-3 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
            Danh mục tham số ({subTabs.length})
          </div>
          {subTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = tab.id === 'vietqr_settings'
              ? (settings?.accountNumber || settings?.bank_account ? 1 : 0)
              : tab.id === 'print_settings'
              ? 'A4'
              : (policies ? policies.filter(p => p.parameter_type === tab.id).length : 0);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all duration-200 text-left cursor-pointer ${
                  isActive 
                    ? 'bg-[#004182] text-white shadow-md shadow-blue-500/20 translate-x-1' 
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                  <span>{tab.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200/70 text-gray-600'
                  }`}>
                    {tab.id === 'vietqr_settings' ? 'NAPAS' : count}
                  </span>
                  {isActive && <CheckCircle size={14} className="text-white shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 space-y-6">
          {activeTab === 'timeline' ? (
            <PolicyTimelineVisualizer
              policies={policies || []}
              onActivatePolicy={handleActivateFromTimeline}
              isAdmin={Boolean(currentUser?.role === 'Admin' || currentUser?.role === 'admin')}
            />
          ) : activeTab === 'vietqr_settings' ? (
            <VietQRAgencySettings />
          ) : activeTab === 'print_settings' ? (
            <ReportPrintSettings />
          ) : (
            <>
              <div className="bg-slate-50 p-6 rounded-2xl border border-gray-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">
                    Lịch sử {subTabs.find(t => t.id === activeTab)?.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Thành phần hiện tại đang áp dụng:{' '}
                    <span className="font-extrabold text-[#004182]">{currentValText}</span>
                  </p>
                </div>
                <button
                  onClick={handleOpenCreate}
                  className="flex items-center justify-center bg-[#004182] text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-800 transition shadow-md shadow-blue-500/10 gap-2 hover:-translate-y-0.5 font-sans cursor-pointer shrink-0"
                >
                  <Plus size={16} /> Ban hành mới
                </button>
              </div>

          {/* Policy cards list */}
          <div className="space-y-4">
            {currentTabPolicies.length === 0 ? (
              <div className="text-center py-12 px-6 bg-slate-50/50 rounded-2xl border border-dashed border-gray-200">
                <FileText className="mx-auto text-gray-400 mb-3" size={42} />
                <p className="text-gray-800 font-bold text-base">Chưa có quyết định / chính sách nào được ban hành.</p>
                <p className="text-gray-500 text-xs mt-1.5 max-w-lg mx-auto leading-relaxed">
                  Hệ thống đang tự động áp dụng thông số an toàn mặc định từ Cấu hình cơ sở:{' '}
                  <span className="font-extrabold text-[#004182]">
                    {fallbackVal !== null ? formatValue(activeTab, fallbackVal) : 'Giá trị mặc định'}
                  </span>
                  . Bạn có thể nhấn nút <span className="font-semibold text-gray-700">"+ Ban hành mới"</span> hoặc <span className="font-semibold text-emerald-700">"Nạp tham số chuẩn từ file"</span> để khởi tạo đầy đủ.
                </p>
              </div>
            ) : (
              currentTabPolicies.map((policy) => {
                const isPolicyActive = policy.is_active;
                return (
                  <div 
                    key={policy.id || `${policy.parameter_type}-${policy.name}`} 
                    className={`bg-white p-5 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:shadow-lg ${
                      isPolicyActive 
                        ? 'border-emerald-200 bg-emerald-50/10 shadow-sm shadow-emerald-500/5' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex gap-4 items-start flex-1 min-w-0">
                      <div className={`p-3 rounded-xl shrink-0 ${isPolicyActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        <FileText size={20} />
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-base">{policy.name}</h4>
                          {policy.id && (
                            <span className="text-[10px] font-mono text-gray-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              ID: #{policy.id}
                            </span>
                          )}
                          {isPolicyActive && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                              ✓ Đang áp dụng
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col text-xs text-gray-500 font-medium space-y-1">
                          {/* COMMISSION VIEW */}
                          {activeTab === 'commission' && (() => {
                            const obj = typeof policy.value === 'string' ? JSON.parse(policy.value) : policy.value;
                            const new1M = obj.commBHXHNew1M ?? 12;
                            const new3M = obj.commBHXHNew3M ?? 15;
                            const new6M = obj.commBHXHNew6M ?? 17;
                            const new12M = obj.commBHXHNew12M ?? obj.commBHXHNew ?? 20;
                            const renew = obj.commBHXHRenew ?? 9;
                            const bhytNew = obj.commBHYTNew ?? 9;
                            const bhytRenew = obj.commBHYTRenew ?? 5;
                            return (
                              <div className="mt-2 space-y-2 max-w-2xl">
                                {/* KHỐI 1: BHXH TĂNG MỚI */}
                                <div className="bg-blue-50/80 border border-blue-100 p-2.5 rounded-xl">
                                  <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                    <span>BHXH Tự nguyện - Tăng mới theo phương thức</span>
                                    <span className="text-[10px] text-blue-600 font-normal">Tự động áp dụng theo số tháng</span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="bg-white p-1.5 rounded-lg border border-blue-200/60 text-center shadow-2xs">
                                      <span className="text-[10px] text-gray-500 block">Đóng 1 tháng</span>
                                      <span className="text-blue-700 font-black text-sm">{new1M}%</span>
                                    </div>
                                    <div className="bg-white p-1.5 rounded-lg border border-blue-200/60 text-center shadow-2xs">
                                      <span className="text-[10px] text-gray-500 block">Đóng 3 tháng</span>
                                      <span className="text-blue-700 font-black text-sm">{new3M}%</span>
                                    </div>
                                    <div className="bg-white p-1.5 rounded-lg border border-blue-200/60 text-center shadow-2xs">
                                      <span className="text-[10px] text-gray-500 block">Đóng 6 tháng</span>
                                      <span className="text-blue-700 font-black text-sm">{new6M}%</span>
                                    </div>
                                    <div className="bg-white p-1.5 rounded-lg border border-blue-200/60 text-center shadow-2xs">
                                      <span className="text-[10px] text-gray-500 block">Đóng 12 tháng</span>
                                      <span className="text-blue-700 font-black text-sm">{new12M}%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* KHỐI 2: BHXH GIA HẠN & BHYT */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                  <div className="bg-sky-50/80 border border-sky-100 p-2.5 rounded-xl">
                                    <div className="text-[11px] font-bold text-sky-900 uppercase tracking-wide mb-1 flex items-center justify-between">
                                      <span>BHXH Gia hạn & Đóng trước</span>
                                      <span className="text-sky-700 font-bold">{renew}%</span>
                                    </div>
                                    <p className="text-[10px] text-sky-800 leading-relaxed font-normal">
                                      Đóng trước &gt; 12 tháng hoặc đóng năm còn thiếu: 12 tháng đầu hưởng <span className="font-bold text-sky-900">{new12M}%</span>, các tháng sau hưởng <span className="font-bold text-sky-900">{renew}%</span>.
                                    </p>
                                  </div>

                                  <div className="bg-emerald-50/80 border border-emerald-100 p-2.5 rounded-xl">
                                    <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide mb-1">
                                      BHYT Hộ gia đình
                                    </div>
                                    <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mt-1">
                                      <div>Tăng mới: <span className="text-emerald-700 font-black">{bhytNew}%</span></div>
                                      <div>Gia hạn: <span className="text-emerald-700 font-black">{bhytRenew}%</span></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* CPI INDEX VIEW */}
                          {activeTab === 'cpi_index' && (
                            <div className="mt-1">
                              <span className="text-gray-600 font-semibold">Bảng hệ số:</span>
                              <pre className="bg-slate-50 p-2.5 rounded border border-gray-200 text-[10px] font-mono text-gray-700 mt-1 max-h-32 overflow-y-auto">
                                {formatValue(activeTab, policy.value)}
                              </pre>
                            </div>
                          )}

                          {/* BASE SALARY / POVERTY STANDARD / INVESTMENT RATE */}
                          {activeTab !== 'commission' && activeTab !== 'cpi_index' && (
                            <div className="mt-1">
                              Giá trị:{' '}
                              <span className="font-bold text-gray-800 text-sm">
                                {formatValue(activeTab, policy.value)}
                              </span>
                            </div>
                          )}

                          <div className="pt-1 text-gray-400">
                            Hiệu lực:{' '}
                            <span className="font-bold text-gray-600">
                              {formatDateVN(policy.effective_date)}
                            </span>
                          </div>
                        </div>

                        {policy.description && (
                          <p className="text-xs text-gray-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 mt-2 font-medium max-w-2xl leading-relaxed whitespace-pre-wrap">
                            {policy.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {isPolicyActive ? (
                        <button 
                          disabled 
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        >
                          Đang áp dụng
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleActivate(policy.id!, policy.name)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 transition shadow-sm cursor-pointer"
                        >
                          Áp dụng mốc này
                        </button>
                      )}
                      <button 
                        onClick={() => handleOpenEdit(policy)}
                        className="p-2 text-gray-400 hover:text-[#004182] hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(policy.id!, policy.name)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-slate-50 rounded-lg transition cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Creation / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center shrink-0">
              <h4 className="font-bold text-gray-800 text-base">
                {editingPolicy ? 'Chỉnh Sửa Quyết Định / Chính Sách' : 'Ban Hành Quyết Định / Chính Sách Mới'}
              </h4>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tên quyết định / Nghị định / Văn bản</label>
                <input 
                  type="text" 
                  value={modalForm.name}
                  onChange={e => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-semibold" 
                  placeholder={
                    activeTab === 'base_salary' ? 'VD: Nghị định 73/2024/NĐ-CP hoặc Nghị định 161/2026/NĐ-CP'
                    : activeTab === 'poverty_standard' ? 'VD: Chuẩn nghèo nông thôn 2026'
                    : activeTab === 'commission' ? 'VD: Cài đặt Tỷ lệ Hoa hồng đại lý 2026'
                    : activeTab === 'investment_rate' ? 'VD: Quyết định điều chỉnh Lãi suất đầu tư quỹ 2026'
                    : 'VD: Công văn 340/BHXH-CSXH về Hệ số trượt giá 2026'
                  }
                  required
                />
              </div>

              {/* CPI INDEX INPUT */}
              {activeTab === 'cpi_index' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Hệ số trượt giá (JSON)</label>
                  <textarea 
                    value={modalForm.valueText}
                    onChange={e => setModalForm(prev => ({ ...prev, valueText: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-xs font-mono h-36 resize-y" 
                    placeholder={'{\n  "2026": 1.0\n}'}
                    required
                  />
                </div>
              )}

              {/* COMMISSION INPUTS */}
              {activeTab === 'commission' && (
                <div className="space-y-4">
                  {/* KHỐI 1: BHXH TĂNG MỚI THEO PHƯƠNG THỨC */}
                  <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                      <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                        1. BHXH Tự nguyện - Tăng mới theo phương thức
                      </h5>
                      <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/80 px-2 py-0.5 rounded-full">
                        Phân loại theo kỳ đóng
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Đóng 1 tháng (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHXHNew1M}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHXHNew1M: e.target.value }))}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-blue-900 bg-white"
                          required
                          placeholder="12"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Đóng 3 tháng (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHXHNew3M}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHXHNew3M: e.target.value }))}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-blue-900 bg-white"
                          required
                          placeholder="15"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Đóng 6 tháng (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHXHNew6M}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHXHNew6M: e.target.value }))}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-blue-900 bg-white"
                          required
                          placeholder="17"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Đóng 12 tháng (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHXHNew12M}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHXHNew12M: e.target.value, commBHXHNew: e.target.value }))}
                          className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-blue-900 bg-white"
                          required
                          placeholder="20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* KHỐI 2: BHXH GIA HẠN & QUY TẮC ĐÓNG TRƯỚC */}
                  <div className="bg-sky-50/60 p-3.5 rounded-xl border border-sky-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-sky-100 pb-1.5">
                      <h5 className="text-xs font-bold text-sky-900 uppercase tracking-wider">
                        2. BHXH Tự nguyện - Gia hạn & Đóng trước
                      </h5>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">Gia hạn (đóng tiếp) (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHXHRenew}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHXHRenew: e.target.value }))}
                          className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-sky-900 bg-white"
                          required
                          placeholder="9"
                        />
                      </div>
                      <div className="sm:col-span-2 text-[11px] text-sky-800 bg-sky-100/60 p-2.5 rounded-lg border border-sky-200/50 leading-relaxed font-medium">
                        💡 <span className="font-bold">Quy tắc tự động đóng trước / năm còn thiếu (&gt; 12 tháng):</span> 12 tháng đầu tính tăng mới ({modalForm.commBHXHNew12M || 20}%), các tháng sau tính gia hạn ({modalForm.commBHXHRenew || 9}%).
                      </div>
                    </div>
                  </div>

                  {/* KHỐI 3: BHYT HỘ GIA ĐÌNH */}
                  <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-100 pb-1.5">
                      <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                        3. BHYT Hộ gia đình
                      </h5>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">BHYT Tăng mới (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHYTNew}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHYTNew: e.target.value }))}
                          className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm font-bold text-emerald-900 bg-white"
                          required
                          placeholder="9"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">BHYT Gia hạn (%)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          value={modalForm.commBHYTRenew}
                          onChange={e => setModalForm(prev => ({ ...prev, commBHYTRenew: e.target.value }))}
                          className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-sm font-bold text-emerald-900 bg-white"
                          required
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NUMERIC SINGLE VALUE INPUTS */}
              {activeTab !== 'commission' && activeTab !== 'cpi_index' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    {activeTab === 'investment_rate' ? 'Tỷ lệ lãi suất (%)' : 'Giá trị (VNĐ)'}
                  </label>
                  <input 
                    type="number" 
                    step={activeTab === 'investment_rate' ? '0.01' : '1'}
                    value={modalForm.valueText}
                    onChange={e => setModalForm(prev => ({ ...prev, valueText: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-bold text-gray-800" 
                    placeholder={activeTab === 'investment_rate' ? 'VD: 0.31' : 'VD: 2530000'}
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày hiệu lực áp dụng</label>
                <input 
                  type="date" 
                  value={modalForm.effective_date}
                  onChange={e => setModalForm(prev => ({ ...prev, effective_date: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-semibold" 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú / Trích dẫn tóm tắt quyết định</label>
                <textarea 
                  value={modalForm.description}
                  onChange={e => setModalForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm h-20 resize-y" 
                  placeholder="Mô tả tóm tắt nội dung chính hoặc trích dẫn nghị định, công văn..."
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-500 bg-slate-50 border border-gray-200 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 text-xs font-bold text-white bg-[#004182] rounded-lg hover:bg-blue-800 transition shadow-sm cursor-pointer"
                >
                  {editingPolicy ? 'Cập nhật' : 'Ban hành mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => {
            setDeleteConfirmOpen(false);
            setPolicyToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Xóa Quyết định / Chính sách?"
          message={`Bạn có chắc chắn muốn xóa chính sách "${policyToDelete?.name}"?`}
          confirmText="Xóa ngay"
        />
      )}
    </div>
  );
};

export default SystemSettings;
