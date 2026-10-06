import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Loader2, ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import AdminLogin from '../AdminLogin';
import { authService } from '../../services';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * ProtectedRoute - Chốt chặn bảo mật phân quyền Zero-Trust
 * - Đảm bảo chỉ người dùng có chữ ký số JWT hợp lệ từ Auth Server mới được xem giao diện
 * - Ngăn chặn triệt để tấn công giả mạo quyền trên client (Client-side Role Tampering)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false 
}) => {
  const { currentUser, isAdmin, isAuthReady, setCurrentUser } = useAppContext();
  const navigate = useNavigate();

  // 1. Chờ kiểm tra chữ ký số JWT và Session trực tiếp từ Server
  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8FAFC] gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-[#004182]" />
        <p className="text-sm font-semibold text-gray-700 tracking-tight">Đang thẩm định phiên bảo mật...</p>
        <p className="text-xs text-gray-400">Xác thực chứng thư số với Auth Server</p>
      </div>
    );
  }

  // 2. Nếu chưa đăng nhập, hiển thị form đăng nhập bảo mật AdminLogin
  if (!currentUser) {
    return <AdminLogin onLoginSuccess={() => {}} />;
  }

  // 3. Nếu yêu cầu quyền Admin tối cao mà tài khoản hiện tại không có quyền
  if (requireAdmin && !isAdmin) {
    const handleLogout = async () => {
      await authService.signOut();
      setCurrentUser(null);
      navigate('/');
    };

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-red-100 shadow-xl text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4 border border-red-100">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">Quyền truy cập bị từ chối</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Tài khoản <span className="font-semibold text-gray-800">{currentUser.name || currentUser.email}</span> ({currentUser.role || 'Nhân viên'}) không có đặc quyền Quản trị viên (Admin) để truy cập khu vực này.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => navigate('/')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-bold transition cursor-pointer"
            >
              <ArrowLeft size={16} /> Về trang chủ
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition shadow-md shadow-red-600/20 cursor-pointer"
            >
              <LogOut size={16} /> Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. Đã thẩm định thành công danh tính và quyền hạn
  return <>{children}</>;
};
