import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';

// Pages
import Login          from './pages/Login';
import DangKy         from './pages/DangKy';
import TuyenDung      from './pages/TuyenDung';
import Dashboard      from './pages/Dashboard';
import CongNhan       from './pages/CongNhan/index';
import CongNhanDetail from './pages/CongNhan/Detail';
import ImportExcel    from './pages/CongNhan/ImportExcel';
import DuyetQueue     from './pages/CongNhan/DuyetQueue';
import ScanCCCD       from './pages/OCR/ScanCCCD';
import BulkReview     from './pages/OCR/BulkReview';
import ChamCong       from './pages/ChamCong/index';
import ImportChamCong from './pages/ChamCong/ImportExcel';
import TaiChinh       from './pages/TaiChinh/index';
import KTX            from './pages/KTX/index';
import CongTy         from './pages/CongTy/index';
import CongTyDeXuat   from './pages/CongTy/DeXuatPage';
import BaoCao         from './pages/BaoCao/index';
import NhanSu         from './pages/NhanSu/index';
import NhanVienDetail from './pages/NhanSu/Detail';
import CongTacVienDetail from './pages/NhanSu/CongTacVienDetail';

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

// Chặn route theo role — redirect về / nếu không đủ quyền.
// `allowKtx`: cho phép thêm user được admin cấp quyền KTX (ngoài allowedRoles).
function RoleRoute({ children, allowedRoles, allowKtx }) {
  const { isLoggedIn, user, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  const okRole = allowedRoles.includes(user?.vai_tro);
  const okKtx  = allowKtx && user?.quyen_ktx;
  if (!okRole && !okKtx) return <Navigate to="/quan-ly" replace />;
  return <Layout>{children}</Layout>;
}

function LoginRoute() {
  const { isLoggedIn, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  return isLoggedIn ? <Navigate to="/quan-ly" replace /> : <Login />;
}

function DangKyRoute() {
  const { isLoggedIn, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  return isLoggedIn ? <Navigate to="/quan-ly" replace /> : <DangKy />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login"   element={<LoginRoute />} />
              <Route path="/dang-ky" element={<DangKyRoute />} />

            {/* Trang tuyển dụng công khai — homepage, không cần đăng nhập */}
            <Route path="/"              element={<TuyenDung />} />

            {/* Trang quản lý (dashboard) — cần đăng nhập */}
            <Route path="/quan-ly"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/cong-nhan"     element={<PrivateRoute><CongNhan /></PrivateRoute>} />
            <Route path="/cong-nhan/import-excel" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><ImportExcel /></RoleRoute>
            } />
            <Route path="/cong-nhan/duyet" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><DuyetQueue /></RoleRoute>
            } />
            <Route path="/cong-nhan/:id" element={<PrivateRoute><CongNhanDetail /></PrivateRoute>} />
            <Route path="/cham-cong"     element={<PrivateRoute><ChamCong /></PrivateRoute>} />
            <Route path="/cham-cong/import-excel" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><ImportChamCong /></RoleRoute>
            } />

            {/* OCR: vender/quản lý/admin (ke_toan không tham gia tuyển) */}
            <Route path="/ocr/cccd" element={
              <RoleRoute allowedRoles={['admin','quan_ly','vender']}><ScanCCCD /></RoleRoute>
            } />
            <Route path="/ocr/danh-sach" element={
              <RoleRoute allowedRoles={['admin','quan_ly','vender']}><BulkReview /></RoleRoute>
            } />

            {/* Tài chính: sổ cá nhân — chỉ admin/quan_ly/vender, ke_toan không có sổ */}
            <Route path="/tai-chinh" element={
              <RoleRoute allowedRoles={['admin','quan_ly','vender']}><TaiChinh /></RoleRoute>
            } />
            <Route path="/phong-tro" element={
              <RoleRoute allowedRoles={['admin','quan_ly','vender']}><KTX forcePhongTro /></RoleRoute>
            } />

            {/* Chỉ admin */}
            <Route path="/ktx" element={
              <RoleRoute allowedRoles={['admin']} allowKtx><KTX /></RoleRoute>
            } />

            <Route path="/cong-ty" element={
              <RoleRoute allowedRoles={['admin','quan_ly','ke_toan','vender','cong_tac_vien']}><CongTy /></RoleRoute>
            } />
            <Route path="/cong-ty/de-xuat" element={
              <RoleRoute allowedRoles={['admin','quan_ly','ke_toan','vender','cong_tac_vien']}><CongTyDeXuat /></RoleRoute>
            } />
            <Route path="/nhan-su" element={
              <RoleRoute allowedRoles={['admin']}><NhanSu /></RoleRoute>
            } />
            <Route path="/cong-tac-vien/:id" element={
              <RoleRoute allowedRoles={['admin']}><CongTacVienDetail /></RoleRoute>
            } />
            <Route path="/nhan-vien/:id" element={
              <RoleRoute allowedRoles={['admin']}><NhanVienDetail /></RoleRoute>
            } />
            <Route path="/bao-cao" element={
              <RoleRoute allowedRoles={['admin','quan_ly','ke_toan']}><BaoCao /></RoleRoute>
            } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
