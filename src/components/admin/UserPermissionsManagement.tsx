import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Wallet, 
  BarChart3, 
  Clock, 
  RotateCcw, 
  Save, 
  Check, 
  X, 
  Search, 
  AlertTriangle, 
  Info, 
  UserCheck, 
  Plus, 
  Minus, 
  ArrowRight,
  Sparkles,
  Lock,
  ChevronRight,
  Filter
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { 
  PERMISSION_GROUPS, 
  PermissionKey, 
  DEFAULT_ROLE_PERMISSIONS, 
  UserPermissionOverride,
  UserOverridesMap,
  getUserOverride,
  getEffectivePermissionsForStaff,
  sanitizeUserOverrides,
  getPermissionsForRole,
  ALL_PERMISSIONS
} from '../../utils/permissions';
import type { StaffType } from '../../context/types';

export const UserPermissionsManagement: React.FC = () => {
  const { settings, updateSettings, showToast, addAuditLog, staff = [] } = useAppContext() as any;

  // Lọc danh sách nhân viên có thể phân quyền (không tính Admin tối cao vì Admin luôn có toàn quyền)
  const assignableStaffList: StaffType[] = useMemo(() => {
    return (staff || []).filter((s: StaffType) => {
      const role = (s.role || '').toLowerCase();
      const name = (s.name || '').toLowerCase();
      // Loại trừ Admin / Quản trị viên tối cao
      return role !== 'admin' && role !== 'quản trị viên' && !name.includes('phạm văn học');
    });
  }, [staff]);

  // Nhân viên đang được chọn để chỉnh sửa đặc cách
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [searchStaff, setSearchStaff] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // State lưu trữ bản đồ đặc cách đang chỉnh sửa
  const [userOverridesState, setUserOverridesState] = useState<UserOverridesMap>(() => {
    return sanitizeUserOverrides(settings?.userOverrides);
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Tự động chọn nhân viên đầu tiên nếu chưa chọn
  useEffect(() => {
    if (!selectedStaffId && assignableStaffList.length > 0) {
      setSelectedStaffId(assignableStaffList[0].id);
    }
  }, [assignableStaffList, selectedStaffId]);

  // Đồng bộ khi settings từ server/context thay đổi
  useEffect(() => {
    if (settings?.userOverrides) {
      setUserOverridesState(sanitizeUserOverrides(settings.userOverrides));
      setHasChanges(false);
    }
  }, [settings?.userOverrides]);

  // Tìm kiếm nhân viên
  const filteredStaffList = useMemo(() => {
    return assignableStaffList.filter(s => {
      const matchRole = roleFilter === 'all' || s.role === roleFilter;
      const q = searchStaff.toLowerCase().trim();
      const matchQuery = !q || 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.staffCode && s.staffCode.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));
      return matchRole && matchQuery;
    });
  }, [assignableStaffList, searchStaff, roleFilter]);

  // Đối tượng nhân viên đang chọn
  const currentStaff = useMemo(() => {
    return assignableStaffList.find(s => s.id === selectedStaffId) || null;
  }, [assignableStaffList, selectedStaffId]);

  // Cấu hình override của nhân viên đang chọn trong state
  const currentStaffOverride = useMemo(() => {
    if (!selectedStaffId) return null;
    return userOverridesState[selectedStaffId] || null;
  }, [userOverridesState, selectedStaffId]);

  // Quyền cơ sở theo vai trò của nhân viên đang chọn
  const baseRolePermissions = useMemo(() => {
    if (!currentStaff) return [];
    return getPermissionsForRole(currentStaff.role || 'Nhân viên', settings);
  }, [currentStaff, settings]);

  // Kiểm tra trạng thái đặc cách của 1 quyền cho nhân viên đang chọn:
  // 'inherit' (theo vai trò) | 'grant' (cấp đặc cách) | 'revoke' (chặn đặc cách)
  const getPermissionStatus = (key: PermissionKey): 'inherit' | 'grant' | 'revoke' => {
    if (!currentStaffOverride) return 'inherit';
    if (currentStaffOverride.granted?.includes(key)) return 'grant';
    if (currentStaffOverride.revoked?.includes(key)) return 'revoke';
    return 'inherit';
  };

  // Quyền này cuối cùng có hiệu lực hay không
  const isEffectiveAllowed = (key: PermissionKey): boolean => {
    const status = getPermissionStatus(key);
    if (status === 'grant') return true;
    if (status === 'revoke') return false;
    return baseRolePermissions.includes(key);
  };

  // Đổi trạng thái đặc cách của một quyền
  const handleSetPermissionStatus = (key: PermissionKey, newStatus: 'inherit' | 'grant' | 'revoke') => {
    if (!selectedStaffId || !currentStaff) return;

    setUserOverridesState(prev => {
      const existing = prev[selectedStaffId] || {
        staffId: selectedStaffId,
        staffName: currentStaff.name,
        staffCode: currentStaff.staffCode,
        role: currentStaff.role,
        granted: [],
        revoked: []
      };

      let newGranted = (existing.granted || []).filter(k => k !== key);
      let newRevoked = (existing.revoked || []).filter(k => k !== key);

      if (newStatus === 'grant') {
        newGranted.push(key);
      } else if (newStatus === 'revoke') {
        newRevoked.push(key);
      }

      // Nếu không còn quyền granted và revoked nào, xóa key khỏi map
      if (newGranted.length === 0 && newRevoked.length === 0) {
        const next = { ...prev };
        delete next[selectedStaffId];
        return next;
      }

      return {
        ...prev,
        [selectedStaffId]: {
          ...existing,
          staffName: currentStaff.name,
          staffCode: currentStaff.staffCode,
          role: currentStaff.role,
          granted: newGranted,
          revoked: newRevoked,
          updatedAt: new Date().toISOString()
        }
      };
    });

    setHasChanges(true);
  };

  // Khôi phục nhân viên đang chọn về 100% theo vai trò (xóa override)
  const handleResetCurrentStaffToRole = () => {
    if (!selectedStaffId || !currentStaff) return;

    setUserOverridesState(prev => {
      const next = { ...prev };
      delete next[selectedStaffId];
      return next;
    });
    setHasChanges(true);
    showToast(`Đã khôi phục nhân viên "${currentStaff.name}" về phân quyền theo vai trò ${currentStaff.role}!`, 'info');
  };

  // Lưu cấu hình phân quyền đặc cách
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanMap = sanitizeUserOverrides(userOverridesState);
      const ok = await updateSettings({
        ...settings,
        userOverrides: cleanMap
      });

      if (ok) {
        setHasChanges(false);
        showToast('Đã lưu cấu hình phân quyền đặc cách riêng theo nhân viên thành công!', 'success');
        
        // Ghi nhật ký kiểm toán
        if (addAuditLog) {
          const overrideCount = Object.keys(cleanMap).length;
          await addAuditLog(
            'Cập nhật Phân Quyền Đặc Cách',
            `Cập nhật phân quyền đặc cách riêng cho nhân sự (${overrideCount} cán bộ có đặc cách)`
          );
        }
      } else {
        showToast('Lỗi khi lưu cấu hình phân quyền đặc cách!', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Đã xảy ra lỗi khi lưu: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Thống kê cho nhân viên đang chọn
  const grantedCount = currentStaffOverride?.granted?.length || 0;
  const revokedCount = currentStaffOverride?.revoked?.length || 0;
  const effectiveCount = ALL_PERMISSIONS.filter(p => isEffectiveAllowed(p.key)).length;

  // Danh sách các nhân viên hiện đang có đặc cách trong toàn hệ thống
  const activeOverridesList = useMemo(() => {
    return Object.entries(userOverridesState).map(([id, ov]) => {
      const st = (staff || []).find((s: StaffType) => s.id === id);
      return {
        id,
        name: st?.name || ov.staffName || id,
        staffCode: st?.staffCode || ov.staffCode || 'N/A',
        role: st?.role || ov.role || 'Nhân viên',
        grantedCount: ov.granted?.length || 0,
        revokedCount: ov.revoked?.length || 0,
        updatedAt: ov.updatedAt
      };
    });
  }, [userOverridesState, staff]);

  const getGroupIcon = (groupId: string) => {
    switch (groupId) {
      case 'customers': return <Users size={18} className="text-blue-600" />;
      case 'finance': return <Wallet size={18} className="text-emerald-600" />;
      case 'reports': return <BarChart3 size={18} className="text-amber-600" />;
      case 'dispatch': return <Clock size={18} className="text-purple-600" />;
      case 'system': return <ShieldAlert size={18} className="text-rose-600" />;
      default: return <Shield size={18} className="text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#004182] to-[#002855] text-white p-5 sm:p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={24} className="text-amber-300" />
            <h3 className="text-lg sm:text-xl font-bold">Phân Quyền Đặc Cách Riêng Theo Nhân Viên (User Overrides)</h3>
          </div>
          <p className="text-xs sm:text-sm text-blue-100 max-w-3xl">
            Cấp thêm quyền vượt cấp hoặc chặn bớt quyền nhạy cảm cho từng cán bộ thu cụ thể. Mọi quyền không can thiệp sẽ tiếp tục kế thừa 100% từ vai trò.
          </p>
        </div>

        {/* Nút hành động */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleResetCurrentStaffToRole}
            disabled={!currentStaffOverride}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition border cursor-pointer ${
              currentStaffOverride
                ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
                : 'bg-white/5 text-white/40 border-white/10 cursor-not-allowed'
            }`}
            title="Xóa mọi đặc cách của nhân viên này, trở về phân quyền theo vai trò"
          >
            <RotateCcw size={15} /> Xóa Đặc Cách
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-md cursor-pointer ${
              hasChanges 
                ? 'bg-amber-400 hover:bg-amber-500 text-blue-950 animate-pulse' 
                : 'bg-white/20 text-white/60 cursor-not-allowed'
            }`}
          >
            <Save size={16} /> {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>

      {/* Grid: 2 Cột (Cột trái: Chọn Cán Bộ | Cột phải: Bảng Ma Trận Quyền Đặc Cách) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: DANH SÁCH CÁN BỘ THU (4 Cột trên Desktop) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <UserCheck size={18} className="text-[#004182]" />
              <h4 className="font-bold text-slate-800 text-sm">Chọn Cán Bộ Cần Phân Quyền</h4>
            </div>
            <span className="text-xs bg-blue-50 text-[#004182] border border-blue-200 font-bold px-2 py-0.5 rounded-full">
              {filteredStaffList.length} nhân sự
            </span>
          </div>

          {/* Ô tìm kiếm & Bộ lọc vai trò */}
          <div className="space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchStaff}
                onChange={e => setSearchStaff(e.target.value)}
                placeholder="Tìm tên, mã NV, số điện thoại..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 bg-slate-50/50 text-slate-800 placeholder-slate-400"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setRoleFilter('all')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  roleFilter === 'all' ? 'bg-[#004182] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả
              </button>
              <button
                onClick={() => setRoleFilter('Nhân viên')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                  roleFilter === 'Nhân viên' ? 'bg-[#004182] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Nhân viên
              </button>
              <button
                onClick={() => setRoleFilter('Quản lý')}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition ${
                  roleFilter === 'Quản lý' ? 'bg-[#004182] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Quản lý
              </button>
            </div>
          </div>

          {/* Danh sách nhân viên có thể chọn */}
          <div className="space-y-1.5 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
            {filteredStaffList.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-400">
                Không tìm thấy cán bộ thu phù hợp.
              </div>
            ) : (
              filteredStaffList.map(st => {
                const isSelected = st.id === selectedStaffId;
                const ov = userOverridesState[st.id];
                const hasOverride = (ov?.granted?.length || 0) > 0 || (ov?.revoked?.length || 0) > 0;

                return (
                  <div
                    key={st.id}
                    onClick={() => setSelectedStaffId(st.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-blue-50/80 border-[#004182] shadow-xs'
                        : 'bg-white border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold truncate ${isSelected ? 'text-[#004182]' : 'text-gray-800'}`}>
                          {st.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-gray-100 text-gray-600 font-mono">
                          {st.role || 'Nhân viên'}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 truncate mt-0.5">
                        {st.staffCode || st.phone || st.email || 'Chưa có mã'}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {hasOverride ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5">
                          <Sparkles size={10} /> Đặc cách ({ov?.granted?.length || 0}+ / {ov?.revoked?.length || 0}-)
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                          Theo vai trò
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: BẢNG MA TRẬN 5 NHÓM QUYỀN ĐẶC CÁCH (8 Cột trên Desktop) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Thẻ Tóm tắt Nhân viên đang chọn */}
          {currentStaff ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#004182] text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                  {currentStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-black text-gray-900">{currentStaff.name}</h4>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold">
                      Vai trò: {currentStaff.role || 'Nhân viên'}
                    </span>
                    {currentStaffOverride && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                        Đang có đặc cách riêng
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Mã NV: <strong>{currentStaff.staffCode || 'N/A'}</strong> • SĐT: <strong>{currentStaff.phone || 'N/A'}</strong> • Khu vực: <strong>{currentStaff.area || 'Toàn đại lý'}</strong>
                  </p>
                </div>
              </div>

              {/* Bộ đếm quyền */}
              <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-center">
                  <div className="text-[10px] text-gray-500 font-semibold uppercase">Hiệu lực</div>
                  <div className="text-sm font-black text-[#004182]">{effectiveCount}/{ALL_PERMISSIONS.length}</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase">Cấp thêm</div>
                  <div className="text-sm font-black text-emerald-700">+{grantedCount}</div>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <div className="text-[10px] text-rose-700 font-semibold uppercase">Chặn bớt</div>
                  <div className="text-sm font-black text-rose-700">-{revokedCount}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              Vui lòng chọn một cán bộ thu từ danh sách bên trái để phân quyền đặc cách.
            </div>
          )}

          {/* Ma trận 5 nhóm quyền */}
          {currentStaff && (
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => {
                return (
                  <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                    {/* Tiêu đề nhóm */}
                    <div className="p-3.5 sm:p-4 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-white shadow-xs">
                          {getGroupIcon(group.id)}
                        </div>
                        <div>
                          <h5 className="font-bold text-gray-800 text-sm">{group.name}</h5>
                          <p className="text-[11px] text-gray-500">{group.description}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-gray-400">
                        {group.permissions.length} quyền
                      </span>
                    </div>

                    {/* Danh sách quyền trong nhóm */}
                    <div className="divide-y divide-gray-100">
                      {group.permissions.map(perm => {
                        const status = getPermissionStatus(perm.key);
                        const isRoleAllowed = baseRolePermissions.includes(perm.key);
                        const isAllowed = isEffectiveAllowed(perm.key);

                        return (
                          <div 
                            key={perm.key}
                            className={`p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                              status === 'grant' 
                                ? 'bg-emerald-50/30' 
                                : status === 'revoke' 
                                ? 'bg-rose-50/30' 
                                : 'hover:bg-gray-50/50'
                            }`}
                          >
                            {/* Cột trái: Tên & mô tả */}
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-gray-900">
                                  {perm.label}
                                </span>
                                {perm.isSensitive && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                    Quyền nhạy cảm
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-gray-400">
                                  ({perm.key})
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {perm.description}
                              </p>
                              
                              {/* Thông tin vai trò gốc */}
                              <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                                <span className="text-gray-400">Vai trò gốc ({currentStaff.role}):</span>
                                <span className={`font-bold ${isRoleAllowed ? 'text-blue-700' : 'text-gray-500'}`}>
                                  {isRoleAllowed ? '● Cho phép' : '○ Không có quyền'}
                                </span>
                                <span className="text-gray-300">•</span>
                                <span className="text-gray-400">Hiệu lực hiện thời:</span>
                                <span className={`font-black ${isAllowed ? 'text-emerald-700' : 'text-rose-600'}`}>
                                  {isAllowed ? 'ĐƯỢC PHÉP' : 'BỊ CHẶN'}
                                </span>
                              </div>
                            </div>

                            {/* Cột phải: Bộ 3 nút chọn trạng thái đặc cách */}
                            <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl self-start md:self-center shrink-0">
                              {/* 1. Theo vai trò */}
                              <button
                                type="button"
                                onClick={() => handleSetPermissionStatus(perm.key, 'inherit')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  status === 'inherit'
                                    ? 'bg-white text-gray-800 shadow-xs'
                                    : 'text-gray-500 hover:text-gray-800'
                                }`}
                                title="Kế thừa theo cấp vai trò chung"
                              >
                                Theo vai trò
                              </button>

                              {/* 2. Cấp đặc cách */}
                              <button
                                type="button"
                                onClick={() => handleSetPermissionStatus(perm.key, 'grant')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  status === 'grant'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title="Luôn cho phép nhân viên này thực hiện quyền này (+)"
                              >
                                <Plus size={13} className="stroke-[3]" /> Cấp (+)
                              </button>

                              {/* 3. Chặn đặc cách */}
                              <button
                                type="button"
                                onClick={() => handleSetPermissionStatus(perm.key, 'revoke')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  status === 'revoke'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Chặn nhân viên này thực hiện quyền này (-)"
                              >
                                <Minus size={13} className="stroke-[3]" /> Chặn (-)
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* BẢNG TỔNG KẾT: TẤT CẢ CÁN BỘ ĐANG CÓ QUYỀN ĐẶC CÁCH */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                <h4 className="font-bold text-gray-800 text-sm">Danh Sách Cán Bộ Đang Có Quyền Đặc Cách Riêng</h4>
              </div>
              <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                {activeOverridesList.length} nhân sự
              </span>
            </div>

            {activeOverridesList.length === 0 ? (
              <p className="text-xs text-gray-400 py-3 italic text-center">
                Chưa có cán bộ nào được phân quyền đặc cách riêng. Mọi nhân viên hiện đang tuân theo phân quyền theo vai trò.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Cán Bộ Thu</th>
                      <th className="py-2.5 px-3">Vai Trò</th>
                      <th className="py-2.5 px-3 text-center">Đặc Cách Cấp (+)</th>
                      <th className="py-2.5 px-3 text-center">Đặc Cách Chặn (-)</th>
                      <th className="py-2.5 px-3 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeOverridesList.map(ov => (
                      <tr 
                        key={ov.id}
                        className={`hover:bg-blue-50/50 transition cursor-pointer ${
                          ov.id === selectedStaffId ? 'bg-blue-50/60 font-semibold' : ''
                        }`}
                        onClick={() => setSelectedStaffId(ov.id)}
                      >
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {ov.name} <span className="font-normal text-gray-400 font-mono">({ov.staffCode})</span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-medium">
                          {ov.role}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black">
                            +{ov.grantedCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black">
                            -{ov.revokedCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStaffId(ov.id);
                            }}
                            className="text-[#004182] hover:underline font-bold"
                          >
                            Chỉnh sửa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsManagement;
