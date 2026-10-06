import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Plus, Search, Edit, Trash2, UserCheck, UserX, ShieldCheck, Users } from 'lucide-react';
import { checkStaffDeleteSafety, checkZeroAdminRisk } from '../../utils/security';
import StaffModal from '../modals/StaffModal';
import ConfirmModal from '../modals/ConfirmModal';
import RolePermissionsManagement from './RolePermissionsManagement';

const Staff = () => {
  const { staff, deleteStaff, updateStaff, showToast, currentUser, records } = useAppContext();
  const [activeStaffTab, setActiveStaffTab] = useState<'list' | 'permissions'>('list');
  const [searchTxt, setSearchTxt] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editStaffId, setEditStaffId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = () => {
    setEditStaffId(null);
    setShowModal(true);
  };

  const handleEdit = (s: any) => {
    setEditStaffId(s.id);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const targetStaff = staff.find(s => s.id === deleteId);
    const associatedRecords = records.filter(r => (r.staff_id || (r as any).staffId) === deleteId);
    
    const safety = checkStaffDeleteSafety(currentUser, targetStaff, staff, associatedRecords.length);
    if (!safety.allowed) {
      showToast(safety.reason || 'Không thể xóa nhân viên này!', 'error');
      setDeleteId(null);
      return;
    }

    const success = await deleteStaff(deleteId);
    if (success) {
      showToast('Đã xóa nhân viên thành công!');
    } else {
      showToast('Xóa nhân viên thất bại do ràng buộc dữ liệu!', 'error');
    }
    setDeleteId(null);
  };

  const toggleStatus = async (id: string) => {
    const s = staff.find(s => s.id === id);
    if (!s) return;

    const newStatus = s.status === 'Hoạt động' ? 'Ngừng hoạt động' : 'Hoạt động';
    const zeroAdmin = checkZeroAdminRisk(staff, id, undefined, newStatus);
    if (zeroAdmin.isRisk) {
      showToast(zeroAdmin.reason || 'Không thể khóa Admin duy nhất!', 'error');
      return;
    }

    await updateStaff(id, { status: newStatus });
    showToast('Đã cập nhật trạng thái!');
  };

  const filteredStaffs = React.useMemo(() => {
    const filtered = staff.filter(s => {
      const staffCd = s.staff_code || (s as any).staffCode;
      const matchSearch = s.name.toLowerCase().includes(searchTxt.toLowerCase()) || 
                          (staffCd && staffCd.toLowerCase().includes(searchTxt.toLowerCase())) ||
                          (s.username && s.username.toLowerCase().includes(searchTxt.toLowerCase())) ||
                          (s.id && s.id.toLowerCase().includes(searchTxt.toLowerCase()));
      const matchRole = roleFilter === 'all' || s.role === roleFilter;
      return matchSearch && matchRole;
    });

    // Deduplicate by id to prevent key warnings
    return filtered.filter((s, index, self) => 
      index === self.findIndex((t) => t.id === s.id)
    );
  }, [staff, searchTxt, roleFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#004182]">Quản Lý Nhân Viên & Phân Quyền</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Quản lý tài khoản cán bộ thu và cấu hình ma trận phân quyền truy cập hệ thống
          </p>
        </div>

        {/* Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
            <button
              onClick={() => setActiveStaffTab('list')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeStaffTab === 'list' 
                  ? 'bg-[#004182] text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Users size={16} /> Danh Sách Cán Bộ
            </button>
            <button
              onClick={() => setActiveStaffTab('permissions')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                activeStaffTab === 'permissions' 
                  ? 'bg-[#004182] text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <ShieldCheck size={16} /> Thiết Lập Phân Quyền
            </button>
          </div>

          {activeStaffTab === 'list' && (
            <button onClick={handleAdd} className="bg-[#004182] text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-800 transition shadow flex items-center justify-center cursor-pointer text-xs sm:text-sm">
              <Plus size={16} className="mr-1.5" /> Thêm Nhân Viên
            </button>
          )}
        </div>
      </div>

      {activeStaffTab === 'permissions' ? (
        <RolePermissionsManagement />
      ) : (
        <>
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 sm:gap-4 bg-slate-50/70 items-center">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchTxt} 
              onChange={e => setSearchTxt(e.target.value)} 
              placeholder="Tìm tên, mã nhân viên..." 
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all" 
            />
          </div>
          <select 
            value={roleFilter} 
            onChange={e => setRoleFilter(e.target.value)} 
            className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-[#004182] focus:ring-2 focus:ring-[#004182]/20 transition-all"
          >
            <option value="all">Tất cả phân quyền</option>
            <option value="Admin">Admin</option>
            <option value="Quản lý">Quản lý</option>
            <option value="Nhân viên">Nhân viên</option>
          </select>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="p-4">Mã NV</th>
                <th className="p-4">Họ và Tên</th>
                <th className="p-4">Phân quyền</th>
                <th className="p-4">Số điện thoại</th>
                <th className="p-4">Khu vực phụ trách</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaffs.map((s, index) => (
                <tr key={s.id || `new-${index}`} className="hover:bg-slate-50/60 transition-colors border-b border-slate-100">
                  <td className="p-4 font-mono font-bold text-slate-600">{s.staff_code || (s as any).staffCode || s.username || s.id || 'NEW'}</td>
                  <td className="p-4 font-semibold text-slate-800">{s.name}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      s.role === 'Admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                      s.role === 'Quản lý' ? 'bg-blue-50 text-[#004182] border border-blue-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {s.role || 'Nhân viên'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{s.phone}</td>
                  <td className="p-4 text-slate-600">{s.area}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => s.id && toggleStatus(s.id)}
                      disabled={!s.id}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center transition disabled:opacity-50 cursor-pointer ${
                        s.status === 'Hoạt động' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                      }`}
                    >
                      {s.status === 'Hoạt động' ? <UserCheck size={14} className="mr-1" /> : <UserX size={14} className="mr-1" />}
                      {s.status}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1.5">
                      <button onClick={() => s.id && handleEdit(s)} disabled={!s.id} className="p-2 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer" title="Sửa">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => s.id && setDeleteId(s.id)} disabled={!s.id} className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition-all disabled:opacity-50 cursor-pointer" title="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStaffs.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Không tìm thấy nhân viên nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredStaffs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Không tìm thấy nhân viên nào.</div>
          ) : (
            filteredStaffs.map((s, index) => (
              <div key={s.id || `new-${index}`} className="p-4 bg-white">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-gray-900">{s.name}</h3>
                    <span className="font-mono text-xs text-gray-500">{s.staff_code || (s as any).staffCode || s.username || s.id || 'NEW'}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    s.role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                    s.role === 'Quản lý' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {s.role || 'Nhân viên'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Số điện thoại</span>
                    <span className="font-medium text-gray-800">{s.phone}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase tracking-wider">Khu vực</span>
                    <span className="font-medium text-gray-800">{s.area}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <button 
                    onClick={() => s.id && toggleStatus(s.id)}
                    disabled={!s.id}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center disabled:opacity-50 ${
                      s.status === 'Hoạt động' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {s.status === 'Hoạt động' ? <UserCheck size={12} className="mr-1" /> : <UserX size={12} className="mr-1" />}
                    {s.status}
                  </button>
                  <div className="flex gap-3">
                    <button onClick={() => s.id && handleEdit(s)} disabled={!s.id} className="text-blue-600 hover:text-blue-800 disabled:opacity-50 flex items-center gap-1">
                      <Edit size={16} />
                      <span className="text-xs font-medium">Sửa</span>
                    </button>
                    <button onClick={() => s.id && setDeleteId(s.id)} disabled={!s.id} className="text-red-500 hover:text-red-700 disabled:opacity-50 flex items-center gap-1">
                      <Trash2 size={16} />
                      <span className="text-xs font-medium">Xóa</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </>
      )}

      {showModal && (
        <StaffModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          staffId={editStaffId} 
        />
      )}

      {deleteId && (
        <ConfirmModal
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          title="Xóa nhân viên"
          message="Bạn có chắc chắn muốn xóa nhân viên này? Hành động này không thể hoàn tác."
        />
      )}
    </div>
  );
};

export default Staff;
