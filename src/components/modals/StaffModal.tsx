import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { formatTitleCase } from '../../utils/helpers';
import { validateStaffInput, checkZeroAdminRisk } from '../../utils/security';
import { X, Save } from 'lucide-react';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string | null;
}

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, staffId }) => {
  const { staff, addStaff, updateStaff, showToast } = useAppContext();
  const [formData, setFormData] = useState({ id: '', name: '', cccd: '', phone: '', email: '', area: '', status: 'Hoạt động', role: 'Nhân viên', username: '', staffCode: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (staffId) {
        const s = staff.find(x => x.id === staffId);
        if (s) setFormData({ 
          id: s.id || '', 
          name: s.name || '', 
          cccd: s.cccd || '',
          phone: s.phone || '', 
          email: s.email || '',
          area: s.area || '', 
          status: s.status || 'Hoạt động', 
          role: s.role || 'Nhân viên',
          username: s.username || s.id || '',
          staffCode: s.staffCode || s.username || s.id || ''
        });
      } else {
        const randomNum = Math.floor(Math.random() * 90000 + 10000).toString();
        const generatedCode = 'NV' + randomNum;
        setFormData({ id: '', name: '', cccd: '', phone: '', email: '', area: '', status: 'Hoạt động', role: 'Nhân viên', username: '', staffCode: generatedCode });
      }
    }
  }, [isOpen, staffId, staff]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // 1. Thẩm tra dữ liệu đầu vào (Input Validation)
    const validation = validateStaffInput(formData);
    if (!validation.valid) {
      showToast(validation.errors[0], 'error');
      return;
    }

    // 2. Thẩm tra rủi ro Zero-Admin Lockout
    if (staffId) {
      const zeroAdminRisk = checkZeroAdminRisk(staff, staffId, formData.role, formData.status);
      if (zeroAdminRisk.isRisk) {
        showToast(zeroAdminRisk.reason || 'Không thể hạ quyền hoặc khóa Admin duy nhất!', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      if (staffId) {
        // Update existing staff
        const newStaff = { ...formData, name: formatTitleCase(formData.name) };
        await updateStaff(staffId, newStaff);
        showToast('Cập nhật nhân viên thành công!');
        onClose();
      } else {
        // Create new staff
        const existingStaff = staff.find(s => s.username === formData.username || (formData.email && s.email === formData.email));
        if (existingStaff) {
           showToast('Lỗi: Email/Tài khoản này đã tồn tại trong hệ thống. Vui lòng thử một email khác.');
           setIsSubmitting(false);
           return;
        }

        const newStaff = { 
          ...formData, 
          id: formData.username, // Use username as ID for simplicity
          name: formatTitleCase(formData.name) 
        };
        await addStaff(newStaff);
        showToast('Thêm nhân viên mới thành công!');
        onClose();
      }
    } catch (error: any) {
      showToast('Lỗi: ' + (error.message || 'Không thể thao tác'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#004182]/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6 transition-opacity duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-transform duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#004182] to-[#0077c8] p-5 flex justify-between items-center text-white">
          <h3 className="font-bold text-xl">{staffId ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới'}</h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Nhân Viên (*)</label>
                <input type="text" required value={formData.staffCode} onChange={e => setFormData({...formData, staffCode: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base font-bold text-[#004182] outline-none focus:border-[#0ea5e9]" placeholder="Nhập mã nhân viên" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Trạng thái (*)</label>
                <select value={formData.status || 'Hoạt động'} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]">
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm khóa">Tạm khóa</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và tên (*)</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: formatTitleCase(e.target.value)})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]" placeholder="Vd: Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số CCCD</label>
                <input type="text" inputMode="numeric" value={formData.cccd} onChange={e => setFormData({...formData, cccd: e.target.value.replace(/\D/g, '').slice(0, 12)})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]" placeholder="Nhập 12 số CCCD" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số điện thoại (*)</label>
                <input type="text" inputMode="numeric" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]" placeholder="Số Zalo liên hệ" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phân quyền (*)</label>
                <select value={formData.role || 'Nhân viên'} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]">
                  <option value="Admin">Admin</option>
                  <option value="Quản lý">Quản lý</option>
                  <option value="Nhân viên">Nhân viên</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Khu vực phụ trách (*)</label>
                <input type="text" required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base outline-none focus:border-[#0ea5e9]" placeholder="Vd: Xã Mường Hung" />
              </div>

              <div className="md:col-span-2 mt-2 border-t border-gray-100 pt-4">
                <h4 className="font-bold text-[#004182] mb-4">Thông tin đăng nhập</h4>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Email đăng nhập (*)</label>
                    <input type="email" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value, email: e.target.value})} className="w-full p-3 rounded-xl border border-gray-200 text-base font-bold text-gray-600 outline-none focus:border-[#0ea5e9]" placeholder="Nhập email đăng nhập" />
                    <p className="text-xs text-gray-500 mt-2">Email này sẽ được sử dụng để đăng nhập hệ thống quản trị. Nhân viên sẽ tự đăng ký mật khẩu bằng Email này.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 mt-8 pt-5 border-t border-gray-200">
              <button type="button" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto px-6 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition order-2 sm:order-1 disabled:opacity-50">Hủy bỏ</button>
              <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[#004182] text-white font-bold text-lg hover:bg-blue-800 shadow-lg transition transform active:scale-95 flex items-center justify-center order-1 sm:order-2 disabled:opacity-50">
                <Save size={20} className="mr-2" /> {isSubmitting ? 'Đang lưu...' : 'Lưu Nhân Viên'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StaffModal;
