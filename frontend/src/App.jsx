import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AppErrorBoundary from './components/AppErrorBoundary';

// Pages — lazy load để tách bundle theo route (recharts, qr-scanner... chỉ tải khi cần).
// Giảm mạnh kích thước file JS tải lần đầu → vào web nhanh hơn nhiều.
const Login          = lazy(() => import('./pages/Login'));
const DangKy         = lazy(() => import('./pages/DangKy'));
const TuyenDung      = lazy(() => import('./pages/TuyenDung'));
const TraCuuCong     = lazy(() => import('./pages/TraCuuCong'));
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const CongNhan       = lazy(() => import('./pages/CongNhan/index'));
const CongNhanDetail = lazy(() => import('./pages/CongNhan/Detail'));
const ImportExcel    = lazy(() => import('./pages/CongNhan/ImportExcel'));
const DuyetQueue     = lazy(() => import('./pages/CongNhan/DuyetQueue'));
const InHoSo         = lazy(() => import('./pages/CongNhan/InHoSo'));
const ScanCCCD       = lazy(() => import('./pages/OCR/ScanCCCD'));
const BulkReview     = lazy(() => import('./pages/OCR/BulkReview'));
const ChamCong       = lazy(() => import('./pages/ChamCong/index'));
const ImportChamCong = lazy(() => import('./pages/ChamCong/ImportExcel'));
const TraCuuVanTay   = lazy(() => import('./pages/ChamCong/TraCuuVanTay'));
const TaiChinh       = lazy(() => import('./pages/TaiChinh/index'));
const KTX            = lazy(() => import('./pages/KTX/index'));
const CongTy         = lazy(() => import('./pages/CongTy/index'));
const CongTyDeXuat   = lazy(() => import('./pages/CongTy/DeXuatPage'));
const BaoCao         = lazy(() => import('./pages/BaoCao/index'));
const NhanSu         = lazy(() => import('./pages/NhanSu/index'));
const NhanVienDetail = lazy(() => import('./pages/NhanSu/Detail'));
const CongTacVienDetail = lazy(() => import('./pages/NhanSu/CongTacVienDetail'));

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

// Route cần đăng nhập nhưng KHÔNG bọc Layout — dùng cho trang in để bản in
// không dính sidebar/topbar và nền tối của app.
function BareRoute({ children }) {
  const { isLoggedIn, isAuthReady } = useAuth();
  if (!isAuthReady) return <div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />;
  return isLoggedIn ? children : <Navigate to="/login" replace />;
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
            <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg0)' }} />}>
            <Routes>
              <Route path="/login"   element={<LoginRoute />} />
              <Route path="/dang-ky" element={<DangKyRoute />} />

            {/* Trang tuyển dụng công khai — homepage, không cần đăng nhập */}
            <Route path="/"              element={<TuyenDung />} />
            {/* Tra cứu ngày công công khai — công nhân tự kiểm tra, không cần đăng nhập */}
            <Route path="/tra-cuu-cong"  element={<TraCuuCong />} />

            {/* Trang quản lý (dashboard) — cần đăng nhập */}
            <Route path="/quan-ly"       element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/cong-nhan"     element={<PrivateRoute><CongNhan /></PrivateRoute>} />
            <Route path="/cong-nhan/import-excel" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><ImportExcel /></RoleRoute>
            } />
            <Route path="/cong-nhan/duyet" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><DuyetQueue /></RoleRoute>
            } />
            {/* Trang in hồ sơ (?ids=1,2,3) — ngoài Layout để bản in sạch */}
            <Route path="/cong-nhan/in-ho-so" element={<BareRoute><InHoSo /></BareRoute>} />
            <Route path="/cong-nhan/:id" element={<PrivateRoute><CongNhanDetail /></PrivateRoute>} />
            <Route path="/cham-cong"     element={<PrivateRoute><ChamCong /></PrivateRoute>} />
            <Route path="/cham-cong/import-excel" element={
              <RoleRoute allowedRoles={['admin','quan_ly']}><ImportChamCong /></RoleRoute>
            } />
            <Route path="/cham-cong/tra-cuu-van-tay" element={
              <RoleRoute allowedRoles={['admin','quan_ly','ke_toan','vender']}><TraCuuVanTay /></RoleRoute>
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
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
