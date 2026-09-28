import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Wallet, 
  BarChart3, 
  Clock, 
  RotateCcw, 
  Save, 
  Check, 
  AlertTriangle,
  Info,
  Lock
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { 
  PERMISSION_GROUPS, 
  PermissionKey, 
  DEFAULT_ROLE_PERMISSIONS, 
  SanitizedRolePermissionsMap,
  sanitizeRolePermissions
} from '../../utils/permissions';
import UserPermissionsManagement from './UserPermissionsManagement';

const RolePermissionsManagement: React.FC = () => {
  const { settings, updateSettings, showToast, addAuditLog, currentUser } = useAppContext() as any;

  // Chế độ phân quyền: Theo vai trò (role) hoặc Đặc cách riêng theo nhân viên (user)
  const [permissionMode, setPermissionMode] = useState<'role' | 'user'>('role');

  // Vai trò đang được chọn để chỉnh sửa (chỉ cho phép sửa Quản lý và Nhân viên)
  const [selectedRole, setSelectedRole] = useState<'Quản lý' | 'Nhân viên'>('Nhân viên');
  
  // State lưu ma trận quyền đang chỉnh sửa trên form
  const [permissionsState, setPermissionsState] = useState<SanitizedRolePermissionsMap>(() => {
    return sanitizeRolePermissions(settings?.rolePermissions);
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Đồng bộ khi settings thay đổi từ bên ngoài
  useEffect(() => {
    if (settings?.rolePermissions) {
      setPermissionsState(sanitizeRolePermissions(settings.rolePermissions));
      setHasChanges(false);
    }
  }, [settings?.rolePermissions]);

  // Kiểm tra xem một quyền có đang được bật cho role đang chọn không
  const isPermissionEnabled = (key: PermissionKey): boolean => {
    const rolePerms = permissionsState[selectedRole] || [];
    return rolePerms.includes(key);
  };

  // Toggle bật/tắt một quyền
  const handleTogglePermission = (key: PermissionKey) => {
    const currentList = permissionsState[selectedRole] || [];
    let updatedList: PermissionKey[];

    if (currentList.includes(key)) {
      updatedList = currentList.filter(k => k !== key);
    } else {
      updatedList = [...currentList, key];
    }

    setPermissionsState(prev => ({
      ...prev,
      [selectedRole]: updatedList
    }));
    setHasChanges(true);
  };

  // Bật/tắt tất cả quyền trong một nhóm cho role hiện tại
  const handleToggleGroup = (keys: PermissionKey[], enable: boolean) => {
    const currentList = permissionsState[selectedRole] || [];
    let updatedList: PermissionKey[];

    if (enable) {
      const merged = new Set([...currentList, ...keys]);
      updatedList = Array.from(merged) as PermissionKey[];
    } else {
      const keySet = new Set(keys);
      updatedList = currentList.filter(k => !keySet.has(k));
    }

    setPermissionsState(prev => ({
      ...prev,
      [selectedRole]: updatedList
    }));
    setHasChanges(true);
  };

  // Khôi phục mặc định cho vai trò đang chọn
  const handleResetToDefault = () => {
    setPermissionsState(prev => ({
      ...prev,
      [selectedRole]: [...DEFAULT_ROLE_PERMISSIONS[selectedRole]]
    }));
    setHasChanges(true);
    showToast(`Đã khôi phục quyền mặc định cho vai trò ${selectedRole}!`, 'info');
  };

  // Lưu cấu hình phân quyền
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const cleanMap = sanitizeRolePermissions(permissionsState);
      const ok = await updateSettings({
        ...settings,
        rolePermissions: cleanMap
      });

      if (ok) {
        setHasChanges(false);
        showToast('Đã lưu cấu hình phân quyền vai trò thành công!', 'success');
        
        // Ghi nhận nhật ký kiểm toán
        if (addAuditLog) {
          await addAuditLog(
            'Cập nhật Phân Quyền',
            `Cập nhật ma trận phân quyền cho vai trò "${selectedRole}" (${cleanMap[selectedRole]?.length || 0} quyền được cấp)`
          );
        }
      } else {
        showToast('Lỗi khi lưu cấu hình phân quyền!', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Đã xảy ra lỗi khi lưu: ' + (err.message || ''), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const currentRolePermCount = (permissionsState[selectedRole] || []).length;
  const totalAvailablePermCount = PERMISSION_GROUPS.reduce((acc, g) => acc + g.permissions.length, 0);

  const getGroupIcon = (groupId: string) => {
    switch (groupId) {
      case 'customers': return <Users size={20} className="text-blue-600" />;
      case 'finance': return <Wallet size={20} className="text-emerald-600" />;
      case 'reports': return <BarChart3 size={20} className="text-amber-600" />;
      case 'dispatch': return <Clock size={20} className="text-purple-600" />;
      case 'system': return <ShieldAlert size={20} className="text-rose-600" />;
      default: return <Shield size={20} className="text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Chuyển Đổi 2 Chế Độ Phân Quyền */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gray-100/90 p-1.5 rounded-2xl">
        <button
          type="button"
          onClick={() => setPermissionMode('role')}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            permissionMode === 'role'
              ? 'bg-[#004182] text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <ShieldCheck size={18} /> Phân Quyền Theo Vai Trò (Role Permissions)
        </button>

        <button
          type="button"
          onClick={() => setPermissionMode('user')}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
            permissionMode === 'user'
              ? 'bg-[#004182] text-white shadow-md'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Users size={18} /> Phân Quyền Đặc Cách Riêng Theo Nhân Viên (User Overrides)
        </button>
      </div>

      {permissionMode === 'user' ? (
        <UserPermissionsManagement />
      ) : (
        <>
          {/* Top Banner Thông tin */}
          <div className="bg-gradient-to-r from-[#004182] to-[#002855] text-white p-5 sm:p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={24} className="text-amber-300" />
                <h3 className="text-lg sm:text-xl font-bold">Thiết Lập Ma Trận Phân Quyền Chi Tiết (RBAC)</h3>
              </div>
          <p className="text-xs sm:text-sm text-blue-100 max-w-2xl">
            Tùy biến quyền hạn chặt chẽ cho từng cấp vai trò: Quản lý và Nhân viên. Quyền hạn sẽ được áp dụng trực tiếp lên các nút thao tác, xem báo cáo, chỉnh sửa và xóa dữ liệu.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-semibold transition border border-white/20 cursor-pointer"
          >
            <RotateCcw size={15} /> Mặc định
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

      {/* Role Switcher Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2 mr-1">Cấp vai trò:</span>
          
          <button
            onClick={() => setSelectedRole('Nhân viên')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              selectedRole === 'Nhân viên'
                ? 'bg-[#004182] text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Users size={16} /> Cán Bộ Thu (Nhân viên)
          </button>

          <button
            onClick={() => setSelectedRole('Quản lý')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              selectedRole === 'Quản lý'
                ? 'bg-[#004182] text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            <Shield size={16} /> Quản Lý Đơn Vị
          </button>

          <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200 ml-1">
            <Lock size={13} /> Admin (Toàn quyền mặc định)
          </div>
        </div>

        {/* Counter Badge */}
        <div className="text-xs text-gray-500 px-3 flex items-center gap-1.5">
          <span>Đang cấp:</span>
          <span className="font-bold text-[#004182] text-sm">{currentRolePermCount}</span>
          <span>/ {totalAvailablePermCount} quyền</span>
        </div>
      </div>

      {/* Role Description Card */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3 text-xs sm:text-sm text-blue-900">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Quy tắc phân quyền cho vai trò "{selectedRole}": </span>
          {selectedRole === 'Nhân viên' ? (
            <span>
              Mặc định chỉ thao tác với hồ sơ và khách hàng do chính mình phụ trách. Việc bật quyền <strong>Xóa hồ sơ</strong> hoặc <strong>Xem doanh thu toàn đại lý</strong> cần được phê duyệt kỹ lưỡng để tránh rò rỉ dữ liệu hoặc xóa nhầm.
            </span>
          ) : (
            <span>
              Quản lý có thể xem toàn diện doanh số, điều phối đôn đốc và kiểm soát giao dịch tài chính. Có thể ủy quyền cho Quản lý thực hiện thoái thu hoàn trả và chốt sổ tài chính định kỳ.
            </span>
          )}
        </div>
      </div>

      {/* 5 Nhóm Quyền Hạn Hàng Loạt */}
      <div className="grid grid-cols-1 gap-6">
        {PERMISSION_GROUPS.map(group => {
          const groupKeys = group.permissions.map(p => p.key);
          const allGroupEnabled = groupKeys.every(k => isPermissionEnabled(k));
          const someGroupEnabled = groupKeys.some(k => isPermissionEnabled(k));

          return (
            <div key={group.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Group Header */}
              <div className="p-4 bg-gray-50/80 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-xs border border-gray-100">
                    {getGroupIcon(group.id)}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm sm:text-base">{group.name}</h4>
                    <p className="text-xs text-gray-500">{group.description}</p>
                  </div>
                </div>

                {/* Toggle Group Quick Action */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleToggleGroup(groupKeys, true)}
                    disabled={allGroupEnabled}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-blue-50 cursor-pointer"
                  >
                    Bật tất cả
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => handleToggleGroup(groupKeys, false)}
                    disabled={!someGroupEnabled}
                    className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-gray-100 cursor-pointer"
                  >
                    Tắt tất cả
                  </button>
                </div>
              </div>

              {/* Group Permissions List */}
              <div className="divide-y divide-gray-100">
                {group.permissions.map(perm => {
                  const enabled = isPermissionEnabled(perm.key);

                  return (
                    <div 
                      key={perm.key} 
                      className={`p-4 sm:px-6 flex items-start sm:items-center justify-between gap-4 transition hover:bg-gray-50/50 ${
                        enabled ? 'bg-blue-50/20' : ''
                      }`}
                    >
                      <div className="flex-1 pr-2">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-gray-800 text-sm">{perm.label}</span>
                          <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            {perm.key}
                          </span>
                          {perm.isSensitive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle size={11} /> Nhạy cảm
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{perm.description}</p>
                      </div>

                      {/* Switch Toggle */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => handleTogglePermission(perm.key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#004182] focus:ring-offset-2 ${
                          enabled ? 'bg-[#004182]' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
};

export default RolePermissionsManagement;
