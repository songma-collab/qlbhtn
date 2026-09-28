import React from 'react';
import { StaffType } from '../../context/types';
import { X, Phone, Mail, MapPin, Shield, CreditCard, Tag, CheckCircle2, Clock } from 'lucide-react';
import { getInitials } from '../../utils/helpers';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: StaffType | null;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, user }) => {
  if (!isOpen || !user) return null;

  const isActive = user.status === 'Đang hoạt động' || user.status === 'Hoạt động';

  return (
    <div className="fixed inset-0 bg-[#004182]/60 backdrop-blur-xs z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header with gradient banner */}
        <div className="bg-gradient-to-r from-[#004182] via-[#005ba4] to-[#0ea5e9] p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white text-[#004182] flex items-center justify-center font-black text-2xl shadow-lg border-2 border-white/40 shrink-0">
              {getInitials(user.name || 'User')}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-xl text-white truncate leading-tight">
                {user.name || 'Chưa cập nhật tên'}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs px-2.5 py-0.5 rounded-full font-bold backdrop-blur-xs">
                  <Shield size={12} /> {user.role || 'Nhân viên'}
                </span>
                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isActive ? 'bg-emerald-400/30 text-emerald-100 border border-emerald-300/40' : 'bg-rose-400/30 text-rose-100 border border-rose-300/40'
                }`}>
                  {isActive ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                  {user.status || 'Đang hoạt động'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Mã nhân viên */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#004182] flex items-center justify-center shrink-0 mt-0.5">
                <Tag size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mã Nhân Viên</span>
                <span className="text-sm font-bold text-slate-800 break-all">{user.staffCode || user.username || user.id || '---'}</span>
              </div>
            </div>

            {/* Số CCCD / CMND */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <CreditCard size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Số CCCD / Định danh</span>
                <span className="text-sm font-bold text-slate-800 break-all">{user.cccd || 'Chưa cập nhật'}</span>
              </div>
            </div>

            {/* Số điện thoại */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <Phone size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Số Điện Thoại</span>
                <span className="text-sm font-bold text-slate-800 break-all">{user.phone || 'Chưa cập nhật'}</span>
              </div>
            </div>

            {/* Email */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                <Mail size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Email Tài Khoản</span>
                <span className="text-sm font-bold text-slate-800 break-all">{user.email || 'Chưa cập nhật'}</span>
              </div>
            </div>
          </div>

          {/* Khu vực phụ trách */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Khu Vực / Địa Bàn Phụ Trách</span>
              <span className="text-sm font-bold text-slate-800">{user.area || 'Toàn bộ địa bàn huyện Sông Mã'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#004182] hover:bg-[#003366] text-white font-bold text-sm transition shadow-md cursor-pointer border-none"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
