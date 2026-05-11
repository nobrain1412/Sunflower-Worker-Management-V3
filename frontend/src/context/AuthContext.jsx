import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api, {
  setAccessToken,
  clearAccessToken,
  setUnauthorizedHandler,
} from '../hooks/useApi';

const AuthContext = createContext(null);
const AUTH_FAILURE_CODES = new Set([
  'NO_REFRESH_TOKEN',
  'INVALID_REFRESH_TOKEN',
  'USER_NOT_FOUND',
  'ACCOUNT_DISABLED',
]);

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
  const [isAuthReady, setIsAuthReady] = useState(false);

  const clearAuthData = useCallback(() => {
    clearAccessToken();
    localStorage.removeItem('user');
    localStorage.removeItem('selected_cong_ty_id');
    setUser(null);
    setSelectedCongTyId(null);
  }, []);

  const applyCongTySelection = useCallback((userData) => {
    if (userData?.vai_tro !== 'quan_ly' || !userData.cong_ty_ids?.length) {
      localStorage.removeItem('selected_cong_ty_id');
      setSelectedCongTyId(null);
      return;
    }

    const saved = localStorage.getItem('selected_cong_ty_id');
    const savedId = saved ? parseInt(saved, 10) : null;

    if (savedId && userData.cong_ty_ids.includes(savedId)) {
      setSelectedCongTyId(savedId);
      return;
    }

    const defaultId = userData.cong_ty_ids[0];
    localStorage.setItem('selected_cong_ty_id', String(defaultId));
    setSelectedCongTyId(defaultId);
  }, []);

  const login = useCallback(async (ten_dang_nhap, mat_khau) => {
    const res = await api.post('/auth/login', { ten_dang_nhap, mat_khau });
    const userData = res.data.user;
    setAccessToken(res.data.access_token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    applyCongTySelection(userData);
  }, [applyCongTySelection]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', null, { skipAuthRefresh: true });
    } catch {
      // Không chặn luồng đăng xuất local nếu request thất bại.
    } finally {
      clearAuthData();
    }
  }, [clearAuthData]);

  const chonCongTy = useCallback((id) => {
    localStorage.setItem('selected_cong_ty_id', String(id));
    setSelectedCongTyId(id);
  }, []);

  // Kiểm tra nhanh quyền theo role
  const isAdmin   = user?.vai_tro === 'admin';
  const isQuanLy  = user?.vai_tro === 'quan_ly';
  const isVender  = user?.vai_tro === 'vender';
  const canEdit   = isAdmin || isQuanLy;  // có thể sửa CN

  useEffect(() => {
    setUnauthorizedHandler(clearAuthData);
    return () => setUnauthorizedHandler(null);
  }, [clearAuthData]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const res = await api.post('/auth/refresh', null, { skipAuthRefresh: true });
        const userData = res?.data?.user || (() => {
          try {
            const raw = localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();
        if (!active) return;

        setAccessToken(res?.data?.access_token || null);
        if (userData) {
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          applyCongTySelection(userData);
        } else {
          clearAuthData();
        }
      } catch (err) {
        if (!active) return;
        // Chỉ clear auth khi refresh token thật sự không hợp lệ/hết phiên.
        // Trường hợp lỗi mạng tạm thời thì giữ phiên local để tránh bị logout khi reload.
        if (AUTH_FAILURE_CODES.has(err?.code)) {
          clearAuthData();
        }
      } finally {
        if (active) setIsAuthReady(true);
      }
    })();

    return () => { active = false; };
  }, [applyCongTySelection, clearAuthData]);

  return (
    <AuthContext.Provider value={{
      user, login, logout, isLoggedIn: !!user, isAuthReady,
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
