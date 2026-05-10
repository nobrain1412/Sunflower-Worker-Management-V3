import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Pages
import Login          from './pages/Login';
import Dashboard      from './pages/Dashboard';
import CongNhan       from './pages/CongNhan/index';
import CongNhanDetail from './pages/CongNhan/Detail';
import ScanCCCD       from './pages/OCR/ScanCCCD';
import BulkReview     from './pages/OCR/BulkReview';
import ChamCong       from './pages/ChamCong/index';
import TaiChinh       from './pages/TaiChinh/index';
import KTX            from './pages/KTX/index';
import CongTy         from './pages/CongTy/index';
import BaoCao         from './pages/BaoCao/index';
import NhanSu         from './pages/NhanSu/index';
import NhanVienDetail from './pages/NhanSu/Detail';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function PrivateRoute({ children }) {
  const { isLoggedIn, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  return isLoggedIn
    ? <Layout>{children}</Layout>
    : <Navigate to="/login" replace />;
}

// Chặn route theo role — redirect về / nếu không đủ quyền
function RoleRoute({ children, allowedRoles }) {
  const { isLoggedIn, user, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user?.vai_tro)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function LoginRoute() {
  const { isLoggedIn, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  return isLoggedIn ? <Navigate to="/" replace /> : <Login />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />

            {/* Tất cả role */}
            <Route path="/"              element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/cong-nhan"     element={<PrivateRoute><CongNhan /></PrivateRoute>} />
            <Route path="/cong-nhan/:id" element={<PrivateRoute><CongNhanDetail /></PrivateRoute>} />
            <Route path="/cham-cong"     element={<PrivateRoute><ChamCong /></PrivateRoute>} />

            {/* OCR: tất cả role (vender cần để tuyển) */}
            <Route path="/ocr/cccd"      element={<PrivateRoute><ScanCCCD /></PrivateRoute>} />
            <Route path="/ocr/danh-sach" element={<PrivateRoute><BulkReview /></PrivateRoute>} />

            {/* Chỉ admin và quan_ly */}
            <Route path="/tai-chinh" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><TaiChinh /></RoleRoute>
            } />
            <Route path="/ktx" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><KTX /></RoleRoute>
            } />
            <Route path="/bao-cao" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><BaoCao /></RoleRoute>
            } />

            {/* Chỉ admin */}
            <Route path="/cong-ty" element={
              <RoleRoute allowedRoles={['admin']}><CongTy /></RoleRoute>
            } />
            <Route path="/nhan-su" element={
              <RoleRoute allowedRoles={['admin']}><NhanSu /></RoleRoute>
            } />
            <Route path="/nhan-vien/:id" element={
              <RoleRoute allowedRoles={['admin']}><NhanVienDetail /></RoleRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
