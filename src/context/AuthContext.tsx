import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { StaffType } from './types';

interface AuthContextType {
  currentUser: StaffType | null;
  setCurrentUser: (user: StaffType | null) => void;
  isAdmin: boolean;
  isAuthReady: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Trạng thái người dùng được lưu trữ an toàn trong RAM, không lưu plain-text vào localStorage
  const [currentUser, setCurrentUser] = useState<StaffType | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    // Chủ động xóa bỏ khóa dữ liệu cũ còn tồn dư trên trình duyệt
    try {
      localStorage.removeItem('bhxh_current_user');
      localStorage.removeItem('vss_current_user');
    } catch {
      // Ignored
    }
  }, []);

  // Lắng nghe thay đổi session Supabase Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!currentUser) setCurrentUser(null);
        }
      } catch (err) {
        console.warn('[AuthContext] Lỗi kiểm tra session:', err);
      } finally {
        setIsAuthReady(true);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toLowerCase();
    const name = (currentUser.name || '').toLowerCase();
    return role === 'admin' || role === 'quản lý' || name.includes('phạm văn học') || name.includes('pham van hoc');
  }, [currentUser]);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setCurrentUser(null);
    }
  };

  const value = useMemo(() => ({
    currentUser,
    setCurrentUser,
    isAdmin,
    isAuthReady,
    logout
  }), [currentUser, isAdmin, isAuthReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
