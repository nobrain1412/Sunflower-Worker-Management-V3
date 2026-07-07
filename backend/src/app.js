require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const rateLimit    = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const path         = require('path');
const errorHandler = require('./middleware/errorHandler');
const logger       = require('./utils/logger');

const authRoutes      = require('./routes/auth');
const congNhanRoutes  = require('./routes/congNhan');
const congTyRoutes    = require('./routes/congTy');
const dashboardRoutes = require('./routes/dashboard');
const usersRoutes     = require('./routes/users');
const ktxRoutes       = require('./routes/ktx');
const phongTroRoutes  = require('./routes/phongTro');
const taiChinhRoutes  = require('./routes/taiChinh');
const ocrRoutes       = require('./routes/ocr');
const uploadRoutes    = require('./routes/upload');
const chamCongRoutes  = require('./routes/chamCong');
const hoatDongRoutes  = require('./routes/hoatDong');
const importCongNhanRoutes = require('./routes/importCongNhan');
const importChamCongRoutes = require('./routes/importChamCong');
const congTyDeXuatRoutes   = require('./routes/congTyDeXuat');
const todoRoutes           = require('./routes/todo');
const baoCaoRoutes         = require('./routes/baoCao');
const tuyenDungRoutes      = require('./routes/tuyenDung');

const app = express();

// Trust Railway / reverse proxy — cần thiết để express-rate-limit đọc đúng IP
app.set('trust proxy', 1);

// --- Security ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'connect-src': ["'self'", 'https://provinces.open-api.vn'],
      'frame-src': [
        "'self'",
        'https://www.google.com',
        'https://maps.google.com',
        'https://maps.app.goo.gl',
      ],
      'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
    },
  },
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// --- Rate limit ---
// App nội bộ ~20 user thường DÙNG CHUNG 1 IP (mạng văn phòng/NAT). Giới hạn theo IP
// quá thấp sẽ chặn nhầm cả văn phòng vào giờ cao điểm. Nâng trần lên mức thoải mái
// cho nhiều người sau cùng 1 IP, vẫn đủ chặn abuse/bot.
// RATE_LIMIT_MAX cho phép chỉnh nhanh qua ENV mà không cần deploy lại code.
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Quá nhiều yêu cầu, thử lại sau' } },
}));

// --- Static files (ảnh upload) ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Parser ---
app.use(express.json({ limit: '2mb', strict: false }));
app.use(cookieParser());
app.use(compression());

// --- Request logging ---
app.use((req, _res, next) => {
  logger.debug({ method: req.method, url: req.originalUrl }, 'Incoming request');
  next();
});

// --- Routes ---
app.use('/api/auth',      authRoutes);
// Trang tuyển dụng công khai — KHÔNG yêu cầu đăng nhập
app.use('/api/tuyen-dung', tuyenDungRoutes);
// Import Excel phải đặt TRƯỚC congNhanRoutes vì path overlap (/api/cong-nhan/import-excel)
app.use('/api/cong-nhan/import-excel', importCongNhanRoutes);
app.use('/api/cong-nhan', congNhanRoutes);
// Đề xuất công ty — phải đặt TRƯỚC congTyRoutes vì path overlap (/api/cong-ty/de-xuat)
app.use('/api/cong-ty/de-xuat', congTyDeXuatRoutes);
app.use('/api/cong-ty',   congTyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users',     usersRoutes);
app.use('/api/ktx',       ktxRoutes);
app.use('/api/phong-tro', phongTroRoutes);
app.use('/api/tai-chinh', taiChinhRoutes);
app.use('/api/ocr',       ocrRoutes);
app.use('/api/upload',    uploadRoutes);
// Import chấm công từ Excel — phải đặt TRƯỚC chamCongRoutes vì overlap path
app.use('/api/cham-cong/import-excel', importChamCongRoutes);
app.use('/api/cham-cong', chamCongRoutes);
app.use('/api/hoat-dong', hoatDongRoutes);
app.use('/api/todo',      todoRoutes);
app.use('/api/bao-cao',   baoCaoRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// API 404 — phải đặt trước catch-all của React
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint không tồn tại' } });
});

// Serve frontend React app trong production (Railway)
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');

  // File asset có hash trong tên (Vite) → cache vĩnh viễn (immutable).
  // index.html → no-cache để client luôn lấy bản mới nhất; nếu cache index.html cũ,
  // nó sẽ trỏ tới file JS đã đổi hash và không còn tồn tại → màn hình trắng.
  app.use(express.static(frontendDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));

  // Asset không tồn tại (client giữ index.html cũ trỏ tới JS đã đổi hash sau deploy)
  // → trả 404 THẬT. KHÔNG để rơi vào catch-all bên dưới trả index.html: nếu trả HTML
  // với Content-Type sai + header nosniff, trình duyệt từ chối chạy → trắng trang.
  app.use('/assets', (_req, res) => {
    res.status(404).json({ success: false, error: { code: 'ASSET_NOT_FOUND', message: 'Asset không tồn tại' } });
  });

  // Mọi route còn lại (không phải /api, /assets) đều trả index.html để React Router xử lý
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Error handler (phải là middleware cuối cùng, 4 tham số)
app.use(errorHandler);

module.exports = app;
