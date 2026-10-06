import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Lock, User, AlertCircle, CheckCircle2, Mail, ArrowLeft, Home } from 'lucide-react';
import { authService, staffService } from '../services';

const AdminLogin = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const navigate = useNavigate();
  const { setCurrentUser } = useAppContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isSettingNewPassword, setIsSettingNewPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load remembered username on mount and listen to auth state
  React.useEffect(() => {
    // Xóa bỏ các khóa email rác cũ nếu có trên trình duyệt
    try {
      localStorage.removeItem('remembered_admin_user');
      localStorage.removeItem('vss_current_user');
      localStorage.removeItem('bhxh_current_user');
    } catch {
      // Ignored
    }

    // Dự phòng: Kiểm tra trực tiếp trên thanh địa chỉ nếu có mã recovery
    if (window.location.hash.includes('type=recovery') || window.location.search.includes('error_code')) {
      setIsSettingNewPassword(true);
    }

    const { data: { subscription } } = authService.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsSettingNewPassword(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase();

      // 1. Authenticate with authService
      const { data: authData, error: authError } = await authService.signInWithPassword(cleanUsername, password);

      if (authError) {
        if (authError.message.includes('Email not confirmed')) {
          setError('Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác thực tài khoản. Hoặc tắt tính năng "Confirm email" trong Cài đặt Authentication của Supabase.');
        } else if (authError.message.includes('Invalid login credentials')) {
          setError('Sai email hoặc mật khẩu.');
        } else {
          setError('Lỗi xác thực: ' + authError.message);
        }
        setIsLoading(false);
        return;
      }

      // 2. Fetch staff record matching the authenticated user
      if (authData?.user) {
        const userEmail = (authData.user.email || cleanUsername).trim().toLowerCase();
        let staffUser: any = null;

        // Ưu tiên gọi RPC get_current_staff_profile qua staffService
        try {
          const { profile } = await staffService.getCurrentStaffProfile();
          if (profile) {
            staffUser = profile;
          }
        } catch (e) {
          console.warn("RPC get_current_staff_profile fallback to direct query:", e);
        }

        // Fallback sang tra cứu staff qua staffService nếu RPC chưa nạp
        if (!staffUser) {
          const byAuthId = await staffService.getStaffByAuthId(authData.user.id);
          if (byAuthId) {
            staffUser = byAuthId;
          } else {
            const byEmail = await staffService.getStaffByEmail(userEmail);
            if (byEmail) {
              staffUser = byEmail;
              await staffService.bindStaffAuthUser(byEmail.id, authData.user.id);
            }
          }
        }

        if (staffUser) {
          if (staffUser.status === 'Tạm khóa') {
            setError('Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Admin.');
            await authService.signOut();
            setIsLoading(false);
            return;
          }

          setCurrentUser(staffUser);
          onLoginSuccess();
        } else {
          console.warn("User authenticated in Supabase Auth but not found in staff table:", authData.user);
          setError('Tài khoản email đã xác thực nhưng chưa được khai báo trong bảng Nhân sự (Staff). Vui lòng thêm hồ sơ nhân viên cho email này.');
          await authService.signOut();
        }
      }
    } catch (err: any) {
      console.error("Password Login Error:", err);
      setError('Đăng nhập thất bại: Lỗi hệ thống nội bộ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const cleanEmail = username.trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        setError('Vui lòng nhập Email chính xác.');
        setIsLoading(false);
        return;
      }

      // Check if email exists in staffService first
      const { exists: staffExists, error: staffError } = await staffService.checkStaffEmailExists(cleanEmail);

      if (staffError) {
        setError('Không thể kiểm tra thông tin nhân viên trong hệ thống.');
        setIsLoading(false);
        return;
      }

      if (!staffExists) {
        setError('Email này chưa được quản trị viên cấp phép/thêm vào danh sách nhân viên. Vui lòng liên hệ quản trị viên.');
        setIsLoading(false);
        return;
      }

      // If exists, proceed to signup in authService
      const { error: authError } = await authService.signUp(cleanEmail, password);

      if (authError) {
        setError('Lỗi đăng ký tài khoản: ' + authError.message);
        setIsLoading(false);
        return;
      }

      setMessage('Đăng ký thành công! Hãy đăng nhập lại bằng tài khoản vừa tạo.');
      setIsRegistering(false);
      setPassword('');
    } catch (err: any) {
      console.error("Registration Error:", err);
      setError('Đăng ký thất bại: Lỗi hệ thống.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        setError('Vui lòng nhập Email chính xác.');
        setIsLoading(false);
        return;
      }
      
      const { error } = await authService.resetPasswordForEmail(cleanEmail, window.location.origin + '/admin');
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Đã gửi email khôi phục mật khẩu. Vui lòng kiểm tra hộp thư của bạn.');
      }
    } catch (err: any) {
      console.error("Forgot Password Error:", err);
      setError('Lỗi hệ thống: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      if (password.length < 6) {
        setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
        setIsLoading(false);
        return;
      }

      // Update password in authService
      const { error } = await authService.updateUser({
        password: password
      });

      if (error) throw error;

      setMessage('Mật khẩu đã được cập nhật thành công!');
      setIsSettingNewPassword(false);
      setPassword('');
      
      // Let the user login again normally or automatically log them in
      await authService.signOut();
    } catch (err: any) {
      console.error("Update Password Error:", err);
      setError('Lỗi cập nhật mật khẩu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#004182] transition-colors group cursor-pointer"
            title="Quay lại Cổng dịch vụ công"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1 text-gray-400 group-hover:text-[#004182]" />
            <span>Quay lại trang chủ</span>
          </button>
          <span className="text-[11px] font-semibold px-2 py-0.5 bg-blue-50 text-[#004182] rounded-full border border-blue-100/60">
            Cổng dịch vụ công
          </span>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#004182]">
            {isSettingNewPassword ? 'Cấu hình mật khẩu mới' : isForgotPassword ? 'Khôi phục mật khẩu' : isRegistering ? 'Đăng ký tài khoản' : 'Đăng nhập Quản trị'}
          </h2>
          <p className="text-gray-500 mt-2 text-sm">
            Hệ thống quản lý thu BHXH tự nguyện, BHYT hộ gia đình
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle2 size={16} className="flex-shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {isSettingNewPassword ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#004182] text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition shadow-sm disabled:opacity-70 mt-2"
            >
              {isLoading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email liên kết với tài khoản</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={18} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập địa chỉ email của bạn"
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#004182] text-white py-2.5 rounded-lg font-semibold hover:bg-blue-800 transition shadow-sm disabled:opacity-70 mt-2"
            >
              {isLoading ? 'Đang gửi...' : 'Lấy lại mật khẩu'}
            </button>
            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => { setIsForgotPassword(false); setError(''); setMessage(''); }}
                className="text-sm text-[#004182] hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        ) : isRegistering ? (
          <form onSubmit={handleRegister} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email nhân viên (*)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input 
                  type="email" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập email đăng ký của bạn"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới (*)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập mật khẩu (ít nhất 6 ký tự)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#004182] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition shadow-md disabled:opacity-70 mt-6 active:scale-[0.98]"
            >
              {isLoading ? 'Đang đăng ký...' : 'Đăng ký tài khoản'}
            </button>
            <div className="text-center mt-4">
              <button 
                type="button" 
                onClick={() => { setIsRegistering(false); setError(''); setMessage(''); }}
                className="text-sm text-[#004182] hover:underline"
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePasswordLogin} className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email đăng nhập</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={18} className="text-gray-400" />
                </div>
                <input 
                  type="text" 
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập email của bạn..."
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={18} className="text-gray-400" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#004182] focus:border-transparent outline-none transition"
                  placeholder="Nhập mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-gray-300 text-[#004182] focus:ring-[#004182] w-4 h-4 transition cursor-pointer"
                />
                <span className="ml-2 text-sm text-gray-600 group-hover:text-[#004182] transition">Ghi nhớ</span>
              </label>
              
              <div className="flex gap-2.5 items-center">
                <button 
                  type="button" 
                  onClick={() => { setIsRegistering(true); setError(''); setMessage(''); }}
                  className="text-sm text-[#004182] hover:underline transition font-semibold"
                >
                  Đăng ký
                </button>
                <span className="text-gray-300">|</span>
                <button 
                  type="button" 
                  onClick={() => { setIsForgotPassword(true); setError(''); setMessage(''); }}
                  className="text-sm text-[#004182] hover:underline transition font-semibold"
                >
                  Quên mật khẩu?
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-[#004182] text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition shadow-md disabled:opacity-70 mt-6 active:scale-[0.98] cursor-pointer"
            >
              {isLoading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-gray-600 hover:text-[#004182] bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition active:scale-[0.98] cursor-pointer"
              >
                <Home size={16} />
                <span>Quay lại trang chủ</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
