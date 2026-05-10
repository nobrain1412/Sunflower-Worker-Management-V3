import { createContext, useContext, useState, useCallback } from 'react';
import api from '../hooks/useApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // Công ty đang chọn trong dashboard (chỉ dùng cho role quan_ly)
  const [selectedCongTyId, setSelectedCongTyId] = useState(() => {
    const saved = localStorage.getItem('selected_cong_ty_id');
    return saved ? parseInt(saved, 10) : null;
  });

  const login = useCallback(async (ten_dang_nhap, mat_khau) => {
    const res = await api.post('/auth/login', { ten_dang_nhap, mat_khau });
    const userData = res.data.user;
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);

    // Đặt công ty mặc định cho quan_ly là cty đầu tiên
    if (userData.vai_tro === 'quan_ly' && userData.cong_ty_ids?.length > 0) {
      const defaultId = userData.cong_ty_ids[0];
      localStorage.setItem('selected_cong_ty_id', String(defaultId));
      setSelectedCongTyId(defaultId);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('selected_cong_ty_id');
    setUser(null);
    setSelectedCongTyId(null);
  }, []);

  const chonCongTy = useCallback((id) => {
    localStorage.setItem('selected_cong_ty_id', String(id));
    setSelectedCongTyId(id);
  }, []);

  // Kiểm tra nhanh quyền theo role
  const isAdmin   = user?.vai_tro === 'admin';
  const isQuanLy  = user?.vai_tro === 'quan_ly';
  const isVender  = user?.vai_tro === 'vender';
  const canEdit   = isAdmin || isQuanLy;  // có thể sửa CN

  return (
    <AuthContext.Provider value={{
      user, login, logout, isLoggedIn: !!user,
      selectedCongTyId, chonCongTy,
      isAdmin, isQuanLy, isVender, canEdit,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong AuthProvider');
  return ctx;
}
